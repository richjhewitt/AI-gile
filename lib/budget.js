// Token budget and caps (AIG-353): settings in aigile.local.json ("budget": { h5, wk, parallel }, "helpers": { opus, sonnet, haiku },
// "usageChecks": "off"). mayRun() is the one check every wake path asks before it starts an AI run: it refuses when the
// latest plan reading is over the owner's percentage for the 5-hour or weekly limit. Only a fresh reading counts.
const fs = require('fs');
const path = require('path');
const { localSettings, bad, DATA } = require('./store');
const { t: tr } = require('./i18n');

const FRESH_MS = 30 * 60e3;
const int = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
function budget() { const b = localSettings().budget || {}; return { h5: int(b.h5, 90, 1, 100), wk: int(b.wk, 95, 1, 100), parallel: int(b.parallel, 0, 0, 50) }; }
const helpers = () => { const h = localSettings().helpers || {}, o = {}; for (const m of ['opus', 'sonnet', 'haiku']) if (h[m] !== undefined && h[m] !== null && h[m] !== '') o[m] = int(h[m], undefined, 0, 50); return o; };
// null when fine, else the reason a run must not start.
function overBudget() {
  let l; try { l = require('./limits').limitsHistory(1).latest; } catch { return null; }
  if (!l || Date.now() - Date.parse(l.at) > FRESH_MS) return null;
  const b = budget();
  for (const [w, cap, name] of [[l.h5, b.h5, tr('srv.budget.h5')], [l.wk, b.wk, tr('srv.budget.wk')]]) {
    if (!w || w.pct < cap) continue;
    const r = w.resets == null ? 0 : new Date(typeof w.resets === 'number' && w.resets < 1e12 ? w.resets * 1000 : w.resets).getTime();
    if (r && r <= Date.now()) continue;   // that window has reset since
    return tr('srv.budget.over', { name, pct: Math.round(w.pct), cap });
  }
  return null;
}
function mayRun() { const why = overBudget(); if (why) throw bad(why); }

// Pace guard (AIG-466): the spend scale also says where to finish the week. When the forecast shows the weekly figure passing
// that target before the reset, the board slows down (no extra helpers, smaller models) and tells the owner once per window.
// It never stops a run: only mayRun does, at the cap.
const PACE = { fly: 70, careful: 80, normal: 90, generous: 95, nospare: 100 };   // scale step -> % to finish the week at
function pace() {
  try { return require('./setup').prefsOf(localSettings()).pace || budget().wk; } catch { return budget().wk; }
}
// null when on pace (or no fresh reading), else { pace, pct, atReset, resets } for the weekly window.
function slow() {
  let h; try { h = require('./limits').limitsHistory(1); } catch { return null; }
  const l = h.latest, f = h.forecast && h.forecast.wk, target = pace();
  if (!l || !f || f.over || Date.now() - Date.parse(l.at) > FRESH_MS) return null;
  return f.atReset > target ? { pace: target, pct: Math.round(f.pct), atReset: Math.round(f.atReset), resets: f.resets } : null;
}
const TOLD = path.join(DATA, 'pace.told');
function paceCheck() {
  const s = slow(); if (!s) return null;
  let told = ''; try { told = fs.readFileSync(TOLD, 'utf8'); } catch {}
  if (told === String(s.resets)) return null;
  fs.writeFileSync(TOLD, String(s.resets));
  require('./watchman').say(tr('srv.pace', { pct: Math.min(s.atReset, 100), pace: s.pace }));
  return s;
}

// Nightly token budget per team (AIG-522 #4, docs/TOKENS.md). The unit is the input-token equivalent: fresh input 1, cache write 2,
// cache read 0.1, output 5. A night runs from 18:00. The limit comes from the spend/pace scale (🚀 = no cap); "budget": { "night": N }
// in aigile.local.json (units, 0 = no cap) overrides it. mayRun() only gates the start, so checkNight() reads the run's growing
// session log every minute or so and stops a run that passes the limit.
const NIGHT = { fly: 8e6, careful: 15e6, normal: 30e6, generous: 60e6, nospare: 0 };
const units = r => (r.fresh != null ? r.fresh : (r.in || 0)) + 2 * (r.cw || 0) + 0.1 * (r.cache || 0) + 5 * (r.out || 0);
function nightLimit() {
  const n = (localSettings().budget || {}).night;
  if (n !== undefined && n !== null && n !== '' && Number.isFinite(+n) && +n >= 0) return +n;
  let plan = ''; try { plan = require('./setup').prefsOf(localSettings()).plan; } catch {}
  return plan in NIGHT ? NIGHT[plan] : NIGHT.normal;
}
function nightStart(now = Date.now()) { const d = new Date(now); d.setHours(18, 0, 0, 0); return d.getTime() > now ? d.getTime() - 86400e3 : d.getTime(); }
// Units this team's finished runs used since the night began (the _runs.jsonl rows).
function nightUsed(slug, now = Date.now()) {
  let rows = []; try { rows = fs.readFileSync(path.join(DATA, 'logs', '_runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch {}
  const from = nightStart(now);
  return rows.filter(r => r.slug === slug && r.end >= from).reduce((n, r) => n + units(r), 0);
}
const toldNight = new Set();
// Runs going now, from their logs/<slug>.run notes (pid and start), the same notes a restarted board adopts runs from.
function liveRuns() {
  const out = [];
  let files = []; try { files = fs.readdirSync(path.join(DATA, 'logs')).filter(f => f.endsWith('.run')); } catch {}
  for (const f of files) {
    try { const r = JSON.parse(fs.readFileSync(path.join(DATA, 'logs', f), 'utf8')); if (r.pid) out.push({ slug: f.slice(0, -4), pid: r.pid, startedAt: r.startedAt }); } catch {}
  }
  return out;
}
const pidAlive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
// Stops every live run whose team has used up the night's budget (kill and alive can be swapped by a test). Returns the slugs stopped.
function checkNight({ now = Date.now(), runs = liveRuns(), kill = pid => require('./presence').killTree(pid), alive = pidAlive } = {}) {
  const limit = nightLimit(), stopped = [];
  if (!limit) return stopped;
  const { load, save } = require('./store'), { runTokens } = require('./usage'), dir = process.env.AIGILE_USAGE_DIR || localSettings().usageDir;
  for (const r of runs) {
    if (!alive(r.pid)) continue;
    const p = load(r.slug); if (!p) continue;
    const live = runTokens(dir, p.path, r.startedAt, now), used = nightUsed(r.slug, now) + (live ? units(live) : 0);
    if (used < limit) continue;
    kill(r.pid); stopped.push(r.slug);
    const key = r.slug + '@' + nightStart(now);
    if (toldNight.has(key)) continue;
    toldNight.add(key);
    const m = n => (n >= 1e7 ? Math.round(n / 1e6) : +(n / 1e6).toFixed(1)) + 'M';
    try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(path.join(DATA, 'logs', r.slug + '.log'), `=== token budget reached: ${m(used)} of ${m(limit)} tonight, run stopped ===\n`); } catch {}
    try {
      const c = p.cards.filter(c => c.status === 'doing').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
      if (c) { c.comments.push({ author: '🧭 Lead Scrum Master', at: new Date().toISOString(), text: tr('srv.budget.night', { used: m(used), limit: m(limit) }) }); c.updated = new Date().toISOString(); save(p); }
    } catch {}
  }
  return stopped;
}
let nightTimer = null;
function startNightWatch() {
  if (nightTimer) return;
  nightTimer = setInterval(() => { try { checkNight(); } catch {} }, +process.env.AIGILE_NIGHT_MS || 90e3);
  nightTimer.unref();
}

module.exports = { NIGHT, units, nightLimit, nightStart, nightUsed, checkNight, startNightWatch, budget, helpers, overBudget, mayRun, PACE, pace, slow, paceCheck };
