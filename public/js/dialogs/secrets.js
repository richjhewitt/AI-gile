/* ---------- 🔑 secrets (AIG-585, AIG-587): a masked box on the card, and ⚙️ Setup > Secrets (names only) ---------- */
// An agent asks for a named secret on a task card (aigile secret ask). The card lists its asks (c.secretAsks, names and
// reasons only); the owner pastes the value into a password box and saves. The value goes to POST /api/secrets/save with the
// page's token and is never shown again. Setup lists names with when stored, last used and by whom; Delete now; auto-delete time.
const SEC = { tok: null, list: null, msg: '' };
async function secToken() { if (!SEC.tok) SEC.tok = (await api('GET', '/api/secrets/token')).token; return SEC.tok; }
const secWhen = s => s ? new Date(s).toLocaleString(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';

function secretsUi(p, c) {
  const asks = c.secretAsks || [];
  if (!asks.length) return '';
  return `<div class="sec-box" id="sec-box"><div class="chk-h"><b>🔑 ${esc(t('sec.h'))}</b></div>${asks.map(a => `<div class="sec-ask" data-secret="${esc(a.name)}">
    <div><code>${esc(a.name)}</code> <span class="muted">${esc(t('sec.for', { who: a.by || '?', why: a.purpose }))}</span></div>
    ${a.have ? `<div class="sec-have">✔ ${esc(t('sec.have'))}</div>`
      : `<div class="sec-row"><input type="password" autocomplete="off" spellcheck="false" id="sec-in-${esc(a.name)}" placeholder="${esc(t('sec.ph'))}" aria-label="${esc(t('sec.ph') + ' ' + a.name)}"><button type="button" class="primary" onclick="secSave('${esc(a.name)}')">${esc(t('sec.save'))}</button></div>
      <small class="muted">${esc(t('sec.note'))}</small>`}</div>`).join('')}<div class="err" id="sec-err"></div></div>`;
}
async function secSave(name) {
  const inp = $('sec-in-' + name), value = inp && inp.value, p = state.project, c = curCard();
  if (!value) return setErr('sec-err', t('sec.empty'));
  try { await api('POST', '/api/secrets/save', { token: await secToken(), slug: p.slug, name, value }); inp.value = ''; refresh(true); }
  catch (e) { setErr('sec-err', e); }
}

/* ---------- ⚙️ Setup > Secrets ---------- */
function secretsBoxHtml() {
  if (!SEC.list) { secLoad(); return `<span>${esc(t('sec.setup.h'))}</span>`; }
  const l = SEC.list, hours = [1, 6, 24, 72, 168, 0];
  const rows = l.items.map(x => `<tr data-secret="${esc(x.name)}"><td><code>${esc(x.name)}</code><br><small class="muted">${esc(x.purpose)}</small></td>
    <td><a href="#/p/${esc(x.slug)}/${esc(x.card)}">${esc(x.card)}</a></td>
    <td>${x.stored ? esc(secWhen(x.storedAt)) : `<span class="muted">${esc(t('sec.waiting'))}</span>`}</td>
    <td>${x.lastUsedAt ? esc(t('sec.used', { when: secWhen(x.lastUsedAt), who: x.lastUsedBy || '?' })) : '<span class="muted">–</span>'}</td>
    <td><button type="button" onclick="secDelete('${esc(x.slug)}','${esc(x.name)}')">${esc(t('sec.delete'))}</button></td></tr>`).join('');
  return `<span>${esc(t('sec.setup.h'))}</span><small class="muted">${esc(t('sec.setup.help'))}</small>
    ${l.items.length ? `<div class="sec-table"><table><thead><tr><th>${esc(t('sec.col.name'))}</th><th>${esc(t('sec.col.card'))}</th><th>${esc(t('sec.col.stored'))}</th><th>${esc(t('sec.col.used'))}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<small class="muted" id="sec-none">${esc(t('sec.none'))}</small>`}
    <label class="f"><span>${esc(t('sec.auto'))}</span><select id="sec-hours" onchange="secHours(this.value)">${hours.map(h => `<option value="${h}" ${h === l.hours ? 'selected' : ''}>${esc(h === 0 ? t('sec.auto.never') : t('sec.auto.hours', { count: h }))}</option>`).join('')}</select></label>
    <div class="err" id="sec-setup-err"></div><div class="muted">${esc(SEC.msg)}</div>`;
}
const secPaint = () => { if ($('secretsBox')) $('secretsBox').innerHTML = secretsBoxHtml(); };
async function secLoad() { try { SEC.list = await api('GET', '/api/secrets'); } catch { SEC.list = { hours: 24, items: [] }; } secPaint(); }
async function secDelete(slug, name) {
  try { await api('POST', '/api/secrets/delete', { token: await secToken(), slug, name }); SEC.msg = t('sec.deleted', { name }); await secLoad(); }
  catch (e) { setErr('sec-setup-err', e); }
}
async function secHours(h) {
  try { await api('POST', '/api/secrets/hours', { token: await secToken(), hours: Number(h) }); SEC.msg = t('setup.saved.short'); await secLoad(); }
  catch (e) { setErr('sec-setup-err', e); }
}
