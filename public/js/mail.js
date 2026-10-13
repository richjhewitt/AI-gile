/* ---------- ✉️ Mail (AIG-902, docs/MAIL-PLAN.md card 1) ---------- */
// #/mail lists the newest 50 mails of the first mailbox: unread dot, From, Subject, date. The cached list shows at once, then
// the board fetches it fresh (GET /api/mail/inbox?fresh=1). Reading a mail is card 2. The ✉️ Mail link in the top bar shows
// only once a mailbox is set up. Setup > ✉️ Mail (setupHtml) adds or changes it: find settings, test, save, remove; saving and
// testing take the secrets page token (secToken in dialogs/secrets.js). The password is never sent back to the page.
// Mail is untrusted data: every field from it goes through esc(). Hidden in 🎥 streamer mode.
const Mail = (() => {
  const M = { cfg: null, data: null, loading: false, msg: '', seen: 0, setupMsg: '' };
  const box = () => (M.cfg && M.cfg.boxes && M.cfg.boxes[0]) || null;
  const hidden = () => typeof Streamer !== 'undefined' && Streamer.on && Streamer.on();
  const q = id => encodeURIComponent(id);
  M.watch = async (options = {}) => {
    try { M.cfg = await api('GET', '/api/mail/config', undefined, options); } catch { return; }
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
  M.sig = () => JSON.stringify([M.cfg, M.data, M.loading, M.msg, hidden()]);
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
      <td class="mail-subj" style="${bold};overflow-wrap:anywhere">${esc(m.subject || t('mail.nosubject'))}</td>
      <td class="mail-date muted" style="white-space:nowrap;text-align:end">${esc(fmt(m.date))}</td></tr>`;
  };
  M.render = () => {
    const head = `<h2>${esc(t('mail.title'))}</h2>`;
    if (hidden()) return `<div class="uz">${head}<p class="muted">${esc(t('mail.streamer'))}</p></div>`;
    const b = box();
    if (!b) return `<div class="uz">${head}<p class="muted">${esc(t('mail.none'))}</p><p><button class="primary" onclick="Mail.toSetup()">${esc(t('mail.none.setup'))}</button></p></div>`;
    const d = M.data || { items: [] }, items = d.items || [];
    const when = d.at ? ago(d.at) : '';
    const state_ = M.loading ? t('mail.loading') : M.msg || (d.at ? t(d.cached ? 'mail.cached' : 'mail.fresh', { when }) : '');
    return `<div class="uz mail-page"><h2>${esc(t('mail.title'))} <span class="muted" style="font-size:14px;font-weight:normal">${esc(b.name)} · ${esc(b.address)}</span></h2>
      <div class="mail-bar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" id="mailRefresh" onclick="Mail.refresh()" ${M.loading ? 'disabled' : ''}>${esc(t('mail.refresh'))}</button>
        <button type="button" id="mailForget" onclick="Mail.forget()">${esc(t('mail.forget'))}</button>
        <span class="muted" id="mailState">${esc(state_)}</span></div>
      ${d.error ? `<div class="err" id="mailErr">${esc(t('mail.err', { msg: d.error }))}</div>` : ''}
      ${items.length ? `<table class="mail-list" style="width:100%;border-collapse:collapse"><thead><tr class="muted"><th></th><th style="text-align:start">${esc(t('mail.col.from'))}</th><th style="text-align:start">${esc(t('mail.col.subject'))}</th><th style="text-align:end">${esc(t('mail.col.date'))}</th></tr></thead>
        <tbody>${items.map(row).join('')}</tbody></table>` : `<p class="muted" id="mailEmpty">${esc(M.loading ? t('mail.loading') : t('mail.empty'))}</p>`}</div>`;
  };

  /* ---------- Setup > ✉️ Mail ---------- */
  const v = id => (($(id) || {}).value || '').trim();
  const say = (msg, err) => { const s = $('mailSetState'), e = $('mailSetErr'); if (s) s.textContent = err ? '' : msg; if (e) e.textContent = err ? msg : ''; };
  const paintBox = () => { const el = $('mailBox'); if (el) el.innerHTML = M.setupHtml(); };
  M.setupHtml = () => {
    if (!M.cfg) { M.watch().then(paintBox); return `<span>${esc(t('mail.setup.h'))}</span>`; }
    const b = box() || { name: '', address: '', host: '', port: 993, user: '', hasPassword: false };
    const field = (id, key, val, extra = '') => `<label class="chk" style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="min-width:110px">${esc(t(key))}</span><input id="${id}" value="${esc(val)}" autocomplete="off" ${extra}></label>`;
    return `<span>${esc(t('mail.setup.h'))}</span><small class="muted">${esc(t('mail.setup.help'))}</small>
      ${field('mailName', 'mail.setup.name', b.name, `type="text" maxlength="60" placeholder="${esc(t('mail.setup.name.ph'))}"`)}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${field('mailAddr', 'mail.setup.address', b.address, 'type="email" maxlength="200" placeholder="you@example.com"')}
        <button type="button" id="mailFind" onclick="Mail.find()">${esc(t('mail.setup.find'))}</button></div>
      ${field('mailHost', 'mail.setup.host', b.host, 'type="text" maxlength="253" placeholder="imap.example.com"')}
      ${field('mailPort', 'mail.setup.port', b.port || 993, 'type="number" min="1" max="65535" style="width:90px"')}
      ${field('mailUser', 'mail.setup.user', b.user, `type="text" maxlength="200" placeholder="${esc(t('mail.setup.user.ph'))}"`)}
      ${field('mailPass', 'mail.setup.pass', '', `type="password" maxlength="1000" autocomplete="new-password" placeholder="${esc(b.hasPassword ? t('mail.setup.pass.keep') : '')}"`)}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" id="mailTest" onclick="Mail.test()">${esc(t('mail.setup.test'))}</button>
        <button type="button" class="primary" id="mailSave" onclick="Mail.save()">${esc(t('mail.setup.save'))}</button>
        ${box() ? `<button type="button" id="mailRemove" onclick="Mail.remove()">${esc(t('mail.setup.remove'))}</button> <a href="#/mail" id="mailOpen">${esc(t('mail.setup.open'))}</a>` : ''}</div>
      <div class="err" id="mailSetErr">${esc(b.lastError || '')}</div><small class="muted" id="mailSetState">${esc(M.setupMsg)}</small>`;
  };
  const form = () => ({ id: (box() || {}).id, name: v('mailName'), address: v('mailAddr'), host: v('mailHost'), port: Number(v('mailPort')) || 993, user: v('mailUser') || v('mailAddr'), password: ($('mailPass') || {}).value || '' });
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
    M.data = null; M.setupMsg = t('mail.setup.saved'); paintBox(); M.setupMsg = ''; M.watch();
  };
  M.remove = async () => {
    const b = box(); if (!b || !confirm(t('mail.setup.remove.sure'))) return;
    try { M.cfg = await api('POST', '/api/mail/config', { token: await secToken(), id: b.id, remove: true }); } catch (e) { return say(e.message, true); }
    M.data = null; M.setupMsg = t('mail.setup.removed'); paintBox(); M.setupMsg = ''; M.watch();
  };
  // No mailbox yet: a real button to Setup, landing on its Mail box, not the top of the long page (AIG-927).
  M.toSetup = () => {
    location.hash = '#/setup';
    const hdr = () => { const h = document.querySelector('body > header'); return h && getComputedStyle(h).position !== 'static' ? h.offsetHeight : 0; };   // clear of a sticky top bar
    const to = () => { const box = document.getElementById('mailBox'); if (box) window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - hdr() - 12); return !!box; };
    let n = 0; const go = () => { if (to()) { setTimeout(to, 400); setTimeout(to, 1200); } else if (++n < 50) setTimeout(go, 100); };   // again once Setup has finished filling in
    setTimeout(go, 50);
  };
  return M;
})();
