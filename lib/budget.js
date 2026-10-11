// Token budget and caps (AIG-353): settings in aigile.local.json ("budget": { h5, wk, parallel }, "helpers": { opus, sonnet, haiku },
// "usageChecks": "off"). mayRun() is the one check every wake path asks before it starts an AI run: it refuses when the
// latest plan reading is over the owner's percentage for the 5-hour or weekly limit. Only a fresh reading counts.
const { localSettings, bad } = require('./store');

const FRESH_MS = 30 * 60e3;
const int = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
function budget() { const b = localSettings().budget || {}; return { h5: int(b.h5, 90, 1, 100), wk: int(b.wk, 95, 1, 100), parallel: int(b.parallel, 0, 0, 50) }; }
const helpers = () => { const h = localSettings().helpers || {}, o = {}; for (const m of ['opus', 'sonnet', 'haiku']) if (h[m] !== undefined && h[m] !== null && h[m] !== '') o[m] = int(h[m], undefined, 0, 50); return o; };
// null when fine, else the reason a run must not start.
function overBudget() {
  let l; try { l = require('./limits').limitsHistory(1).latest; } catch { return null; }
  if (!l || Date.now() - Date.parse(l.at) > FRESH_MS) return null;
  const b = budget();
  for (const [w, cap, name] of [[l.h5, b.h5, '5-hour'], [l.wk, b.wk, 'weekly']]) {
    if (!w || w.pct < cap) continue;
    const r = w.resets == null ? 0 : new Date(typeof w.resets === 'number' && w.resets < 1e12 ? w.resets * 1000 : w.resets).getTime();
    if (r && r <= Date.now()) continue;   // that window has reset since
    return `over the token budget: the ${name} limit is at ${Math.round(w.pct)}% (you set ${cap}%, in Setup)`;
  }
  return null;
}
function mayRun() { const why = overBudget(); if (why) throw bad(why); }

module.exports = { budget, helpers, overBudget, mayRun };
