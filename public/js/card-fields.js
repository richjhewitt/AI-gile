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
  const noAi = document.body.classList.contains('noai');   // AIG-821: no AI, no roles: the people from the team (and you)
  const extra = extraRoles().map(id => [profileRole(id).label, id]);
  const known = new Set(['', me(), ...ROLES.map(r => r[0]), ...extra.map(x => x[0]), ...team]);
  const o = (v, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  return `<select id="f-assignee" onchange="onAssignee(this)">
    ${o('', t('assignee.nobody'))}${cur && !known.has(cur) ? o(cur, '👤 ' + cur) : ''}
    ${noAi ? (ROLES.some(r => r[0] === cur) ? o(cur, cur) : '') : `<optgroup label="${esc(t('assignee.roles'))}">${ROLES.filter(r => r[0] === cur || projectRoleOn(r[0])).map(([v, i, d]) => o(v, `${i} ${v}: ${t(d)}`)).join('')}${extra.map(([v, id]) => o(v, `${roleIcon(id)} ${roleName(id)}`)).join('')}</optgroup>`}
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
// 🔥 One click to mark a card urgent (AIG-899); click again to put the old priority back.
const urgentBtn = (c, s) => { if (c.leadChat || c.id === 'chat' || !/-\d+$/.test(c.id || '')) return '';   // only real cards
  const on = c.priority === 'urgent'; return `<button type="button" class="urg-btn${on ? ' on' : ''}" data-urgent="${esc(s || (state.project && state.project.slug))}/${esc(c.id)}" aria-pressed="${on}" title="${esc(t(on ? 'urgent.unmark' : 'urgent.mark'))}">🔥</button>`; };
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-urgent]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const [s, id] = b.dataset.urgent.split('/');
  try {
    const c = (await api('GET', `/api/projects/${s}`)).cards.find(x => x.id === id); if (!c) return;
    const body = c.priority === 'urgent' ? { priority: c.prevPriority && c.prevPriority !== 'urgent' ? c.prevPriority : 'normal', prevPriority: '' } : { priority: 'urgent', prevPriority: c.priority };
    await api('PATCH', `/api/projects/${s}/cards/${id}`, body); refresh(true); if (typeof Inbox !== 'undefined' && Inbox.reload) Inbox.reload();
  } catch (err) { alert(err.message); }
}, true);
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

