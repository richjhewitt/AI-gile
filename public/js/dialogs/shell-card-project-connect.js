/* ---------- dialog shell ---------- */
function openDialog(html, cls = '', pop = '') {   // pop: the kind that gets the shared ⧉ Pop out button (popout.js, AIG-658)
  $('dialog').innerHTML = `<div class="overlay center"><div class="dialog ${cls}">${html}</div></div>`;
  popAddBtn(pop || popTake());
  const f = $('dialog').querySelector('input[type=text]'); if (f) f.focus();
}
function closeDialog() {
  if (sureDone) sureDone(false);   // an open askSure is a No
  $('dialog').innerHTML = '';
  if (state.route.view === 'dlg') { window.close(); return; }   // a dialog in its own window: closing it closes the window
  if (state.cvPreview) { state.cvPreview = null; renderBoardOnly(); }   // an unsaved card view preview goes away (AIG-119)
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('dialog').firstChild) closeDialog(); });
// An in-app "are you sure?" instead of the browser's plain confirm box (AIG-992): resolves true on the OK button, false on Cancel or Escape.
let sureDone = null;
function askSure(title, text, ok) {
  return new Promise(res => {
    openDialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions"><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button><button type="button" class="primary" id="sureOk">${esc(ok)}</button></div>`, 'sure');
    sureDone = v => { sureDone = null; res(v); };
    $('sureOk').onclick = () => { sureDone(true); closeDialog(); };
    $('sureOk').focus();
  });
}

/* ---------- new card ---------- */
// 🐞 On the 🧪 Live channel a raised bug can also go to the AI-gile team (AIG-561): ticked by default, never for other channels.
async function bugSendBox() {
  let ch = null; try { ch = await api('GET', '/api/channel'); } catch {}
  if (!ch || ch.channel !== 'live') return '';
  return `<label class="chk" title="${esc(t('bug.send.title'))}"><input type="checkbox" id="nc-send" checked> ${esc(t('bug.send'))}</label>`;
}
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
  const lifeBox = bug ? await bugSendBox() : `<label class="chk life-switch" title="${esc(t('dlg.life.switch.title'))}"><input type="checkbox" id="nc-life" ${lifeOn ? 'checked' : ''} onchange="lifeToggle()"> ${esc(t('dlg.life.switch'))}</label>
    <div id="nc-life-box" ${lifeOn ? '' : 'hidden'}><div class="row"><label class="f"><span>${esc(t('dlg.life.type'))}</span><select id="nc-lifetype" onchange="lifeToggle()">${Object.keys(LIFE_TYPES).map(k => `<option value="${k}" ${k === (preset.lifeType || 'housework') ? 'selected' : ''}>${LIFE_TYPES[k][0]} ${esc(t('life.' + k))}</option>`).join('')}</select></label></div>
      <div class="row" id="nc-appt" hidden><label class="f"><span>${esc(t('dlg.life.when'))}</span><input type="datetime-local" id="nc-apptat"></label>
        <label class="f"><span>${esc(t('dlg.life.remind'))}</span><select id="nc-remind">${[0, 15, 30, 60, 120, 1440].map(m => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${esc(t('dlg.life.remind.' + m))}</option>`).join('')}</select></label></div>
      <small class="muted" id="nc-appt-hint" hidden>${esc(t('dlg.life.hint'))}</small>
      ${state.project && !state.project.lifeBoard ? `<small class="muted" id="nc-life-suggest">${esc(t('dlg.life.suggest'))} <a href="#" onclick="makeLifeBoard();return false">${esc(t('dlg.life.suggest.btn'))}</a></small>` : ''}</div>`;
  // AIG-942: a quick idea needs a title and a description; everything else is under More options (open when something was pre-filled).
  const moreOpen = !!(preset.type && preset.type !== 'feature' || preset.priority && preset.priority !== 'normal' || preset.risk && preset.risk !== 'normal' || preset.status && preset.status !== 'team' || preset.assignee || preset.sprint || preset.group || lifeOn || document.documentElement.classList.contains('qa-menu'));   // qa-menu: QA lays everything open
  const pickProject = projects.length > 1 || !slug() ? `<label class="f"><span>${esc(t('dlg.newcard.project'))}</span><select id="nc-project">${projectOptionsHtml(projects, leads, slug())}</select></label>` : '';
  popNext(bug ? 'bug' : 'card'); openDialog(`<h2>${esc(bug ? t('board.raisebug') : t('dlg.newcard'))}</h2>
    <form onsubmit="return createCard(event)">${cardFields(c, { more: true, moreOpen, moreTop: pickProject + lifeBox, ...(bug ? { titlePh: t('dlg.bug.titleph'), descLabel: t('dlg.bug.desclabel'), descPh: t('dlg.bug.descph') } : { titlePh: t('dlg.newcard.titleph') }) })}
      <div class="err" id="d-err"></div>
      <div class="actions"><button class="${bug ? 'bug' : 'primary'}" type="submit">${esc(bug ? t('dlg.raisebug') : t('dlg.createcard'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${Attach.boxHtml('new:' + slug())}</div></form>`, 'newcard');
  if (bug) { const ov = $('dialog').querySelector('.overlay'); if (ov) ov.classList.add('top'); }   // above pop-outs, card view and other windows (AIG-733)
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
  if (createCard.busy) return false;   // AIG-1061: one submit per raise (Enter, click, slow upload)
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
  createCard.busy = true; const sub = e.target && e.target.querySelector && e.target.querySelector('button[type=submit]'); if (sub) sub.disabled = true;
  try {
    const sel = $('nc-project'), target = sel && sel.value || slug();
    const attachments = await Attach.upload('new:' + slug(), target);
    const c = await api('POST', `/api/projects/${target}/cards`, { ...body, createdBy: me(), attachments });
    if ($('nc-send') && $('nc-send').checked) api('POST', '/api/bugreport', { title: body.title, text: body.description }).catch(e => alert(t('bug.send.err', { msg: e.message })));   // 🐞 to the AI-gile team (AIG-561)
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
  } catch (err) { setErr('d-err', /title is required/.test(err.message) ? t('dlg.err.title') : err); if (sub) sub.disabled = false; }   // no title, and Tidy cards is off
  finally { createCard.busy = false; }
  return false;
}

/* ---------- new project, archive ---------- */
// The folder is suggested from the name (next to AI-gile) and set up for the team on create (AIG-73).
// 🪐 Space templates (AIG-440): a ready list of child projects for the New project box; the names are only a start, edit freely.
const SPACE_TPLS = ['product', 'software', 'event', 'life', 'business'];
function spaceTpl(v) { if (v) $('p-kids').value = t('space.tpl.' + v + '.kids').split('|').join('\n'); }
async function newProject(opts = {}) {
  try { state.home = state.home || (await api('GET', '/api/meta')).home; } catch {}
  openDialog(`<h2>${esc(t(opts.space ? 'dlg.newspace' : 'dlg.newproject'))}</h2>
    <form onsubmit="return createProject(event)">
      <label class="f"><span>${esc(t('dlg.np.name'))}</span><input type="text" id="p-name" oninput="suggestKey()" maxlength="80"></label>
      <div class="row"><label class="f"><span>${esc(t('dlg.np.key'))}</span><input type="text" id="p-key" maxlength="6" oninput="this.dataset.touched=1"></label></div>
      <label class="f"><span>${esc(t('dlg.np.folder'))}</span><input type="text" id="p-path" oninput="this.dataset.touched=1" placeholder="${esc(t('dlg.np.folder.ph'))}"></label>
      <label class="f"><span>${esc(t('dlg.np.desc'))}</span><textarea id="p-desc" rows="3"></textarea></label>
      <label class="f"><span>${esc(t('space.tpl'))}</span><select id="p-spacetpl" onchange="spaceTpl(this.value)"><option value="">${esc(t('space.tpl.none'))}</option>${SPACE_TPLS.map(v => `<option value="${v}">${esc(t('space.tpl.' + v))}</option>`).join('')}</select></label>
      <label class="f"><span>${esc(t('dlg.np.kids'))}</span><textarea id="p-kids" rows="3" placeholder="${esc(t('dlg.np.kids.ph'))}"></textarea><small class="muted">${esc(t('dlg.np.kids.help'))}</small></label>
      <label class="f"><span>${esc(t('dlg.np.tpl'))}</span><select id="p-tpl" onchange="$('p-own').style.display = this.value === 'own' ? '' : 'none'">
        <option value="kanban">${esc(t('dlg.np.tpl.kanban'))}</option><option value="scrum">${esc(t('dlg.np.tpl.scrum'))}</option><option value="own">${esc(t('dlg.np.tpl.own'))}</option></select></label>
      <label class="f" id="p-own" style="display:none"><span>${esc(t('dlg.np.tpl.own.help'))}</span><input type="text" id="p-own-names" placeholder="${esc(t('dlg.np.tpl.own.ph'))}"></label>
      <div class="err" id="d-err"></div><div id="p-done"></div>
      <div class="actions" id="p-acts"><button class="primary" type="submit">${esc(t('dlg.np.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button>${opts.space ? '' : ` <button type="button" id="p-play" onclick="newPlayground()">${esc(t('dlg.np.play'))}</button>`}</div></form>`);
  if (opts.space) { $('p-spacetpl').value = SPACE_TPLS[0]; spaceTpl(SPACE_TPLS[0]); }
}
// New playground (AIG-818/819): one box with a friend's name; makes the project for them and shows the invite code to Copy.
function newPlayground() {
  openDialog(`<h2>${esc(t('play.h'))}</h2>
    <form onsubmit="return createPlayground(event)">
      <label class="f"><span>${esc(t('play.name'))}</span><input type="text" id="pg-name" maxlength="60" autofocus></label>
      <p class="muted">${esc(t('play.help'))}</p>
      <div class="err" id="d-err"></div><div id="pg-done"></div>
      <div class="actions" id="pg-acts"><button class="primary" type="submit" id="pg-go">${esc(t('play.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`);
  setTimeout(() => { const i = $('pg-name'); if (i) i.focus(); }, 0);
}
async function createPlayground(e) {
  e.preventDefault();
  const name = $('pg-name').value.trim();
  if (!name) { setErr('d-err', t('play.err.name')); return false; }
  try {
    const r = await api('POST', '/api/playgrounds', { name });
    $('d-err').textContent = '';
    $('pg-name').readOnly = true;
    $('pg-done').innerHTML = `<p>✅ ${esc(t('play.made', { name: r.name }))}</p>${r.code ? `<textarea id="pg-code" readonly rows="3" onclick="this.select()" style="width:100%">${esc(r.code)}</textarea><small class="muted">${esc(t('play.send', { name }))}</small>` : `<p class="muted">${esc(t('play.' + r.friend, { name }))}</p>`}<div id="pg-msg" class="muted"></div>`;
    $('pg-acts').innerHTML = `${r.code ? `<button type="button" class="primary" id="pg-copy">${esc(t('dmf.copy'))}</button> ` : ''}<button type="button" onclick="closeDialog(); location.hash = '#/p/${r.slug}'">${esc(t('dlg.np.open'))}</button> <button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button>`;
    if (r.code) $('pg-copy').onclick = async () => { try { await navigator.clipboard.writeText(r.code); } catch { $('pg-code').select(); document.execCommand('copy'); } $('pg-msg').textContent = t('dmf.copied'); };
  } catch (err) { setErr('d-err', err); }
  return false;
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
  const kids = [...new Set($('p-kids').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))].slice(0, 20);
  if (!folder && !kids.length) { closeDialog(); location.hash = '#/p/' + p.slug; return false; }
  $('p-acts').innerHTML = `<button type="button" class="primary" onclick="closeDialog(); location.hash = '#/p/${p.slug}'">${esc(t('dlg.np.open'))}</button>`;
  const done = [t('dlg.np.created')], fails = [];
  const show = () => { $('p-done').innerHTML = `<ul>${done.map(d => `<li>✅ ${esc(d)}</li>`).join('')}${fails.map(d => `<li>⚠️ ${esc(d)}</li>`).join('')}</ul>`; };
  if (folder) {
    try { const r = await api('POST', `/api/projects/${p.slug}/connect`, { path: folder, create: true, wake: true }); done.push(...r.done); }
    catch (err) { fails.push(t('dlg.np.err.folder', { msg: err.message })); }
    show();
  }
  // 🪐 A space with child projects in one go (AIG-435): each child sits in the new project, gets its own folder inside the
  // space's folder (notes and ways of working, like any new project) and the default team roles. Only the space's own team
  // is woken: N first looks at once would burn tokens for nothing.
  for (const name of kids) {
    try {
      const k = await api('POST', '/api/projects', { name, parent: p.slug });
      if (folder) await api('POST', `/api/projects/${k.slug}/connect`, { path: folder + '\\' + name.replace(/[<>:"/\\|?*]/g, '').trim(), create: true });
      done.push(t('dlg.np.kid.done', { name }));
    } catch (err) { fails.push(t('dlg.np.kid.err', { name, msg: err.message })); }
    show();
  }
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

