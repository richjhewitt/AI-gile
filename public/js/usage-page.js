// Usage page (#/usage): how much plan is left, and which projects used the most.
// Loaded by index.html (js/ folder). Uses its helpers: api, esc, ago, $, state, render, fmtTok.
// Charts are hand-written SVG; colours come from CSS variables below (light + dark, checked with the
// dataviz palette validator). Status colours always come with an icon and a label.

/* ---------- state and styles ---------- */
const uz = {
  data: null, fetchedAt: 0, range: '7', table: { line: false, bars: false },
  hover: {}, // chart id -> { n, show(i) } set while rendering
};

(function addStyle() {
  const s = document.createElement('style');
  s.textContent = `
  .uz { --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300; --s-other: #898781;
        --good: #0ca30c; --warning: #fab219; --critical: #d03b3b; --grid: var(--line); }
  @media (prefers-color-scheme: dark) { :root:not([data-theme=light]) .uz { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; } }
  :root[data-theme=dark] .uz { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; }
  .uz { max-width: 1000px; margin: 0 auto; }
  .uz h2 { font-size: 18px; margin: 0 0 2px; }
  .uz .uz-explain { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
  .uz-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 14px; }
  .uz-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow); margin-bottom: 14px; }
  .uz-tiles .uz-card { margin-bottom: 0; }
  .uz-tile-h { font-size: 15px; font-weight: 600; }
  .uz-tile-h span { font-weight: 400; color: var(--muted); font-size: 13px; }
  .uz-hero { font-size: 56px; line-height: 1.1; font-weight: 700; margin: 6px 0 4px; }
  .uz-hero small { font-size: 20px; font-weight: 500; color: var(--muted); margin-left: 6px; }
  .uz-hero.word { font-size: 34px; }
  .uz-meter { height: 14px; border-radius: 99px; background: var(--col); overflow: hidden; margin: 6px 0 10px; }
  .uz-meter span { display: block; height: 100%; border-radius: 99px; min-width: 6px; }
  .uz-status { display: inline-block; font-weight: 600; font-size: 14px; padding: 2px 10px; border-radius: 99px; border: 2px solid var(--c); margin-bottom: 8px; }
  .uz-big { font-size: 15px; }
  .uz-sub { color: var(--muted); font-size: 13px; }
  .uz-note { color: var(--muted); font-size: 12px; margin: 0 0 14px; }
  .uz-setup { border: 2px solid var(--accent); }
  .uz-setup h3 { margin: 0 0 8px; font-size: 17px; }
  .uz-snip { background: var(--col); padding: 10px 12px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
  .uz-empty { text-align: center; padding: 28px 16px; }
  .uz-check { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 12px; }
  .uz-empty b { display: block; font-size: 17px; margin-bottom: 4px; }
  .uz-bar-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; margin-bottom: 4px; }
  .uz-bar-head h2 { flex: 1; min-width: 200px; }
  .uz-ranges { display: flex; gap: 6px; flex-wrap: wrap; }
  .uz-ranges button, .uz-toggle { font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 99px; border: 1px solid var(--line); background: var(--col); color: var(--text); cursor: pointer; }
  .uz-ranges button[aria-pressed=true] { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .uz-chart { position: relative; margin: 6px 0; }
  .uz-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
  .uz-chart svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .uz-chart text { fill: var(--muted); font-size: 11px; font-family: inherit; }
  .uz-tip { position: absolute; pointer-events: none; z-index: 3; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.2); padding: 8px 10px; font-size: 12px; min-width: 150px; max-width: 240px; display: none; }
  .uz-tip .t { color: var(--muted); margin-bottom: 4px; }
  .uz-tip .r { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
  .uz-tip .r i { width: 12px; height: 0; border-top: 3px solid var(--c); flex: none; border-radius: 2px; }
  .uz-tip .r b { margin-left: auto; padding-left: 10px; font-size: 13px; }
  .uz-burn-svg { margin: 2px 0; }
  .uz-burn-svg svg { display: block; width: 100%; height: auto; }
  .uz-burn-svg text { fill: var(--muted); font-size: 11px; font-family: inherit; }
  .uz-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; margin: 8px 0 6px; }
  .uz-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .uz-legend i { width: 12px; height: 12px; border-radius: 3px; background: var(--c); flex: none; }
  .uz-legend i.ln { height: 3px; border-radius: 2px; width: 16px; }
  .uz-legend em { font-style: normal; color: var(--muted); }
  .uz-head { font-size: 15px; font-weight: 600; margin: 4px 0 2px; }
  .uz-tablewrap { max-height: 300px; overflow: auto; margin: 8px 0; border: 1px solid var(--line); border-radius: 8px; }
  .uz table { border-collapse: collapse; width: 100%; font-size: 12px; font-variant-numeric: tabular-nums; }
  .uz th, .uz td { padding: 5px 8px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .uz th:first-child, .uz td:first-child { text-align: left; }
  .uz th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; }
  .uz-rank { display: grid; grid-template-columns: minmax(80px, 1.2fr) 3fr; gap: 6px 12px; align-items: center; }
  .uz-rank .nm { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uz-rank .nums { color: var(--muted); font-size: 12px; }
  .uz-rank .nums b { color: var(--text); font-size: 14px; }
  .uz-rank .track { height: 8px; border-radius: 99px; background: var(--col); overflow: hidden; margin-top: 3px; }
  .uz-rank .track span { display: block; height: 100%; background: var(--c); border-radius: 99px; }
  .uz-viewtog { display: flex; gap: 6px; margin: 0 0 12px; }
  .uz-compact { font-family: ui-monospace, Consolas, 'Courier New', monospace; font-size: 14px; line-height: 1.7; margin: 0 0 6px; padding: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); white-space: pre; overflow-x: auto; max-width: 100%; }
  @media (max-width: 520px) { .uz-hero { font-size: 48px; } .uz-rank { grid-template-columns: 1fr; } .uz-compact { font-size: 12px; padding: 10px; } }
  `;
  document.head.appendChild(s);
})();

/* ---------- data ---------- */
async function loadUsagePage(force) {
  if (!force && uz.data && Date.now() - uz.fetchedAt < 15e3) return;
  const [usage, limits, projects, live] = await Promise.all([
    api('GET', '/api/usage').catch(() => ({ enabled: false })),
    api('GET', '/api/limits?days=30').catch(() => ({ latest: null, history: [] })),
    api('GET', '/api/projects?all=1').catch(() => []),
    api('GET', '/api/limits/latest').catch(() => ({ latest: null })),   // AIG-431: the compact view
  ]);
  const check = await api('GET', '/api/usage/check').catch(() => null);
  const runs = await api('GET', '/api/usage/runs').catch(() => []);   // AIG-266
  uz.data = { usage, limits, check, runs, live, projects: projects.map(p => ({ slug: p.slug, name: p.name })) };
  uz.fetchedAt = Date.now();
}
const uzSig = () => JSON.stringify([uz.data, Math.floor(Date.now() / 60e3)]); // minute tick keeps "resets in" fresh

// resets: epoch seconds, epoch ms, numeric string or ISO string -> ms (or null)
function uzTime(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!isNaN(n)) return n < 1e12 ? n * 1000 : n;
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}
const uzHM = ms => { const m = Math.max(0, Math.round(ms / 60e3)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  const u = k => t('usage.unit.' + k);   // d / h / m in your language (AIG-174)
  return d ? `${d}${u('d')} ${h}${u('h')}` : h ? `${h}${u('h')} ${m % 60}${u('m')}` : `${m % 60}${u('m')}`; };
const uzDay = t => new Date(t).toLocaleDateString(i18n.locale, { weekday: 'short' }) + ' ' + new Date(t).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit', hour12: false });
const uzShort = n => { const f = (v, u) => (v >= 100 ? Math.round(v) : +v.toFixed(1)) + u;
  return n >= 1e9 ? f(n / 1e9, 'B') : n >= 1e6 ? f(n / 1e6, 'M') : n >= 1e3 ? f(n / 1e3, 'k') : String(Math.round(n)); };
const uzDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const uzDateLabel = s => uzDate(s).toLocaleDateString(i18n.locale, { month: 'short', day: 'numeric' });

/* ---------- page ---------- */
function renderUsagePage() {
  if (!uz.data) return `<p class="muted">${esc(t('common.loading'))}</p>`;
  const view = uzView();
  const toggle = `<div class="uz-viewtog" role="group">${[['compact', 'usage.view.compact'], ['full', 'usage.view.full']].map(([v, k]) =>
    `<button class="${view === v ? 'primary' : ''}" aria-pressed="${view === v}" onclick="uzSetView('${v}')">${esc(t(k))}</button>`).join('')}</div>`;
  if (view === 'compact') return `<div class="uz"><h2>${esc(t('usage.h'))}</h2>${toggle}${uzCompact(uz.data.live && uz.data.live.latest, uz.data.limits.history || [])}</div>`;
  const { usage, limits } = uz.data;
  const hist = limits.history || [];
  const width = Math.max(260, Math.min(960, ($('app').clientWidth || 360) - 40 - 30));
  const noReading = !hist.length;
  const tiles = noReading
    ? uzSetup(limits.setup)
    : `<div class="uz-tiles">${uzTile(t('usage.session'), t('usage.session.sub'), limits.latest, 'h5', hist)}${uzTile(t('usage.week'), t('usage.week.sub'), limits.latest, 'wk', hist)}</div>
       <p class="uz-note">${esc(t('usage.note'))}</p>`;
  return `<div class="uz"><h2>${esc(t('usage.h'))}</h2>${toggle}<p class="uz-explain">${esc(t('usage.explain'))}</p>
    ${uzCheckBar(limits.latest, uz.data.check)}${tiles}${noReading ? '' : uzBurn(limits) + uzLineCard(hist, width)}${usage.enabled ? uzProjects(usage, uz.data.projects, width) : uzNoLogs()}${uzRuns(uz.data.runs, uz.data.projects)}</div>`;
}

/* ---------- compact view (AIG-431) ---------- */
// Full or compact, remembered per browser. Default: full (today's page).
const UZ_VIEW_KEY = 'aigile.usageView';
function uzView() { try { return localStorage.getItem(UZ_VIEW_KEY) === 'compact' ? 'compact' : 'full'; } catch { return 'full'; } }
async function uzSetView(v) { try { localStorage.setItem(UZ_VIEW_KEY, v); } catch {} await loadUsagePage(true); render(); }
// 8 cells, filled by % used: 48% -> [XXXX....]
const uzBar = pct => { const n = Math.max(0, Math.min(8, Math.round(pct / 12.5))); return '[' + 'X'.repeat(n) + '.'.repeat(8 - n) + ']'; };
// Two monospace lines, as in Mike's status line: "5h window:  0% [........] resets in 3h 33m".
function uzCompact(latest, hist) {
  const now = Date.now();
  const snapFor = key => latest && latest[key] ? latest : [...hist].reverse().find(s => s[key]) || null;
  const rows = [['h5', 'usage.compact.h5'], ['wk', 'usage.compact.wk']].map(([key, lbl]) => {
    const snap = snapFor(key);
    return { key, label: t(lbl) + ':', snap, w: snap && snap[key] };
  });
  const lw = Math.max(...rows.map(r => r.label.length));
  const lines = rows.map(r => {
    if (!r.w) return r.label.padEnd(lw) + ' ' + t('usage.noreading');
    const resets = uzTime(r.w.resets);
    const tail = !resets ? t('usage.resetunknown') : resets < now ? t('usage.compact.rolled') : t('usage.resetsin', { in: uzHM(resets - now) });
    return r.label.padEnd(lw) + ' ' + (Math.round(r.w.pct) + '%').padStart(3) + ' ' + uzBar(r.w.pct) + ' ' + tail;
  });
  const at = latest && latest.at || (hist.length ? hist[hist.length - 1].at : null);
  const last = at ? t('usage.compact.last', { n: Math.max(0, Math.floor((now - Date.parse(at)) / 60e3)) }) : t('usage.noreading');
  return `<pre class="uz-compact">${esc(lines.join('\n'))}</pre><p class="uz-sub">${esc(last)}</p>`;
}

// Check usage now (AIG-151): when the last reading is from, a button that fetches a fresh one, and the auto switch.
function uzCheckBar(latest, check) {
  if (!check || check.mode === 'off') return '';
  const at = latest && latest.at;
  return `<div class="uz-check"><span class="uz-sub">${esc(at ? t('usage.check.last', { when: ago(at) }) : t('usage.check.never'))}</span>
    <button id="uzCheck" onclick="uzCheckNow(this)" title="${esc(t('usage.check.title'))}">${esc(t('usage.check.btn'))}</button>
    <label class="uz-sub" title="${esc(t('usage.check.auto.title'))}"><input type="checkbox" ${check.auto ? 'checked' : ''} onchange="api('POST', '/api/usage/auto', { on: this.checked })"> ${esc(t('usage.check.auto'))}</label>
    <span class="uz-sub" id="uzCheckMsg"></span></div>`;
}
async function uzCheckNow(btn) {
  btn.disabled = true; const was = btn.textContent; btn.textContent = t('usage.check.busy');
  try {
    const r = await api('POST', '/api/usage/check');
    $('uzCheckMsg').textContent = r.ok ? '' : r.reason;
    await loadUsagePage(true); render();
  } catch (e) { const m = $('uzCheckMsg'); if (m) m.textContent = e.message; }
  const b = $('uzCheck'); if (b) { b.disabled = false; b.textContent = was; }
}

// No plan reading yet: explain the two limits and show the one-time setup (file + lines come from the server's local settings).
function uzSetup(setup) {
  const lines = setup ? setup.snippet : '';
  if (setup && setup.installed) return `<div class="uz-card uz-setup">
    <h3>${esc(t('usage.on.h'))}</h3>
    <p>${t('usage.on.p1.html')}</p>
    <p>${t('usage.on.p2.html')}</p>
  </div>`;
  return `<div class="uz-card uz-setup">
    <h3>${esc(t('usage.off.h'))}</h3>
    <p>${t('usage.off.p1.html')}</p>
    ${setup ? `<p>${t('usage.off.step.html', { file: esc(setup.file) })}</p>
    <pre class="uz-snip">${esc(lines)}</pre>
    <button class="primary" onclick="navigator.clipboard.writeText(${esc(JSON.stringify(lines))}).then(() => this.textContent = ${esc(JSON.stringify(t('usage.copied')))})">${esc(t('usage.copy'))}</button>
    <p class="muted">${t('usage.off.chat.html')}</p>
    <p class="muted">${esc(t('usage.off.fill'))}</p>` : `<p class="muted">${esc(t('usage.off.ask'))}</p>`}
  </div>`;
}

function uzStatus(left) {
  return left >= 50 ? { icon: '✅', label: t('usage.status.plenty'), c: 'var(--good)' }
    : left >= 20 ? { icon: '⚠️', label: t('usage.status.low'), c: 'var(--warning)' }
    : { icon: '⛔', label: t('usage.status.out'), c: 'var(--critical)' };
}

function uzTile(title, sub, latest, key, hist) {
  const head = `<div class="uz-tile-h">${title} <span>(${sub})</span></div>`;
  // Use the newest reading that has this window (a reading can hold only one of the two).
  const snap = latest && latest[key] ? latest : [...hist].reverse().find(s => s[key]);
  if (!snap) return `<div class="uz-card">${head}<div class="uz-hero word">${esc(t('usage.noreading'))}</div><div class="uz-sub">${esc(t('usage.nothing'))}</div></div>`;
  const w = snap[key], at = Date.parse(snap.at), resets = uzTime(w.resets), now = Date.now();
  const read = t('usage.lastreading', { when: ago(snap.at) });
  // Only terminal sessions report the plan figure: VS Code and background runs never do (AIG-113).
  const where = t('usage.where.html');
  const stale = now - at > 3600e3;
  if (resets && resets < now) // the window has rolled over since we last heard: the old figure is out of date
    return `<div class="uz-card">${head}<div class="uz-hero word">${esc(t('usage.nolive'))}</div><div class="uz-big">${esc(t('usage.hasreset'))}</div><div class="uz-sub">${esc(read)}. ${where}</div></div>`;
  const left = Math.max(0, Math.min(100, Math.round(100 - w.pct))), st = uzStatus(left);
  const resetTxt = !resets ? '' : resets - now < 24 * 3600e3 ? t('usage.resetsin', { in: uzHM(resets - now) }) : t('usage.resetson', { day: uzDay(resets), in: uzHM(resets - now) });
  return `<div class="uz-card">${head}
    <div class="uz-hero">${left}<small>${esc(t('usage.pctleft'))}</small></div>
    <div class="uz-meter" role="meter" aria-label="${esc(t('usage.meter', { title, left }))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${left}"><span style="width:${left}%;background:${st.c}"></span></div>
    <div class="uz-status" style="--c:${st.c}">${st.icon} ${st.label}</div>
    <div class="uz-big">${esc(resetTxt || t('usage.resetunknown'))}</div><div class="uz-sub">${esc(read)}${stale ? '. ' + esc(t('usage.stale')) + ' ' + where : ''}</div></div>`;
}

/* ---------- burn-down (AIG-466) ---------- */
// Per window: the used-so-far line, a dashed forecast, the reset, and one plain line. Small inline SVG; the numbers come from
// lib/forecast.js (limits.forecast). Nothing is drawn for a window with no reading or one that has reset.
function uzBurn(limits) {
  const hist = limits.history || [], fc = limits.forecast || {};
  const card = ([k, title, span]) => {
    const f = fc[k]; if (!f || f.over || !f.resets) return '';
    const t0 = f.resets - span, W = 300, H = 110, L = 28, R = 8, T = 8, B = 16, iw = W - L - R, ih = H - T - B;
    const x = ms => L + Math.max(0, Math.min(1, (ms - t0) / span)) * iw, y = p => T + (1 - Math.min(100, p) / 100) * ih;
    const pts = hist.filter(s => s[k] && uzTime(s[k].resets) === f.resets).map(s => `${x(Date.parse(s.at)).toFixed(1)},${y(s[k].pct).toFixed(1)}`).join(' ');
    const endT = f.rate > 0 ? (f.beforeReset ? f.runOut : f.resets) : f.resets, endP = f.rate > 0 ? (f.beforeReset ? 100 : f.atReset) : f.pct;
    const line = !f.rate && f.at - f.since < 600e3 ? t('usage.burn.few') : f.beforeReset ? t('usage.burn.runs', { when: uzDay(f.runOut) }) : t('usage.burn.lasts');
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title + ': ' + line)}">
      <line x1="${L}" x2="${W - R}" y1="${y(100)}" y2="${y(100)}" stroke="var(--grid)" stroke-dasharray="4 4"/><line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--grid)"/>
      <text x="${L - 4}" y="${y(100) + 4}" text-anchor="end">100</text><text x="${L - 4}" y="${y(0) + 4}" text-anchor="end">0</text>
      <line x1="${W - R}" x2="${W - R}" y1="${T}" y2="${T + ih}" stroke="var(--muted)"/><text x="${W - R}" y="${H - 2}" text-anchor="end">${esc(t('usage.burn.reset'))}</text>
      ${pts ? `<polyline points="${pts}" fill="none" stroke="var(--s1)" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
      <line class="uz-fc" x1="${x(f.at)}" y1="${y(f.pct)}" x2="${x(endT)}" y2="${y(endP)}" stroke="var(--s2)" stroke-width="2.5" stroke-dasharray="5 4"/></svg>`;
    return `<div class="uz-card uz-burn"><div class="uz-tile-h">${esc(title)}</div><div class="uz-burn-svg">${svg}</div>
      <div class="uz-legend"><span><i class="ln" style="--c:var(--s1)"></i>${esc(t('usage.burn.used'))}</span><span><i class="ln" style="--c:var(--s2)"></i>${esc(t('usage.burn.forecast'))}</span></div>
      <div class="uz-big uz-burn-line" data-key="${k}">${esc(line)}</div></div>`;
  };
  const html = [['h5', t('usage.session'), 5 * 3600e3], ['wk', t('usage.week'), 7 * 864e5]].map(card).join('');
  return html ? `<div class="uz-tiles">${html}</div>` : '';
}

/* ---------- tooltip plumbing ---------- */
// Each chart registers show(i) / hide; pointer and arrow keys both drive it.
function uzTip(chart, html, x, y) {
  const tip = chart.querySelector('.uz-tip');
  tip.replaceChildren(...html);
  tip.style.display = 'block';
  const w = tip.offsetWidth, cw = chart.clientWidth;
  tip.style.left = Math.max(0, x + 14 + w > cw ? x - 14 - w : x + 14) + 'px';
  tip.style.top = Math.max(0, y) + 'px';
}
const uzEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function uzRow(color, name, value, line) {
  const r = uzEl('div', 'r'); r.style.setProperty('--c', color);
  if (line) r.append(uzEl('i')); r.append(uzEl('span', null, name), uzEl('b', null, value));
  return r;
}
document.addEventListener('pointermove', e => {
  const c = e.target.closest?.('.uz-chart');
  document.querySelectorAll('.uz-chart').forEach(o => { if (o !== c) uzHide(o); });
  const h = c && uz.hover[c.id]; if (!h) return;
  const r = c.querySelector('svg').getBoundingClientRect();
  h.show(h.pick((e.clientX - r.left) * h.w / r.width), c);
});
document.addEventListener('pointerleave', () => document.querySelectorAll('.uz-chart').forEach(uzHide), true);
function uzHide(c) { c.querySelector('.uz-tip').style.display = 'none'; c.querySelectorAll('.uz-hv').forEach(x => x.setAttribute('visibility', 'hidden')); }
document.addEventListener('keydown', e => {
  const c = e.target.closest?.('.uz-chart'); const h = c && uz.hover[c.id];
  if (!h || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault(); h.i = Math.max(0, Math.min(h.n - 1, (h.i ?? h.n) + (e.key === 'ArrowLeft' ? -1 : 1))); h.show(h.i, c);
});
document.addEventListener('focusout', e => { const c = e.target.closest?.('.uz-chart'); if (c) uzHide(c); });

/* ---------- line chart: % of limit used ---------- */
const UZ_KEYS = [['h5', 'usage.key.h5', 'var(--s1)'], ['wk', 'usage.key.wk', 'var(--s2)']];
function uzLineCard(hist, W) {
  const hours = { 24: 24, 7: 168, 30: 720 }[uz.range] || 168, now = Date.now(), t0 = now - hours * 3600e3;
  const snaps = hist.filter(s => Date.parse(s.at) >= t0);
  const H = 250, L = 38, R = 12, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
  const x = t => L + (t - t0) / (now - t0) * iw, y = p => T + (1 - p / 100) * ih;
  let g = [0, 25, 50, 75, 100].map(p => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="var(--grid)" ${p === 100 ? 'stroke-dasharray="4 4"' : ''}/><text x="${L - 6}" y="${y(p) + 4}" text-anchor="end">${p}%</text>`).join('');
  g += `<text x="${W - R}" y="${y(100) - 4}" text-anchor="end">${esc(t('usage.limit'))}</text>`;
  // x ticks at local midnights (7/30 days) or every 6 hours (24h), thinned so labels never touch
  const ticks = []; const d = new Date(t0);
  if (hours <= 24) { d.setMinutes(0, 0, 0); d.setHours(Math.ceil(d.getHours() / 6) * 6); for (let t = +d; t <= now; t += 6 * 3600e3) ticks.push(t); }
  else { d.setHours(24, 0, 0, 0); for (let t = new Date(d); +t <= now; t.setDate(t.getDate() + 1)) ticks.push(+t); }
  const maxLabels = Math.max(2, Math.floor(iw / 62)), step = Math.ceil(ticks.length / maxLabels);
  ticks.forEach((t, i) => { if (i % step) return;
    const lab = hours <= 24 ? new Date(t).toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date(t).toLocaleDateString(i18n.locale, { month: 'short', day: 'numeric' });
    g += `<line x1="${x(t)}" x2="${x(t)}" y1="${T + ih}" y2="${T + ih + 4}" stroke="var(--muted)"/><text x="${x(t)}" y="${H - 8}" text-anchor="middle">${lab}</text>`; });
  let marks = '';
  for (const [k, , col] of UZ_KEYS) {
    const pts = snaps.filter(s => s[k]).map(s => [x(Date.parse(s.at)), y(Math.min(100, s[k].pct))]);
    if (!pts.length) continue;
    marks += `<path d="M${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts[pts.length - 1]; marks += `<circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="${col}" stroke="var(--panel)" stroke-width="2"/>`;
  }
  const id = 'uz-line';
  // hover: snap to the nearest reading; a reading may hold only one window, so fall back to the last known value
  uz.hover[id] = { n: snaps.length, w: W,
    pick: px => { let b = 0, bd = 1e18; snaps.forEach((s, i) => { const dd = Math.abs(x(Date.parse(s.at)) - px); if (dd < bd) { bd = dd; b = i; } }); return b; },
    show(i, c) { const s = snaps[i]; if (!s) return;
      const sx = x(Date.parse(s.at)), vals = UZ_KEYS.map(([k, name, col]) => [t(name), col, s[k]]).filter(v => v[2]);
      c.querySelector('.uz-cross').setAttribute('x1', sx); c.querySelector('.uz-cross').setAttribute('x2', sx);
      c.querySelectorAll('.uz-hv').forEach(e => e.setAttribute('visibility', 'visible'));
      c.querySelectorAll('.uz-dot').forEach((e, j) => { const v = UZ_KEYS.map(([k]) => s[k]); const q = v[j]; e.setAttribute('visibility', q ? 'visible' : 'hidden'); if (q) { e.setAttribute('cx', sx); e.setAttribute('cy', y(Math.min(100, q.pct))); } });
      uzTip(c, [uzEl('div', 't', uzDay(Date.parse(s.at))), ...vals.map(v => uzRow(v[1], v[0], t('usage.tip.used', { pct: Math.round(v[2].pct) }), true))], sx, T);
      uz.hover[id].i = i; } };
  const empty = !snaps.length ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" style="font-size:13px">${esc(t('usage.noreadings.range'))}</text>` : '';
  const chart = `<div class="uz-chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${esc(t('usage.line.aria'))}">
    ${g}${empty}${marks}<line class="uz-cross uz-hv" y1="${T}" y2="${T + ih}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/>
    ${UZ_KEYS.map(([, , col]) => `<circle class="uz-dot uz-hv" r="4.5" fill="${col}" stroke="var(--panel)" stroke-width="2" visibility="hidden"/>`).join('')}</svg><div class="uz-tip"></div></div>`;
  const rows = [...snaps].reverse().slice(0, 200).map(s => `<tr><td>${esc(uzDay(Date.parse(s.at)))}</td><td>${s.h5 ? Math.round(s.h5.pct) + '%' : '–'}</td><td>${s.wk ? Math.round(s.wk.pct) + '%' : '–'}</td></tr>`).join('');
  const table = `<div class="uz-tablewrap"><table><thead><tr><th>${esc(t('usage.th.when'))}</th><th>${esc(t('usage.th.session'))}</th><th>${esc(t('usage.th.week'))}</th></tr></thead><tbody>${rows || `<tr><td colspan="3">${esc(t('usage.noreadings'))}</td></tr>`}</tbody></table></div>`;
  const legend = `<div class="uz-legend">${UZ_KEYS.map(([k, name, col]) => `<span style="--c:${col}"><i class="ln"></i>${esc(t(name))}</span>`).join('')}</div>`;
  return `<div class="uz-card"><div class="uz-bar-head"><h2>${esc(t('usage.line.h'))}</h2>
    <div class="uz-ranges" role="group" aria-label="${esc(t('usage.range'))}">${[['24', 'usage.r24'], ['7', 'usage.r7'], ['30', 'usage.r30']].map(([v, l]) => `<button aria-pressed="${uz.range === v}" onclick="uzSet('range','${v}')">${esc(t(l))}</button>`).join('')}</div></div>
    <p class="uz-explain">${esc(t('usage.line.explain'))}</p>
    ${uz.table.line ? table : chart}${legend}
    <button class="uz-toggle" onclick="uzToggle('line')">${esc(uz.table.line ? t('usage.showchart') : t('usage.showtable'))}</button></div>`;
}

/* ---------- stacked bars: which projects used the most ---------- */
function uzProjects(u, projects, W) {
  const names = Object.fromEntries(projects.map(p => [p.slug, p.name]));
  // fixed colour per project (alphabetical order of slugs, so it never changes when others come and go)
  const slugs = Object.keys(u.daily.projects).sort();
  const series = slugs.slice(0, 6).map((slug, i) => ({ key: slug, name: names[slug] || slug, col: `var(--s${i + 1})`, days: u.daily.projects[slug] }));
  const otherDays = u.daily.other.map((d, i) => ({ date: d.date, tokens: d.tokens + slugs.slice(6).reduce((a, s) => a + u.daily.projects[s][i].tokens, 0) }));
  series.push({ key: 'other', name: t('usage.other'), col: 'var(--s-other)', days: otherDays });
  const dates = u.daily.org.map(d => d.date);
  series.forEach(s => { s.total = s.days.reduce((a, d) => a + d.tokens, 0); });
  const grand = series.reduce((a, s) => a + s.total, 0);
  const shown = series.filter(s => s.total > 0 || s.key !== 'other');
  const top = [...series].filter(s => s.key !== 'other').sort((a, b) => b.total - a.total)[0];
  const headline = grand && top && top.total
    ? t('usage.headline.html', { name: esc(top.name), pct: Math.round(top.total / grand * 100) }) : esc(t('usage.headline.none'));

  const H = 240, L = 40, R = 8, T = 10, B = 28, iw = W - L - R, ih = H - T - B, n = dates.length, step = iw / n, bw = Math.max(4, step - 3);
  const totals = dates.map((_, i) => series.reduce((a, s) => a + s.days[i].tokens, 0)), max = Math.max(...totals, 1);
  const rough = max / 4, mag = Math.pow(10, Math.floor(Math.log10(rough))), nice = [1, 2, 5, 10].find(m => m * mag >= rough) * mag;
  const yMax = Math.ceil(max / nice) * nice, y = v => T + (1 - v / yMax) * ih;
  let g = '';
  for (let v = 0; v <= yMax + 1; v += nice) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${uzShort(v)}</text>`;
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 58)));
  dates.forEach((dt, i) => { if ((n - 1 - i) % every === 0) g += `<text x="${L + step * i + step / 2}" y="${H - 8}" text-anchor="middle">${uzDateLabel(dt)}</text>`; });
  let bars = '';
  dates.forEach((dt, i) => {
    let acc = 0; const live = shown.filter(s => s.days[i].tokens > 0);
    live.forEach((s, j) => {
      const v = s.days[i].tokens, y1 = y(acc), y0 = y(acc + v), x0 = L + step * i + (step - bw) / 2, h = y1 - y0, gap = j ? 2 : 0; acc += v;
      const hh = Math.max(1, h - gap), top = j === live.length - 1, r = top ? Math.min(4, bw / 2, hh) : 0;
      bars += `<path d="M${x0},${y1} V${y0 + r} ${r ? `Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}` : `H${x0 + bw}`} V${y1} Z" fill="${s.col}" ${gap ? `stroke="var(--panel)" stroke-width="2" paint-order="stroke"` : ''}/>`;
    });
  });
  const id = 'uz-bars';
  uz.hover[id] = { n, w: W, pick: px => Math.max(0, Math.min(n - 1, Math.floor((px - L) / step))),
    show(i, c) { const sx = L + step * i + step / 2;
      const hb = c.querySelector('.uz-band'); hb.setAttribute('x', L + step * i); hb.setAttribute('visibility', 'visible');
      const rows = shown.filter(s => s.days[i].tokens > 0).reverse().map(s => uzRow(s.col, s.name, uzShort(s.days[i].tokens)));
      uzTip(c, [uzEl('div', 't', t('usage.tip.total', { day: uzDateLabel(dates[i]), n: uzShort(totals[i]) })), ...(rows.length ? rows : [uzEl('div', 't', t('usage.tip.none'))])], sx, T);
      uz.hover[id].i = i; } };
  const chart = `<div class="uz-chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${esc(t('usage.bars.aria'))}">
    ${g}<rect class="uz-band uz-hv" y="${T}" width="${step}" height="${ih}" fill="var(--muted)" opacity=".15" visibility="hidden"/>${bars}</svg><div class="uz-tip"></div></div>`;
  const legend = `<div class="uz-legend">${shown.map(s => `<span style="--c:${s.col}"><i></i>${esc(s.name)} <em>${uzShort(s.total)}</em></span>`).join('')}</div>`;
  const rows = [...dates.keys()].reverse().map(i => `<tr><td>${esc(uzDateLabel(dates[i]))}</td>${shown.map(s => `<td>${uzShort(s.days[i].tokens)}</td>`).join('')}<td><b>${uzShort(totals[i])}</b></td></tr>`).join('');
  const table = `<div class="uz-tablewrap"><table><thead><tr><th>${esc(t('usage.th.day'))}</th>${shown.map(s => `<th>${esc(s.name)}</th>`).join('')}<th>${esc(t('usage.th.total'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  // ranked list: today and the last 7 days, per project
  const rank = [...slugs.map(s => ({ name: names[s] || s, col: slugs.indexOf(s) < 6 ? `var(--s${slugs.indexOf(s) + 1})` : 'var(--s-other)', t: u.projects[s] })), { name: t('usage.other'), col: 'var(--s-other)', t: u.other }]
    .filter(r => r.t && (r.t.d7 || r.t.today)).sort((a, b) => b.t.d7 - a.t.d7);
  const m7 = Math.max(...rank.map(r => r.t.d7), 1);
  const ranked = rank.length ? `<div class="uz-card"><h2>${esc(t('usage.rank.h'))}</h2><p class="uz-explain">${esc(t('usage.rank.explain'))}</p>
    <div class="uz-rank">${rank.map(r => `<div class="nm">${esc(r.name)}</div><div><div class="nums">${t('usage.rank.nums.html', { today: uzShort(r.t.today), d7: uzShort(r.t.d7) })}</div><div class="track" style="--c:${r.col}"><span style="width:${Math.max(2, r.t.d7 / m7 * 100)}%"></span></div></div>`).join('')}</div></div>` : '';
  return `<div class="uz-card"><h2>${esc(t('usage.bars.h'))}</h2><div class="uz-head">${headline}</div>
    <p class="uz-explain">${esc(t('usage.bars.explain'))}</p>
    ${uz.table.bars ? table : chart}${legend}
    <button class="uz-toggle" onclick="uzToggle('bars')">${esc(uz.table.bars ? t('usage.showchart') : t('usage.showtable'))}</button></div>${ranked}`;
}

// What the biggest background runs of the last 24 hours cost (AIG-266).
function uzRuns(runs, projects) {
  if (!runs || !runs.length) return '';
  const name = s => (projects.find(p => p.slug === s) || {}).name || s;
  // AIG-522 #10: runs that are not a team's carry a kind (Scrum Master, tester, ask, pack); a lead row is that project's VS Code sessions.
  const who = r => !r.kind || r.kind === 'team' ? name(r.slug) : r.kind === 'lead' ? `${t('usage.kind.lead')}: ${name(r.slug)}` : t('usage.kind.' + r.kind);
  const sum = k => runs.reduce((n, r) => n + (r[k] || 0), 0);
  const total = t('usage.runs.total', { n: runs.length, in: uzShort(sum('in')), out: uzShort(sum('out')), cache: uzShort(sum('cache')) });
  const rows = runs.map(r => `<tr data-kind="${esc(r.kind || 'team')}"><td>${esc(who(r))}</td><td>${esc(uzDay(r.end))}</td><td>${uzShort(r.in)}</td><td>${uzShort(r.out)}</td><td>${uzShort(r.cache)}</td><td>${esc((r.cards || []).join(', '))}</td><td>${esc((r.models || []).join(', '))}</td><td>${r.reads == null ? '' : `${r.reads} / ${uzShort(r.readChars || 0)}`}</td></tr>`).join('');
  return `<div class="uz-card"><h2>${esc(t('usage.runs.h'))}</h2><p class="uz-explain">${esc(t('usage.runs.explain'))}</p><p class="uz-explain uz-runtotal">${esc(total)}</p>
    <div class="uz-tablewrap"><table><thead><tr><th>${esc(t('usage.runs.team'))}</th><th>${esc(t('usage.runs.ended'))}</th><th>${esc(t('usage.runs.in'))}</th><th>${esc(t('usage.runs.out'))}</th><th>${esc(t('usage.runs.cache'))}</th><th>${esc(t('usage.runs.cards'))}</th><th>${esc(t('usage.runs.models'))}</th><th>${esc(t('usage.runs.reads'))}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
const uzNoLogs = () => `<div class="uz-card uz-empty"><b>${esc(t('usage.nologs.h'))}</b><span class="muted">${esc(t('usage.nologs'))}</span></div>`;

function uzSet(k, v) { uz[k] = v; render(); }
function uzToggle(k) { uz.table[k] = !uz.table[k]; render(); }
let uzResize;
window.addEventListener('resize', () => { clearTimeout(uzResize); uzResize = setTimeout(() => { if (state.route?.view === 'usage') render(); }, 150); });
