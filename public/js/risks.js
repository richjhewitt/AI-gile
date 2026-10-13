/* ---------- ⚠️ Risks (#/risks/<slug>, AIG-863) ----------
   The project's risk register from GET /api/projects/:slug/risks: a list, highest score first, overdue reviews marked.
   Agents fill it in with `aigile risk`; the status can be changed here (PATCH). "Happened" files a 🔥 incident card. */
const RisksPage = (() => {
  const R = { data: null, slug: '' };
  const STATUSES = ['open', 'watching', 'closed', 'happened'];
  const dayLabel = s => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(i18n.locale, { year: 'numeric', month: 'short', day: 'numeric' }); };
  R.load = async slug => {
    if (R.slug !== slug) { R.slug = slug; R.data = null; }
    try { R.data = await api('GET', `/api/projects/${slug}/risks`); } catch { R.data = { error: true }; }
  };
  R.setStatus = async (id, status) => {
    try { await api('PATCH', `/api/projects/${R.slug}/risks/${encodeURIComponent(id)}`, { status }); } catch { /* the next poll shows the truth */ }
    state.lastSig = state.lastBoardSig = null; await R.load(R.slug); render();
  };
  const row = r => {
    const cls = 'rk-row rk-s' + r.score + ' rk-' + r.status + (r.overdue ? ' rk-overdue' : '');
    const bits = [r.card ? `<a href="#/p/${esc(R.slug)}/${esc(r.card)}">${esc(r.card)}</a>` : '', r.category ? esc(r.category) : '', r.owner ? esc(t('risks.owner', { name: r.owner })) : '',
      r.review ? esc(t('risks.review', { day: dayLabel(r.review) })) : '', r.overdue ? `<b class="rk-flag">${esc(t('risks.overdue'))}</b>` : '',
      r.incident ? `<a href="#/p/${esc(R.slug)}/${esc(r.incident)}">${esc(t('risks.incident', { id: r.incident }))}</a>` : ''].filter(Boolean).join(' · ');
    return `<li class="${cls}"><div class="rk-score" title="${esc(t('risks.lh', { l: r.likelihood, i: r.impact }))}">${r.score}</div>
      <div class="rk-main"><div class="rk-top"><b>${esc(r.risk)}</b>
        <select aria-label="${esc(t('risks.status'))}" onchange="RisksPage.setStatus('${esc(r.id)}', this.value)">${STATUSES.map(s => `<option value="${s}"${s === r.status ? ' selected' : ''}>${esc(t('risks.status.' + s))}</option>`).join('')}</select></div>
        <div class="muted rk-meta">${esc(r.id)} · ${esc(t('risks.lh', { l: r.likelihood, i: r.impact }))}${bits ? ' · ' + bits : ''}</div>
        ${r.mitigation ? `<div class="rk-line"><span class="muted">${esc(t('risks.mitigation'))}</span> ${esc(r.mitigation)}</div>` : ''}
        ${r.warning ? `<div class="rk-line"><span class="muted">${esc(t('risks.warning'))}</span> ${esc(r.warning)}</div>` : ''}</div></li>`;
  };
  R.render = () => {
    const d = R.data, back = `<a href="#/p/${esc(R.slug)}">${esc(t('risks.back'))}</a>`;
    if (!d) return `<div class="uz rk-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz rk-page"><p>${back}</p><p class="muted">${esc(t('risks.error'))}</p></div>`;
    return `<div class="uz rk-page"><p>${back}</p><h2>${esc(t('risks.title'))}</h2>
      ${d.overdue ? `<p class="rk-flag">${esc(t('risks.overdue.n', { count: d.overdue }))}</p>` : ''}
      ${d.risks.length ? `<ul class="rk-list">${d.risks.map(row).join('')}</ul>` : `<p class="muted">${esc(t('risks.none'))}</p>`}</div>`;
  };
  return R;
})();
