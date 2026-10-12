/* ---------- 📜 Setup > Business licences (AIG-601) ---------- */
// Applications that firms sent to the relay (POST /apply). Approve shows a short licence letter to copy; Decline just marks it.
const Lic = (() => {
  let data = null, open = '', msg = '';
  const when = s => s ? new Date(s).toLocaleDateString(i18n.locale, { dateStyle: 'medium' }) : '';
  function html() {
    if (!data) { load(); return `<span>${esc(t('lic.h'))}</span>`; }
    const rows = data.items.map(a => `<div class="lic-row" data-lic="${esc(a.id)}"><b>${esc(a.company)}</b> <span class="pill">${esc(t('lic.status.' + a.status))}</span> <span class="muted">${esc(when(a.at))}</span>
      <div class="muted">${a.website ? esc(a.website) + ' · ' : ''}${esc(a.email)}</div><div>${esc(a.what)}</div><div class="muted">${esc(a.how)}</div>
      ${a.status === 'approved' ? `<textarea class="lic-letter" readonly rows="9">${esc(a.letter)}</textarea><button type="button" onclick="Lic.copy('${esc(a.id)}', this)">${esc(t('lic.copy'))}</button>`
        : a.status === 'new' ? `<button type="button" class="primary lic-approve" onclick="Lic.decide('${esc(a.id)}','approve')">${esc(t('lic.approve'))}</button> <button type="button" class="lic-decline" onclick="Lic.decide('${esc(a.id)}','decline')">${esc(t('lic.decline'))}</button>` : ''}</div>`).join('');
    return `<span>${esc(t('lic.h'))}</span><small class="muted">${esc(t('lic.help', { key: data.key }))}</small>
      ${data.error ? `<small class="err" id="lic-err">${esc(data.error)}</small>` : data.items.length ? `<div class="lic-list">${rows}</div>` : `<small class="muted" id="lic-none">${esc(t('lic.none'))}</small>`}
      <div class="muted">${esc(msg)}</div>`;
  }
  const paint = () => { const b = $('licencesBox'); if (b) b.innerHTML = html(); };
  async function load() { try { data = await api('GET', '/api/licences'); } catch (e) { data = { key: '', items: [], error: e.message }; } paint(); }
  async function decide(id, decision) {
    try { await api('POST', '/api/licences/' + encodeURIComponent(id), { decision }); msg = t(decision === 'approve' ? 'lic.approved' : 'lic.declined'); } catch (e) { msg = e.message; }
    await load();
  }
  async function copy(id, btn) {
    const a = data.items.find(x => x.id === id); if (!a) return;
    try { await navigator.clipboard.writeText(a.letter); } catch { const ta = btn.previousElementSibling; ta.select(); document.execCommand('copy'); }
    const was = btn.textContent; btn.textContent = t('format.copied'); setTimeout(() => { btn.textContent = was; }, 1500);
  }
  return { html, decide, copy, reset: () => { data = null; } };
})();
