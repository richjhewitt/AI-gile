/* ---------- Project types and "load another template" in the 👥 Team dialog (AIG-442) ---------- */
// A project picks its type (web app, mobile app, server, data, game, docs, life, custom); the type's default scale tweaks (profiles/project-types.json,
// lib/projecttypes.js) become this project's own numbers for the whole team, with a "what changed" line and an Undo. A role row can also load
// another template's numbers for that one role on this project. Both save through the per-project profile numbers (p.profiles).
const PT = { list: null };
async function ptLoad() { if (!PT.list) try { PT.list = await api('GET', '/api/project-types'); } catch { PT.list = []; } return PT.list; }
function typeHtml() {
  const cur = (state.project || {}).projectType || '', can = !!(state.project || {}).typeUndo;
  return `<div class="tm-type"><label class="f"><span>${esc(t('ptype.h'))}</span><select id="tm-type" onchange="ptPick(this.value)" aria-label="${esc(t('ptype.h'))}"><option value="">${esc(t('ptype.pick'))}</option>${(PT.list || []).map(x => `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(t('ptype.' + x.id))}</option>`).join('')}</select></label>
    <button type="button" id="tm-type-undo" onclick="ptUndo()" ${can ? '' : 'disabled'}>${esc(t('ptype.undo'))}</button> <small class="muted">${esc(t('ptype.help'))}</small></div>`;
}
const ptLine = r => r.changed && r.changed.length
  ? t('ptype.changed', { type: t('ptype.' + r.type), n: r.changed.length, list: r.changed.map(c => `${c.role === 'owner' ? t('ptype.owner') : roleName(c.role)}: ${Object.entries(c.scales).map(([k, v]) => t('scale.' + k) + ' ' + v).join(', ')}`).join('; ') })
  : t('ptype.same', { type: t('ptype.' + r.type) });
async function ptPick(type) {
  if (!type) return;
  try { const r = await api('POST', '/api/projects/' + slug() + '/project-type', { type }); await teamPaint(esc(ptLine(r))); }
  catch (e) { setErr('tm-err', e); }
}
async function ptUndo() {
  try { await api('POST', '/api/projects/' + slug() + '/project-type', { undo: true }); await teamPaint(esc(t('ptype.undone'))); }
  catch (e) { setErr('tm-err', e); }
}
// One role loads another template's numbers (this project only).
function loadTplHtml(id) {
  const all = Object.values((state.profiles || {}).roles || []).filter(r => r.id !== id);
  return `<select class="tm-loadtpl" data-role="${esc(id)}" onchange="tmLoadTpl('${esc(id)}', this.value)" aria-label="${esc(t('tm.loadtpl') + ': ' + roleName(id))}"><option value="">${esc(t('tm.loadtpl'))}</option>${all.map(r => `<option value="${esc(r.id)}">${esc(r.label || r.id)}</option>`).join('')}</select>`;
}
async function tmLoadTpl(id, tpl) {
  if (!tpl) return;
  try { await api('POST', `/api/projects/${slug()}/profiles/${encodeURIComponent(id)}/load-template`, { template: tpl }); await teamPaint(esc(t('tm.loadtpl.done', { role: roleName(id), tpl: roleName(tpl) }))); }
  catch (e) { setErr('tm-err', e); }
}
