// Plan usage history: snapshots posted by statusline.js, kept in data/limits.log.
const fs = require('fs');
const path = require('path');
const { ROOT, DATA, now, localSettings, bad } = require('./store');

/* ---------- plan usage history ---------- */
// Plan usage history: one JSON line per change (or every 5 minutes), in data/limits.log.
const LIMITS = path.join(DATA, 'limits.log');
let lastLimits = null;
function recordLimits(rl) {
  const w = x => (x && x.used_percentage != null ? { pct: Number(x.used_percentage), resets: x.resets_at ?? null } : null);
  const snap = { at: now(), h5: w(rl.five_hour), wk: w(rl.seven_day) };
  if (!snap.h5 && !snap.wk) throw bad('no usage figures in rate_limits');
  const same = lastLimits && JSON.stringify([lastLimits.h5, lastLimits.wk]) === JSON.stringify([snap.h5, snap.wk]);
  if (!same || Date.parse(snap.at) - Date.parse(lastLimits.at) > 5 * 60e3) {
    fs.appendFileSync(LIMITS, JSON.stringify(snap) + '\n');
    lastLimits = snap;
    try { require('./budget').paceCheck(); } catch {}   // AIG-466: the pace guard tells the owner once per window
  }
  return { ok: true };
}
function limitsHistory(days) {
  const since = Date.now() - days * 864e5;
  let history = [];
  try {
    history = fs.readFileSync(LIMITS, 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(s => s && Date.parse(s.at) >= since);
  } catch {}
  // Until readings arrive, say how to switch the feed on (file path from local settings, never in the repo).
  const file = localSettings().globalSettingsFile;
  let installed = false;
  try { installed = /"statusLine"[\s\S]*?statusline\.js/.test(fs.readFileSync(file, 'utf8')); } catch {}
  const setup = file ? { file, installed, snippet:'"statusLine": {\n  "type": "command",\n  "command": ' + JSON.stringify(`node "${ROOT.replace(/\\/g, '/')}/statusline.js"`) + '\n},' } : null;
  return { latest: history[history.length - 1] || null, history, setup, forecast: require('./forecast').forecasts(history) };
}

module.exports = { recordLimits, limitsHistory };
