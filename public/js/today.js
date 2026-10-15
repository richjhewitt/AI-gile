/* ---------- 🎯 Today (#/today, AIG-595..597) ----------
   One weight per project for today: 🔥 high, normal, 🐢 low or 💤 rest. They reset each morning; "Keep yesterday's" brings them
   back. The server (lib/today.js) orders the Scrum Master and the night watchman by it and splits the day's tokens by it.
   Not the 🎯 focus mode (focus.js): that one is a calm screen for a single task. */
const TodayPage = (() => {
  const T = { data: null };
  const ICON = { high: '🔥', normal: '', low: '🐢', rest: '💤' };
  T.icon = w => ICON[w] || '';
  T.load = async (options = {}) => { try { T.data = await PagePoll.get('/api/today', options); } catch { T.data = null; } return T.data; };
  // A small badge for the project cards: nothing for normal.
  T.badge = slug => {
    const p = T.data && T.data.projects.find(x => x.slug === slug);
    return p && p.weight !== 'normal' ? `<span class="today-badge w-${p.weight}" title="${esc(t('today.' + p.weight))}">${ICON[p.weight]}</span>` : '';
  };
  T.set = async (slug, weight) => { T.data = await api('POST', '/api/today', { slug, weight }); render(); };
  T.aiOff = async (slug, on) => { try { await api('PATCH', '/api/projects/' + slug, { aiOff: on }); await T.load(); render(); } catch (e) { alert(e.message); } };
  // AIG-607: exact shares. The total must be 100 to save; the server refuses anything else too.
  T.sum = () => {
    const eq = $('todayEqual') && $('todayEqual').checked, ins = [...document.querySelectorAll('.today-pct')];
    ins.forEach(i => { i.disabled = eq; });
    const total = Math.round(ins.reduce((a, i) => a + (+i.value || 0), 0) * 10) / 10;
    $('todayTotal').textContent = t('today.pct.total', { total }); $('todayTotal').className = total === 100 || eq ? 'muted' : 'err';
    $('todaySaveShares').disabled = !(eq || total === 100);
  };
  T.saveShares = async () => {
    const eq = $('todayEqual').checked, pct = {};
    document.querySelectorAll('.today-pct').forEach(i => { if (+i.value) pct[i.dataset.slug] = +i.value; });
    try { T.data = await api('POST', '/api/today/shares', eq ? { equal: true } : { pct }); render(); } catch (e) { $('todayErr').textContent = e.message; }
  };
  T.useWeights = async () => { T.data = await api('POST', '/api/today/shares', {}); render(); };
  T.keep = async () => { T.data = await api('POST', '/api/today/keep'); render(); };
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
  T.line = p => p.weight === 'rest' ? esc(t('today.restline'))
    : esc(t('today.shareline', { share: p.share })) + (T.data.limit ? ' · ' + esc(t('today.useline', { used: fmt(p.used), allowed: fmt(p.allowed) })) : '');
  T.render = () => {
    const d = T.data;
    if (!d) return `<div class="uz"><h2>${esc(t('today.title'))}</h2><p class="muted">${esc(t('today.none'))}</p></div>`;
    const rows = d.projects.map(p => `<div class="today-row" data-slug="${esc(p.slug)}"><div class="today-name"><b>${esc(p.emoji)} ${esc(p.name)}</b>${p.over ? ` <span class="pill blocked" title="${esc(t('today.over.title'))}">${esc(t('today.over'))}</span>` : ''}<div class="muted">${T.line(p)}</div></div>
      <div class="today-btns" role="group" aria-label="${esc(p.name)}">${d.weights.map(w => `<button class="today-w ${p.weight === w ? 'on' : ''}" aria-pressed="${p.weight === w}" data-w="${w}" onclick="TodayPage.set('${esc(p.slug)}','${w}')">${w === 'normal' ? '' : ICON[w] + ' '}${esc(t('today.' + w))}</button>`).join('')}<button class="today-ai ${p.aiOff ? 'on' : ''}" aria-pressed="${!!p.aiOff}" data-aioff onclick="TodayPage.aiOff('${esc(p.slug)}',${!p.aiOff})" title="${esc(t('today.aioff.title'))}">⏸ ${esc(t('today.aioff'))}</button></div></div>`).join('');
    // AIG-607: exact shares (they replace the weight split and stay across days), or an equal split.
    const eq = d.mode === 'equal';
    setTimeout(() => { if ($('todayTotal')) T.sum(); }, 0);   // the running total, once the page is in
    const shares = `<div class="uz-card today-shares"><div class="uz-tile-h">${esc(t('today.pct.h'))}</div><p class="muted">${esc(t(d.mode === 'weights' ? 'today.pct.intro' : 'today.pct.on'))}</p>
      <label class="chk"><input type="checkbox" id="todayEqual" ${eq ? 'checked' : ''} onchange="TodayPage.sum()"> ${esc(t('today.pct.equal'))}</label>
      ${d.projects.map(p => `<label class="today-pctrow"><span>${esc(p.emoji)} ${esc(p.name)}</span><input type="number" class="today-pct" data-slug="${esc(p.slug)}" min="0" max="100" step="0.5" value="${d.mode === 'pct' ? p.setPct || '' : ''}" oninput="TodayPage.sum()" aria-label="${esc(p.name)}"> %</label>`).join('')}
      <div id="todayTotal" class="muted"></div><div class="err" id="todayErr"></div>
      <div class="actions"><button class="primary" id="todaySaveShares" onclick="TodayPage.saveShares()" disabled>${esc(t('common.save'))}</button>${d.mode === 'weights' ? '' : `<button onclick="TodayPage.useWeights()">${esc(t('today.pct.weights'))}</button>`}</div></div>`;
    return `<div class="uz today"><div class="toolbar"><h2>${esc(t('today.title'))}</h2><span class="grow"></span><button id="todayKeep" onclick="TodayPage.keep()" ${d.yesterday ? '' : 'disabled'} title="${esc(t('today.keep.title'))}">${esc(t('today.keep'))}</button></div>
      <p class="muted">${esc(t('today.intro'))}</p><div class="uz-card">${rows || `<p class="muted">${esc(t('today.none'))}</p>`}</div>${shares}</div>`;
  };
  // The usage page's burn-down: each project's share of today and what it has used.
  T.usageCard = () => {
    const d = T.data; if (!d || !d.projects.length) return '';
    // AIG-1315: only the projects active today; the resting ones fold into one line with a link to 🎯 Today
    const left = d.left || [], on = d.projects.filter(p => p.weight !== 'rest' && !left.includes(p.slug)), rest = d.projects.length - on.length;
    const restLine = rest ? `<div class="muted today-restsum">${esc(t('today.hidden', { n: rest }))} <a href="#/today">${esc(t('today.link'))}</a></div>` : '';
    return `<div class="uz-card today-usage"><div class="uz-tile-h">${esc(t('today.usage.h'))}</div>${restLine && !on.length ? restLine : ''}${on.map(p => `<div class="today-bar"><span class="today-bn">${T.icon(p.weight)} ${esc(p.name)}</span>
      <span class="today-track" title="${esc(T.line(p).replace(/<[^>]+>/g, ''))}"><i class="${p.over ? 'over' : ''}" style="width:${Math.min(100, p.pct)}%"></i></span><span class="muted today-bv">${T.line(p)}</span></div>`).join('')}${on.length ? restLine : ''}</div>`;
  };
  // AIG-829: the morning picker (setup switch "Pick today's projects at start-up"): a small dialog on the first open of the day.
  let askedDay = '';   // the day (as the server counts it) the picker was last shown for: a board left open overnight asks again next morning
  T.pickRows = d => d.projects.map(p => `<label class="chk today-pickrow"><input type="checkbox" value="${esc(p.slug)}" ${(p.pickDefault || p.weight) === 'rest' ? '' : 'checked'}> ${esc(p.emoji)} ${esc(p.name)}</label>`).join('');
  T.maybePick = async () => {
    if (document.querySelector('#dialog .overlay')) return;
    const d = await T.load(); if (!d || !d.askPick || !d.projects.length || askedDay === d.day) return;
    if (document.querySelector('#dialog .overlay')) return;   // a dialog opened while the data loaded
    if (typeof MyDay !== 'undefined' && await MyDay.owns()) return;   // AIG-797: Start my day is on: the picker is its step 1
    askedDay = d.day;
    openDialog(`<h2>${esc(t('today.pick.h'))}</h2><p class="muted">${esc(t('today.pick.intro'))}</p>
      <div id="todayPickList">${T.pickRows(d)}</div>
      <div class="err" id="todayPickErr"></div>
      <div class="actions"><button onclick="TodayPage.pickSkip()">${esc(t('today.pick.skip'))}</button><button class="primary" id="todayPickGo" onclick="TodayPage.pickGo()">${esc(t('today.pick.go'))}</button></div>`);
  };
  T.pickGo = async keep => {   // keep: inside Start my day (AIG-797): stay in that dialog and redraw it
    const slugs = [...document.querySelectorAll('#todayPickList input:checked')].map(i => i.value);
    try { T.data = await api('POST', '/api/today/pick', { slugs }); T.showAll(false); if (keep === true && typeof MyDay !== 'undefined') MyDay.redraw(); else closeDialog(); if (typeof refresh === 'function') refresh(true); if (typeof Dms !== 'undefined' && Dms.reload) Dms.reload(); } catch (e) { $('todayPickErr').textContent = e.message; }
  };
  T.pickSkip = async keep => { try { T.data = await api('POST', '/api/today/pick', { skip: true }); } catch {} if (keep === true && typeof MyDay !== 'undefined') MyDay.redraw(); else closeDialog(); };
  // AIG-830: unpicked projects are hidden on home and in the rail and project menus; "Show all" (this browser, today's date) brings them back.
  const KEY = 'aigile.todayAll';
  const flag = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  T.showing = () => !!(T.data && flag() === T.data.day);
  T.showAll = on => { try { if (on && T.data) localStorage.setItem(KEY, T.data.day); else localStorage.removeItem(KEY); } catch {} };
  T.hidden = () => (T.data && !T.showing() ? T.data.left || [] : []);
  T.only = list => { const h = T.hidden(); return h.length && Array.isArray(list) ? list.filter(x => !h.includes(x.slug)) : list; };
  T.showAllClick = () => { T.showAll(true); if (typeof refresh === 'function') refresh(true); if (typeof Dms !== 'undefined' && Dms.reload) Dms.reload(); };
  // The line on home: how many are out of sight, and the link.
  T.hiddenLine = () => { const n = T.hidden().length; return n ? `<p class="muted today-hidden">${esc(t('today.hidden', { n }))} <a href="#/" onclick="TodayPage.showAllClick();return false">${esc(t('today.showall'))}</a></p>` : ''; };
  // The rail and menus do not load the page data: a short cache is enough.
  let seen = 0;
  T.fresh = async () => { if (Date.now() - seen < 10000 && T.data) return; seen = Date.now(); await T.load(); };
  let polled = 0;
  setInterval(async () => {
    if (typeof i18n === 'undefined' || !i18n.ready || document.hidden) return;
    if (Date.now() - polled < (askedDay ? 60000 : 10000)) return;   // AIG-1063: the day is the server's (it turns over at the owner's day start): once asked, look now and then   // look again now and then, so turning the setting on (or a new morning) needs no reload
    polled = Date.now(); await T.maybePick();
  }, 3000);
  return T;
})();
