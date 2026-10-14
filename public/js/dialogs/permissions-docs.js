/* ---------- team permissions ---------- */
// ---- permissions: ticks for the common rule sets, plus the full lists as text (one rule per line) (AIG-74) ----
const PERM_LISTS = [['allow', 'perm.allow'], ['ask', 'perm.ask'], ['deny', 'perm.deny']];
async function permsDialog() {
  let r;
  try { r = await api('GET', `/api/projects/${slug()}/permissions`); } catch (e) { alert(e.message); return; }
  state.permPresets = r.presets;
  popNext('perms'); openDialog(`<h2>${esc(t('board.perms'))}</h2>
    <p class="muted">${t('perm.intro.html', { file: esc(r.file) })}</p>
    <div id="perm-ticks">${Object.entries(r.presets).map(([k, v]) => `<label class="chk"><input type="checkbox" data-k="${k}" onchange="permTick(this)"> ${esc(tk('perm.p.' + k, v.label))}</label>`).join('')}</div>
    ${PERM_LISTS.map(([l, label]) => `<label class="f"><span>${esc(t('perm.rule', { label: t(label) }))}</span><textarea id="perm-${l}" rows="4" oninput="permSync()">${esc(r[l].join('\n'))}</textarea></label>`).join('')}
    <div class="err" id="perm-err"></div><div id="perm-done" class="muted"></div>
    <div class="actions"><button class="primary" onclick="savePerms()">${esc(t('common.save'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  permSync();
}
const permLines = l => $('perm-' + l).value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
// A tick is on when every rule it stands for is in its list.
function permSync() {
  for (const box of document.querySelectorAll('#perm-ticks input'))
    box.checked = Object.entries(state.permPresets[box.dataset.k].rules).every(([l, rules]) => rules.every(x => permLines(l).includes(x)));
}
function permTick(box) {
  for (const [l, rules] of Object.entries(state.permPresets[box.dataset.k].rules)) {
    const cur = permLines(l).filter(x => !rules.includes(x));
    $('perm-' + l).value = (box.checked ? [...cur, ...rules] : cur).join('\n');
  }
  permSync();
}
async function savePerms() {
  try {
    await api('PUT', `/api/projects/${slug()}/permissions`, Object.fromEntries(PERM_LISTS.map(([l]) => [l, permLines(l)])));
    $('perm-err').textContent = '';
    $('perm-done').textContent = t('perm.saved');
  } catch (e) { setErr('perm-err', e); }
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
    popNext('docs'); openDialog(`<h2>${esc(t('board.docs'))}</h2>${state.docs.length ? `<div class="doclist">${state.docs.map((n, i) => `<button onclick="showDoc(${i})">${esc(n)}</button>`).join('')}</div>`
      : `<p class="muted">${state.project.path ? esc(t('docs.none.in', { path: state.project.path })) : esc(t('docs.none.nopath'))}</p>`}
      <div class="actions"><button onclick="closeDialog()">${esc(t('common.close'))}</button></div>`);
  } catch (e) { alert(e.message); }
}
// The text of the .md file open in the viewer, for its Copy all button (AIG-390).
let openedDocText = '';
const copyAllBtn = () => `<button onclick="copyDocText(this, openedDocText)">${esc(t('docs.copyall'))}</button>`;
// Open any .md file in the project folder (from a link in card text); title is its relative name.
async function showDocPath(p, s) {
  try {
    const d = await api('GET', `/api/projects/${s || slug()}/file?path=${encodeURIComponent(p)}`);
    openedDocText = d.text;
    openDialog(`<div class="actions" style="margin-top:0"><b class="doctitle">${esc(d.name)}</b>${copyAllBtn()}<button onclick="closeDialog()">${esc(t('common.close'))}</button></div>
      <div class="md">${md(d.text)}</div>`, 'wide');
  } catch (e) { alert(e.message); }
}
async function showDoc(i) {
  try {
    const d = await api('GET', `/api/projects/${slug()}/docs/${encodeURIComponent(state.docs[i])}`);
    openedDocText = d.text;
    openDialog(`<div class="actions" style="margin-top:0"><button onclick="openDocs()">${esc(t('docs.back'))}</button>${copyAllBtn()}<button onclick="closeDialog()">${esc(t('common.close'))}</button></div>
      <div class="md">${md(d.text)}</div>`, 'wide');
  } catch (e) { alert(e.message); }
}
