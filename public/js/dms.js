/* ---------- the rail and DMs (AIG-137/138, AIG-147..149): Discord-style, apart from the work inbox ---------- */
// The rail down the left: Home, Inbox and 💬 DMs at the top, then each project as a "server" icon (its emoji
// and colour) with a red count of what needs you and a white pip for activity you haven't looked at. 💬 DMs
// opens the list of team leads; picking one opens the chat: the lead's messages left, yours right. The typing
// box answers the newest open question, or (when none is waiting) sends the lead a quick question card.
// Friends' private DMs (AIG-111, lib/dm.js) are chats too: the list has a filter All / Agents / People, and a
// friend's chat has the same typing box, 👍 and attachments. A friend's chat key is 'dm:<contact id>'.
const Dms = (() => {
  let paName = '', projects = [], chats = [], people = [], closed = {}, showClosed = false, showQuiet = false, showDone = false, askAll = false, filter = 'all', open = null, listOpen = false, thread = null, threadSeq = 0, busy = false;
  let q = '', notified = null;   // AIG-1252: the chat list search; AIG-1251: each friend's newest incoming message already announced
  let groups = [], meets = [], grpCands = [];   // 👥 group chats (AIG-1027): key 'grp:<id>'
  let fold = null, target = null, waitingSeen = new Set();   // the card shown open in the chat, and the card the typing box answers (AIG-157)
  const QUIET_MS = 6 * 3600000;   // AIG-946, AIG-1021: a chat with nothing unread and no message for 6 hours hides until a new one
  const plain = s => String(s || '').replace(/```/g, ' ').replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, '').replace(/^\s*#+\s+/gm, '').replace(/\*\*|__|[*_`~]/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();   // AIG-946: previews are plain text
  const GENERAL = '_new';   // target: a new message to the lead instead of an answer (AIG-285)
  const el = id => document.getElementById(id);
  const avatar = c => `<span class="dm-av" style="--proj:${esc(c.color || '')}">${pic(c.logo, c.emoji || '💬')}</span>`;
  // A lead's own picture when it has one (AIG-150), else the project's.
  const leadAv = c => c.leadPic ? `<span class="dm-av" style="--proj:${esc(c.color || '')}"><img class="pic" src="${esc(c.leadPic)}" alt=""></span>` : avatar(c);
  // 🧭 The Lead Scrum Master's chat (AIG-359): its name in the chosen language.
  const leadName = c => c.noAi ? t('sm.noai.lead') : c.watchman ? t('sm.lead') : c.lead;
  const chatName = c => c.noAi ? t('sm.noai.name') : c.watchman ? t('sm.name') : c.name;
  const badge = n => n ? `<span class="dm-unread">${n > 99 ? '99+' : n}</span>` : '';
  // "Seen" per project: the project's last update when you last opened its board (this browser only).
  const seen = { get: s => { try { return localStorage.getItem('aigile.seen.' + s) || ''; } catch { return ''; } }, set: (s, v) => { try { localStorage.setItem('aigile.seen.' + s, v); } catch {} } };
  const dmSeen = { get: id => { try { return localStorage.getItem('aigile.dmseen.' + id) || ''; } catch { return ''; } }, set: (id, v) => { try { localStorage.setItem('aigile.dmseen.' + id, v); } catch {} } };
  try { filter = localStorage.getItem('aigile.dmfilter') || 'all'; } catch {}
  const isPerson = k => String(k).startsWith('dm:');
  const isTw = k => String(k).startsWith('tw:');   // 🟣 the Twitch tab (AIG-628, twitch-tab.js)
  const isDc = k => String(k).startsWith('dc:');
  const isGrp = k => String(k).startsWith('grp:');   // 👥 a group chat (AIG-1027)
  const grpUnread = g => !g.lastMine && !!g.lastText && g.last > dmSeen.get('grp:' + g.id) && open !== 'grp:' + g.id ? 1 : 0;   // 💬 the Discord tab (AIG-557, discord-tab.js)
  // A friend's picture is the one I picked for them (AIG-883), else theirs, else the emoji.
  const personAv = c => `<span class="dm-av">${c && c.pic ? `<img class="pic" src="${esc(c.pic)}" alt="">` : '🙋'}</span>`;
  const here = () => (location.hash.match(/^#\/p\/([^/]+)/) || [])[1] || '';

  // Drag a project icon up or down to reorder (AIG-189), like servers in Discord. The rail doesn't redraw mid-drag.
  // 🪐 Spaces (AIG-464): dropped on the middle of an icon it goes inside that project; above or below one, it sits next to
  // it, in the same space (so dropping it beside a top-level icon takes it out). Right-click is the same as a menu.
  let dragging = null, dragFrom = '';
  const railEl = () => el('dmRail');
  const zone = (b, e) => { const r = b.getBoundingClientRect(), y = (e.clientY - r.top) / r.height; return y < .3 ? 'before' : y > .7 ? 'after' : 'into'; };
  const unmark = () => railEl().querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-into'));
  document.addEventListener('dragstart', e => { const b = e.target.closest && e.target.closest('#dmRail [data-slug]'); if (!b) return; dragging = b.dataset.slug; dragFrom = b.dataset.parent || ''; b.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragging); } catch {} });
  document.addEventListener('dragover', e => {
    const b = dragging && e.target.closest && e.target.closest('#dmRail [data-slug]'); if (!b) return;
    e.preventDefault();
    unmark();
    if (b.dataset.slug !== dragging) b.classList.add('drop-' + zone(b, e));
  });
  document.addEventListener('drop', async e => {
    const b = dragging && e.target.closest && e.target.closest('#dmRail [data-slug]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.slug === dragging) return;
    const z = zone(b, e), d = dragging, into = b.dataset.parent || '';
    dragging = null;
    if (z === 'into') { await Spaces.move(d, b.dataset.slug); railEl().dataset.sig = ''; return loadRail(); }
    const order = [...railEl().querySelectorAll('[data-slug]')].map(x => x.dataset.slug).filter(s => s !== d), at = order.indexOf(b.dataset.slug);
    order.splice(z === 'after' ? at + 1 : at, 0, d);
    try { await api('POST', '/api/projects/order', { slugs: order }); } catch (err) { alert(err.message); }
    if (into !== dragFrom) await Spaces.move(d, into);
    railEl().dataset.sig = ''; loadRail(); if (typeof refresh === 'function') refresh(true);
  });
  document.addEventListener('dragend', () => { if (!dragging) return; dragging = null; const r = railEl(); if (r) { r.querySelectorAll('.dragging,.drop-before,.drop-after,.drop-into').forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after', 'drop-into')); r.dataset.sig = ''; } loadRail(); });
  document.addEventListener('contextmenu', e => { const b = e.target.closest && e.target.closest('#dmRail [data-slug]'); if (!b) return; e.preventDefault(); Spaces.menu(b.dataset.slug); });

  async function loadRail() {
    if (!i18n.ready) return void setTimeout(loadRail, 100);
    let nightWatch;
    try { [projects, chats, nightWatch] = await Promise.all([PagePoll.get('/api/projects'), PagePoll.get('/api/chats'), nightProjects(), TodayPage.fresh()]); } catch { return; }
    let boards = [];
    try { boards = (await PagePoll.get('/api/shares')).filter(l => l.theirRole && !l.forgotten && ['live', 'ended'].includes(l.state)); } catch {}
    try { people = (await PagePoll.get('/api/dms/contacts')).filter(c => !c.blocked).map(c => ({ ...c, unread: c.lastIn && c.lastIn > dmSeen.get(c.id) && open !== 'dm:' + c.id ? 1 : 0 })); } catch { people = []; }
    try { Call.ring(people); } catch {}   // AIG-1238: a friend's fresh call rings
    try { closed = await PagePoll.get('/api/dmclosed'); } catch { closed = {}; }
    try { paName = (await PagePoll.get('/api/assistant')).name; } catch {}
    try { groups = NoAi.on ? [] : await PagePoll.get('/api/chats/_groups'); } catch { groups = []; }
    try { meets = NoAi.on ? [] : await PagePoll.get('/api/chats/_meetings'); } catch { meets = []; }   // 🎥 each project's Meeting Room (AIG-1168)
    notifyFriends();
    const fp = Object.fromEntries(people.filter(c => c.pic).map(c => [c.name.trim().toLowerCase(), c.pic]));   // friends' pictures for their comments and DMs (AIG-883)
    if (JSON.stringify(fp) !== JSON.stringify(state.friendPics || {})) { state.friendPics = fp; if (typeof refresh === 'function') refresh(true); }
    if (Swarm.hiding) boards = [];   // 🚨 swarm: friends' boards wait too (AIG-880)
    if (NoAi.on) chats = chats.filter(c => c.noAi);   // 🚫 no DMs to leads (AIG-581); only the 🧭 Scrum Master (no AI) stays (AIG-729)
    const cur = here(), p = projects.find(x => x.slug === cur);
    if (p) seen.set(cur, p.updated);   // looking at it now counts as seen
    const dmUnread = chats.reduce((n, c) => n + c.unread, 0) + groups.concat(meets).reduce((n, g) => n + grpUnread(g), 0) + people.reduce((n, c) => n + c.unread, 0) + DiscordTab.unread();
    // AIG-1274: the desktop app's taskbar count = For you (the inbox) + unread messages; nothing while going quiet or focusing (like the tab title)
    if (window.aigileDesktop && aigileDesktop.setBadge) { const H = document.documentElement; aigileDesktop.setBadge(H.hasAttribute('data-night') || H.hasAttribute('data-focus') || typeof IB === 'undefined' ? 0 : (IB.items || []).length + IB.friends() + dmUnread); }
    const btn = (attrs, inner, on, title) => `<button class="dm-railbtn ${on ? 'on' : ''}" ${attrs} title="${esc(title)}">${inner}</button>`;
    const html = btn('data-go="#/"', '<span class="dm-av">🏠</span>', location.hash === '#/' || location.hash === '', t('dms.home'))
      + btn('data-go="#/inbox"', '<span class="dm-av">📥</span>' + badge(typeof IB !== 'undefined' ? (IB.items || []).length + IB.friends() : 0), location.hash === '#/inbox', t('dms.inbox'))
      + btn('data-dms="1"', '<span class="dm-av">💬</span>' + badge(dmUnread), listOpen || !!open, t('dms.rail.label'))
      + '<div class="dm-sep"></div>'
      + railTree(onlyNightProjects(TodayPage.only(Swarm.only(projects.filter(x => !x.archived))), nightWatch), cur, btn)   // 🚨 swarm: only that project (AIG-880)
      // AIG-324: each project a friend shares with me, as its own board.
      + (boards.length ? '<div class="dm-sep"></div>' + boards.map(l => btn(`data-go="#/shared/${esc(l.id)}" data-sboard="${esc(l.id)}"`, `<span class="dm-av">🔗</span>`, location.hash === '#/shared/' + l.id, t('sb.rail', { name: l.friend, project: l.theirName }))).join('') : '');
    const r = el('dmRail');
    if (r && r.dataset.sig !== html && !dragging) { r.dataset.sig = html; r.innerHTML = html; }
    if (listOpen && !open) paintList();
  }

  // AIG-1251: a new message from a friend beeps and pops a desktop notification, with the same alert switch as team questions;
  // quiet in focus mode, on a break and when going quiet. A click opens that chat. The first read only sets the baseline.
  function notifyFriends() {
    const first = !notified; notified = notified || {};
    const root = document.documentElement, front = !document.hidden && document.hasFocus();
    for (const c of people) {
      const prev = notified[c.id] || ''; notified[c.id] = c.lastIn || prev;
      if (first || !c.lastIn || c.lastIn <= prev) continue;
      if (open === 'dm:' + c.id && front) continue;   // you are looking at it
      if (typeof IB === 'undefined' || !IB.alertsOn || !IB.alertsOn() || ['data-focus', 'data-break', 'data-night'].some(a => root.hasAttribute(a))) continue;
      if (typeof Streamer !== 'undefined' && Streamer.on && Streamer.on()) continue;
      IB.beep();
      const n = new Notification(t('dms.notify', { who: c.name }), { body: plain(c.lastText).slice(0, 160), tag: 'aigile-dm-' + c.id });
      n.onclick = () => { notifyGo({ chat: 'dm:' + c.id }); n.close(); };
    }
  }
  // 🪐 The projects as a tree (AIG-434): a space and its projects in a folder like Discord's, with a fold arrow; a folded
  // space's red count adds up what waits on you inside it. Nested Spaces.MAX levels deep, like the home page.
  function railTree(list, cur, btn) {
    const T = Spaces.tree(list), needs = x => x.needsYou + T.of(x.slug).reduce((n, k) => n + needs(k), 0);
    const one = (x, n) => btn(`data-go="#/p/${esc(x.slug)}" data-slug="${esc(x.slug)}" data-parent="${esc(T.up(x.slug))}" draggable="true"`, avatar(x) + badge(n) + (x.updated > seen.get(x.slug) && x.slug !== cur && !n ? '<span class="dm-pip"></span>' : ''),
      x.slug === cur, (x.private ? '🔒 ' : '') + x.name + (n ? ' · ' + t('dms.waiting', { n }) : ''));
    const item = (x, d) => {
      const kids = T.of(x.slug);
      if (!kids.length || d >= Spaces.MAX) return one(x, x.needsYou);
      const open = Spaces.isOpen(x.slug);
      return `<div class="dm-space ${open ? 'open' : ''}" style="--proj:${esc(x.color || '')}">${one(x, open ? x.needsYou : needs(x))}<button class="dm-spacefold" data-spacefold="${esc(x.slug)}" aria-expanded="${open}" title="${esc(t(open ? 'space.fold.close' : 'space.fold.open'))}">${open ? '▾' : '▸'}</button>${open ? kids.map(k => item(k, d + 1)).join('') : ''}</div>`;
    };
    return T.roots.map(x => item(x, 1)).join('');
  }

  // 📝 Drafts (AIG-1022): unsent replies kept in this browser (core.js). One row each: where it is for, the first words, when; click opens it, ✕ discards.
  function draftRows() {
    const list = listDrafts(); if (!list.length) return '';
    const where = key => {
      if (key.startsWith('dm/')) { const k = key.slice(3), c = chats.find(x => x.slug === k), p = people.find(x => 'dm:' + x.id === k); return k === '_allhands' ? t('allhands.name') : k === '_assistant' ? (paName || t('pa.name')) : c ? chatName(c) : p ? p.name : k; }
      const [s, id] = key.split('/'); return s + ' · ' + id;
    };
    return `<div class="dm-drafts">${list.map(d => `<div class="dm-rowwrap"><button class="dm-row" data-dmdraft="${esc(d.key)}"><span class="dm-rowtext"><b>${esc(where(d.key))}</b><span class="muted">${esc(plain(d.text).slice(0, 50))}${d.at ? ' · ' + ago(new Date(d.at).toISOString()) : ''}</span></span></button><button class="dm-rowx" data-dmdraftx="${esc(d.key)}" title="${esc(t('dms.drafts.discard'))}" aria-label="${esc(t('dms.drafts.discard'))}">✕</button></div>`).join('')}</div>`;
  }
  // The DM list: one row per lead (🤖) and per friend (🙋), narrowed by the filter chips (All / Agents / People).
  function paintList() {
    if (filter === 'discord' && !DiscordTab.linked()) filter = 'all';
    if (filter === 'twitch' && !TwitchTab.linked()) filter = 'all';
    if (filter === 'meet' && !meets.length) filter = 'all';   // AIG-1188: Meeting Rooms are their own tab, shown while there are any
    if (filter === 'drafts' && !listDrafts().length) filter = 'all';   // AIG-1043: Drafts is its own tab, shown while there are any
    // AIG-917: newest message first (any side), unread rows stand out, a ✕ closes a chat (hidden, history kept, back on a newer message).
    const qs = q.trim().toLowerCase(), hit = (...a) => !qs || a.some(x => String(x || '').toLowerCase().includes(qs));   // AIG-1252
    const entry = (key, last, unread, inner, waiting, text) => ({ ok: hit(...text), key, last: last || '', unread, hidden: !!closed[key] && !waiting && (!last || last <= closed[key]), quiet: !!last && !unread && !waiting && Date.now() - Date.parse(last) > QUIET_MS, html: `<div class="dm-rowwrap ${unread ? 'unread' : ''}"><button class="dm-row" data-dm="${esc(key)}">${inner}</button><button class="dm-rowx" data-dmclose="${esc(key)}" title="${esc(t('dms.close.title'))}" aria-label="${esc(t('dms.close.title'))}">✕</button></div>` });
    const all = (filter === 'people' || filter === 'twitch' || filter === 'discord' || filter === 'meet' ? [] : chats.map(c => entry(c.slug, c.last, c.unread, `${c.watchman || c.noAi ? leadAv(c) : avatar(c)}<span class="dm-rowtext"><b>${esc(c.watchman || c.noAi ? leadName(c) : chatName(c))}</b><span class="muted">${esc([c.watchman || c.noAi ? '' : leadName(c), plain(c.lastText).slice(0, 60) || (c.watchman || c.noAi ? '' : t('dms.hint.lead')), c.last ? ago(c.last) : ''].filter(Boolean).join(' · '))}</span></span>${badge(c.unread)}`, c.unread > 0, [chatName(c), leadName(c), c.name, c.lastText])))
      .concat(filter === 'agents' || filter === 'twitch' || filter === 'discord' || filter === 'meet' ? [] : people.map(c => entry('dm:' + c.id, c.last, c.unread, `${personAv(c)}<span class="dm-rowtext"><b>${esc(c.name)}</b><span class="muted">${esc([plain(c.lastText).slice(0, 60) || t('dms.person'), c.last ? ago(c.last) : ''].filter(Boolean).join(' · '))}</span></span>${badge(c.unread)}`, false, [c.name, c.lastText])))
      .filter(r => r.ok)
      .sort((x, y) => (Date.parse(y.last) || 0) - (Date.parse(x.last) || 0));   // newest activity first
    const shut = all.filter(r => r.hidden), quietRows = qs ? [] : all.filter(r => !r.hidden && r.quiet), shown = all.filter(r => !r.hidden && (qs || showQuiet || !r.quiet));   // searching shows quiet chats that match
    const rows = filter === 'twitch' ? TwitchTab.rowsHtml() : filter === 'discord' ? DiscordTab.rowsHtml() : shown.map(r => r.html);
    const closedBox = shut.length ? `<div class="dm-closed"><button class="dm-closedlink" data-dmshowclosed="1" aria-expanded="${showClosed}">${esc(t('dms.closed.show', { n: shut.length }))}</button>${showClosed ? shut.map(r => r.html.replace('data-dmclose=', 'data-dmreopen=').replace(/title="[^"]*" aria-label="[^"]*">✕/, `title="${esc(t('dms.closed.reopen'))}" aria-label="${esc(t('dms.closed.reopen'))}">↩`)).join('') : ''}</div>` : '';
    const quietBox = quietRows.length && filter !== 'twitch' && filter !== 'discord' ? `<div class="dm-closed dm-quiet"><button class="dm-closedlink" data-dmshowquiet="1" aria-expanded="${showQuiet}">${esc(showQuiet ? t('dms.quiet.hide') : t(quietRows.length === 1 ? 'dms.quiet.show.one' : 'dms.quiet.show', { n: quietRows.length }))}</button></div>` : '';
    const none = qs && (filter === 'all' || filter === 'agents' || filter === 'people' || filter === 'meet') ? t('dms.search.none', { q: q.trim() }) : filter === 'meet' ? t('meet.none') : filter === 'twitch' ? t('tw.nonone') : filter === 'discord' ? t('dc.nonone') : filter === 'people' ? t('dms.nopeople') : filter === 'agents' ? t('dms.noleads') : (chats.length || people.length) && !shut.length && !quietRows.length ? t('dms.nonone') : t('dms.noleads');
    const chips = ['all', 'agents', 'people', ...(DiscordTab.linked() ? ['discord'] : []), ...(TwitchTab.linked() ? ['twitch'] : []), ...(meets.length ? ['meet'] : []), ...(listDrafts().length ? ['drafts'] : [])].map(f => `<button class="dm-chip ${f === filter ? 'on' : ''}" data-dmfilter="${f}" aria-pressed="${f === filter}">${esc(t(f === 'drafts' ? 'dms.drafts' : 'dms.filter.' + f))}${f === 'discord' ? badge(DiscordTab.unread()) : ''}</button>`).join('');
    const fresh = !chats.some(c => c.last) && !people.some(c => c.last);   // nothing written yet: say what each row is for (AIG-1085)
    const html = `<div class="dm-head"><b>${esc(t('dms.title'))}</b><span style="flex:1"></span>${windowTools('Dms.close()', popHere())}</div>
      ${['all', 'agents', 'people', 'meet'].includes(filter) ? `<div class="dm-searchrow"><input id="dmSearch" type="search" class="dm-search" value="${esc(q)}" placeholder="${esc(t('dms.search'))}" aria-label="${esc(t('dms.search'))}" autocomplete="off"></div>` : ''}
      <div class="dm-filter" role="group" aria-label="${esc(t('dms.filter'))}">${chips}</div>
      <div class="dm-list">${filter === 'drafts' ? draftRows() : filter === 'meet' ? meetsHtml(qs) : `${filter === 'all' || filter === 'agents' ? `${hit(t('allhands.name')) ? `<button class="dm-row" data-dm="_allhands"><span class="dm-rowtext"><b>${esc(t('allhands.name'))}</b>${fresh ? `<span class="muted dm-hint">${esc(t('dms.hint.allhands'))}</span>` : ''}</span></button>` : ''}${hit(paName || t('pa.name')) ? `<button class="dm-row" data-dm="_assistant"><span class="dm-rowtext"><b>${esc(paName || t('pa.name'))}</b>${fresh ? `<span class="muted dm-hint">${esc(t('dms.hint.assistant'))}</span>` : ''}</span></button>` : ''}${groupsHtml(qs)}${rows.length ? `<div class="dm-groups-h dm-leads-h"><span class="muted">${esc(t('dms.leadchats'))}</span></div>` : ''}` : ''}${rows.join('') || `<p class="muted dm-empty">${esc(none)}</p>`}${quietBox}${closedBox}`}</div>`;
    const panel = el('dmPanel'), ae = document.activeElement, kept = ae && ae.id === 'dmSearch' ? [ae.selectionStart, ae.selectionEnd] : null;
    if (panel.dataset.sig !== html) {
      panel.dataset.sig = html; panel.innerHTML = html;
      const sb = kept && el('dmSearch'); if (sb) { sb.focus(); try { sb.setSelectionRange(kept[0], kept[1]); } catch {} }   // a repaint keeps your place in the search box
    }
    panel.hidden = false;
  }

  // 👥 Groups (AIG-1027): their own part of the All / Agents list, with ＋ New group.
  const grpHit = (g, qs) => !qs || [g.name, g.lastText, ...g.members.map(m => m.name)].some(x => String(x || '').toLowerCase().includes(qs));   // AIG-1252
  const groupsHtml = qs => `<div class="dm-groups"><div class="dm-groups-h"><span class="muted">${esc(t('grp.section'))}</span><button class="dm-newgroup" data-dmnewgroup="1">${esc(t('grp.new'))}</button></div>${groups.length || qs ? '' : `<p class="muted dm-empty dm-nogroups">${esc(t('grp.nogroups'))}</p>`}${groups.filter(g => grpHit(g, qs)).map(g => `<div class="dm-rowwrap ${grpUnread(g) ? 'unread' : ''}"><button class="dm-row" data-dm="grp:${esc(g.id)}"><span class="dm-av">👥</span><span class="dm-rowtext"><b>${esc(g.name)}</b><span class="muted">${esc([plain(g.lastText).slice(0, 60) || g.members.map(m => m.name).join(', '), g.lastText ? ago(g.last) : ''].filter(Boolean).join(' · '))}</span></span>${badge(grpUnread(g))}</button></div>`).join('')}</div>`;
  const meetsHtml = qs => !meets.length ? '' : `<div class="dm-groups"><div class="dm-groups-h"><span class="muted">${esc(t('meet.section'))}</span></div>${meets.filter(g => grpHit(g, qs)).sort((a, b) => (b.last || '').localeCompare(a.last || '')).map(g => `<div class="dm-rowwrap ${grpUnread(g) ? 'unread' : ''}"><button class="dm-row" data-dm="grp:${esc(g.id)}"><span class="dm-av">🎥</span><span class="dm-rowtext"><b>${esc(g.name)}</b><span class="muted">${esc([plain(g.lastText).slice(0, 60) || g.members.map(m => m.name).join(', '), g.lastText ? ago(g.last) : ''].filter(Boolean).join(' · '))}</span></span>${badge(grpUnread(g))}</button></div>`).join('')}</div>`;
  async function newGroup() {
    try { grpCands = await api('GET', '/api/chats/_groups/candidates'); } catch (e) { alert(e.message || String(e)); return; }
    openDialog(`<h2>${esc(t('grp.new.h'))}</h2><p class="muted">${esc(t('grp.new.help'))}</p>
      <label>${esc(t('grp.name'))}<input id="grpName" maxlength="80" autocomplete="off"></label>
      <b>${esc(t('grp.members'))}</b>${grpCands.length ? `<input id="grpSearch" type="search" class="grp-search" placeholder="${esc(t('grp.search'))}" autocomplete="off" oninput="Dms.grpFilter()">` : ''}
      <div class="grp-pick" id="grpPick">${grpCands.length ? grpCands.map((c, i) => (i && grpCands[i - 1].project === c.project ? '' : `<div class="grp-proj muted">${esc(c.projectName)}</div>`) + `<label class="grp-cand" data-q="${esc([c.name, c.projectName, c.role, c.engineLabel].join(' ').toLowerCase())}"><input type="checkbox" data-grpi="${i}"> ${esc(c.name)}${c.role ? ` <span class="muted">(${esc(c.role)})</span>` : ''}${c.engine !== 'claude' ? ` <span class="muted">· ${esc(c.engineLabel)}</span>` : ''}</label>`).join('') : `<p class="muted">${esc(t('grp.none'))}</p>`}</div>
      <div class="err" id="grpErr"></div>
      <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button><button type="button" class="primary" id="grpCreate" onclick="Dms.createGroup()">${esc(t('grp.create'))}</button></div>`);
    const n = el('grpName'); if (n) n.focus();
  }
  // AIG-1131: the search box hides rows that do not match; a project heading stays only while one of its rows shows.
  function grpFilter() {
    const q = (el('grpSearch').value || '').trim().toLowerCase(); let head = null, any = false;
    for (const n of document.querySelectorAll('#grpPick > *')) {
      if (n.classList.contains('grp-proj')) { if (head) head.hidden = !any; head = n; any = false; continue; }
      const hit = !q || (n.dataset.q || '').includes(q); n.hidden = !hit; if (hit) any = true;
    }
    if (head) head.hidden = !any;
  }
  async function createGroup() {
    const name = el('grpName').value.trim(), members = [...document.querySelectorAll('#grpPick [data-grpi]:checked')].map(x => grpCands[+x.dataset.grpi]).map(c => ({ project: c.project, name: c.name }));
    if (!name) { el('grpErr').textContent = t('grp.err.name'); return; }
    if (members.length < 2) { el('grpErr').textContent = t('grp.err.two'); return; }
    try { const g = await api('POST', '/api/chats/_groups', { name, members }); closeDialog(); await loadRail(); show('grp:' + g.id); }
    catch (e) { el('grpErr').textContent = e.message || String(e); }
  }

  // acts: answer buttons under the message (AIG-176), only on the latest one still waiting on you.
  // AIG-975: a ★ on a message starred in the phone app (thread.stars holds "chat|at").
  const starHtml = m => (thread.stars || []).includes(m.card + '|' + m.at) ? ' <span class="dm-star" aria-hidden="true">★</span>' : '';
  // 👥 a group's lines carry an id (AIG-1164): reply, react, and edit or delete your own.
  const msgHtml = (m, acts = '') => thread.group && m.id
    ? `<div class="dm-msg ${m.mine ? 'mine' : ''} ${m.deleted ? 'dm-gone' : ''}" data-mid="${esc(m.id)}"><div class="dm-meta">${face(m.author, thread.team)}<b>${esc(m.author)}</b> ${ago(m.at)}${m.edited && !m.deleted ? ` <span class="dm-edited">${esc(t('dms.edited'))}</span>` : ''}</div>${quoteHtml(m.reply, id => { const q = thread.messages.find(x => x.id === id); return q && { who: q.author, text: q.deleted ? '' : q.text }; })}<div class="dm-bubble">${m.deleted ? `<i class="muted">${esc(t('dms.deleted'))}</i>` : linkify(m.text || '', thread)}</div>${m.deleted ? '' : chipsHtml((m.reacts || []).map(r => ({ e: r.e, n: r.who.length, mine: r.mine, who: r.who })))}${m.deleted ? '' : lineActs(m.mine)}${acts}</div>`
    : `<div class="dm-msg ${m.mine ? 'mine' : ''}"><div class="dm-meta">${face(m.author, thread.team)}<b>${esc(m.author)}</b> ${ago(m.at)}${starHtml(m)}</div><div class="dm-bubble">${linkify(m.text || '', thread)}${Attach.shown(m, thread.slug)}</div>${originHtml(m)}${acts}${pickHtml(m)}</div>`;
  /* ---------- reply, react, edit, delete, typing (AIG-1164, lifted from ChilledChat) ---------- */
  // Friends' chats and 👥 groups: a small bar on each line (↩ 😊, and ✏️ 🗑 on your own), chips under the bubble, a quote over a reply.
  const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀', '🙏', '✅'];
  let replyTo = null, editing = null, typedAt = 0;   // { id, who, text } / the line being edited / when I last said I was typing
  const lineActs = own => `<div class="dm-lineacts">${[['reply', '↩'], ['react', '😊'], ...(own ? [['edit', '✏️'], ['del', '🗑']] : [])].map(([a, i]) => `<button type="button" data-dmact="${a}" title="${esc(t('dms.act.' + a))}" aria-label="${esc(t('dms.act.' + a))}">${i}</button>`).join('')}</div>`;
  const chipsHtml = list => list.length ? `<div class="dm-reacts">${list.map(r => `<button type="button" class="dm-react ${r.mine ? 'mine' : ''}" data-dmreact="${esc(r.e)}" title="${esc(r.who.join(', '))}" aria-pressed="${!!r.mine}">${esc(r.e)} <span>${r.n}</span></button>`).join('')}</div>` : '';
  // The quoted line: the one still in the chat when it is (so an edit or delete shows), else the words saved with the reply.
  const quoteHtml = (r, find) => { if (!r) return ''; const q = find(r.id); const who = q ? q.who : r.author || ''; const text = q ? q.text : r.text; return `<div class="dm-quote" data-dmquote="${esc(r.id)}">↩ ${who ? `<b>${esc(who)}</b> ` : ''}<span>${text ? esc(plain(text).slice(0, 80)) : `<i>${esc(t('dms.deleted'))}</i>`}</span></div>`; };
  const personChips = (m, name) => { const r = m.reacts || {}, mine = r.mine || [], theirs = r.theirs || []; return chipsHtml([...new Set([...mine, ...theirs])].map(e => ({ e, n: mine.includes(e) + theirs.includes(e), mine: mine.includes(e), who: [...(mine.includes(e) ? [me()] : []), ...(theirs.includes(e) ? [name] : [])] }))); };
  const lineUrl = mid => thread.person ? `/api/dms/contacts/${thread.id}/messages/${encodeURIComponent(mid)}` : `/api/chats/_groups/${thread.groupId}/msgs/${encodeURIComponent(mid)}`;
  const lineOf = mid => thread && (thread.messages || []).find(m => m.id === mid);
  const lineWho = m => thread.person ? (m.dir === 'out' ? me() : thread.name) : m.author;
  async function lineDo(fn) {
    el('dmErr').textContent = '';
    try { await fn(); } catch (e) { el('dmErr').textContent = e.message || String(e); }
    const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread();
  }
  function pickReaction(mid, btn) {
    document.querySelectorAll('.dm-picker').forEach(x => x.remove());
    const p = document.createElement('div'); p.className = 'dm-picker'; p.dataset.mid = mid; p.setAttribute('role', 'menu');
    p.innerHTML = QUICK.map(e => `<button type="button" data-dmpick="${e}" role="menuitem">${e}</button>`).join('');
    btn.closest('.dm-msg').appendChild(p);
  }
  const react = (mid, emoji) => lineDo(() => api('POST', lineUrl(mid) + '/react', { emoji }));
  function startReply(mid) {
    const m = lineOf(mid); if (!m) return;
    replyTo = { id: mid, who: lineWho(m), text: m.text || '' };
    paintReplyBar(); const ta = el('dmText'); if (ta) ta.focus();
  }
  function paintReplyBar() {
    const bar = el('dmReplyBar'); if (!bar) return;
    bar.hidden = !replyTo;
    bar.innerHTML = replyTo ? `<span>↩ ${esc(t('dms.replying', { name: replyTo.who }))}</span> <span class="muted dm-replytext">${esc(plain(replyTo.text).slice(0, 80))}</span><button type="button" data-dmreplyx="1" title="${esc(t('dms.reply.cancel'))}" aria-label="${esc(t('dms.reply.cancel'))}">✕</button>` : '';
  }
  function startEdit(mid) {
    const m = lineOf(mid), row = document.querySelector(`#dmList .dm-msg[data-mid="${CSS.escape(mid)}"]`); if (!m || !row) return;
    editing = mid;
    row.querySelector('.dm-bubble').innerHTML = `<textarea class="dm-edit" rows="2" aria-label="${esc(t('dms.act.edit'))}">${esc(m.text || '')}</textarea><div class="actions"><button type="button" class="primary" data-dmeditsave="1">${esc(t('common.save'))}</button><button type="button" data-dmeditx="1">${esc(t('common.cancel'))}</button></div>`;
    const ta = row.querySelector('.dm-edit'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  function saveEdit() {
    const ta = document.querySelector('#dmList .dm-edit'), mid = editing; if (!ta || !mid) return;
    const text = ta.value.trim(); if (!text) return;
    editing = null; lineDo(() => api('PATCH', lineUrl(mid), { text }));
  }
  function stopEdit() { editing = null; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  function delLine(mid) { if (confirm(t('dms.delete.confirm'))) lineDo(() => api('DELETE', lineUrl(mid))); }
  // Who is typing: a friend (their board told mine, kept a few seconds) or a 👥 member whose run for the group is going.
  function paintTyping() {
    const box = el('dmTyping'); if (!box || !thread) return;
    const names = thread.person ? ((people.find(c => c.id === thread.id) || {}).typing ? [thread.name] : []) : thread.group ? thread.typing || [] : [];
    const txt = !names.length ? '' : names.length === 1 ? t('dms.typing.one', { name: names[0] }) : names.length === 2 ? t('dms.typing.two', { a: names[0], b: names[1] }) : t('dms.typing.many', { n: names.length });
    if (box.dataset.sig === txt) return;
    box.dataset.sig = txt; box.innerHTML = txt ? `<span class="dm-dots" aria-hidden="true"><span></span><span></span><span></span></span> ${esc(txt)}` : '';
  }
  // Typing in a friend's chat tells their board, at most every 4 seconds (the server keeps it to that too).
  function typed() {
    if (!thread || !thread.person || Date.now() - typedAt < 4000 || !el('dmText').value.trim()) return;
    typedAt = Date.now(); api('POST', `/api/dms/contacts/${thread.id}/typing`, {}).catch(() => {});
  }
  document.addEventListener('input', e => { if (e.target && e.target.id === 'dmText') typed(); });
  document.addEventListener('keydown', e => {
    if (!e.target.matches || !e.target.matches('#dmList .dm-edit')) return;
    if (e.key === 'Escape') { e.preventDefault(); stopEdit(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest) return;
    if (!e.target.closest('.dm-picker,[data-dmact="react"]')) document.querySelectorAll('.dm-picker').forEach(x => x.remove());
    const row = e.target.closest('#dmList .dm-msg[data-mid]'), mid = row && row.dataset.mid;
    const a = e.target.closest('#dmList [data-dmact]');
    if (a && mid) { e.preventDefault(); const k = a.dataset.dmact; if (k === 'reply') startReply(mid); else if (k === 'react') pickReaction(mid, a); else if (k === 'edit') startEdit(mid); else if (k === 'del') delLine(mid); return; }
    const pk = e.target.closest('#dmList [data-dmpick]');
    if (pk && mid) { e.preventDefault(); document.querySelectorAll('.dm-picker').forEach(x => x.remove()); react(mid, pk.dataset.dmpick); return; }
    const ch = e.target.closest('#dmList [data-dmreact]');
    if (ch && mid) { e.preventDefault(); react(mid, ch.dataset.dmreact); return; }
    if (e.target.closest('#dmList [data-dmeditsave]')) { e.preventDefault(); saveEdit(); return; }
    if (e.target.closest('#dmList [data-dmeditx]')) { e.preventDefault(); stopEdit(); return; }
    if (e.target.closest('#dmPanel [data-dmreplyx]')) { e.preventDefault(); replyTo = null; paintReplyBar(); return; }
    const qt = e.target.closest('#dmList [data-dmquote]');
    if (qt) { const to = document.querySelector(`#dmList .dm-msg[data-mid="${CSS.escape(qt.dataset.dmquote)}"]`); if (to) { to.scrollIntoView({ block: 'center', behavior: 'smooth' }); to.classList.add('dm-flash'); setTimeout(() => to.classList.remove('dm-flash'), 1200); } }
  });
  // AIG-566: a small chip on a reply: made by rules (free) or written by an AI (uses tokens). Old comments carry no marker, so no chip.
  const originHtml = m => m.mine || typeof m.auto !== 'boolean' ? '' : m.auto
    ? `<span class="dm-origin auto" title="${esc(t('dms.origin.auto.title'))}">${esc(t('dms.origin.auto'))}</span>`
    : `<span class="dm-origin ai" title="${esc(t('dms.origin.ai.title'))}">${esc(t('dms.origin.ai'))}</span>`;
  // The 🌙 watchman asking which team a message is for (AIG-221): one button per team.
  const pickHtml = m => m.pick && m === thread.messages.at(-1) ? `<div class="actions">${m.pick.map((o, i) => `<button data-pick="${i}">${esc(o.label)}</button>`).join('')}</div>` : '';
  // One fold per card (AIG-157): a clear header (kind, id, title); only one fold open at a time, the rest show
  // one line with the latest message, so each card can be dealt with on its own.
  function foldsHtml() {
    const groups = new Map();
    for (const m of thread.messages) { if (!groups.has(m.card)) groups.set(m.card, []); groups.get(m.card).push(m); }
    const list = [...groups].filter(([id]) => !((thread.cards || {})[id] || {}).agentMsg).sort((a, b) => (b[0] === '_lead') - (a[0] === '_lead') || a[1].at(-1).at.localeCompare(b[1].at(-1).at));   // AIG-872: the Lead chat is pinned at the top
    // AIG-1025: folds of cards that are done/accepted sit under a collapsed "Done (N)" toggle; unread, waiting and in-progress ones stay.
    const isDone = id => id !== '_lead' && !thread.watchman && !!((thread.cards || {})[id] || {}).done && !thread.open.some(o => o.id === id) && groups.get(id).some(m => m.mine);   // a done card you never answered (a lead's note) still counts as unread
    // AIG-1116: a fold stays only while it is current: waiting on you, unread (the lead spoke last and you never answered), or in progress with a message from the last 24 h. Agent-to-agent cards never show.
    const CUR_MS = 24 * 3600000, current = ([id, msgs]) => {
      const c = (thread.cards || {})[id] || {}, last = msgs.at(-1);
      if (id === '_lead' || thread.watchman || thread.assistant || thread.group || c.waiting || thread.open.some(o => o.id === id)) return true;
      if (c.done) return !msgs.some(m => m.mine);
      if (c.kind === 'test') return true;
      return (!last.mine && !msgs.some(m => m.mine)) || Date.now() - Date.parse(last.at) < CUR_MS;
    };
    const stale = e => isDone(e[0]) || !current(e);
    const doneN = list.filter(stale).length, vis = showDone ? list : list.filter(e => !stale(e));
    if (!vis.some(([id]) => id === fold)) fold = (target && vis.some(([id]) => id === target) ? target : null) || (vis.length ? vis.at(-1)[0] : null);
    const doneBox = doneN ? `<div class="dm-closed dm-donebox"><button class="dm-closedlink" data-dmshowdone="1" aria-expanded="${showDone}">${esc(t(showDone ? 'dms.done.hide' : 'dms.done.show', { n: doneN }))}</button></div>` : '';
    return doneBox + vis.map(([id, msgs]) => {
      const c = (thread.cards || {})[id] || {}, last = msgs.at(-1), isOpen = id === fold;
      const acts = c.waiting && !last.mine ? actionsHtml(askActions(last, c.kind), thread.slug, id) : '';
      const preview = plain(last.text).slice(0, 90);
      return `<div class="dm-fold ${isOpen ? 'open' : ''} ${c.waiting ? 'waiting' : ''}">
        <div class="dm-fold-h k-${esc(c.kind || 'other')}" data-fold="${esc(id)}" role="button" tabindex="0" aria-expanded="${isOpen}">
          ${thread.assistant ? `<b>${esc(t('pa.tagline'))}</b>` : thread.group ? `<b>👥 ${esc(thread.lead)}</b>` : thread.watchman ? `<b>${esc(t('sm.fold'))}</b>` : id === '_lead' ? `<span class="dm-tag">${esc(t('dms.kind.lead'))}</span>` : `<span class="dm-tag">${esc(t('dms.kind.' + (c.kind || 'other')))}</span><a class="dm-fold-id" href="#/p/${esc(thread.slug)}/${esc(id)}" title="${esc(t('dms.opencard'))}"><b>${esc(id)}</b> <span class="dm-fold-t">${esc(c.title || last.title || '')}</span></a>`}
          <span class="muted dm-fold-n">${esc(t(msgs.length === 1 ? 'dms.count.one' : 'dms.count.many', { n: msgs.length }))} · ${ago(last.at)}</span></div>
        ${isOpen ? `<div class="dm-fold-b">${thread.watchman || thread.assistant || thread.group || id === '_lead' ? '' : `<div class="actions dm-cardacts"><button class="dm-opencard" data-opencard="${esc(id)}" title="${esc(t('dms.opencard'))}">${esc(t('dms.opencard'))}</button></div>`}${msgs.map(m => msgHtml(m, m === last ? acts : '')).join('')}</div>`
          : `<div class="dm-fold-p muted"><b>${esc(last.author)}:</b> ${esc(preview)}</div>${acts}`}</div>`;
    }).join('');
  }
  // A friend's chat: plain bubbles, no cards or folds.
  function personHtml(msgs, name, em) {
    const find = id => { const q = msgs.find(x => x.id === id); return q && { who: q.dir === 'out' ? me() : name, text: q.deleted ? '' : q.text || (q.attachments ? '📎' : '') }; };   // AIG-1164
    return msgs.map(m => `<div class="dm-msg ${m.dir === 'out' ? 'mine' : ''} ${m.kind ? 'dm-' + esc(m.kind) : ''} ${m.deleted ? 'dm-gone' : ''}" data-mid="${esc(m.id)}"><div class="dm-meta">${face(m.dir === 'out' ? me() : name, [])}<b>${esc(m.dir === 'out' ? me() : name)}</b> ${ago(m.at)}${m.edited && !m.deleted ? ` <span class="dm-edited">${esc(t('dms.edited'))}</span>` : ''}${m.status === 'failed' ? ' · ' + esc(m.reason ? PagePoll.plain(m.reason) : t('dms.failed')) : m.status === 'sending' ? ' · ' + esc(t('dms.sending')) : ''}</div>
      ${askTag(m, name)}${quoteHtml(m.reply, find)}<div class="dm-bubble">${m.deleted ? `<i class="muted">${esc(t('dms.deleted'))}</i>` : m.verified === false ? `<i class="muted">${esc(t('dms.unverified'))}</i>` : m.kind === 'answer' && m.no ? `<i>${esc(t(m.dir === 'out' ? 'ask.no.out' : 'ask.no.in', { name }))}</i>` : m.kind === 'ask' && m.dir === 'in' ? esc(m.text || '') : callGone(m) ? esc(t(m.call === 'declined' ? 'lkcall.declined.mine' : 'lkcall.missed', { name })) : m.dir === 'in' ? withFriendEmojis(thread.id, em, () => linkify(m.text || '', thread)) : linkify(m.text || '', thread)}${m.deleted ? '' : Attach.shown(m, '', `/api/dms/contacts/${thread.id}/files`)}${!m.deleted && callGone(m) ? `<div class="dm-joinrow"><button type="button" class="dm-callback" onclick="dmCall(this.dataset.id, this.dataset.name)" data-id="${esc(thread.id)}" data-name="${esc(name)}">${esc(t('lkcall.callback'))}</button></div>` : m.kind === 'call' && m.dir === 'in' && !m.deleted && Call.fresh(m.at) ? `<div class="dm-joinrow"><button type="button" class="dm-joinbtn" onclick="dmCall(this.dataset.id, this.dataset.name)" data-id="${esc(thread.id)}" data-name="${esc(name)}">${esc(t('lkcall.join'))}</button></div>` : ''}</div>${m.deleted || m.verified === false ? '' : personChips(m, name) + lineActs(m.dir === 'out' && !m.kind)}</div>`).join('');
  }
  // Ask a mate (AIG-210): a question for someone's AI, and its answer, get a small tag over the bubble. A question
  // a friend sent me is shown as plain text (no links) until I deal with it in the inbox.
  function askTag(m, name) {
    if (m.kind === 'ask') return `<div class="dm-asktag">${esc(m.dir === 'out' ? t('ask.tag.out', { name }) : t('ask.tag.in'))} · <span class="muted">${esc(t((m.dir === 'out' ? 'ask.out.' : 'ask.in.') + (m.dir === 'out' && m.delayed && (m.state || 'waiting') === 'waiting' ? 'delayed' : m.state || 'waiting'), { name }))}</span></div>`;
    if (m.kind === 'answer' && !m.no) return `<div class="dm-asktag">${esc(m.dir === 'out' ? t('ask.tag.mine') : t('ask.tag.answer', { name }))}</div>`;
    return '';
  }
  async function loadPerson(scroll) {
    let msgs;
    try { msgs = await PagePoll.get(`/api/dms/contacts/${open.slice(3)}/messages`); } catch { return; }
    const list = el('dmList'); if (!list || !thread || thread.id !== open.slice(3)) return;
    thread.messages = msgs;
    ChatLive.see('dm:' + thread.id, msgs.map(m => ({ id: m.id || m.at, who: thread.name, text: m.text, mine: m.dir === 'out' })));   // AIG-1332
    const lastIn = msgs.filter(m => m.dir === 'in').map(m => m.at).sort().pop();
    if (lastIn && lastIn > dmSeen.get(thread.id)) dmSeen.set(thread.id, lastIn);
    // AIG-650: the pictures this friend sent, shown inline in their messages (only asked for when one could use a :name:)
    let em = [];
    if (msgs.some(m => m.dir === 'in' && /:[a-z0-9_]{1,32}:/.test(m.text || ''))) { try { em = await PagePoll.get(`/api/dms/contacts/${thread.id}/emojis`); } catch {} }
    if (!thread || thread.id !== open.slice(3)) return;
    const html = personHtml(msgs, thread.name, em) || `<p class="muted dm-empty">${esc(t('dms.nomsgperson', { name: thread.name }))}</p>`;
    paintTyping();
    if (list.dataset.sig !== html && !editing) {   // AIG-1164: a line being edited is not painted over
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.dataset.sig = html; list.innerHTML = html;
      if (scroll || atBottom) list.scrollTop = list.scrollHeight;
    }
    el('dmTo').textContent = t('dms.newperson', { name: thread.name });
    usageGlance(thread.id, thread.name);
  }
  // Token use this friend shares with me (AIG-686): per project, today and the last 7 days. Numbers only.
  async function usageGlance(id, name) {
    let g; try { g = await PagePoll.get(`/api/dms/contacts/${id}/usage`); } catch { return; }
    const box = el('dmUsage'); if (!box || !thread || thread.id !== id) return;
    const n = v => typeof fmtTok === 'function' ? fmtTok(v) : String(v);
    const html = g.projects.length ? `<div class="dm-usage-h" title="${esc(t('dms.usage.title', { name }))}"><b>${esc(t('dms.usage.h'))}</b> <span class="muted">${esc(t('dms.usage.when', { when: ago(g.at) }))}</span></div>`
      + g.projects.map(p => `<div class="dm-usage-row"><span>${esc(p.name)}</span> <span class="muted">${t('dms.usage.nums.html', { today: esc(n(p.today)), week: esc(n(p.week)) })}</span></div>`).join('') : '';
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = !html;
  }
  // AIG-1324: a friend's call nobody answered in the ring time (Missed call), or one I declined: a Call back button instead of Join
  const callGone = m => m.kind === 'call' && m.dir === 'in' && (m.call === 'declined' || Call.missed(m));
  async function loadThread(scroll) {
    if (open === '_allhands') { try { await loadAllHands(); } catch {} return; }
    if (!open) return;
    if (isTw(open)) return TwitchTab.load(scroll);
    if (isDc(open)) return DiscordTab.load(scroll);
    if (isPerson(open)) return loadPerson(scroll);
    const want = open, seq = ++threadSeq;   // a slower, older read never paints over a newer one (AIG-920 review)
    let got; try { got = await PagePoll.get(isGrp(want) ? '/api/chats/_groups/' + want.slice(4) : '/api/chats/' + want); } catch { return; }
    if (seq !== threadSeq || open !== want) return;
    thread = got;
    ChatLive.see('chat:' + want, (thread.messages || []).map(m => ({ id: m.id || m.at + '|' + m.author, who: m.author, text: m.text, mine: m.mine })));   // AIG-1332: read out once
    if (thread.assistant) { const hb = document.querySelector('#dmPanel .dm-head b'); if (hb && thread.lead && hb.textContent !== thread.lead) hb.textContent = thread.lead; }   // AIG-1036: the head was drawn from the rail list; the assistant picks its name later
    if (pendingSend) { const ps = pendingSend; pendingSend = null; if (ps.slug === want) setTimeout(() => send(ps.fixed), 0); }
    if (thread.group && thread.messages.length) dmSeen.set(want, thread.messages.at(-1).at);   // 👥 opening the group reads it
    const list = el('dmList'); if (!list) return;
    // A card that newly starts waiting on you opens by itself, and the typing box answers it.
    const fresh = thread.open.find(o => !waitingSeen.has(o.id));
    thread.open.forEach(o => waitingSeen.add(o.id));
    if (fresh && target !== GENERAL) fold = fresh.id;   // AIG-936: a new question opens in the chat, but the typing box stays a plain message
    const html = foldsHtml() || `<p class="muted dm-empty">${esc(t(thread.group ? 'grp.empty' : chats.some(x => x.slug === open && x.watchman) ? 'dms.nomsgs.watch' : 'dms.nomsgs'))}</p>`;
    paintTyping();
    // AIG-757: the card open in the chat can be answered too, not only cards waiting on you: a reply to a 💬 card the
    // lead had answered used to start a new card.
    const fc0 = (thread.cards || {})[fold];
    thread.answer = !thread.watchman && fc0 && !fc0.done && fc0.kind !== 'test' && fold !== '_lead' && !thread.open.some(o => o.id === fold) ? [...thread.open, { id: fold, title: fc0.title }] : thread.open;
    if (target !== GENERAL && !thread.answer.some(o => o.id === target)) target = GENERAL;   // AIG-936: the Lead chat itself unless you pick a card
    if (list.dataset.sig !== html && !editing) {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.dataset.sig = html; list.innerHTML = html;
      if (scroll || atBottom) list.scrollTop = list.scrollHeight;
    }
    // Which card the typing box answers: the one waiting on you, or pick when several are (AIG-157). The list also
    // offers a new message to the lead, about nothing waiting (AIG-285).
    const q = thread.answer.find(o => o.id === target);
    const to = thread.answer.length && !thread.watchman ? `${esc(t('dms.replyto'))} <select id="dmTarget" onchange="Dms.aim(this.value)">${thread.answer.map(o => `<option value="${esc(o.id)}" ${o.id === target ? 'selected' : ''}>${esc(o.id)} ${esc(o.title)}</option>`).join('')}<option value="${GENERAL}" ${target === GENERAL ? 'selected' : ''}>💬 ${esc(t('dms.newmsg', { lead: thread.lead }))}</option></select>`
      : thread.group ? esc(t('grp.to', { name: thread.lead })) : q ? t('dms.replying.html', { link: `<a href="#/p/${esc(thread.slug)}/${esc(q.id)}">${esc(q.id)}</a>`, title: esc(q.title) }) : esc(t('dms.newmsg', { lead: thread.lead }));
    if (el('dmTo').dataset.sig !== to && document.activeElement !== el('dmTarget')) { el('dmTo').dataset.sig = to; el('dmTo').innerHTML = to; }
    const qm = q && thread.messages.filter(m => m.card === q.id && !m.mine).pop();
    el('dmGo').hidden = !(qm && askActions(qm, (thread.cards || {})[q.id] && thread.cards[q.id].kind).some(a => a.say === 'GO'));   // AIG-936: Go only answers a Go? question
    // AIG-426: the lead carried on in another card; the card now open in the chat points the way.
    const fc = (thread.cards || {})[fold] || {}, fh = fc.followUp ? Follow.html('dm', thread.slug, fold, fc.followUp.id) : '';
    if (el('dmFollow') && el('dmFollow').dataset.sig !== fh) { el('dmFollow').dataset.sig = fh; el('dmFollow').innerHTML = fh; }
    paintSm();
  }

  // 🧭 Lead Scrum Master (AIG-359, AIG-476): in the team it is always on; here a switch for the 🌙 night watch (the same
  // setting as "Watchman ticks every project" in Setup) and the diligence scale. Not in the team: a link to add it.
  function paintSm() {
    const bar = el('smBar'), sm = thread && thread.sm; if (!bar || !sm) return;
    // The diligence scale (AIG-441): 1..5, on its own select; the same one is in Setup.
    const pick = `<select class="setup-theme" id="smPush" title="${esc(t('sm.push.title'))}" onchange="Dms.smPush(this.value)">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${sm.push === n ? 'selected' : ''}>${n} · ${esc(t('sm.push.' + n))}</option>`).join('')}</select>`;
    const sw = here() ? ` ${Swarm.btn(here(), 'smSwarm')}` : '';
    const html = (sm.on
      ? `<b>${esc(t('sm.on.push', { n: sm.everyMin, name: t('sm.push.' + sm.push) }))}</b> <span class="muted">${esc(t('sm.runs', { runs: sm.runsToday, cap: sm.cap }))}</span> ${pick}
        <button id="smNight" class="${sm.night ? 'primary' : ''}" onclick="Dms.smNight(${!sm.night})" title="${esc(t('sm.night.title'))}">${esc(t(sm.night ? 'sm.night.on' : 'sm.night.off'))}</button> <span class="muted">${esc(t('sm.night.what'))}</span>`
      : `<span class="muted" id="smOut">${esc(t('sm.out'))}</span> <a href="#/setup" id="smAdd">${esc(t('sm.out.add'))}</a>`) + sw;
    if (bar.dataset.sig !== html) { bar.dataset.sig = html; bar.innerHTML = html; }
  }
  async function smNight(on) { try { await api('POST', '/api/setup', { prefs: { watchAll: !!on } }); await loadThread(); } catch (e) { el('dmErr').textContent = e.message || String(e); } }
  async function smPush(v) { try { await api('POST', '/api/scrummaster/push', { level: +v }); await loadThread(); } catch (e) { el('dmErr').textContent = e.message || String(e); } }

  // 🧭 Scrum Master (no AI) (AIG-730/731): command buttons above the reply box. Typed `/sort`, `/new project`, `/move`, `/request` do the same;
  // plain code on the server (lib/smcmd.js), the current project is sent with each message.
  function smCmdsHtml() {
    const sorts = ['priority', 'age', 'type', 'who'].map(k => `<button type="button" data-smcmd="/sort ${k}" title="${esc(t('sm.noai.sort.title', { key: t('sm.noai.sort.' + k) }))}">${esc(t('sm.noai.sort.' + k))}</button>`).join('');
    return `<div class="actions sm-cmds" id="smCmds"><span class="muted">${esc(t('sm.noai.sort'))}</span>${sorts}
      <button type="button" data-smfill="/new project " title="${esc(t('sm.noai.new.title'))}">${esc(t('sm.noai.new'))}</button>
      <button type="button" data-smfill="/move AIG-" title="${esc(t('sm.noai.move.title'))}">${esc(t('sm.noai.move'))}</button>
      <button type="button" id="smRequest" onclick="Dms.requestForm()" title="${esc(t('sm.noai.request.title'))}">${esc(t('sm.noai.request'))}</button></div>`;
  }
  function requestForm() {
    openDialog(`<h2>${esc(t('sm.noai.req.h'))}</h2><p class="muted">${esc(t('sm.noai.req.help'))}</p>
      <label>${esc(t('sm.noai.req.name'))}<input id="smReqName" maxlength="80" autocomplete="off"></label>
      <label>${esc(t('sm.noai.req.why'))}<textarea id="smReqWhy" rows="3" maxlength="500"></textarea></label>
      <div class="err" id="smReqErr"></div>
      <div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button><button type="button" class="primary" id="smReqGo" onclick="Dms.requestSend()">${esc(t('sm.noai.req.go'))}</button></div>`);
    const n = el('smReqName'); if (n) n.focus();
  }
  async function requestSend() {
    const name = el('smReqName').value.trim(), why = el('smReqWhy').value.trim();
    if (!name || !why) { el('smReqErr').textContent = t('sm.noai.req.missing'); return; }
    try { await api('POST', '/api/chats/_watchman/request', { kind: 'server', name, why, project: here() }); closeDialog(); await loadThread(true); loadRail(); }
    catch (e) { el('smReqErr').textContent = e.message || String(e); }
  }

  async function loadAllHands() {
    const rows = await PagePoll.get('/api/chats/_allhands');
    const list = el('dmList'); if (open !== '_allhands' || !list) return;
    const html = rows.map(c => `<a class="dm-row" href="#/p/${esc(c.slug)}/${esc(c.id)}"><span class="dm-rowtext"><b>${esc(c.project)} · ${esc(c.title)}</b><span class="muted">${c.reply ? esc(c.reply.author) + ': ' + esc(c.reply.text || '') : esc(t('allhands.waiting'))} · ${ago(c.at)}</span></span></a>`).join('') || `<p class="muted dm-empty">${esc(t('allhands.none'))}</p>`;
    if (list.dataset.sig !== html) { list.dataset.sig = html; list.innerHTML = html; }
  }
  function showAllHands() {
    open = '_allhands'; listOpen = true; thread = { allhands: true }; askAll = false;
    const panel = el('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button><b>${esc(t('allhands.name'))}</b><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div class="dm-list" id="dmList"></div><div class="dm-compose"><div class="muted">${esc(t('allhands.help'))}</div>
      <textarea id="dmText" data-draft="dm/_allhands" rows="2" placeholder="${esc(t('dms.placeholder'))}" onkeydown="if(EnterSend.is(event,'chat')){event.preventDefault();Dms.askTeams(true)}"></textarea><div class="err" id="dmErr"></div>
      <div class="actions" id="allHandsAsk" hidden></div>
      <div class="actions" id="allHandsActs"><button id="allHandsSend" class="primary" onclick="Dms.send()" ${busy ? 'disabled' : ''}>${esc(t('dms.send'))}</button></div></div>`;
    panel.hidden = false; loadThread(); loadRail(); el('dmText').focus();
  }
  // AIG-943: Enter and the button first ask "Send to N teams?"; only Send in that question sends.
  const askTeams = on => { const a = el('allHandsAsk'), b = el('allHandsActs'); if (!a) return; if (on && !el('dmText').value.trim()) { el('dmErr').textContent = t('dms.empty'); return; } if (on) el('dmErr').textContent = ''; askAll = on; a.hidden = !on; b.hidden = on; if (on) { const n = projects.filter(x => !x.archived).length; a.innerHTML = `<b class="dm-askq" role="alert">${esc(t(n === 1 ? 'allhands.confirm.one' : 'allhands.confirm', { n }))}</b><button id="allHandsYes" class="primary" onclick="Dms.send()">${esc(t('dms.send'))}</button><button id="allHandsNo" onclick="Dms.askTeams(false)">${esc(t('common.cancel'))}</button>`; el('allHandsYes').focus(); } else el('dmText').focus(); };
  async function sendAllHands() {
    const ta = el('dmText'), err = el('dmErr'), btn = el('allHandsSend'), text = ta.value;
    if (!text.trim()) { err.textContent = t('dms.empty'); return; }
    if (!askAll) { err.textContent = ''; askTeams(true); return; }
    askTeams(false);
    busy = true; btn.disabled = true; err.textContent = '';
    try {
      await api('POST', '/api/allhands', { text });
      ta.value = ''; clearDraft('dm/_allhands');
      if (open === '_allhands') await loadAllHands();
      loadRail();
    } catch (e) { err.textContent = e.message || String(e); }
    finally { busy = false; btn.disabled = false; const current = el('allHandsSend'); if (current) current.disabled = false; }
  }

  function show(slug) {
    if (slug === '_allhands') return showAllHands();
    if (isTw(slug)) { open = slug; listOpen = true; thread = null; TwitchTab.show(slug); loadRail(); return; }
    if (isDc(slug)) { open = slug; listOpen = true; thread = null; DiscordTab.show(slug); loadRail(); return; }
    open = slug; listOpen = true; replyTo = null; editing = null;
    const who = isPerson(slug) ? people.find(x => 'dm:' + x.id === slug) || { id: slug.slice(3), name: t('dms.person') } : null;
    thread = who ? { person: true, id: who.id, slug, name: who.name, messages: [], open: [] } : null;
    const c = who ? { name: t('dms.person') } : chats.find(x => x.slug === slug) || (isGrp(slug) ? (g => ({ slug, name: g ? g.members.map(m => m.name + ' (' + m.engineLabel + ')').join(', ') : '', lead: g ? g.name : slug.slice(4), emoji: g && g.meeting ? '🎥' : '👥', group: true, meeting: g && g.meeting }))(groups.concat(meets).find(x => 'grp:' + x.id === slug)) : null) || (slug === '_assistant' ? { slug, name: paName || t('pa.name'), lead: paName || t('pa.name'), emoji: '💚', assistant: true } : { slug, name: slug });
    const panel = el('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button>${who ? personAv(who) : leadAv(c)}<div><b>${esc(who ? who.name : leadName(c) || t('dms.lead'))}</b><div class="muted">${esc(c.assistant ? t('pa.tagline') : chatName(c))}</div></div><span style="flex:1"></span>${c.meeting ? `<button type="button" class="dm-callbtn" id="dmMeetBtn" data-call="meet:${esc(c.meeting)}" data-label="${esc(t('meet.join'))}" onclick="Call.inCall(this.dataset.call) ? Call.mini(false) : meetingCall('${esc(c.meeting)}', this.dataset.name)" data-name="${esc(c.lead)}" title="${esc(t('meet.join.title'))}">${esc(t('meet.join'))}</button>` : ''}${who ? `<button type="button" class="dm-callbtn" id="dmCallBtn" data-call="dm:${esc(who.id)}" data-label="${esc(t('lkcall.btn'))}" onclick="Call.inCall(this.dataset.call) ? Call.mini(false) : dmCall('${esc(who.id)}', this.dataset.name)" data-name="${esc(who.name)}" title="${esc(t('lkcall.btn.title', { name: who.name }))}">${esc(t('lkcall.btn'))}</button>` : callLink(c.callUrl, 'dm-call')}${c.watchman ? `<button onclick="Dms.send('clear chat')" title="${esc(t('dms.clear'))}">🧹</button>` : ''}${windowTools('Dms.close()', popHere())}</div>
      ${c.watchman ? '<div class="sm-bar" id="smBar"></div>' : ''}${who ? '<div class="dm-usage" id="dmUsage" hidden></div>' : ''}
      <div class="dm-list" id="dmList"></div>
      <div id="dmFollow"></div>
      ${c.noAi ? smCmdsHtml() : ''}
      <div class="dm-typing muted" id="dmTyping" aria-live="polite"></div>
      <div class="dm-compose"><div class="dm-to muted" id="dmTo"></div>
        ${who || c.group ? '<div class="dm-replybar" id="dmReplyBar" hidden></div>' : ''}
        <textarea id="dmText" data-draft="dm/${esc(slug)}" rows="2" placeholder="${esc(t('dms.placeholder'))}" onkeydown="if(EnterSend.is(event,'${who ? 'dm' : 'chat'}')){event.preventDefault();Dms.send()}"></textarea>
        <div class="err" id="dmErr"></div>
        <div class="actions"><button class="good" id="dmGo" ${who ? `onclick="Dms.send('👍')" title="${esc(t('dms.like.title'))}">${esc(t('dms.like'))}` : `onclick="Dms.send('GO')" title="${esc(t('dms.go.title'))}">${esc(t('dms.go'))}`}</button><button class="primary" onclick="Dms.send()">${esc(t('dms.send'))}</button>${c.group ? '' : who ? `<button id="dmAsk" onclick="Dms.ask()" title="${esc(t('ask.btn.title', { name: who.name }))}">${esc(t('ask.btn', { name: who.name }))}</button>` : ''}${c.group ? '' : Attach.boxHtml('dm:' + slug)}</div></div>`;
    panel.hidden = false;
    if (typeof Call !== 'undefined') Call.sync();   // AIG-1394: already in this chat's call = "In the call", not Join call
    if (who) el('dmGo').hidden = false;
    loadRail(); loadThread(true);
    el('dmText').focus();
  }
  // Open a fold; if that card is waiting on you, the typing box answers it.
  function openFold(id) { fold = id; const c = thread && (thread.cards || {})[id]; if (id === '_lead') target = GENERAL; else if (thread && (thread.open.some(o => o.id === id) || (!thread.watchman && c && !c.done && c.kind !== 'test'))) target = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  // An answer button that needs a reason (AIG-176): aim the typing box at that card and start the reply.
  function reply(id, text) { aim(id); const ta = el('dmText'); if (ta) { if (text) ta.value = text; ta.focus(); ta.setSelectionRange(text.length, text.length); } }
  // Go to the card the lead carried on in (AIG-426): into its fold when it is in this chat, else to the card itself.
  async function follow(slug, id) {
    if (!thread || thread.slug !== slug) return;
    if (!(thread.cards || {})[id]) { try { thread = await PagePoll.get('/api/chats/' + slug); } catch {} }
    if ((thread.cards || {})[id]) { if (thread.open.some(o => o.id === id)) target = id; fold = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(true); }
    else location.hash = '#/p/' + slug + '/' + id;
  }
  // ⧉ Pop out (AIG-1313): Messages, or the chat that is open, in its own window (#/pop-chat[/<chat>]); the panel here closes.
  const inPop = () => !!(state.route && state.route.view === 'chat');
  const popHere = () => inPop() ? '' : popBtn('Dms.popOut()', 'id="dmPop"');
  function popSelf() {
    const k = open && open !== '_allhands' && !isTw(open) && !isDc(open) ? open : '';
    if (window.popOut('chat', '#/pop-chat' + (k ? '/' + encodeURIComponent(k) : ''), 'aigile-chat-' + (k || 'list').replace(/[^a-z0-9-]+/gi, '-'), 440, 720)) close();
  }
  // The pop window's page: the panel alone, filling the window. Drawn once; the 3 s poll keeps it live.
  let popped = false;
  async function popView(k) {
    document.body.classList.add('popchat');
    if (popped) return; popped = true;
    await loadRail();
    if (k) show(k); else { listOpen = true; paintList(); }
  }
  function reload() { return Promise.all([loadRail(), open ? loadThread() : null]); }
  function aim(id) { target = id; if (id !== GENERAL) fold = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  function back() { DiscordTab.stop(); TwitchTab.stop(); open = null; thread = null; el('dmPanel').dataset.sig = ''; paintList(); loadRail(); }
  function close() { if (inPop()) { window.close(); return; } DiscordTab.stop(); TwitchTab.stop(); open = null; thread = null; listOpen = false; const p = el('dmPanel'); p.hidden = true; p.innerHTML = ''; p.dataset.sig = ''; loadRail(); }

  let pendingSend = null;
  async function send(fixed) {
    if (!thread && open) { pendingSend = { slug: open, fixed }; return; }   // the chat is still loading: keep the text, send once it has loaded (loadThread)
    if (busy || !thread) return;
    if (thread.allhands) return sendAllHands();
    if (thread.person) return sendPerson(fixed);
    const key = 'dm:' + thread.slug, text = fixed || el('dmText').value.trim(), q = (thread.answer || thread.open).find(o => o.id === target);
    if (!text && !Attach.has(key)) { el('dmErr').textContent = t('dms.empty'); return; }
    busy = true; el('dmErr').textContent = '';
    try {
      const attachments = fixed || thread.group ? [] : await Attach.upload(key, thread.slug);
      if (thread.group) await api('POST', '/api/chats/_groups/' + thread.groupId, { text, ...(replyTo ? { reply: replyTo.id } : {}) });   // 👥 each member is woken once (AIG-1027)
      else if (thread.assistant) { const r = await api('POST', '/api/chats/_assistant', { text }); if (r && r.openDay && typeof MyDay !== 'undefined') MyDay.open(); }   // 💚 AIG-1021
      else if (thread.noAi) await api('POST', '/api/chats/_watchman', { text, project: here() });   // 🧭 no AI: plain code answers at once (AIG-729)
      else if (thread.watchman) {   // Send anyway (AIG-531): No Token Mode / budget refuse it, but it is the owner's call
        try { await api('POST', '/api/chats/_watchman', { text, attachments }); }
        catch (e) { if (/No Token Mode|budget/i.test(e.message || '') && confirm(e.message + ' ' + t('dms.sendanyway'))) await api('POST', '/api/chats/_watchman', { text, attachments, anyway: true }); else throw e; }
      }   // the watchman passes it on (AIG-221)
      else if (q && !(fold === '_lead' && target === GENERAL)) await api('POST', `/api/projects/${thread.slug}/cards/${q.id}/comments`, { author: me(), text, attachments });
      else { await api('POST', `/api/projects/${thread.slug}/leadchat`, { author: me(), text, attachments }); fold = '_lead'; }   // AIG-872: the one Lead chat, not a 💬 card per message
      if (!fixed) { el('dmText').value = ''; Attach.clear(key); clearDraft('dm/' + thread.slug); }
      if (thread.group) { replyTo = null; paintReplyBar(); }
      await loadThread(true); loadRail();
    } catch (e) { el('dmErr').textContent = e.message || String(e); }
    busy = false;
  }

  // A friend gets the text and any files sealed in one message (lib/dm.js).
  async function sendPerson(fixed) {
    const key = 'dm:' + thread.slug, text = fixed || el('dmText').value.trim();
    if (!text && !Attach.has(key)) { el('dmErr').textContent = t('dms.empty'); return; }
    busy = true; el('dmErr').textContent = '';
    try {
      const attachments = fixed ? [] : await Attach.read(key, thread.id);   // uploaded in pieces first (AIG-1165)
      await api('POST', `/api/dms/contacts/${thread.id}/messages`, { text, attachments, ...(replyTo ? { reply: replyTo.id } : {}) });
      if (!fixed) { el('dmText').value = ''; Attach.clear(key); clearDraft('dm/' + thread.slug); }
      replyTo = null; paintReplyBar(); typedAt = 0;
      await loadThread(true); loadRail();
    } catch (e) { el('dmErr').textContent = e.message || String(e); }
    busy = false;
  }

  // 🙋 Ask {name}'s AI (AIG-210): what's typed goes as a short question; they say yes or no before anything runs.
  const MAX_ASK = 1000;
  async function ask() {
    if (busy || !thread || !thread.person) return;
    const text = el('dmText').value.trim();
    if (!text) { el('dmErr').textContent = t('ask.empty'); el('dmText').focus(); return; }
    if (text.length > MAX_ASK) { el('dmErr').textContent = t('ask.long', { n: MAX_ASK }); return; }
    busy = true; el('dmErr').textContent = '';
    try {
      await api('POST', `/api/dms/contacts/${thread.id}/ask`, { text });
      el('dmText').value = ''; clearDraft('dm/' + thread.slug);
      await loadThread(true); loadRail();
    } catch (e) { el('dmErr').textContent = e.message || String(e); }
    busy = false;
  }

  // ⭐ Save on a friend's emoji (AIG-650): into my own list; a name clash asks for a new name.
  async function saveEmoji(cid, name) {
    let as = name;
    for (;;) {
      try {
        const l = await api('POST', `/api/dms/contacts/${cid}/emojis/${name}/save`, { as });
        setCustomEmojis(l); if (window.emojiMineSet) emojiMineSet(l);
        el('dmErr').textContent = t('emoji.save.done', { name: as }); const d = el('dmList'); if (d) d.dataset.sig = ''; loadThread();
        return;
      } catch (x) {
        if (x.status !== 409 && !/already/.test(x.message || '')) { el('dmErr').textContent = x.message || String(x); return; }
        const n = prompt(t('emoji.save.ask', { name: as }), as + '_2');
        if (n === null) return;
        as = n.trim().replace(/^:|:$/g, '');
        if (!/^[a-z0-9_]{1,32}$/.test(as)) { el('dmErr').textContent = t('emoji.err.name'); return; }
      }
    }
  }
  document.addEventListener('click', e => {
    const sc = e.target.closest('#smCmds [data-smcmd]');
    if (sc) { send(sc.dataset.smcmd); return; }
    const sf = e.target.closest('#smCmds [data-smfill]');
    if (sf) { const ta = el('dmText'); if (ta) { ta.value = sf.dataset.smfill; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
    const sv = e.target.closest('#dmPanel .cemoji-save');
    if (sv) { e.preventDefault(); saveEmoji(sv.dataset.ecid, sv.dataset.esave); return; }
    const dx = e.target.closest('#dmPanel [data-dmdraftx]');
    if (dx) { e.preventDefault(); clearDraft(dx.dataset.dmdraftx); paintList(); return; }
    const dd = e.target.closest('#dmPanel [data-dmdraft]');
    if (dd) { e.preventDefault(); const k = dd.dataset.dmdraft; if (k.startsWith('dm/')) show(k.slice(3)); else { const [s, id] = k.split('/'); location.hash = '#/p/' + s + '/' + id; close(); } return; }
    const xc = e.target.closest('#dmPanel [data-dmclose],#dmPanel [data-dmreopen]');   // AIG-917
    if (xc) { e.preventDefault(); const k = xc.dataset.dmclose || xc.dataset.dmreopen, shut = !!xc.dataset.dmclose; api('POST', '/api/dmclosed', { key: k, closed: shut }).then(() => { if (shut) closed[k] = new Date().toISOString(); else delete closed[k]; return loadRail(); }).then(paintList).catch(() => {}); return; }
    if (e.target.closest('#dmPanel [data-dmnewgroup]')) { newGroup(); return; }
    if (e.target.closest('#dmPanel [data-dmshowdone]')) { showDone = !showDone; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); return; }
    if (e.target.closest('#dmPanel [data-dmshowquiet]')) { showQuiet = !showQuiet; paintList(); return; }
    if (e.target.closest('#dmPanel [data-dmshowclosed]')) { showClosed = !showClosed; paintList(); return; }
    const fl = e.target.closest('#dmPanel [data-dmfilter]');
    if (fl) { filter = fl.dataset.dmfilter; try { localStorage.setItem('aigile.dmfilter', filter); } catch {} paintList(); return; }
    const go = e.target.closest('#dmRail [data-go]');
    if (go) { location.hash = go.dataset.go; setTimeout(loadRail, 50); return; }
    if (e.target.closest('#dmRail [data-dms]')) { if (listOpen || open) close(); else { listOpen = true; paintList(); loadRail(); } return; }
    const pk = e.target.closest('#dmPanel [data-pick]');
    if (pk) { const m = thread && thread.messages.at(-1); if (m && m.pick) send(m.pick[pk.dataset.pick].text); return; }
    // AIG-449: the card's own buttons, and its id link (which navigates and leaves the fold alone).
    const oc = e.target.closest('#dmPanel [data-opencard]');
    if (oc && thread) { location.hash = '#/p/' + thread.slug + '/' + oc.dataset.opencard; return; }
    const pc = e.target.closest('#dmPanel [data-popcard]');
    if (pc && thread) { const s = thread.slug, id = pc.dataset.popcard; popOut('card', '#/pop/' + s + '/' + id, 'aigile-' + s + '-' + id, 560, 780); return; }
    const f = e.target.closest('#dmPanel [data-fold]');
    if (f) { if (!e.target.closest('a')) openFold(f.dataset.fold); return; }
    const row = e.target.closest('#dmPanel [data-dm]');
    if (row) show(row.dataset.dm);
  });
  // The fold header is a div (it holds the id link), so Enter or Space opens it from the keyboard too (AIG-449).
  document.addEventListener('keydown', e => {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.target.closest('a')) return;
    const f = e.target.closest && e.target.closest('#dmPanel .dm-fold-h[data-fold]'); if (!f) return;
    e.preventDefault(); openFold(f.dataset.fold);
  });
  // AIG-1252: the search box filters as you type; Esc clears it, Enter opens the first chat, the arrow keys walk the rows.
  document.addEventListener('input', e => { if (e.target && e.target.id === 'dmSearch') { q = e.target.value; paintList(); } });
  document.addEventListener('keydown', e => {
    const box = e.target && e.target.closest && e.target.closest('#dmPanel'); if (!box || !el('dmSearch') || e.target.closest('#dmText')) return;
    const rows = [...box.querySelectorAll('.dm-list .dm-row[data-dm]')], i = rows.indexOf(document.activeElement);
    if (e.target.id === 'dmSearch') {
      if (e.key === 'Escape' && q) { e.preventDefault(); q = ''; e.target.value = ''; paintList(); }
      else if (e.key === 'Enter' && rows[0]) { e.preventDefault(); show(rows[0].dataset.dm); }
      else if (e.key === 'ArrowDown' && rows[0]) { e.preventDefault(); rows[0].focus(); }
    } else if (i >= 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault(); const n = rows[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) n.focus(); else if (e.key === 'ArrowUp') el('dmSearch').focus();
    }
  });
  window.addEventListener('hashchange', () => setTimeout(loadRail, 50));
  // Live: the rail every few seconds; an open chat a little more often.
  PagePoll.every(async () => { await loadRail(); if (open) await loadThread(); }, 3000);
  loadRail();
  return { popOut: popSelf, popView, follow, show, back, close, send, ask, askTeams, aim, reply, reload, smNight, smPush, requestForm, requestSend, newGroup, createGroup, grpFilter };
})();
