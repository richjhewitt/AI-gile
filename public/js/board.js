/* ---------- team status: in flight, presence, wake ---------- */
// "Pixel → AIG-5 (12m ago)". Quiet for 30+ minutes = stale (amber), so stalled agents stand out.
// A 🐝 swarm worker (AIG-901, c.worker = its branch) opens its own log on click.
function flightHtml(list, s) {
  return list.map(c => c.worker
    ? `<span class="flight-worker" data-worker="${esc(c.id)}" title="${esc(t('swarm.worker.title', { branch: c.worker, title: c.title }))}" style="cursor:pointer" onclick="agentLog(event, '${esc(s || slug())}', '${esc(c.id)}')">🐝 ${esc(c.assignee || t('swarm.worker'))} → ${esc(c.id)} <span class="muted">(${ago(c.updated)})</span></span>`
    : `<span class="${Date.now() - new Date(c.updated) > 30 * 60e3 ? 'stale' : ''}" title="${esc(c.title)}">${esc(c.assignee || t('board.unassigned'))} → ${esc(c.id)} <span class="muted">(${ago(c.updated)})</span></span>`).join(' · ');
}
// The board's In flight list: cards in progress plus 🐝 swarm workers (AIG-901) whose card is still in To do.
function flightList(p) {
  const ws = (p.presence && p.presence.workers) || [], doing = p.cards.filter(c => c.status === 'doing').sort((a, b) => b.updated.localeCompare(a.updated));
  const list = doing.map(c => { const w = ws.find(x => x.id === c.id); return w ? { ...c, worker: w.branch } : c; });
  for (const w of ws) { const c = !list.some(f => f.id === w.id) && p.cards.find(c => c.id === w.id); if (c) list.unshift({ ...c, updated: w.startedAt, worker: w.branch }); }
  return list;
}

// Is the team working? Either a background run of ours, or a session heard from in the last 5 minutes (hooks, wait, status line).
function presenceHtml(p, withWake) {
  const pr = p.presence || {};
  // A verbose project gets 👁 Watch (the log, live) in place of 📄 Log (AIG-154).
  const logBtn = !withWake || !p.path ? '' : p.verbose ? ` <button onclick="watchTeam(event, '${p.slug}')">${esc(t('pres.watch'))}</button>`
    : ` <button onclick="agentLog(event, '${p.slug}')">${esc(t('pres.log'))}</button>`;
  if (pr.running) return `<span class="pres on">${esc(t('pres.background'))}</span> <span class="muted">${esc(t('pres.since', { when: ago(pr.startedAt) }))}</span>${withWake ? ` <button onclick="restartTeam(event, '${p.slug}')">${esc(t('pres.restart'))}</button>` : ''}${logBtn}`;
  // Online without a run of ours = a session the owner opened himself (a terminal or VS Code window).
  // Where a session you opened runs (AIG-107): the CLI and hooks report VS Code or a terminal.
  const place = t(pr.where === 'vscode' ? 'pres.vscode' : pr.where === 'terminal' ? 'pres.terminal' : 'pres.window');
  if (pr.online) return `<span class="pres on" title="${esc(t('pres.session.title'))}">${esc(place)}</span> <span class="muted">${esc(t('pres.heard', { when: ago(pr.lastHeard) }))}</span>`;
  const btn = withWake && p.path ? ` <button class="primary" onclick="wakeTeam(event, '${p.slug}')">${esc(t('pres.wake'))}</button>` : withWake ? ` <span class="muted">${esc(t('pres.connect'))}</span>` : '';
  // A window the board opened (AIG-153): it can't see that run, so it says when it opened it, and ▶ Wake opens another.
  const op = pr.opened;
  if (op && Date.now() - new Date(op.at) < 15 * 60e3) return `<span class="pres on" title="${esc(t('runin.blind'))}">${esc(t('pres.opened.' + op.where))}</span> <span class="muted">${esc(t('pres.opened.since', { when: ago(op.at) }))}</span>${btn}${logBtn}`;
  return `<span class="pres off">${esc(t('pres.asleep'))}</span>${pr.lastHeard ? ` <span class="muted">${esc(t('pres.lastheard', { when: ago(pr.lastHeard) }))}</span>` : ''}${btn}${logBtn}`;
}
async function wakeTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target; b.disabled = true; b.textContent = t('pres.starting');
  try { await api('POST', `/api/projects/${s}/wake`); refresh(true); }
  catch (err) { openDialog(`<h2>${esc(t('pres.wake'))}</h2><p style="white-space:pre-wrap">${esc(err.message)}</p><div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`); b.disabled = false; b.textContent = t('pres.wake'); }
}
async function restartTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target; b.disabled = true; b.textContent = t('pres.restarting');
  try { await api('POST', `/api/projects/${s}/restart`); refresh(true); }
  catch (err) { alert(err.message); b.disabled = false; b.textContent = t('pres.restart'); }
}
async function agentLog(e, s = slug(), worker = '') {   // worker: a 🐝 swarm worker's card id (AIG-901)
  e.preventDefault(); e.stopPropagation();
  try {
    const r = await api('GET', `/api/projects/${s}/agentlog${worker ? '?worker=' + encodeURIComponent(worker) : ''}`);
    const stop = worker && r.running ? `<button id="workerStop" onclick="stopWorker('${esc(s)}', '${esc(worker)}')">${esc(t('swarm.worker.stop'))}</button>` : '';
    openDialog(`<h2>${esc(worker ? t('swarm.worker.log', { id: worker, branch: r.branch || '' }) : t('pres.log.h'))}</h2><pre id="agentLog" style="max-height:60vh;overflow:auto;white-space:pre-wrap">${esc(r.text || t('pres.log.empty'))}</pre><div class="actions">${stop}<button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
    const pre = $('agentLog'); if (pre) pre.scrollTop = pre.scrollHeight;
  } catch (err) { alert(err.message); }
}
async function stopWorker(s, id) {
  try { await api('POST', `/api/projects/${s}/workers/${encodeURIComponent(id)}/stop`); closeDialog(); refresh(true); } catch (err) { alert(err.message); }
}

/* ---------- 👁 Watch (AIG-154) ---------- */
// A verbose team's latest run as it goes: asks every 2.5 s while open and keeps to the bottom, unless you scrolled up to read.
const watchBody = () => `<div id="watchState" class="muted"></div><pre id="watchLog" class="watchlog"></pre>`;
function paintWatch(r) {
  const pre = $('watchLog'); if (!pre || !r) return;
  // Only the latest run: from its last "=== ... started" line.
  const ls = String(r.text || '').split('\n'), i = ls.map(l => /^=== .* started/.test(l)).lastIndexOf(true);
  const txt = ls.slice(Math.max(0, i)).join('\n').trim() || t('pres.log.empty');
  const end = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
  if (pre.textContent !== txt) { pre.textContent = txt; if (end) pre.scrollTop = pre.scrollHeight; }
  $('watchState').textContent = (r.running ? t('eye.running', { when: ago(r.startedAt) }) : t('eye.idle')) + (r.verbose ? '' : ' ' + t('eye.off'));
}
async function watchTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  openDialog(`<h2>${esc(t('eye.h'))} <button class="watch-pop" title="${esc(t('eye.pop'))}" onclick="popOut('watch', '#/pop-watch/${s}', 'aigile-watch-${s}', 620, 720)">⧉</button></h2>
    ${watchBody()}<div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
  const tick = async () => { if (!$('watchLog')) return timer(); try { paintWatch(await api('GET', `/api/projects/${s}/agentlog`)); } catch {} };
  const timer = PagePoll.every(tick, 3000, { immediate: true });
}
// The pop-out (#/pop-watch/<slug>) rides the 1 s page poll; the shell is drawn once so scrolling up to read stays put.
function renderWatch() {
  document.body.classList.add('poplist');
  if (!$('watchLog')) $('app').innerHTML = `<h3 style="margin:4px 0">${esc(t('eye.h'))} · ${esc(state.route.slug)}</h3>${watchBody()}`;
  paintWatch(state.watchLog);
}

/* ---------- 📜 Team news (AIG-319) ---------- */
// Every team comment on the project's cards, newest first, in its own window (#/pop-news/<slug>), redrawn by the 1 s poll.
function openNews(s) { popOut('news', '#/pop-news/' + s, 'aigile-news-' + s, 520, 760); }
function renderNews() {
  document.body.classList.add('poplist');
  const s = state.route.slug, list = state.news || [];
  const top = `<h3 style="margin:4px 0">${esc(t('news.h'))} · ${esc(s)}</h3>`;
  if (!list.length) return top + `<p class="muted">${esc(t('news.none'))}</p>`;
  return top + `<div class="newslist">${list.map(m => `<div class="news-item${m.mine ? ' mine' : ''}"><div class="dm-meta"><b>${esc(m.author)}</b> · <a href="#/pop/${esc(s)}/${esc(m.card)}" target="_blank">${esc(m.card)}</a> <span class="muted">${esc(m.title)} · ${ago(m.at)}</span></div><div class="dm-bubble">${esc(m.text || '').replace(/\n/g, '<br>')}</div></div>`).join('')}</div>`;
}

/* ---------- board page ---------- */
// Phone (AIG-933): the toolbar buttons sit behind one ⋯ button; the choice survives the 1 s redraw.
function toggleTb() { state.tbOpen = !state.tbOpen; const m = $('boardTbMore'), d = $('tbDots'); if (m) m.classList.toggle('open', state.tbOpen); if (d) d.setAttribute('aria-expanded', state.tbOpen ? 'true' : 'false'); }
function renderBoard(p) {
  // Team status lives in the top-right corner, next to the inbox (where the owner looks for notifications).
  const tt = $('teamTop'); const th = presenceHtml(p, true); if (tt.dataset.sig !== th) { tt.dataset.sig = th; tt.innerHTML = th; }
  const by = lanesBy(p.slug);
  const board = by ? lanesOf(p, by).map(([name, pool]) => `<div class="lane"><h4 class="lane-h">${esc(name)} <span class="muted">${pool.length}</span></h4><div class="board${fyFocus(p.slug) ? ' focus' : ''}">${columnsHtml(p, pool)}</div></div>`).join('') || `<p class="muted">${esc(t('board.nomatch'))}</p>`
    : `<div class="board${fyFocus(p.slug) ? ' focus' : ''}">${columnsHtml(p, p.cards)}</div>`;
  // Helpers idle for 12 hours are from an earlier session: left off, so they don't look like a sleeping team (AIG-269).
  const stale = m => /idle/i.test(m.status || '') && !/lead/i.test(m.name + ' ' + (m.role || '')) && Date.now() - Date.parse(m.updated || 0) > 12 * 3600e3;
  const team = (p.team || []).filter(m => !/retired/i.test(m.status || '') && !stale(m));
  const log = (p.log || []).slice().reverse().slice(0, 50);
  // AIG-1076: an empty (new) project keeps + New, Docs, Ask the team and Views on the bar; the rest sits behind ⋯ More (on a phone everything does, AIG-933).
  const compact = !p.cards.length && !(window.matchMedia && matchMedia('(max-width: 600px)').matches);
  const keep = `<button onclick="openDocs()">${esc(t('board.docs'))}</button>
      <button onclick="askTeamDialog()" title="${esc(t('board.ask.title'))}">${esc(t('board.ask'))}</button>
      <button onclick="viewsDialog()" title="${esc(t('board.views.title'))}">${esc(t('board.views'))}</button>`;
  return `<div class="toolbar${compact ? ' compact' : ''}"><h2>${esc(p.name)}${p.archived ? ` <span class="pill">${esc(t('home.archived'))}</span>` : ''}${p.sample ? ` <span class="pill sample-pill">${esc(t('sample.pill'))}</span> <button id="sampleRemove" onclick="removeSample()" title="${esc(t('sample.remove.title'))}">${esc(t('sample.remove'))}</button>` : ''}</h2>
      <button class="primary" onclick="newCard()">${esc(t('board.new'))}</button>
      ${compact ? keep : ''}
      <button class="tb-dots" id="tbDots" aria-expanded="${state.tbOpen ? 'true' : 'false'}" aria-label="${esc(t('board.more'))}" title="${esc(t('board.more'))}" onclick="toggleTb()">⋯${compact ? ' ' + esc(t('board.more')) : ''}</button>
      <div class="tb-more${state.tbOpen ? ' open' : ''}" id="boardTbMore">
      ${compact ? '' : `<button onclick="openDocs()">${esc(t('board.docs'))}</button>`}
      <button onclick="happeningDialog()" title="${esc(t('board.happening.title'))}">${esc(t('board.happening'))}</button>
      ${compact ? '' : `<button onclick="askTeamDialog()" title="${esc(t('board.ask.title'))}">${esc(t('board.ask'))}</button>`}
      <select class="lanesel" title="${esc(t('lanes.title'))}" onchange="setLanes(this.value)">${lanesList().map(([k, l]) => `<option value="${k}"${k === by ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${compact ? '' : `<button onclick="viewsDialog()" title="${esc(t('board.views.title'))}">${esc(t('board.views'))}</button>`}
      ${standupButtons(p)}
      <button onclick="openNews('${esc(p.slug)}')" title="${esc(t('news.title'))}">${esc(t('news.btn'))}</button>
      <button onclick="location.hash='#/stats/${esc(p.slug)}'" title="${esc(t('stats.btn.title'))}">${esc(t('stats.title'))}</button>
      <button onclick="location.hash='#/ci/${esc(p.slug)}'" title="${esc(t('ci.btn.title'))}">${esc(t('ci.btn'))}</button>
      ${p.service && p.service.on ? `<button onclick="location.hash='#/review/${esc(p.slug)}'" title="${esc(t('rev.btn.title'))}">${esc(t('rev.btn'))}</button>` : ''}
      <button onclick="raiseChange()" title="${esc(t('chg.raise.title'))}">${esc(t('chg.raise'))}</button>
      <button onclick="location.hash='#/risks/${esc(p.slug)}'" title="${esc(t('risks.btn.title'))}">${esc(t('risks.title'))}</button>
      <button onclick="location.hash='#/releases/${esc(p.slug)}'" title="${esc(t('rel.btn.title'))}">${esc(t('rel.btn'))}</button>
      <button onclick="location.hash='#/known-errors/${esc(p.slug)}'" title="${esc(t('ke.btn.title'))}">${esc(t('ke.title'))}</button>
      <button onclick="location.hash='#/improvements'" title="${esc(t('imp.btn.title'))}">${esc(t('imp.title'))}</button>
      ${Swarm.btn(p.slug, 'swarmBtn')}
      <span class="grow"></span>
      ${NoAi.on && p.lifeBoard && !p.path ? '' : `<button onclick="connectDialog()" title="${p.path && p.pathMissing ? esc(t('srv.folder.missing', { path: p.path })) : p.path ? esc(t('board.connected.title', { path: p.path })) : esc(t('board.connect.title'))}">${esc(p.path && p.pathMissing ? t('board.connected.missing') : p.path ? t('board.connected') : t('board.connect'))}</button>`}
      ${Share.button(p)}
      ${Pub.copyBtn(p)}
      <button id="hfBtn" onclick="Hyperfocus.on('${esc(p.slug)}')" title="${esc(t('hf.btn.title'))}">${esc(t('hf.btn'))}</button>
      <button onclick="Spaces.menu('${esc(p.slug)}')" title="${esc(t('space.menu.title'))}">${esc(t('space.btn'))}</button>
      <button onclick="saveProjectFile()" title="${esc(t('ofl.save.title'))}">${esc(t('ofl.save'))}</button>
      <button onclick="teamDialog()" title="${esc(t('board.team.title'))}">${esc(t('board.team'))}</button>
      <button onclick="lookDialog()" title="${esc(t('board.look.title'))}">${esc(t('board.look'))}</button>
      <button onclick="columnsDialog()" title="${esc(t('board.columns.title'))}">${esc(t('board.columns'))}</button>
      <button onclick="cardViewDialog()" title="${esc(t('board.cards.title'))}">${esc(t('board.cards'))}</button>
      ${p.path ? `<button onclick="permsDialog()" title="${esc(t('board.perms.title'))}">${esc(t('board.perms'))}</button>` : ''}
      <button onclick="${p.archived ? 'setArchived(false)' : 'setArchived(true)'}">${esc(p.archived ? t('board.unarchive') : t('board.archive'))}</button></div></div>
    ${p.description ? `<p class="muted" style="margin-top:-6px">${esc(p.description)}</p>` : ''}
    <details class="bdetails" id="bDetails"${state.detailsOpen ? ' open' : ''} ontoggle="state.detailsOpen = this.open"><summary>${esc(t('board.details'))}</summary><div class="flight">${t('board.flight.html')} ${flightHtml(flightList(p), p.slug) || `<span class="muted">${esc(t('board.flight.none'))}</span>`}</div>${p.path ? `<p class="muted"><code>${esc(p.path)}</code></p>` : ''}</details>
    ${Share.laneHtml(p)}
    ${Spaces.boardHtml(p, projCard)}
    ${p.cards.length ? '' : `<div class="emptyhint" id="emptyHint"><b>${esc(t('board.empty.h'))}</b> ${p.path || (NoAi.on && p.lifeBoard) ? t('board.empty.path', { wake: esc(t('pres.wake')), add: esc(t('board.new')) }) : t('board.empty.start', { add: esc(t('board.new')), connect: esc(t('board.connect')) })}</div>`}
    ${board}
    <div class="side">
      <div class="box"><h3>${esc(t('board.team'))}${team.length ? `<button class="bm-btn" onclick="badgeDialog()" title="${esc(t('badge.title.hint'))}">${esc(t('badge.title'))}</button>` : ''}</h3>${team.length ? `<table><tr><th>${esc(t('board.team.member'))}</th><th>${esc(t('board.team.role'))}</th><th>${esc(t('board.team.working'))}</th><th>${esc(t('board.team.status'))}</th></tr>${team.map(m =>
        `<tr><td><span onclick="badgeDialog('${esc(m.name).replace(/'/g, '&#39;')}')" style="cursor:pointer">${face(m.name, team)}</span><b>${esc(m.name)}</b> <span class="muted">${esc(m.model)}</span></td><td>${esc(m.role)}</td><td>${esc(m.task)}</td><td>${esc(m.status)}</td></tr>`).join('')}</table>` : `<p class="muted">${esc(t('board.team.none'))}</p>`}</div>
      <div class="box"><h3>${esc(t('board.log'))}</h3>${log.length ? `<ul class="log">${log.map(l =>
        `<li class="${l.kind}">${l.kind === 'decision' ? '⚖️ ' : ''}<b>${esc(l.author)}</b>: ${esc(l.text)} <span class="muted">${ago(l.at)}</span></li>`).join('')}</ul>` : `<p class="muted">${esc(t('board.log.none'))}</p>`}</div>
    </div>`;
}

/* ---------- WIP limits (AIG-118) ---------- */
// The limit counts every card in the column, even ones a filter hides, so the header can't hide a full column.
const wipClass = (n, limit) => { const w = wipState(n, limit); return w ? 'wip-' + w : ''; };
const countHtml = (shown, all, limit) => limit ? `<span class="wipn" title="${esc(t('board.limit', { n: limit }))}">${all} / ${limit}</span>` : String(shown);

/* ---------- swimlanes (AIG-120) ---------- */
// Optional rows grouping the board by assignee, type, sprint or priority. Browser-only, remembered per project.
const lanesList = () => [['', t('lanes.off')], ['assignee', t('lanes.assignee')], ['type', t('lanes.type')], ['sprint', t('lanes.sprint')], ['priority', t('lanes.priority')]];
const laneNone = by => by === 'assignee' ? t('lanes.none.assignee') : by === 'sprint' ? t('lanes.none.sprint') : t('lanes.none');
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
  return [...groups].sort(([a], [b]) => (!a) - (!b) || rank(a) - rank(b) || a.localeCompare(b)).map(([k, cs]) => [k || laneNone(by), cs]);
}
// The columns for a set of cards: the whole board, or one lane of it.
function columnsHtml(p, pool) {
  pool = pool.filter(c => !c.dm);   // AIG-544: a lead's DM lives in the chat, not as a card in the Done pile
  return colsOf(p).filter(c => !c.hidden && (!fyFocus(p.slug) || c.key === 'verify')).map(col => {
    const k = col.key, label = (col.emoji ? col.emoji + ' ' : '') + col.name, tint = col.color ? ` style="--colc:${esc(col.color)}"` : '';
    if (k === 'verify') return forYouColumn(p, label, tint, pool, col.wip);
    const cs = pool.filter(c => c.status === k && !forYou(c) && matchesFilter(c, p.slug)).sort((a, b) => k === 'done' ? String(b.updated).localeCompare(String(a.updated)) : (a.sortPos || 1e9) - (b.sortPos || 1e9) || b.updated.localeCompare(a.updated));   // sortPos: 🧭 Scrum Master /sort (AIG-730); Done: newest first
    const all = p.cards.filter(c => c.status === k && !forYou(c)).length;   // the limit counts the whole column (AIG-118)
    // ⚡ Done shows the newest 50, then Load more (AIG-1100): a long-lived board has a thousand done cards.
    const lim = k === 'done' ? doneShown(p.slug) : Infinity, left = cs.length - lim, vis = left > 0 ? cs.slice(0, lim) : cs;
    const more = left > 0 ? `<button type="button" class="done-more" onclick="doneMore('${esc(p.slug)}')">${esc(t('board.done.more', { n: left }))}</button>` : '';
    // Your own steps (AIG-117): one sub-column per step; cards with no or an old step sit in the first.
    if (col.steps.length) return col.steps.map((st, i) => {
      const mine = vis.filter(c => c.step === st || (i === 0 && !col.steps.includes(c.step)));
      return `<div class="column step ${wipClass(all, col.wip)}" data-status="${k}" data-step="${esc(st)}"${tint}><h3><span>${esc(label)} · ${esc(st)}</span><span>${i ? mine.length : countHtml(mine.length, all, col.wip)}</span></h3>${mine.map(cardHtml).join('')}${i === col.steps.length - 1 ? more : ''}</div>`;
    }).join('');
    return `<div class="column ${wipClass(all, col.wip)}" data-status="${k}"${tint}><h3><span>${esc(label)}</span><span>${countHtml(cs.length, all, col.wip)} ${['todo', 'doing', 'review', 'team'].includes(k) && cs.length ? `<button class="colbtn" title="${esc(t('board.pokeall'))}" onclick="pokeColumn('${k}', this)">👉</button> ` : ''}<button class="colbtn" title="${esc(t('board.newin', { col: label }))}" onclick="newCard({status:'${k}'})">+</button></span></h3>${vis.map(cardHtml).join('')}${more}</div>`;
  }).join('');
}

// How many Done cards show, per project, for this page only (AIG-1100).
const DONE_STEP = 50;
function doneShown(s) { state.doneShown = state.doneShown || {}; return state.doneShown[s] || DONE_STEP; }
function doneMore(s) { state.doneShown[s] = doneShown(s) + DONE_STEP; refresh(true); }

/* ---------- For you column (AIG-106) ---------- */
// Everything waiting on the owner, whatever its status: tests, questions, tasks and blocks. Those cards show
// here instead of in their own column (their status doesn't change). Chips pick which kind comes first.
const KINDS = ['q', 'p', 't', 'r', 's', 'o', 'k', 'l'], kindLabel = k => t('fy.kind.' + k);
const isMine = c => String(c.assignee || '').trim().toLowerCase() === me().toLowerCase();
const timed = c => !!c.timedUntil && new Date(c.timedUntil) > Date.now();   // AIG-385
const timedChip = c => timed(c) ? `<span class="pill timed" title="${esc(t('timed.title'))}">⏰ ${esc(timedWhen(c.timedUntil))}</span>` : '';
const timedWhen = iso => { const d = new Date(iso), day = d.toDateString() === new Date().toDateString() ? '' : d.toLocaleDateString(i18n.locale, { weekday: 'short', day: 'numeric', month: 'short' }) + ' '; return day + d.toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' }); };
const forYou = c => c.status !== 'done' && !timed(c) && !isWaitingCard(c) && !taskReplied(c) && (c.status === 'verify' || c.needsYou || c.blocked || isMine(c));
const kindOf = c => isMine(c) ? (c.lifeType ? 'l' : c.server ? 's' : c.outside ? 'o' : 'k') : c.status === 'verify' && !c.needsYou && !c.blocked ? (c.info ? 'r' : 't') : c.kind === 'plan' || (!c.kind && isGoAsk(c)) ? 'p' : 'q';   // p: 🚦 ready for go (AIG-828)   // r: 📖 To read (AIG-392)
function forYouFirst(k) {
  if (k) { state.forYouFirst = k; try { localStorage.setItem('aigile.forYouFirst', k); } catch {} refresh(true); }
  if (!state.forYouFirst) { try { state.forYouFirst = localStorage.getItem('aigile.forYouFirst'); } catch {} }
  return state.forYouFirst || 'q';
}
// The For you queue in board order; the card panel uses it to open the next one (AIG-141).
function forYouQueue(p, pool = p.cards) {
  const first = forYouFirst(), rank = c => kindOf(c) === first ? 0 : kindOf(c) === 's' && first === 'k' ? -0.2 : kindOf(c) === 'o' && first === 'k' ? -0.1 : 1 + KINDS.indexOf(kindOf(c));   // server tasks lead the Tasks (AIG-320)
  // Within a kind, a queue: longest-waiting first, so "Wait and see" sends a test to the back.
  // Tests the AI tester passed come first, ready for a quick accept (AIG-300).
  const ai = c => c.aiCheck && c.aiCheck.result === 'pass' ? 0 : 1;
  return pool.filter((c, i) => forYou(c) && matchesFilter(c, p.slug) && pool.findIndex(x => x.id === c.id) === i).sort((a, b) => ai(a) - ai(b) || rank(a) - rank(b) || queueRank(a, b) || a.updated.localeCompare(b.updated));
}
// 🧹 Tidy my pile (AIG-193): the lead folds related cards in For you into one each, and reports back.
async function tidyPile(s, btn) {
  try { const r = await api('POST', `/api/projects/${s}/tidy`); note(t(r.already ? 'tidy.already' : 'tidy.asked', { id: r.id })); refresh(true); }
  catch (e) { alert(e.message); }
}
// 🤖 Test these for me, from the For you header (AIG-300): same AI tester as the inbox, for this project's tests.
async function testForMe(s) {
  try { await api('POST', '/api/tester', { projects: [s] }); } catch (e) { alert(e.message); return; }
  state.testerOn = true; note(t('tester.started')); refresh(true);
  const look = async () => { if (document.hidden) return void setTimeout(look, 10e3); let st = null; try { st = await api('GET', '/api/tester'); } catch {} if (st && st.running) return void setTimeout(look, 10e3); state.testerOn = false; refresh(true); };
  setTimeout(look, 10e3);
}
// Focus (AIG-141): click the For you header to see only that column; remembered per project.
function fyFocus(s, set) {
  state.fyFocus = state.fyFocus || {};
  if (set !== undefined) { state.fyFocus[s] = set; try { set ? localStorage.setItem('aigile.fyFocus.' + s, '1') : localStorage.removeItem('aigile.fyFocus.' + s); } catch {} refresh(true); }
  if (!(s in state.fyFocus)) { try { state.fyFocus[s] = !!localStorage.getItem('aigile.fyFocus.' + s); } catch { state.fyFocus[s] = false; } }
  return state.fyFocus[s];
}
function forYouColumn(p, label = t('col.verify.short'), tint = '', pool = p.cards, wip = 0) {
  const first = forYouFirst();
  const cs = forYouQueue(p, pool);
  const n = k => cs.filter(c => kindOf(c) === k).length;
  const chips = KINDS.filter(k => n(k) > 0 || k === first).map(k => `<button class="fy-chip ${k === first ? 'on' : ''}${n(k) ? '' : ' fy-zero'}" data-first="${k}" title="${esc(t('fy.first'))}" onclick="${n(k) ? 'fyOpen' : 'forYouFirst'}('${k}'${n(k) ? ', null, true' : ''})">${esc(kindLabel(k))} ${n(k)}</button>`).join('');
  const all = p.cards.filter(forYou).length;
  const unchecked = cs.filter(c => c.testSteps && !c.info && !c.aiCheck).length, testing = !!state.testerOn;
  const robot = unchecked || testing ? `<button class="colbtn" id="fyTester-${p.slug}" ${testing ? 'disabled' : ''} title="${esc(testing ? t('tester.running') : t('fy.tester.title', { n: unchecked }))}" onclick="testForMe('${p.slug}')">🤖${testing ? '' : ' ' + unchecked}</button>` : '';
  return `<div class="column foryou ${wipClass(all, wip)}" data-status="verify"${tint}><h3><span class="fy-head" onclick="fyFocus('${p.slug}', ${!fyFocus(p.slug)})" title="${esc(fyFocus(p.slug) ? t('fy.showall') : t('fy.showonly'))}">${esc(label)}</span><span>${countHtml(cs.length, all, wip)} <button class="colbtn" title="${esc(t('tidy.title'))}" onclick="tidyPile('${p.slug}', this)">🧹</button>${robot}<button class="colbtn" title="${esc(fyFocus(p.slug) ? t('fy.showall') : t('fy.showonly'))}" onclick="fyFocus('${p.slug}', ${!fyFocus(p.slug)})">${fyFocus(p.slug) ? '⤡' : '⤢'}</button></span></h3><div class="fy-chips">${chips}</div>${cs.map(cardHtml).join('')}${pool.filter(c => c.status === 'verify' && (timed(c) || isWaitingCard(c)) && matchesFilter(c, p.slug)).map(cardHtml).join('')}</div>`;   // timed tests wait at the bottom with their ⏰ (AIG-385)
}

// show = the project's card view choices (board cards only); the card panel passes nothing and shows all.
// AIG-1048: a red clock on a card past its reply-by time (the server stamps c.late with the target in hours)
const lateText = h => h >= 48 && h % 24 === 0 ? t('late.days', { n: h / 24 }) : t('late.hours', { n: h });
const lateChip = c => c.late && c.status !== 'done' ? `<span class="pill late-chip" title="${esc(t('late.title', { h: lateText(c.late) }))}">⏰</span>` : '';
function metaHtml(c, show = CARD_SHOW) {
  return `${c.lifeType ? (forYou(c) && isMine(c) ? '' : lifeChip(c) + (c.apptAt ? `<span class="pill">📅 ${esc(timedWhen(c.apptAt))}</span>` : '')) : show.type ? `<span class="pill">${esc(t('type.' + c.type))}</span>` : ''}
      ${show.priority && c.priority !== 'normal' ? `<span class="pill ${c.priority}">${esc(t('priority.' + c.priority))}</span>` : ''}
      ${c.risk === 'risky' ? `<span class="pill risky" title="${esc(t('risk.chip.title'))}">⚠️</span>` : ''}
      ${show.assignee && c.assignee ? `<span class="pill">👤 ${esc(c.assignee)}</span>` : ''}
      ${c.needsYou && c.status !== 'done' ? `<span class="pill you">${esc(t('card.needsyou'))}</span>` : ''}
      ${c.crucial ? `<span class="pill crucial" title="${esc(t('saver.chip.title'))}">⭐</span>` : ''}
      ${lateChip(c)}${timedChip(c)}
      ${checkChip(c)}${waitChip(c)}
      ${aiChip(c)}
      ${c.group ? `<span class="pill grp" title="${esc(t('group.chip.title', { name: c.group }))}">🗂️ ${esc(c.group)}</span>` : ''}
      ${c.blocked ? `<span class="pill blocked">${esc(t('card.blocked'))}</span>` : ''}
      ${c.status === 'verify' && c.morning && state.setup && state.setup.tiredNow ? `<span class="pill snoozed">${esc(t('card.morning'))}</span>` : ''}
      ${snoozed(c) ? `<span class="pill snoozed">${esc(t('card.backat', { time: new Date(c.snoozedUntil).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' }) }))}</span><button class="poke" onclick="event.preventDefault();event.stopPropagation();bringBack('${c.id}')">${esc(t('card.bringback'))}</button>` : ''}
      ${show.comments && (c.nComments || c.comments.length) ? `<span class="pill">💬 ${c.nComments || c.comments.length}</span>` : ''}
      ${show.age ? `<span class="pill age" title="${esc(t('card.lastupdated'))}">🕒 ${ago(c.updated)}</span>` : ''}`;
}

// Last time the team said or did something on a card (the owner's own comments and pokes don't count).
const STALE_MS = 30 * 60e3;
function lastHeard(c) {
  const m = [...c.comments].reverse().find(m => m.author.toLowerCase() !== me().toLowerCase());
  return m ? { who: m.author, at: m.at, text: m.text } : { who: c.assignee || 'team', at: c.created, text: '' };
}
function cardHtml(c) {
  const live = ['doing', 'review'].includes(c.status), heard = live && lastHeard(c);
  const stale = live && Date.now() - new Date(heard.at) > STALE_MS;
  const view = cardViewOf(state.project);
  const cls = [stale ? 'stale-card' : '', 'card', view.density === 'compact' ? 'compact' : '', (c.needsYou && c.status !== 'done') || c.status === 'verify' ? 'needs-you' : '', c.blocked ? 'is-blocked' : '', c.priority === 'urgent' && c.status !== 'done' ? 'is-urgent' : '', c.type === 'incident' && c.status !== 'done' ? 'is-incident' : '', isWaitingCard(c) ? 'is-waiting' : ''].join(' ');
  return `<a class="${cls}" href="#/p/${state.project.slug}/${c.id}"${forYou(c) ? ` onclick="return fyCardClick(event, '${c.id}')"` : ''} data-id="${c.id}" draggable="true" style="display:block">
    <div class="id">${esc(c.id)}${c.share ? ` <span class="share-mark" title="${esc(t('share.card.mark'))}">${c.share.theirs ? '📥' : '🔗'}</span>` : ''}${c.forFriend ? ` <span class="share-mark">${esc(t('featreq.for', { name: c.forFriend }))}</span>` : ''}${view.show.sprint && c.sprint ? ' · ' + esc(c.sprint) : ''}${urgentBtn(c, state.project.slug)}${forYou(c) ? `<button class="ib-popone" title="${esc(t('inbox.popone'))}" onclick="event.preventDefault();event.stopPropagation();window.open('#/pop/${state.project.slug}/${c.id}', 'aigile-${state.project.slug}-${c.id}', 'width=560,height=780')">⤢</button>` : ''}</div>${forYou(c) ? queueChips(c) : ''}
    <div class="t">${esc(c.title)}</div>${deskBadge(c)}
    ${live ? `<div class="heard">💬 ${esc(heard.who)} ${ago(heard.at)}${heard.text ? ': ' + esc(heard.text.slice(0, 60).replace(/\n/g, ' ')) : ''}</div>` : ''}
    <div class="meta">${metaHtml(c, view.show)}${live ? `<button class="poke ai-only${stale ? ' hot' : ''}" title="${esc(t('card.poke.title'))}" onclick="event.preventDefault();event.stopPropagation();poke('${c.id}')">${esc(t('card.poke'))}</button>` : ''}</div></a>`;
}
const snoozed = c => c.status === 'verify' && c.snoozedUntil && new Date(c.snoozedUntil) > Date.now();
async function bringBack(id) {
  try { await api('DELETE', `/api/projects/${slug()}/cards/${id}/snooze`); refresh(true); } catch (e) { alert(e.message); }
}
// 👉 One poke for every card in a column (AIG-527): one wake for the team, not a run per card.
async function pokeColumn(status, btn) {
  if (btn) btn.disabled = true;
  try { await api('POST', `/api/projects/${slug()}/pokeall`, { status }); refresh(true); } catch (e) { alert(e.message); }
  if (btn) btn.disabled = false;
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
  if (c.type === 'incident' && status === 'done' && c.status !== 'done') { const pm = await postmortemAsk(); if (!pm) return rerender(); try { await api('PATCH', `/api/projects/${slug()}/cards/${id}`, { status, step, postmortem: pm }); } catch (err) { alert(t('board.movefail', { msg: err.message })); } return rerender(); }   // AIG-614
  c.status = status; c.step = step; c.updated = new Date().toISOString(); render();   // optimistic
  try { await api('PATCH', `/api/projects/${slug()}/cards/${id}`, { status, step }); }
  catch (err) { alert(t('board.movefail', { msg: err.message })); }
  rerender();
});

/* ---------- long-press Move to sheet (AIG-1200): touch only, the mouse keeps drag ---------- */
// ~500 ms on a board card with no movement opens a sheet of columns; a column PATCHes the card like the ⋯ menu's Move to.
(() => {
  const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
  let timer = 0, from = null, fired = false, firedAt = 0;
  const stop = () => { clearTimeout(timer); timer = 0; from = null; };
  window.cardMoveSheet = id => {
    const c = state.project?.cards.find(x => x.id === id); if (!c) return;
    const cols = colsOf(state.project).filter(x => !x.hidden && x.key !== c.status);
    openDialog(`<h2>${esc(t('card.moveto'))}</h2><p class="muted">${esc(c.id)} · ${esc(c.title)}</p><div class="mv-sheet">${cols.map(x => `<button type="button" data-mvcol="${esc(x.key)}">${esc(((x.emoji ? x.emoji + ' ' : '') + x.name).trim())}</button>`).join('')}</div><div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
    document.querySelectorAll('[data-mvcol]').forEach(b => b.onclick = async () => {
      const status = b.dataset.mvcol; closeDialog();
      const body = { status };
      if (status === 'done' && c.type === 'incident' && c.status !== 'done') { body.postmortem = await postmortemAsk(); if (!body.postmortem) return rerender(); }
      try { await api('PATCH', `/api/projects/${slug()}/cards/${id}`, body); } catch (err) { alert(t('board.movefail', { msg: err.message })); }
      rerender();
    });
  };
  app.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !coarse()) return;
    const el = e.target.closest?.('.card[data-id]'); if (!el || e.target.closest('button')) return;
    stop(); fired = false; from = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { timer = 0; fired = true; firedAt = Date.now(); cardMoveSheet(el.dataset.id); }, 500);
  });
  app.addEventListener('touchmove', e => { const p = e.touches[0]; if (from && p && Math.hypot(p.clientX - from.x, p.clientY - from.y) > 8) { stop(); } }, { passive: true });   // a scroll or a drag of the finger cancels the press
  for (const n of ['pointerup', 'touchend']) app.addEventListener(n, e => { stop(); });
  app.addEventListener('dragstart', e => { if (coarse() && e.target.closest?.('.card')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);   // a finger never drags (a held touch would start one and cancel the press)
  app.addEventListener('contextmenu', e => { if (coarse() && e.target.closest?.('.card')) e.preventDefault(); });
  document.addEventListener('pointerdown', () => { fired = false; }, true);
  document.addEventListener('click', e => { if (fired && Date.now() - firedAt < 1500) { e.preventDefault(); e.stopPropagation(); } fired = false; }, true);   // the lift of the finger must not open the card or close the sheet
})();
