/* ---------- 📦 share a project offline (AIG-446): save it as one .aigile file, open one on another computer ---------- */
async function saveProjectFile() {
  try {
    const file = await api('GET', '/api/projects/' + slug() + '/export');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/octet-stream' }));
    a.download = (file.project.name.replace(/[^\w.\- ]+/g, '_').trim() || 'project') + '.aigile';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { alert(err.message); }
}

let openedFile = null;   // the parsed file between the preview and the click on Open
function openFileDialog() {
  openedFile = null;
  openDialog(`<h2>${esc(t('ofl.title'))}</h2>
    <p class="muted">${esc(t('ofl.help'))}</p>
    <label class="f"><span>${esc(t('ofl.pick'))}</span><input type="file" id="ofl-file" accept=".aigile,application/json" onchange="previewProjectFile(this.files[0])"></label>
    <div id="ofl-preview"></div><div class="err" id="d-err"></div>
    <div class="actions"><button class="primary" id="ofl-go" disabled onclick="importProjectFile()">${esc(t('ofl.open'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div>`);
}
async function previewProjectFile(f) {
  const box = $('ofl-preview'), err = $('d-err'), go = $('ofl-go');
  openedFile = null; go.disabled = true; box.innerHTML = ''; err.textContent = '';
  if (!f) return;
  try {
    if (f.size > 30e6) throw new Error(t('ofl.toobig'));
    try { openedFile = JSON.parse(await f.text()); } catch { throw new Error(t('ofl.notfile')); }
    const v = await api('POST', '/api/projects/import', { file: openedFile, preview: true });
    box.innerHTML = `<div class="box"><h3>${esc(v.name)}</h3><p>${esc(t('ofl.counts', { cards: v.cards, comments: v.comments, files: v.files }))}</p>
      ${v.renamed ? `<p class="muted">${esc(t('ofl.renamed', { slug: v.slug }))}</p>` : ''}<p class="muted">${esc(t('ofl.nofolder'))}</p></div>`;
    go.disabled = false;
  } catch (e) { openedFile = null; err.textContent = e.message; }
}
async function importProjectFile() {
  if (!openedFile) return;
  $('ofl-go').disabled = true;
  try {
    const p = await api('POST', '/api/projects/import', { file: openedFile });
    openedFile = null; closeDialog(); location.hash = '#/p/' + p.slug;
  } catch (e) { $('d-err').textContent = e.message; $('ofl-go').disabled = false; }
}
