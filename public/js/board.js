/* ---------- team status: in flight, presence, wake ---------- */
// "Pixel → AIG-5 (12m ago)". Quiet for 30+ minutes = stale (amber), so stalled agents stand out.
function flightHtml(list) {
  return list.map(c => `<span class="${Date.now() - new Date(c.updated) > 30 * 60e3 ? 'stale' : ''}" title="${esc(c.title)}">${esc(c.assignee || t('board.unassigned'))} → ${esc(c.id)} <span class="muted">(${ago(c.updated)})</span></span>`).join(' · ');
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
  catch (err) { alert(err.message); b.disabled = false; b.textContent = t('pres.wake'); }
}
async function restartTeam(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  const b = e.target; b.disabled = true; b.textContent = t('pres.restarting');
  try { await api('POST', `/api/projects/${s}/restart`); refresh(true); }
  catch (err) { alert(err.message); b.disabled = false; b.textContent = t('pres.restart'); }
}
async function agentLog(e, s = slug()) {
  e.preventDefault(); e.stopPropagation();
  try {
    const r = await api('GET', `/api/projects/${s}/agentlog`);
    openDialog(`<h2>${esc(t('pres.log.h'))}</h2><pre id="agentLog" style="max-height:60vh;overflow:auto;white-space:pre-wrap">${esc(r.text || t('pres.log.empty'))}</pre><div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
    const pre = $('agentLog'); if (pre) pre.scrollTop = pre.scrollHeight;
  } catch (err) { alert(err.message); }
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
  openDialog(`<h2>${esc(t('eye.h'))} <button class="watch-pop" title="${esc(t('eye.pop'))}" onclick="window.open('#/pop-watch/${s}', 'aigile-watch-${s}', 'width=620,height=720')">⧉</button></h2>
    ${watchBody()}<div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`, 'wide');
  const tick = async () => { if (!$('watchLog')) return clearInterval(timer); try { paintWatch(await api('GET', `/api/projects/${s}/agentlog`)); } catch {} };
  const timer = setInterval(tick, 2500); tick();
}
// The pop-out (#/pop-watch/<slug>) rides the 1 s page poll; the shell is drawn once so scrolling up to read stays put.
function renderWatch() {
  document.body.classList.add('poplist');
  if (!$('watchLog')) $('app').innerHTML = `<h3 style="margin:4px 0">${esc(t('eye.h'))} · ${esc(state.route.slug)}</h3>${watchBody()}`;
  paintWatch(state.watchLog);
}

/* ---------- 📜 Team news (AIG-319) ---------- */
// Every team comment on the project's cards, newest first, in its own window (#/pop-news/<slug>), redrawn by the 1 s poll.
function openNews(s) { window.open('#/pop-news/' + s, 'aigile-news-' + s, 'width=520,height=760'); }
function renderNews() {
  document.body.classList.add('poplist');
  const s = state.route.slug, list = state.news || [];
  const top = `<h3 style="margin:4px 0">${esc(t('news.h'))} · ${esc(s)}</h3>`;
  if (!list.length) return top + `<p class="muted">${esc(t('news.none'))}</p>`;
  return top + `<div class="newslist">${list.map(m => `<div class="news-item${m.mine ? ' mine' : ''}"><div class="dm-meta"><b>${esc(m.author)}</b> · <a href="#/pop/${esc(s)}/${esc(m.card)}" target="_blank">${esc(m.card)}</a> <span class="muted">${esc(m.title)} · ${ago(m.at)}</span></div><div class="dm-bubble">${esc(m.text || '').replace(/\n/g, '<br>')}</div></div>`).join('')}</div>`;
}

/* ---------- board page ---------- */
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
  return `<div class="toolbar"><h2>${esc(p.name)}${p.archived ? ` <span class="pill">${esc(t('home.archived'))}</span>` : ''}</h2>
      <button class="primary" onclick="newCard()">${esc(t('board.new'))}</button>
      <button onclick="openDocs()">${esc(t('board.docs'))}</button>
      <button class="bug" onclick="newCard({type:'bug',priority:'high',status:'team'})">${esc(t('board.raisebug'))}</button>
      <button onclick="happeningDialog()" title="${esc(t('board.happening.title'))}">${esc(t('board.happening'))}</button>
      <button onclick="askTeamDialog()" title="${esc(t('board.ask.title'))}">${esc(t('board.ask'))}</button>
      <select class="lanesel" title="${esc(t('lanes.title'))}" onchange="setLanes(this.value)">${lanesList().map(([k, l]) => `<option value="${k}"${k === by ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <button onclick="viewsDialog()" title="${esc(t('board.views.title'))}">${esc(t('board.views'))}</button>
      ${standupButtons(p)}
      <button onclick="openNews('${esc(p.slug)}')" title="${esc(t('news.title'))}">${esc(t('news.btn'))}</button>
      <span class="grow"></span>
      <button onclick="connectDialog()" title="${p.path ? esc(t('board.connected.title', { path: p.path })) : esc(t('board.connect.title'))}">${esc(p.path ? t('board.connected') : t('board.connect'))}</button>
      ${Share.button(p)}
      <button onclick="lookDialog()" title="${esc(t('board.look.title'))}">${esc(t('board.look'))}</button>
      <button onclick="columnsDialog()" title="${esc(t('board.columns.title'))}">${esc(t('board.columns'))}</button>
      <button onclick="cardViewDialog()" title="${esc(t('board.cards.title'))}">${esc(t('board.cards'))}</button>
      ${p.path ? `<button onclick="permsDialog()" title="${esc(t('board.perms.title'))}">${esc(t('board.perms'))}</button>` : ''}
      <button onclick="${p.archived ? 'setArchived(false)' : 'setArchived(true)'}">${esc(p.archived ? t('board.unarchive') : t('board.archive'))}</button></div>
    <div class="flight">${t('board.flight.html')} ${flightHtml(p.cards.filter(c => c.status === 'doing').sort((a, b) => b.updated.localeCompare(a.updated))) || `<span class="muted">${esc(t('board.flight.none'))}</span>`}</div>
    ${p.description || p.path ? `<p class="muted" style="margin-top:-6px">${esc(p.description)}${p.path ? `${p.description ? ' · ' : ''}<code>${esc(p.path)}</code>` : ''}</p>` : ''}
    ${Share.laneHtml(p)}
    ${p.cards.length ? '' : `<div class="emptyhint" id="emptyHint"><b>${esc(t('board.empty.h'))}</b> ${p.path ? t('board.empty.path', { wake: esc(t('pres.wake')) }) : t('board.empty.nopath', { connect: esc(t('board.connect')) })}</div>`}
    ${board}
    <div class="side">
      <div class="box"><h3>${esc(t('board.team'))}</h3>${team.length ? `<table><tr><th>${esc(t('board.team.member'))}</th><th>${esc(t('board.team.role'))}</th><th>${esc(t('board.team.working'))}</th><th>${esc(t('board.team.status'))}</th></tr>${team.map(m =>
        `<tr><td>${face(m.name, team)}<b>${esc(m.name)}</b> <span class="muted">${esc(m.model)}</span></td><td>${esc(m.role)}</td><td>${esc(m.task)}</td><td>${esc(m.status)}</td></tr>`).join('')}</table>` : `<p class="muted">${esc(t('board.team.none'))}</p>`}</div>
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
  return colsOf(p).filter(c => !c.hidden && (!fyFocus(p.slug) || c.key === 'verify')).map(col => {
    const k = col.key, label = (col.emoji ? col.emoji + ' ' : '') + col.name, tint = col.color ? ` style="--colc:${esc(col.color)}"` : '';
    if (k === 'verify') return forYouColumn(p, label, tint, pool, col.wip);
    const cs = pool.filter(c => c.status === k && !forYou(c) && matchesFilter(c, p.slug)).sort((a, b) => b.updated.localeCompare(a.updated));
    const all = p.cards.filter(c => c.status === k && !forYou(c)).length;   // the limit counts the whole column (AIG-118)
    // Your own steps (AIG-117): one sub-column per step; cards with no or an old step sit in the first.
    if (col.steps.length) return col.steps.map((st, i) => {
      const mine = cs.filter(c => c.step === st || (i === 0 && !col.steps.includes(c.step)));
      return `<div class="column step ${wipClass(all, col.wip)}" data-status="${k}" data-step="${esc(st)}"${tint}><h3><span>${esc(label)} · ${esc(st)}</span><span>${i ? mine.length : countHtml(mine.length, all, col.wip)}</span></h3>${mine.map(cardHtml).join('')}</div>`;
    }).join('');
    return `<div class="column ${wipClass(all, col.wip)}" data-status="${k}"${tint}><h3><span>${esc(label)}</span><span>${countHtml(cs.length, all, col.wip)} <button class="colbtn" title="${esc(t('board.newin', { col: label }))}" onclick="newCard({status:'${k}'})">+</button></span></h3>${cs.map(cardHtml).join('')}</div>`;
  }).join('');
}

/* ---------- For you column (AIG-106) ---------- */
// Everything waiting on the owner, whatever its status: tests, questions, tasks and blocks. Those cards show
// here instead of in their own column (their status doesn't change). Chips pick which kind comes first.
const KINDS = ['q', 't', 's', 'o', 'k'], kindLabel = k => t('fy.kind.' + k);
const isMine = c => String(c.assignee || '').trim().toLowerCase() === me().toLowerCase();
const timed = c => !!c.timedUntil && new Date(c.timedUntil) > Date.now();   // AIG-385
const timedChip = c => timed(c) ? `<span class="pill timed" title="${esc(t('timed.title'))}">⏰ ${esc(timedWhen(c.timedUntil))}</span>` : '';
const timedWhen = iso => { const d = new Date(iso), day = d.toDateString() === new Date().toDateString() ? '' : d.toLocaleDateString(i18n.lang, { weekday: 'short', day: 'numeric', month: 'short' }) + ' '; return day + d.toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' }); };
const forYou = c => c.status !== 'done' && !timed(c) && (c.status === 'verify' || c.needsYou || c.blocked || isMine(c));
const kindOf = c => isMine(c) ? (c.server ? 's' : c.outside ? 'o' : 'k') : c.status === 'verify' && !c.needsYou && !c.blocked ? 't' : 'q';
function forYouFirst(k) {
  if (k) { state.forYouFirst = k; try { localStorage.setItem('aigile.forYouFirst', k); } catch {} refresh(true); }
  if (!state.forYouFirst) { try { state.forYouFirst = localStorage.getItem('aigile.forYouFirst'); } catch {} }
  return state.forYouFirst || 'q';
}
// The For you queue in board order; the card panel uses it to open the next one (AIG-141).
function forYouQueue(p, pool = p.cards) {
  const first = forYouFirst(), rank = c => kindOf(c) === first ? 0 : kindOf(c) === 's' && first === 'k' ? 0.5 : kindOf(c) === 'o' && first === 'k' ? 0.7 : 1 + KINDS.indexOf(kindOf(c));   // server tasks lead the Tasks (AIG-320)
  // Within a kind, a queue: longest-waiting first, so "Wait and see" sends a test to the back.
  // Tests the AI tester passed come first, ready for a quick accept (AIG-300).
  const ai = c => c.aiCheck && c.aiCheck.result === 'pass' ? 0 : 1;
  return pool.filter(c => forYou(c) && matchesFilter(c, p.slug)).sort((a, b) => ai(a) - ai(b) || rank(a) - rank(b) || queueRank(a, b) || a.updated.localeCompare(b.updated));
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
  const look = async () => { let st = null; try { st = await api('GET', '/api/tester'); } catch {} if (st && st.running) return void setTimeout(look, 10e3); state.testerOn = false; refresh(true); };
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
  const chips = KINDS.map(k => `<button class="fy-chip ${k === first ? 'on' : ''}" data-first="${k}" title="${esc(t('fy.first'))}" onclick="forYouFirst('${k}')">${esc(kindLabel(k))} ${n(k)}</button>`).join('');
  const all = p.cards.filter(forYou).length;
  const unchecked = cs.filter(c => c.testSteps && !c.aiCheck).length, testing = !!state.testerOn;
  const robot = unchecked || testing ? `<button class="colbtn" id="fyTester-${p.slug}" ${testing ? 'disabled' : ''} title="${esc(testing ? t('tester.running') : t('fy.tester.title', { n: unchecked }))}" onclick="testForMe('${p.slug}')">🤖${testing ? '' : ' ' + unchecked}</button>` : '';
  return `<div class="column foryou ${wipClass(all, wip)}" data-status="verify"${tint}><h3><span class="fy-head" onclick="fyFocus('${p.slug}', ${!fyFocus(p.slug)})" title="${esc(fyFocus(p.slug) ? t('fy.showall') : t('fy.showonly'))}">${esc(label)}</span><span>${countHtml(cs.length, all, wip)} <button class="colbtn" title="${esc(t('tidy.title'))}" onclick="tidyPile('${p.slug}', this)">🧹</button>${robot}<button class="colbtn" title="${esc(fyFocus(p.slug) ? t('fy.showall') : t('fy.showonly'))}" onclick="fyFocus('${p.slug}', ${!fyFocus(p.slug)})">${fyFocus(p.slug) ? '⤡' : '⤢'}</button></span></h3><div class="fy-chips">${chips}</div>${cs.map(cardHtml).join('')}${pool.filter(c => c.status === 'verify' && timed(c) && matchesFilter(c, p.slug)).map(cardHtml).join('')}</div>`;   // timed tests wait at the bottom with their ⏰ (AIG-385)
}

// show = the project's card view choices (board cards only); the card panel passes nothing and shows all.
function metaHtml(c, show = CARD_SHOW) {
  return `${show.type ? `<span class="pill">${esc(t('type.' + c.type))}</span>` : ''}
      ${show.priority && c.priority !== 'normal' ? `<span class="pill ${c.priority}">${esc(t('priority.' + c.priority))}</span>` : ''}
      ${show.assignee && c.assignee ? `<span class="pill">👤 ${esc(c.assignee)}</span>` : ''}
      ${c.needsYou && c.status !== 'done' ? `<span class="pill you">${esc(t('card.needsyou'))}</span>` : ''}
      ${timedChip(c)}
      ${aiChip(c)}
      ${c.blocked ? `<span class="pill blocked">${esc(t('card.blocked'))}</span>` : ''}
      ${snoozed(c) ? `<span class="pill snoozed">${esc(t('card.backat', { time: new Date(c.snoozedUntil).toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' }) }))}</span><button class="poke" onclick="event.preventDefault();event.stopPropagation();bringBack('${c.id}')">${esc(t('card.bringback'))}</button>` : ''}
      ${show.comments && c.comments.length ? `<span class="pill">💬 ${c.comments.length}</span>` : ''}
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
  const cls = [stale ? 'stale-card' : '', 'card', view.density === 'compact' ? 'compact' : '', (c.needsYou && c.status !== 'done') || c.status === 'verify' ? 'needs-you' : '', c.blocked ? 'is-blocked' : ''].join(' ');
  return `<a class="${cls}" href="#/p/${state.project.slug}/${c.id}" data-id="${c.id}" draggable="true" style="display:block">
    <div class="id">${esc(c.id)}${c.share ? ` <span class="share-mark" title="${esc(t('share.card.mark'))}">${c.share.theirs ? '📥' : '🔗'}</span>` : ''}${view.show.sprint && c.sprint ? ' · ' + esc(c.sprint) : ''}${forYou(c) ? `<button class="ib-popone" title="${esc(t('inbox.popone'))}" onclick="event.preventDefault();event.stopPropagation();window.open('#/pop/${state.project.slug}/${c.id}', 'aigile-${state.project.slug}-${c.id}', 'width=560,height=780')">⤢</button>` : ''}</div>${forYou(c) ? queueChips(c) : ''}
    <div class="t">${esc(c.title)}</div>
    ${live ? `<div class="heard">💬 ${esc(heard.who)} ${ago(heard.at)}${heard.text ? ': ' + esc(heard.text.slice(0, 60).replace(/\n/g, ' ')) : ''}</div>` : ''}
    <div class="meta">${metaHtml(c, view.show)}${live ? `<button class="poke${stale ? ' hot' : ''}" title="${esc(t('card.poke.title'))}" onclick="event.preventDefault();event.stopPropagation();poke('${c.id}')">${esc(t('card.poke'))}</button>` : ''}</div></a>`;
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
  catch (err) { alert(t('board.movefail', { msg: err.message })); }
  rerender();
});
