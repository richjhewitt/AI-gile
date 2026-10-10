/* ---------- state, api, helpers ---------- */
// The board's human (AIG-103): name from /api/meta, default Rich.
const me = () => (typeof state !== 'undefined' && state.owner) || 'Rich';
const COLS = { backlog: 'Backlog', todo: 'To do', doing: 'In progress', review: 'Team checking', verify: 'For you to test', team: 'For the team', done: 'Done' };
// A project's columns (AIG-116): its saved order, names, emoji, colours and hidden flags over the defaults.
const DEFAULT_NAMES = { verify: 'For you' };   // the For you column (AIG-106) shows more than tests
function colsOf(p) {
  const saved = (p && p.columns) || [], byStatus = Object.fromEntries(saved.map(c => [c.status, c]));
  const order = saved.length ? saved.map(c => c.status) : Object.keys(COLS);
  return order.map(k => { const c = byStatus[k] || {}; return { key: k, name: c.name || DEFAULT_NAMES[k] || COLS[k], emoji: c.emoji || '', color: c.color || '', hidden: !!c.hidden, wip: +c.wip || 0 }; });
}
// WIP limit (AIG-118): 'at' when the column is full, 'over' when past the limit; 0 = no limit.
const wipState = (n, limit) => !limit ? '' : n > limit ? 'over' : n === limit ? 'at' : '';
const colLabel = (p, k) => { const c = colsOf(p).find(x => x.key === k); return c ? (c.emoji ? c.emoji + ' ' : '') + c.name : COLS[k]; };
const COL_COLORS = { team: '#e11d74', done: 'var(--done)', verify: 'var(--you)', review: '#0ea5a4', doing: 'var(--accent)', todo: 'var(--warn)' };
const TYPES = ['feature', 'bug', 'task'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const state = { route: null, projects: [], inbox: [], project: null, openCard: null, showArchived: false, editing: false, dragging: false, lastSig: null };
try { state.showArchived = localStorage.getItem('aigile.showArchived') === '1'; } catch {}

const api = async (method, url, body) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = iso => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago';
};
const $ = id => document.getElementById(id);


/* ---------- router ---------- */
function parseRoute() {
  if (location.hash === '#/inbox') return { view: 'inbox' };
  if (/^#\/usage/.test(location.hash)) return { view: 'usage' };
  if (location.hash === '#/setup') return { view: 'setup' };
  const pop = location.hash.match(/^#\/pop\/([^/]+)\/([^/]+)/);
  if (pop) return { view: 'project', slug: pop[1], card: pop[2], pop: true };
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/([^/]+))?/);
  return m ? { view: 'project', slug: m[1], card: m[2] || null } : { view: 'home' };
}

/* ---------- refresh and render loop ---------- */
// The 1s poll must never wipe out what Rich is typing or a drag in progress.
// busy() = a dialog is open, a card is being edited, a drag is running, a field has focus,
// or any field in the panel holds unsent text. While busy we skip re-rendering (data is re-fetched
// each tick and renders as soon as Rich is done, because the signature differs).
function busy() {
  if (state.dragging || state.editing || $('dialog').firstChild) return true;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('modal').contains(a)) return true;
  return [...document.querySelectorAll('#modal textarea, #modal input[type=text]')].some(el => el.value !== el.defaultValue);
}

async function refresh(force) {
  if (state.route && state.route.view === 'project') state.lastProject = state.route.slug; else if (state.route && state.route.view !== 'inbox') state.lastProject = null;
  state.route = parseRoute();
  if (state.route.view !== 'project') { $('teamTop').innerHTML = ''; $('teamTop').dataset.sig = ''; $('filterbar').innerHTML = ''; $('filterbar').dataset.slug = ''; }
  // The inbox page renders itself; forget the last render so leaving it always redraws.
  if (state.route.view === 'inbox') { state.lastSig = state.lastBoardSig = null; return Inbox.show(force); }
  let sig;
  try {
    if (state.route.view === 'home') {
      const q = state.showArchived ? '?all=1' : '';
      [state.projects, state.inbox, state.usage] = await Promise.all([api('GET', '/api/projects' + q), api('GET', '/api/inbox'), api('GET', '/api/usage').catch(() => ({ enabled: false }))]);
      sig = JSON.stringify([state.route, state.projects, state.inbox, state.usage]);
    } else if (state.route.view === 'setup') {
      state.setup = await api('GET', '/api/setup');
      sig = JSON.stringify([state.route, state.setup]);
    } else if (state.route.view === 'usage') {
      await loadUsagePage(force);   // heavy, so at most every ~15s
      sig = JSON.stringify([state.route, uzSig()]);
    } else {
      state.project = await api('GET', '/api/projects/' + state.route.slug);
      await loadDocs(state.route.slug);
      sig = JSON.stringify([state.route, state.project]);
    }
  } catch (e) {
    $('live').className = 'live off';
    $('live').textContent = 'offline: ' + e.message;
    return;
  }
  if (!force && state.dragging) return;
  if (!force && busy()) {
    // Keep the board behind moving; only hold the panel/dialog Rich is using.
    if (sig !== state.lastBoardSig) { state.lastBoardSig = sig; renderBoardOnly(); }
    if (sig !== state.lastSig) { $('live').className = 'live paused'; $('live').textContent = 'live (your typing is safe)'; }
    return;
  }
  $('live').className = 'live';
  $('live').textContent = 'live';
  if (!force && sig === state.lastSig) return;
  state.lastSig = state.lastBoardSig = sig;
  render();
}

function renderBoardOnly() {
  queueMicrotask(paintFilterBar);
  const keepBoardX = document.querySelector('.board')?.scrollLeft || 0;
  if (state.route.view === 'usage') return;
  $('app').innerHTML = state.route.view === 'home' ? renderHome() : renderBoard(state.project);
  const b = document.querySelector('.board'); if (b) b.scrollLeft = keepBoardX;
}

function render() {
  queueMicrotask(paintFilterBar);
  const keepScroll = document.querySelector('#modal .panel')?.scrollTop || 0;
  const keepBoardX = document.querySelector('.board')?.scrollLeft || 0;
  if (state.route.view === 'home') { $('crumb').textContent = ''; $('app').innerHTML = renderHome(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'setup') { $('crumb').textContent = '/ Setup'; if (!$('setupForm')) $('app').innerHTML = renderSetup(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'usage') { $('crumb').textContent = '/ Usage'; $('app').innerHTML = renderUsagePage(); $('modal').innerHTML = ''; return; }
  const p = state.project;
  // A popped-out card (AIG-122): just the card, filling its own window; no header or board behind it.
  document.body.classList.toggle('pop', !!state.route.pop);
  if (state.route.pop) {
    const c = p.cards.find(x => x.id === state.route.card);
    $('app').innerHTML = '';
    $('modal').innerHTML = c ? renderCard(p, c) : '<p class="muted" style="padding:16px">This card no longer exists.</p>';
    const pp = document.querySelector('#modal .panel'); if (pp) pp.scrollTop = keepScroll;
    return;
  }
  $('crumb').textContent = '/ ' + (p.emoji ? p.emoji + ' ' : '') + p.name;
  $('crumb').style.color = p.color || '';
  $('app').innerHTML = renderBoard(p);
  const card = state.route.card && p.cards.find(c => c.id === state.route.card);
  if (!card) state.editing = false;
  $('modal').innerHTML = card ? renderCard(p, card) : '';
  const b = document.querySelector('.board'); if (b) b.scrollLeft = keepBoardX;
  const pn = document.querySelector('#modal .panel'); if (pn) pn.scrollTop = keepScroll;
}
const rerender = () => refresh(true);

/* ---------- action helpers ---------- */
// ---- actions -------------------------------------------------------------------
const slug = () => state.route.slug;
const cardId = () => state.route.card;
const curCard = () => state.project.cards.find(c => c.id === cardId());
const setErr = (id, e) => { const el = $(id); if (el) el.textContent = e ? (e.message || e) : ''; };
