/* ---------- 🧩 Known errors (#/known-errors/<slug> and #/known-errors, AIG-1106) ----------
   Open problem cards that have a workaround, per project or for all projects: title, workaround, how many incidents, link to the card.
   Plain code from GET /api/projects/:slug/known-errors (or /api/known-errors). The same lines go into the agent brief. */
const KnownErrors = (() => {
  const K = { data: null, slug: '' };
  K.load = async slug => {
    if (K.slug !== slug) { K.slug = slug; K.data = null; }
    try { K.data = await api('GET', slug ? `/api/projects/${slug}/known-errors` : '/api/known-errors'); } catch { K.data = { error: true }; }
  };
  const row = (k, all) => `<li class="rk-row ke-row"><div class="rk-main"><div class="rk-top"><b><a href="#/p/${esc(k.slug || K.slug)}/${esc(k.id)}">${esc(k.title)}</a></b></div>
    <div class="muted rk-meta">${esc(k.id)}${all ? ' · ' + esc(k.project) : ''} · ${esc(t('ke.incidents', { count: k.incidentCount }))}</div>
    <div class="rk-line"><span class="muted">${esc(t('ke.workaround'))}</span> ${esc(k.workaround)}</div></div></li>`;
  K.render = () => {
    const d = K.data, all = !K.slug;
    const back = all ? `<a href="#/">${esc(t('ke.all.back'))}</a>` : `<a href="#/p/${esc(K.slug)}">${esc(t('ke.back'))}</a>`;
    const sw = all ? '' : ` · <a href="#/known-errors">${esc(t('ke.all.link'))}</a>`;
    if (!d) return `<div class="uz rk-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz rk-page"><p>${back}</p><p class="muted">${esc(t('ke.error'))}</p></div>`;
    return `<div class="uz rk-page"><p>${back}${sw}</p><h2>${esc(t(all ? 'ke.all.title' : 'ke.title'))}</h2>
      ${d.errors.length ? `<ul class="rk-list">${d.errors.map(k => row(k, all)).join('')}</ul>` : `<p class="muted">${esc(t('ke.none'))}</p>`}</div>`;
  };
  return K;
})();
