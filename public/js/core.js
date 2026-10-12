/* ---------- state, api, helpers ---------- */
// The board's human (AIG-103): name from /api/meta, default Owner.
const me = () => (typeof state !== 'undefined' && state.owner) || 'Owner';
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
const QKINDS = { decide: '❓', test: '🧪', server: '🖥️', outside: '🤝', keys: '🔑', read: '📖', life: '🏡' };
// 🏡 Real-life tasks (AIG-394): mirrors lib/life.js. A card with a lifeType is the owner's own task.
const LIFE_TYPES = { housework: ['🧹', '#0d9488'], appointment: ['📅', '#3b82f6'], shopping: ['🛒', '#ea580c'], call: ['📞', '#7c3aed'], bills: ['💷', '#16a34a'], errand: ['🚗', '#ca8a04'], health: ['🩺', '#dc2626'], family: ['🎁', '#db2777'], pets: ['🐾', '#92400e'] };
const lifeChip = c => LIFE_TYPES[c.lifeType] ? `<span class="pill life" style="background:${LIFE_TYPES[c.lifeType][1]};color:#fff" data-life="${esc(c.lifeType)}">${LIFE_TYPES[c.lifeType][0]} ${esc(t('life.' + c.lifeType))}</span>` : '';
const lifeDoneBtn = c => `<button class="q-chip life-done" data-lifedone="${esc(c.project || slug())}/${esc(c.id)}" title="${esc(t('life.done.title'))}">✅ ${esc(t('life.done'))}</button>`;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-lifedone]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.lifedone.split('/');
  try { await api('POST', `/api/projects/${s}/cards/${id}/lifedone`); refresh(true); if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload(); } catch (err) { alert(err.message); }
}, true);
const isOwnerTask = c => String(c.assignee || '').trim().toLowerCase() === me().toLowerCase();
// AIG-472: same rule as the server's taskReplied: the owner answered an open task and the team hasn't replied yet.
const taskReplied = c => {
  if (!isOwnerTask(c) || c.needsYou || c.blocked || c.status === 'verify') return false;
  const cs = c.comments || [], me0 = me().toLowerCase(), mine = m => String(m.author).trim().toLowerCase() === me0;
  const last = cs[cs.length - 1];
  return cs.some(m => m.mark === 'task' && !mine(m)) && !!last && mine(last) && !/^✅ Done/.test(last.text);
};
const PRIO_RANK = { now: 0, today: 1, whenever: 3 };   // no priority set sits between today and whenever
// An item's kind: what the team set, else a sensible guess (tests are tests, the rest are decisions).
const isInfo = c => !!c.info && c.status === 'verify' && !isOwnerTask(c);   // 📖 To read (AIG-392): an info-only hand-over
const kindOfItem = c => isOwnerTask(c) && c.lifeType ? 'life' : isOwnerTask(c) && c.server ? 'server' : isOwnerTask(c) && c.outside ? 'outside' : isInfo(c) ? 'read' : c.kind || (c.status === 'verify' ? 'test' : 'decide');
// Queue order: your priority, then what it holds up most, then quickest first.
const queueRank = (a, b) => (PRIO_RANK[a.ownerPrio] ?? 2) - (PRIO_RANK[b.ownerPrio] ?? 2) || (b.bumpedAt || '').localeCompare(a.bumpedAt || '') || (b.holds || []).length - (a.holds || []).length || (a.mins || 999) - (b.mins || 999);
/* ---------- ☑ checklist and ⏳ waits for (AIG-406) ---------- */
const checkLeft = c => (c.checklist || []).filter(x => !x.done).length;
const isWaitingCard = c => !!(c.waiting && c.waiting.length) && c.status !== 'done';
const checkChip = c => (c.checklist || []).length ? `<span class="pill chk${checkLeft(c) ? '' : ' all'}" data-chk title="${esc(t('check.chip.title', { done: c.checklist.length - checkLeft(c), n: c.checklist.length }))}">☑ ${c.checklist.length - checkLeft(c)}/${c.checklist.length}</span>` : '';
const waitChip = c => isWaitingCard(c) ? `<span class="pill waits" data-waits title="${esc(t('wait.chip.title', { ids: c.waiting.join(', ') }))}">⏳ ${esc(c.waiting.join(', '))}</span>` : '';
// Accept with an unfinished checklist: the first click turns the button into "2 of 4 left: accept anyway?", the second goes ahead.
function acceptSure(btn, c) {
  const left = c ? checkLeft(c) : 0;
  if (!left || !btn || btn.dataset.sure === '1') return true;
  btn.dataset.sure = '1'; btn.dataset.was = btn.textContent;
  btn.textContent = t('check.left', { left, n: c.checklist.length });
  setTimeout(() => { if (btn.isConnected && btn.dataset.sure === '1') { btn.dataset.sure = ''; btn.textContent = btn.dataset.was; } }, 8000);
  return false;
}
const bumpTime = at => new Date(at).toLocaleString(i18n.locale, { hour: '2-digit', minute: '2-digit', ...(Date.now() - new Date(at) > 864e5 ? { day: 'numeric', month: 'short' } : {}) });
function queueChips(c) {
  const k = kindOfItem(c), p = c.ownerPrio;
  const task = isOwnerTask(c);   // a task has a 🖥️ switch for a job on a server (AIG-320); the kind chip is its mark when on
  if (task && c.lifeType) return `<span class="q-chips"><span class="q-chip" title="${esc(t('queue.kind.life'))}">🏡 ${esc(t('queue.kind.life'))}</span>${lifeChip(c)}${c.apptAt ? `<span class="q-chip">📅 ${esc(timedWhen(c.apptAt))}</span>` : ''}${lifeDoneBtn(c)}</span>`;
  return `<span class="q-chips">` + (task && (c.server || c.outside) ? '' : `<span class="q-chip" title="${esc(t('queue.kind.' + k))}">${QKINDS[k]} ${esc(t('queue.kind.' + k))}</span>`)
    + (task ? `<button class="q-chip srv ${c.server ? 'on' : ''}" data-server="${esc(c.project || slug())}/${esc(c.id)}" data-on="${c.server ? 1 : 0}" title="${esc(t('queue.server.title'))}">🖥️${c.server ? ' ' + esc(t('queue.kind.server')) : ''}</button>` : '')
    + (task ? `<button class="q-chip srv ${c.outside ? 'on' : ''}" data-outside="${esc(c.project || slug())}/${esc(c.id)}" data-on="${c.outside ? 1 : 0}" title="${esc(t('queue.outside.title'))}">🤝${c.outside ? ' ' + esc(t('queue.kind.outside')) : ''}</button>` : '')
    + (task && c.server ? openServerBtn(c) : '')
    + `<button class="q-chip prio${p ? 'p-' + p : ''}" data-prio="${esc(c.project || slug())}/${esc(c.id)}" title="${esc(t('queue.prio.title'))}">🔥 ${esc(t('queue.prio.' + (p || 'none')))}</button>`
    + checkChip(c) + waitChip(c)
    + ((c.holds || []).length ? `<span class="q-chip holds" title="${esc(c.holds.join(', '))}">⛓ ${esc(t('queue.holds', { n: c.holds.length }))}</span>` : '')
    + (c.bumpedAt ? `<span class="q-chip bump" title="${esc(t('queue.bump.title', { count: c.bumps || 1, n: c.bumps || 1 }))}">⏫ ${esc(t('queue.bump', { at: bumpTime(c.bumpedAt) }))}</span>` : '')
    + (c.mins ? `<span class="q-chip">⏱ ${esc(t('queue.mins', { n: c.mins }))}</span>` : '') + '</span>';
}
// 🖥️ Open server (AIG-374): the names come from Setup > My servers (state.servers, via /api/meta). The card may name one
// (serverName); one saved server: that one; several: a small picker. The board opens only what Setup saved, by name.
function openServerBtn(c) {
  const names = state.servers; if (!names) return '';
  if (!names.length) return `<a class="q-chip srv-open" href="#/setup">${esc(t('server.setup'))}</a>`;
  const n = names.find(x => x.toLowerCase() === String(c.serverName || '').toLowerCase()) || (names.length === 1 ? names[0] : '');
  return (n ? `<button class="q-chip srv-open" data-open-server="${esc(n)}">${esc(t('server.open', { name: n }))}</button>`
    : `<button class="q-chip srv-open" data-pick-server>${esc(t('server.open.pick'))}</button>`) + Term.btn(c);   // ⌨ Terminal (AIG-471)
}
async function openServerNamed(name, btn) {
  try { await api('POST', '/api/servers/open', { name }); if (btn) { const was = btn.textContent; btn.textContent = '✓'; setTimeout(() => { btn.textContent = was; }, 1500); } }
  catch (err) { alert(err.message); }
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open-server]');
  if (o) { e.preventDefault(); e.stopPropagation(); if (o.closest('#dialog')) closeDialog(); openServerNamed(o.dataset.openServer, o.closest('#dialog') ? null : o); return; }
  if (e.target.closest('[data-pick-server]')) { e.preventDefault(); e.stopPropagation();
    openDialog(`<h2>${esc(t('server.pick'))}</h2>` + (state.servers || []).map(n => `<p><button data-open-server="${esc(n)}">${esc(t('server.open', { name: n }))}</button></p>`).join('')); }
}, true);
// Click 🔥 to change your priority: none → now → today → whenever → none.
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-prio]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.prio.split('/'), order = ['', 'now', 'today', 'whenever'];
  const cur = (b.className.match(/p-(\w+)/) || [])[1] || '';
  try { await api('PATCH', `/api/projects/${s}/cards/${id}`, { ownerPrio: order[(order.indexOf(cur) + 1) % order.length] }); refresh(true); if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload(); } catch (err) { alert(err.message); }
}, true);
// Click 🖥️ on a task to mark (or unmark) it as a job for a server.
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-server]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.server.split('/');
  try { await api('PATCH', `/api/projects/${s}/cards/${id}`, { server: b.dataset.on !== '1' }); refresh(true); if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload(); } catch (err) { alert(err.message); }
}, true);
// Click 🤝 on a task to mark (or unmark) it as waiting on another person or an outside AI.
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-outside]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.outside.split('/');
  try { await api('PATCH', `/api/projects/${s}/cards/${id}`, { outside: b.dataset.on !== '1' }); refresh(true); if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload(); } catch (err) { alert(err.message); }
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
  return typeof Streamer !== 'undefined' && Streamer.on() ? Streamer.filter(method, url, j) : j;   // 🎥 streamer mode (AIG-590)
};
// A project's picture, or its emoji when it has none (AIG-175). Round, one em, so it sits where the emoji sat.
function pic(logo, emoji) { return logo ? `<img class="pic" src="${esc(logo)}" alt="">` : esc(emoji || ''); }
// Profile pictures (AIG-150): yours from Setup (meta.ownerPic), an agent's from the picture library (m.avatar on the team).
const avatarUrl = f => !f ? '' : /^badge:/.test(f) ? '/api/avatars/badge/' + f.slice(6) : '/api/avatars/' + encodeURIComponent(f);   // badge:fox/teal/glasses (AIG-396)
function faceUrl(name, team) {
  if (isOwner(name)) return state.ownerPic || '';
  const m = (team || []).find(m => m.name.toLowerCase() === String(name || '').trim().toLowerCase());
  return m ? avatarUrl(m.avatar) : '';
}
const face = (name, team) => { const u = faceUrl(name, team); return u ? `<img class="face" src="${esc(u)}" alt="" title="${esc(name)}">` : ''; };
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
  if (location.hash === '#/assumptions') return { view: 'assumptions' };
  if (location.hash === '#/whats-new') return { view: 'whatsnew' };   // ✨ release notes (AIG-562)
  if (location.hash === '#/setup') return { view: 'setup' };
  const suRoute = location.hash.match(/^#\/standups(?:\/([^/]+))?$/);   // AIG-539: #/standups/<project> shows one team
  if (suRoute) return { view: 'standups', ...(suRoute[1] ? { slug: decodeURIComponent(suRoute[1]) } : {}) };
  if (location.hash === '#/glossary') return { view: 'glossary' };
  if (location.hash === '#/pop-night') return { view: 'night' };   // 🌙 night glance pop-out (AIG-209)   // dev words explained (AIG-102)
  const watch = location.hash.match(/^#\/pop-watch\/([^/]+)$/);
  if (watch) return { view: 'watch', slug: watch[1] };   // 👁 Watch a verbose team in its own window (AIG-154)
  const news = location.hash.match(/^#\/pop-news\/([^/]+)$/);
  if (news) return { view: 'news', slug: news[1] };   // 📜 Team news in its own window (AIG-319)
  const shared = location.hash.match(/^#\/shared\/([A-Za-z0-9_-]{22})$/);
  if (shared) return { view: 'shared', link: shared[1] };   // a project a friend shares with me, as its own board (AIG-324)
  const term = location.hash.match(/^#\/pop-term\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (term) return { view: 'term', slug: decodeURIComponent(term[1]), card: decodeURIComponent(term[2]), name: decodeURIComponent(term[3]) };   // ⌨ a terminal in its own window (AIG-471)
  const pop = location.hash.match(/^#\/pop\/([^/]+)\/([^/]+)/);
  if (pop) return { view: 'project', slug: pop[1], card: pop[2], pop: true };
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/([^/]+))?/);
  return m ? { view: 'project', slug: m[1], card: m[2] || null } : { view: 'home' };
}

/* ---------- refresh and render loop ---------- */
// The 1s poll must never wipe out what the owner is typing or a drag in progress.
// busy() = a dialog is open, a card is being edited, a drag is running, a field has focus,
// or any field in the panel holds unsent text. While busy we skip re-rendering (data is re-fetched
// each tick and renders as soon as the owner is done, because the signature differs).
function busy() {
  if (state.dragging || state.editing || $('dialog').firstChild) return true;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('modal').contains(a)) return true;
  // An input with no type is a text box too (the checklist's "add a step"); an open ⏰ picker holds a half-made choice.
  if (document.querySelector('#modal #tm-box:not([hidden])')) return true;
  return [...document.querySelectorAll('#modal textarea, #modal input[type=text], #modal input:not([type])')].some(el => el.value !== el.defaultValue);
}

// The render signature (AIG-310): presence.waitingMs ticks on every request while a team sits in 'aigile wait', so it is
// left out; with it in, the board and the open card were redrawn every second and the panel flickered.
const renderSig = x => JSON.stringify(x, (k, v) => k === 'waitingMs' ? undefined : v);
async function refresh(force) {
  if (!i18n.ready || Boot.failed) return;   // the language file comes first (AIG-124); a broken start-up reloads instead (AIG-517)
  if (state.route && state.route.view === 'project') state.lastProject = state.route.slug; else if (state.route && state.route.view !== 'inbox') state.lastProject = null;
  state.route = parseRoute();
  const route = JSON.stringify(state.route);
  if (state.route.view !== 'project') { $('teamTop').innerHTML = ''; $('teamTop').dataset.sig = ''; $('filterbar').innerHTML = ''; $('filterbar').dataset.slug = ''; }
  // The inbox page renders itself; forget the last render so leaving it always redraws.
  if (state.route.view === 'inbox') { state.lastSig = state.lastBoardSig = null; return Inbox.show(force); }
  let sig;
  try {
    if (state.route.view === 'home') {
      const q = state.showArchived ? '?all=1' : '';
      [state.projects, state.inbox, state.usage, state.sm] = await Promise.all([api('GET', '/api/projects' + q), api('GET', '/api/inbox'), api('GET', '/api/usage').catch(() => ({ enabled: false })), api('GET', '/api/scrummaster').catch(() => null)]);
      sig = renderSig([state.route, state.projects, state.inbox, state.usage, state.sm && [state.sm.on, state.sm.where, state.sm.listening, state.sm.running, state.sm.lastRunAt, state.sm.lastRound]]);
    } else if (state.route.view === 'setup') {
      state.setup = await api('GET', '/api/setup');
      sig = JSON.stringify([state.route, state.setup]);
    } else if (state.route.view === 'standups') {
      state.standups = await api('GET', '/api/standups');
      sig = JSON.stringify([state.route, state.standups]);
    } else if (state.route.view === 'night') {
      [state.watch, state.projects, state.standups] = await Promise.all([api('GET', '/api/watchman').catch(() => null), api('GET', '/api/projects'), api('GET', '/api/standups').catch(() => null)]);
      sig = JSON.stringify([state.route, state.watch, state.projects.map(p => [p.slug, p.presence && p.presence.online]), state.standups && state.standups.blockers, Math.floor(Date.now() / 60e3)]);
    } else if (state.route.view === 'watch') {
      state.watchLog = await api('GET', `/api/projects/${state.route.slug}/agentlog`);
      sig = JSON.stringify([state.route, state.watchLog, Math.floor(Date.now() / 60e3)]);
    } else if (state.route.view === 'news') {
      state.news = await api('GET', `/api/projects/${state.route.slug}/news`);
      sig = JSON.stringify([state.route, state.news, Math.floor(Date.now() / 60e3)]);
    } else if (state.route.view === 'term') {
      sig = JSON.stringify([state.route, i18n.lang]);
    } else if (state.route.view === 'glossary') {
      sig = JSON.stringify([state.route, i18n.lang]);
    } else if (state.route.view === 'shared') {
      state.sboard = await api('GET', `/api/shares/${state.route.link}/board`).catch(() => null);
      sig = JSON.stringify([state.route, state.sboard, i18n.lang]);
    } else if (state.route.view === 'assumptions') {
      await Assumptions.load();
      sig = JSON.stringify([state.route, Assumptions.data]);
    } else if (state.route.view === 'whatsnew') {
      await WhatsNew.load();
      sig = JSON.stringify([state.route, WhatsNew.data, i18n.lang]);
    } else if (state.route.view === 'usage') {
      if (!uz.data) { state.lastSig = state.lastBoardSig = null; render(); }   // AIG-558: say "Loading" at once, not after the fetch
      await loadUsagePage(force);   // heavy, so at most every ~15s
      sig = JSON.stringify([state.route, uzSig()]);
    } else {
      state.project = await api('GET', '/api/projects/' + state.route.slug);
      await loadDocs(state.route.slug);
      await loadProfiles();   // the role templates, for roles added from a team (AIG-423)
      sig = renderSig([state.route, state.project]);
    }
  } catch (e) {
    $('live').className = 'live off';
    $('live').textContent = t('live.offline', { msg: e.message });
    if (!$('app').firstElementChild) Boot.note();   // nothing drawn yet (AIG-517): say so; the 1s poll tries again
    return;
  }
  if (JSON.stringify(parseRoute()) !== route) return;   // AIG-558: the page moved on while this fetched; a newer refresh draws it
  if (!force && state.dragging) return;
  if (!force && busy()) {
    // Keep the board behind moving; only hold the panel/dialog the owner is using.
    if (sig !== state.lastBoardSig) { state.lastBoardSig = sig; renderBoardOnly(); }
    if (state.route.pop && sig !== state.lastSig && popChatLive()) { state.lastSig = sig; return; }   // a chat keeps moving while you type (AIG-313)
    if (!state.route.pop && state.route.view === 'project' && state.route.card && sig !== state.lastSig && cardLive()) { $('live').className = 'live'; $('live').textContent = t('live.ok'); return; }   // new messages land under a half-typed reply (AIG-314)
    if (sig !== state.lastSig) { $('live').className = 'live paused'; $('live').textContent = t('live.paused'); }
    return;
  }
  $('live').className = 'live';
  $('live').textContent = t('live.ok');
  if (!force && sig === state.lastSig) return;
  state.lastSig = state.lastBoardSig = sig;
  // AIG-485: a render that throws (a script half-loaded while the app restarted) must not leave a blank page that
  // never redraws: forget the signature so the next tick tries again, and say so instead of showing nothing.
  // AIG-517: always the note with a Reload button (a half-drawn page, or the last page's leftovers, is worse).
  try { render(); }
  catch (e) {
    state.lastSig = state.lastBoardSig = null;
    $('live').className = 'live off'; $('live').textContent = t('live.offline', { msg: e.message });
    const h = `<div class="render-note" role="alert" style="padding:24px"><p>${esc(t('boot.broke'))}</p><p class="muted"><code>${esc(e.message)}</code></p><button class="primary" onclick="location.reload()">${esc(t('boot.reload'))}</button></div>`;
    if ($('app').dataset.broke !== h || !$('app').querySelector('.render-note')) { $('app').innerHTML = h; $('app').dataset.broke = h; }
    console.error(e);
    return;
  }
  delete $('app').dataset.broke;
}

function renderBoardOnly() {
  queueMicrotask(paintFilterBar);
  const keepBoardX = document.querySelector('.board')?.scrollLeft || 0;
  if (state.route.view === 'usage') return;
  if (state.route.view === 'assumptions') { $('app').innerHTML = Assumptions.render(); return; }
  if (state.route.view === 'whatsnew') { $('app').innerHTML = WhatsNew.render(); return; }
  if (state.route.view === 'standups') { $('app').innerHTML = renderStandups(); return; }
  if (state.route.view === 'shared') { $('app').innerHTML = ShareBoard.render(state.sboard); return; }
  // Only the home page and a board are painted here; Setup, the inbox and the rest paint themselves (AIG-335: no project yet on a fresh board).
  if (state.route.view !== 'home' && !(state.route.view === 'project' && state.project)) return;
  $('app').innerHTML = state.route.view === 'home' ? renderHome() : renderBoard(state.project);
  const b = document.querySelector('.board'); if (b) b.scrollLeft = keepBoardX;
}

// The open card is only rebuilt when its own HTML changed (AIG-310), so a change elsewhere on the board doesn't
// reload its pictures and jump its layout. Anything else that wrote into #modal since is always replaced.
function paintModal(html) {
  const m = $('modal');
  if (m._html === html && m.firstChild === m._node) return;
  m.innerHTML = html; m._html = html; m._node = m.firstChild;
}
function render() {
  queueMicrotask(paintFilterBar);
  const keepScroll = document.querySelector('#modal .panel')?.scrollTop || 0;
  const keepBoardX = document.querySelector('.board')?.scrollLeft || 0;
  if (state.route.view === 'home') { $('crumb').textContent = ''; $('app').innerHTML = renderHome(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'setup') { $('crumb').textContent = '/ ' + t('crumb.setup'); if (!$('setupForm')) $('app').innerHTML = renderSetup(); $('modal').innerHTML = ''; wizardMaybe(); return; }
  if (state.route.view === 'standups') { $('crumb').textContent = '/ ' + t('crumb.standups'); $('crumb').style.color = ''; $('app').innerHTML = renderStandups(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'term') { $('app').innerHTML = ''; $('modal').innerHTML = ''; Term.popView(state.route); return; }
  if (state.route.view === 'night') { $('app').innerHTML = renderNight(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'news') { $('app').innerHTML = renderNews(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'watch') { renderWatch(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'glossary') { $('crumb').textContent = '/ ' + t('gloss.h'); if (!$('glossQ')) $('app').innerHTML = renderGlossary(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'shared') { $('crumb').textContent = '/ 🔗 ' + (state.sboard ? state.sboard.theirName || state.sboard.friend : ''); $('crumb').style.color = ''; $('app').innerHTML = ShareBoard.render(state.sboard); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'assumptions') { $('crumb').textContent = '/ ' + t('assume.nav'); $('app').innerHTML = Assumptions.render(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'whatsnew') { $('crumb').textContent = '/ ' + t('wn.title'); $('app').innerHTML = WhatsNew.render(); $('modal').innerHTML = ''; return; }
  if (state.route.view === 'usage') { $('crumb').textContent = '/ ' + t('crumb.usage'); $('app').innerHTML = renderUsagePage(); $('modal').innerHTML = ''; return; }
  const p = state.project;
  // A popped-out card (AIG-122): just the card, filling its own window; no header or board behind it.
  document.body.classList.toggle('pop', !!state.route.pop);
  if (state.route.pop) {
    const c = p.cards.find(x => x.id === state.route.card);
    $('app').innerHTML = '';
    const de = document.documentElement, first = !$('modal')._html, y = window.scrollY, atEnd = first || de.scrollHeight - y - window.innerHeight < 60;   // chat: follow the newest unless scrolled up
    paintModal(c ? renderCard(p, c) : `<p class="muted" style="padding:16px">${esc(t('card.gone'))}</p>`);
    const pp = document.querySelector('#modal .panel'); if (pp) pp.scrollTop = keepScroll;
    window.scrollTo(0, atEnd ? de.scrollHeight : y);
    return;
  }
  if (!p) return;   // not loaded yet (a refresh can land before the project does)
  // 🪐 The spaces it sits in come first (AIG-434): / Idea Playground / JointPassingBot.
  $('crumb').textContent = '/ ' + ((p.space && p.space.up) || []).map(u => u.name + ' / ').join('') + (p.emoji ? p.emoji + ' ' : '') + p.name;
  $('crumb').style.color = p.color || '';
  $('app').innerHTML = renderBoard(p);
  const card = state.route.card && p.cards.find(c => c.id === state.route.card);
  if (!card) state.editing = false;
  paintModal(card ? renderCard(p, card) : '');
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

// A small note at the bottom that fades by itself (AIG-259), instead of a Windows alert box for good news.
function note(msg) {
  let n = document.getElementById('note'); if (!n) { n = document.createElement('div'); n.id = 'note'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
  n.textContent = msg; n.classList.add('on'); clearTimeout(note.t); note.t = setTimeout(() => n.classList.remove('on'), 4000);
}
