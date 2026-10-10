/* ---------- dialog shell ---------- */
function openDialog(html, cls = '') {
  $('dialog').innerHTML = `<div class="overlay center"><div class="dialog ${cls}">${html}</div></div>`;
  const f = $('dialog').querySelector('input[type=text]'); if (f) f.focus();
}
function closeDialog() { $('dialog').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('dialog').firstChild) closeDialog(); });

/* ---------- new card ---------- */
function newCard(preset = {}) {
  const bug = preset.type === 'bug';
  // Rich's new cards go straight to the team (AIG-51); the + on a column still picks that column.
  const c = { title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'team', assignee: '', sprint: '', ...preset };
  openDialog(`<h2>${bug ? '🐞 Raise bug' : 'New card'}</h2>
    <form onsubmit="return createCard(event)">${cardFields(c, bug ? { titlePh: "What's broken?", descLabel: 'What happened / how to reproduce', descPh: 'Steps, what you expected, what you saw' } : { titlePh: 'What needs doing?' })}
      <div class="err" id="d-err"></div>
      <div class="actions"><button class="${bug ? 'bug' : 'primary'}" type="submit">${bug ? 'Raise bug' : 'Create card'}</button><button type="button" onclick="closeDialog()">Cancel</button></div></form>`);
}
async function createCard(e) {
  e.preventDefault();
  const body = readFields(false, false);
  if (!body.title) { setErr('d-err', 'Give it a title'); return false; }
  try {
    const c = await api('POST', `/api/projects/${slug()}/cards`, { ...body, createdBy: 'Rich' });
    closeDialog();
    await rerender();
  } catch (err) { setErr('d-err', err); }
  return false;
}

/* ---------- new project, archive ---------- */
function newProject() {
  openDialog(`<h2>New project</h2>
    <form onsubmit="return createProject(event)">
      <label class="f"><span>Name</span><input type="text" id="p-name" oninput="suggestKey()" maxlength="80"></label>
      <div class="row"><label class="f"><span>Key (card prefix, e.g. AIG)</span><input type="text" id="p-key" maxlength="6" oninput="this.dataset.touched=1"></label></div>
      <label class="f"><span>Folder path (optional)</span><input type="text" id="p-path" placeholder="C:\\Users\\rich\\Desktop\\..."></label>
      <label class="f"><span>Description (optional)</span><textarea id="p-desc" rows="3"></textarea></label>
      <div class="err" id="d-err"></div>
      <div class="actions"><button class="primary" type="submit">Create project</button><button type="button" onclick="closeDialog()">Cancel</button></div></form>`);
}
function suggestKey() {
  const k = $('p-key'); if (k.dataset.touched) return;
  k.value = $('p-name').value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}
async function createProject(e) {
  e.preventDefault();
  const name = $('p-name').value.trim();
  if (!name) { setErr('d-err', 'Give the project a name'); return false; }
  try {
    const p = await api('POST', '/api/projects', { name, key: $('p-key').value.trim(), path: $('p-path').value.trim(), description: $('p-desc').value.trim() });
    closeDialog();
    location.hash = '#/p/' + p.slug;
  } catch (err) { setErr('d-err', err); }
  return false;
}
async function setArchived(on) {
  if (on && !confirm('Archive this project? It will be hidden from the home page (you can show archived projects there and unarchive).')) return;
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
  openDialog(`<h2>🔌 ${p.path ? 'Folder connected' : 'Connect a folder'}</h2>
    <p class="muted">The team working in this folder will then use this board and your ways of working. It adds two local files there (notes and hooks) that git won't see. Safe to run again.</p>
    <label class="f"><span>Folder</span><input type="text" id="c-path" value="${esc(suggest)}"></label>
    <label class="chk"><input type="checkbox" id="c-create" checked> Create the folder if it doesn't exist</label>
    <div class="err" id="c-err"></div><div id="c-done"></div>
    <div class="actions"><button class="primary" id="c-go" onclick="doConnect()">${p.path ? 'Reconnect' : 'Connect'}</button><button type="button" onclick="closeDialog()">Close</button></div>`);
}
async function doConnect() {
  try {
    const r = await api('POST', `/api/projects/${slug()}/connect`, { path: $('c-path').value, create: $('c-create').checked });
    $('c-err').textContent = '';
    $('c-done').innerHTML = `<ul>${r.done.map(d => `<li>✅ ${esc(d)}</li>`).join('')}</ul><p><b>Next:</b> start a new session in that folder. It will read the board and your ways of working by itself.</p>`;
    $('c-go').remove();
  } catch (e) { setErr('c-err', e); }
}

/* ---------- docs: read a project's .md files ---------- */
// The project's .md files, fetched once per project, so file names in cards can open them.
async function loadDocs(s) {
  if (state.docsFor === s) return;
  state.docsFor = s;
  try { state.docs = await api('GET', `/api/projects/${s}/docs`); } catch { state.docs = []; }
}
// ---- docs: read a project's .md files in the board -----------------------------
async function openDocs() {
  try {
    state.docs = await api('GET', `/api/projects/${slug()}/docs`);
    openDialog(`<h2>📄 Docs</h2>${state.docs.length ? `<div class="doclist">${state.docs.map((n, i) => `<button onclick="showDoc(${i})">${esc(n)}</button>`).join('')}</div>`
      : `<p class="muted">No .md files found${state.project.path ? ' in ' + esc(state.project.path) : ': this project has no folder path set'}.</p>`}
      <div class="actions"><button onclick="closeDialog()">Close</button></div>`);
  } catch (e) { alert(e.message); }
}
async function showDoc(i) {
  try {
    const d = await api('GET', `/api/projects/${slug()}/docs/${encodeURIComponent(state.docs[i])}`);
    openDialog(`<div class="actions" style="margin-top:0"><button onclick="openDocs()">← Docs</button><button onclick="closeDialog()">Close</button></div>
      <div class="md">${md(d.text)}</div>`, 'wide');
  } catch (e) { alert(e.message); }
}
