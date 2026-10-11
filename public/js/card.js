/* ---------- card fields (shared by the edit panel and the New card dialog) ---------- */
const opts = (list, cur, labels) => list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(labels ? labels[v] : v)}</option>`).join('');

function cardFields(c, o = {}) {
  return `<label class="f"><span>${esc(t('card.f.title'))}</span><input type="text" id="f-title" value="${esc(c.title)}" placeholder="${esc(o.titlePh || '')}" maxlength="200"></label>
    <label class="f"><span>${esc(o.descLabel || t('card.f.description'))}</span><textarea id="f-description" rows="4" placeholder="${esc(o.descPh || '')}">${esc(c.description)}</textarea></label>
    ${o.testSteps ? `<label class="f"><span>${esc(t('card.f.teststeps'))}</span><textarea id="f-testSteps" rows="4">${esc(c.testSteps)}</textarea></label>` : ''}
    <div class="row">
      <label class="f"><span>${esc(t('card.f.type'))}</span><select id="f-type">${opts(TYPES, c.type, Object.fromEntries(TYPES.map(k => [k, t('type.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.priority'))}</span><select id="f-priority">${opts(PRIORITIES, c.priority, Object.fromEntries(PRIORITIES.map(k => [k, t('priority.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.status'))}</span><select id="f-status">${opts(Object.keys(COLS), c.status, Object.fromEntries(Object.keys(COLS).map(k => [k, colLabel(state.project, k)])))}</select></label>
    </div>
    <div class="row">
      <label class="f"><span>${esc(t('card.f.assignee'))}</span>${assigneeSelect(c.assignee || '')}</label>
      <label class="f"><span>${esc(t('card.f.sprint'))}</span><input type="text" id="f-sprint" value="${esc(c.sprint)}"></label>
      <label class="f"><span>${esc(t('card.f.group'))}</span><input type="text" id="f-group" list="f-group-list" placeholder="${esc(t('card.f.group.ph'))}" value="${esc(c.group || '')}"><datalist id="f-group-list">${[...new Set((state.project ? state.project.cards : []).map(x => x.group).filter(Boolean))].sort().map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
    </div>
    ${o.flags ? `<div><label class="chk"><input type="checkbox" id="f-blocked" ${c.blocked ? 'checked' : ''}> ${esc(t('card.f.blocked'))}</label>
      <label class="chk"><input type="checkbox" id="f-needsYou" ${c.needsYou ? 'checked' : ''}> ${esc(t('card.f.needsyou'))}</label></div>` : ''}`;
}
// Who a card goes to: a role (the lead launches that kind of agent; the model is shown so the cost is
// visible), a named team member, or the owner himself (a task for him). Agents swap a role for their name on start.
const ROLES = [
  ['Lead (Opus)', '🧠', 'role.lead'],
  ['Reviewer (Opus)', '🔍', 'role.reviewer'],
  ['Frontend (Sonnet)', '🎨', 'role.frontend'],
  ['Backend (Sonnet)', '⚙️', 'role.backend'],
  ['QA (Haiku)', '🧪', 'role.qa'],
  ['Quick fix (Haiku)', '🔧', 'role.quickfix'],
  ['Docs (Haiku)', '📄', 'role.docs'],
];
// Team roles per project (AIG-366): p.roles lists the roles that are on; none = all on. Lead is always on.
const TEAM_ROLES = [...ROLES.map(r => r[0]), 'Tester (Sonnet)'];
const projectRoleOn = (r, p = state.project) => r === TEAM_ROLES[0] || !p || !Array.isArray(p.roles) || p.roles.includes(r);
// Per model the helper limit when set, else the number of roles on: { total, list: "Opus 1, Sonnet 2, Haiku 3" }.
function rolesCount(on) {
  const pr = leadPrefs(); let total = 0;
  const list = ['Opus', 'Sonnet', 'Haiku'].map(m => {
    const n = TEAM_ROLES.filter(r => on.includes(r) && r.includes('(' + m + ')')).length, lim = pr['helpers' + m];
    const k = lim !== '' && lim != null ? Math.min(n, lim) : n;
    total += k; return n ? m + ' ' + k : '';
  }).filter(Boolean).join(', ');
  return { total, list };
}
function assigneeSelect(cur) {
  const team = (state.project?.team || []).filter(m => !/retired/i.test(m.status || '') && m.name !== me()).map(m => m.name);
  const known = new Set(['', me(), ...ROLES.map(r => r[0]), ...team]);
  const o = (v, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return `<select id="f-assignee" onchange="onAssignee(this)">
    ${o('', t('assignee.nobody'))}${cur && !known.has(cur) ? o(cur, '👤 ' + cur) : ''}
    <optgroup label="${esc(t('assignee.roles'))}">${ROLES.filter(r => r[0] === cur || projectRoleOn(r[0])).map(([v, i, d]) => o(v, `${i} ${v}: ${t(d)}`)).join('')}</optgroup>
    ${team.length ? `<optgroup label="${esc(t('assignee.members'))}">${team.map(n => o(n, '👤 ' + n)).join('')}</optgroup>` : ''}
    <optgroup label="${esc(t('assignee.you'))}">${o(me(), '🙋 ' + me() + t('assignee.you.task'))}</optgroup>
    <option value="__other">${esc(t('assignee.other'))}</option></select>`;
}
function onAssignee(sel) {
  if (sel.value !== '__other') return;
  const v = (prompt(t('assignee.prompt')) || '').trim();
  if (!v) { sel.value = ''; return; }
  sel.add(new Option('👤 ' + v, v, true, true), sel.options[1]);
}

function readFields(flags, testSteps) {
  const o = { title: $('f-title').value.trim(), description: $('f-description').value, type: $('f-type').value, priority: $('f-priority').value,
    status: $('f-status').value, assignee: $('f-assignee').value.trim(), sprint: $('f-sprint').value.trim(), group: $('f-group').value.trim() };
  if (testSteps) o.testSteps = $('f-testSteps').value;
  if (flags) { o.blocked = $('f-blocked').checked; o.needsYou = $('f-needsYou').checked; }
  return o;
}

/* ---------- card detail panel ---------- */
function renderCard(p, c) {
  const pop = state.route.pop, close = pop ? 'window.close()' : `location.hash='#/p/${p.slug}'`;
  // ⧉ Pop out (AIG-122): the card in its own small window, to follow steps on one screen and work on another.
  const popBtn = pop ? '' : `<button onclick="popOutCard('${p.slug}', '${c.id}')" title="${esc(t('card.popout.title'))}">${esc(t('card.popout'))}</button>`;
  const head = `<div class="actions" style="margin-top:0"><button onclick="${close}">${esc(t('card.close'))}</button>${popBtn}${Share.cardBtn(p, c)}${Pack.cardBtns(p, c)}${state.editing ? '' : timerUi(c)}<span style="flex:1"></span>
      ${state.editing ? '' : `<button onclick="editCard()">${esc(t('card.edit'))}</button> <button class="danger" onclick="deleteCard()">${esc(t('card.delete'))}</button>`}</div>`;
  if (state.editing) {
    return `<div class="overlay"><div class="panel">${head}
      <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(t('card.editing'))}</div>
      <form onsubmit="return saveCard(event)" style="margin-top:8px">${cardFields(c, { testSteps: true, flags: true })}
        <div class="err" id="f-err"></div>
        <div class="actions"><button class="primary" type="submit">${esc(t('common.save'))}</button><button type="button" onclick="cancelEdit()">${esc(t('common.cancel'))}</button>
        <span style="flex:1"></span><button type="button" class="danger" onclick="deleteCard()">${esc(t('card.delete'))}</button></div></form>
    </div></div>`;
  }
  const verdict = c.status === 'verify' ? `<div class="verdict"><h3>${esc(t('verdict.h'))}</h3>${aiEvidence(c, p.slug)}
      <div class="muted">${esc(t('verdict.waiting'))}${c.testSteps ? esc(t('verdict.steps')) : ''}.</div>
      <label class="f" style="margin-top:8px"><span>${esc(t('verdict.comment'))}</span><textarea id="v-text" data-draft="${esc(p.slug + '/' + c.id)}/verdict" rows="3" placeholder="${esc(t('verdict.placeholder'))}"></textarea></label>
      <div class="err" id="v-err"></div>
      ${c.openUrl ? `<div class="actions" style="margin-top:0"><button class="primary" onclick="openIt('${p.slug}', '${c.id}', this)" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button><span class="muted">${esc(c.openUrl)}</span></div>` : ''}
      <div class="actions"><button class="good" onclick="verdict(true)">${esc(t('card.accept'))}</button><button class="warn" onclick="verdict(false)">${esc(t('card.sendback'))}</button><button onclick="waitAndSee()" title="${esc(t('card.wait.title'))}">${esc(t('card.wait'))}</button>${Attach.boxHtml(p.slug + '/' + c.id + '#verdict')}</div></div>` : '';
  // Tabs: Reply (latest message on top, reply box right under it, older ones below), Details, Test.
  const msg = (m, latest) => `<div class="comment${latest ? ' latest' : ''}">${latest ? '<span class="tag-latest">' + esc(t('card.latest')) + '</span>' : ''}<span class="who">${face(m.author, p.team)}${esc(m.author)}</span><span class="when">${ago(m.at)}</span>${isOwner(m.author) ? (p.teamSeenAt && m.at <= p.teamSeenAt ? '<span class="seen">' + esc(t('card.seen')) + '</span>' : '<span class="seen">' + esc(t('card.notseen')) + '</span>') : ''}${m.from === 'outside' ? Pack.body(p, c, m) : `<div class="body">${linkify(m.text, p)}</div>`}${Attach.shown(m, p.slug)}${Share.commentMark(p, c, m)}</div>`;
  const newest = [...c.comments].reverse();
  const hasTest = c.status === 'verify' || c.testSteps;
  // The team's notes since your last word, shown on the Test tab next to Accept, so you never go looking (AIG-152).
  const lastMine = c.comments.map(m => isOwner(m.author)).lastIndexOf(true);
  const notes = c.comments.slice(lastMine + 1).filter(m => !isOwner(m.author) && (m.attachments || !/^Ready for you to test\./.test(m.text))).slice(-3);
  if (state.tabFor !== c.id) { state.tabFor = c.id; state.cardTab = c.status === 'verify' ? 'test' : c.comments.length ? 'reply' : 'details'; }
  const tab = state.cardTab === 'test' && !hasTest ? 'reply' : state.cardTab;
  const tabBtn = (k, label) => `<button class="ctab ${tab === k ? 'on' : ''}" data-ctab="${k}" onclick="cardTab('${k}')">${label}</button>`;
  return `<div class="overlay" onclick="if(event.target===this) ${close}"><div class="panel">${head}
    <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(colLabel(p, c.status))}${c.status === 'team' && c.prevStatus ? ' ' + esc(t('card.was', { col: colLabel(p, c.prevStatus) })) : ''}${c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <h2>${esc(c.title)}</h2>
    <div class="meta">${metaHtml(c)}</div>
    <div class="ctabs">${tabBtn('reply', esc(t('card.tab.reply')) + (c.comments.length ? ` <span class="n">${c.comments.length}</span>` : ''))}${tabBtn('details', esc(t('card.tab.details')))}${hasTest ? tabBtn('test', esc(t('card.tab.test')) + (c.status === 'verify' ? ` <span class="n hot">${esc(t('card.tab.yourcall'))}</span>` : '')) : ''}</div>
    <div class="cpane" data-pane="reply" ${tab === 'reply' ? '' : 'hidden'}>
      ${Share.cardComments(p, c)}
      ${quizPanel(p, c)}
      ${pop ? chatHtml(p, c, msg) : replyHtml(p, c, msg, newest)}
    </div>
    <div class="cpane" data-pane="details" ${tab === 'details' ? '' : 'hidden'}>
      ${c.description ? `<div class="desc">${linkify(c.description, p)}</div>` : `<p class="muted">${esc(t('card.nodesc'))}</p>`}${Attach.shown(c, p.slug)}
    </div>
    ${hasTest ? `<div class="cpane" data-pane="test" ${tab === 'test' ? '' : 'hidden'}>${verdict}
      ${c.proof ? proofHtml(c.proof) : ''}
      ${notes.length ? `<h3>${esc(t('card.fromteam'))}</h3>${notesHtml(notes, msg)}` : ''}
      ${c.testSteps ? `<h3>${esc(t('card.howtotest'))}</h3><div class="desc">${linkify(c.testSteps, p)}</div>` : ''}</div>` : ''}
  </div></div>`;
}
// The Reply tab as it was: latest message on top, the reply box right under it, older ones below.
function replyHtml(p, c, msg, newest) {
  return `${newest.length ? msg(newest[0], true) : `<p class="muted">${esc(t('card.nomsgs'))}</p>`}
      ${replyBox(p, c)}
      ${newest.length > 1 ? `<h3 class="muted" style="font-size:13px;margin-top:18px">${esc(t('card.earlier'))}</h3>${newest.slice(1).map(m => msg(m, false)).join('')}` : ''}`;
}
const replyBox = (p, c) => `<div class="reply"><textarea id="r-text" data-draft="${esc(p.slug + '/' + c.id)}/reply" rows="3" placeholder="${esc(t('card.reply.ph', { name: me() }))}" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendReply()}"></textarea>
        <div class="err" id="r-err"></div>
        <div class="actions">${c.needsYou ? `<button class="good" onclick="sendReply('GO')" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>` : ''}<button class="primary" onclick="sendReply()">${esc(t('card.sendreply'))}</button>${Attach.boxHtml(p.slug + '/' + c.id)}</div></div>`;
// A popped-out card is a live chat (AIG-313): oldest first, newest at the bottom, a typing line while the team
// works on the card, the reply box underneath. Sending never closes it.
function chatHtml(p, c, msg) {
  const pr = p.presence || {}, typing = (pr.running || pr.online) && (c.status === 'doing' || c.status === 'team') && !c.needsYou;
  return `<div class="chat">${c.comments.length ? c.comments.map(m => msg(m, false)).join('') : `<p class="muted">${esc(t('card.nomsgs'))}</p>`}</div>
      ${typing ? `<div class="typing muted" id="typing">${esc(t('card.typing'))}</div>` : ''}
      ${replyBox(p, c)}`;
}
// While the owner types in a pop-out, only the messages and the typing line are swapped, never the reply box.
function popChatLive() {
  const p = state.project, c = p && p.cards.find(x => x.id === state.route.card), chat = document.querySelector('#modal .chat');
  if (!c || !chat || state.editing) return false;
  const tmp = document.createElement('div'); tmp.innerHTML = renderCard(p, c);
  const nc = tmp.querySelector('.chat'); if (!nc) return false;
  const de = document.documentElement, atEnd = de.scrollHeight - window.scrollY - window.innerHeight < 60;
  if (chat.innerHTML !== nc.innerHTML) chat.innerHTML = nc.innerHTML;
  const ty = document.getElementById('typing'), nt = tmp.querySelector('#typing');
  if (ty && !nt) ty.remove(); else if (!ty && nt) chat.after(nt);
  if (atEnd) window.scrollTo(0, de.scrollHeight);
  return true;
}
// The open card on the board (AIG-314): a new team message must show even while the reply box is focused or holds a
// draft. Only what sits above and below the reply box, and the tab row, are swapped; the box itself is never touched.
function cardLive() {
  const p = state.project, c = p && p.cards.find(x => x.id === state.route.card), r = document.querySelector('#modal .panel .reply');
  if (!c || !r || state.editing || state.dragging || $('dialog').firstChild) return false;
  const tmp = document.createElement('div'); tmp.innerHTML = renderCard(p, c);
  const nr = tmp.querySelector('.reply'), tabs = document.querySelector('#modal .ctabs'), nt = tmp.querySelector('.ctabs');
  if (!nr || nr.parentNode.dataset.pane !== r.parentNode.dataset.pane) return false;
  let changed = false;
  if (tabs && nt && tabs.innerHTML !== nt.innerHTML) { tabs.innerHTML = nt.innerHTML; changed = true; }
  const side = (el, dir) => { const a = []; for (let n = el[dir]; n; n = n[dir]) a.push(n); return a; };
  for (const dir of ['previousSibling', 'nextSibling']) {
    const o = side(r, dir), n = side(nr, dir), h = l => l.map(x => x.outerHTML || x.textContent).join('');
    if (h(o) === h(n)) continue;
    changed = true; o.forEach(x => x.remove());
    if (dir === 'previousSibling') n.reverse().forEach(x => r.parentNode.insertBefore(x, r));   // nearest-first -> document order
    else n.forEach(x => r.parentNode.appendChild(x));
  }
  if (changed) $('modal')._html = null;
  return true;
}
// Test tab notes (AIG-186): newest first, so the latest word sits right under the reply box. An AI tester check
// that a newer one replaced is faded and labelled, so a corrected verdict can't be mistaken for the current one.
const isCheck = m => /^🤖 /.test(m.text || '');
function notesHtml(notes, msg) {
  const lastCheck = notes.filter(isCheck).pop();
  return [...notes].reverse().map(m => isCheck(m) && m !== lastCheck
    ? `<div class="stale" title="${esc(t('card.stale'))}">${msg(m, false)}<div class="stale-note">${esc(t('card.stale'))}</div></div>` : msg(m, false)).join('');
}
// Switch card tab without re-rendering, so anything typed in another tab is kept.
function cardTab(k) {
  state.cardTab = k;
  document.querySelectorAll('#modal .ctab').forEach(b => b.classList.toggle('on', b.dataset.ctab === k));
  document.querySelectorAll('#modal .cpane').forEach(d => { d.hidden = d.dataset.pane !== k; });
}

/* ---------- card actions: edit, delete, reply, verdict ---------- */
function editCard() { state.editing = true; render(); const ti = $('f-title'); if (ti) ti.focus(); }
function cancelEdit() { state.editing = false; rerender(); }
async function saveCard(e) {
  e.preventDefault();
  const c = curCard(), now = readFields(true, true), body = {};
  if (!now.title) { setErr('f-err', t('card.err.title')); return false; }
  for (const k in now) if (now[k] !== c[k]) body[k] = now[k];
  try {
    if (Object.keys(body).length) await api('PATCH', `/api/projects/${slug()}/cards/${c.id}`, body);
    state.editing = false;
    await rerender();
  } catch (err) { setErr('f-err', err); }
  return false;
}
async function deleteCard() {
  const c = curCard();
  if (!confirm(t('card.delete.confirm', { id: c.id, title: c.title }))) return;
  try {
    await api('DELETE', `/api/projects/${slug()}/cards/${c.id}`);
    state.editing = false;
    location.hash = '#/p/' + slug();
  } catch (err) { alert(err.message); }
}

// Once the owner has replied or given a verdict he's done with the card: close the panel, back to the board.
function popOutCard(s, id) {
  window.open(`#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 'width=560,height=780');
  location.hash = '#/p/' + s;
}
function closeCard() {
  if (state.route.pop) { window.close(); return; }
  state.editing = false;
  $('modal').innerHTML = '';
  location.hash = '#/p/' + slug();
}
// fixed: a one-tap answer (👍 Go on a question, AIG-75) instead of the typed one.
// Proof on hand-back (AIG-166): what the commit says, the files it changed and the change itself (folded).
function proofHtml(pr) {
  const diff = esc(pr.diff).split('\n').map(l => /^\+(?!\+\+)/.test(l) ? `<span class="add">${l}</span>` : /^-(?!--)/.test(l) ? `<span class="del">${l}</span>` : /^(diff |@@)/.test(l) ? `<span class="hunk">${l}</span>` : l).join('\n');
  return `<div class="proof"><h3>🔍 ${esc(t('proof.title'))}</h3>
    <div><b>${esc(pr.subject)}</b> <span class="muted">${esc(pr.sha.slice(0, 7))} · ${ago(pr.at)}</span>${pr.url ? ` · <a href="${esc(pr.url)}" target="_blank">${esc(t('proof.github'))}</a>` : ''}</div>
    <ul class="proof-files">${pr.files.map(f => `<li><code>${esc(f.file)}</code> <span class="add">+${f.add ?? '?'}</span> <span class="del">−${f.del ?? '?'}</span></li>`).join('')}</ul>
    <details><summary>${esc(t('proof.show'))}</summary><pre class="diff">${diff}${pr.cut ? '\n…' : ''}</pre></details></div>`;
}
// ▶ Open it (AIG-146): ask the board to start the app if needed (confirming the command), then open the page.
async function openIt(s, id, btn) {
  const c = (state.project && state.project.cards.find(x => x.id === id)) || { startCmd: btn.dataset.cmd };
  if (c.startCmd && !confirm(t('verdict.open.confirm', { cmd: c.startCmd }))) return;
  const was = btn.textContent; btn.disabled = true; btn.textContent = t('verdict.open.starting');
  try { const r = await api('POST', `/api/projects/${s}/cards/${id}/open`); window.open(r.url, '_blank'); }
  catch (e) { alert(e.message); }
  btn.disabled = false; btn.textContent = was;
}
/* ---------- pop-outs come back (AIG-183) ---------- */
// A popped-out card closes when you reply or send it back. It is remembered for a day, and when the team
// replies on it again the main window opens it again. Kept in localStorage: every window of the board shares it.
const REOPEN_KEY = 'aigile.reopen', REOPEN_MS = 864e5;
const reopenList = () => { try { return JSON.parse(localStorage.getItem(REOPEN_KEY) || '{}'); } catch { return {}; } };
const reopenSave = l => { try { localStorage.setItem(REOPEN_KEY, JSON.stringify(l)); } catch {} };
function rememberPop(s, id) { if (!state.route.pop) return; const l = reopenList(); l[s + '/' + id] = new Date().toISOString(); reopenSave(l); }
async function reopenPops() {
  if (state.route.pop || document.hidden && !/Electron/.test(navigator.userAgent)) return;
  const l = reopenList(), keys = Object.keys(l); if (!keys.length) return;
  const projects = {};
  for (const k of keys) {
    const [s, id] = k.split('/'), at = l[k];
    if (Date.now() - Date.parse(at) > REOPEN_MS) { delete l[k]; continue; }
    try { projects[s] = projects[s] || await api('GET', '/api/projects/' + s); } catch { continue; }
    const c = projects[s].cards.find(x => x.id === id);
    if (!c || c.status === 'done') { delete l[k]; continue; }
    if (c.comments.some(m => m.at > at && !isOwner(m.author))) { delete l[k]; window.open(`#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 'width=560,height=780'); }
  }
  reopenSave(l);
}
setInterval(reopenPops, 5000);

// After dealing with a For you card, open the next one in the queue instead of closing (AIG-141).
function nextForYou() { const q = forYouQueue(state.project).map(c => c.id), i = q.indexOf(cardId()); return i < 0 ? null : q[i + 1] || q[i - 1] || null; }
function doneWithCard(next) {
  if (next && !state.route.pop) { state.editing = false; location.hash = '#/p/' + slug() + '/' + next; } else closeCard();
}
async function sendReply(fixed) {
  const next = nextForYou(), txt = fixed || $('r-text').value.trim(), key = slug() + '/' + cardId();
  if (!txt && !Attach.has(key)) { setErr('r-err', t('card.err.empty')); return; }
  try {
    const attachments = fixed ? [] : await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/comments`, { author: me(), text: txt, attachments });
    if (!fixed) Attach.clear(key);
    clearDraft(slug() + '/' + cardId() + '/reply');
    if (state.route.pop) {   // a pop-out stays open like a chat (AIG-313): the box clears, ready for the next reply
      const box = $('r-text'); if (box) { box.value = ''; box.focus(); }
      setErr('r-err', ''); refresh(true);
      return;
    }
    doneWithCard(next);
  } catch (err) { setErr('r-err', err); }
}
/* ---------- timed card (AIG-385): ⏰ come back at ---------- */
function timerUi(c) {
  if (c.status === 'done') return '';
  const label = timed(c) ? '⏰ ' + timedWhen(c.timedUntil) : '⏰';
  return `<button id="tm-btn" onclick="timerToggle()" title="${esc(t('timed.title'))}">${esc(label)}</button>
    <span id="tm-box" hidden><select id="tm-pre" onchange="timerPre()"><option value="">${esc(t('timed.pick'))}</option><option value="1h">${esc(t('timed.p.1h'))}</option><option value="3h">${esc(t('timed.p.3h'))}</option><option value="tom">${esc(t('timed.p.tom'))}</option><option value="mon">${esc(t('timed.p.mon'))}</option></select>
    <input type="datetime-local" id="tm-at" aria-label="${esc(t('timed.at'))}"> <button class="primary" onclick="timerSet()">${esc(t('timed.set'))}</button>${timed(c) ? ` <button onclick="timerClear()">${esc(t('timed.clear'))}</button>` : ''}</span>`;
}
function timerToggle() { const b = $('tm-box'); if (b) b.hidden = !b.hidden; }
const localInput = d => new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
function timerPre() {
  const v = $('tm-pre').value, d = new Date();
  if (v === '1h') d.setHours(d.getHours() + 1); else if (v === '3h') d.setHours(d.getHours() + 3);
  else if (v === 'tom') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  else if (v === 'mon') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); }
  else return;
  $('tm-at').value = localInput(d);
}
async function timerSet() {
  const v = $('tm-at').value;
  if (!v) { $('tm-at').focus(); return; }
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/timer`, { until: new Date(v).toISOString() }); refresh(true); } catch (e) { alert(e.message); }
}
async function timerClear() {
  try { await api('DELETE', `/api/projects/${slug()}/cards/${cardId()}/timer`); refresh(true); } catch (e) { alert(e.message); }
}
async function waitAndSee() {
  const next = nextForYou();
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/snooze`); doneWithCard(next); } catch (err) { setErr('v-err', err); }
}
async function verdict(accept) {
  const next = nextForYou(), txt = $('v-text').value.trim(), key = slug() + '/' + cardId() + '#verdict';
  if (!accept && !txt && !Attach.has(key)) { setErr('v-err', t('verdict.err')); $('v-text').focus(); return; }
  try {
    const attachments = await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/verdict`, { accept, text: txt, attachments });
    Attach.clear(key);
    clearDraft(slug() + '/' + cardId() + '/verdict');
    if (!accept) rememberPop(slug(), cardId());
    doneWithCard(next);
  } catch (err) { setErr('v-err', err); }
}
