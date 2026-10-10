/* ---------- team status: in flight, presence, wake ---------- */
// "Pixel → AIG-5 (12m ago)". Quiet for 30+ minutes = stale (amber), so stalled agents stand out.
function flightHtml(list) {
  return list.map(c => `<span class="${Date.now() - new Date(c.updated) > 30 * 60e3 ? 'stale' : ''}" title="${esc(c.title)}">${esc(c.assignee || 'unassigned')} → ${esc(c.id)} <span class="muted">(${ago(c.updated)})</span></span>`).join(' · ');
}

// Is the team working? Either a background run of ours, or a session heard from in the last 5 minutes (hooks, wait, status line).
function presenceHtml(p, withWake) {
  const pr = p.presence || {};
  const logBtn = withWake && p.path ? ` <button onclick="agentLog(event, '${p.slug}')">📄 Log</button>` : '';
  if (pr.running) return `<span class="pres on">🟢 Working in the background</span> <span class="muted">since ${ago(pr.startedAt)}</span>${withWake ? ` <button onclick="restartTeam(event, '${p.slug}')">⟳ Restart</button>` : ''}${logBtn}`;
  // Online without a run of ours = a session Rich opened himself (a terminal or VS Code window).
  // Where a session you opened runs (AIG-107): the CLI and hooks report VS Code or a terminal.
  const place = pr.where === 'vscode' ? '🧩 Working in VS Code' : pr.where === 'terminal' ? '🖥️ Working in a terminal' : '🖥️ Working in a window';
  if (pr.online) return `<span class="pres on" title="A session you opened: type to it in its own window">${place}</span> <span class="muted">heard ${ago(pr.lastHeard)}</span>`;
  const btn = withWake && p.path ? ` <button class="primary" onclick="wakeTeam(event, '${p.slug}')">▶ Wake the team</button>` : withWake ? ` <span class="muted">(connect a folder to wake it)</span>` : '';
  return `<span class="pres off">💤 Team asleep</span>${pr.lastHeard ? ` <span class="muted">last heard ${ago(pr.lastHeard)}</span>` : ''}${btn}${logBtn}`;
}
async function wakeTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target; b.disabled = true; b.textContent = 'Starting…';
  try { await api('POST', `/api/projects/${s}/wake`); refresh(true); }
  catch (err) { alert(err.message); b.disabled = false; b.textContent = '▶ Wake the team'; }
}
async function restartTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target; b.disabled = true; b.textContent = 'Restarting…';
  try { await api('POST', `/api/projects/${s}/restart`); refresh(true); }
  catch (err) { alert(err.message); b.disabled = false; b.textContent = '⟳ Restart'; }
}
async function agentLog(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  try {
    const r = await api('GET', `/api/projects/${s}/agentlog`);
    openDialog(`<h2>📄 Team log</h2><pre id="agentLog" style="max-height:60vh;overflow:auto;white-space:pre-wrap">${esc(r.text || 'Nothing yet.')}</pre><div class="actions"><button onclick="closeDialog()">Close</button></div>`, 'wide');
    const pre = $('agentLog'); if (pre) pre.scrollTop = pre.scrollHeight;
  } catch (err) { alert(err.message); }
}

/* ---------- board page ---------- */
function renderBoard(p) {
  // Team status lives in the top-right corner, next to the inbox (where Rich looks for notifications).
  const tt = $('teamTop'); const th = presenceHtml(p, true); if (tt.dataset.sig !== th) { tt.dataset.sig = th; tt.innerHTML = th; }
  const by = lanesBy(p.slug);
  const board = by ? lanesOf(p, by).map(([name, pool]) => `<div class="lane"><h4 class="lane-h">${esc(name)} <span class="muted">${pool.length}</span></h4><div class="board">${columnsHtml(p, pool)}</div></div>`).join('') || '<p class="muted">No cards match.</p>'
    : `<div class="board">${columnsHtml(p, p.cards)}</div>`;
  const team = (p.team || []).filter(m => !/retired/i.test(m.status || ''));
  const log = (p.log || []).slice().reverse().slice(0, 50);
  return `<div class="toolbar"><h2>${esc(p.name)}${p.archived ? ' <span class="pill">archived</span>' : ''}</h2>
      <button class="primary" onclick="newCard()">+ New</button>
      <button onclick="openDocs()">📄 Docs</button>
      <button class="bug" onclick="newCard({type:'bug',priority:'high',status:'team'})">🐞 Raise bug</button>
      <button onclick="happeningDialog()" title="A quick summary of where this project is at">👀 What's happening?</button>
      <button onclick="askTeamDialog()" title="Send the team a quick question; the answer comes back to your Messages">💬 Ask the team</button>
      <select class="lanesel" title="Group the board into rows" onchange="setLanes(this.value)">${LANES.map(([k, l]) => `<option value="${k}"${k === by ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <button onclick="viewsDialog()" title="Save the current search and filters as a view, or switch to one">👁 Views</button>
      <span class="grow"></span>
      <button onclick="connectDialog()" title="${p.path ? 'Connected to ' + esc(p.path) : 'Set this project up in a folder so its team uses the board'}">🔌 ${p.path ? 'Folder connected' : 'Connect folder'}</button>
      <button onclick="lookDialog()" title="This project's colour and emoji">🎨 Look</button>
      <button onclick="columnsDialog()" title="Rename, reorder, hide and colour this board's columns">⚙️ Columns</button>
      <button onclick="cardViewDialog()" title="Compact or roomy cards, and which details they show">🃏 Cards</button>
      ${p.path ? `<button onclick="permsDialog()" title="What this project's team may do without asking">🔐 Permissions</button>` : ''}
      <button onclick="${p.archived ? 'setArchived(false)' : 'setArchived(true)'}">${p.archived ? '📤 Unarchive project' : '📦 Archive project'}</button></div>
    <div class="flight">🛠 <b>In flight:</b> ${flightHtml(p.cards.filter(c => c.status === 'doing').sort((a, b) => b.updated.localeCompare(a.updated))) || '<span class="muted">nothing right now</span>'}</div>
    ${p.description || p.path ? `<p class="muted" style="margin-top:-6px">${esc(p.description)}${p.path ? ` <code>${esc(p.path)}</code>` : ''}</p>` : ''}
    ${board}
    <div class="side">
      <div class="box"><h3>Team</h3>${team.length ? `<table><tr><th>Member</th><th>Role</th><th>Working on</th><th>Status</th></tr>${team.map(m =>
        `<tr><td><b>${esc(m.name)}</b> <span class="muted">${esc(m.model)}</span></td><td>${esc(m.role)}</td><td>${esc(m.task)}</td><td>${esc(m.status)}</td></tr>`).join('')}</table>` : '<p class="muted">No team members yet.</p>'}</div>
      <div class="box"><h3>Log &amp; decisions</h3>${log.length ? `<ul class="log">${log.map(l =>
        `<li class="${l.kind}">${l.kind === 'decision' ? '⚖️ ' : ''}<b>${esc(l.author)}</b>: ${esc(l.text)} <span class="muted">${ago(l.at)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet.</p>'}</div>
    </div>`;
}

/* ---------- WIP limits (AIG-118) ---------- */
// The limit counts every card in the column, even ones a filter hides, so the header can't hide a full column.
const wipClass = (n, limit) => { const w = wipState(n, limit); return w ? 'wip-' + w : ''; };
const countHtml = (shown, all, limit) => limit ? `<span class="wipn" title="Limit ${limit}">${all} / ${limit}</span>` : String(shown);

/* ---------- swimlanes (AIG-120) ---------- */
// Optional rows grouping the board by assignee, type, sprint or priority. Browser-only, remembered per project.
const LANES = [['', '≡ Lanes: off'], ['assignee', '≡ By assignee'], ['type', '≡ By type'], ['sprint', '≡ By sprint'], ['priority', '≡ By priority']];
const LANE_NONE = { assignee: 'No assignee', sprint: 'No sprint' };
function lanesBy(slug) {
  state.lanes = state.lanes || {};
  if (!(slug in state.lanes)) { try { state.lanes[slug] = localStorage.getItem('aigile.lanes.' + slug) || ''; } catch { state.lanes[slug] = ''; } }
  return state.lanes[slug];
}
function setLanes(by) {
  const s = state.project.slug; state.lanes[s] = by;
  try { by ? localStorage.setItem('aigile.lanes.' + s, by) : localStorage.removeItem('aigile.lanes.' + s); } catch {}
  refresh(true);
}
// [[lane name, its cards]] for the cards passing the filter; empty lanes are left out.
function lanesOf(p, by) {
  const groups = new Map();
  for (const c of p.cards.filter(c => matchesFilter(c, p.slug))) {
    const k = String(c[by] || '').trim();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const rank = k => by === 'priority' ? -PRIORITIES.indexOf(k) : 0;   // urgent first
  return [...groups].sort(([a], [b]) => (!a) - (!b) || rank(a) - rank(b) || a.localeCompare(b)).map(([k, cs]) => [k || LANE_NONE[by] || 'None', cs]);
}
// The columns for a set of cards: the whole board, or one lane of it.
function columnsHtml(p, pool) {
  return colsOf(p).filter(c => !c.hidden).map(col => {
    const k = col.key, label = (col.emoji ? col.emoji + ' ' : '') + col.name, tint = col.color ? ` style="--colc:${esc(col.color)}"` : '';
    if (k === 'verify') return forYouColumn(p, label, tint, pool, col.wip);
    const cs = pool.filter(c => c.status === k && !forYou(c) && matchesFilter(c, p.slug)).sort((a, b) => b.updated.localeCompare(a.updated));
    const all = p.cards.filter(c => c.status === k && !forYou(c)).length;   // the limit counts the whole column (AIG-118)
    // Your own steps (AIG-117): one sub-column per step; cards with no or an old step sit in the first.
    if (col.steps.length) return col.steps.map((st, i) => {
      const mine = cs.filter(c => c.step === st || (i === 0 && !col.steps.includes(c.step)));
      return `<div class="column step ${wipClass(all, col.wip)}" data-status="${k}" data-step="${esc(st)}"${tint}><h3><span>${esc(label)} · ${esc(st)}</span><span>${i ? mine.length : countHtml(mine.length, all, col.wip)}</span></h3>${mine.map(cardHtml).join('')}</div>`;
    }).join('');
    return `<div class="column ${wipClass(all, col.wip)}" data-status="${k}"${tint}><h3><span>${esc(label)}</span><span>${countHtml(cs.length, all, col.wip)} <button class="colbtn" title="New card in ${esc(label)}" onclick="newCard({status:'${k}'})">+</button></span></h3>${cs.map(cardHtml).join('')}</div>`;
  }).join('');
}

/* ---------- For you column (AIG-106) ---------- */
// Everything waiting on the owner, whatever its status: tests, questions, tasks and blocks. Those cards show
// here instead of in their own column (their status doesn't change). Chips pick which kind comes first.
const KINDS = [['q', '❓ Questions'], ['t', '🧪 Tests'], ['k', '📋 Tasks']];
const isMine = c => String(c.assignee || '').trim().toLowerCase() === me().toLowerCase();
const forYou = c => c.status !== 'done' && (c.status === 'verify' || c.needsYou || c.blocked || isMine(c));
const kindOf = c => isMine(c) ? 'k' : c.status === 'verify' && !c.needsYou && !c.blocked ? 't' : 'q';
function forYouFirst(k) {
  if (k) { state.forYouFirst = k; try { localStorage.setItem('aigile.forYouFirst', k); } catch {} refresh(true); }
  if (!state.forYouFirst) { try { state.forYouFirst = localStorage.getItem('aigile.forYouFirst'); } catch {} }
  return state.forYouFirst || 'q';
}
function forYouColumn(p, label = 'For you', tint = '', pool = p.cards, wip = 0) {
  const first = forYouFirst(), rank = c => kindOf(c) === first ? 0 : 1 + KINDS.findIndex(([k]) => k === kindOf(c));
  // Within a kind, a queue: longest-waiting first, so 'Wait and see' sends a test to the back.
  const cs = pool.filter(c => forYou(c) && matchesFilter(c, p.slug)).sort((a, b) => rank(a) - rank(b) || a.updated.localeCompare(b.updated));
  const n = k => cs.filter(c => kindOf(c) === k).length;
  const chips = KINDS.map(([k, label]) => `<button class="fy-chip ${k === first ? 'on' : ''}" data-first="${k}" title="Show these first" onclick="forYouFirst('${k}')">${label} ${n(k)}</button>`).join('');
  const all = p.cards.filter(forYou).length;
  return `<div class="column foryou ${wipClass(all, wip)}" data-status="verify"${tint}><h3><span>${esc(label)}</span><span>${countHtml(cs.length, all, wip)}</span></h3><div class="fy-chips">${chips}</div>${cs.map(cardHtml).join('')}</div>`;
}

// show = the project's card view choices (board cards only); the card panel passes nothing and shows all.
function metaHtml(c, show = CARD_SHOW) {
  return `${show.type ? `<span class="pill">${esc(c.type)}</span>` : ''}
      ${show.priority && c.priority !== 'normal' ? `<span class="pill ${c.priority}">${esc(c.priority)}</span>` : ''}
      ${show.assignee && c.assignee ? `<span class="pill">👤 ${esc(c.assignee)}</span>` : ''}
      ${c.needsYou && c.status !== 'done' ? '<span class="pill you">needs you</span>' : ''}
      ${c.blocked ? '<span class="pill blocked">blocked</span>' : ''}
      ${snoozed(c) ? `<span class="pill snoozed">⏳ back at ${new Date(c.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button class="poke" onclick="event.preventDefault();event.stopPropagation();bringBack('${c.id}')">Bring back</button>` : ''}
      ${show.comments && c.comments.length ? `<span class="pill">💬 ${c.comments.length}</span>` : ''}
      ${show.age ? `<span class="pill age" title="Last updated">🕒 ${ago(c.updated)}</span>` : ''}`;
}

// Last time the team said or did something on a card (Rich's own comments and pokes don't count).
const STALE_MS = 30 * 60e3;
function lastHeard(c) {
  const m = [...c.comments].reverse().find(m => m.author.toLowerCase() !== 'rich');
  return m ? { who: m.author, at: m.at, text: m.text } : { who: c.assignee || 'team', at: c.created, text: '' };
}
function cardHtml(c) {
  const live = ['doing', 'review'].includes(c.status), heard = live && lastHeard(c);
  const stale = live && Date.now() - new Date(heard.at) > STALE_MS;
  const view = cardViewOf(state.project);
  const cls = [stale ? 'stale-card' : '', 'card', view.density === 'compact' ? 'compact' : '', (c.needsYou && c.status !== 'done') || c.status === 'verify' ? 'needs-you' : '', c.blocked ? 'is-blocked' : ''].join(' ');
  return `<a class="${cls}" href="#/p/${state.project.slug}/${c.id}" data-id="${c.id}" draggable="true" style="display:block">
    <div class="id">${esc(c.id)}${view.show.sprint && c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <div class="t">${esc(c.title)}</div>
    ${live ? `<div class="heard">💬 ${esc(heard.who)} ${ago(heard.at)}${heard.text ? ': ' + esc(heard.text.slice(0, 60).replace(/\n/g, ' ')) : ''}</div>` : ''}
    <div class="meta">${metaHtml(c, view.show)}${live ? `<button class="poke${stale ? ' hot' : ''}" title="Nudge the team: any update?" onclick="event.preventDefault();event.stopPropagation();poke('${c.id}')">👉 Poke</button>` : ''}</div></a>`;
}
const snoozed = c => c.status === 'verify' && c.snoozedUntil && new Date(c.snoozedUntil) > Date.now();
async function bringBack(id) {
  try { await api('DELETE', `/api/projects/${slug()}/cards/${id}/snooze`); refresh(true); } catch (e) { alert(e.message); }
}
async function poke(id) {
  try { await api('POST', `/api/projects/${slug()}/cards/${id}/poke`); refresh(true); } catch (e) { alert(e.message); }
}


/* ---------- drag and drop (native HTML5) ---------- */
const app = $('app');
app.addEventListener('dragstart', e => {
  const el = e.target.closest?.('.card'); if (!el) return;
  state.dragging = true;
  e.dataTransfer.setData('text/plain', el.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('dragging');
});
app.addEventListener('dragend', () => {
  state.dragging = false;
  document.querySelectorAll('.dragging, .dragover').forEach(x => x.classList.remove('dragging', 'dragover'));
  refresh();
});
app.addEventListener('dragover', e => {
  const col = e.target.closest?.('.column'); if (!col || !state.dragging) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.dragover').forEach(x => x !== col && x.classList.remove('dragover'));
  col.classList.add('dragover');
});
app.addEventListener('drop', async e => {
  const col = e.target.closest?.('.column'); if (!col || !state.dragging) return;
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain'), status = col.dataset.status, step = col.dataset.step || '';
  state.dragging = false;
  document.querySelectorAll('.dragging, .dragover').forEach(x => x.classList.remove('dragging', 'dragover'));
  const c = state.project.cards.find(c => c.id === id);
  if (!c || (c.status === status && (c.step || '') === step)) return;
  c.status = status; c.step = step; c.updated = new Date().toISOString(); render();   // optimistic
  try { await api('PATCH', `/api/projects/${slug()}/cards/${id}`, { status, step }); }
  catch (err) { alert('Could not move card: ' + err.message); }
  rerender();
});
