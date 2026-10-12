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

module.exports = { budget, helpers, overBudget, mayRun, PACE, pace, slow, paceCheck };
