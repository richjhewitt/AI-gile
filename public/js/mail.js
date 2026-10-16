/* ---------- ✉️ Mail (AIG-902, docs/MAIL-PLAN.md card 1) ---------- */
// #/mail lists the newest 50 mails of the first mailbox: unread dot, From, Subject, date. The cached list shows at once, then
// the board fetches it fresh (GET /api/mail/inbox?fresh=1). Reading a mail is card 2. The ✉️ Mail link in the top bar shows
// only once a mailbox is set up. Setup > ✉️ Mail (setupHtml) adds or changes it: find settings, test, save, remove; saving and
// testing take the secrets page token (secToken in dialogs/secrets.js). The password is never sent back to the page.
// Outlook.com / Microsoft 365 (AIG-909): "Sign in with: Microsoft" swaps the password for a device-code sign-in.
// Mail is untrusted data: every field from it goes through esc(). Hidden in 🎥 streamer mode.
const Mail = (() => {
  const M = { cfg: null, data: null, loading: false, msg: '', seen: 0, setupMsg: '' };
  const box = () => (M.cfg && M.cfg.boxes && M.cfg.boxes[0]) || null;
  const hidden = () => typeof Streamer !== 'undefined' && Streamer.on && Streamer.on();
  const q = id => encodeURIComponent(id);
  M.watch = async (options = {}) => {
    try { M.cfg = await PagePoll.get('/api/mail/config', options); } catch { return; }
    const n = $('mailNav'); if (n) n.style.display = box() ? '' : 'none';
  };
  // Called by the 1s refresh while #/mail is open: cheap after the first time; a fresh fetch when the page is (re)opened.
  M.load = async (options = {}) => {
    if (!M.cfg) await M.watch(options);
    if (options.signal?.aborted) return;
    const b = box(); if (!b || hidden()) return;
    if (!M.data || M.data.box.id !== b.id) { try { M.data = await api('GET', '/api/mail/inbox?box=' + q(b.id), undefined, options); } catch (e) { if (options.signal?.aborted) return; M.data = { box: b, items: [], error: e.message }; } }
    const back = Date.now() - M.seen > 4000; M.seen = Date.now();
    if (back && !M.loading) M.refresh();
  };
  const paint = () => { if (state.route.view === 'mail') $('app').innerHTML = M.render(); };
  M.refresh = async () => {
    const b = box(); if (!b) return;
    M.loading = true; M.msg = ''; paint();
    try { M.data = await api('GET', '/api/mail/inbox?fresh=1&box=' + q(b.id)); } catch (e) { M.data = { ...(M.data || { box: b, items: [] }), error: e.message }; }
    M.loading = false; paint();
  };
  M.forget = async () => {
    const b = box(); if (!b) return;
    try { await api('POST', '/api/mail/forget', { box: b.id }); M.msg = t('mail.forgot'); M.data = { box: b, items: [], at: null, cached: false, error: '' }; } catch (e) { M.msg = e.message; }
    paint();
  };
  // Open one mail (AIG-903): GET /api/mail/message?box=&uid= reads it with BODY.PEEK (it stays unread on the server).
  M.open = async uid => {
    const b = box(); if (!b) return;
    M.cur = { uid, loading: true, html: false }; paint();
    api('GET', '/api/projects').then(l => { M.projs = l; paint(); }).catch(() => {});
    try { const d = await api('GET', '/api/mail/message?box=' + q(b.id) + '&uid=' + encodeURIComponent(uid)); if (M.cur && M.cur.uid === uid) M.cur = { uid, d, html: !d.text && !!d.html }; }
    catch (e) { if (M.cur && M.cur.uid === uid) M.cur = { uid, error: e.message }; }
    // ✍️ Drafts agents saved for this mail (AIG-908)
    try { const r = await api('GET', '/api/mail/drafts?box=' + q(b.id) + '&uid=' + encodeURIComponent(uid)); if (M.cur && M.cur.uid === uid) M.cur.drafts = r.drafts; } catch {}
    paint();
  };
  M.back = () => { M.cur = null; paint(); };
  // 📋 Make a card from the open mail (AIG-905): subject as title, sender, date and the first lines as bullets; no AI. Lands in
  // backlog so no team is woken by it.
  const projects = () => (M.projs || []).filter(p => !p.archived);   // fetched fresh each time a mail opens
  M.makeCard = async () => {
    const c = M.cur, d = c && c.d, slug = ($('mailCardProj') || {}).value; if (!d || !slug) return;
    const who = d.from || {}, lines = String(d.text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^>/.test(l)).slice(0, 5);
    const description = [`- 📧 ${who.name ? who.name + ' <' + who.address + '>' : who.address || '?'}, ${fmt(d.date)}`, ...lines.map(l => '- ' + l.slice(0, 200))].join('\n\n');
    try {
      const card = await api('POST', `/api/projects/${slug}/cards`, { title: (d.subject || t('mail.nosubject')).slice(0, 200), description, type: 'task', status: 'backlog', createdBy: me() });
      c.made = t('mail.card.made', { id: card.id, project: (projects().find(p => p.slug === slug) || {}).name || slug });
    } catch (e) { c.made = e.message; }
    paint();
  };
  // ↩️ Reply / ✏️ New mail (AIG-904): only you send. Send waits 10 s with an Undo button before the request goes out; the
  // server takes it only with the secrets page token (lib/mailsend.js), so the CLI and agents can't send.
  const UNDO_S = () => window.__mailUndoS || 10;   // QA shortens it
  M.newMail = () => { M.compose = { to: '', subject: '', text: '' }; paint(); };
  M.reply = () => {
    const d = M.cur && M.cur.d; if (!d) return;
    const subj = d.subject || '', quote = String(d.text || '').split(/\r?\n/).slice(0, 40).map(l => '> ' + l).join('\n');
    M.compose = { to: (d.from || {}).address || '', subject: /^re:/i.test(subj) ? subj : 'Re: ' + subj, text: '\n\n' + t('mail.send.wrote', { who: (d.from || {}).name || (d.from || {}).address || '?' }) + '\n' + quote, inReplyTo: d.messageId || '' };
    paint();
  };
  // ✍️ Use an agent's draft (AIG-908): opens ↩️ Reply with the draft on top of the quote; you still read it and send it.
  M.useDraft = i => { const x = M.cur && (M.cur.drafts || [])[i]; if (!x) return; M.reply(); if (M.compose) { M.compose.text = x.text + M.compose.text; paint(); } };
  M.cancelCompose = () => { if (M.compose && M.compose.timer) clearInterval(M.compose.timer); M.compose = null; paint(); };
  M.send = () => {
    const c = M.compose; if (!c || c.timer) return;
    c.to = ($('mcTo') || {}).value || ''; c.subject = ($('mcSubj') || {}).value || ''; c.text = ($('mcText') || {}).value || '';
    if (!c.to.trim()) { c.msg = t('mail.send.noto'); return paint(); }
    c.left = UNDO_S(); c.msg = '';
    c.timer = setInterval(async () => {
      if (--c.left > 0) return paint();
      clearInterval(c.timer); c.timer = null; c.left = 0; c.sending = true; paint();
      try { await api('POST', '/api/mail/send', { token: await secToken(), box: (box() || {}).id, to: c.to, subject: c.subject, text: c.text, inReplyTo: c.inReplyTo }); M.compose = null; M.msg = t('mail.send.sent'); }
      catch (e) { c.sending = false; c.msg = e.message; }
      paint();
    }, 1000);
    paint();
  };
  M.undoSend = () => { const c = M.compose; if (c && c.timer) { clearInterval(c.timer); c.timer = null; c.left = 0; c.msg = t('mail.send.undone'); paint(); } };
  M.renderCompose = b => {
    const c = M.compose, busy = !!c.timer || c.sending;
    return `<div class="uz mail-page"><h2>${esc(t(c.inReplyTo ? 'mail.send.reply' : 'mail.send.new'))} <span class="muted" style="font-size:14px;font-weight:normal">${esc(b.address)}</span></h2>
      <div class="mail-compose" id="mailCompose" style="display:flex;flex-direction:column;gap:6px;max-width:720px">
        <input id="mcTo" type="text" maxlength="2000" value="${esc(c.to)}" placeholder="${esc(t('mail.send.to'))}" aria-label="${esc(t('mail.send.to'))}" ${busy ? 'disabled' : ''}>
        <input id="mcSubj" type="text" maxlength="300" value="${esc(c.subject)}" placeholder="${esc(t('mail.col.subject'))}" aria-label="${esc(t('mail.col.subject'))}" ${busy ? 'disabled' : ''}>
        <textarea id="mcText" rows="12" aria-label="${esc(t('mail.send.body'))}" ${busy ? 'disabled' : ''}>${esc(c.text)}</textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${c.timer ? `<button type="button" class="primary" id="mcUndo" onclick="Mail.undoSend()">${esc(t('mail.send.undo', { n: c.left }))}</button>`
            : `<button type="button" class="primary" id="mcSend" onclick="Mail.send()" ${c.sending ? 'disabled' : ''}>${esc(t(c.sending ? 'mail.send.sending' : 'mail.send.send'))}</button>`}
          <button type="button" id="mcCancel" onclick="Mail.cancelCompose()" ${busy ? 'disabled' : ''}>${esc(t('mail.send.cancel'))}</button>
          <span class="muted" id="mcMsg">${esc(c.msg || '')}</span></div></div></div>`;
  };
  // 🏷️ Rules without AI (AIG-906, lib/mailrules.js): label and/or suggest a card; never move, mark read or delete a mail.
  M.toggleRules = async () => {
    M.showRules = !M.showRules; M.rulesMsg = '';
    if (M.showRules && !M.rules) { try { M.rules = (await api('GET', '/api/mail/rules')).rules; } catch (e) { M.rulesMsg = e.message; } }
    paint();
  };
  const saveRules = async (rules, body) => {
    try { M.rules = (await api('POST', '/api/mail/rules', body || { rules })).rules; M.rulesMsg = t('mail.rules.saved'); M.data = null; M.refresh(); }
    catch (e) { M.rulesMsg = e.message; paint(); }
  };
  M.ruleOn = (i, on) => saveRules(M.rules.map((r, j) => j === i ? { ...r, on } : r));
  M.ruleDel = i => saveRules(M.rules.filter((_, j) => j !== i));
  M.rulesReset = () => { if (confirm(t('mail.rules.reset.sure'))) saveRules(null, { reset: true }); };
  M.ruleAdd = () => {
    const g = id => (($(id) || {}).value || '').trim();
    saveRules([...(M.rules || []), { name: g('mrName'), from: g('mrFrom'), subject: g('mrSubj'), label: g('mrLabel'), card: !!($('mrCard') || {}).checked, on: true }]);
  };
  M.rulesHtml = () => {
    const rs = M.rules || [];
    const li = (r, i) => `<li class="mail-rule" style="margin:4px 0"><label><input type="checkbox" ${r.on ? 'checked' : ''} onchange="Mail.ruleOn(${i}, this.checked)"> <b>${esc(r.name)}</b></label>
      <span class="muted">${esc([r.from && t('mail.rules.from', { v: r.from }), r.subject && t('mail.rules.subject', { v: r.subject })].filter(Boolean).join(', '))} → ${esc([r.label, r.card && '📋'].filter(Boolean).join(' '))}</span>
      <button type="button" class="mail-rule-del" title="${esc(t('mail.rules.del'))}" aria-label="${esc(t('mail.rules.del'))}" onclick="Mail.ruleDel(${i})"><span aria-hidden="true">✕</span></button></li>`;
    const inp = (id, key, ml) => `<input id="${id}" type="text" maxlength="${ml}" placeholder="${esc(t(key))}" aria-label="${esc(t(key))}" style="min-width:120px">`;
    return `<div class="mail-rules" id="mailRules" style="border:1px solid var(--border,#8884);border-radius:8px;padding:8px 12px;margin-bottom:8px">
      <small class="muted">${esc(t('mail.rules.help'))}</small>
      <ul style="list-style:none;padding:0">${rs.map(li).join('')}</ul>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${inp('mrName', 'mail.rules.name', 60)}${inp('mrFrom', 'mail.rules.from.ph', 200)}${inp('mrSubj', 'mail.rules.subject.ph', 200)}${inp('mrLabel', 'mail.rules.label', 40)}
        <label><input type="checkbox" id="mrCard"> ${esc(t('mail.rules.card'))}</label>
        <button type="button" id="mrAdd" onclick="Mail.ruleAdd()">${esc(t('mail.rules.add'))}</button>
        <button type="button" id="mrReset" onclick="Mail.rulesReset()">${esc(t('mail.rules.reset'))}</button></div>
      <small class="muted" id="mailRulesMsg">${esc(M.rulesMsg || '')}</small></div>`;
  };
  M.toggleHtml = () => { if (M.cur) M.cur.html = !M.cur.html; paint(); };
  M.sig = () => JSON.stringify([M.cfg, M.data, M.loading, M.msg, M.cur && [M.cur.uid, M.cur.loading, M.cur.html, M.cur.error, !!M.cur.d, M.cur.made, (M.cur.drafts || []).length], (M.projs || []).length, M.showRules, M.rules, M.rulesMsg, M.compose && [M.compose.left, M.compose.sending, M.compose.msg, !!M.compose.timer], hidden()]);
  const fmt = d => {
    if (!d) return '';
    const x = new Date(d); if (isNaN(x)) return '';
    const today = x.toDateString() === new Date().toDateString();
    try { return today ? x.toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString(i18n.locale, { day: 'numeric', month: 'short', year: x.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); } catch { return x.toISOString().slice(0, 16).replace('T', ' '); }
  };
  const row = m => {
    const who = m.from || {}, bold = m.unread ? 'font-weight:600' : '';
    return `<tr class="mail-row${m.unread ? ' unread' : ''}" style="border-top:1px solid var(--border,#8884)">
      <td style="width:18px;text-align:center">${m.unread ? `<span class="mail-dot" title="${esc(t('mail.unread'))}" aria-label="${esc(t('mail.unread'))}" style="color:var(--accent)">●</span>` : ''}</td>
      <td class="mail-from" title="${esc(who.address)}" style="${bold};max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(who.name || who.address || '?')}</td>
      <td class="mail-subj" style="${bold};overflow-wrap:anywhere"><a href="#/mail" class="mail-open" onclick="Mail.open(${Number(m.uid) || 0});return false" style="color:inherit;text-decoration:none">${esc(m.subject || t('mail.nosubject'))}</a>
        ${(m.labels || []).map(l => ` <span class="chip mail-label" style="font-size:11px;font-weight:normal">${esc(l)}</span>`).join('')}${m.suggestCard ? ` <span class="chip mail-suggest" title="${esc(t('mail.rules.suggest.title'))}" style="font-size:11px;font-weight:normal">📋</span>` : ''}</td>
      <td class="mail-date muted" style="white-space:nowrap;text-align:end">${esc(fmt(m.date))}</td></tr>`;
  };
  M.render = () => {
    const head = `<h2>${esc(t('mail.title'))}</h2>`;
    if (hidden()) return `<div class="uz">${head}<p class="muted">${esc(t('mail.streamer'))}</p></div>`;
    const b = box();
    if (!b) return `<div class="uz">${head}<p class="muted">${esc(t('mail.none'))}</p><p><button class="primary" onclick="Mail.toSetup()">${esc(t('mail.none.setup'))}</button></p></div>`;
    if (M.compose) return M.renderCompose(b);
    if (M.cur) return M.renderOne(b);
    const d = M.data || { items: [] }, items = d.items || [];
    const when = d.at ? ago(d.at) : '';
    const state_ = M.loading ? t('mail.loading') : M.msg || (d.at ? t(d.cached ? 'mail.cached' : 'mail.fresh', { when }) : '');
    return `<div class="uz mail-page"><h2>${esc(t('mail.title'))} <span class="muted" style="font-size:14px;font-weight:normal">${esc(b.name)} · ${esc(b.address)}</span></h2>
      <div class="mail-bar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" id="mailRefresh" onclick="Mail.refresh()" ${M.loading ? 'disabled' : ''}>${esc(t('mail.refresh'))}</button>
        <button type="button" id="mailForget" onclick="Mail.forget()">${esc(t('mail.forget'))}</button>
        <button type="button" id="mailNew" onclick="Mail.newMail()">${esc(t('mail.send.new'))}</button>
        <button type="button" id="mailRulesBtn" onclick="Mail.toggleRules()" aria-expanded="${M.showRules ? 'true' : 'false'}">${esc(t('mail.rules'))}</button>
        <span class="muted" id="mailState">${esc(state_)}</span></div>
      ${M.showRules ? M.rulesHtml() : ''}
      ${d.error ? `<div class="err" id="mailErr">${esc(t('mail.err', { msg: d.error }))}</div>` : ''}
      ${items.length ? `<table class="mail-list" style="width:100%;border-collapse:collapse"><thead><tr class="muted"><th></th><th style="text-align:start">${esc(t('mail.col.from'))}</th><th style="text-align:start">${esc(t('mail.col.subject'))}</th><th style="text-align:end">${esc(t('mail.col.date'))}</th></tr></thead>
        <tbody>${items.map(row).join('')}</tbody></table>` : `<p class="muted" id="mailEmpty">${esc(M.loading ? t('mail.loading') : t('mail.empty'))}</p>`}</div>`;
  };

  // One open mail. Plain text goes in a <pre> as text. HTML (already cleaned on the server) goes only in an iframe with an empty
  // sandbox (no scripts, no forms, no same-origin, no popups) under a policy that allows no remote loads, so nothing is fetched.
  const CSP = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'\"><base target=\"_blank\">";
  M.renderOne = b => {
    const c = M.cur, d = c.d, head = `<h2>${esc(t('mail.title'))} <span class="muted" style="font-size:14px;font-weight:normal">${esc(b.name)} · ${esc(b.address)}</span></h2>
      <p><button type="button" id="mailBack" onclick="Mail.back()">${esc(t('mail.back'))}</button> ${c.d ? `<button type="button" id="mailReply" onclick="Mail.reply()">${esc(t('mail.send.replybtn'))}</button>` : ''}</p>`;
    if (c.loading) return `<div class="uz mail-page">${head}<p class="muted" id="mailOpening">${esc(t('mail.opening'))}</p></div>`;
    if (c.error) return `<div class="uz mail-page">${head}<div class="err" id="mailErr">${esc(t('mail.err.open', { msg: c.error }))}</div></div>`;
    const who = d.from || {}, to = (d.to || []).map(x => x.name || x.address).join(', ');
    const body = c.html && d.html
      ? `<iframe id="mailFrame" class="mail-frame" sandbox="" referrerpolicy="no-referrer" title="${esc(t('mail.frame'))}" srcdoc="${esc(CSP + d.html)}" style="width:100%;height:480px;border:1px solid var(--border,#8884);background:#fff;resize:vertical"></iframe>`
      : d.text ? `<pre id="mailText" class="mail-text" style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:8px 0">${esc(d.text)}</pre>`
      : `<p class="muted" id="mailNoText">${esc(t('mail.notext'))}</p>`;
    return `<div class="uz mail-page">${head}
      <h3 id="mailSubject" style="overflow-wrap:anywhere">${esc(d.subject || t('mail.nosubject'))}</h3>
      <div class="muted mail-meta" style="font-size:13px"><div><b>${esc(t('mail.col.from'))}</b> <span id="mailFromFull">${esc(who.name ? who.name + ' <' + who.address + '>' : who.address || '?')}</span></div>
        ${to ? `<div><b>${esc(t('mail.to'))}</b> ${esc(to)}</div>` : ''}<div><b>${esc(t('mail.col.date'))}</b> ${esc(fmt(d.date))}</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">
        ${d.text && d.html ? `<button type="button" id="mailToggle" onclick="Mail.toggleHtml()">${esc(t(c.html ? 'mail.showtext' : 'mail.showhtml'))}</button>` : ''}
        ${c.html && d.blockedImages ? `<span class="muted" id="mailBlocked">${esc(t('mail.images.blocked', { n: d.blockedImages }))}</span>` : ''}
        ${d.truncated ? `<span class="muted">${esc(t('mail.truncated'))}</span>` : ''}</div>
      <div class="mail-card" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">
        <select id="mailCardProj" aria-label="${esc(t('mail.card.pick'))}">${projects().map(p => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('')}</select>
        <button type="button" id="mailMakeCard" onclick="Mail.makeCard()">${esc(t('mail.card.make'))}</button>
        ${c.made ? `<span class="muted" id="mailCardMade">${esc(c.made)}</span>` : ''}</div>
      ${(c.drafts || []).length ? `<div class="mail-drafts" id="mailDrafts">${c.drafts.map((x, i) => `<div class="mail-draft" style="border:1px dashed var(--border,#8884);border-radius:8px;padding:6px 10px;margin:6px 0"><b>${esc(t('mail.draft.by', { who: x.by }))}</b> <span class="muted">${esc(fmt(x.at))}</span>
        <pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:4px 0;max-height:8em;overflow:auto">${esc(x.text)}</pre><button type="button" class="mail-usedraft" onclick="Mail.useDraft(${i})">${esc(t('mail.draft.use'))}</button></div>`).join('')}</div>` : ''}
      ${body}
      ${(d.attachments || []).length ? `<div class="mail-attach" id="mailAttach"><b>${esc(t('mail.attach'))}</b><ul>${d.attachments.map(a => `<li>${esc(a.name)} <span class="muted">(${esc(a.type)}, ${esc(Math.max(1, Math.round(a.size / 1024)) + ' KB')})</span></li>`).join('')}</ul></div>` : ''}</div>`;
  };

  /* ---------- Setup > ✉️ Mail ---------- */
  const v = id => (($(id) || {}).value || '').trim();
  const say = (msg, err) => { const s = $('mailSetState'), e = $('mailSetErr'); if (s) s.textContent = err ? '' : msg; if (e) e.textContent = err ? msg : ''; };
  const paintBox = () => { const el = $('mailBox'); if (el) el.innerHTML = M.setupHtml(); };
  M.setupHtml = () => {
    if (!M.cfg) { M.watch().then(paintBox); return `<span>${esc(t('mail.setup.h'))}</span>`; }
    const b = box() || { name: '', address: '', host: '', port: 993, user: '', hasPassword: false };
    const field = (id, key, val, extra = '') => `<label class="chk" style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="min-width:110px">${esc(t(key))}</span><input id="${id}" value="${esc(val)}" autocomplete="off" ${extra}></label>`;
    // Microsoft sign-in (AIG-909): the servers are Microsoft's own and there is no password, so those fields hide (still sent).
    const prov = M.auth || b.auth, ms = prov === 'microsoft', gg = prov === 'google', f = M.msFlow;   // gg: Google sign-in (AIG-910)
    return `<span>${esc(t('mail.setup.h'))}</span><small class="muted">${esc(t('mail.setup.help'))}</small>
      ${field('mailName', 'mail.setup.name', b.name, `type="text" maxlength="60" placeholder="${esc(t('mail.setup.name.ph'))}"`)}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${field('mailAddr', 'mail.setup.address', b.address, 'type="email" maxlength="200" placeholder="you@example.com"')}
        ${ms || gg ? '' : `<button type="button" id="mailFind" onclick="Mail.find()">${esc(t('mail.setup.find'))}</button>`}</div>
      <label class="chk" style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="min-width:110px">${esc(t('mail.setup.auth'))}</span>
        <select id="mailAuth" onchange="Mail.setAuth(this.value)"><option value="password">${esc(t('mail.setup.auth.password'))}</option><option value="microsoft" ${ms ? 'selected' : ''}>${esc(t('mail.setup.auth.microsoft'))}</option><option value="google" ${gg ? 'selected' : ''}>${esc(t('mail.setup.auth.google'))}</option></select></label>
      ${ms ? `<div id="mailMs">${field('mailMsClient', 'mail.setup.ms.client', b.msClient || '', 'type="text" maxlength="36" spellcheck="false" placeholder="00000000-0000-0000-0000-000000000000" style="min-width:300px"')}
        <small class="muted">${esc(t('mail.setup.ms.client.help'))} <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">${esc(t('mail.setup.ms.client.link'))}</a></small>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0"><button type="button" id="mailMsSignIn" onclick="Mail.msSignIn()">${esc(t('mail.setup.ms.signin'))}</button>
          <span id="mailMsState" class="muted">${esc(b.msSignedIn && !(f && f.state === 'waiting') ? t('mail.setup.ms.done') : t('mail.setup.ms.not'))}</span>
          ${b.msSignedIn ? `<button type="button" id="mailMsOut" onclick="Mail.msSignOut()">${esc(t('mail.setup.ms.out'))}</button>` : ''}</div>
        ${f && f.state === 'waiting' ? `<div id="mailMsCode" style="border:1px solid var(--border,#8884);border-radius:8px;padding:8px 12px;margin:4px 0">${esc(t('mail.setup.ms.go'))} <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.url)}</a> ${esc(t('mail.setup.ms.type'))}
          <b id="mailMsUserCode" style="font-size:20px;letter-spacing:2px;user-select:all">${esc(f.code)}</b> <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(${esc(JSON.stringify(f.code))})">${esc(t('mail.setup.ms.copy'))}</button>
          <div class="muted">${esc(t('mail.setup.ms.waiting'))}</div></div>` : ''}
        ${f && f.state === 'error' ? `<div class="err" id="mailMsErr">${esc(t('mail.setup.ms.failed', { msg: f.error }))}</div>` : ''}</div>` : ''}
      ${gg ? `<div id="mailG">${field('mailGClient', 'mail.setup.g.client', b.gClient || '', 'type="text" maxlength="160" spellcheck="false" placeholder="1234567890-abc.apps.googleusercontent.com" style="min-width:300px"')}
        ${field('mailGSecret', 'mail.setup.g.secret', '', `type="password" maxlength="500" autocomplete="new-password" placeholder="${esc(b.gHasSecret ? t('mail.setup.pass.keep') : '')}"`)}
        <small class="muted" id="mailGHelp">${esc(t('mail.setup.g.help1'))} ${esc(t('mail.setup.g.help2'))} ${esc(t('mail.setup.g.help3'))} <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">${esc(t('mail.setup.g.link'))}</a></small>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0"><button type="button" id="mailGSignIn" onclick="Mail.msSignIn()">${esc(t('mail.setup.g.signin'))}</button>
          <span id="mailGState" class="muted">${esc(b.gSignedIn && !(f && f.state === 'waiting') ? t('mail.setup.g.done') : t('mail.setup.g.not'))}</span>
          ${b.gSignedIn ? `<button type="button" id="mailGOut" onclick="Mail.msSignOut()">${esc(t('mail.setup.ms.out'))}</button>` : ''}</div>
        ${f && f.state === 'waiting' ? `<div id="mailGCode" style="border:1px solid var(--border,#8884);border-radius:8px;padding:8px 12px;margin:4px 0"><a id="mailGLink" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(t('mail.setup.g.go'))}</a>
          <div class="muted">${esc(t('mail.setup.g.waiting'))}</div></div>` : ''}
        ${f && f.state === 'error' ? `<div class="err" id="mailGErr">${esc(t('mail.setup.ms.failed', { msg: f.error }))}</div>` : ''}</div>` : ''}
      <div id="mailServers" style="${ms || gg ? 'display:none' : ''}">
      ${field('mailHost', 'mail.setup.host', b.host, 'type="text" maxlength="253" placeholder="imap.example.com"')}
      ${field('mailPort', 'mail.setup.port', b.port || 993, 'type="number" min="1" max="65535" style="width:90px"')}
      ${field('mailSmtpHost', 'mail.setup.smtphost', b.smtpHost, 'type="text" maxlength="253" placeholder="' + esc(t('mail.setup.smtphost.ph')) + '"')}
      ${field('mailSmtpPort', 'mail.setup.smtpport', b.smtpPort || 465, 'type="number" min="1" max="65535" style="width:90px"')}
      ${field('mailUser', 'mail.setup.user', b.user, `type="text" maxlength="200" placeholder="${esc(t('mail.setup.user.ph'))}"`)}
      ${field('mailPass', 'mail.setup.pass', '', `type="password" maxlength="1000" autocomplete="new-password" placeholder="${esc(b.hasPassword ? t('mail.setup.pass.keep') : '')}"`)}</div>
      <label class="chk" style="margin:6px 0"><input type="checkbox" id="mailAgents" ${b.agents ? 'checked' : ''}> ${esc(t('mail.setup.agents'))} <small class="muted">${esc(t('mail.setup.agents.sub'))}</small></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" id="mailTest" onclick="Mail.test()">${esc(t('mail.setup.test'))}</button>
        <button type="button" class="primary" id="mailSave" onclick="Mail.save()">${esc(t('mail.setup.save'))}</button>
        ${box() ? `<button type="button" id="mailRemove" onclick="Mail.remove()">${esc(t('mail.setup.remove'))}</button> <a href="#/mail" id="mailOpen">${esc(t('mail.setup.open'))}</a>` : ''}</div>
      ${b.lastError ? `<small class="muted mail-note" id="mailSetErr">${esc(b.lastError)} <a href="#/setup/dmsRelay">${esc(t('mail.setup.relay.link'))}</a></small>` : '<div class="err" id="mailSetErr"></div>'}<small class="muted" id="mailSetState">${esc(M.setupMsg)}</small>`;
  };
  const form = () => {
    const ms = v('mailAuth') === 'microsoft', gg = v('mailAuth') === 'google';
    return { id: (box() || {}).id, name: v('mailName'), address: v('mailAddr'), host: v('mailHost'), port: Number(v('mailPort')) || 993, smtpHost: v('mailSmtpHost'), smtpPort: Number(v('mailSmtpPort')) || 465, agents: !!($('mailAgents') || {}).checked,
      user: ms || gg ? v('mailAddr') : v('mailUser') || v('mailAddr'), password: ms || gg ? '' : ($('mailPass') || {}).value || '', auth: ms ? 'microsoft' : gg ? 'google' : 'password', msClient: v('mailMsClient'),
      gClient: v('mailGClient'), gSecret: ($('mailGSecret') || {}).value || '' };
  };
  // Microsoft sign-in (AIG-909): Sign in saves the form, then shows the code to type at Microsoft and polls until it's done.
  M.setAuth = a => {
    const keep = ['mailName', 'mailAddr', 'mailMsClient', 'mailGClient'].map(id => [id, v(id)]), agents = !!($('mailAgents') || {}).checked;
    M.auth = a; paintBox();
    for (const [id, val] of keep) if ($(id) && val) $(id).value = val;
    if ($('mailAgents')) $('mailAgents').checked = agents;
  };
  const flowApi = () => '/api/mail/' + ((box() || {}).auth === 'google' ? 'google' : 'ms');   // the Microsoft and Google sign-ins share the poll
  const msPoll = () => {
    clearTimeout(M.msTimer);
    const b = box(); if (!b || !M.msFlow || M.msFlow.state !== 'waiting') return;
    M.msTimer = setTimeout(async () => {
      try { M.msFlow = await api('GET', flowApi() + '/status?box=' + q(b.id)); } catch (e) { M.msFlow = { state: 'error', error: e.message }; }
      if (M.msFlow.state === 'waiting') return msPoll();
      await M.watch();
      if (M.msFlow.state === 'done') { M.msFlow = null; M.data = null; }
      paintBox(); if (!M.msFlow) say(t((box() || {}).auth === 'google' ? 'mail.setup.g.done' : 'mail.setup.ms.done'));
    }, window.__mailMsPollMs || 2000);
  };
  M.msSignIn = async () => {
    try {
      M.cfg = await api('POST', '/api/mail/config', { token: await secToken(), ...form() });
      M.msFlow = await api('POST', flowApi() + '/start', { token: await secToken(), box: box().id });
    } catch (e) { return say(e.message, true); }
    M.auth = null; paintBox(); msPoll();
  };
  M.msSignOut = async () => {
    const b = box(); if (!b) return;
    try { await api('POST', flowApi() + '/signout', { token: await secToken(), box: b.id }); } catch (e) { return say(e.message, true); }
    M.msFlow = null; await M.watch(); paintBox();
  };
  M.find = async () => {
    say(t('mail.setup.finding'));
    try {
      const r = await api('POST', '/api/mail/find', { address: v('mailAddr') });
      if (!r.best) return say(t('mail.setup.notfound'), true);
      $('mailHost').value = r.best.host; $('mailPort').value = r.best.port; if (!v('mailUser')) $('mailUser').value = r.best.user;
      say(t('mail.setup.found', { host: r.best.host }));
    } catch (e) { say(e.message, true); }
  };
  M.test = async () => {
    say(t('mail.setup.testing'));
    try {
      const r = await api('POST', '/api/mail/test', { token: await secToken(), ...form() });
      if (r.ok) say(t('mail.setup.ok', { count: r.count })); else say(t('mail.setup.bad', { msg: r.error }), true);
    } catch (e) { say(e.message, true); }
  };
  M.save = async () => {
    try { M.cfg = await api('POST', '/api/mail/config', { token: await secToken(), ...form() }); } catch (e) { return say(e.message, true); }
    M.auth = null; M.data = null; M.setupMsg = t('mail.setup.saved'); paintBox(); M.setupMsg = ''; M.watch();
  };
  M.remove = async () => {
    const b = box(); if (!b || !confirm(t('mail.setup.remove.sure'))) return;
    try { M.cfg = await api('POST', '/api/mail/config', { token: await secToken(), id: b.id, remove: true }); } catch (e) { return say(e.message, true); }
    M.auth = null; M.msFlow = null; M.data = null; M.setupMsg = t('mail.setup.removed'); paintBox(); M.setupMsg = ''; M.watch();
  };
  // No mailbox yet: a real button to Setup, landing on its Mail box, not the top of the long page (AIG-927).
  M.toSetup = () => {
    location.hash = '#/setup/mail';
    const hdr = () => { const h = document.querySelector('body > header'); return h && getComputedStyle(h).position !== 'static' ? h.offsetHeight : 0; };   // clear of a sticky top bar
    const to = () => { const box = document.getElementById('mailBox'); if (box) window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - hdr() - 12); return !!box; };
    let n = 0; const go = () => { if (to()) { setTimeout(to, 400); setTimeout(to, 1200); } else if (++n < 50) setTimeout(go, 100); };   // again once Setup has finished filling in
    setTimeout(go, 50);
  };
  return M;
})();
