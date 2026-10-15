/* ---------- 🔐 Access review (AIG-1127) ----------
   accessReviewHtml(p, c): on the review card (c.accessReview), a box that fills itself (GET .../accessreview/:id) with every row
   (share link, change role, kept secret: names only) and Keep / Remove buttons. Setup gets one button, Run access review now. */
function accessReviewHtml(p, c) {
  if (!c.accessReview) return '';
  queueMicrotask(() => accessReviewFill(p.slug, c.id));
  return `<div class="accrev" id="accrev-${esc(c.id)}"></div>`;
}
async function accessReviewFill(slug, id) {
  const box = document.getElementById('accrev-' + id); if (!box) return;
  let d; try { d = await api('GET', `/api/projects/${slug}/accessreview/${id}`); } catch { return; }
  const el = document.getElementById('accrev-' + id); if (!el) return;
  el.innerHTML = `<h3>${esc(t('acc.heading'))}</h3>` + (d.items.length ? `<ul class="accrev-list">${d.items.map(x => `<li data-n="${x.n}">${esc(x.line)} ${x.decision
    ? `<span class="muted accrev-done">${esc(t('acc.' + x.decision))}</span>`
    : `<button type="button" class="accrev-keep" onclick="accessReviewAct('${esc(slug)}', '${esc(id)}', ${x.n}, 'keep', '${esc(encodeURIComponent(x.rk || ''))}')">${esc(t('acc.keep'))}</button> <button type="button" class="danger accrev-remove" onclick="accessReviewAct('${esc(slug)}', '${esc(id)}', ${x.n}, 'remove', '${esc(encodeURIComponent(x.rk || ''))}')">${esc(t('acc.remove'))}</button>`}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('acc.none'))}</p>`);
}
async function accessReviewAct(slug, id, n, action, rk) {
  try { await api('POST', `/api/projects/${slug}/accessreview/${id}`, rk ? { rk: decodeURIComponent(rk), action } : { item: n, action }); accessReviewFill(slug, id); if (typeof refresh === 'function') refresh(true); } catch (e) { alert(e.message); }
}
const AccessReview = {
  html: () => `<div class="accrev-setup"><b>🔐 ${esc(t('acc.setup.h'))}</b> <span class="muted">${esc(t('acc.setup.note'))}</span><div><button type="button" id="accrevRun" onclick="AccessReview.run()">${esc(t('acc.run'))}</button> <span id="accrevMsg" class="muted"></span></div></div>`,
  async run() {
    const m = $('accrevMsg');
    try { const r = await api('POST', '/api/accessreview/run', {}); if (m) m.innerHTML = `${esc(t('acc.ran', { card: r.card }))} <a href="#/p/${esc(r.project)}/${esc(r.card)}">${esc(r.card)}</a>`; }
    catch (e) { if (m) m.textContent = e.message; }
  },
};
