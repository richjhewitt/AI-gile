// ✏️ Small code editor (AIG-536): a dialog on a card to open, edit and save a file in this project's folder, e.g. the
// .claude permission files an agent can't change itself. Same page-only token as the terminal; the server keeps a
// backup of the old file on every save and refuses anything outside the project folder or invalid JSON.
const Editor = (() => {
  const E = { slug: '', path: '', mtime: 0, dirty: false };
  let tok = null;
  const token = async fresh => { if (!tok || fresh) tok = (await api('GET', '/api/terminal/token')).token; return tok; };
  const call = async (what, body) => api('POST', '/api/editor/' + what, { ...body, project: E.slug, token: await token() });
  const msg = (s, bad) => { const m = document.getElementById('edMsg'); if (m) { m.textContent = s; m.style.color = bad ? 'var(--bad, #d44)' : ''; } };
  E.btn = (p, c) => `<button onclick="Editor.open('${esc(p.slug)}')" title="${esc(t('editor.title'))}">${esc(t('editor.btn'))}</button>`;
  E.open = async (slug, path) => {
    E.slug = slug; E.path = path || ''; E.mtime = 0; E.dirty = false;
    let quick = [];
    try { quick = (await call('quick', {})); } catch {}
    openDialog(`<h2>${esc(t('editor.btn'))}</h2>
      <div class="ed-bar" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input type="text" id="edPath" style="flex:1;min-width:200px" placeholder="${esc(t('editor.path.ph'))}" value="${esc(E.path)}" onkeydown="if(event.key==='Enter')Editor.load()">
        <button type="button" onclick="Editor.load()">${esc(t('editor.open'))}</button>
      </div>
      <div class="ed-quick" style="margin:6px 0">${quick.map(q => `<button type="button" class="colbtn" onclick="Editor.pick('${esc(q.path)}')">${esc(q.path)}${q.exists ? '' : ' (new)'}</button>`).join(' ')}</div>
      <textarea id="edText" spellcheck="false" style="width:100%;min-height:340px;box-sizing:border-box;font-family:var(--mono,monospace);font-size:13px;white-space:pre;overflow:auto" oninput="Editor.dirty=true" onkeydown="Editor.key(event)"></textarea>
      <div class="muted" id="edMsg" style="min-height:1.4em"></div>
      <div class="actions"><button class="primary" onclick="Editor.save()">${esc(t('editor.save'))}</button><button onclick="Editor.close()">${esc(t('common.close'))}</button></div>`);
    const ov = document.querySelector('#dialog .overlay'); if (ov) ov.style.zIndex = '30';
    if (E.path) E.load();
  };
  E.pick = p => { document.getElementById('edPath').value = p; E.load(); };
  E.close = () => { if (!E.dirty || confirm(t('editor.discard'))) closeDialog(); };
  E.key = e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); E.save(); }
    else if (e.key === 'Tab') { e.preventDefault(); const a = e.target, s = a.selectionStart; a.setRangeText('  ', s, a.selectionEnd, 'end'); E.dirty = true; }
  };
  E.load = async () => {
    const p = document.getElementById('edPath').value.trim(); if (!p) return;
    if (E.dirty && !confirm(t('editor.discard'))) return;
    try {
      const r = await call('read', { path: p });
      E.path = r.path; E.mtime = r.mtime; E.dirty = false;
      document.getElementById('edPath').value = r.path;
      document.getElementById('edText').value = r.content;
      msg(r.exists ? t('editor.opened') : t('editor.newfile'));
    } catch (e) { msg(e.message, true); }
  };
  E.save = async () => {
    if (!E.path) { msg(t('editor.nopath'), true); return; }
    try {
      const r = await call('save', { path: E.path, content: document.getElementById('edText').value, mtime: E.mtime });
      E.mtime = r.mtime; E.dirty = false;
      msg(t(r.backedUp ? 'editor.saved.backup' : 'editor.saved'));
    } catch (e) { msg(e.message, true); }
  };
  return E;
})();
