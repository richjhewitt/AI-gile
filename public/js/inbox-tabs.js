// AI-gile inbox: project tabs (AIG-37) and the Messages chats (AIG-87).
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
(function () {
  'use strict';
  const { el, esc, isTask, isQuestion, isTest, lastAsk } = IB;
  /* ---------- project tabs (AIG-37): All + one per project with something waiting; remembers the last tab ---------- */
  function tabCounts(list) {
    const q = list.filter(isQuestion).length, k = list.filter(isTask).length, t = list.filter(isTest).length;
    return `${q ? `<span class="tq">❓${q}</span>` : ''}${k ? `<span class="tk">📋${k}</span>` : ''}${t ? `<span class="tt">🧪${t}</span>` : ''}`;
  }
  function mostRecentMessageTime(projectSlug) {
    const projectItems = IB.items.filter(c => c.project === projectSlug);
    let latest = null;
    for (const item of projectItems) {
      if (item.comments && item.comments.length > 0) {
        for (const comment of item.comments) {
          if (!latest || comment.at > latest) latest = comment.at;
        }
      }
      if (!latest || item.updated > latest) latest = item.updated;
    }
    return latest || new Date(0).toISOString();
  }
  function paintTabs() {
    // Opened from a project page: that project first (selected once, on arrival) and All last, for the
    // whole visit. Other projects are ordered by their most recent message, newest first.
    const rankOf = p => { const c = IB.items.find(x => x.project === p); return c && c.projectRank != null ? c.projectRank : 1e6; };
    const projects = [...new Map(IB.items.map(c => [c.project, c.projectName])).entries()]
      .sort((a, b) => rankOf(a[0]) - rankOf(b[0]) || mostRecentMessageTime(b[0]).localeCompare(mostRecentMessageTime(a[0])));   // your order (AIG-189)
    const pinned = IB.fromProject && projects.find(([p]) => p === IB.fromProject);
    if (pinned && IB.selectPinned && !IB.only) IB.tab = IB.fromProject;   // a top bar chip counts every project: it keeps All (AIG-293)
    IB.selectPinned = false;
    const orderedProjects = pinned ? [pinned, ...projects.filter(([p]) => p !== IB.fromProject)] : projects;
    const allAtEnd = !!pinned;
    if (IB.tab !== 'all' && !orderedProjects.some(([p]) => p === IB.tab)) IB.tab = 'all';   // that project's inbox emptied
    const lookOf = p => IB.items.find(c => c.project === p) || {};
    const btn = (key, name, list) => { const l = key === 'all' ? {} : lookOf(key);
      return `<button class="ib-tab ${IB.tab === key ? 'on' : ''}" data-tab="${esc(key)}" role="tab" aria-selected="${IB.tab === key}" title="${esc(name)}"${l.projectColor ? ` style="--proj:${esc(l.projectColor)}"` : ''}>${l.projectLogo || l.projectEmoji ? pic(l.projectLogo, l.projectEmoji) + ' ' : ''}<span class="nm">${esc(name)}</span> <span class="n">${list.length}</span> ${tabCounts(list)}</button>`; };
    IB.tabOrder = orderedProjects.map(([p]) => p);
    const projectBtns = orderedProjects.map(([p, name]) => btn(p, name, IB.items.filter(c => c.project === p))).join('');
    const html = allAtEnd
      ? projectBtns + btn('all', t('inbox.all'), IB.items)  // "All" at the end when showing a project first
      : btn('all', t('inbox.all'), IB.items) + projectBtns;  // "All" at the beginning otherwise
    const box = el('ibTabs');
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = orderedProjects.length < 2;
  }

  /* ---------- messages (AIG-87): questions as DMs, one chat per project lead ---------- */
  // Left: a chat per project with questions (newest message first). Right: that chat's questions as bubbles,
  // oldest at the top and newest at the bottom, each with 👍 Go and a reply box (the usual question item).
  function paintChats(qs) {
    const chats = [...new Map(qs.map(c => [c.project, c])).keys()]
      .map(p => { const list = qs.filter(c => c.project === p); return { p, list, last: list.reduce((m, c) => lastAsk(c).at > m ? lastAsk(c).at : m, '') }; })
      .sort((a, b) => b.last.localeCompare(a.last));
    if (!chats.some(x => x.p === IB.chat)) IB.chat = chats.length ? chats[0].p : null;
    const html = chats.map(({ p, list, last }) => {
      const c = list[0], who = lastAsk(list.find(x => lastAsk(x).at === last) || c).author;
      return `<button class="ib-chatbtn ${p === IB.chat ? 'on' : ''}" data-chat="${esc(p)}" style="--proj:${esc(c.projectColor || '')}">
        <span class="av">${pic(c.projectLogo, c.projectEmoji || '💬')}</span><span class="nm"><b>${esc(c.projectName)}</b><span class="ib-hint">${esc(who)} · ${ago(last)}</span></span><span class="ib-badge q">${list.length}</span></button>`;
    }).join('');
    const box = el('ibChats');
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = chats.length < 2;
    IB.syncList(el('ibQ').querySelector('.list'), qs.filter(c => c.project === IB.chat).sort((a, b) => lastAsk(a).at.localeCompare(lastAsk(b).at)));
  }
  Object.assign(IB, { paintTabs, paintChats });
})();
