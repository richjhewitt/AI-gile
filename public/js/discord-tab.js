/* ---------- 💬 the Discord tab in the DM window (AIG-557, AIG-559) ---------- */
// Only there once a Discord bot is set up (GET /api/discord/unread says linked). The tab (a chip in the DM list) lists the
// bot's chats with you and the channels it is in; open one to read and reply in place. The token never reaches the page:
// the board talks to Discord (lib/discord.js). Unread = DMs from you on Discord since you last opened that chat; the badge
// sits on the tab and the rail's 💬; a browser notification when the page is hidden (same Alerts switch as the inbox);
// pictures show inline from their Discord URLs. Messages you send the bot from Discord reach the lead's chat as before.
// Dms (dms.js) calls: linked(), unread(), rowsHtml(), show(key) for a key 'dc:<bot>|<channel>', load().
const DiscordTab = (() => {
  let st = { linked: false, total: 0, chats: [] }, chats = [], cur = null, msgs = [], lastTotal = 0, busy = false;
  const keyOf = c => 'dc:' + c.bot + '|' + c.id;
  const split = k => { const s = String(k).slice(3), i = s.lastIndexOf('|'); return [s.slice(0, i), s.slice(i + 1)]; };
  const alertsOn = () => typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem('aigile.alerts') === '1';
  async function poll() {
    try { st = await api('GET', '/api/discord/unread'); } catch { return; }
    if (st.total > lastTotal && document.hidden && alertsOn() && !document.documentElement.hasAttribute('data-focus') && !document.documentElement.hasAttribute('data-break')) {
      const c = st.chats.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || {};
      try { const n = new Notification(t('dc.notify', { who: c.from || 'Discord' }), { body: String(c.preview || '').slice(0, 160), tag: 'aigile-discord' }); n.onclick = () => { notifyGo(c.key ? { chat: 'dc:' + c.key } : { hash: '#/inbox' }); n.close(); }; } catch {}
    }
    lastTotal = st.total;
    if (!document.hidden && typeof Dms !== 'undefined') Dms.reload && Dms.reload();
  }
  async function loadChats() { try { chats = await api('GET', '/api/discord/chats'); } catch { chats = []; } if (typeof Dms !== 'undefined') Dms.reload(); }
  const unreadOf = c => ((st.chats.find(x => x.key === c.bot + '|' + c.id)) || {}).n || 0;
  function rowsHtml() {
    if (!chats.length) loadChats();
    const badge = n => n ? `<span class="dm-unread">${n > 99 ? '99+' : n}</span>` : '';
    return chats.slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).map(c => `<button class="dm-row" data-dm="${esc(keyOf(c))}"><span class="dm-av">${c.kind === 'dm' ? '💬' : '#'}</span><span class="dm-rowtext"><b>${esc(c.name)}</b><span class="muted">${esc(c.kind === 'dm' ? t('dc.kind.dm', { bot: c.bot }) : (c.guild || '') + ' · ' + c.bot)}</span></span>${badge(unreadOf(c))}</button>`);
  }
  const msgHtml = m => `<div class="dm-msg ${m.mine ? 'mine' : ''}"><div class="dm-meta"><b>${esc(m.author)}</b> ${ago(m.at)}</div><div class="dm-bubble">${esc(m.text).replace(/\n/g, '<br>')}${(m.images || []).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img class="dc-pic att-shown" src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')}</div></div>`;
  function show(key) {
    cur = key; msgs = [];
    const c = chats.find(x => keyOf(x) === key) || { name: split(key)[1], kind: 'dm', bot: split(key)[0] };
    const panel = document.getElementById('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}" aria-label="${esc(t('dms.all'))}"><span aria-hidden="true">‹</span></button><span class="dm-av">${c.kind === 'dm' ? '💬' : '#'}</span><div><b>${esc(c.name)}</b><div class="muted">${esc(t('dc.via', { bot: c.bot }))}</div></div><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}" aria-label="${esc(t('common.close'))}"><span aria-hidden="true">✕</span></button></div>
      <div class="dm-list" id="dmList"></div>
      <div class="dm-compose"><textarea id="dmText" rows="2" placeholder="${esc(t('dc.placeholder'))}" onkeydown="if(EnterSend.is(event,'dm')){event.preventDefault();DiscordTab.send()}"></textarea>
        <div class="err" id="dmErr"></div><div class="actions"><button class="primary" id="dcSend" onclick="DiscordTab.send()">${esc(t('dms.send'))}</button></div></div>`;
    panel.hidden = false; load(true);
  }
  async function load(scroll) {
    if (!cur) return;
    const [bot, ch] = split(cur);
    try { msgs = await api('GET', `/api/discord/messages?bot=${encodeURIComponent(bot)}&channel=${encodeURIComponent(ch)}`); } catch (e) { const l = document.getElementById('dmList'); if (l) l.innerHTML = `<p class="muted dm-empty">${esc(e.message || '')}</p>`; return; }
    const list = document.getElementById('dmList'); if (!list) return;
    const html = msgs.map(msgHtml).join('') || `<p class="muted dm-empty">${esc(t('dc.none'))}</p>`;
    if (list.dataset.sig !== html) { const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40; list.dataset.sig = html; list.innerHTML = html; if (scroll || atBottom) list.scrollTop = list.scrollHeight; }
  }
  async function send() {
    if (busy || !cur) return;
    const ta = document.getElementById('dmText'), text = ta.value.trim(); if (!text) { document.getElementById('dmErr').textContent = t('dms.empty'); return; }
    const [bot, channel] = split(cur); busy = true; document.getElementById('dmErr').textContent = '';
    try { await api('POST', '/api/discord/send', { bot, channel, text }); ta.value = ''; await load(true); }
    catch (e) { document.getElementById('dmErr').textContent = e.message || String(e); }
    busy = false;
  }
  function stop() { cur = null; }
  PagePoll.every(poll, 4000, { hidden: 5000, immediate: true, home: true, alerts: true });   // raises a desktop notification: keeps its pace when hidden (AIG-1153)
  return { show, load, send, stop, rowsHtml, loadChats, linked: () => !!st.linked, unread: () => st.total || 0 };
})();
