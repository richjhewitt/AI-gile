/* ---------- state, api, helpers ---------- */
// The board's human (AIG-103): name from /api/meta, default Rich.
const me = () => (typeof state !== 'undefined' && state.owner) || 'Rich';
/* ---------- drafts (AIG-171): unsent text survives a refresh, a restart or a crash ---------- */
// Any textarea with data-draft="<key>" is saved to this browser as you type and filled back in when it
// appears again (also after the page is redrawn). Sending calls clearDraft(key).
const draftKey = k => 'aigile.draft.' + k;
const clearDraft = k => { try { localStorage.removeItem(draftKey(k)); } catch {} };
document.addEventListener('input', e => {
  const k = e.target && e.target.dataset && e.target.dataset.draft; if (!k) return;
  try { e.target.value.trim() ? localStorage.setItem(draftKey(k), e.target.value) : localStorage.removeItem(draftKey(k)); } catch {}
});
new MutationObserver(() => document.querySelectorAll('textarea[data-draft]:not([data-drafted])').forEach(el => {
  el.dataset.drafted = '1';
  let v = null; try { v = localStorage.getItem(draftKey(el.dataset.draft)); } catch {}
  if (v && !el.value) el.value = v;
})).observe(document.documentElement, { childList: true, subtree: true });
/* ---------- your queue (AIG-159..162): what holds things up, your priority, kind and time ---------- */
const QKINDS = { decide: '❓', test: '🧪', server: '🖥️', keys: '🔑', read: '📖' };
const PRIO_RANK = { now: 0, today: 1, whenever: 3 };   // no priority set sits between today and whenever
// An item's kind: what the team set, else a sensible guess (tests are tests, the rest are decisions).
const kindOfItem = c => c.kind || (c.status === 'verify' ? 'test' : 'decide');
// Queue order: your priority, then what it holds up most, then quickest first.
const queueRank = (a, b) => (PRIO_RANK[a.ownerPrio] ?? 2) - (PRIO_RANK[b.ownerPrio] ?? 2) || (b.holds || []).length - (a.holds || []).length || (a.mins || 999) - (b.mins || 999);
function queueChips(c) {
  const k = kindOfItem(c), p = c.ownerPrio;
  return `<span class="q-chips"><span class="q-chip" title="${esc(t('queue.kind.' + k))}">${QKINDS[k]} ${esc(t('queue.kind.' + k))}</span>`
    + `<button class="q-chip prio ${p ? 'p-' + p : ''}" data-prio="${esc(c.project || slug())}/${esc(c.id)}" title="${esc(t('queue.prio.title'))}">🔥 ${esc(t('queue.prio.' + (p || 'none')))}</button>`
    + ((c.holds || []).length ? `<span class="q-chip holds" title="${esc(c.holds.join(', '))}">⛓ ${esc(t('queue.holds', { n: c.holds.length }))}</span>` : '')
    + (c.mins ? `<span class="q-chip">⏱ ${esc(t('queue.mins', { n: c.mins }))}</span>` : '') + '</span>';
}
// Click 🔥 to change your priority: none → now → today → whenever → none.
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-prio]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.prio.split('/'), order = ['', 'now', 'today', 'whenever'];
  const cur = (b.className.match(/p-(\w+)/) || [])[1] || '';
  try { await api('PATCH', `/api/projects/${s}/cards/${id}`, { ownerPrio: order[(order.indexOf(cur) + 1) % order.length] }); refresh(true); if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload(); } catch (err) { alert(err.message); }
}, true);
/* ---------- answer buttons under a message (AIG-176): picked from what it asks ---------- */
// say: sent straight away; ask: starts a reply with that text (it needs a reason); accept: accepts the test.
function askActions(m, kind) {
  if (Array.isArray(m.options) && m.options.length) return m.options.map(o => ({ label: o, say: o }));
  if (kind === 'test') return [{ label: t('act.accept'), accept: true }, { label: t('act.sendback'), ask: t('act.sendback.say') }];
  const text = String(m.text || '');
  if (/\bGO\s*\?/.test(text) || /\b(?:ok|okay|good) to (?:go|start|build)\b[^?]*\?/i.test(text)) return [{ label: t('act.go'), say: 'GO' }, { label: t('act.notyet'), ask: t('act.notyet.say') }];
  const q = (text.replace(/\*\*/g, '').match(/[^.!?\n]*\?/g) || []).pop() || '';
  if (/^\s*[-*•]?\s*(?:should|shall|can|could|do|does|did|is|are|was|were|will|would|ok|okay|happy|want|fine|any|have|has)\b/i.test(q)) return [{ label: t('act.yes'), say: 'Yes' }, { label: t('act.no'), ask: t('act.no.say') }];
  return [];
}
function actionsHtml(acts, slug, id) {
  if (!acts.length) return '';
  const card = esc(slug + '/' + id);
  acts = [...acts, { label: t('act.other'), ask: '' }];   // ✏️ Other…: your own answer (AIG-178)
  return `<div class="msg-acts">${acts.map(a => `<button class="msg-act ${a.ask != null ? '' : 'good'}" data-card="${card}" ${a.accept ? 'data-accept="1"' : a.ask != null ? `data-ask="${esc(a.ask)}"` : `data-say="${esc(a.say)}"`}>${esc(a.label)}</button>`).join('')}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('.msg-act[data-card]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.card.split('/');
  if (b.dataset.ask != null) {   // needs a reason: start the reply where the message is
    const item = b.closest('.ib-item'), ta = item ? item.querySelector('textarea') : null;
    if (ta) { if (b.dataset.ask) ta.value = b.dataset.ask; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    else if (typeof Dms !== 'undefined') Dms.reply(id, b.dataset.ask);
    return;
  }
  b.closest('.msg-acts').querySelectorAll('button').forEach(x => x.disabled = true);
  try {
    if (b.dataset.accept) await api('POST', `/api/projects/${s}/cards/${id}/verdict`, { accept: true });
    else await api('POST', `/api/projects/${s}/cards/${id}/comments`, { author: me(), text: b.dataset.say });
    b.textContent = '✓ ' + b.textContent;
    if (typeof Dms !== 'undefined') Dms.reload();
  } catch (err) { alert(err.message); b.closest('.msg-acts').querySelectorAll('button').forEach(x => x.disabled = false); }
}, true);
/* ---------- AI tester's evidence on a test (AIG-163): its verdict, a line or two of what it saw, its screenshot ---------- */
const aiChip = c => c.status === 'verify' && c.aiCheck ? `<span class="pill ai ${esc(c.aiCheck.result)}" title="${esc(c.aiCheck.note)}">${esc(t('ai.chip.' + c.aiCheck.result))}</span>` : '';
const aiEvidence = (c, slug) => c.status === 'verify' && c.aiCheck ? `<div class="ai-ev ${esc(c.aiCheck.result)}"><b>${esc(t('ai.chip.' + c.aiCheck.result))}</b> <span class="muted">${esc(c.aiCheck.by)} · ${ago(c.aiCheck.at)}</span><div>${esc(c.aiCheck.note)}</div>${Attach.shown({ attachments: c.aiCheck.shots }, slug)}</div>` : '';
const isOwner = a => String(a || '').trim().toLowerCase() === me().toLowerCase();
// Getters, so the names follow the language chosen at start-up (AIG-124).
const COLS = { get backlog() { return t('col.backlog'); }, get todo() { return t('col.todo'); }, get doing() { return t('col.doing'); }, get review() { return t('col.review'); }, get verify() { return t('col.verify'); }, get team() { return t('col.team'); }, get done() { return t('col.done'); } };
// A project's columns (AIG-116): its saved order, names, emoji, colours and hidden flags over the defaults.
const DEFAULT_NAMES = { get verify() { return t('col.verify.short'); } };   // the For you column (AIG-106) shows more than tests
function colsOf(p) {
  const saved = (p && p.columns) || [], byStatus = Object.fromEntries(saved.map(c => [c.status, c]));
  const order = saved.length ? saved.map(c => c.status) : Object.keys(COLS);
  return order.map(k => { const c = byStatus[k] || {}; return { key: k, name: c.name || DEFAULT_NAMES[k] || COLS[k], emoji: c.emoji || '', color: c.color || '', hidden: !!c.hidden, wip: +c.wip || 0, steps: c.steps || [] }; });
}
// WIP limit (AIG-118): 'at' when the column is full, 'over' when past the limit; 0 = no limit.
const wipState = (n, limit) => !limit ? '' : n > limit ? 'over' : n === limit ? 'at' : '';
const colLabel = (p, k) => { const c = colsOf(p).find(x => x.key === k); return c ? (c.emoji ? c.emoji + ' ' : '') + c.name : COLS[k]; };
const COL_COLORS = { team: '#e11d74', done: 'var(--done)', verify: 'var(--you)', review: '#0ea5a4', doing: 'var(--accent)', todo: 'var(--warn)' };
// What board cards show (AIG-119): the saved choice over today's look (age is new, so off by default).
const CARD_SHOW = { assignee: true, type: true, priority: true, sprint: true, comments: true, age: false };
function cardViewOf(p) {
  // While the 🃏 Cards dialog is open its choices show straight away (AIG-119), over what is saved.
  const v = (state.cvPreview && p && state.cvPreview.slug === p.slug ? state.cvPreview.view : p && p.cardView) || {};
  return { density: v.density === 'compact' ? 'compact' : 'roomy', show: { ...CARD_SHOW, ...(v.show || {}) } };
}
const TYPES =['feature', 'bug', 'task'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const state = { route: null, projects: [], inbox: [], project: null, openCard: null, showArchived: false, editing: false, dragging: false, lastSig: null };
try { state.showArchived = localStorage.getItem('aigile.showArchived') === '1'; } catch {}

const api = async (method, url, body) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
// A project's picture, or its emoji when it has none (AIG-175). Round, one em, so it sits where the emoji sat.
function pic(logo, emoji) { return logo ? `<img class="pic" src="${esc(logo)}" alt="">` : esc(emoji || ''); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (iso, bare) => {   // bare = without "ago", for "unanswered for 5m"
  const s = (Date.now() - new Date(iso)) / 1000, b = bare ? '.bare' : '';
  if (s < 60) return t('ago.now'); if (s < 3600) return t('ago' + b + '.m', { n: Math.floor(s / 60) });
  if (s < 86400) return t('ago' + b + '.h', { n: Math.floor(s / 3600) }); return t('ago' + b + '.d', { n: Math.floor(s / 86400) });
};
const $ = id => document.getElementById(id);


/* ---------- router ---------- */
function parseRoute() {
  if (location.hash === '#/inbox') return { view: 'inbox' };
  // One inbox list in its own window (AIG-104): q = messages, k = your to-dos, t = to test.
  const popList = location.hash.match(/^#\/pop-inbox\/([qkt])$/);
  if (popList) return { view: 'inbox', popList: popList[1] };
  if (/^#\/usage/.test(location.hash)) return { view: 'usage' };
  if (location.hash === '#/setup') return { view: 'setup' };
  if (location.hash === '#/standups') return { view: 'standups' };
  if (location.hash === '#/glossary') return { view: 'glossary' };
  if (location.hash === '#/pop-night') return { view: 'night' };   // 🌙 night glance pop-out (AIG-209)   // dev words explained (AIG-102)
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
  if (!i18n.ready) return;   // the language file comes first (AIG-124)
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
    } else if (state.route.view === 'standups') {
      state.standups = await api('GET', '/api/standups');
      sig = JSON.stringify([state.route, state.standups]);
    } else if (state.route.view === 'night') {
      [state.watch, state.projects, state.standups] = await Promise.all([api('GET', '/api/watchman').catch(() => null), api('GET', '/api/projects'), api('GET', '/api/standups').catch(() => null)]);
      sig = JSON.stringify([state.route, state.watch, state.projects.map(p => [p.slug, p.presence && p.presence.online]), state.standups && state.standups.blockers, Math.floor(Date.now() / 60e3)]);
    } else if (state.route.view === 'glossary') {
      sig = JSON.stringify([state.route, i18n.lang]);
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
    $('live').textContent = t('live.offline', { msg: e.message });
    return;
  }
  if (!force && state.dragging) return;
  if (!force && busy()) {
    // Keep the board behind moving; only hold the panel/dialog Rich is using.
    if (sig !== state.lastBoardSig) { state.lastBoardSig = sig; renderBoardOnly(); }
    if (sig !== state.lastSig) { $('live').className = 'live paused'; $('live').textContent = t('live.paused'); }
    return;
  }
  $('live').className = 'live';
  $('live').textContent = t('live.ok');
  if (!force && sig === state.lastSig) return;
  state.lastSig = state.lastBoardSig = sig;
  render();
}

function renderBoardOnly() {
  queueMicrotask(paintFilterBar);
  const keepBoardX = document.querySelector('.board')?.scrollLeft || 0;
  if (state.route.view === 'usage') return;
  if (state.route.view === 'standups') { $('app').innerHTML = renderStandups(); return; }
  $('app').innerHTML = state.route.view === 'home' ? renderHome() : renderBoard(state.project);
  const b = document.querySelector('.board'); if (b) b.scrollLeft = keepBoardX;
}

function render() {
  queueMicrotask(paintFilterBar);
  const keepScroll = document.querySelector('#modal .panel')?.scrollTop || 0;
  const keepBoardX = document.querySelector('.board')?.scrollLeft || 0;
  if (state.route.view === 'home') { $('crumb').textContent = ''; $('app').innerHTML = renderHome(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'setup') { $('crumb').textContent = '/ ' + t('crumb.setup'); if (!$('setupForm')) $('app').innerHTML = renderSetup(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'standups') { $('crumb').textContent = '/ ' + t('crumb.standups'); $('crumb').style.color = ''; $('app').innerHTML = renderStandups(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'night') { $('app').innerHTML = renderNight(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'glossary') { $('crumb').textContent = '/ ' + t('gloss.h'); if (!$('glossQ')) $('app').innerHTML = renderGlossary(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'usage') { $('crumb').textContent = '/ ' + t('crumb.usage'); $('app').innerHTML = renderUsagePage(); $('modal').innerHTML = ''; return; }
  const p = state.project;
  // A popped-out card (AIG-122): just the card, filling its own window; no header or board behind it.
  document.body.classList.toggle('pop', !!state.route.pop);
  if (state.route.pop) {
    const c = p.cards.find(x => x.id === state.route.card);
    $('app').innerHTML = '';
    $('modal').innerHTML = c ? renderCard(p, c) : `<p class="muted" style="padding:16px">${esc(t('card.gone'))}</p>`;
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
