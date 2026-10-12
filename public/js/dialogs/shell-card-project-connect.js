/* ---------- dialog shell ---------- */
function openDialog(html, cls = '') {
  $('dialog').innerHTML = `<div class="overlay center"><div class="dialog ${cls}">${html}</div></div>`;
  const f = $('dialog').querySelector('input[type=text]'); if (f) f.focus();
}
function closeDialog() {
  $('dialog').innerHTML = '';
  if (state.cvPreview) { state.cvPreview = null; renderBoardOnly(); }   // an unsaved card view preview goes away (AIG-119)
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('dialog').firstChild) closeDialog(); });

/* ---------- new card ---------- */
async function newCard(preset = {}) {
  let projects = [], leads = {};
  try { projects = (await api('GET', '/api/projects')).filter(p => !p.archived); } catch {}
  try { (await api('GET', '/api/chats')).forEach(c => { leads[c.slug] = c.lead; }); } catch {}
  const bug = preset.type === 'bug';
  // The owner's new cards go straight to the team (AIG-51); the + on a column still picks that column.
  const c = { title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'team', assignee: '', sprint: '', ...preset };
  Attach.clear('new:' + slug());
  // 🏡 Real life (AIG-394): the switch shows the life types; a Life board (🎨 Look) starts with it on.
  const lifeOn = !bug && (preset.lifeType || (state.project && state.project.lifeBoard && !preset.type));
  const lifeBox = bug ? '' : `<label class="chk life-switch" title="${esc(t('dlg.life.switch.title'))}"><input type="checkbox" id="nc-life" ${lifeOn ? 'checked' : ''} onchange="lifeToggle()"> ${esc(t('dlg.life.switch'))}</label>
    <div id="nc-life-box" ${lifeOn ? '' : 'hidden'}><div class="row"><label class="f"><span>${esc(t('dlg.life.type'))}</span><select id="nc-lifetype" onchange="lifeToggle()">${Object.keys(LIFE_TYPES).map(k => `<option value="${k}" ${k === (preset.lifeType || 'housework') ? 'selected' : ''}>${LIFE_TYPES[k][0]} ${esc(t('life.' + k))}</option>`).join('')}</select></label></div>
      <div class="row" id="nc-appt" hidden><label class="f"><span>${esc(t('dlg.life.when'))}</span><input type="datetime-local" id="nc-apptat"></label>
        <label class="f"><span>${esc(t('dlg.life.remind'))}</span><select id="nc-remind">${[0, 15, 30, 60, 120, 1440].map(m => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${esc(t('dlg.life.remind.' + m))}</option>`).join('')}</select></label></div>
      <small class="muted" id="nc-appt-hint" hidden>${esc(t('dlg.life.hint'))}</small>
      ${state.project && !state.project.lifeBoard ? `<small class="muted" id="nc-life-suggest">${esc(t('dlg.life.suggest'))} <a href="#" onclick="makeLifeBoard();return false">${esc(t('dlg.life.suggest.btn'))}</a></small>` : ''}</div>`;
  openDialog(`<h2>${esc(bug ? t('board.raisebug') : t('dlg.newcard'))}</h2>
    <form onsubmit="return createCard(event)">${projects.length > 1 ? `<label class="f"><span>${esc(t('dlg.newcard.project'))}</span><select id="nc-project">${projectOptionsHtml(projects, leads, slug())}</select></label>` : ''}${lifeBox}${cardFields(c, bug ? { titlePh: t('dlg.bug.titleph'), descLabel: t('dlg.bug.desclabel'), descPh: t('dlg.bug.descph') } : { titlePh: t('dlg.newcard.titleph') })}
      <div class="err" id="d-err"></div>
      <div class="actions"><button class="${bug ? 'bug' : 'primary'}" type="submit">${esc(bug ? t('dlg.raisebug') : t('dlg.createcard'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('new:' + slug())}</div></form>`, 'newcard');
  if (lifeOn) lifeToggle();
}
function lifeToggle() {
  const on = $('nc-life').checked, appt = on && $('nc-lifetype').value === 'appointment';
  $('nc-life-box').hidden = !on; $('nc-appt').hidden = !appt; $('nc-appt-hint').hidden = !appt;
}
async function makeLifeBoard() {
  try { await api('PATCH', '/api/projects/' + slug(), { lifeBoard: true }); const s = $('nc-life-suggest'); if (s) s.remove(); if (state.project) state.project.lifeBoard = true; } catch (e) { alert(e.message); }
}
async function createCard(e) {
  e.preventDefault();
  const body = readFields(false, false);
  // No title is fine when there is a description: with Tidy cards on the server takes its first line (AIG-399).
  if (!body.title && !body.description.trim()) { setErr('d-err', t('dlg.err.title')); return false; }
  if ($('nc-life') && $('nc-life').checked) {   // 🏡 Real life (AIG-394): the server makes it the owner's own task and sets the appointment's timer
    body.lifeType = $('nc-lifetype').value;
    if (body.lifeType === 'appointment') {
      if (!$('nc-apptat').value) { setErr('d-err', t('dlg.life.err.when')); return false; }
      body.apptAt = new Date($('nc-apptat').value).toISOString(); body.remindMins = Number($('nc-remind').value);
    }
  }
  try {
    const sel = $('nc-project'), target = sel && sel.value || slug();
    const attachments = await Attach.upload('new:' + slug(), target);
    const c = await api('POST', `/api/projects/${target}/cards`, { ...body, createdBy: me(), attachments });
    Attach.clear('new:' + slug());
    if (target !== slug()) {   // another project: say where it went, with a link (AIG-316)
      const name = sel.options[sel.selectedIndex].textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
      $('dialog').querySelector('.dialog').innerHTML = `<h2>${esc(t('dlg.newcard.added', { id: c.id, project: name }))}</h2>
        <p><a id="nc-link" href="#/p/${esc(target)}/${esc(c.id)}" onclick="closeDialog()">${esc(c.id)} ${esc(c.title)}</a></p>
        <div class="actions"><button type="button" class="primary" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`;
      await rerender();
      return false;
    }
    closeDialog();
    await rerender();
  } catch (err) { setErr('d-err', /title is required/.test(err.message) ? t('dlg.err.title') : err); }   // no title, and Tidy cards is off
  return false;
}

/* ---------- new project, archive ---------- */
// The folder is suggested from the name (next to AI-gile) and set up for the team on create (AIG-73).
async function newProject() {
  try { state.home = state.home || (await api('GET', '/api/meta')).home; } catch {}
  openDialog(`<h2>${esc(t('dlg.newproject'))}</h2>
    <form onsubmit="return createProject(event)">
      <label class="f"><span>${esc(t('dlg.np.name'))}</span><input type="text" id="p-name" oninput="suggestKey()" maxlength="80"></label>
      <div class="row"><label class="f"><span>${esc(t('dlg.np.key'))}</span><input type="text" id="p-key" maxlength="6" oninput="this.dataset.touched=1"></label></div>
      <label class="f"><span>${esc(t('dlg.np.folder'))}</span><input type="text" id="p-path" oninput="this.dataset.touched=1" placeholder="${esc(t('dlg.np.folder.ph'))}"></label>
      <label class="f"><span>${esc(t('dlg.np.desc'))}</span><textarea id="p-desc" rows="3"></textarea></label>
      <label class="f"><span>${esc(t('dlg.np.tpl'))}</span><select id="p-tpl" onchange="$('p-own').style.display = this.value === 'own' ? '' : 'none'">
        <option value="kanban">${esc(t('dlg.np.tpl.kanban'))}</option><option value="scrum">${esc(t('dlg.np.tpl.scrum'))}</option><option value="own">${esc(t('dlg.np.tpl.own'))}</option></select></label>
      <label class="f" id="p-own" style="display:none"><span>${esc(t('dlg.np.tpl.own.help'))}</span><input type="text" id="p-own-names" placeholder="${esc(t('dlg.np.tpl.own.ph'))}"></label>
      <div class="err" id="d-err"></div><div id="p-done"></div>
      <div class="actions" id="p-acts"><button class="primary" type="submit">${esc(t('dlg.np.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`);
}
function suggestKey() {
  const name = $('p-name').value, k = $('p-key'), f = $('p-path');
  if (!k.dataset.touched) k.value = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const clean = name.replace(/[<>:"/\\|?*]/g, '').trim();
  if (!f.dataset.touched && state.home) f.value = clean ? state.home + '\\' + clean : '';
}
const STATUS_ORDER = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
// Column names for a template, one per status in order ('' = keep the default name).
function boardTemplateNames(tpl, own) {
  if (tpl === 'scrum') return ['dlg.np.scrum.backlog', 'dlg.np.scrum.sprintbacklog', 'dlg.np.scrum.sprint', 'dlg.np.scrum.review'].map(k => t(k));
  if (tpl === 'own') return own.split(',').map(x => x.trim().slice(0, 40));
  return [];
}
async function createProject(e) {
  e.preventDefault();
  const name = $('p-name').value.trim(), folder = $('p-path').value.trim();
  if (!name) { setErr('d-err', t('dlg.np.err.name')); return false; }
  let p;
  try {
    p = await api('POST', '/api/projects', { name, key: $('p-key').value.trim(), description: $('p-desc').value.trim() });
    // A template only pre-fills the column names (AIG-170); the statuses underneath never change.
    const names = boardTemplateNames($('p-tpl').value, $('p-own-names').value);
    if (names.some(Boolean)) await api('PATCH', '/api/projects/' + p.slug, { columns: STATUS_ORDER.map((status, i) => ({ status, name: names[i] || undefined })) });
  } catch (err) { setErr('d-err', err); return false; }
  if (!folder) { closeDialog(); location.hash = '#/p/' + p.slug; return false; }
  $('p-acts').innerHTML = `<button type="button" class="primary" onclick="closeDialog(); location.hash = '#/p/${p.slug}'">${esc(t('dlg.np.open'))}</button>`;
  try {
    const r = await api('POST', `/api/projects/${p.slug}/connect`, { path: folder, create: true, wake: true });
    $('d-err').textContent = '';
    $('p-done').innerHTML = `<ul>${[t('dlg.np.created'), ...r.done].map(d => `<li>✅ ${esc(d)}</li>`).join('')}</ul>`;
  } catch (err) { setErr('d-err', t('dlg.np.err.folder', { msg: err.message })); }
  return false;
}
async function setArchived(on) {
  if (on && !confirm(t('dlg.archive.confirm'))) return;
  try {
    await api('PATCH', '/api/projects/' + slug(), { archived: on });
    if (on) location.hash = '#/'; else await rerender();
  } catch (err) { alert(err.message); }
}
function toggleArchived(on) {
  state.showArchived = on;
  try { localStorage.setItem('aigile.showArchived', on ? '1' : '0'); } catch {}
  rerender();
}

/* ---------- connect a folder ---------- */
// ---- connect a folder: sets the project's folder up so its team uses the board and the ways of working ----
async function connectDialog() {
  const p = state.project;
  let suggest = p.path;
  if (!suggest) { try { const m = await api('GET', '/api/meta'); suggest = m.home + '\\' + p.name.replace(/[<>:"/\\|?*]/g, '').trim(); } catch { suggest = ''; } }
  openDialog(`<h2>${esc(p.path ? t('dlg.conn.h.done') : t('dlg.conn.h'))}</h2>
    <p class="muted">${esc(t('dlg.conn.intro'))}</p>
    <label class="f"><span>${esc(t('dlg.folder'))}</span><input type="text" id="c-path" value="${esc(suggest)}"></label>
    <label class="chk"><input type="checkbox" id="c-create" checked> ${esc(t('dlg.conn.create'))}</label>
    <div class="err" id="c-err"></div><div id="c-done"></div>
    <div class="actions"><button class="primary" id="c-go" onclick="doConnect()">${esc(p.path ? t('dlg.conn.reconnect') : t('dlg.conn.connect'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
}
async function doConnect() {
  try {
    const r = await api('POST', `/api/projects/${slug()}/connect`, { path: $('c-path').value, create: $('c-create').checked });
    $('c-err').textContent = '';
    $('c-done').innerHTML = `<ul>${r.done.map(d => `<li>✅ ${esc(d)}</li>`).join('')}</ul><p>${t('dlg.conn.next.html')}</p>`;
    $('c-go').remove();
  } catch (e) { setErr('c-err', e); }
}

