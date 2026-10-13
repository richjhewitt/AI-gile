/* ---------- card fields (shared by the edit panel and the New card dialog) ---------- */
const opts = (list, cur, labels) => list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(labels ? labels[v] : v)}</option>`).join('');

function cardFields(c, o = {}) {
  return `<label class="f"><span>${esc(t('card.f.title'))}</span><input type="text" id="f-title" value="${esc(c.title)}" placeholder="${esc(o.titlePh || '')}" maxlength="200"></label>
    <label class="f"><span>${esc(o.descLabel || t('card.f.description'))}</span><textarea id="f-description" rows="4" placeholder="${esc(o.descPh || '')}">${esc(c.description)}</textarea></label>
    ${o.testSteps ? `<label class="f"><span>${esc(t('card.f.teststeps'))}</span><textarea id="f-testSteps" rows="4">${esc(c.testSteps)}</textarea></label>` : ''}
    <div class="row">
      <label class="f"><span>${esc(t('card.f.type'))}</span><select id="f-type">${opts(TYPES, c.type, Object.fromEntries(TYPES.map(k => [k, t('type.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.priority'))}</span><select id="f-priority">${opts(PRIORITIES, c.priority, Object.fromEntries(PRIORITIES.map(k => [k, t('priority.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.risk'))}</span><select id="f-risk">${opts(RISKS, c.risk || 'normal', Object.fromEntries(RISKS.map(k => [k, t('risk.' + k)])))}</select></label>
      <label class="f"><span>${esc(t('card.f.status'))}</span><select id="f-status">${opts(Object.keys(COLS), c.status, Object.fromEntries(Object.keys(COLS).map(k => [k, colLabel(state.project, k)])))}</select></label>
    </div>
    <div class="row">
      <label class="f"><span>${esc(t('card.f.assignee'))}</span>${assigneeSelect(c.assignee || '')}</label>
      <label class="f"><span>${esc(t('card.f.sprint'))}</span><input type="text" id="f-sprint" value="${esc(c.sprint)}"></label>
      <label class="f"><span>${esc(t('card.f.group'))}</span><input type="text" id="f-group" list="f-group-list" placeholder="${esc(t('card.f.group.ph'))}" value="${esc(c.group || '')}"><datalist id="f-group-list">${[...new Set((state.project ? state.project.cards : []).map(x => x.group).filter(Boolean))].sort().map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
    </div>
    ${o.flags ? `<div><label class="chk"><input type="checkbox" id="f-blocked" ${c.blocked ? 'checked' : ''}> ${esc(t('card.f.blocked'))}</label>
      <label class="chk"><input type="checkbox" id="f-needsYou" ${c.needsYou ? 'checked' : ''}> ${esc(t('card.f.needsyou'))}</label>
      <label class="chk"><input type="checkbox" id="f-focus" ${c.focus ? 'checked' : ''}> ${esc(t('fx.f.focus'))}</label>
      <label class="chk"><input type="checkbox" id="f-hidepublic" ${c.hidePublic ? 'checked' : ''}> ${esc(t('pub.card.hide'))}</label></div>` : ''}`;
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
// A role template on a project (AIG-420): kept by its id, e.g. ux-researcher-senior. state.profiles = GET /api/profiles.
const profileRole = id => ((state.profiles || {}).roles || []).find(r => r.id === id);
// Loaded once with the project (core.js), so the role picker can name roles added from a team.
async function loadProfiles() { if (!state.profiles) try { state.profiles = await api('GET', '/api/profiles'); } catch { state.profiles = { roles: [], teams: [] }; } return state.profiles; }
const Model = m => String(m || '').replace(/^./, c => c.toUpperCase());
const roleModel = r => (/\((Opus|Sonnet|Haiku)\)$/.exec(r) || [])[1] || Model((profileRole(r) || {}).model);
const roleName = id => { const r = profileRole(id); return r ? `${t('prof.role.' + r.group)}, ${t('prof.level.' + r.level)} (${Model(r.model)})` : id; };
const ROLE_ICON = { lead: '🧠', reviewer: '🔍', frontend: '🎨', backend: '⚙️', qa: '🧪', quickfix: '🔧', copywriter: '📄', tester: '🤖', pm: '📋', fullstack: '🧩', mobile: '📱', devops: '🖥️', security: '🔒', uxui: '✏️', 'ux-researcher': '🔎', data: '📊', accessibility: '♿', i18n: '🌍' };
const roleIcon = id => ROLE_ICON[(profileRole(id) || {}).group] || '👤';
// The role templates on a project beyond today's 8 (AIG-420), e.g. reviewer-senior: assigned by their label, the name briefs use.
const extraRoles = (p = state.project) => (p && Array.isArray(p.roles) ? p.roles : []).filter(r => !TEAM_ROLES.includes(r) && profileRole(r));
// Per model the helper limit when set, else the number of roles on: { total, list: "Opus 1, Sonnet 2, Haiku 3" }.
function rolesCount(on) {
  const pr = leadPrefs(); let total = 0;
  const list = ['Opus', 'Sonnet', 'Haiku'].map(m => {
    const n = [...new Set(on)].filter(r => roleModel(r) === m).length, lim = pr['helpers' + m];
    const k = lim !== '' && lim != null ? Math.min(n, lim) : n;
    total += k; return n ? m + ' ' + k : '';
  }).filter(Boolean).join(', ');
  return { total, list };
}
function assigneeSelect(cur) {
  const team = (state.project?.team || []).filter(m => !/retired/i.test(m.status || '') && m.name !== me()).map(m => m.name);
  const extra = extraRoles().map(id => [profileRole(id).label, id]);
  const known = new Set(['', me(), ...ROLES.map(r => r[0]), ...extra.map(x => x[0]), ...team]);
  const o = (v, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return `<select id="f-assignee" onchange="onAssignee(this)">
    ${o('', t('assignee.nobody'))}${cur && !known.has(cur) ? o(cur, '👤 ' + cur) : ''}
    <optgroup label="${esc(t('assignee.roles'))}">${ROLES.filter(r => r[0] === cur || projectRoleOn(r[0])).map(([v, i, d]) => o(v, `${i} ${v}: ${t(d)}`)).join('')}${extra.map(([v, id]) => o(v, `${roleIcon(id)} ${roleName(id)}`)).join('')}</optgroup>
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

// ⭐ Crucial (AIG-549): kept running while the usage saver is on.
const crucialBtn = c => `<button class="crucial-btn${c.crucial ? ' on' : ''}" aria-pressed="${c.crucial ? 'true' : 'false'}" title="${esc(t('saver.crucial.title'))}" onclick="toggleCrucial()">${esc(t('saver.crucial'))}</button>`;
async function toggleCrucial() {
  const c = curCard(); if (!c) return;
  try { await api('PATCH', `/api/projects/${slug()}/cards/${c.id}`, { crucial: !c.crucial }); refresh(true); } catch (e) { alert(e.message); }
}

function readFields(flags, testSteps) {
  const o = { title: $('f-title').value.trim(), description: $('f-description').value, type: $('f-type').value, priority: $('f-priority').value, risk: $('f-risk').value,
    status: $('f-status').value, assignee: $('f-assignee').value.trim(), sprint: $('f-sprint').value.trim(), group: $('f-group').value.trim() };
  if (testSteps) o.testSteps = $('f-testSteps').value;
  if (flags) { o.blocked = $('f-blocked').checked; o.needsYou = $('f-needsYou').checked; o.focus = $('f-focus').checked; o.hidePublic = $('f-hidepublic').checked; }
  return o;
}

/* ---------- card detail panel ---------- */
// ↩ Reopen and ⋯ Move to (AIG-403): a done card goes back to the column it came from; any card can be moved to a column.
function moveUi(p, c) {
  const cols = colsOf(p).filter(x => x.key !== c.status);
  // The other projects, for ➡️ Move to project (AIG-438): the home list if it is loaded, else fetched once.
  if (!state.projects && !state.projectList && !state.projectListAsked) { state.projectListAsked = true; api('GET', '/api/projects').then(l => { state.projectList = l; refresh(true); }).catch(() => {}); }
  const others = (state.projects || state.projectList || []).filter(x => x.slug !== p.slug && !x.archived);
  return (c.status === 'done' ? `<button data-reopen onclick="moveCard('${esc(c.reopenTo || 'todo')}')" title="${esc(t('card.reopen.title'))}">${esc(t('card.reopen'))}</button> ` : '')
    + `<select id="mv-to" data-moveto onchange="moveCard(this.value)" aria-label="${esc(t('card.moveto'))}"><option value="">${esc(t('card.moveto'))}</option>${cols.map(x => `<option value="${esc(x.key)}">${esc(((x.emoji ? x.emoji + ' ' : '') + x.name).trim())}</option>`).join('')}</select>`
    + (others.length ? ` <select id="mv-proj" onchange="moveToProject(this.value)" aria-label="${esc(t('card.moveproj'))}"><option value="">${esc(t('card.moveproj'))}</option>${others.map(x => `<option value="${esc(x.slug)}">${esc(x.name)}</option>`).join('')}</select>` : '');
}
// ➡️ Move to another project (AIG-438): a copy lands there with a link back; this card closes with a link forward.
async function moveToProject(to) {
  if (!to) return;
  try { const r = await api('POST', `/api/projects/${slug()}/cards/${cardId()}/moveproject`, { to }); location.hash = `#/p/${r.project}/${r.id}`; } catch (e) { alert(e.message); refresh(true); }
}
async function moveCard(status) {
  if (!status) return;
  const body = { status };
  if (status === 'done' && state.project) {   // 🔥 an incident is closed with its post-mortem (AIG-614)
    const c = state.project.cards.find(x => x.id === cardId());
    if (c && c.type === 'incident' && c.status !== 'done') { body.postmortem = await postmortemAsk(); if (!body.postmortem) { refresh(true); return; } }
  }
  try { await api('PATCH', `/api/projects/${slug()}/cards/${cardId()}`, body); refresh(true); } catch (e) { alert(e.message); }
}
// 🔥 The post-mortem dialog: what happened, why, what we change. Resolves to the three answers, or null if cancelled (AIG-614).
function postmortemAsk() {
  return new Promise(res => {
    let sent = false;
    const keys = ['happened', 'why', 'change'];
    openDialog(`<h2>${esc(t('pm.title'))}</h2><p class="muted">${esc(t('pm.intro'))}</p><form id="pm-form">${keys.map(k => `<label class="f"><span>${esc(t('pm.' + k))}</span><textarea id="pm-${k}" rows="2" required></textarea></label>`).join('')}
      <div class="actions"><button class="primary" type="submit">${esc(t('pm.done'))}</button><button type="button" id="pm-cancel">${esc(t('common.cancel'))}</button></div></form>`, 'postmortem');
    $('pm-form').onsubmit = e => { e.preventDefault(); sent = true; const o = Object.fromEntries(keys.map(k => [k, $('pm-' + k).value.trim()])); closeDialog(); res(o); };
    $('pm-cancel').onclick = () => { closeDialog(); res(null); };
    const mo = new MutationObserver(() => { if (!document.getElementById('pm-form') && !sent) { mo.disconnect(); sent = true; res(null); } });
    mo.observe(document.body, { childList: true, subtree: true });
  });
}
const postmortemHtml = c => c.postmortem ? `<div class="postmortem"><h3>${esc(t('pm.heading'))}</h3>${['happened', 'why', 'change'].map(k => `<p><b>${esc(t('pm.' + k))}</b> ${esc(c.postmortem[k])}</p>`).join('')}</div>` : '';
// The merge gate (AIG-613): 🟢 QA green (areas, full suite) / 🔴 QA red / ⚪ no QA yet. Set with aigile qa.
function qaGateHtml(c) {
  const q = c.qa; if (!q) return `<div class="qa-gate none">${esc(t('qa.none'))}</div>`;
  const red = q.result === 'fail' || q.full === 'fail', bits = [(q.areas || []).join(', '), q.full ? t('qa.full.' + q.full) : ''].filter(Boolean).join('; ');
  return `<div class="qa-gate ${red ? 'red' : 'green'}" title="${esc([q.by, q.at && ago(q.at)].filter(Boolean).join(' · '))}">${esc(t(red ? 'qa.red' : 'qa.green'))}${bits ? ` <span class="muted">(${esc(bits)})</span>` : ''}${q.note ? ` <span class="muted">${esc(q.note)}</span>` : ''}</div>`;
}
function renderCard(p, c) {
  const pop = state.route.pop, close = pop ? 'window.close()' : `location.hash='#/p/${p.slug}'`;
  // ⧉ Pop out (AIG-122): the card in its own small window, to follow steps on one screen and work on another.
  const popBtn = pop ? '' : `<button onclick="popOutCard('${p.slug}', '${c.id}')" title="${esc(t('card.popout.title'))}">${esc(t('card.popout'))}</button>`;
  const head = `<div class="actions" style="margin-top:0"><button onclick="${close}">${esc(t('card.close'))}</button>${popBtn}${p.path ? Editor.btn(p, c) : ''}${Share.cardBtn(p, c)}${Pack.cardBtns(p, c)}${Dmme.btn()}${state.editing ? '' : `<button id="remind-btn" onclick="remindToggle()" title="${esc(t('remind.title'))}">${esc(t('remind.btn'))}</button>`}${state.editing ? '' : timerUi(c)}${state.editing ? '' : crucialBtn(c)}${state.editing ? '' : Focus.btn(p, c)}${state.editing ? '' : Term.btn(c, 'term-btn')}<span style="flex:1"></span>
      ${state.editing ? '' : moveUi(p, c)}
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
  const verdict = c.status === 'verify' && c.info ? `<div class="verdict"><h3>${esc(t('info.tag'))}</h3>
      <label class="f" style="margin-top:8px"><span>${esc(t('info.label'))}</span><textarea id="v-text" data-draft="${esc(p.slug + '/' + c.id)}/info" rows="2" placeholder="${esc(t('info.ph'))}"></textarea></label>
      <div class="err" id="v-err"></div>
      <div class="actions"><button class="good" onclick="gotIt()">${esc(t('info.gotit'))}</button><button onclick="infoReply()" title="${esc(t('info.reply.title'))}">${esc(t('info.reply'))}</button>${Attach.boxHtml(p.slug + '/' + c.id + '#verdict')}</div></div>`
    : c.status === 'verify' ? `<div class="verdict"><h3>${esc(t('verdict.h'))}</h3>${pileLeft(p, c)}${aiEvidence(c, p.slug)}
      <div class="muted">${esc(t('verdict.waiting'))}${c.testSteps ? esc(t('verdict.steps')) : ''}.</div>
      <label class="f" style="margin-top:8px"><span>${esc(t('verdict.comment'))}</span><textarea id="v-text" data-draft="${esc(p.slug + '/' + c.id)}/verdict" rows="3" placeholder="${esc(t('verdict.placeholder'))}"></textarea></label>
      <div class="err" id="v-err"></div>
      ${c.openUrl ? `<div class="actions" style="margin-top:0"><button class="primary" onclick="openIt('${p.slug}', '${c.id}', this)" title="${esc(c.openUrl)}">${esc(t('verdict.open'))}</button><span class="muted">${esc(c.openUrl)}</span></div>` : ''}
      <div class="actions"><button class="good" onclick="verdict(true, this)">${esc(t('card.accept'))}</button><button class="warn" onclick="verdict(false)">${esc(t('card.sendback'))}</button><button onclick="waitAndSee()" title="${esc(t('card.wait.title'))}">${esc(t('card.wait'))}</button>${Attach.boxHtml(p.slug + '/' + c.id + '#verdict')}</div></div>` : '';
  // Tabs: Reply (latest message on top, reply box right under it, older ones below), Details, Test.
  const msg = (m, latest) => `<div class="comment${latest ? ' latest' : ''}">${latest ? '<span class="tag-latest">' + esc(t('card.latest')) + '</span>' : ''}<span class="who">${face(m.author, p.team)}${esc(m.author)}</span><span class="when">${ago(m.at)}</span>${isOwner(m.author) ? (p.teamSeenAt && m.at <= p.teamSeenAt ? '<span class="seen">' + esc(t('card.seen')) + '</span>' : '<span class="seen">' + esc(t('card.notseen')) + '</span>') : ''}${m.from === 'outside' ? Pack.body(p, c, m) : `<div class="body">${linkify(m.text, p)}</div>`}${Attach.shown(m, p.slug)}${Share.commentMark(p, c, m)}</div>`;
  const newest = [...c.comments].reverse();
  const hasTest = c.status === 'verify' || c.testSteps;
  // The team's notes since your last word, shown on the Test tab next to Accept, so you never go looking (AIG-152).
  const lastMine = c.comments.map(m => isOwner(m.author)).lastIndexOf(true);
  const notes = c.comments.slice(lastMine + 1).filter(m => !isOwner(m.author) && (m.attachments || !/^Ready for you to test\./.test(m.text))).slice(-3);
  if (c.status !== 'verify') state.pileRun = null;
  if (state.tabFor !== c.id) { state.tabFor = c.id; state.cardTab = c.status === 'verify' ? 'test' : c.comments.length ? 'reply' : 'details'; }
  const tab = state.cardTab === 'test' && !hasTest ? 'reply' : state.cardTab;
  const tabBtn = (k, label) => `<button class="ctab ${tab === k ? 'on' : ''}" data-ctab="${k}" onclick="cardTab('${k}')">${label}</button>`;
  return `<div class="overlay" onclick="if(event.target===this) ${close}"><div class="panel" ${Term.panelAttr(p, c)}>${head}
    <div class="id muted" style="margin-top:12px">${esc(c.id)} · ${esc(colLabel(p, c.status))}${c.status === 'team' && c.prevStatus ? ' ' + esc(t('card.was', { col: colLabel(p, c.prevStatus) })) : ''}${c.sprint ? ' · ' + esc(c.sprint) : ''}</div>
    <h2>${esc(c.title)}</h2>
    <div class="meta">${metaHtml(c)}</div>
    ${checklistUi(p, c)}${waitsUi(p, c)}${secretsUi(p, c)}
    <div class="ctabs">${tabBtn('reply', esc(t('card.tab.reply')) + (c.comments.length ? ` <span class="n">${c.comments.length}</span>` : ''))}${tabBtn('details', esc(t('card.tab.details')))}${hasTest ? tabBtn('test', esc(t('card.tab.test')) + (c.status === 'verify' ? ` <span class="n hot">${esc(t('card.tab.yourcall'))}</span>` : '')) : ''}</div>
    <div class="cpane" data-pane="reply" ${tab === 'reply' ? '' : 'hidden'}>
      ${Share.cardComments(p, c)}
      ${quizPanel(p, c)}
      ${pop ? chatHtml(p, c, msg) : followBar(p, c) + replyHtml(p, c, msg, newest)}
    </div>
    <div class="cpane" data-pane="details" ${tab === 'details' ? '' : 'hidden'}>
      ${qaGateHtml(c)}${c.description ? `<div class="desc">${linkify(c.description, p)}</div>` : `<p class="muted">${esc(t('card.nodesc'))}</p>`}${postmortemHtml(c)}${Attach.shown(c, p.slug)}
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
const replyBox = (p, c) => `<div class="reply">${cardAnswers(p, c)}<textarea id="r-text" data-draft="${esc(p.slug + '/' + c.id)}/reply" rows="3" placeholder="${esc(t('card.reply.ph', { name: me() }))}" onkeydown="if(EnterSend.is(event,'card')){event.preventDefault();sendReply()}"></textarea>
        <div class="err" id="r-err"></div>
        <div class="actions">${c.needsYou ? `<button class="good" onclick="sendReply('GO')" title="${esc(t('card.go.title'))}">${esc(t('dms.go'))}</button>` : ''}<button class="primary" onclick="sendReply()">${esc(t('card.sendreply'))}</button>${looksRight(c)}${Attach.boxHtml(p.slug + '/' + c.id)}</div></div>`;
/* ---------- one-click answers on the card itself (AIG-371, AIG-315) ----------
   An open `aigile task` (assigned to the owner) always gets a ✅ Done. An open `aigile ask` (needs the owner) gets the same
   Go / Yes / --options buttons as the inbox (askActions, core.js); one that needs a reason (Not yet, No) starts the reply box.
   👍 Looks right sits next to Send reply when the newest comment is from the team and holds a code block or says
   "you should see" (en) / "je zou ... zien" / "zou je ... moeten zien" (nl). It sends the localised "Done, it looked as expected". */
const LOOKS_RIGHT_RE = /```|you should see|you'll see|je zou[^.\n]{0,40}zien|zou je[^.\n]{0,40}zien|je moet[^.\n]{0,40}zien/i;
function looksRight(c) {
  const m = (c.comments || []).at(-1);
  return m && !isOwner(m.author) && c.status !== 'done' && LOOKS_RIGHT_RE.test(m.text || '') ? `<button class="good" data-looksright title="${esc(t('card.looksright.title'))}" onclick="sendReply(t('card.looksright.say'))">${esc(t('card.looksright'))}</button>` : '';
}
function cardAnswers(p, c) {
  if (c.status === 'done') return '';
  if (isOwner(c.assignee)) return `<div class="msg-acts card-acts"><button class="good" data-cardtaskdone onclick="cardTaskDone()">${esc(t('inbox.k.done'))}</button></div>`;
  if (!c.needsYou || c.blocked || c.status === 'verify') return '';
  const cs = [...(c.comments || [])].reverse(), a = cs.find(x => x.mark === 'ask' && !isOwner(x.author)) || cs.find(x => !isOwner(x.author));
  const acts = a ? askActions(a, 'question') : [];
  return acts.length ? `<div class="msg-acts card-acts">${acts.map(x => `<button class="${x.ask != null ? '' : 'good'}" data-cardact ${x.ask != null ? `data-ask="${esc(x.ask)}"` : `data-say="${esc(x.say)}"`}>${esc(x.label)}</button>`).join('')}</div>` : '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cardact]'); if (!b) return;
  e.preventDefault();
  if (b.dataset.ask != null) { const ta = $('r-text'); if (ta) { ta.value = b.dataset.ask; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
  sendReply(b.dataset.say);
});
async function cardTaskDone() {
  const next = nextForYou();
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/taskdone`, { text: $('r-text').value.trim() }); clearDraft(slug() + '/' + cardId() + '/reply'); doneWithCard(next); } catch (err) { setErr('r-err', err); }
}
// A popped-out card is a live chat (AIG-313): oldest first, newest at the bottom, a typing line while the team
// works on the card, the reply box underneath. Sending never closes it.
function chatHtml(p, c, msg) {
  // AIG-639: "working…" only while a run is going, or a session is at work (not idle in its wait); a finished run says nothing.
  const pr = p.presence || {}, atWork = pr.running || (pr.online && !pr.waitingMs && (pr.where === 'vscode' || pr.where === 'terminal'));
  const typing = atWork && (c.status === 'doing' || c.status === 'team') && !c.needsYou;
  return `<div class="chat">${c.comments.length ? c.comments.map(m => msg(m, false)).join('') : `<p class="muted">${esc(t('card.nomsgs'))}</p>`}</div>
      ${typing || nudgeLit(p, c, false) ? `<div class="typing muted" id="typing">${typing ? stateLine(pr) : ''} ${nudgeBtn(p, c, typing)}</div>` : ''}
      ${followBar(p, c)}${replyBox(p, c)}`;
}
// AIG-636: what the team is doing and for how long ("working · 12 min"), so busy and hung look different. presence.activity
// comes from the board: thinking (model output), working (tools), command (a long shell command). A run whose log has
// not grown for 15 min shows "no sign of life" in the warning colour.
const NOLIFE_MS = 15 * 60e3;
function stateLine(pr) {
  const a = pr.activity; if (!a) return esc(t('card.working'));
  const min = iso => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60e3)), stale = a.watch && Date.now() - Date.parse(a.signAt) >= NOLIFE_MS;
  const line = esc(t('card.act.' + a.state)) + ' · ' + esc(t('card.act.min', { n: min(a.since) }));
  return `<span class="act">${line}</span>` + (stale ? ` <b class="act-stale">⚠ ${esc(t('card.act.stale', { n: min(a.signAt) }))}</b>` : '');
}
// 👉 Nudge (AIG-593): by the typing line, lit when your last message is still not seen after 3 min, or the team has been
// typing for 5 min with nothing new. A click is the card's normal poke (free; only the wake run uses tokens). A run that
// really hangs is restarted by the board's own hang check (presence.js), so the button never kills a working run.
const typingSince = {};
const NUDGE_UNSEEN_MS = 3 * 60e3, NUDGE_TYPING_MS = 5 * 60e3;
function nudgeLit(p, c, typing) {
  const k = p.slug + '/' + c.id, last = c.comments[c.comments.length - 1], now = Date.now();
  const lastAt = last ? Date.parse(last.at) : 0;   // typing time restarts with each new message
  if (!typing) delete typingSince[k]; else if (!typingSince[k]) typingSince[k] = now; else if (lastAt > typingSince[k]) typingSince[k] = lastAt;
  const mine = [...c.comments].reverse().find(m => isOwner(m.author));
  const unseen = mine && !mine.poke && !(p.teamSeenAt && mine.at <= p.teamSeenAt) && now - Date.parse(mine.at) > NUDGE_UNSEEN_MS && !c.comments.slice(c.comments.indexOf(mine) + 1).some(m => !isOwner(m.author));
  return !!(unseen || (typing && now - typingSince[k] > NUDGE_TYPING_MS));
}
function nudgeBtn(p, c, typing) {
  const lit = nudgeLit(p, c, typing);
  return `<button type="button" class="nudge${lit ? ' lit' : ''}" id="nudgeBtn" onclick="nudgeCard(this)" title="${esc(t(lit ? 'nudge.lit' : 'nudge.title'))}" aria-label="${esc(t('nudge.title'))}">👉</button>`;
}
async function nudgeCard(btn) {
  if (btn) btn.disabled = true;
  try { await api('POST', `/api/projects/${slug()}/cards/${cardId()}/poke`); refresh(true); } catch (e) { alert(e.message); if (btn) btn.disabled = false; }
}
// AIG-426: the lead carried on in another card: a button to go there (and, if set, going by itself).
function followBar(p, c) { return c.followUp && p.cards.some(x => x.id === c.followUp) ? Follow.html('card', p.slug, c.id, c.followUp) : ''; }
// While the owner types in a pop-out, only the messages and the typing line are swapped, never the reply box.
function popChatLive() {
  const p = state.project, c = p && p.cards.find(x => x.id === state.route.card), chat = document.querySelector('#modal .chat');
  if (!c || !chat || state.editing) return false;
  const tmp = document.createElement('div'); tmp.innerHTML = renderCard(p, c);
  const nc = tmp.querySelector('.chat'); if (!nc) return false;
  const de = document.documentElement, atEnd = de.scrollHeight - window.scrollY - window.innerHeight < 60;
  if (chat.innerHTML !== nc.innerHTML) chat.innerHTML = nc.innerHTML;
  const ty = document.getElementById('typing'), nt = tmp.querySelector('#typing');
  if (ty && !nt) ty.remove(); else if (!ty && nt) chat.after(nt); else if (ty && nt && ty.innerHTML !== nt.innerHTML && !ty.contains(document.activeElement)) ty.innerHTML = nt.innerHTML;   // 👉 lights up (AIG-593)
  const fbar = document.querySelector('#modal .follow-bar'), nbar = tmp.querySelector('.follow-bar');
  if (fbar && !nbar) fbar.remove(); else if (nbar && (!fbar || fbar.dataset.follow !== nbar.dataset.follow)) { if (fbar) fbar.remove(); (document.getElementById('typing') || chat).after(nbar); }
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
  // The one-click answers and Looks right live inside the box but follow the newest message (AIG-371, AIG-315): swap just those.
  const acts = r.querySelector('.card-acts'), nacts = nr.querySelector('.card-acts'), lr = r.querySelector('[data-looksright]'), nlr = nr.querySelector('[data-looksright]');
  if ((acts ? acts.outerHTML : '') !== (nacts ? nacts.outerHTML : '')) { changed = true; if (acts && nacts) acts.replaceWith(nacts); else if (acts) acts.remove(); else r.prepend(nacts); }
  if ((lr ? lr.outerHTML : '') !== (nlr ? nlr.outerHTML : '')) { changed = true; if (lr && nlr) lr.replaceWith(nlr); else if (lr) lr.remove(); else r.querySelector('.primary').after(nlr); }
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
  for (const k in now) if (now[k] !== (k === 'risk' ? c.risk || 'normal' : c[k])) body[k] = now[k];
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
  popOut('card', `#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 560, 780);
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
    if (c.comments.some(m => m.at > at && !isOwner(m.author))) { delete l[k]; popOut('card', `#/pop/${s}/${id}`, 'aigile-' + s + '-' + id, 560, 780); }
  }
  reopenSave(l);
}
setInterval(reopenPops, 5000);

// After dealing with a For you card, open the next one in the queue instead of closing (AIG-141).
// "3 of 12 left" (AIG-633): while working through the For you to test pile, a small line on the card. The total is the
// biggest the pile has been in this run (a run ends when you open a card that is not waiting for a test).
function pileLeft(p, c) {
  const left = forYouQueue(p).filter(x => x.status === 'verify' && kindOf(x) === 't').length;
  if (!state.pileRun || state.pileRun.slug !== p.slug) state.pileRun = { slug: p.slug, total: left };
  state.pileRun.total = Math.max(state.pileRun.total, left);
  if (left < 1 || state.pileRun.total < 2) return '';
  return `<div class="muted pile-left" id="pileLeft">${esc(t('pile.left', { n: left, total: state.pileRun.total }))}</div>`;
}
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
/* ---------- checklist and waits for (AIG-406) ---------- */
// A task for the owner shows its steps a few at a time (AIG-416): the owner's steps setting says how many open ones.
const CHK_SHOW = { 1: 1, 2: 3, 3: 5 }, chkAll = new Set();
function checklistUi(p, c) {
  const list = c.checklist || [], left = checkLeft(c);
  if (c.status === 'done' && !list.length) return '';
  const show = isOwnerTask(c) && !chkAll.has(c.id) ? CHK_SHOW[leadPrefs().steps] : 0, open = list.map((x, i) => x.done ? -1 : i).filter(i => i >= 0);
  const hidden = show && open.length > show ? new Set(open.slice(show)) : new Set();
  const items = list.map((x, i) => hidden.has(i) ? '' : `<li class="${x.done ? 'on' : ''}"><label><input type="checkbox" data-chk-i="${i}" ${x.done ? 'checked' : ''} onchange="checkTick(${i}, this.checked)"> <span>${esc(x.text)}</span></label>`
    + `<span class="chk-acts"><button type="button" class="chk-b" title="${esc(t('check.up'))}" ${i ? '' : 'disabled'} onclick="checkMove(${i}, -1)">↑</button><button type="button" class="chk-b" title="${esc(t('check.down'))}" ${i < list.length - 1 ? '' : 'disabled'} onclick="checkMove(${i}, 1)">↓</button><button type="button" class="chk-b" title="${esc(t('check.remove'))}" onclick="checkRemove(${i})">✕</button></span></li>`).join('');
  return `<div class="chk" id="chk-box"><div class="chk-h"><b>☑ ${esc(t('check.h'))}</b>${list.length ? ` <span class="pill chk${left ? '' : ' all'}">${list.length - left}/${list.length}</span>` : ''}</div>
    ${list.length ? `<ul class="chk-list">${items}</ul>` : ''}${hidden.size ? `<div class="chk-more muted" id="chk-more">${esc(t('check.more', { n: hidden.size }))} <button type="button" class="link" onclick="chkAll.add(cardId()); refresh(true)">${esc(t('check.more.all'))}</button></div>` : ''}
    <div class="chk-add"><input id="chk-new" placeholder="${esc(t('check.add.ph'))}" onkeydown="if(event.key==='Enter'){event.preventDefault();checkAdd()}"> <button type="button" id="chk-add-btn" onclick="checkAdd()">${esc(t('check.add'))}</button></div></div>`;
}
const cardUrl = () => `/api/projects/${slug()}/cards/${cardId()}`;
async function checkTick(i, on) {
  try { await api('POST', cardUrl() + '/check', on ? { tick: [i + 1] } : { untick: [i + 1] }); refresh(true); } catch (e) { alert(e.message); refresh(true); }
}
async function checkSave(list) {
  try { await api('PATCH', cardUrl(), { checklist: list.map(x => ({ text: x.text, done: !!x.done, by: x.by, at: x.at })) }); refresh(true); } catch (e) { alert(e.message); }
}
function checkAdd() {
  const el = $('chk-new'), words = (el.value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!words.length) { el.focus(); return; }
  checkSave([...(curCard().checklist || []), ...words.map(text => ({ text }))]);
}
function checkRemove(i) { const l = [...(curCard().checklist || [])]; l.splice(i, 1); checkSave(l); }
function checkMove(i, d) { const l = [...(curCard().checklist || [])], j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; checkSave(l); }
function waitsUi(p, c) {
  const ids = c.waitsFor || [];
  if (c.status === 'done' && !ids.length) return '';
  const pick = `<select id="wf-add" aria-label="${esc(t('wait.pick'))}" onfocus="waitFill(this)" onmousedown="waitFill(this)" onchange="waitAdd(this.value)"><option value="">${esc(t('wait.pick'))}</option></select>`;   // options filled when opened, so a new card elsewhere does not rebuild the panel
  return `<div class="wf" id="wf-box">${ids.length ? `<b>⏳ ${esc(t('wait.h'))}</b> ` : ''}${ids.map(id => { const b = p.cards.find(x => x.id === id), fin = !b || b.status === 'done';
    return `<span class="pill waits ${fin ? 'fin' : ''}" title="${esc(b ? b.title : id)}">${fin ? '✓ ' : ''}<a href="#/p/${esc(p.slug)}/${esc(id)}">${esc(id)}</a> <button type="button" class="chk-b" title="${esc(t('wait.remove'))}" onclick="waitDrop('${esc(id)}')">✕</button></span>`; }).join(' ')} ${pick}</div>`;
}
function waitFill(sel) {
  if (sel.options.length > 1) return;
  const c = curCard(), ids = c.waitsFor || [];
  for (const x of state.project.cards.filter(x => x.id !== c.id && x.status !== 'done' && !ids.includes(x.id) && !(x.waitsFor || []).includes(c.id))) sel.add(new Option(x.id + ' ' + x.title.slice(0, 60), x.id));
}
async function waitSave(ids) { try { await api('PATCH', cardUrl(), { waitsFor: ids }); refresh(true); } catch (e) { alert(e.message); } }
function waitAdd(id) { if (id) waitSave([...(curCard().waitsFor || []), id]); }
function waitDrop(id) { waitSave((curCard().waitsFor || []).filter(x => x !== id)); }

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
// 📖 To read (AIG-392): Got it accepts (a typed note goes along); Reply tells the team and keeps the card here.
async function gotIt() { return verdict(true); }
async function infoReply() {
  const txt = $('v-text').value.trim(), key = slug() + '/' + cardId() + '#verdict';
  if (!txt && !Attach.has(key)) { setErr('v-err', t('info.err')); $('v-text').focus(); return; }
  try {
    const attachments = await Attach.upload(key, slug());
    await api('POST', `/api/projects/${slug()}/cards/${cardId()}/verdict`, { reply: true, text: txt, attachments });
    Attach.clear(key); clearDraft(slug() + '/' + cardId() + '/info'); $('v-text').value = ''; setErr('v-err', ''); refresh(true);
  } catch (err) { setErr('v-err', err); }
}
async function verdict(accept, btn) {
  if (accept && !acceptSure(btn, curCard())) return;   // unfinished checklist: "2 of 3 left: accept anyway?" (AIG-406)
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
