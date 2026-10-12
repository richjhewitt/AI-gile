// ⛔ No Token Mode (AIG-337..339): one switch that stops all AI use. While on, every starter calls guard() and is
// refused; turning it on kills what is running. It also turns itself on when the plan's usage limit is hit (with the
// reset time), and says when usage is back, and turns itself off again when the plan is back (only that one; a switch you flipped stays). State lives in data/notokens.conf.
const fs = require('fs');
const path = require('path');
const { DATA, now, bad } = require('./store');
const { t: tr } = require('./i18n');

const FILE = path.join(DATA, 'notokens.conf');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {} };

const isOn = () => !!read().on;
// The one guard every AI starter calls first.
function guard() { if (isOn()) throw bad(tr('srv.notokens.guard'), 409); }

// Is the plan usable again? The reset time has passed, or a newer reading is under the limit.
function usageBack(s) {
  if (!s.on || s.reason !== 'limit') return false;
  if (s.until && Date.now() >= Date.parse(s.until)) return true;
  try {
    const l = require('./limits').limitsHistory(1).latest;
    if (l && l.at > s.since && Date.now() - Date.parse(l.at) < 15 * 60e3) {
      const w = [l.h5, l.wk].filter(Boolean);
      if (w.length && w.every(x => x.pct < 100)) return true;
    }
  } catch {}
  return false;
}
function status() {
  const s = read();
  return { on: !!s.on, since: s.since || null, reason: s.on ? s.reason || 'user' : null, until: s.on && s.until || null, back: usageBack(s) };
}

// Kill every AI run: team runs, the AI tester, ask a mate, the watchman agent, a usage check.
function killAll() {
  for (const f of [() => require('./presence').stopAll(), () => require('./tester').stop(), () => require('./ask').stop(), () => require('./pack').aiStop(),
    () => require('./watchman').stopAgent(), () => require('./usagecheck').stop()]) try { f(); } catch {}
}
function set(on, reason, until) {
  on = !!on;
  if (on) { write({ on: true, since: now(), reason: reason || 'user', ...(until ? { until } : {}) }); killAll(); }
  else write({ on: false, since: now() });
  return status();
}

// The plan's limit, from fresh readings or a run that ended on it: turn on by itself.
function watchLimit() {
  // AIG-532: a switch that only the limit turned on turns itself off when the plan is back, so teams carry on without a click.
  const s = read();
  if (s.on && s.reason === 'limit' && usageBack(s)) { set(false); try { require('./watchman').quickWake && require('./watchman').round(); } catch {} return; }
  if (isOn()) return;
  try { const until = require('./watchman').limitUntilNow(); if (until) set(true, 'limit', until); } catch {}
}
function start() { setInterval(watchLimit, +process.env.AIGILE_NOTOKENS_MS || 30e3).unref(); setTimeout(watchLimit, 5e3).unref(); }

module.exports = { isOn, guard, status, set, start, killAll };
