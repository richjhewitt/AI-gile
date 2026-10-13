// 😴 Tired mode (AIG-669): an owner pref `tired` { mode: off|on|bedtime|dark|always, bedtime: 'HH:MM', wake: 'HH:MM' }.
// `tiredNow` (in GET /api/setup) says whether the owner counts as tired right now, for the cards that let teams go easy.
// Dark mode is a thing of the page, so the page tells us (setDark); a click on the top bar switch while bedtime/dark/always
// applies wins until that automatic state changes (override). AIGILE_TIRED_NOW=HH:MM fakes the clock (for tests).
const MODES = ['off', 'on', 'bedtime', 'dark', 'always'];
const hhmm = (v, d) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : d;
const norm = t => { t = t && typeof t === 'object' ? t : {}; return { mode: MODES.includes(t.mode) ? t.mode : 'off', bedtime: hhmm(t.bedtime, '22:00'), wake: hhmm(t.wake, '07:00') }; };
let dark = false, override = null;
const setDark = v => { dark = !!v; };
const mins = v => +v.slice(0, 2) * 60 + +v.slice(3);
const nowMin = () => { const m = /^(\d\d):(\d\d)$/.exec(process.env.AIGILE_TIRED_NOW || ''); if (m) return +m[1] * 60 + +m[2]; const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
function auto(c) {
  if (c.mode === 'on' || c.mode === 'always') return true;
  if (c.mode === 'dark') return dark;
  if (c.mode === 'bedtime') { const a = mins(c.bedtime), b = mins(c.wake), n = nowMin(); return a === b ? false : a < b ? n >= a && n < b : n >= a || n < b; }
  return false;
}
function now(s) { const c = norm((s || {}).tired), a = auto(c); if (override && override.base !== a) override = null; return override ? override.tired : a; }
// The top bar click: off <-> on; with an automatic mode it flips the answer until the automatic state changes.
function flip(s) {
  const c = norm(s.tired), cur = now(s);
  if (c.mode === 'off' || c.mode === 'on') { override = null; s.tired = { ...c, mode: cur ? 'off' : 'on' }; return; }
  override = { base: auto(c), tired: !cur };
}
// AIG-678: when the owner's day starts (default 09:00) and, optionally, stops ('' = not said). Saved as `day` { start, stop }.
const dayTimes = s => { const d = (s && s.day) || {}; return { start: hhmm(d.start, '09:00'), stop: hhmm(d.stop, '') }; };
module.exports = { MODES, norm, now, flip, setDark, hhmm, dayTimes };
