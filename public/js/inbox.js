// AI-gile inbox: top-bar button, #/inbox page, and new-question alerts.
// Self-contained (no dependencies). Loaded before the main scripts in index.html.
// Needs from the page: state, $, api (all top-level in js/core.js), a <header> with #live.
/* ---------- module ---------- */
(function () {
  'use strict';

  /* ---------- styles: js/inbox-style.js (INBOX_CSS) ---------- */
  const style = document.createElement('style');
  style.textContent = INBOX_CSS;
  document.head.appendChild(style);

  /* ---------- helpers ---------- */
  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ago() and t() are the page's (js/core.js, js/i18n.js); they are only called after everything has loaded.
  const post = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  };
  // Server sends three kinds: tasks (assigned to Rich: something only he can do), questions, and verify cards.
  const isTask = c => String(c.assignee || '').trim().toLowerCase() === 'rich';
  const isQuestion = c => !isTask(c) && c.status !== 'verify';
  const isTest = c => !isTask(c) && c.status === 'verify';
  const kindOf = c => isTask(c) ? 'k' : isQuestion(c) ? 'q' : 't';
  const lastAsk = c => [...(c.comments || [])].reverse().find(m => String(m.author).trim().toLowerCase() !== 'rich')
    || { author: c.assignee || 'The team', at: c.updated, text: c.description || c.title };
  const keyOf = c => c.project + '/' + c.id;
  // Escape, then link web addresses and card ids (e.g. AIG-12) in the same project.
  const linkify = (text, c) => withCode(text, t => mdLinks(esc(t)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener" style="text-decoration:underline">${u}</a>`)
    .replace(/(^|[^\w/#-])([A-Z]{1,6}-\d+)\b/g, (m, pre, id) => `${pre}<a href="#/p/${c.project}/${id}" style="text-decoration:underline">${id}</a>`), c.project), c.project);

  const pref = {
    get() { try { return localStorage.getItem('aigile.alerts') === '1'; } catch { return false; } },
    set(on) { try { localStorage.setItem('aigile.alerts', on ? '1' : '0'); } catch {} },
  };
  const canNotify = () => typeof Notification !== 'undefined';
  const alertsOn = () => canNotify() && Notification.permission === 'granted' && pref.get();

  /* ---------- state ---------- */
  let items = [], raw = [], hidden = 0, loaded = false, inflight = null, seen = new Set(), flashKey = null;
  const baseTitle = document.title || 'AI-gile';

  /* ---------- data ---------- */
  function load() {
    if (inflight) return inflight;
    inflight = fetch('/api/inbox', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then(list => { inflight = null; apply(list); return true; })
      .catch(e => { inflight = null; throw e; });
    return inflight;
  }
  // Going quiet (night mode): no tests or tasks, and only the 3 newest questions.
  const isQuiet = () => document.documentElement.hasAttribute('data-night');
  function view() {
    if (!isQuiet()) { hidden = 0; return raw; }
    const all = raw.filter(isQuestion);
    const qs = all.slice().sort((a, b) => lastAsk(b).at.localeCompare(lastAsk(a).at)).slice(0, 3);
    hidden = all.length - qs.length;
    return raw.filter(c => qs.includes(c));
  }
  function apply(list) {
    if (typeof i18n === 'undefined' || !i18n.ready) { setTimeout(() => load().catch(() => {}), 100); return; }   // wait for the language file (AIG-124)
    raw = list;
    items = view();
    const qs = items.filter(c => !isTest(c));   // questions and tasks both alert (only those shown)
    // New questions only: never on the first load. A fresh question on the same card counts as new.
    const key = c => keyOf(c) + '@' + lastAsk(c).at;
    if (loaded) {
      const fresh = qs.filter(c => !seen.has(key(c)));
      if (fresh.length) announce(fresh);
    }
    seen = new Set(raw.filter(c => !isTest(c)).map(key));   // hidden ones are not new when quiet ends
    loaded = true;
    paintTop();
    if (onInboxPage()) paintPage();
  }
  function repaint() { if (!loaded) return; items = view(); paintTop(); if (onInboxPage() && el('ib')) paintPage(); }

  /* ---------- top bar (AIG-32, AIG-34) ---------- */
  function slot() {
    let s = el('inboxTop');
    if (!s) {   // fallback if the page has no container
      s = document.createElement('span'); s.id = 'inboxTop';
      const live = el('live'); live.parentNode.insertBefore(s, live);
    }
    return s;
  }
  const onInboxPage = () => location.hash === '#/inbox';
  function counts() {
    return { q: items.filter(isQuestion).length, k: items.filter(isTask).length, t: items.filter(isTest).length };
  }
  function paintTop() {
    const { q, k, t: te } = counts();   // te: a local `t` would hide the t() text function
    const label = (q ? t(q === 1 ? 'inbox.sum.q.one' : 'inbox.sum.q.many', { n: q }) : '') + (k ? t(k === 1 ? 'inbox.sum.k.one' : 'inbox.sum.k.many', { n: k }) : '') + (te ? t('inbox.sum.t', { n: te }) : '') || t('inbox.sum.none');
    let alertBtn = '';
    if (canNotify()) {
      const on = alertsOn(), blocked = Notification.permission === 'denied';
      alertBtn = `<button class="ib-alerts ${on ? 'on' : ''}" id="ibAlerts" title="${esc(blocked ? t('inbox.alerts.blocked.title') : on ? t('inbox.alerts.off.title') : t('inbox.alerts.on.title'))}" ${blocked ? 'disabled' : ''}>${esc(blocked ? t('inbox.alerts.blocked') : on ? t('inbox.alerts.on') : t('inbox.alerts.turnon'))}</button>`;
    }
    const html = `<a class="ib-btn ${onInboxPage() ? 'on' : ''}" href="#/inbox" aria-label="${esc(t('inbox.btn.aria', { label }))}" title="${esc(label)}">${esc(t('inbox.btn'))}
        ${q ? `<span class="ib-badge q" data-only="q">${esc(t(q === 1 ? 'inbox.badge.q.one' : 'inbox.badge.q.many', { n: q }))}</span>` : ''}
        ${k ? `<span class="ib-badge k" data-only="k">${esc(t('inbox.badge.k', { n: k }))}</span>` : ''}
        ${te ? `<span class="ib-badge t" data-only="t">${esc(t('inbox.badge.t', { n: te }))}</span>` : ''}</a>${alertBtn}`;
    const s = slot();
    if (s.dataset.sig !== html) {
      s.dataset.sig = html; s.innerHTML = html;
      // A chip shows only that kind (AIG-187); the Inbox word itself shows everything.
      s.querySelector('.ib-btn').onclick = e => { const b = e.target.closest('[data-only]'); only = b ? b.dataset.only : ''; if (el('ib')) paintPage(); };
      const b = el('ibAlerts'); if (b) b.onclick = toggleAlerts;
    }
    // Everything waiting on Rich; the desktop app turns this count into its taskbar badge (AIG-76).
    const title = q + k + te ? `(${q + k + te}) ${baseTitle}` : baseTitle;
    if (document.title !== title) document.title = title;
  }

  /* ---------- alerts (AIG-35) ---------- */
  let audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      [[660, 0], [880, 0.16]].forEach(([f, d]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + d); o.stop(t0 + d + 0.3);
      });
    } catch {}
  }
  function announce(fresh) {
    if (!alertsOn()) return;
    beep();
    const one = fresh.length === 1 ? fresh[0] : null;
    const a = one && lastAsk(one);
    const n = new Notification(one ? t('inbox.notify.one', { who: a.author, id: one.id }) : t('inbox.notify.many', { n: fresh.length }), {
      body: one ? `${one.projectName}: ${String(a.text).replace(/\s+/g, ' ').slice(0, 160)}` : fresh.map(c => c.id + ' ' + c.title).join('\n').slice(0, 200),
      tag: 'aigile-question-' + (one ? keyOf(one) : 'many'),
    });
    n.onclick = () => {
      try { window.focus(); } catch {}
      flashKey = one ? keyOf(one) : null;
      tab = 'all';   // so the question is visible whatever tab was open
      if (onInboxPage()) show(true); else location.hash = '#/inbox';
      n.close();
    };
  }
  async function toggleAlerts() {
    if (!canNotify()) return;
    if (alertsOn()) { pref.set(false); paintTop(); return; }
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();   // created inside the click so sound is allowed later
      audio.resume();
    } catch {}
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') { pref.set(true); beep(); }
    paintTop();
  }

  /* ---------- inbox page (AIG-33) ---------- */
  function qHtml(c) {
    const a = lastAsk(c), acts = c.blocked ? [] : askActions(a, 'question');
    return `<div class="ib-top"><span class="ib-tag">${esc(c.blocked ? t('inbox.q.blocked') : t('inbox.q.question'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>${queueChips(c)}
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-who">${t(c.blocked ? 'inbox.q.isblocked.html' : 'inbox.q.asked.html', { who: esc(a.author), when: ago(a.at) })}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>${actionsHtml(acts, c.project, c.id)}
      <textarea rows="2" data-draft="${esc(c.project + '/' + c.id)}/reply" placeholder="${esc(t('inbox.q.ph'))}" aria-label="${esc(t('inbox.q.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions">${c.blocked || acts.length ? '' : `<button class="good" data-act="go" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>`}<button class="primary" data-act="send">${esc(t('inbox.q.send'))}</button><button data-act="wait" title="${esc(t('inbox.later.title'))}">${esc(t('inbox.later'))}</button>${Attach.boxHtml(c.project + '/' + c.id)}<span class="ib-hint">${esc(t('inbox.q.hint'))}</span></div>`;
  }
  function kHtml(c) {
    const a = lastAsk(c);
    return `<div class="ib-top"><span class="ib-tag">${esc(t('inbox.k.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span></div>${queueChips(c)}
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      <div class="ib-who">${t('inbox.k.asked.html', { who: esc(a.author), when: ago(a.at) })}</div>
      <div class="ib-question">${linkify(a.text, c)}</div>
      <textarea rows="1" data-draft="${esc(c.project + '/' + c.id)}/task" placeholder="${esc(t('inbox.k.ph'))}" aria-label="${esc(t('inbox.k.aria', { id: c.id }))}"></textarea>
      <div class="ib-err"></div>
      <div class="actions"><button class="good" data-act="taskdone">${esc(t('inbox.k.done'))}</button>${Attach.boxHtml(c.project + '/' + c.id)}<span class="ib-hint">${esc(t('inbox.k.hint'))}</span></div>`;
  }
  function tHtml(c) {
    return `<div class="ib-top"><span class="ib-tag">${esc(t('inbox.t.tag'))}</span><span class="ib-proj">${pic(c.projectLogo, c.projectEmoji)} ${esc(c.projectName)}</span><span class="ib-id">${esc(c.id)}</span><span class="ib-hint">${esc(t('inbox.t.waiting', { when: ago(c.updated, true) }))}</span></div>
      <div class="ib-title"><a href="#/p/${c.project}/${c.id}">${esc(c.title)}</a></div>
      ${aiEvidence(c, c.project)}
      ${c.testSteps ? `<details class="ib-steps"><summary>${esc(t('inbox.t.how'))}</summary><div class="body">${linkify(c.testSteps, c)}</div></details>` : `<div class="ib-hint">${esc(t('inbox.t.nosteps'))}</div>`}
      <div class="ib-err"></div>
      <div class="actions">${c.openUrl ? `<button class="primary" data-act="open" data-cmd="${esc(c.startCmd || '')}" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button>` : ''}<button class="good" data-act="accept">${esc(t('card.accept'))}</button><button data-act="wait" title="${esc(t('inbox.t.wait.title'))}">${esc(t('card.wait'))}</button>
      <a href="#/p/${c.project}/${c.id}" class="ib-hint" style="text-decoration:underline">${esc(t('inbox.t.sendback'))}</a></div>`;
  }
  const sigOf = c => !isTest(c) ?[c.title, c.blocked, lastAsk(c).at, lastAsk(c).text, i18n.lang].join('|') : [c.title, c.updated, c.testSteps, c.aiCheck && c.aiCheck.at].join('|');

  function skeleton() {
    el('app').innerHTML = `<div class="ib" id="ib">
      <div class="ib-head"><h2>${esc(t('inbox.h'))}</h2><span class="ib-hint">${esc(t('inbox.sub'))}</span></div>
      <div class="ib-tabs" id="ibTabs" role="tablist"></div>
      <div class="ib-next" id="ibNext"></div>
      <div class="ib-kinds" id="ibKinds"></div>
      <div class="ib-only" id="ibOnly" hidden></div>
      <div class="ib-toast" id="ibToast" role="status" aria-live="polite"></div>
      <div id="ibEmpty"></div>
      <section class="ib-sec q" id="ibQ"><h3>${esc(t('inbox.messages'))} <span class="ib-badge q" id="ibQn"></span></h3><div class="ib-chat"><div class="ib-chats" id="ibChats"></div><div class="list ib-thread"></div></div><div class="ib-hint" id="ibMore" hidden></div></section>
      <section class="ib-sec k" id="ibK"><h3>${esc(t('inbox.tasks'))} <span class="ib-badge k" id="ibKn"></span><span class="ib-hint" style="font-weight:400">${esc(t('inbox.tasks.sub'))}</span></h3><div class="list"></div></section>
      <section class="ib-sec t" id="ibT"><h3>${esc(t('inbox.t.tag'))} <span class="ib-badge t" id="ibTn"></span><span class="ib-hint" style="font-weight:400">${esc(t('inbox.t.sub'))}</span><button class="good ib-aiall" id="ibAiAll" hidden title="${esc(t('inbox.aiall.title'))}"></button></h3><div class="list"></div></section>
    </div>`;
    el('ib').addEventListener('click', onClick);
    el('ib').addEventListener('keydown', onKey);
  }

  // Keeps existing item elements (and whatever is typed in them) and only adds, removes or updates the rest.
  // A reply box that is focused or holds text is never touched, so the 1s poll can't wipe it.
  function syncList(list, data) {
    const have = new Map([...list.children].map(n => [n.dataset.key, n]));
    const want = new Set(data.map(keyOf));
    for (const [k, n] of have) if (!want.has(k) && !n.dataset.sending) { n.remove(); have.delete(k); }
    data.forEach((c, i) => {
      const k = keyOf(c), sig = sigOf(c);
      let n = have.get(k);
      const typing = n && [...n.querySelectorAll('textarea')].some(t => t.value || t === document.activeElement);
      if (n && n.dataset.sig !== sig && !typing) { n.remove(); n = null; }
      if (!n) {
        n = document.createElement('div');
        const kind = kindOf(c);
        n.className = 'ib-item ' + kind + (kind === 'q' && c.blocked ? ' blk' : '');
        n.dataset.key = k; n.dataset.sig = sig; n.dataset.project = c.project; n.dataset.id = c.id;
        if (c.projectColor) n.style.setProperty('--proj', c.projectColor);   // project stripe and badge (AIG-86)
        n.innerHTML = kind === 'q' ? qHtml(c) : kind === 'k' ? kHtml(c) : tHtml(c);
      }
      if (list.children[i] !== n) list.insertBefore(n, list.children[i] || null);
    });
  }

  /* ---------- project tabs (AIG-37): All + one per project with something waiting; remembers the last tab ---------- */
  const tabPref = {
    get() { try { return localStorage.getItem('aigile.inboxTab') || 'all'; } catch { return 'all'; } },
    set(t) { try { localStorage.setItem('aigile.inboxTab', t); } catch {} },
  };
  let tab = tabPref.get();
  let chat = null;   // the project whose questions show in the Messages thread (AIG-87)
  let fromProject = null, selectPinned = false;   // set when the inbox is opened from a project page
  function tabCounts(list) {
    const q = list.filter(isQuestion).length, k = list.filter(isTask).length, t = list.filter(isTest).length;
    return `${q ? `<span class="tq">❓${q}</span>` : ''}${k ? `<span class="tk">📋${k}</span>` : ''}${t ? `<span class="tt">🧪${t}</span>` : ''}`;
  }
  function mostRecentMessageTime(projectSlug) {
    const projectItems = items.filter(c => c.project === projectSlug);
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
  let tabOrder = [];
  function paintTabs() {
    // Opened from a project page: that project first (selected once, on arrival) and All last, for the
    // whole visit. Other projects are ordered by their most recent message, newest first.
    const projects = [...new Map(items.map(c => [c.project, c.projectName])).entries()]
      .sort((a, b) => mostRecentMessageTime(b[0]).localeCompare(mostRecentMessageTime(a[0])));
    const pinned = fromProject && projects.find(([p]) => p === fromProject);
    if (pinned && selectPinned) tab = fromProject;
    selectPinned = false;
    const orderedProjects = pinned ? [pinned, ...projects.filter(([p]) => p !== fromProject)] : projects;
    const allAtEnd = !!pinned;
    if (tab !== 'all' && !orderedProjects.some(([p]) => p === tab)) tab = 'all';   // that project's inbox emptied
    const lookOf = p => items.find(c => c.project === p) || {};
    const btn = (key, name, list) => { const l = key === 'all' ? {} : lookOf(key);
      return `<button class="ib-tab ${tab === key ? 'on' : ''}" data-tab="${esc(key)}" role="tab" aria-selected="${tab === key}" title="${esc(name)}"${l.projectColor ? ` style="--proj:${esc(l.projectColor)}"` : ''}>${l.projectLogo || l.projectEmoji ? pic(l.projectLogo, l.projectEmoji) + ' ' : ''}<span class="nm">${esc(name)}</span> <span class="n">${list.length}</span> ${tabCounts(list)}</button>`; };
    tabOrder = orderedProjects.map(([p]) => p);
    const projectBtns = orderedProjects.map(([p, name]) => btn(p, name, items.filter(c => c.project === p))).join('');
    const html = allAtEnd
      ? projectBtns + btn('all', t('inbox.all'), items)  // "All" at the end when showing a project first
      : btn('all', t('inbox.all'), items) + projectBtns;  // "All" at the beginning otherwise
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
    if (!chats.some(x => x.p === chat)) chat = chats.length ? chats[0].p : null;
    const html = chats.map(({ p, list, last }) => {
      const c = list[0], who = lastAsk(list.find(x => lastAsk(x).at === last) || c).author;
      return `<button class="ib-chatbtn ${p === chat ? 'on' : ''}" data-chat="${esc(p)}" style="--proj:${esc(c.projectColor || '')}">
        <span class="av">${pic(c.projectLogo, c.projectEmoji || '💬')}</span><span class="nm"><b>${esc(c.projectName)}</b><span class="ib-hint">${esc(who)} · ${ago(last)}</span></span><span class="ib-badge q">${list.length}</span></button>`;
    }).join('');
    const box = el('ibChats');
    if (box.dataset.sig !== html) { box.dataset.sig = html; box.innerHTML = html; }
    box.hidden = chats.length < 2;
    syncList(el('ibQ').querySelector('.list'), qs.filter(c => c.project === chat).sort((a, b) => lastAsk(a).at.localeCompare(lastAsk(b).at)));
  }

  let kindFilter = '', only = '';   // only: q, k or t from a top bar chip (AIG-187)
  function paintPage() {
    if (!el('ib')) skeleton();
    paintTabs();
    // All tab: items grouped by project, in tab order, each group still longest-waiting first (AIG-86).
    const shown = tab === 'all' ? [...items].sort((a, b) => tabOrder.indexOf(a.project) - tabOrder.indexOf(b.project)) : items.filter(c => c.project === tab);
    // Your queue (AIG-159..162): filter by kind, sort by your priority / what it holds up / time, and pick Next up.
    paintQueue(shown, kindFilter);
    const pick = shown.filter(c => !kindFilter || kindOfItem(c) === kindFilter).sort(queueRank);
    const qs = pick.filter(isQuestion), ks = pick.filter(isTask), ts = pick.filter(isTest);
    // A link to one question (alerts, the home list) opens its chat.
    if (flashKey) { const f = qs.find(c => keyOf(c) === flashKey); if (f) chat = f.project; }
    paintChats(qs);
    syncList(el('ibK').querySelector('.list'), ks);
    syncList(el('ibT').querySelector('.list'), ts);
    el('ibQ').hidden = !qs.length || (only && only !== 'q'); el('ibK').hidden = !ks.length || (only && only !== 'k'); el('ibT').hidden = !ts.length || (only && only !== 't');
    el('ibOnly').hidden = !only; el('ibOnly').innerHTML = only ? `${esc(t('inbox.only.' + only))} · <a href="#" data-onlyclear>${esc(t('inbox.only.all'))}</a>` : '';
    // Accept all AI-passed (AIG-163): every test the AI tester passed, in one click.
    const passed = ts.filter(c => c.aiCheck && c.aiCheck.result === 'pass');
    el('ibAiAll').hidden = !passed.length; el('ibAiAll').textContent = t('inbox.aiall', { n: passed.length });
    el('ibQn').textContent = qs.length; el('ibKn').textContent = ks.length; el('ibTn').textContent = ts.length;
    el('ibMore').hidden = !hidden; el('ibMore').textContent = t('inbox.more', { n: hidden });
    if (hidden && (!only || only === 'q')) el('ibQ').hidden = false;
    el('ibEmpty').innerHTML = items.length || hidden ? '' : `<div class="ib-empty"><div class="big">${esc(t('inbox.empty.title'))}</div><p>${esc(t('inbox.empty.text'))}</p></div>`;
    if (flashKey) {
      const n = [...document.querySelectorAll('.ib-item')].find(x => x.dataset.key === flashKey);
      if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); const t = n.querySelector('textarea'); if (t) t.focus({ preventScroll: true }); flashKey = null; }
    }
  }
  const toast = msg => { const t = el('ibToast'); if (t) t.textContent = msg; };

  function onKey(e) {
    if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const n = e.target.closest('.ib-item');
      if (n.classList.contains('k')) taskDone(n); else send(n);
    }
  }
  function onClick(e) {
    if (e.target.closest('[data-onlyclear]')) { e.preventDefault(); only = ''; paintPage(); return; }
    if (e.target.closest('#ibAiAll')) { acceptAiPassed(e.target.closest('#ibAiAll')); return; }
    const cb = e.target.closest('button[data-chat]');
    if (cb) { chat = cb.dataset.chat; paintPage(); return; }
    const kb = e.target.closest('button[data-kind]');
    if (kb) { kindFilter = kb.dataset.kind; paintPage(); return; }
    const tb = e.target.closest('button[data-tab]');
    if (tb) { tab = tb.dataset.tab; tabPref.set(tab); paintPage(); return; }
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const n = b.closest('.ib-item'), act = b.dataset.act;
    if (act === 'open') { openIt(n.dataset.project, n.dataset.id, b); return; }
    if (act === 'send') send(n); else if (act === 'go') send(n, 'GO'); else if (act === 'accept') accept(n); else if (act === 'wait') waitAndSee(n); else if (act === 'taskdone') taskDone(n);
  }
  const base = n => `/api/projects/${n.dataset.project}/cards/${n.dataset.id}`;
  const fail = (n, e) => { n.querySelector('.ib-err').textContent = e.message || String(e); n.dataset.sending = ''; n.querySelectorAll('button').forEach(b => b.disabled = false); };
  const lock = n => { n.dataset.sending = '1'; n.querySelector('.ib-err').textContent = ''; n.querySelectorAll('button').forEach(b => b.disabled = true); };
  const done = (n, msg) => { n.remove(); raw = raw.filter(c => keyOf(c) !== n.dataset.key); items = view(); paintTop(); paintPage(); toast(msg); load().catch(() => {}); };

  // fixed: a one-tap answer (👍 Go, AIG-75) instead of the typed one.
  async function send(n, fixed) {
    if (n.dataset.sending) return;
    const ta = n.querySelector('textarea'), text = fixed || ta.value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    if (!text && !Attach.has(key)) { n.querySelector('.ib-err').textContent = t('dms.empty'); return; }
    lock(n);
    try {
      const attachments = fixed ? [] : await Attach.upload(key, n.dataset.project);
      await post('POST', base(n) + '/comments', { author: me(), text, attachments });
      if (!fixed) Attach.clear(key);
      clearDraft(key + '/reply');
      done(n, t('inbox.toast.sent', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  async function taskDone(n) {
    if (n.dataset.sending) return;
    const text = n.querySelector('textarea').value.trim(), key = n.dataset.project + '/' + n.dataset.id;
    lock(n);
    try {
      const attachments = await Attach.upload(key, n.dataset.project);
      await post('POST', base(n) + '/taskdone', { text, attachments });
      Attach.clear(key);
      clearDraft(key + '/task');
      done(n, t('inbox.toast.done', { id: n.dataset.id }));
    }
    catch (e) { fail(n, e); }
  }
  async function accept(n) {
    lock(n);
    try { await post('POST', base(n) + '/verdict', { accept: true }); done(n, t('inbox.toast.accepted', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }
  async function acceptAiPassed(btn) {
    const list = items.filter(c => isTest(c) && c.aiCheck && c.aiCheck.result === 'pass' && (tab === 'all' || c.project === tab));
    btn.disabled = true; let n = 0;
    for (const c of list) { try { await post('POST', `/api/projects/${c.project}/cards/${c.id}/verdict`, { accept: true }); n++; } catch {} }
    btn.disabled = false; toast(t('inbox.toast.aiall', { n })); await load(); paintPage();
  }
  async function waitAndSee(n) {
    lock(n);
    try { await post('POST', base(n) + '/snooze'); n.dataset.sending = ''; await load(); toast(t('inbox.toast.hidden', { id: n.dataset.id })); }
    catch (e) { fail(n, e); }
  }

  /* ---------- hooks used by js/core.js ---------- */
  // Called from refresh() whenever the route is #/inbox. Takes over the page body.
  async function show(force) {
    try { await load(); } catch (e) {
      el('live').className = 'live off'; el('live').textContent = t('live.offline', { msg: e.message }); return;
    }
    el('live').className = 'live'; el('live').textContent = t('live.ok');
    el('crumb').textContent = '/ ' + t('inbox.crumb');
    el('modal').innerHTML = '';
    if (typeof state !== 'undefined') state.lastSig = state.lastBoardSig = null;   // so other views redraw when Rich leaves
    if (force || !el('ib')) { if (!el('ib')) skeleton(); fromProject = (typeof state !== 'undefined' && state.lastProject) || null; selectPinned = true; }
    paintTop(); paintPage();
  }

  // Own poll so counts, tab title and alerts keep working on every page, even in a background tab.
  setInterval(() => { load().catch(() => {}); }, 1000);
  window.addEventListener('hashchange', paintTop);
  load().catch(() => {});

  window.Inbox = { show, repaint };
})();
