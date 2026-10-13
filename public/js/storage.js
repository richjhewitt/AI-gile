/* ---------- 💾 Storage in Setup (AIG-718): how much disk AI-gile uses, by kind, and one tidy-up ---------- */
const Storage = (() => {
  const S = { d: undefined, err: '', busy: false };
  const size = n => n >= 1048576 ? (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  const paint = () => { const b = $('storageBox'); if (b) b.innerHTML = S.html(); };
  S.load = async () => { try { S.d = await api('GET', '/api/storage'); S.err = ''; } catch (e) { S.d = null; S.err = e.message; } paint(); };
  S.html = () => {
    if (S.d === undefined) { S.d = null; S.load(); return `<small class="muted">${esc(t('storage.loading'))}</small>`; }
    const d = S.d; if (!d) return S.err ? `<div class="err">${esc(S.err)}</div>` : '';
    const rows = d.kinds.map(k => `<tr class="${k.kind === d.biggest ? 'stor-big' : ''}"><td>${esc(t('storage.k.' + k.kind))}${k.kind === d.biggest ? ` <span class="stor-flag">${esc(t('storage.biggest'))}</span>` : ''}</td><td class="muted">${esc(t('storage.files', { n: k.files }))}</td><td class="stor-n">${esc(size(k.bytes))}</td></tr>`).join('');
    const tdy = d.tidy.files
      ? `<div class="stor-tidy"><span>${esc(t('storage.tidy', { n: d.tidy.files, days: d.tidy.days, size: size(d.tidy.bytes) }))}</span> <button type="button" id="storTidy" class="danger" onclick="Storage.tidy()" ${S.busy ? 'disabled' : ''}>${esc(t('storage.delete'))}</button></div>`
      : `<small class="muted" id="storNone">${esc(t('storage.nothing', { days: d.tidy.days }))}</small>`;
    return `<span>💾 ${esc(t('storage.h'))}</span><table class="stor-t"><tbody>${rows}<tr class="stor-total"><td><b>${esc(t('storage.total'))}</b></td><td></td><td class="stor-n"><b id="storTotal">${esc(size(d.total))}</b></td></tr></tbody></table>${tdy}<div class="err">${esc(S.err)}</div>`;
  };
  S.tidy = async () => {
    const d = S.d; if (!d || !d.tidy.files) return;
    if (!confirm(t('storage.confirm', { n: d.tidy.files, size: size(d.tidy.bytes) }))) return;
    S.busy = true; S.err = ''; paint();
    try { S.d = await api('POST', '/api/storage/tidy'); } catch (e) { S.err = e.message; }
    S.busy = false; paint();
  };
  return S;
})();
