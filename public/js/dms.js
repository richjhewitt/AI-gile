/* ---------- the rail and DMs (AIG-137/138, AIG-147..149): Discord-style, apart from the work inbox ---------- */
// The rail down the left: Home, Inbox and 💬 DMs at the top, then each project as a "server" icon (its emoji
// and colour) with a red count of what needs you and a white pip for activity you haven't looked at. 💬 DMs
// opens the list of team leads; picking one opens the chat: the lead's messages left, yours right. The typing
// box answers the newest open question, or (when none is waiting) sends the lead a quick question card.
const Dms = (() => {
  let projects = [], chats = [], open = null, listOpen = false, thread = null, busy = false;
  let fold = null, target = null, waitingSeen = new Set();   // the card shown open in the chat, and the card the typing box answers (AIG-157)
  const el = id => document.getElementById(id);
  const avatar = c => `<span class="dm-av" style="--proj:${esc(c.color || '')}">${esc(c.emoji || '💬')}</span>`;
  const badge = n => n ? `<span class="dm-unread">${n > 99 ? '99+' : n}</span>` : '';
  // "Seen" per project: the project's last update when you last opened its board (this browser only).
  const seen = { get: s => { try { return localStorage.getItem('aigile.seen.' + s) || ''; } catch { return ''; } }, set: (s, v) => { try { localStorage.setItem('aigile.seen.' + s, v); } catch {} } };
  const here = () => (location.hash.match(/^#\/p\/([^/]+)/) || [])[1] || '';

  async function loadRail() {
    if (!i18n.ready) return void setTimeout(loadRail, 100);
    try { [projects, chats] = await Promise.all([api('GET', '/api/projects'), api('GET', '/api/chats')]); } catch { return; }
    const cur = here(), p = projects.find(x => x.slug === cur);
    if (p) seen.set(cur, p.updated);   // looking at it now counts as seen
    const dmUnread = chats.reduce((n, c) => n + c.unread, 0);
    const btn = (attrs, inner, on, title) => `<button class="dm-railbtn ${on ? 'on' : ''}" ${attrs} title="${esc(title)}">${inner}</button>`;
    const html = btn('data-go="#/"', '<span class="dm-av">🏠</span>', location.hash === '#/' || location.hash === '', t('dms.home'))
      + btn('data-go="#/inbox"', '<span class="dm-av">📥</span>', location.hash === '#/inbox', t('dms.inbox'))
      + btn('data-dms="1"', '<span class="dm-av">💬</span>' + badge(dmUnread), listOpen || !!open, t('dms.rail.label'))
      + '<div class="dm-sep"></div>'
      + projects.filter(x => !x.archived).map(x => btn(`data-go="#/p/${esc(x.slug)}"`, avatar(x) + badge(x.needsYou) + (x.updated > seen.get(x.slug) && x.slug !== cur && !x.needsYou ? '<span class="dm-pip"></span>' : ''),
        x.slug === cur, x.name + (x.needsYou ? ' · ' + t('dms.waiting', { n: x.needsYou }) : ''))).join('');
    const r = el('dmRail');
    if (r && r.dataset.sig !== html) { r.dataset.sig = html; r.innerHTML = html; }
    if (listOpen && !open) paintList();
  }

  // The DM list: one row per lead, newest first.
  function paintList() {
    const html = `<div class="dm-head"><b>${esc(t('dms.title'))}</b><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div class="dm-list">${chats.map(c => `<button class="dm-row" data-dm="${esc(c.slug)}">${avatar(c)}<span class="dm-rowtext"><b>${esc(c.lead)}</b><span class="muted">${esc(c.name)}${c.last ? ' · ' + ago(c.last) : ''}</span></span>${badge(c.unread)}</button>`).join('') || `<p class="muted dm-empty">${esc(t('dms.noleads'))}</p>`}</div>`;
    const panel = el('dmPanel');
    if (panel.dataset.sig !== html) { panel.dataset.sig = html; panel.innerHTML = html; }
    panel.hidden = false;
  }

  const msgHtml = m => `<div class="dm-msg ${m.mine ? 'mine' : ''}"><div class="dm-meta"><b>${esc(m.author)}</b> ${ago(m.at)}</div><div class="dm-bubble">${linkify(m.text || '', thread)}${Attach.shown(m, thread.slug)}</div></div>`;
  // One fold per card (AIG-157): a clear header (kind, id, title); only one fold open at a time, the rest show
  // one line with the latest message, so each card can be dealt with on its own.
  function foldsHtml() {
    const groups = new Map();
    for (const m of thread.messages) { if (!groups.has(m.card)) groups.set(m.card, []); groups.get(m.card).push(m); }
    const list = [...groups].sort((a, b) => a[1].at(-1).at.localeCompare(b[1].at(-1).at));
    if (!list.some(([id]) => id === fold)) fold = (target && groups.has(target) ? target : null) || (list.length ? list.at(-1)[0] : null);
    return list.map(([id, msgs]) => {
      const c = (thread.cards || {})[id] || {}, last = msgs.at(-1), isOpen = id === fold;
      const preview = String(last.text || '').replace(/^\s*[-*]\s+/gm, '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `<div class="dm-fold ${isOpen ? 'open' : ''} ${c.waiting ? 'waiting' : ''}">
        <button class="dm-fold-h k-${esc(c.kind || 'other')}" data-fold="${esc(id)}" aria-expanded="${isOpen}">
          <span class="dm-tag">${esc(t('dms.kind.' + (c.kind || 'other')))}</span><b>${esc(id)}</b> <span class="dm-fold-t">${esc(c.title || last.title || '')}</span>
          <span class="muted dm-fold-n">${esc(t(msgs.length === 1 ? 'dms.count.one' : 'dms.count.many', { n: msgs.length }))} · ${ago(last.at)}</span></button>
        ${isOpen ? `<div class="dm-fold-b"><a class="muted dm-cardlink" href="#/p/${esc(thread.slug)}/${esc(id)}">${esc(t('dms.opencard'))}</a>${msgs.map(msgHtml).join('')}</div>`
          : `<div class="dm-fold-p muted"><b>${esc(last.author)}:</b> ${esc(preview)}</div>`}</div>`;
    }).join('');
  }
  async function loadThread(scroll) {
    if (!open) return;
    try { thread = await api('GET', '/api/chats/' + open); } catch { return; }
    const list = el('dmList'); if (!list) return;
    // A card that newly starts waiting on you opens by itself, and the typing box answers it.
    const fresh = thread.open.find(o => !waitingSeen.has(o.id));
    thread.open.forEach(o => waitingSeen.add(o.id));
    if (fresh) { target = fresh.id; fold = fresh.id; }
    if (!thread.open.some(o => o.id === target)) target = thread.open.length ? thread.open[0].id : null;
    const html = foldsHtml() || `<p class="muted dm-empty">${esc(t('dms.nomsgs'))}</p>`;
    if (list.dataset.sig !== html) {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.dataset.sig = html; list.innerHTML = html;
      if (scroll || atBottom) list.scrollTop = list.scrollHeight;
    }
    // Which card the typing box answers: the one waiting on you, or pick when several are (AIG-157).
    const q = thread.open.find(o => o.id === target);
    const to = thread.open.length > 1 ? `${esc(t('dms.replyto'))} <select id="dmTarget" onchange="Dms.aim(this.value)">${thread.open.map(o => `<option value="${esc(o.id)}" ${o.id === target ? 'selected' : ''}>${esc(o.id)} ${esc(o.title)}</option>`).join('')}</select>`
      : q ? t('dms.replying.html', { link: `<a href="#/p/${esc(thread.slug)}/${esc(q.id)}">${esc(q.id)}</a>`, title: esc(q.title) }) : esc(t('dms.newmsg', { lead: thread.lead }));
    if (el('dmTo').dataset.sig !== to && document.activeElement !== el('dmTarget')) { el('dmTo').dataset.sig = to; el('dmTo').innerHTML = to; }
    el('dmGo').hidden = !q;
  }

  function show(slug) {
    open = slug; listOpen = true;
    const c = chats.find(x => x.slug === slug) || { slug, name: slug };
    const panel = el('dmPanel'); panel.dataset.sig = '';
    panel.innerHTML = `<div class="dm-head"><button onclick="Dms.back()" title="${esc(t('dms.all'))}">‹</button>${avatar(c)}<div><b>${esc(c.lead || t('dms.lead'))}</b><div class="muted">${esc(c.name)}</div></div><span style="flex:1"></span><button onclick="Dms.close()" title="${esc(t('common.close'))}">✕</button></div>
      <div class="dm-list" id="dmList"></div>
      <div class="dm-compose"><div class="dm-to muted" id="dmTo"></div>
        <textarea id="dmText" rows="2" placeholder="${esc(t('dms.placeholder'))}" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();Dms.send()}"></textarea>
        <div class="err" id="dmErr"></div>
        <div class="actions"><button class="good" id="dmGo" onclick="Dms.send('GO')" title="${esc(t('dms.go.title'))}">${esc(t('dms.go'))}</button><button class="primary" onclick="Dms.send()">${esc(t('dms.send'))}</button>${Attach.boxHtml('dm:' + slug)}</div></div>`;
    panel.hidden = false;
    loadRail(); loadThread(true);
    el('dmText').focus();
  }
  // Open a fold; if that card is waiting on you, the typing box answers it.
  function openFold(id) { fold = id; if (thread && thread.open.some(o => o.id === id)) target = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  function aim(id) { target = id; fold = id; const l = el('dmList'); if (l) l.dataset.sig = ''; loadThread(); }
  function back() { open = null; thread = null; el('dmPanel').dataset.sig = ''; paintList(); loadRail(); }
  function close() { open = null; thread = null; listOpen = false; const p = el('dmPanel'); p.hidden = true; p.innerHTML = ''; p.dataset.sig = ''; loadRail(); }

  async function send(fixed) {
    if (busy || !thread) return;
    const key = 'dm:' + thread.slug, text = fixed || el('dmText').value.trim(), q = thread.open.find(o => o.id === target);
    if (!text && !Attach.has(key)) { el('dmErr').textContent = t('dms.empty'); return; }
    busy = true; el('dmErr').textContent = '';
    try {
      const attachments = fixed ? [] : await Attach.upload(key, thread.slug);
      if (q) await api('POST', `/api/projects/${thread.slug}/cards/${q.id}/comments`, { author: me(), text, attachments });
      else await api('POST', `/api/projects/${thread.slug}/cards`, { title: '💬 ' + text.split('\n')[0].slice(0, 80), description: text, type: 'task', status: 'team', createdBy: me(), quick: true, attachments });
      if (!fixed) { el('dmText').value = ''; Attach.clear(key); }
      await loadThread(true); loadRail();
    } catch (e) { el('dmErr').textContent = e.message || String(e); }
    busy = false;
  }

  document.addEventListener('click', e => {
    const go = e.target.closest('#dmRail [data-go]');
    if (go) { location.hash = go.dataset.go; setTimeout(loadRail, 50); return; }
    if (e.target.closest('#dmRail [data-dms]')) { if (listOpen || open) close(); else { listOpen = true; paintList(); loadRail(); } return; }
    const f = e.target.closest('#dmPanel [data-fold]');
    if (f) { openFold(f.dataset.fold); return; }
    const row = e.target.closest('#dmPanel [data-dm]');
    if (row) show(row.dataset.dm);
  });
  window.addEventListener('hashchange', () => setTimeout(loadRail, 50));
  // Live: the rail every few seconds; an open chat a little more often.
  setInterval(() => { if (!document.hidden) { loadRail(); if (open) loadThread(); } }, 3000);
  loadRail();
  return { show, back, close, send, aim };
})();
