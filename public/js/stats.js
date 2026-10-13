/* ---------- 📈 Project stats (#/stats/<slug>, AIG-726/727) ----------
   Numbers from GET /api/projects/:slug/stats (plain code), a weekly bar chart in plain SVG, records and the shareable
   "AI-gile Wrapped" box with a Copy as text button. */
const StatsPage = (() => {
  const S = { data: null, slug: '', text: '' };
  const num = n => Number(n || 0).toLocaleString(i18n.locale);
  const dayLabel = s => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(i18n.locale, { year: 'numeric', month: 'short', day: 'numeric' }); };
  S.load = async slug => {
    if (S.slug !== slug) { S.slug = slug; S.data = null; }
    try { S.data = await api('GET', `/api/projects/${slug}/stats`); } catch { S.data = { error: true }; }
  };
  const tile = (k, v, cls) => `<div class="st-tile ${cls}"><div class="st-v">${esc(v)}</div><div class="st-k">${esc(t(k))}</div></div>`;
  const chart = weeks => {
    const W = 480, H = 140, pad = 18, bw = W / weeks.length, top = Math.max(1, ...weeks.map(w => w.done));
    const bars = weeks.map((w, i) => { const h = Math.round((H - pad - 14) * w.done / top);
      return `<g><title>${esc(t('stats.week.tip', { week: dayLabel(w.week), n: w.done }))}</title>`
        + `<rect x="${(i * bw + 4).toFixed(1)}" y="${H - pad - h}" width="${(bw - 8).toFixed(1)}" height="${h}" rx="3" class="st-bar"/>`
        + (w.done ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - pad - h - 3}" text-anchor="middle" class="st-num">${w.done}</text>` : '')
        + `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="st-lbl">${esc(new Date(w.week.replace(/-/g, '/')).toLocaleDateString(i18n.locale, { month: 'numeric', day: 'numeric' }))}</text></g>`; }).join('');
    return `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('stats.weekly'))}"><line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" class="st-axis"/>${bars}</svg>`;
  };
  const wrapped = d => {
    const lines = [t('stats.wrap.head', { name: d.project }), t('stats.wrap.done', { done: num(d.done), made: num(d.made) }), t('stats.wrap.comments', { n: num(d.comments) })];
    if (d.longestStreak) lines.push(t('stats.wrap.streak', { count: d.longestStreak }));
    if (d.busiestDay) lines.push(t('stats.wrap.busy', { day: dayLabel(d.busiestDay.day), n: d.busiestDay.done }));
    if (d.git) lines.push(t('stats.wrap.git', { commits: num(d.git.commits), lines: num(d.git.lines) }));
    return lines.join('\n');
  };
  S.render = () => {
    const d = S.data;
    const back = `<a href="#/p/${esc(S.slug)}">${esc(t('stats.back'))}</a>`;
    if (!d) return `<div class="uz st-page"><p>${back}</p><p class="muted">${esc(t('common.loading'))}</p></div>`;
    if (d.error) return `<div class="uz st-page"><p>${back}</p><p class="muted">${esc(t('stats.error'))}</p></div>`;
    S.text = wrapped(d);
    const r = d.records || {};
    const tiles = tile('stats.done', num(d.done), 'st-done') + tile('stats.made', num(d.made), '') + tile('stats.comments', num(d.comments), '')
      + tile('stats.commits', d.git ? num(d.git.commits) : '–', '') + tile('stats.lines', d.git ? num(d.git.lines) : '–', '')
      + tile('stats.busiest', d.busiestDay ? t('stats.busiest.v', { day: dayLabel(d.busiestDay.day), n: d.busiestDay.done }) : '–', 'st-wide')
      + tile('stats.streak', d.longestStreak ? t('stats.streak.v', { count: d.longestStreak }) : '–', '')
      + tile('stats.first', d.firstCard ? dayLabel(d.firstCard) : '–', '');
    return `<div class="uz st-page"><p>${back}</p><h2>${esc(t('stats.title'))}: ${esc(d.project)}</h2>
      <div class="st-tiles">${tiles}</div>
      ${d.git ? `<p class="muted">${esc(t('stats.git.detail', { added: num(d.git.added), removed: num(d.git.removed) }))}</p>` : `<p class="muted">${esc(t('stats.nogit'))}</p>`}
      <div class="uz-card"><h3>${esc(t('stats.weekly'))}</h3>${chart(d.weeks)}</div>
      <div class="uz-card"><h3>${esc(t('stats.records'))}</h3><ul class="st-rec">
        <li>${r.mostComments ? esc(t('stats.rec.comments', { id: r.mostComments.id, title: r.mostComments.title, n: r.mostComments.comments })) : esc(t('stats.rec.none'))}</li>
        <li>${r.biggestDay ? esc(t('stats.rec.day', { day: dayLabel(r.biggestDay.day), n: r.biggestDay.done })) : esc(t('stats.rec.none'))}</li></ul></div>
      <div class="st-wrap"><h3>${esc(t('stats.wrap.h'))}</h3><pre id="stWrapText">${esc(S.text)}</pre>
        <button class="primary" id="stCopy" onclick="copyDocText(this, StatsPage.text)">${esc(t('stats.wrap.copy'))}</button></div></div>`;
  };
  return S;
})();
