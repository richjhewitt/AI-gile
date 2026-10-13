// Guard rails by skill level (AIG-616). Four rails: riskPlan (a risky card needs the owner's OK on a plan, AIG-612),
// qaGate (aigile test refuses a red card, AIG-613), quietTimes (nothing goes live in them, AIG-615), postmortem (an incident
// is closed with one, AIG-614). Beginner or help level 1: all on, not shown. Some / level 2 / unset: all on, shown read-only.
// Expert or help level 3: each a switch in Setup, saved as rails: { name: false }; a missing rail is on.
const NAMES = ['riskPlan', 'qaGate', 'quietTimes', 'postmortem'];

// How Setup shows them: 'hidden' | 'list' | 'switches'. s is the settings file or the prefs (both carry techLevel and helpLevel).
function mode(s) {
  s = s || {};
  const tech = s.techLevel, help = String(s.helpLevel || '');
  if (tech === 'beginner' || help === '1') return 'hidden';
  if (tech === 'expert' || help === '3') return 'switches';
  return 'list';
}
// Is this rail on? Only an expert can have switched one off. s defaults to aigile.local.json.
function railOn(name, s) {
  if (!s) s = require('./store').localSettings();
  if (mode(s) !== 'switches') return true;
  return !(s.rails && s.rails[name] === false);
}
// Checks the list from the page; returns the tidy stored form (only the off ones).
function clean(v) {
  const { bad } = require('./store');
  if (v === '' || v === null || v === undefined) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw bad('rails must be an object of switches');
  const o = {};
  for (const k of Object.keys(v)) { if (!NAMES.includes(k)) throw bad('rails: unknown rail ' + k); if (!v[k]) o[k] = false; }
  return o;
}
module.exports = { NAMES, mode, railOn, clean };
