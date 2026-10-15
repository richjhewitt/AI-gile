/* ---------- 📖 Runbooks (AIG-1107) ----------
   runbooksHtml(p, c): on an incident or problem card, a box that fills itself (GET .../cards/:id/runbooks) with the linked runbook and
   the ones whose name matches the title, each with an Open button (the docs viewer), and a pick to link one. */
function runbooksHtml(p, c) {
  if (c.type !== 'incident' && c.type !== 'problem') return '';
  queueMicrotask(() => runbooksFill(p.slug, c.id));
  return `<div class="runbooks" id="runbooks-${esc(c.id)}" hidden></div>`;
}
async function runbooksFill(slug, id) {
  const box = document.getElementById('runbooks-' + id); if (!box) return;
  let d; try { d = await api('GET', `/api/projects/${slug}/cards/${id}/runbooks`); } catch { return; }
  const el = document.getElementById('runbooks-' + id); if (!el) return;
  if (!d.names.length) { el.hidden = true; return; }
  const q = s => esc(s).replace(/'/g, '&#39;');
  el.hidden = false;
  el.innerHTML = `<h3>${esc(t('rb.heading'))}</h3>
    ${d.matches.length ? d.matches.map(m => `<p>${esc(m.name)}${m.linked ? ` <span class="muted">${esc(t('rb.linked'))}</span>` : ''} <button type="button" data-rb="${esc(m.name)}" onclick="runbookOpen('${q(slug)}', this.dataset.rb)">${esc(t('rb.open'))}</button></p>`).join('') : `<p class="muted">${esc(t('rb.nomatch'))}</p>`}
    <p><label>${esc(t('rb.link'))} <select onchange="runbookLink('${q(slug)}', '${q(id)}', this.value)"><option value="">${esc(t('rb.nolink'))}</option>${d.names.map(n => `<option value="${esc(n)}" ${n === d.linked ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></p>`;
}
const runbookOpen = (slug, name) => showDocPath('docs/runbooks/' + name + '.md', slug);
async function runbookLink(slug, id, name) {
  try { await api('POST', `/api/projects/${slug}/cards/${id}/runbook`, { runbook: name }); runbooksFill(slug, id); } catch (e) { alert(e.message); }
}
