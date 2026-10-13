// Change calendar (AIG-615): the owner's quiet times (streams, demos, nights). Nothing goes live in them.
// Saved in aigile.local.json as quiet: [{ day: 'mon'..'sun' | 'all', from: 'HH:MM', to: 'HH:MM', label }] (⚙️ Setup).
// A time whose 'to' is earlier than its 'from' runs past midnight into the next day. Not to be mixed up with lib/quiet.js (going quiet).
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = s => +s.slice(0, 2) * 60 + +s.slice(3);

// Checks and tidies a list from the page; throws a 400 on a bad entry.
function clean(list) {
  const { bad } = require('./store');
  if (list === '' || list === null || list === undefined) return [];
  if (!Array.isArray(list)) throw bad('quiet must be a list of { day, from, to, label }');
  return list.slice(0, 30).map(q => {
    const day = String((q || {}).day || 'all').toLowerCase(), from = String(q.from || ''), to = String(q.to || '');
    if (day !== 'all' && !DAYS.includes(day)) throw bad('quiet day must be mon..sun or all');
    if (!HM.test(from) || !HM.test(to)) throw bad('quiet times must be HH:MM');
    if (from === to) throw bad('a quiet time needs a different start and end');
    return { day, from, to, label: String(q.label || '').replace(/\s+/g, ' ').trim().slice(0, 40) };
  });
}

// The quiet time going on at `at` (a Date), or null: { label, until: 'HH:MM' }.
function current(list, at = new Date()) {
  const today = DAYS[at.getDay()], yday = DAYS[(at.getDay() + 6) % 7], n = at.getHours() * 60 + at.getMinutes();
  for (const q of Array.isArray(list) ? list : []) {
    if (!q || !HM.test(q.from || '') || !HM.test(q.to || '')) continue;
    const f = mins(q.from), t = mins(q.to), on = d => q.day === 'all' || q.day === d;
    const hit = f < t ? on(today) && n >= f && n < t
      : (on(today) && n >= f) || (on(yday) && n < t);   // past midnight
    if (hit) return { label: q.label || '', until: q.to };
  }
  return null;
}

// The quiet time going on now, from the owner's saved settings.
const now = () => { try { return current(require('./store').localSettings().quiet); } catch { return null; } };

module.exports = { DAYS, clean, current, now };
