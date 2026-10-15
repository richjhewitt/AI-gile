// 🧩 Inline editing of a problem card (AIG-1152): root cause and workaround save on blur, incidents are ticked. Uses PATCH /problems/:id.
const probEdit = (p, c) => {
  if (c.type !== 'problem') return '';
  const inc = (p.cards || []).filter(x => x.type === 'incident'), on = new Set(c.incidents || []);
  const field = (k, v) => `<label class="pe-f"><b>${esc(t('probe.' + k))}</b><textarea rows="2" maxlength="1000" data-pe="${k}" onblur="probSave('${esc(c.id)}', this)">${esc(v || '')}</textarea></label>`;
  return `<details class="problem probedit"><summary>${esc(t('probe.edit'))}</summary>${field('cause', c.rootCause)}${field('workaround', c.workaround)}
  <div class="pe-inc"><b>${esc(t('probe.incidents'))}</b>${inc.length ? inc.map(i => `<label class="pe-i"><input type="checkbox" value="${esc(i.id)}" ${on.has(i.id) ? 'checked disabled' : ''} onchange="probLink('${esc(c.id)}', this)"> ${esc(i.id)} ${esc(i.title)}${i.status === 'done' ? ' ✓' : ''}</label>`).join('') : `<span class="muted"> ${esc(t('probe.noinc'))}</span>`}</div>
  <button type="button" class="pe-save" onclick="probSave('${esc(c.id)}', this)">${esc(t('probe.save'))}</button> <span class="pe-msg muted" aria-live="polite"></span></details>`;
};
async function probSave(id, el) {
  const box = el.closest('.probedit'), body = {};
  box.querySelectorAll('textarea[data-pe]').forEach(a => { body[a.dataset.pe === 'cause' ? 'rootCause' : 'workaround'] = a.value; });
  try { await api('PATCH', `/api/projects/${slug()}/problems/${id}`, body); box.querySelector('.pe-msg').textContent = t('probe.saved'); }
  catch (e) { box.querySelector('.pe-msg').textContent = e.message; }
}
async function probLink(id, el) {
  const box = el.closest('.probedit');
  try { await api('POST', `/api/projects/${slug()}/problems/${id}/link`, { incident: el.value }); box.querySelector('.pe-msg').textContent = t('probe.saved'); }
  catch (e) { box.querySelector('.pe-msg').textContent = e.message; el.checked = !el.checked; }
}
