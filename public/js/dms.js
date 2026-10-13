/* ---------- the rail and DMs (AIG-137/138, AIG-147..149): Discord-style, apart from the work inbox ---------- */
// The rail down the left: Home, Inbox and 💬 DMs at the top, then each project as a "server" icon (its emoji
// and colour) with a red count of what needs you and a white pip for activity you haven't looked at. 💬 DMs
// opens the list of team leads; picking one opens the chat: the lead's messages left, yours right. The typing
// box answers the newest open question, or (when none is waiting) sends the lead a quick question card.
// Friends' private DMs (AIG-111, lib/dm.js) are chats too: the list has a filter All / Agents / People, and a
// friend's chat has the same typing box, 👍 and attachments. A friend's chat key is 'dm:<contact id>'.
const Dms = (() => {
  let projects = [], chats = [], people = [], filter = 'all', open = null, listOpen = false, thread = null, busy = false;
  let fold = null, target = null, waitingSeen = new Set();   // the card shown open in the chat, and the card the typing box answers (AIG-157)
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
  const isDc = k => String(k).startsWith('dc:');   // 💬 the Discord tab (AIG-557, discord-tab.js)
  const personAv = '<span class="dm-av">🙋</span>';
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
    try { [projects, chats] = await Promise.all([api('GET', '/api/projects'), api('GET', '/api/chats')]); } catch { return; }
    let boards = [];
    try { boards = (await api('GET', '/api/shares')).filter(l => l.theirRole && !l.forgotten && ['live', 'ended'].includes(l.state)); } catch {}
    try { people = (await api('GET', '/api/dms/contacts')).filter(c => !c.blocked).map(c => ({ ...c, unread: c.lastIn && c.lastIn > dmSeen.get(c.id) && open !== 'dm:' + c.id ? 1 : 0 })); } catch { people = []; }
    if (NoAi.on) chats = chats.filter(c => c.noAi);   // 🚫 no DMs to leads (AIG-581); only the 🧭 Scrum Master (no AI) stays (AIG-729)
    const cur = here(), p = projects.find(x => x.slug === cur);
    if (p) seen.set(cur, p.updated);   // looking at it now counts as seen
    const dmUnread = chats.reduce((n, c) => n + c.unread, 0) + people.reduce((n, c) => n + c.unread, 0) + DiscordTab.unread();
    const btn = (attrs, inner, on, title) => `<button class="dm-railbtn ${on ? 'on' : ''}" ${attrs} title="${esc(title)}">${inner}</button>`;
    const html = btn('data-go="#/"', '<span class="dm-av">🏠</span>', location.hash === '#/' || location.hash === '', t('dms.home'))
      + btn('data-go="#/inbox"', '<span class="dm-av">📥</span>' + badge(typeof IB !== 'undefined' ? (IB.items || []).length + IB.friends() : 0), location.hash === '#/inbox', t('dms.inbox'))
      + btn('data-dms="1"', '<span class="dm-av">💬</span>' + badge(dmUnread), listOpen || !!open, t('dms.rail.label'))
      + '<div class="dm-sep"></div>'
      + railTree(projects.filter(x => !x.archived), cur, btn)
      // AIG-324: each project a friend shares with me, as its own board.
      + (boards.length ? '<div class="dm-sep"></div>' + boards.map(l => btn(`data-go="#/shared/${esc(l.id)}" data-sboard="${esc(l.id)}"`, `<span class="dm-av">🔗</span>`, location.hash === '#/shared/' + l.id, t('sb.rail', { name: l.friend, project: l.theirName }))).join('') : '');
    const r = el('dmRail');
    if (r && r.dataset.sig !== html && !dragging) { r.dataset.sig = html; r.innerHTML = html; }
    if (listOpen && !open) paintList();
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

  // The DM list: one row per lead (🤖) and per friend (🙋), narrowed by the filter chips (All / Agents / People).
  function paintList() {
    if (filter === 'discord' && !DiscordTab.linked()) filter = 'all';
    if (filter === 'twitch' && !TwitchTab.linked()) filter = 'all';
    const rows = filter === 'twitch' ? TwitchTab.rowsHtml() : filter === 'discord' ? DiscordTab.rowsHtml() : (filter === 'people' ? [] : chats.map(c => `<button class="dm-row" data-dm="${esc(c.slug)}">${leadAv(c)}<span class="dm-rowtext"><b>${esc(leadName(c))}</b><span class="muted">${esc(chatName(c))}${c.last ? ' · ' + ago(c.last) : ''}</span></span>${badge(c.unread)}</button>`))
      .concat(filter === 'agents' ? [] : people.map(c => `<button class="dm-row" data-dm="dm:${esc(c.id)}">${personAv}<span class="dm-rowtext"><b>${esc(c.name)}</b><span class="muted">${esc(t('dms.person'))}${c.last ? ' · ' + ago(c.last) : ''}</span></span>${badge(c.unread)}</button>`));
    const none = filter === 'twitch' ? t('tw.nonone') : filter === 'discord' ? t('dc.nonone') : filter === 'people' ? t('dms.nopeople') : filter === 'agents' ? t('dms.noleads') : (chats.length || people.length) ? t('dms.nonone') : t('dms.noleads');
    const chips = ['all', 'agents', 'people', ...(DiscordTab.linked() ? ['discord'] : []), ...(TwitchTab.linked() ? ['twitch'] : [])].map(f => `<button class="dm-chip ${f === filter ? 'on' : ''}" data-dmfilter="${f}" aria-pressed="${f === filter}">${esc(t('dms.filter.' + f))}${f === 'discord' ? badge(DiscordTab.unread()) : ''}</button>`).join('');
    const html = `<div class="dm-head"><b>${esc(t('dms.title'))}</b><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div class="dm-filter" role="group" aria-label="${esc(t('dms.filter'))}">${chips}</div>
      <div class="dm-list"><button class="dm-row" data-dm="_allhands"><span class="dm-rowtext"><b>${esc(t('allhands.name'))}</b></span></button>${rows.join('') || `<p class="muted dm-empty">${esc(none)}</p>`}</div>`;
    const panel = el('dmPanel');
    if (panel.dataset.sig !== html) { panel.dataset.sig = html; panel.innerHTML = html; }
    panel.hidden = false;
  }

  // acts: answer buttons under the message (AIG-176), only on the latest one still waiting on you.
  const msgHtml = (m, acts = '') => `<div class="dm-msg ${m.mine ? 'mine' : ''}"><div class="dm-meta">${face(m.author, thread.team)}<b>${esc(m.author)}</b> ${ago(m.at)}</div><div class="dm-bubble">${linkify(m.text || '', thread)}${Attach.shown(m, thread.slug)}</div>${originHtml(m)}${acts}${pickHtml(m)}</div>`;
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
    const list = [...groups].sort((a, b) => a[1].at(-1).at.localeCompare(b[1].at(-1).at));
    if (!list.some(([id]) => id === fold)) fold = (target && groups.has(target) ? target : null) || (list.length ? list.at(-1)[0] : null);
    return list.map(([id, msgs]) => {
      const c = (thread.cards || {})[id] || {}, last = msgs.at(-1), isOpen = id === fold;
      const acts = c.waiting && !last.mine ? actionsHtml(askActions(last, c.kind), thread.slug, id) : '';
      const preview = String(last.text || '').replace(/^\s*[-*]\s+/gm, '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `<div class="dm-fold ${isOpen ? 'open' : ''} ${c.waiting ? 'waiting' : ''}">
        <div class="dm-fold-h k-${esc(c.kind || 'other')}" data-fold="${esc(id)}" role="button" tabindex="0" aria-expanded="${isOpen}">
          ${thread.watchman ? `<b>${esc(t('sm.fold'))}</b>` : `<span class="dm-tag">${esc(t('dms.kind.' + (c.kind || 'other')))}</span><a class="dm-fold-id" href="#/p/${esc(thread.slug)}/${esc(id)}" title="${esc(t('dms.opencard'))}"><b>${esc(id)}</b> <span class="dm-fold-t">${esc(c.title || last.title || '')}</span></a>`}
          <span class="muted dm-fold-n">${esc(t(msgs.length === 1 ? 'dms.count.one' : 'dms.count.many', { n: msgs.length }))} · ${ago(last.at)}</span></div>
        ${isOpen ? `<div class="dm-fold-b">${thread.watchman ? '' : `<div class="actions dm-cardacts"><button class="dm-opencard" data-opencard="${esc(id)}" title="${esc(t('dms.opencard'))}">${esc(t('dms.opencard'))}</button><button data-popcard="${esc(id)}" title="${esc(t('dms.popout.title'))}">${esc(t('dms.popout'))}</button></div>`}${msgs.map(m => msgHtml(m, m === last ? acts : '')).join('')}</div>`
          : `<div class="dm-fold-p muted"><b>${esc(last.author)}:</b> ${esc(preview)}</div>${acts}`}</div>`;
    }).join('');
  }
  // A friend's chat: plain bubbles, no cards or folds.
  function personHtml(msgs, name, em) {
    return msgs.map(m => `<div class="dm-msg ${m.dir === 'out' ? 'mine' : ''} ${m.kind ? 'dm-' + esc(m.kind) : ''}"><div class="dm-meta"><b>${esc(m.dir === 'out' ? me() : name)}</b> ${ago(m.at)}${m.status === 'failed' ? ' · ' + esc(m.reason || t('dms.failed')) : m.status === 'sending' ? ' · ' + esc(t('dms.sending')) : ''}</div>
      ${askTag(m, name)}<div class="dm-bubble">${m.verified === false ? `<i class="muted">${esc(t('dms.unverified'))}</i>` : m.kind === 'answer' && m.no ? `<i>${esc(t(m.dir === 'out' ? 'ask.no.out' : 'ask.no.in', { name }))}</i>` : m.kind === 'ask' && m.dir === 'in' ? esc(m.text || '') : m.dir === 'in' ? withFriendEmojis(thread.id, em, () => linkify(m.text || '', thread)) : linkify(m.text || '', thread)}${Attach.shown(m, '', `/api/dms/contacts/${thread.id}/files`)}</div></div>`).join('');
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
    try { msgs = await api('GET', `/api/dms/contacts/${open.slice(3)}/messages`); } catch { return; }
    const list = el('dmList'); if (!list || !thread || thread.id !== open.slice(3)) return;
    thread.messages = msgs;
    const lastIn = msgs.filter(m => m.dir === 'in').map(m => m.at).sort().pop();
    if (lastIn && lastIn > dmSeen.get(thread.id)) dmSeen.set(thread.id, lastIn);
    // AIG-650: the pictures this friend sent, shown inline in their messages (only asked for when one could use a :name:)
    let em = [];
    if (msgs.some(m => m.dir === 'in' && /:[a-z0-9_]{1,32}:/.test(m.text || ''))) { try { em = await api('GET', `/api/dms/contacts/${thread.id}/emojis`); } catch {} }
    if (!thread || thread.id !== open.slice(3)) return;
    const html = personHtml(msgs, thread.name, em) || `<p class="muted dm-empty">${esc(t('dms.nomsgperson', { name: thread.name }))}</p>`;
    if (list.dataset.sig !== html) {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.dataset.sig = html; list.innerHTML = html;
      if (scroll || atBottom) list.scrollTop = list.scrollHeight;
    }
    el('dmTo').textContent = t('dms.newperson', { name: thread.name });
    usageGlance(thread.id, thread.name);
  }
  // Token use this friend shares with me (AIG-686): per project, today and the last 7 days. Numbers only.
  async function usageGlance(id, name) {
    let g; try { g = await api('GET', `/api/dms/contacts/${id}/usage`); } catch { return; }
    const box = el('dmUsage'); if (!box || !thread || thread.id !== id) return;
    const n = v => typeof fmtTok === 'function' ? fmtTok(v) : String(v);
    const html = g.projects.length ? `<div class="dm-usage-h" title="${esc(t('dms.usage.title', { name }))}"><b>${esc(t('dms.usage.h'))}</b> <span class="muted">${esc(t('dms.usage.when', { when: ago(g.at) }))}</span></div>`
      + g.projects.map(p => `<div class="dm-usage-row"><span>${esc(p.name)}</span> <span class="muted">${t('dms.usage.nums.html', { today: esc(n(p.today)), week: esc(n(p.week)) })}</span></div>`).join('') : '';
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = !html;
  }
  async function loadThread(scroll) {
    if (open === '_allhands') { try { await loadAllHands(); } catch {} return; }
    if (!open) return;
    if (isTw(open)) return TwitchTab.load(scroll);
    if (isDc(open)) return DiscordTab.load(scroll);
    if (isPerson(open)) return loadPerson(scroll);
    try { thread = await api('GET', '/api/chats/' + open); } catch { return; }
    const list = el('dmList'); if (!list) return;
    // A card that newly starts waiting on you opens by itself, and the typing box answers it.
    const fresh = thread.open.find(o => !waitingSeen.has(o.id));
    thread.open.forEach(o => waitingSeen.add(o.id));
    if (fresh && target !== GENERAL) { target = fresh.id; fold = fresh.id; }
    const html = foldsHtml() || `<p class="muted dm-empty">${esc(t(chats.some(x => x.slug === open && x.watchman) ? 'dms.nomsgs.watch' : 'dms.nomsgs'))}</p>`;
    // AIG-757: the card open in the chat can be answered too, not only cards waiting on you: a reply to a 💬 card the
    // lead had answered used to start a new card.
    const fc0 = (thread.cards || {})[fold];
    thread.answer = !thread.watchman && fc0 && !fc0.done && fc0.kind !== 'test' && !thread.open.some(o => o.id === fold) ? [...thread.open, { id: fold, title: fc0.title }] : thread.open;
    if (target !== GENERAL && !thread.answer.some(o => o.id === target)) target = thread.open.length ? thread.open[0].id : thread.answer.length ? thread.answer[0].id : null;
    if (list.dataset.sig !== html) {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.dataset.sig = html; list.innerHTML = html;
      if (scroll || atBottom) list.scrollTop = list.scrollHeight;
    }
    // Which card the typing box answers: the one waiting on you, or pick when several are (AIG-157). The list also
    // offers a new message to the lead, about nothing waiting (AIG-285).
    const q = thread.answer.find(o => o.id === target);
    const to = thread.answer.length && !thread.watchman ? `${esc(t('dms.replyto'))} <select id="dmTarget" onchange="Dms.aim(this.value)">${thread.answer.map(o => `<option value="${esc(o.id)}" ${o.id === target ? 'selected' : ''}>${esc(o.id)} ${esc(o.title)}</option>`).join('')}<option value="${GENERAL}" ${target === GENERAL ? 'selected' : ''}>💬 ${esc(t('dms.newmsg', { lead: thread.lead }))}</option></select>`
      : q ? t('dms.replying.html', { link: `<a href="#/p/${esc(thread.slug)}/${esc(q.id)}">${esc(q.id)}</a>`, title: esc(q.title) }) : esc(t('dms.newmsg', { lead: thread.lead }));
    if (el('dmTo').dataset.sig !== to && document.activeElement !== el('dmTarget')) { el('dmTo').dataset.sig = to; el('dmTo').innerHTML = to; }
    el('dmGo').hidden = !q;
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
    const html = sm.on
      ? `<b>${esc(t('sm.on.push', { n: sm.everyMin, name: t('sm.push.' + sm.push) }))}</b> <span class="muted">${esc(t('sm.runs', { runs: sm.runsToday, cap: sm.cap }))}</span> ${pick}
        <button id="smNight" class="${sm.night ? 'primary' : ''}" onclick="Dms.smNight(${!sm.night})" title="${esc(t('sm.night.title'))}">${esc(t(sm.night ? 'sm.night.on' : 'sm.night.off'))}</button> <span class="muted">${esc(t('sm.night.what'))}</span>`
      : `<span class="muted" id="smOut">${esc(t('sm.out'))}</span> <a href="#/setup" id="smAdd">${esc(t('sm.out.add'))}</a>`;
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
    const rows = await api('GET', '/api/chats/_allhands');
    const list = el('dmList'); if (open !== '_allhands' || !list) return;
    const html = rows.map(c => `<a class="dm-row" href="#/p/${esc(c.slug)}/${esc(c.id)}"><span class="dm-rowtext"><b>${esc(c.project)} · ${esc(c.title)}</b><span class="muted">${c.reply ? esc(c.reply.author) + ': ' + esc(c.reply.text || '') : esc(t('allhands.waiting'))} · ${ago(c.at)}</span></span></a>`).join('') || `<p class="muted dm-empty">${esc(t('allhands.none'))}</p>`;
    if (list.dataset.sig !== html) { list.dataset.sig = html; list.innerHTML = html; }
  }
  function showAllHands() {
    open = '_allhands'; listOpen = true; thread = { allhands: true };
    const panel = el('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button><b>${esc(t('allhands.name'))}</b><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div class="dm-list" id="dmList"></div><div class="dm-compose"><div class="muted">${esc(t('allhands.help'))}</div>
      <textarea id="dmText" data-draft="dm/_allhands" rows="2" placeholder="${esc(t('dms.placeholder'))}"></textarea><div class="err" id="dmErr"></div>
      <div class="actions"><button id="allHandsSend" class="primary" onclick="Dms.send()" ${busy ? 'disabled' : ''}>${esc(t('dms.send'))}</button></div></div>`;
    panel.hidden = false; loadThread(); loadRail(); el('dmText').focus();
  }
  async function sendAllHands() {
    const ta = el('dmText'), err = el('dmErr'), btn = el('allHandsSend'), text = ta.value;
    if (!text.trim()) { err.textContent = t('dms.empty'); return; }
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
    open = slug; listOpen = true;
    const who = isPerson(slug) ? people.find(x => 'dm:' + x.id === slug) || { id: slug.slice(3), name: t('dms.person') } : null;
    thread = who ? { person: true, id: who.id, slug, name: who.name, messages: [], open: [] } : null;
    const c = who ? { name: t('dms.person') } : chats.find(x => x.slug === slug) || { slug, name: slug };
    const panel = el('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button>${who ? personAv : leadAv(c)}<div><b>${esc(who ? who.name : leadName(c) || t('dms.lead'))}</b><div class="muted">${esc(chatName(c))}</div></div><span style="flex:1"></span>${c.watchman ? `<button onclick="Dms.send('clear chat')" title="${esc(t('dms.clear'))}">🧹</button>` : ''}<button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      ${c.watchman ? '<div class="sm-bar" id="smBar"></div>' : ''}${who ? '<div class="dm-usage" id="dmUsage" hidden></div>' : ''}
      <div class="dm-list" id="dmList"></div>
      ${who || c.noAi ? '' : `<div class="dm-legend muted">${esc(t('dms.origin.legend'))}</div>`}
      <div id="dmFollow"></div>
      ${c.noAi ? smCmdsHtml() : ''}
      <div class="dm-compose"><div class="dm-to muted" id="dmTo"></div>
        <textarea id="dmText" data-draft="dm/${esc(slug)}" rows="2" placeholder="${esc(t('dms.placeholder'))}" onkeydown="if(EnterSend.is(event,'${who ? 'dm' : 'chat'}')){event.preventDefault();Dms.send()}"></textarea>
        <div class="err" id="dmErr"></div>
        <div class="actions"><button class="good" id="dmGo" ${who ? `onclick="Dms.send('👍')" title="${esc(t('dms.like.title'))}">${esc(t('dms.like'))}` : `onclick="Dms.send('GO')" title="${esc(t('dms.go.title'))}">${esc(t('dms.go'))}`}</button><button class="primary" onclick="Dms.send()">${esc(t('dms.send'))}</button>${who ? `<button id="dmAsk" onclick="Dms.ask()" title="${esc(t('ask.btn.title', { name: who.name }))}">${esc(t('ask.btn', { name: who.name }))}</button>` : ''}${Attach.boxHtml('dm:' + slug)}</div></div>`;
    panel.hidden = false;
    if (who) el('dmGo').hidden = false;
    loadRail(); loadThread(true);
    el('dmText').focus();
  }
  // Open a fold; if that card is waiting on you, the typing box answers it.
  function openFold(id) { fold = id; const c = thread && (thread.cards || {})[id]; if (thread && (thread.open.some(o => o.id === id) || (!thread.watchman && c && !c.done && c.kind !== 'test'))) target = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  // An answer button that needs a reason (AIG-176): aim the typing box at that card and start the reply.
  function reply(id, text) { aim(id); const ta = el('dmText'); if (ta) { if (text) ta.value = text; ta.focus(); ta.setSelectionRange(text.length, text.length); } }
  // Go to the card the lead carried on in (AIG-426): into its fold when it is in this chat, else to the card itself.
  async function follow(slug, id) {
    if (!thread || thread.slug !== slug) return;
    if (!(thread.cards || {})[id]) { try { thread = await api('GET', '/api/chats/' + slug); } catch {} }
    if ((thread.cards || {})[id]) { if (thread.open.some(o => o.id === id)) target = id; fold = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(true); }
    else location.hash = '#/p/' + slug + '/' + id;
  }
  function reload() { if (open) loadThread(); loadRail(); }
  function aim(id) { target = id; if (id !== GENERAL) fold = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  function back() { DiscordTab.stop(); TwitchTab.stop(); open = null; thread = null; el('dmPanel').dataset.sig = ''; paintList(); loadRail(); }
  function close() { DiscordTab.stop(); TwitchTab.stop(); open = null; thread = null; listOpen = false; const p = el('dmPanel'); p.hidden = true; p.innerHTML = ''; p.dataset.sig = ''; loadRail(); }

  async function send(fixed) {
    if (busy || !thread) return;
    if (thread.allhands) return sendAllHands();
    if (thread.person) return sendPerson(fixed);
    const key = 'dm:' + thread.slug, text = fixed || el('dmText').value.trim(), q = (thread.answer || thread.open).find(o => o.id === target);
    if (!text && !Attach.has(key)) { el('dmErr').textContent = t('dms.empty'); return; }
    busy = true; el('dmErr').textContent = '';
    try {
      const attachments = fixed ? [] : await Attach.upload(key, thread.slug);
      if (thread.noAi) await api('POST', '/api/chats/_watchman', { text, project: here() });   // 🧭 no AI: plain code answers at once (AIG-729)
      else if (thread.watchman) {   // Send anyway (AIG-531): No Token Mode / budget refuse it, but it is the owner's call
        try { await api('POST', '/api/chats/_watchman', { text, attachments }); }
        catch (e) { if (/No Token Mode|budget/i.test(e.message || '') && confirm(e.message + ' ' + t('dms.sendanyway'))) await api('POST', '/api/chats/_watchman', { text, attachments, anyway: true }); else throw e; }
      }   // the watchman passes it on (AIG-221)
      else if (q) await api('POST', `/api/projects/${thread.slug}/cards/${q.id}/comments`, { author: me(), text, attachments });
      else { const c = await api('POST', `/api/projects/${thread.slug}/cards`, { title: '💬 ' + text.split('\n')[0].slice(0, 80), description: text, type: 'task', status: 'team', createdBy: me(), quick: true, attachments });
        if (c && c.id) { fold = c.id; target = c.id; } }   // AIG-757: the next message carries on in the new card
      if (!fixed) { el('dmText').value = ''; Attach.clear(key); clearDraft('dm/' + thread.slug); }
      if (target === GENERAL) target = null;   // sent: back to answering what waits on you
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
      const attachments = fixed ? [] : await Attach.read(key);
      await api('POST', `/api/dms/contacts/${thread.id}/messages`, { text, attachments });
      if (!fixed) { el('dmText').value = ''; Attach.clear(key); clearDraft('dm/' + thread.slug); }
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
  window.addEventListener('hashchange', () => setTimeout(loadRail, 50));
  // Live: the rail every few seconds; an open chat a little more often.
  setInterval(() => { if (!document.hidden) { loadRail(); if (open) loadThread(); } }, 3000);
  loadRail();
  return { follow, show, back, close, send, ask, aim, reply, reload, smNight, smPush, requestForm, requestSend };
})();
