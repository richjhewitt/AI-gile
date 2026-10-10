/* ---------- team status: in flight, presence, wake ---------- */
// "Pixel → AIG-5 (12m ago)". Quiet for 30+ minutes = stale (amber), so stalled agents stand out.
function flightHtml(list) {
  return list.map(c => `<span class="${Date.now() - new Date(c.updated) > 30 * 60e3 ? 'stale' : ''}" title="${esc(c.title)}">${esc(c.assignee || 'unassigned')} → ${esc(c.id)} <span class="muted">(${ago(c.updated)})</span></span>`).join(' · ');
}

// Is the team's session running? (heard from in the last 5 minutes: hooks, wait, status line)
function presenceHtml(p, withWake) {
  const pr = p.presence || {};
  if (pr.online) return `<span class="pres on">🟢 Team online</span> <span class="muted">heard ${ago(pr.lastHeard)}</span>`;
  if (pr.waking) return `<span class="pres wake">⏳ Waking the team…</span> <span class="muted">a terminal window has opened</span>`;
  const btn = withWake && p.path ? ` <button class="primary" onclick="wakeTeam(event, '${p.slug}')">▶ Wake the team</button>` : withWake ? ` <span class="muted">(connect a folder to wake it)</span>` : '';
  return `<span class="pres off">💤 Team asleep</span>${pr.lastHeard ? ` <span class="muted">last heard ${ago(pr.lastHeard)}</span>` : ''}${btn}`;
}
async function wakeTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target; b.disabled = true; b.textContent = 'Opening…';
  try { await api('POST', `/api/projects/${s}/wake`); refresh(true); }
  catch (err) { alert(err.message); b.disabled = false; b.textContent = '▶ Wake the team'; }
}

/* ---------- board page ---------- */
function renderBoard(p) {
  // Team status lives in the top-right corner, next to the inbox (where Rich looks for notifications).
  const tt = $('teamTop'); const th = presenceHtml(p, true); if (tt.dataset.sig !== th) { tt.dataset.sig = th; tt.innerHTML = th; }
  const cols = Object.entries(COLS).map(([k, label]) => {
    // 'For you to test' is a queue: longest-waiting first, so 'Wait and see' sends a card to the back.
    const cs = p.cards.filter(c => c.status === k && matchesFilter(c, p.slug)).sort((a, b) => k === 'verify' ? a.updated.localeCompare(b.updated) : b.updated.localeCompare(a.updated));
    return `<div class="column" data-status="${k}"><h3><span>${label}</span><span>${cs.length} <button class="colbtn" title="New card in ${esc(label)}" onclick="newCard({status:'${k}'})">+</button></span></h3>${cs.map(cardHtml).join('')}</div>`;
  }).join('');
  const team = (p.team || []).filter(m => !/retired/i.test(m.status || ''));
  const log = (p.log || []).slice().reverse().slice(0, 50);
  return `<div class="toolbar"><h2>${esc(p.name)}${p.archived ? ' <span class="pill">archived</span>' : ''}</h2>
      <button class="primary" onclick="newCard()">+ New</button>
      <button onclick="openDocs()">📄 Docs</button>
      <button class="bug" onclick="newCard({type:'bug',priority:'high',status:'team'})">🐞 Raise bug</button>
      <span class="grow"></span>
      <button onclick="connectDialog()" title="${p.path ? 'Connected to ' + esc(p.path) : 'Set this project up in a folder so its team uses the board'}">🔌 ${p.path ? 'Folder connected' : 'Connect folder'}</button>
      <button onclick="${p.archived ? 'setArchived(false)' : 'setArchived(true)'}">${p.archived ? '📤 Unarchive project' : '📦 Archive project'}</button></div>
    <div class="flight">🛠 <b>In flight:</b> ${flightHtml(p.cards.filter(c => c.status === 'doing').sort((a, b) => b.updated.localeCompare(a.updated))) || '<span class="muted">nothing right now</span>'}</div>
    ${p.description || p.path ? `<p class="muted" style="margin-top:-6px">${esc(p.description)}${p.path ? ` <code>${esc(p.path)}</code>` : ''}</p>` : ''}
    <div class="board">${cols}</div>
    <div class="side">
      <div class="box"><h3>Team</h3>${team.length ? `<table><tr><th>Member</th><th>Role</th><th>Working on</th><th>Status</th></tr>${team.map(m =>
        `<tr><td><b>${esc(m.name)}</b> <span class="muted">${esc(m.model)}</span></td><td>${esc(m.role)}</td><td>${esc(m.task)}</td><td>${esc(m.status)}</td></tr>`).join('')}</table>` : '<p class="muted">No team members yet.</p>'}</div>
      <div class="box"><h3>Log &amp; decisions</h3>${log.length ? `<ul class="log">${log.map(l =>
        `<li class="${l.kind}">${l.kind === 'decision' ? '⚖️ ' : ''}<b>${esc(l.author)}</b>: ${esc(l.text)} <span class="muted">${ago(l.at)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet.</p>'}</div>
    </div>`;
}

function metaHtml(c) {
  return `<span class="pill">${esc(c.type)}</span>
      ${c.priority !== 'normal' ? `<span class="pill ${c.priority}">${esc(c.priority)}</span>` : ''}
      ${c.assignee ? `<span class="pill">👤 ${esc(c.assignee)}</span>` : ''}
      ${c.needsYou && c.status !== 'done' ? '<span class="pill you">needs you</span>' : ''}
      ${c.blocked ? '<span class="pill blocked">blocked</span>' : ''}
      ${snoozed(c) ? `<span class="pill snoozed">⏳ back at ${new Date(c.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button class="poke" onclick="event.preventDefault();event.stopPropagation();bringBack('${c.id}')">Bring back</button>` : ''}
      ${c.comments.length ? `<span class="pill">💬 ${c.comments.length}</span>` : ''}`;
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
  const cls = [stale ? 'stale-card' : '', 'card', (c.needsYou && c.status !== 'done') || c.status === 'verify' ? 'needs-you' : '', c.blocked ? 'is-blocked' : ''].join(' ');
  return `<a class="${cls}" href="#/p/${state.project.slug}/${c.id}" data-id="${c.id}" draggable="true" style="display:block">
    <div class="id">${esc(c.id)}${c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <div class="t">${esc(c.title)}</div>
    ${live ? `<div class="heard">💬 ${esc(heard.who)} ${ago(heard.at)}${heard.text ? ': ' + esc(heard.text.slice(0, 60).replace(/\n/g, ' ')) : ''}</div>` : ''}
    <div class="meta">${metaHtml(c)}${live ? `<button class="poke${stale ? ' hot' : ''}" title="Nudge the team: any update?" onclick="event.preventDefault();event.stopPropagation();poke('${c.id}')">👉 Poke</button>` : ''}</div></a>`;
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
  const id = e.dataTransfer.getData('text/plain'), status = col.dataset.status;
  state.dragging = false;
  document.querySelectorAll('.dragging, .dragover').forEach(x => x.classList.remove('dragging', 'dragover'));
  const c = state.project.cards.find(c => c.id === id);
  if (!c || c.status === status) return;
  c.status = status; c.updated = new Date().toISOString(); render();   // optimistic
  try { await api('PATCH', `/api/projects/${slug()}/cards/${id}`, { status }); }
  catch (err) { alert('Could not move card: ' + err.message); }
  rerender();
});
