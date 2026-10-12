/* ---------- 🎯 Today (#/today, AIG-595..597) ----------
   One weight per project for today: 🔥 high, normal, 🐢 low or 💤 rest. They reset each morning; "Keep yesterday's" brings them
   back. The server (lib/today.js) orders the Scrum Master and the night watchman by it and splits the day's tokens by it.
   Not the 🎯 focus mode (focus.js): that one is a calm screen for a single task. */
const TodayPage = (() => {
  const T = { data: null };
  const ICON = { high: '🔥', normal: '', low: '🐢', rest: '💤' };
  T.icon = w => ICON[w] || '';
  T.load = async () => { try { T.data = await api('GET', '/api/today'); } catch { T.data = null; } return T.data; };
  // A small badge for the project cards: nothing for normal.
  T.badge = slug => {
    const p = T.data && T.data.projects.find(x => x.slug === slug);
    return p && p.weight !== 'normal' ? `<span class="today-badge w-${p.weight}" title="${esc(t('today.' + p.weight))}">${ICON[p.weight]}</span>` : '';
  };
  T.set = async (slug, weight) => { T.data = await api('POST', '/api/today', { slug, weight }); render(); };
  T.keep = async () => { T.data = await api('POST', '/api/today/keep'); render(); };
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
  T.line = p => p.weight === 'rest' ? esc(t('today.restline'))
    : esc(t('today.shareline', { share: p.share })) + (T.data.limit ? ' · ' + esc(t('today.useline', { used: fmt(p.used), allowed: fmt(p.allowed) })) : '');
  T.render = () => {
    const d = T.data;
    if (!d) return `<div class="uz"><h2>${esc(t('today.title'))}</h2><p class="muted">${esc(t('today.none'))}</p></div>`;
    const rows = d.projects.map(p => `<div class="today-row" data-slug="${esc(p.slug)}"><div class="today-name"><b>${esc(p.emoji)} ${esc(p.name)}</b>${p.over ? ` <span class="pill blocked" title="${esc(t('today.over.title'))}">${esc(t('today.over'))}</span>` : ''}<div class="muted">${T.line(p)}</div></div>
      <div class="today-btns" role="group" aria-label="${esc(p.name)}">${d.weights.map(w => `<button class="today-w ${p.weight === w ? 'on' : ''}" aria-pressed="${p.weight === w}" data-w="${w}" onclick="TodayPage.set('${esc(p.slug)}','${w}')">${w === 'normal' ? '' : ICON[w] + ' '}${esc(t('today.' + w))}</button>`).join('')}</div></div>`).join('');
    return `<div class="uz today"><div class="toolbar"><h2>${esc(t('today.title'))}</h2><span class="grow"></span><button id="todayKeep" onclick="TodayPage.keep()" ${d.yesterday ? '' : 'disabled'} title="${esc(t('today.keep.title'))}">${esc(t('today.keep'))}</button></div>
      <p class="muted">${esc(t('today.intro'))}</p><div class="uz-card">${rows || `<p class="muted">${esc(t('today.none'))}</p>`}</div></div>`;
  };
  // The usage page's burn-down: each project's share of today and what it has used.
  T.usageCard = () => {
    const d = T.data; if (!d || !d.projects.length) return '';
    return `<div class="uz-card today-usage"><div class="uz-tile-h">${esc(t('today.usage.h'))}</div>${d.projects.map(p => `<div class="today-bar"><span class="today-bn">${T.icon(p.weight)} ${esc(p.name)}</span>
      <span class="today-track" title="${esc(T.line(p).replace(/<[^>]+>/g, ''))}"><i class="${p.over ? 'over' : ''}" style="width:${Math.min(100, p.pct)}%"></i></span><span class="muted today-bv">${T.line(p)}</span></div>`).join('')}</div>`;
  };
  return T;
})();
