/* ---------- 🔀 Change cards (AIG-857) ----------
   changeHtml(p, c): the fields of a change card on the open card (card.js calls it), or a "Raise a change" button on an incident or
   a problem. raiseChange(preset): the short form: what, why, risk (from the register), when, how to undo. */
// 📞 Join call link (AIG-861): http(s) only, new tab, noopener; empty when the address is not one. Used by stand-ups, DMs and change cards.
const callLink = (url, cls = '') => /^https?:[/][/]/i.test(url || '') ? `<a class="calllink ${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(t('call.title'))}">${esc(t('call.join'))}</a>` : '';
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
  ${x.from ? `<p><b>${esc(t('chg.from'))}</b> ${link(x.from)}</p>` : ''}${probs.length ? `<p><b>${esc(t('chg.problems'))}</b> ${probs.map(link).join(', ')}</p>` : ''}${goNoGoHtml(p, c)}</div>`;
}
/* ---------- 🚦 Go / no-go panel (AIG-858) ----------
   goNoGoHtml(p, c): the approvers and their votes, Submit for go, Go / No go with a note, Go anyway. gonogoAct(slug, id, what) posts it. */
function goNoGoHtml(p, c) {
  const x = c.change || {}, waiting = c.approval === 'waiting', votes = x.votes || {}, ap = x.approvers || [];
  const state = x.approved ? `<span class="gng-ok">${esc(t('gonogo.approved'))}</span>` : waiting ? esc(t('gonogo.waiting')) : c.approval === 'declined' ? `<span class="gng-no">${esc(t('gonogo.declined'))}</span>` : esc(t('gonogo.notsubmitted'));
  const rows = ap.map(w => { const v = votes[w]; return `<li>${esc(w)}: ${v ? `<b class="${v.go ? 'gng-ok' : 'gng-no'}">${esc(t(v.go ? 'gonogo.go' : 'gonogo.nogo'))}</b>${v.note ? ' ' + esc(v.note) : ''}` : `<span class="muted">${esc(t('gonogo.novote'))}</span>`}</li>`; }).join('');
  const id = esc(c.id), sl = esc(p.slug);
  const btn = (what, key, cls = '') => `<button type="button" class="${cls}" onclick="gonogoAct('${sl}', '${id}', '${what}')">${esc(t(key))}</button>`;
  const acts = x.approved ? '' : waiting
    ? `<textarea id="gng-note" rows="2" maxlength="500" placeholder="${esc(t('gonogo.note.ph'))}" aria-label="${esc(t('gonogo.note.ph'))}"></textarea><div class="actions">${btn('go', 'gonogo.go', 'good')}${btn('nogo', 'gonogo.nogo')}${btn('anyway', 'gonogo.anyway')}</div>`
    : `<div class="actions">${btn('submit', 'gonogo.submit', 'primary')}${btn('anyway', 'gonogo.anyway')}</div>`;
  return `<div class="gonogo"><h4>${esc(t('gonogo.heading'))}${x.round ? ` <span class="muted">${esc(t('gonogo.round', { n: x.round }))}</span>` : ''}</h4><p>${state}</p>${rows ? `<ul>${rows}</ul>` : ''}${acts}<div class="err" id="gng-err"></div></div>`;
}
async function gonogoAct(slug, id, what) {
  const note = ($('gng-note') || {}).value || '';
  try {
    if (what === 'submit') await api('POST', `/api/projects/${slug}/changes/${id}/submit`, {});
    else if (what === 'anyway') await api('POST', `/api/projects/${slug}/changes/${id}/go-anyway`, { note });
    else await api('POST', `/api/projects/${slug}/changes/${id}/vote`, { go: what === 'go', note });
    refresh(true);
  } catch (err) { const e = $('gng-err'); if (e) e.textContent = err.message; }
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
