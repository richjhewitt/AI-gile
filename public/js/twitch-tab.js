/* ---------- 🟣 the Twitch tab in the DM window (AIG-628) ---------- */
// Only there once a Twitch channel is set (Setup > Twitch; GET /api/twitch/config says which). The tab (a chip in the DM list)
// has one row for the channel; open it to read the chat, newest at the bottom, updating as messages arrive. Read-only: the board
// listens to Twitch chat without logging in (lib/twitch.js). Dms (dms.js) calls: linked(), rowsHtml(), show(key) for 'tw:<channel>',
// load(), stop(). The Setup box is setupHtml() / save().
// AIG-1346: 💜 Sign in with Twitch (device code: a short code on Twitch's activate page, the board polls) needs your Twitch app's
// Client ID (Setup field); then a channel box with the last 10 channels in a drop-down, also in the chat head, to switch any time.
// The older paste-a-token way stays under "Other ways".
const TwitchTab = (() => {
  let cfg = { channel: '', connected: false, error: '', canReply: false, login: '', via: '', clientId: '', recent: [], signedIn: false, hasPasted: false }, cur = null, msgs = [], last = 0, sig = '', msg = '';
  let flow = null, flowTimer = null, authMsg = '', boxSig = '';
  const same = (a, b) => a.channel === b.channel;
  const TOKEN_URL = 'https://twitchtokengenerator.com/', CONSOLE_URL = 'https://dev.twitch.tv/console/apps/create';
  const $ = id => document.getElementById(id);
  async function poll() {
    let c; try { c = await api('GET', '/api/twitch/config'); } catch { return; }
    const changed = !same(cfg, c); cfg = c;
    const box = $('twitchBox'), s = JSON.stringify([c.signedIn, c.login, c.canReply, c.clientId, c.recent, c.channel]);
    if (box && s !== boxSig && !box.contains(document.activeElement)) paintBox(); else if (box) loadGroups();
    if (changed && document.getElementById('twPop')) return paintPop();
    if (changed && typeof Dms !== 'undefined') Dms.reload && Dms.reload();
    else if (cur) { paintCompose(); load(); }
  }
  const paintBox = () => { const b = $('twitchBox'); if (b) { b.innerHTML = setupHtml(); loadGroups(); } };
  const stateOf = () => cfg.error ? '⚠️ ' + cfg.error : cfg.connected ? '🟢 ' + t('tw.state.on') : '⚪ ' + t('tw.state.wait');
  const row = 'style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0"';
  // The channel picker (Rich, AIG-1346): your own channel, the ones you moderate, the ones you follow, then your recent ones, each
  // group under a small heading; typing filters the list, and any other channel name still joins. In Setup (box twChannel, list
  // twSList) and under the chat head (⇄, box twHQ, list twHList). Groups from GET /api/twitch/channels (recent only when not signed in).
  let groups = null, groupsAt = 0;
  const GROUPS = [['own', 'tw.grp.own'], ['mod', 'tw.grp.mod'], ['follows', 'tw.grp.follows'], ['recent', 'tw.grp.recent']];
  const clean = q => String(q || '').trim().replace(/^#/, '').toLowerCase();
  function listHtml(q) {
    const g = groups || { own: cfg.login ? [cfg.login] : [], recent: cfg.recent };
    q = clean(q); let out = '', any = false;
    for (const [k, label] of GROUPS) {
      const l = (g[k] || []).filter(n => !q || n.includes(q)).slice(0, 100); if (!l.length) continue;
      out += `<div class="tw-grp" data-twgrp="${k}">${esc(t(label))}</div>` + l.map(n => { any = any || n === q; return `<button type="button" class="tw-ch ${n === cfg.channel ? 'on' : ''}" role="option" data-twch="${esc(n)}" onclick="TwitchTab.join(this.dataset.twch)">#${esc(n)}</button>`; }).join('');
    }
    if (q && !any && /^[a-z0-9_]{3,25}$/.test(q)) out = `<button type="button" class="tw-ch" data-twch="${esc(q)}" onclick="TwitchTab.join(this.dataset.twch)">${esc(t('tw.chan.other', { name: q }))}</button>` + out;
    return out;
  }
  const filter = (input, list) => { const l = $(list), i = $(input); if (l && i) l.innerHTML = listHtml(i.value); };
  async function loadGroups(fresh) {
    if (!fresh && groups && Date.now() - groupsAt < 60e3) return;
    try { groups = await api('GET', '/api/twitch/channels' + (fresh ? '?fresh=1' : '')); groupsAt = Date.now(); } catch { return; }
    for (const [i, l] of [['twChannel', 'twSList'], ['twHQ', 'twHList']]) if ($(l)) $(l).innerHTML = listHtml($(i) && $(i) === document.activeElement ? $(i).value : '');
  }
  function toggleHead() {
    const p = $('twHPanel'); if (!p) return;
    if (!p.hidden) { p.hidden = true; return; }
    p.innerHTML = `<div ${row}><input type="text" id="twHQ" placeholder="${esc(t('tw.chan.search'))}" autocomplete="off" maxlength="26" style="min-width:0;flex:1 1 140px" oninput="TwitchTab.filter('twHQ','twHList')" onkeydown="if(event.key==='Enter'){event.preventDefault();TwitchTab.join(this.value)}">
      <button type="button" id="twHGo" onclick="TwitchTab.join(document.getElementById('twHQ').value)">${esc(t('tw.chan.join'))}</button></div><div class="tw-list" id="twHList" role="listbox">${listHtml('')}</div>`;
    p.hidden = false; $('twHQ').focus(); loadGroups();
  }
  function authHtml() {
    if (cfg.signedIn) return `<div ${row}><b id="twAuthOn">${esc(t('tw.auth.on', { name: cfg.login }))}</b><button type="button" id="twAuthOut" onclick="TwitchTab.authOut()">${esc(t('tw.login.out'))}</button></div>`;
    const f = flow;
    return `<small class="muted">${esc(t('tw.auth.help'))}</small>
      <div ${row}><button type="button" class="primary" id="twAuth" onclick="TwitchTab.authStart()">${esc(t('tw.auth.btn'))}</button></div><small class="muted" id="twScopes">${esc(t('tw.auth.scopes'))}</small>
      ${!cfg.clientId && authMsg === 'noid' ? `<div class="tw-howto" id="twAuthNoId" style="border:1px solid var(--border,#8884);border-radius:8px;padding:8px 12px;margin:4px 0">${esc(t('tw.auth.noid'))}</div>` : ''}
      ${f && f.state === 'waiting' ? `<div id="twAuthCode" style="border:1px solid var(--border,#8884);border-radius:8px;padding:8px 12px;margin:4px 0;overflow-wrap:anywhere">${esc(t('tw.auth.go'))} <a id="twAuthLink" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.url.replace(/\?.*$/, ''))}</a> ${esc(t('tw.auth.type'))}
        <b id="twAuthUserCode" style="font-size:20px;letter-spacing:2px;user-select:all">${esc(f.code)}</b> <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(${esc(JSON.stringify(f.code))})">${esc(t('tw.auth.copy'))}</button>
        <div class="muted">${esc(t('tw.auth.waiting'))}</div></div>` : ''}
      ${f && f.state === 'error' ? `<div class="err" id="twAuthErr">${esc(t('tw.auth.failed', { msg: f.error }))}</div>` : authMsg && authMsg !== 'noid' ? `<div class="err" id="twAuthErr">${esc(authMsg)}</div>` : ''}`;
  }
  function setupHtml() {
    boxSig = JSON.stringify([cfg.signedIn, cfg.login, cfg.canReply, cfg.clientId, cfg.recent, cfg.channel]);
    return `<span>${esc(t('tw.setup.h'))}</span>
      ${authHtml()}
      <label for="twClientId" style="margin-top:6px">${esc(t('tw.id.label'))}</label>
      <div ${row}><input type="text" id="twClientId" value="${esc(cfg.clientId)}" placeholder="abcdefghijklmnopqrstuvwxyz0123" autocomplete="off" spellcheck="false" maxlength="40" style="min-width:0;flex:1 1 220px" onkeydown="if(event.key==='Enter'){event.preventDefault();TwitchTab.saveId()}">
        <button type="button" id="twClientSave" onclick="TwitchTab.saveId()">${esc(t('tw.id.save'))}</button></div>
      <small class="muted" id="twIdHelp">${esc(t('tw.id.help'))} <a href="${CONSOLE_URL}" target="_blank" rel="noopener noreferrer">${esc(t('tw.id.link'))}</a></small><div class="err" id="twIdErr"></div>
      <label for="twChannel" style="margin-top:6px">${esc(t('tw.chan.h'))}</label>
      <div ${row}><input type="text" id="twChannel" value="${esc(cfg.channel)}" placeholder="${esc(cfg.login || t('tw.setup.ph'))}" autocomplete="off" maxlength="26" style="min-width:0;flex:1 1 160px" oninput="TwitchTab.filter('twChannel','twSList')" onkeydown="if(event.key==='Enter'){event.preventDefault();TwitchTab.save()}">
      <button type="button" class="primary" id="twSave" onclick="TwitchTab.save()">${esc(t('tw.chan.join'))}</button></div>
      <div class="tw-list" id="twSList" role="listbox" aria-label="${esc(t('tw.chan.h'))}">${listHtml('')}</div>
      <small class="muted">${esc(t('tw.chan.help'))}</small>
      <div class="err" id="twErr"></div><small class="muted" id="twState">${esc(msg || (cfg.channel ? stateOf() : ''))}</small>
      <details id="twOther" ${cfg.hasPasted && !cfg.signedIn ? 'open' : ''} style="margin-top:6px"><summary>${esc(t('tw.other'))}</summary>
      <span>${esc(t('tw.login.h'))}</span><small class="muted">${esc(t('tw.login.help'))} <a href="${TOKEN_URL}" target="_blank" rel="noopener">${esc(t('tw.login.get'))}</a></small>
      ${cfg.hasPasted ? `<div><small class="muted">${esc(cfg.via === 'token' ? t('tw.login.on', { name: cfg.login }) : t('tw.login.saved'))}</small> <button type="button" id="twOut" onclick="TwitchTab.signOut()">${esc(t('tw.login.out'))}</button></div>`
      : `<div ${row}><input type="text" id="twLogin" placeholder="${esc(t('tw.login.ph'))}" autocomplete="off" maxlength="26" style="min-width:0"><input type="password" id="twToken" placeholder="${esc(t('tw.login.token'))}" autocomplete="new-password" maxlength="80" style="min-width:0" onkeydown="if(event.key==='Enter'){event.preventDefault();TwitchTab.signIn()}">
      <button type="button" id="twSignIn" onclick="TwitchTab.signIn()">${esc(t('tw.login.save'))}</button></div>`}
      <div class="err" id="twErr2"></div></details>`;
  }
  async function signIn() {
    try { cfg = await api('POST', '/api/twitch/token', { login: $('twLogin').value, token: $('twToken').value, secretsToken: await secToken() }); msg = t('tw.setup.saved'); } catch (e) { const x = $('twErr2'); if (x) x.textContent = e.message || String(e); return; }
    paintBox(); msg = '';
  }
  async function signOut() { try { cfg = await api('POST', '/api/twitch/token', { login: '', token: '', secretsToken: await secToken() }); } catch {} paintBox(); }
  // 💜 Sign in with Twitch: no Client ID yet shows the one step; else start the device code and poll until approved, denied or run out.
  async function authStart() {
    authMsg = ''; flow = null;
    if (!cfg.clientId && !($('twClientId') && $('twClientId').value.trim())) { authMsg = 'noid'; return paintBox(); }
    try {
      if ($('twClientId') && $('twClientId').value.trim() !== cfg.clientId) cfg = await api('POST', '/api/twitch/config', { clientId: $('twClientId').value.trim(), token: await secToken() });
      flow = await api('POST', '/api/twitch/auth/start', { token: await secToken() });
    } catch (e) { authMsg = e.message || String(e); return paintBox(); }
    paintBox();
    if (flow.url) try { window.open(flow.url, '_blank', 'noopener'); } catch {}
    authPoll();
  }
  function authPoll() {
    clearTimeout(flowTimer);
    if (!flow || flow.state !== 'waiting') return;
    flowTimer = setTimeout(async () => {
      try { flow = await api('GET', '/api/twitch/auth/status'); } catch (e) { flow = { state: 'error', error: e.message }; }
      if (flow.state === 'waiting') return authPoll();
      try { cfg = await api('GET', '/api/twitch/config'); } catch {}
      if (flow.state === 'done') { flow = null; msg = t('tw.auth.done'); groups = null; }
      paintBox(); msg = ''; paintCompose();
    }, window.__twAuthPollMs || 2000);
  }
  async function authOut() {
    try { cfg = await api('POST', '/api/twitch/auth/signout', { token: await secToken() }); } catch (e) { authMsg = e.message || String(e); }
    flow = null; groups = null; paintBox(); paintCompose();
  }
  async function saveId() {
    const x = $('twIdErr');
    try { cfg = await api('POST', '/api/twitch/config', { clientId: $('twClientId').value, token: await secToken() }); authMsg = ''; } catch (e) { if (x) x.textContent = e.message || String(e); return; }
    msg = t('tw.setup.saved'); paintBox(); msg = '';
  }
  async function save() { return join($('twChannel').value, true); }
  // Join a channel (Setup box, the recent drop-down, or the chat head). Stays signed in; the open chat switches with it.
  async function join(v, fromBox) {
    if (v == null || (!fromBox && !v)) return;
    try { cfg = await api('POST', '/api/twitch/config', { channel: v }); msg = t('tw.setup.saved'); } catch (e) { const x = $('twErr'); if (x) x.textContent = e.message || String(e); return; }
    paintBox(); msg = '';
    if ($('twPop')) return paintPop();
    if (cur && cfg.channel) return show(keyOf());
    if (typeof Dms !== 'undefined') Dms.reload && Dms.reload();
  }
  const keyOf = () => 'tw:' + cfg.channel;
  function rowsHtml() {
    if (!cfg.channel) return [];
    return [`<button class="dm-row" data-dm="${esc(keyOf())}"><span class="dm-av">🟣</span><span class="dm-rowtext"><b>#${esc(cfg.channel)}</b><span class="muted">${esc(t('tw.row'))}</span></span></button>`];
  }
  const msgHtml = m => `<div class="dm-msg tw-msg"><div class="dm-meta"><b class="tw-name" ${m.color ? `style="color:${esc(m.color)}"` : ''}>${esc(m.name)}</b> ${ago(m.at)}</div><div class="dm-bubble">${esc(m.text)}</div></div>`;
  const headName = () => `<b id="twHeadName">#${esc(cfg.channel)}</b> <button type="button" id="twSwitch" onclick="TwitchTab.toggleHead()" title="${esc(t('tw.chan.pick'))}" aria-label="${esc(t('tw.chan.pick'))}">⇄</button>`;
  function show(key) {
    cur = key; msgs = []; last = 0; sig = '';
    const panel = $('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button><span class="dm-av">🟣</span><div style="min-width:0">${headName()}<div class="muted">${esc(t(cfg.canReply ? 'tw.row' : 'tw.readonly'))}</div></div><span style="flex:1"></span><button id="twPopBtn" onclick="TwitchTab.popOut()" title="${esc(t('tw.pop.title'))}">⧉</button><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div id="twHPanel" hidden></div><div class="dm-list" id="dmList"></div><div id="twCompose"></div>`;
    panel.hidden = false; paintCompose(); load(true);
  }
  // The reply box (only with a chat login; Setup > Twitch) under the list, in the tab and in the pop-out.
  function paintCompose() {
    const c = $('twCompose'); if (!c) return;
    const h = cfg.canReply ? 'on:' + cfg.login : ''; if (c.dataset.sig === h) return; c.dataset.sig = h;
    c.className = h ? 'dm-compose' : '';
    c.innerHTML = h ? `<textarea id="twText" rows="2" maxlength="500" placeholder="${esc(t('tw.reply.ph', { name: cfg.login }))}" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();TwitchTab.send()}"></textarea><div class="err" id="twSendErr"></div>` : '';
  }
  async function send() {
    const ta = $('twText'), er = $('twSendErr'); if (!ta) return;
    const text = ta.value.trim(); if (!text) return;
    try { await api('POST', '/api/twitch/send', { text }); ta.value = ''; if (er) er.textContent = ''; load(true); } catch (e) { if (er) er.textContent = e.message || String(e); }
  }
  function popOut() { window.popOut('twitch', '#/pop-twitch', 'aigile-twitch-chat', 400, 640); Dms.close(); }
  // The pop window's page (#/pop-twitch): just the chat and the reply box.
  async function popView() {
    document.body.classList.add('pop', 'poptwitch');
    if ($('twPop')) return;
    try { cfg = await api('GET', '/api/twitch/config'); } catch {}
    if ($('twPop')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="twPop"></div>`);
    paintPop();
  }
  function paintPop() {
    const p = $('twPop'); if (!p) return;
    document.title = '🟣 #' + cfg.channel;
    p.innerHTML = `<div class="dm-head"><span class="dm-av">🟣</span><div style="min-width:0">${headName()}</div></div><div id="twHPanel" hidden></div><div class="dm-list" id="dmList"></div><div id="twCompose"></div>`;
    cur = 'tw:' + cfg.channel; msgs = []; last = 0; sig = ''; paintCompose(); load(true);
  }
  async function load(scroll) {
    if (!cur) return;
    try { const more = await api('GET', '/api/twitch/messages?after=' + last); if (more.length) { msgs = msgs.concat(more).slice(-200); last = more[more.length - 1].id; } } catch (e) { const l = $('dmList'); if (l) l.innerHTML = `<p class="muted dm-empty">${esc(e.message || '')}</p>`; return; }
    const list = $('dmList'); if (!list) return;
    const html = msgs.map(msgHtml).join('') || `<p class="muted dm-empty">${esc(t('tw.none'))}</p>`;
    if (sig !== html || list.dataset.sig !== html) { const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40; sig = html; list.dataset.sig = html; list.innerHTML = html; if (scroll || atBottom) list.scrollTop = list.scrollHeight; }
  }
  function stop() { cur = null; }
  PagePoll.every(poll, 3000, { immediate: true, home: !/^#\/pop-twitch/.test(location.hash) });   // AIG-1120: keeps polling in the Twitch pop-out
  return { filter, toggleHead, signIn, signOut, authStart, authOut, saveId, join, send, popOut, popView, show, load, stop, rowsHtml, setupHtml, save, poll, linked: () => !!cfg.channel };
})();
