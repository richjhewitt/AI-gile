// Usage page (#/usage): how much plan is left, and which projects used the most.
// Loaded by index.html. Uses its helpers: api, esc, ago, $, state, render, fmtTok.
// Charts are hand-written SVG; colours come from CSS variables below (light + dark, checked with the
// dataviz palette validator). Status colours always come with an icon and a label.

const uz = {
  data: null, fetchedAt: 0, range: '7', table: { line: false, bars: false },
  hover: {}, // chart id -> { n, show(i) } set while rendering
};

(function addStyle() {
  const s = document.createElement('style');
  s.textContent = `
  .uz { --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4; --s6: #008300; --s-other: #898781;
        --good: #0ca30c; --warning: #fab219; --critical: #d03b3b; --grid: var(--line); }
  @media (prefers-color-scheme: dark) { .uz { --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181; --s6: #008300; } }
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
  @media (max-width: 520px) { .uz-hero { font-size: 48px; } .uz-rank { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(s);
})();

// ---- data ------------------------------------------------------------------
async function loadUsagePage(force) {
  if (!force && uz.data && Date.now() - uz.fetchedAt < 15e3) return;
  const [usage, limits, projects] = await Promise.all([
    api('GET', '/api/usage').catch(() => ({ enabled: false })),
    api('GET', '/api/limits?days=30').catch(() => ({ latest: null, history: [] })),
    api('GET', '/api/projects?all=1').catch(() => []),
  ]);
  uz.data = { usage, limits, projects: projects.map(p => ({ slug: p.slug, name: p.name })) };
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
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`; };
const uzDay = t => new Date(t).toLocaleDateString([], { weekday: 'short' }) + ' ' + new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const uzShort = n => { const f = (v, u) => (v >= 100 ? Math.round(v) : +v.toFixed(1)) + u;
  return n >= 1e9 ? f(n / 1e9, 'B') : n >= 1e6 ? f(n / 1e6, 'M') : n >= 1e3 ? f(n / 1e3, 'k') : String(Math.round(n)); };
const uzDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const uzDateLabel = s => uzDate(s).toLocaleDateString([], { month: 'short', day: 'numeric' });

// ---- page ------------------------------------------------------------------
function renderUsagePage() {
  if (!uz.data) return '<p class="muted">Loading…</p>';
  const { usage, limits } = uz.data;
  const hist = limits.history || [];
  const width = Math.max(260, Math.min(960, ($('app').clientWidth || 360) - 40 - 30));
  const noReading = !hist.length;
  const tiles = noReading
    ? uzSetup(limits.setup)
    : `<div class="uz-tiles">${uzTile('This session', '5-hour window', limits.latest, 'h5', hist)}${uzTile('This week', '7-day window', limits.latest, 'wk', hist)}</div>
       <p class="uz-note">Your plan has two limits: one per 5-hour session and one per week. There's no monthly limit. Colours: ✅ plenty = 50% or more left · ⚠️ getting low = 20 to 49% left · ⛔ nearly out = under 20% left.</p>`;
  return `<div class="uz"><h2>⚡ Usage</h2><p class="uz-explain">How much of your plan you have left, and which projects are using it.</p>
    ${tiles}${noReading ? '' : uzLineCard(hist, width)}${usage.enabled ? uzProjects(usage, uz.data.projects, width) : uzNoLogs()}</div>`;
}

// No plan reading yet: explain the two limits and show the one-time setup (file + lines come from the server's local settings).
function uzSetup(setup) {
  const lines = setup ? setup.snippet : '';
  return `<div class="uz-card uz-setup">
    <h3>📏 How much of your plan is left: not switched on yet</h3>
    <p>Your plan has <b>two limits</b>: one per <b>5-hour session</b> and one per <b>week</b>. There's no monthly limit. Once switched on, two big gauges here show <b>% left</b> of each, and when it resets.</p>
    ${setup ? `<p><b>One-time step:</b> open <code>${esc(setup.file)}</code> in Notepad, paste these lines on a new line just after the first <code>{</code>, and save.</p>
    <pre class="uz-snip">${esc(lines)}</pre>
    <button class="primary" onclick="navigator.clipboard.writeText(${esc(JSON.stringify(lines))}).then(() => this.textContent = '✅ Copied')">📋 Copy the lines</button>
    <p class="muted">Or tell the lead in chat: <i>"yes, add the status line to my global settings"</i>.</p>
    <p class="muted">The gauges fill in the next time any agent session runs.</p>` : '<p class="muted">Ask the lead to set this up.</p>'}
  </div>`;
}

function uzStatus(left) {
  return left >= 50 ? { icon: '✅', label: 'Plenty left', c: 'var(--good)' }
    : left >= 20 ? { icon: '⚠️', label: 'Getting low', c: 'var(--warning)' }
    : { icon: '⛔', label: 'Nearly out', c: 'var(--critical)' };
}

function uzTile(title, sub, latest, key, hist) {
  const head = `<div class="uz-tile-h">${title} <span>(${sub})</span></div>`;
  // Use the newest reading that has this window (a reading can hold only one of the two).
  const snap = latest && latest[key] ? latest : [...hist].reverse().find(s => s[key]);
  if (!snap) return `<div class="uz-card">${head}<div class="uz-hero word">No reading</div><div class="uz-sub">Nothing recorded for this window yet.</div></div>`;
  const w = snap[key], at = Date.parse(snap.at), resets = uzTime(w.resets), now = Date.now();
  const read = `last reading ${ago(snap.at)}`;
  if (resets && resets < now) // the window has rolled over since we last heard: the old figure is out of date
    return `<div class="uz-card">${head}<div class="uz-hero word">Reset</div><div class="uz-big">This window has reset since the last reading.</div><div class="uz-sub">${read}. A fresh figure appears with the next agent session.</div></div>`;
  const left = Math.max(0, Math.min(100, Math.round(100 - w.pct))), st = uzStatus(left);
  const resetTxt = !resets ? '' : resets - now < 24 * 3600e3 ? `resets in ${uzHM(resets - now)}` : `resets ${uzDay(resets)} (in ${uzHM(resets - now)})`;
  return `<div class="uz-card">${head}
    <div class="uz-hero">${left}<small>% left</small></div>
    <div class="uz-meter" role="meter" aria-label="${title}: ${left}% left" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${left}"><span style="width:${left}%;background:${st.c}"></span></div>
    <div class="uz-status" style="--c:${st.c}">${st.icon} ${st.label}</div>
    <div class="uz-big">${resetTxt || 'reset time unknown'}</div><div class="uz-sub">${read}</div></div>`;
}

// ---- tooltip plumbing ------------------------------------------------------
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

// ---- line chart: % of limit used ------------------------------------------
const UZ_KEYS = [['h5', 'Session (5-hour)', 'var(--s1)'], ['wk', 'Week (7-day)', 'var(--s2)']];
function uzLineCard(hist, W) {
  const hours = { 24: 24, 7: 168, 30: 720 }[uz.range] || 168, now = Date.now(), t0 = now - hours * 3600e3;
  const snaps = hist.filter(s => Date.parse(s.at) >= t0);
  const H = 250, L = 38, R = 12, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
  const x = t => L + (t - t0) / (now - t0) * iw, y = p => T + (1 - p / 100) * ih;
  let g = [0, 25, 50, 75, 100].map(p => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="var(--grid)" ${p === 100 ? 'stroke-dasharray="4 4"' : ''}/><text x="${L - 6}" y="${y(p) + 4}" text-anchor="end">${p}%</text>`).join('');
  g += `<text x="${W - R}" y="${y(100) - 4}" text-anchor="end">Limit: you're out at 100%</text>`;
  // x ticks at local midnights (7/30 days) or every 6 hours (24h), thinned so labels never touch
  const ticks = []; const d = new Date(t0);
  if (hours <= 24) { d.setMinutes(0, 0, 0); d.setHours(Math.ceil(d.getHours() / 6) * 6); for (let t = +d; t <= now; t += 6 * 3600e3) ticks.push(t); }
  else { d.setHours(24, 0, 0, 0); for (let t = new Date(d); +t <= now; t.setDate(t.getDate() + 1)) ticks.push(+t); }
  const maxLabels = Math.max(2, Math.floor(iw / 62)), step = Math.ceil(ticks.length / maxLabels);
  ticks.forEach((t, i) => { if (i % step) return;
    const lab = hours <= 24 ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
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
      const sx = x(Date.parse(s.at)), vals = UZ_KEYS.map(([k, name, col]) => [name, col, s[k]]).filter(v => v[2]);
      c.querySelector('.uz-cross').setAttribute('x1', sx); c.querySelector('.uz-cross').setAttribute('x2', sx);
      c.querySelectorAll('.uz-hv').forEach(e => e.setAttribute('visibility', 'visible'));
      c.querySelectorAll('.uz-dot').forEach((e, j) => { const v = UZ_KEYS.map(([k]) => s[k]); const q = v[j]; e.setAttribute('visibility', q ? 'visible' : 'hidden'); if (q) { e.setAttribute('cx', sx); e.setAttribute('cy', y(Math.min(100, q.pct))); } });
      uzTip(c, [uzEl('div', 't', uzDay(Date.parse(s.at))), ...vals.map(v => uzRow(v[1], v[0], Math.round(v[2].pct) + '% used', true))], sx, T);
      uz.hover[id].i = i; } };
  const empty = !snaps.length ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" style="font-size:13px">No readings in this time range yet.</text>` : '';
  const chart = `<div class="uz-chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="Line chart: percent of your plan limit used over time, session and week. Use left and right arrow keys to read values.">
    ${g}${empty}${marks}<line class="uz-cross uz-hv" y1="${T}" y2="${T + ih}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/>
    ${UZ_KEYS.map(([, , col]) => `<circle class="uz-dot uz-hv" r="4.5" fill="${col}" stroke="var(--panel)" stroke-width="2" visibility="hidden"/>`).join('')}</svg><div class="uz-tip"></div></div>`;
  const rows = [...snaps].reverse().slice(0, 200).map(s => `<tr><td>${esc(uzDay(Date.parse(s.at)))}</td><td>${s.h5 ? Math.round(s.h5.pct) + '%' : '–'}</td><td>${s.wk ? Math.round(s.wk.pct) + '%' : '–'}</td></tr>`).join('');
  const table = `<div class="uz-tablewrap"><table><thead><tr><th>When</th><th>Session used</th><th>Week used</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No readings in this range.</td></tr>'}</tbody></table></div>`;
  const legend = `<div class="uz-legend">${UZ_KEYS.map(([k, name, col]) => `<span style="--c:${col}"><i class="ln"></i>${name}</span>`).join('')}</div>`;
  return `<div class="uz-card"><div class="uz-bar-head"><h2>% of your limit used over time</h2>
    <div class="uz-ranges" role="group" aria-label="Time range">${[['24', '24 hours'], ['7', '7 days'], ['30', '30 days']].map(([v, l]) => `<button aria-pressed="${uz.range === v}" onclick="uzSet('range','${v}')">${l}</button>`).join('')}</div></div>
    <p class="uz-explain">The higher the line, the more of your plan you have used. At 100% you are out until it resets.</p>
    ${uz.table.line ? table : chart}${legend}
    <button class="uz-toggle" onclick="uzToggle('line')">${uz.table.line ? 'Show chart' : 'Show as table'}</button></div>`;
}

// ---- stacked bars: which projects used the most ---------------------------
function uzProjects(u, projects, W) {
  const names = Object.fromEntries(projects.map(p => [p.slug, p.name]));
  // fixed colour per project (alphabetical order of slugs, so it never changes when others come and go)
  const slugs = Object.keys(u.daily.projects).sort();
  const series = slugs.slice(0, 6).map((slug, i) => ({ key: slug, name: names[slug] || slug, col: `var(--s${i + 1})`, days: u.daily.projects[slug] }));
  const otherDays = u.daily.other.map((d, i) => ({ date: d.date, tokens: d.tokens + slugs.slice(6).reduce((a, s) => a + u.daily.projects[s][i].tokens, 0) }));
  series.push({ key: 'other', name: 'Other (not on the board)', col: 'var(--s-other)', days: otherDays });
  const dates = u.daily.org.map(d => d.date);
  series.forEach(s => { s.total = s.days.reduce((a, d) => a + d.tokens, 0); });
  const grand = series.reduce((a, s) => a + s.total, 0);
  const shown = series.filter(s => s.total > 0 || s.key !== 'other');
  const top = [...series].filter(s => s.key !== 'other').sort((a, b) => b.total - a.total)[0];
  const headline = grand && top && top.total
    ? `${esc(top.name)} used the most: ${Math.round(top.total / grand * 100)}% of the last 30 days.` : 'No agent work recorded in the last 30 days.';

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
      uzTip(c, [uzEl('div', 't', uzDateLabel(dates[i]) + ': ' + uzShort(totals[i]) + ' in total'), ...(rows.length ? rows : [uzEl('div', 't', 'Nothing recorded')])], sx, T);
      uz.hover[id].i = i; } };
  const chart = `<div class="uz-chart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="Stacked bar chart: daily usage over the last 30 days, split by project. Use left and right arrow keys to read each day.">
    ${g}<rect class="uz-band uz-hv" y="${T}" width="${step}" height="${ih}" fill="var(--muted)" opacity=".15" visibility="hidden"/>${bars}</svg><div class="uz-tip"></div></div>`;
  const legend = `<div class="uz-legend">${shown.map(s => `<span style="--c:${s.col}"><i></i>${esc(s.name)} <em>${uzShort(s.total)}</em></span>`).join('')}</div>`;
  const rows = [...dates.keys()].reverse().map(i => `<tr><td>${esc(uzDateLabel(dates[i]))}</td>${shown.map(s => `<td>${uzShort(s.days[i].tokens)}</td>`).join('')}<td><b>${uzShort(totals[i])}</b></td></tr>`).join('');
  const table = `<div class="uz-tablewrap"><table><thead><tr><th>Day</th>${shown.map(s => `<th>${esc(s.name)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  // ranked list: today and the last 7 days, per project
  const rank = [...slugs.map(s => ({ name: names[s] || s, col: slugs.indexOf(s) < 6 ? `var(--s${slugs.indexOf(s) + 1})` : 'var(--s-other)', t: u.projects[s] })), { name: 'Other (not on the board)', col: 'var(--s-other)', t: u.other }]
    .filter(r => r.t && (r.t.d7 || r.t.today)).sort((a, b) => b.t.d7 - a.t.d7);
  const m7 = Math.max(...rank.map(r => r.t.d7), 1);
  const ranked = rank.length ? `<div class="uz-card"><h2>Today and this week, by project</h2><p class="uz-explain">The busiest project is at the top. The bar shows the last 7 days.</p>
    <div class="uz-rank">${rank.map(r => `<div class="nm">${esc(r.name)}</div><div><div class="nums">today <b>${uzShort(r.t.today)}</b> · 7 days <b>${uzShort(r.t.d7)}</b></div><div class="track" style="--c:${r.col}"><span style="width:${Math.max(2, r.t.d7 / m7 * 100)}%"></span></div></div>`).join('')}</div></div>` : '';
  return `<div class="uz-card"><h2>Which projects used the most</h2><div class="uz-head">${headline}</div>
    <p class="uz-explain">Each bar is one day of the last 30. Taller means agents did more work that day. Work is counted in tokens, the small pieces of text agents read and write.</p>
    ${uz.table.bars ? table : chart}${legend}
    <button class="uz-toggle" onclick="uzToggle('bars')">${uz.table.bars ? 'Show chart' : 'Show as table'}</button></div>${ranked}`;
}

const uzNoLogs = () => `<div class="uz-card uz-empty"><b>Project usage isn't set up on this PC</b><span class="muted">Point the board at your agent session logs folder to see which projects use the most.</span></div>`;

function uzSet(k, v) { uz[k] = v; render(); }
function uzToggle(k) { uz.table[k] = !uz.table[k]; render(); }
let uzResize;
window.addEventListener('resize', () => { clearTimeout(uzResize); uzResize = setTimeout(() => { if (state.route?.view === 'usage') render(); }, 150); });
