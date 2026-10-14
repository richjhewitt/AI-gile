// Usage burn-down (AIG-466): from the saved plan readings, how fast a window is filling and when it runs out.
// Pure functions: forecastWindow(history, key, nowMs) -> null (no reading) or { pct, at, resets, rate, runOut, beforeReset, atReset, since }.
// rate is % per hour over the readings of the CURRENT window (same resets time); runOut and resets are epoch ms or null.
const MIN_SPAN = 10 * 60e3;   // readings closer together than this say nothing about a rate
const toMs = v => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!isNaN(n)) return n < 1e12 ? n * 1000 : n;
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
};
function forecastWindow(history, key, nowMs = Date.now()) {
  const all = (history || []).filter(s => s && s[key] && isFinite(s[key].pct));
  const last = all[all.length - 1];
  if (!last) return null;
  const resets = toMs(last[key].resets);
  const win = all.filter(s => toMs(s[key].resets) === resets);
  const first = win[0], t1 = Date.parse(last.at), t0 = Date.parse(first.at);
  const out = { pct: last[key].pct, at: t1, resets, rate: 0, runOut: null, beforeReset: false, atReset: last[key].pct, since: t0 };
  if (resets && resets <= nowMs) return { ...out, over: true };   // that window has reset since
  if (t1 - t0 < MIN_SPAN) return out;
  const rate = (last[key].pct - first[key].pct) / ((t1 - t0) / 3600e3);
  if (!(rate > 0)) return out;
  out.rate = rate;
  out.runOut = t1 + (100 - out.pct) / rate * 3600e3;
  out.beforeReset = !!resets && out.runOut < resets;
  if (resets) out.atReset = Math.min(999, out.pct + rate * (resets - t1) / 3600e3);
  return out;
}
const forecasts = (history, nowMs) => ({ h5: forecastWindow(history, 'h5', nowMs), wk: forecastWindow(history, 'wk', nowMs) });
module.exports = { forecastWindow, forecasts, toMs };
