// AI-gile inbox: shared state, helpers and the data load.
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
// The inbox's shared mutable state. Every inbox-*.js file reads and writes it through IB.
const IB = {
  items: [], raw: [], hidden: 0, flashKey: null, offers: 0, asks: 0,   // offers / asks: friends' link offers and questions waiting (AIG-382)
    // what is shown, what the server sent, how many quiet mode hides
  tab: 'all', chat: null, fromProject: null, selectPinned: false, tabOrder: [],   // project tabs and the Messages chat (AIG-37, AIG-87)
  flick: -1, decide: -1, kindFilter: '', only: '', testerOn: false,   // flick: the 🤖 view (-1 closed); only: q, k or t from a top bar chip (AIG-187)
};
(function () {
  'use strict';
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
  // Server sends three kinds: tasks (assigned to the owner: something only they can do), questions, and verify cards.
  const isTask = c => String(c.assignee || '').trim().toLowerCase() === me().toLowerCase();
  const isQuestion = c => !isTask(c) && c.status !== 'verify';
  const isTest = c => !isTask(c) && c.status === 'verify';
  const kindOf = c => isTask(c) ? 'k' : isQuestion(c) ? 'q' : 't';
  // A 👉 poke is the Scrum Master nudging the team, never a question for the owner (AIG-717).
  // An "Original: ..." comment is the owner's own words kept by the lead when tidying (AIG-811), never a new message (AIG-835).
  const lastAsk = c => [...(c.comments || [])].reverse().find(m => !m.poke && !/^\s*Original:/i.test(m.text || '') && String(m.author).trim().toLowerCase() !== me().toLowerCase())
    || { author: c.assignee || 'The team', at: c.updated, text: c.description || c.title };
  // The item shows the task / question itself (AIG-367), not whatever the team said last: the newest comment marked by `aigile task` / `ask`.
  const shownAsk = c => {
    const mark = isTask(c) ? 'task' : c.blocked ? '' : 'ask';
    const m = mark && [...(c.comments || [])].reverse().find(x => x.mark === mark && String(x.author).trim().toLowerCase() !== me().toLowerCase());
    // After the owner replied and the lead answered (AIG-472), the lead's newest message leads; the task itself folds under it (see `earlier`).
    const last = isTask(c) && lastAsk(c);
    const replied = m && (c.comments || []).some(x => x.at > m.at && last && x.at < last.at && String(x.author).trim().toLowerCase() === me().toLowerCase());
    return replied && !last.mark ? last : m || lastAsk(c);
  };
  const earlier = c => { const a = shownAsk(c); const m = isTask(c) && [...(c.comments || [])].reverse().find(x => x.mark === 'task' && String(x.author).trim().toLowerCase() !== me().toLowerCase()); return m && m !== a ? m : null; };
  const keyOf = c => c.project + '/' + c.id;
  // Escape, then link web addresses and card ids (e.g. AIG-12) in the same project.
  const linkify = (text, c) => withCode(text, t => mdLinks(esc(t)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, u => `<a href="${u}" target="_blank" rel="noopener" style="text-decoration:underline">${u}</a>`)
    .replace(/(^|[^\w/#-])([A-Z]{1,6}-\d+)\b/g, (m, pre, id) => `${pre}<a href="#/p/${c.project}/${id}" style="text-decoration:underline">${id}</a>`), c.project), c.project);

  const tabPref = {
    get() { try { return localStorage.getItem('aigile.inboxTab') || 'all'; } catch { return 'all'; } },
    set(t) { try { localStorage.setItem('aigile.inboxTab', t); } catch {} },
  };
  IB.tab = tabPref.get();
  let loaded = false, inflight = null, seen = new Set();

  /* ---------- data ---------- */
  // The change stamp (AIG-920) decides whether the list is fetched at all; load(true) always fetches. ?lite=1: no commit file lists.
  function load(force) {
    if (inflight) return inflight;
    const key = 'inbox' + (typeof Streamer !== 'undefined' && Streamer.on() ? ':s' : '') + (typeof Swarm !== 'undefined' && Swarm.on ? ':w' : '');
    inflight = (async () => {
      const tok = typeof Stamp === 'undefined' ? { key } : await Stamp.ask(key, force || !loaded);
      if (!tok) return true;   // nothing moved: keep what is drawn
      const r = await fetch('/api/inbox?lite=1', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.statusText);
      let l = await r.json();
      if (typeof Streamer !== 'undefined' && Streamer.on()) l = Streamer.filter('GET', '/api/inbox', l);
      if (typeof Swarm !== 'undefined') l = Swarm.only(l, true);   // 🚨 swarm: only that project (AIG-877)
      if (typeof Stamp !== 'undefined') Stamp.commit(tok);
      apply(l); IB.testerDone(); return true;
    })().then(v => { inflight = null; return v; }, e => { inflight = null; throw e; });
    return inflight;
  }
  // Going quiet (night mode): no tests or tasks, and only the 3 newest questions.
  const isQuiet = () => document.documentElement.hasAttribute('data-night');
  function view() {
    if (!isQuiet()) { IB.hidden = 0; return IB.raw; }
    const all = IB.raw.filter(isQuestion);
    const qs = all.slice().sort((a, b) => lastAsk(b).at.localeCompare(lastAsk(a).at)).slice(0, 3);
    IB.hidden = all.length - qs.length;
    return IB.raw.filter(c => qs.includes(c));
  }
  function apply(list) {
    if (typeof i18n === 'undefined' || !i18n.ready) { setTimeout(() => load().catch(() => {}), 100); return; }   // wait for the language file (AIG-124)
    IB.raw = list.filter((c, i) => list.findIndex(x => keyOf(x) === keyOf(c)) === i);   // a card is one item, never two (AIG-472)
    IB.items = view();
    const qs = IB.items.filter(c => !isTest(c));   // questions and tasks both alert (only those shown)
    // New questions only: never on the first load. A fresh question on the same card counts as new.
    const key = c => keyOf(c) + '@' + lastAsk(c).at;
    if (loaded) {
      const fresh = qs.filter(c => !seen.has(key(c)));
      if (fresh.length) IB.announce(fresh);
    }
    seen = new Set(IB.raw.filter(c => !isTest(c)).map(key));   // hidden ones are not new when quiet ends
    loaded = true;
    IB.paintTop();
    if (onInboxPage()) IB.paintPage();
  }
  function repaint() { if (!loaded) return; IB.items = view(); IB.paintTop(); if (onInboxPage() && el('ib')) IB.paintPage(); }
  const onInboxPage = () => location.hash === '#/inbox';
  // Link offers and friends' questions are waiting on the owner too: counted in All, the top bar, the rail and the title.
  const friends = () => (IB.offers || 0) + (IB.asks || 0);
  const setFriends = (key, n) => { if (IB[key] === n) return; IB[key] = n; if (typeof IB.paintTop === 'function') IB.paintTop(); if (onInboxPage() && el('ib') && IB.paintTabs) IB.paintTabs(); };
  Object.assign(IB, { friends, setFriends, el, esc, post, isTask, isQuestion, isTest, kindOf, lastAsk, shownAsk, earlier, keyOf, linkify, onInboxPage, tabPref, load, apply, repaint, view });
})();
