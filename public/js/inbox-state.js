// AI-gile inbox: shared state, helpers and the data load.
// Classic script; shares the inbox's state and helpers through the IB object (js/inbox-state.js).
// The inbox's shared mutable state. Every inbox-*.js file reads and writes it through IB.
const IB = {
  items: [], raw: [], hidden: 0, flashKey: null,   // what is shown, what the server sent, how many quiet mode hides
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
  const lastAsk = c => [...(c.comments || [])].reverse().find(m => String(m.author).trim().toLowerCase() !== me().toLowerCase())
    || { author: c.assignee || 'The team', at: c.updated, text: c.description || c.title };
  // The item shows the task / question itself (AIG-367), not whatever the team said last: the newest comment marked by `aigile task` / `ask`.
  const shownAsk = c => {
    const mark = isTask(c) ? 'task' : c.blocked ? '' : 'ask';
    const m = mark && [...(c.comments || [])].reverse().find(x => x.mark === mark && String(x.author).trim().toLowerCase() !== me().toLowerCase());
    return m || lastAsk(c);
  };
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
    if (!isQuiet()) { IB.hidden = 0; return IB.raw; }
    const all = IB.raw.filter(isQuestion);
    const qs = all.slice().sort((a, b) => lastAsk(b).at.localeCompare(lastAsk(a).at)).slice(0, 3);
    IB.hidden = all.length - qs.length;
    return IB.raw.filter(c => qs.includes(c));
  }
  function apply(list) {
    if (typeof i18n === 'undefined' || !i18n.ready) { setTimeout(() => load().catch(() => {}), 100); return; }   // wait for the language file (AIG-124)
    IB.raw = list;
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
  Object.assign(IB, { el, esc, post, isTask, isQuestion, isTest, kindOf, lastAsk, shownAsk, keyOf, linkify, onInboxPage, tabPref, load, apply, repaint, view });
})();
