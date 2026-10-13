/* ---------- 🟣 the Twitch tab in the DM window (AIG-628) ---------- */
// Only there once a Twitch channel is set (Setup > Twitch; GET /api/twitch/config says which). The tab (a chip in the DM list)
// has one row for the channel; open it to read the chat, newest at the bottom, updating as messages arrive. Read-only: the board
// listens to Twitch chat without logging in (lib/twitch.js). Dms (dms.js) calls: linked(), rowsHtml(), show(key) for 'tw:<channel>',
// load(), stop(). The Setup box is setupHtml() / save().
const TwitchTab = (() => {
  let cfg = { channel: '', connected: false, error: '' }, cur = null, msgs = [], last = 0, sig = '', msg = '';
  const same = (a, b) => a.channel === b.channel;
  async function poll() {
    let c; try { c = await api('GET', '/api/twitch/config'); } catch { return; }
    const changed = !same(cfg, c); cfg = c;
    if (changed && typeof Dms !== 'undefined') Dms.reload && Dms.reload();
    else if (cur) load();
  }
  const paintBox = () => { const b = document.getElementById('twitchBox'); if (b) b.innerHTML = setupHtml(); };
  const stateOf = () => cfg.error ? '⚠️ ' + cfg.error : cfg.connected ? '🟢 ' + t('tw.state.on') : '⚪ ' + t('tw.state.wait');
  function setupHtml() {
    return `<span>${esc(t('tw.setup.h'))}</span><small class="muted">${esc(t('tw.setup.help'))}</small>
      <div><input type="text" id="twChannel" value="${esc(cfg.channel)}" placeholder="${esc(t('tw.setup.ph'))}" autocomplete="off" maxlength="26" onkeydown="if(event.key==='Enter'){event.preventDefault();TwitchTab.save()}">
      <button type="button" class="primary" id="twSave" onclick="TwitchTab.save()">${esc(t('tw.setup.save'))}</button></div>
      <div class="err" id="twErr"></div><small class="muted" id="twState">${esc(msg || (cfg.channel ? stateOf() : ''))}</small>`;
  }
  async function save() {
    const v = document.getElementById('twChannel').value;
    try { cfg = await api('POST', '/api/twitch/config', { channel: v }); msg = t('tw.setup.saved'); } catch (e) { const x = document.getElementById('twErr'); if (x) x.textContent = e.message || String(e); return; }
    paintBox(); msg = '';
    if (typeof Dms !== 'undefined') Dms.reload && Dms.reload();
  }
  const keyOf = () => 'tw:' + cfg.channel;
  function rowsHtml() {
    if (!cfg.channel) return [];
    return [`<button class="dm-row" data-dm="${esc(keyOf())}"><span class="dm-av">🟣</span><span class="dm-rowtext"><b>#${esc(cfg.channel)}</b><span class="muted">${esc(t('tw.row'))}</span></span></button>`];
  }
  const msgHtml = m => `<div class="dm-msg tw-msg"><div class="dm-meta"><b class="tw-name" ${m.color ? `style="color:${esc(m.color)}"` : ''}>${esc(m.name)}</b> ${ago(m.at)}</div><div class="dm-bubble">${esc(m.text)}</div></div>`;
  function show(key) {
    cur = key; msgs = []; last = 0; sig = '';
    const panel = document.getElementById('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button><span class="dm-av">🟣</span><div><b>#${esc(cfg.channel)}</b><div class="muted">${esc(t('tw.readonly'))}</div></div><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div class="dm-list" id="dmList"></div>`;
    panel.hidden = false; load(true);
  }
  async function load(scroll) {
    if (!cur) return;
    try { const more = await api('GET', '/api/twitch/messages?after=' + last); if (more.length) { msgs = msgs.concat(more).slice(-200); last = more[more.length - 1].id; } } catch (e) { const l = document.getElementById('dmList'); if (l) l.innerHTML = `<p class="muted dm-empty">${esc(e.message || '')}</p>`; return; }
    const list = document.getElementById('dmList'); if (!list) return;
    const html = msgs.map(msgHtml).join('') || `<p class="muted dm-empty">${esc(t('tw.none'))}</p>`;
    if (sig !== html || list.dataset.sig !== html) { const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40; sig = html; list.dataset.sig = html; list.innerHTML = html; if (scroll || atBottom) list.scrollTop = list.scrollHeight; }
  }
  function stop() { cur = null; }
  poll(); setInterval(poll, 3000);
  return { show, load, stop, rowsHtml, setupHtml, save, poll, linked: () => !!cfg.channel };
})();
