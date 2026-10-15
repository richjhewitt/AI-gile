/* ---------- 📈 Improvements (#/improvements, AIG-1157) ----------
   One list of everything we decided to get better at, across all projects, filtered per project: retro suggestion cards
   (open / Go / Not yet), post-incident review actions (open / ticked / made into a card and that card's status) and problem cards
   with a fix (the change card and its status). Plain code from GET /api/improvements; read-only, links to the cards. */
const Improvements = (() => {
  const I = { data: null, slug: '' };
  I.load = async () => { try { I.data = await api('GET', '/api/improvements'); } catch { I.data = { error: true }; } };
  I.pick = v => { I.slug = v; render(); };
  const stat = (x, k) => x.cardStatus ? t('col.' + x.cardStatus) : '';
  const state = x => x.state === 'card' ? t('imp.s.card', { id: x.card, status: stat(x) })
    : x.state === 'fix' ? t('imp.s.fix', { id: x.card, status: stat(x) }) : t('imp.s.' + x.state);
  const row = x => `<li class="rk-row imp-row imp-${esc(x.kind)}" data-state="${esc(x.state)}"><div class="rk-main"><div class="rk-top"><b>${esc(x.title)}</b> <span class="pill imp-state">${esc(state(x))}</span></div>
    <div class="muted rk-meta"><a href="#/p/${esc(x.slug)}/${esc(x.id)}">${esc(x.id)}</a> · ${esc(x.project)}${x.card ? ` · <a href="#/p/${esc(x.slug)}/${esc(x.card)}">${esc(x.card)}</a>` : ''}</div>
    ${x.why ? `<div class="rk-line muted">${esc(x.kind === 'review' ? t('imp.from', { id: x.id }) + ': ' + x.why : x.why)}</div>` : ''}</div></li>`;
  I.render = () => {
    const d = I.data, back = `<a href="#/">${esc(t('imp.back'))}</a>`;
    if (!d) return `<div class="uz rk-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz rk-page"><p>${back}</p><p class="muted">${esc(t('imp.error'))}</p></div>`;
    const projects = [...new Map(d.items.map(x => [x.slug, x.project]))];
    const items = d.items.filter(x => !I.slug || x.slug === I.slug);
    const sel = `<label>${esc(t('imp.filter'))} <select id="impFilter" onchange="Improvements.pick(this.value)"><option value="">${esc(t('imp.all'))}</option>${projects.map(([s, n]) => `<option value="${esc(s)}"${s === I.slug ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    const sec = kind => { const l = items.filter(x => x.kind === kind); return l.length ? `<h3>${esc(t('imp.' + kind))} <span class="muted">${l.length}</span></h3><ul class="rk-list">${l.map(row).join('')}</ul>` : ''; };
    return `<div class="uz rk-page"><p>${back}</p><h2>${esc(t('imp.title'))}</h2><p>${sel}</p>
      ${items.length ? sec('retro') + sec('review') + sec('problem') : `<p class="muted">${esc(t('imp.none'))}</p>`}</div>`;
  };
  return I;
})();
