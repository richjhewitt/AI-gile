/* ---------- 👥 Team on a project and the profile editor (AIG-423, docs/PROFILES.md) ---------- */
// The roles on this project as rows (name, level, model; ✏️ edit, ✕ remove), ➕ Add team, ➕ Add role, the count line, and a
// fold for this project's own "how agents work with you" (steps, go, words). Every change is saved at once.
// TM.data = GET /api/projects/<slug>/profiles (the roles with your copies and this project's numbers); state.profiles the templates.
const TM = { data: null, msg: '' };
const LEVEL_ORDER = ['junior', 'mid', 'senior', 'principal'];
const LEAD_ID = 'lead-principal';
const tmOn = () => TM.data.roles.map(r => r.id);

async function teamDialog(msg = '') {
  await Promise.all([loadProfiles(), xtLoad(), ptLoad()]);
  XT.msg = '';
  try { TM.data = await api('GET', '/api/projects/' + slug() + '/profiles'); } catch (e) { alert(e.message); return; }
  TM.msg = msg; TM.friends = await api('GET', '/api/dms/contacts').then(l => l.filter(c => !c.blocked), () => []);
  popNext('team'); openDialog(`<div id="tm-box">${teamHtml()}</div>`, 'wide team-dlg');
}
// Painted again after each change; the fold stays as it was and the focus where it was.
async function teamPaint(msg) {
  const open = $('tm-owner') && $('tm-owner').open, f = document.activeElement && document.activeElement.id;
  [TM.data, state.project] = await Promise.all([api('GET', '/api/projects/' + slug() + '/profiles'), api('GET', '/api/projects/' + slug())]);
  if (msg !== undefined) TM.msg = msg;
  if (!$('tm-box')) return;
  $('tm-box').innerHTML = teamHtml();
  if (open) $('tm-owner').open = true;
  if (f && $(f)) $(f).focus();
}
function teamHtml() {
  // 🚫 No AI, ever (AIG-581/582): the roster is just the people.
  if (NoAi.on) return `<h2>${esc(t('tm.h'))}</h2><p class="muted">${esc(t('tm.intro', { name: state.project.name }))}</p>${peopleHtml()}<div class="tm-msg" id="tm-msg" role="status">${TM.msg}</div><div class="err" id="tm-err"></div>
    <div class="actions"><button class="primary" type="button" onclick="closeDialog(); rerender()">${esc(t('common.done'))}</button></div>`;
  const pr = leadPrefs(), on = tmOn(), all = (state.profiles.roles || []).filter(r => !on.includes(r.id));
  const row = r => { const g = (profileRole(r.id) || {}).group || '', mine = r.mine, here = Object.keys(r.project || {}).length;
    return `<div class="tm-row" data-role-id="${esc(r.id)}"><span class="tm-ic" aria-hidden="true">${roleIcon(r.id)}</span>
      <span class="tm-name"><b>${esc(t('prof.role.' + g))}</b> <span class="muted">${esc(t('prof.level.' + r.level))} · ${esc(Model(r.model))}</span>
      ${mine ? `<span class="pill">${esc(t('tm.mine'))}</span>` : ''}${here ? `<span class="pill">${esc(t('tm.here'))}</span>` : ''}</span>
      ${loadTplHtml(r.id)}
      <button type="button" class="tm-edit" onclick="profileEditor('${esc(r.id)}')" title="${esc(t('tm.edit'))}" aria-label="${esc(t('tm.edit') + ': ' + roleName(r.id))}">✏️</button>
      ${r.id === LEAD_ID ? `<span class="tm-lock muted" title="${esc(t('tm.lead.lock'))}">🔒</span>` : `<button type="button" class="tm-del" onclick="teamRemove('${esc(r.id)}')" title="${esc(t('tm.remove'))}" aria-label="${esc(t('tm.remove') + ': ' + roleName(r.id))}">✕</button>`}</div>`; };
  // Add role: every template not on, by role then level.
  const groups = [...new Set(all.map(r => r.group))].sort((a, b) => t('prof.role.' + a).localeCompare(t('prof.role.' + b)));
  const addRole = `<select id="tm-add-role" onchange="teamAddRole(this.value)" aria-label="${esc(t('tm.addrole'))}"><option value="">${esc(t('tm.addrole'))}</option>${groups.map(g => `<optgroup label="${esc(t('prof.role.' + g))}">${all.filter(r => r.group === g).sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)).map(r => `<option value="${esc(r.id)}">${esc(roleName(r.id))}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const own = TM.data.owner || {}, sc = pr.scales || {};
  const ownerRow = k => scaleSlider(k, 5, own[k] || sc[k], 'teamOwnerScale', 'tmo', '') + `<small class="muted tm-from">${own[k] ? `${esc(t('tm.owner.own'))} <button type="button" onclick="teamOwnerScale('${k}', null)">${esc(t('tm.owner.reset'))}</button>` : esc(t('tm.owner.setup'))}</small>`;
  return `<h2>${esc(t('tm.h'))}</h2><p class="muted">${esc(t('tm.intro', { name: state.project.name }))}</p>
    ${typeHtml()}
    <div class="tm-rows">${TM.data.roles.map(row).join('')}</div>
    <small class="muted" id="tm-count">${esc(t('look.roles.count', rolesCount(on)))}</small>
    <div class="tm-add">${addRole}</div>
    <div class="tm-add"><select id="tm-team" aria-label="${esc(t('look.team.pick'))}"><option value="">${esc(t('look.team.pick'))}</option>${(state.profiles.teams || []).map(tm => `<option value="${esc(tm.id)}">${esc(t('prof.team.' + tm.id))}</option>`).join('')}</select>
      <button type="button" id="tm-team-add" onclick="teamApply('add')">${esc(t('tm.team.add'))}</button><button type="button" id="tm-team-replace" onclick="teamApply('replace')">${esc(t('tm.team.replace'))}</button></div>
    <small class="muted">${esc(t('tm.team.sub'))}</small>
    ${xtHtml()}
    ${matesHtml()}
    ${peopleHtml()}
    <div class="tm-msg" id="tm-msg" role="status">${TM.msg}</div>
    <details class="tm-owner" id="tm-owner"><summary>${esc(t('tm.owner.h'))}</summary><small class="muted">${esc(t('tm.owner.sub'))}</small>${['steps', 'go', 'words'].map(ownerRow).join('')}</details>
    <div class="err" id="tm-err"></div>
    <div class="actions"><button class="primary" type="button" onclick="closeDialog(); rerender()">${esc(t('common.done'))}</button></div>`;
}
// The roles as ids to PATCH (the server keeps today's 8 by their old names); Lead always stays.
async function teamSetRoles(ids, msg) {
  try { await api('PATCH', '/api/projects/' + slug(), { roles: ids }); await teamPaint(msg); }
  catch (e) { setErr('tm-err', e); }
}
const teamRemove = id => teamSetRoles(tmOn().filter(x => x !== id), esc(t('tm.removed', { role: roleName(id) })));
// Adding a role at another level swaps out the one already on (frontend-senior for frontend-mid), as Add team does.
function teamAddRole(id) {
  if (!id) return;
  const g = (profileRole(id) || {}).group, out = tmOn().filter(x => x !== LEAD_ID && (profileRole(x) || {}).group === g);
  teamSetRoles([...tmOn().filter(x => !out.includes(x)), id], esc(t(out.length ? 'look.team.done' : 'look.team.done.none', { added: roleName(id), replaced: out.map(roleName).join(', ') })));
}
// Applying a team (AIG-444): Add members = the team joins, the same role at another level is swapped out, the rest are kept
// (with one click to remove the kept ones); Replace team = only the team (the Lead stays). Either way ↩ puts back what was there.
const tmBtn = (fn, label) => ` <button type="button" class="tm-undo" onclick="${fn}">${esc(t(label))}</button>`;
async function teamApply(mode) {
  const id = $('tm-team').value; if (!id) return;
  const before = tmOn(), team = ((state.profiles.teams || []).find(x => x.id === id) || {}).roles || [];
  try {
    const r = await api('POST', '/api/projects/' + slug() + '/apply-team', { team: id, mode });
    const added = r.added.map(roleName).join(', ') || t('look.team.nothing'), gone = r.replaced.map(roleName).join(', ');
    TM.before = before;
    if (mode === 'replace') return await teamPaint(esc(t(r.replaced.length ? 'tm.team.removed' : 'look.team.done.none', { added, removed: gone })) + (r.replaced.length ? tmBtn('teamUndo()', 'tm.restore') : ''));
    TM.kept = before.filter(x => x !== LEAD_ID && !team.includes(x) && !r.replaced.includes(x));
    await teamPaint(esc(t(r.replaced.length ? 'look.team.done' : 'look.team.done.none', { added, replaced: gone }))
      + (TM.kept.length ? ' ' + esc(t('tm.team.kept', { roles: TM.kept.map(roleName).join(', ') })) + tmBtn('teamDropKept()', 'tm.team.dropkept') : '') + tmBtn('teamUndo()', 'tm.undo'));
  } catch (e) { setErr('tm-err', e); }
}
const teamUndo = () => teamSetRoles(TM.before, esc(t('tm.undone')));
function teamDropKept() {
  const now = tmOn(); TM.before = now;
  teamSetRoles(now.filter(x => !TM.kept.includes(x)), esc(t('tm.removed', { role: TM.kept.map(roleName).join(', ') })) + tmBtn('teamUndo()', 'tm.undo'));
}
// This project's own steps, go and words (p.profiles.owner, AIG-421); null = Setup's again.
async function teamOwnerScale(k, n) {
  try { await api('PUT', '/api/projects/' + slug() + '/profiles/owner', { scales: { [k]: n } }); await teamPaint(esc(t('setup.saved.short'))); }
  catch (e) { setErr('tm-err', e); }
}

/* ---------- ✏️ profile editor: one role's sliders, model, level and How I work, with a brief preview ---------- */
// Save for all projects = your copy (profiles.local), and this project's own numbers for the role are cleared so it shows here
// too; Save for this project only = the numbers only (How I work and the model are for all projects); Reset to template = both go.
const PE = { id: '', p: null, timer: 0 };
const PE_SLIDERS = ['alone', 'tests'], PE_OWNERISH = ['steps', 'words'];
async function profileEditor(id) {
  await loadProfiles();
  try { PE.p = await api('GET', `/api/projects/${slug()}/profiles/${encodeURIComponent(id)}`); } catch (e) { setErr('tm-err', e); return; }
  PE.id = id;
  openDialog(`<div id="pe-box">${peHtml()}</div>`, 'wide team-dlg');
  pePreview();
}
function peHtml() {
  const r = PE.p, tpl = profileRole(PE.id) || {}, sc = r.scales || {}, own = { ...((leadPrefs().scales) || {}), ...((TM.data || {}).owner || {}) };
  const levels = (state.profiles.roles || []).filter(x => x.group === tpl.group).sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  const level = levels.length > 1 ? `<label class="f"><span>${esc(t('pe.level'))}</span><select id="pe-level" onchange="peLevel(this.value)">${levels.map(x => `<option value="${esc(x.id)}" ${x.id === PE.id ? 'selected' : ''}>${esc(t('prof.level.' + x.level))} (${esc(Model(x.model))})</option>`).join('')}</select><small class="muted">${esc(t('pe.level.help'))}</small></label>` : '';
  const model = `<label class="f"><span>${esc(t('pe.model'))}</span><select id="pe-model" onchange="pePreview()">${['haiku', 'sonnet', 'opus'].map(m => `<option value="${m}" ${r.model === m ? 'selected' : ''}>${Model(m)}</option>`).join('')}</select></label>`;
  const pick = k => `<label class="f"><span>${esc(t('scale.' + k))}</span><select id="pe-${k}" onchange="pePreview()"><option value="">${esc(t('pe.likeyou', { line: scaleLine(k, own[k] || 1) }))}</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${sc[k] === n ? 'selected' : ''}>${n} · ${esc(scaleLine(k, n))}</option>`).join('')}</select></label>`;
  return `<h2>${roleIcon(PE.id)} ${esc(roleName(PE.id))}</h2><p class="muted">${esc(t('pe.sub', { name: state.project.name }))}</p>
    <div class="row pe-row">${level}${model}</div>
    ${PE_SLIDERS.map(k => scaleSlider(k, 5, sc[k] || 3, 'peScale', 'pe', '')).join('')}
    ${PE_OWNERISH.map(pick).join('')}
    <label class="f"><span>${esc(t('pe.how'))}</span><textarea id="pe-how" rows="5" oninput="pePreviewSoon()">${esc((r.how || []).join('\n'))}</textarea><small class="muted">${esc(t('pe.how.help'))}</small></label>
    <div class="pe-preview"><b>${esc(t('pe.preview'))}</b> <span class="muted" id="pe-tokens"></span><pre id="pe-lines"></pre></div>
    <small class="muted">${esc(t('pe.where'))}</small><div class="err" id="pe-err"></div>
    <div class="actions pe-acts"><button class="primary" type="button" id="pe-all" onclick="peSave('all')">${esc(t('pe.save.all'))}</button><button type="button" id="pe-here" onclick="peSave('here')">${esc(t('pe.save.here'))}</button>
      <button type="button" id="pe-reset" onclick="peReset()" ${r.mine || Object.keys(r.project || {}).length ? '' : 'disabled'}>${esc(t('pe.reset'))}</button><button type="button" onclick="teamDialog()">${esc(t('pe.back'))}</button></div>`;
}
const peScale = () => pePreview();
function peDraft() {
  const scales = {};
  for (const k of PE_SLIDERS) scales[k] = Number($('pe-' + k).value);
  for (const k of PE_OWNERISH) scales[k] = $('pe-' + k).value ? Number($('pe-' + k).value) : null;
  return { scales, how: $('pe-how').value.split('\n').map(x => x.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean).slice(0, 6), model: $('pe-model').value };
}
const pePreviewSoon = () => { clearTimeout(PE.timer); PE.timer = setTimeout(pePreview, 300); };
async function pePreview() {
  try {
    const r = await api('POST', `/api/projects/${slug()}/profiles/${encodeURIComponent(PE.id)}/preview`, peDraft()), text = r.lines.join('\n');
    if (!$('pe-lines')) return;
    $('pe-lines').textContent = text; $('pe-tokens').textContent = t('pe.tokens', { n: Math.ceil(text.length / 4), lines: r.lines.length });
  } catch (e) { setErr('pe-err', e); }
}
// A slider at the usual step 3 on a scale the role doesn't set is left unset, so saving changes nothing it didn't mean to.
function peScales(base) {
  const d = peDraft().scales, o = {};
  for (const [k, v] of Object.entries(d)) o[k] = v === null || (PE_SLIDERS.includes(k) && base[k] === undefined && v === 3) || v === base[k] ? null : v;
  return o;
}
async function peSave(where) {
  const d = peDraft(), here = Object.keys(PE.p.project || {});
  try {
    if (where === 'all') {
      // Only what differs from the template is kept in your copy (lib/profiles.js saveOwn).
      await api('PUT', '/api/profiles/roles/' + encodeURIComponent(PE.id), { scales: peScales((profileRole(PE.id) || {}).scales || {}), how: d.how, model: d.model });
      if (here.length) await api('PUT', `/api/projects/${slug()}/profiles/${encodeURIComponent(PE.id)}`, { scales: Object.fromEntries(here.map(k => [k, null])) });
    } else await api('PUT', `/api/projects/${slug()}/profiles/${encodeURIComponent(PE.id)}`, { scales: peScales(PE.p.shared.scales || {}) });
    teamDialog(esc(t(where === 'all' ? 'pe.saved.all' : 'pe.saved.here', { role: roleName(PE.id) })));
  } catch (e) { setErr('pe-err', e); }
}
async function peReset() {
  const here = Object.keys(PE.p.project || {});
  try {
    await api('DELETE', '/api/profiles/roles/' + encodeURIComponent(PE.id));
    if (here.length) await api('PUT', `/api/projects/${slug()}/profiles/${encodeURIComponent(PE.id)}`, { scales: Object.fromEntries(here.map(k => [k, null])) });
    teamDialog(esc(t('pe.reset.done', { role: roleName(PE.id) })));
  } catch (e) { setErr('pe-err', e); }
}
// Another level is another role template: it takes this one's place on the project at once.
async function peLevel(id) {
  try {
    await api('PATCH', '/api/projects/' + slug(), { roles: [...(TM.data ? tmOn() : []).filter(x => x !== PE.id), id] });
    if (TM.data) TM.data = await api('GET', '/api/projects/' + slug() + '/profiles');
    await profileEditor(id);
  } catch (e) { setErr('pe-err', e); }
}

/* ---------- 👥 your main team (AIG-460): in ⚙️ Setup, and the wizard's starter team ---------- */
// New projects start with it (setup prefs newRoles; '' = today's 8). Start from a team or tick roles: every role is optional
// but the Lead, which runs the team. The 🧭 Lead Scrum Master (setup prefs smRole, AIG-476) is a tick of its own.
// Like p.roles, today's 8 are kept by their old names and any other role by its id. save = a function called with the choice.
const oldOrId = id => { const r = profileRole(id); return r && TEAM_ROLES.includes(r.label) ? r.label : id; };
const idOfRole = r => (((state.profiles || {}).roles || []).find(x => x.label === r) || {}).id || r;
function mainTeamHtml(box, roles, sm, save = '') {
  const on = Array.isArray(roles) ? roles : TEAM_ROLES, extra = on.filter(r => !TEAM_ROLES.includes(r) && profileRole(r));
  const tick = (r, label, checked, lock) => `<label class="chk"><input type="checkbox" data-role="${esc(r)}" ${checked ? 'checked' : ''} ${lock ? 'disabled' : ''} onchange="mainTeamChanged('${box}')"> ${roleIcon(idOfRole(r))} ${esc(label)}</label>`;
  const rest = ((state.profiles || {}).roles || []).filter(r => !TEAM_ROLES.includes(r.label) && !extra.includes(r.id)).sort((a, b) => roleName(a.id).localeCompare(roleName(b.id)));
  return `<div id="${box}" class="main-team" data-save="${esc(save)}">
    <div class="tm-add"><select id="${box}-team" onchange="mainTeamPick('${box}', this.value)" aria-label="${esc(t('mt.pick'))}"><option value="">${esc(t('mt.pick'))}</option>${((state.profiles || {}).teams || []).map(tm => `<option value="${esc(tm.id)}">${esc(t('prof.team.' + tm.id))}</option>`).join('')}</select></div>
    <div class="mt-ticks">${TEAM_ROLES.map((r, i) => tick(r, r, !i || on.includes(r), !i)).join('')}${extra.map(id => tick(id, roleName(id), true)).join('')}</div>
    <div class="tm-add"><select id="${box}-add" onchange="mainTeamAdd('${box}', this.value)" aria-label="${esc(t('tm.addrole'))}"><option value="">${esc(t('tm.addrole'))}</option>${rest.map(r => `<option value="${esc(r.id)}">${esc(roleName(r.id))}</option>`).join('')}</select></div>
    <label class="chk mt-sm"><input type="checkbox" id="${box}-sm" ${sm ? 'checked' : ''} onchange="mainTeamChanged('${box}')"> ${esc(t('lead.smRole'))}</label><small class="muted">${esc(t('lead.smRole.help'))}</small></div>`;
}
// What the box says: { newRoles: [...] or '' (exactly today's 8), smRole }.
function mainTeamRead(box) {
  const on = [...document.querySelectorAll(`#${box} input[data-role]`)].filter(i => i.checked || i.disabled).map(i => i.dataset.role);
  return { newRoles: on.length === TEAM_ROLES.length && on.every(r => TEAM_ROLES.includes(r)) ? '' : on, smRole: $(box + '-sm').checked };
}
function mainTeamChanged(box) { const f = $(box).dataset.save; if (f) window[f](mainTeamRead(box)); }
function mainTeamPaint(box, roles) { const sm = $(box + '-sm').checked, save = $(box).dataset.save; $(box).outerHTML = mainTeamHtml(box, roles, sm, save); mainTeamChanged(box); }
// A team to start from: its roles ticked (and the Lead), the rest unticked.
function mainTeamPick(box, id) {
  const tm = ((state.profiles || {}).teams || []).find(x => x.id === id); if (!tm) return;
  mainTeamPaint(box, [TEAM_ROLES[0], ...tm.roles.map(oldOrId)]);
}
// One more role; the same role at another level is swapped out, as on a project.
function mainTeamAdd(box, id) {
  if (!id) return;
  const g = (profileRole(id) || {}).group, cur = mainTeamRead(box).newRoles || TEAM_ROLES;
  mainTeamPaint(box, [...cur.filter(r => r === TEAM_ROLES[0] || (profileRole(idOfRole(r)) || {}).group !== g), oldOrId(id)]);
}
// In ⚙️ Setup: saved at once. The templates load once; the box is painted again when they are in.
function mainTeamBoxHtml(msg = '') {
  if (!state.profiles) loadProfiles().then(() => paintMainTeam());
  const pr = leadPrefs();
  return `<span>${esc(t('mt.h'))}</span><small class="muted">${esc(t('mt.sub'))}</small>${mainTeamHtml('mainTeam', pr.newRoles, pr.smRole, 'mainTeamSave')}<div class="err" id="mt-err"></div><div class="muted" id="mt-done">${esc(msg)}</div>`;
}
const paintMainTeam = msg => { if ($('mainTeamBox')) $('mainTeamBox').innerHTML = mainTeamBoxHtml(msg); };
async function mainTeamSave(v) {
  try { state.setup = await api('POST', '/api/setup', { prefs: v }); $('mt-done').textContent = t('setup.saved.short'); setErr('mt-err', ''); }
  catch (e) { setErr('mt-err', e); }
}
