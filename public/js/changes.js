/* ---------- 🔀 Change cards (AIG-857) ----------
   changeHtml(p, c): the fields of a change card on the open card (card.js calls it), or a "Raise a change" button on an incident or
   a problem. raiseChange(preset): the short form: what, why, risk (from the register), when, how to undo. */
const CHANGE_KINDS = ['change', 'feature', 'fix', 'other'];
const changeWhen = w => w && w.from ? `${new Date(w.from).toLocaleString(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' })} – ${new Date(w.to).toLocaleString(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' })}` : '';
function changeHtml(p, c) {
  if (c.type === 'incident' || c.type === 'problem') return `<div class="chg-raise"><button type="button" onclick="raiseChange({ from: '${esc(c.id)}' })">${esc(t('chg.raisefrom'))}</button></div>`;
  if (c.type !== 'change') return '';
  const x = c.change || {}, none = `<span class="muted">${esc(t('chg.none'))}</span>`;
  const link = id => `<a href="#/p/${esc(p.slug)}/${esc(id)}">${esc(id)}</a>`;
  const probs = (p.cards || []).filter(y => y.type === 'problem' && y.changeId === c.id).map(y => y.id);
  return `<div class="change"><h3>${esc(t('chg.heading'))}</h3>
  <p><b>${esc(t('chg.kind'))}</b> ${esc(t('chg.kind.' + (x.kind || 'change')))}</p>
  <p><b>${esc(t('chg.what'))}</b> ${x.what ? esc(x.what) : none}</p>
  <p><b>${esc(t('chg.why'))}</b> ${x.why ? esc(x.why) : none}</p>
  <p><b>${esc(t('chg.risk'))}</b> ${x.riskId ? `<a href="#/risks/${esc(p.slug)}">${esc(x.riskId)}</a>` : `<span class="muted">${esc(t('chg.norisk'))}</span>`}</p>
  <p><b>${esc(t('chg.when'))}</b> ${x.when ? esc(changeWhen(x.when)) : none}</p>
  <p><b>${esc(t('chg.undo'))}</b> ${x.undo ? esc(x.undo) : none}</p>
  ${x.from ? `<p><b>${esc(t('chg.from'))}</b> ${link(x.from)}</p>` : ''}${probs.length ? `<p><b>${esc(t('chg.problems'))}</b> ${probs.map(link).join(', ')}</p>` : ''}</div>`;
}
async function raiseChange(preset = {}) {
  const src = preset.from && state.project && state.project.cards.find(x => x.id === preset.from);
  if (src && !preset.title) preset = { ...preset, title: src.title.replace(/^[^\p{L}\p{N}]+/u, '') };   // the title of the incident or problem, without its emoji
  let risks = [];
  try { risks = (await api('GET', `/api/projects/${slug()}/risks`)).risks.filter(r => r.status !== 'closed'); } catch {}
  const ta = (k, rows = 2) => `<label class="f"><span>${esc(t('chg.' + k))}</span><textarea id="chg-${k}" rows="${rows}" maxlength="600"></textarea></label>`;
  openDialog(`<h2>${esc(t('chg.raise'))}</h2><form id="chg-form">
    <div class="row"><label class="f"><span>${esc(t('chg.kind'))}</span><select id="chg-kind">${CHANGE_KINDS.map(k => `<option value="${k}">${esc(t('chg.kind.' + k))}</option>`).join('')}</select></label>
      <label class="f"><span>${esc(t('chg.risk'))}</span><select id="chg-risk"><option value="">${esc(t('chg.norisk'))}</option>${risks.map(r => `<option value="${esc(r.id)}">${esc(r.id)} ${esc(r.risk.slice(0, 60))}</option>`).join('')}</select></label></div>
    <label class="f"><span>${esc(t('chg.title'))}</span><input id="chg-title" required maxlength="200" value="${esc(preset.title || '')}"></label>
    ${ta('what')}${ta('why')}
    <div class="row chg-when"><label class="f"><span>${esc(t('chg.when.from'))}</span><input type="datetime-local" id="chg-from"></label>
      <label class="f"><span>${esc(t('chg.when.to'))}</span><input type="datetime-local" id="chg-to"></label></div>
    ${ta('undo')}
    <div class="err" id="d-err"></div>
    <div class="actions"><button class="primary" type="submit">${esc(t('chg.create'))}</button><button type="button" onclick="closeDialog()">${esc(t('common.cancel'))}</button></div></form>`, 'change');
  $('chg-form').onsubmit = async e => {
    e.preventDefault();
    const v = k => $('chg-' + k).value.trim(), at = k => v(k) ? new Date(v(k)).toISOString() : '';
    const body = { title: v('title'), kind: v('kind'), what: v('what'), why: v('why'), undo: v('undo'), riskId: v('risk'), from: preset.from || '' };
    if (v('from') || v('to')) body.when = { from: at('from'), to: at('to') };
    try { const r = await api('POST', `/api/projects/${slug()}/changes`, body); closeDialog(); location.hash = `#/p/${slug()}/${r.id}`; }
    catch (err) { $('d-err').textContent = err.message; }
  };
}
