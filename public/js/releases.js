/* ---------- 🚀 Releases (#/releases/<slug>, AIG-1154) ----------
   The project's releases from GET /api/projects/:slug/releases, newest first, each with its notes. "New release" names one (the done cards
   since the last go in); "Roll back" files a checklist card of the change cards' undo steps. Nothing touches git. */
const ReleasesPage = (() => {
  const R = { data: null, slug: '', err: '' };
  R.load = async slug => {
    if (R.slug !== slug) { R.slug = slug; R.data = null; R.err = ''; }
    try { R.data = await api('GET', `/api/projects/${slug}/releases`); } catch { R.data = { error: true }; }
  };
  const again = async () => { state.lastSig = state.lastBoardSig = null; await R.load(R.slug); render(); };
  R.create = async () => {
    const inp = document.getElementById('relName'); if (!inp) return;
    R.err = '';
    try { await api('POST', `/api/projects/${R.slug}/releases`, { name: inp.value }); } catch (e) { R.err = e.message; }
    await again();
  };
  R.rollback = async name => {
    R.err = '';
    try { await api('POST', `/api/projects/${R.slug}/releases/${encodeURIComponent(name)}/rollback`, {}); } catch (e) { R.err = e.message; }
    await again();
  };
  const row = r => `<li class="rel-row" data-name="${esc(r.name)}"><div class="rel-top"><b>${esc(r.name)}</b>
      <span class="muted">${esc(new Date(r.at).toLocaleDateString(i18n.locale, { year: 'numeric', month: 'short', day: 'numeric' }))} · ${esc(t('rel.cards', { count: r.cards.length }))}${r.by ? ' · ' + esc(r.by) : ''}</span></div>
      <pre class="rel-notes" style="white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;font:inherit;margin:.4em 0">${esc(r.notes)}</pre>
      <p>${r.rollback ? `<a class="rel-rbcard" href="#/p/${esc(R.slug)}/${esc(r.rollback)}">${esc(t('rel.rbcard', { id: r.rollback }))}</a>`
        : r.changes ? `<button class="rel-rb" style="min-height:40px" onclick="ReleasesPage.rollback(decodeURIComponent('${encodeURIComponent(r.name)}'))" title="${esc(t('rel.rb.title'))}" aria-label="${esc(t('rel.rb.title'))}">${esc(t('rel.rb'))}</button>` : ''}</p></li>`;
  R.render = () => {
    const d = R.data, back = `<a href="#/p/${esc(R.slug)}">${esc(t('rel.back'))}</a>`;
    if (!d) return `<div class="uz rel-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz rel-page"><p>${back}</p><p class="muted">${esc(t('rel.error'))}</p></div>`;
    return `<div class="uz rel-page"><p>${back}</p><h2>${esc(t('rel.title'))}</h2><p class="muted">${esc(t('rel.intro'))}</p>
      <p><input id="relName" maxlength="40" placeholder="${esc(t('rel.name'))}" style="min-height:40px;max-width:100%" onkeydown="if(event.key==='Enter')ReleasesPage.create()">
      <button class="rel-new primary" style="min-height:40px" onclick="ReleasesPage.create()">${esc(t('rel.new'))}</button>
      <span class="muted">${esc(t('rel.next', { count: d.next }))}</span></p>
      ${R.err ? `<p class="rel-err" style="color:var(--bad,#c33)">${esc(R.err)}</p>` : ''}
      ${d.releases.length ? `<ul class="rel-list" style="list-style:none;padding:0">${d.releases.map(row).join('')}</ul>` : `<p class="muted">${esc(t('rel.none'))}</p>`}</div>`;
  };
  return R;
})();
