// Change windows (AIG-859): when a change may go live. p.changeWindows = [{ day, from, to, label }], the same shape as the
// quiet times (lib/changecal.js, which does the checking). None = any time. Going live = a change card moving to done.
// Refused outside a window ("next window: Tue 20:00") and in a quiet time; an emergency change (from an open incident) skips the window only.
const cc = require('./changecal');
const { bad } = require('./store');
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const of = p => (p && Array.isArray(p.changeWindows) ? p.changeWindows : []);

// "tue 20:00-22:00 Release" (day may be 'all'; several split by | or a new line) -> list entries.
function parse(text) {
  const out = [];
  for (const part of String(text == null ? '' : text).split(/[|\n]/).map(s => s.trim()).filter(Boolean)) {
    const m = /^([a-z]+)\s+(\d{1,2}:\d\d)\s*-\s*(\d{1,2}:\d\d)\s*(.*)$/i.exec(part);
    if (!m) throw bad('a change window looks like "tue 20:00-22:00 Release"');
    const pad = t => (t.length === 4 ? '0' + t : t);
    out.push({ day: m[1].toLowerCase(), from: pad(m[2]), to: pad(m[3]), label: m[4] });
  }
  return out;
}
// A list from the page ([{day,from,to,label}]) or a text; throws a 400 on a bad entry.
function clean(v) {
  if (typeof v === 'string') v = parse(v);
  if (v === null || v === undefined || v === '') return [];
  if (!Array.isArray(v)) throw bad('windows must be a list of { day, from, to, label }');
  return cc.clean(v);
}
function set(p, v) { const l = clean(v); p.changeWindows = l.length ? l : undefined; return of(p); }

// The window going on at `at`, or null.
const open = (p, at = new Date()) => cc.current(of(p), at);
// The next window start after `at` as { at: Date, text: 'Tue 20:00', label }, or null.
function next(p, at = new Date()) {
  let best = null;
  for (let d = 0; d <= 7; d++) {
    const day = new Date(at.getFullYear(), at.getMonth(), at.getDate() + d);
    for (const w of of(p)) {
      if (!HM.test(w.from || '') || !HM.test(w.to || '')) continue;
      if (w.day !== 'all' && w.day !== cc.DAYS[day.getDay()]) continue;
      const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), +w.from.slice(0, 2), +w.from.slice(3));
      if (s > at && (!best || s < best.at)) best = { at: s, text: cap(cc.DAYS[s.getDay()]) + ' ' + w.from, label: w.label || '' };
    }
  }
  return best;
}
// An emergency change comes from an incident that is still open.
const emergency = (p, c) => {
  const f = c && c.change && c.change.from, x = f && (p.cards || []).find(k => k.id === f);
  return !!(x && x.type === 'incident' && x.status !== 'done');
};
// Can this change card go live now? { ok } or { ok: false, why }.
function check(p, c, at = new Date()) {
  const qt = require('./rails').railOn('quietTimes') ? cc.current(require('./store').localSettings().quiet, at) : null;
  if (qt) return { ok: false, why: `quiet until ${qt.until}${qt.label ? ` (${qt.label})` : ''}: nothing goes live` };
  if (!of(p).length || emergency(p, c) || open(p, at)) return { ok: true };
  const n = next(p, at);
  return { ok: false, why: 'outside the change windows' + (n ? `, next window: ${n.text}${n.label ? ` (${n.label})` : ''}` : '') };
}
// Called when a card moves to done: refuses a change card outside its window.
function guard(p, c, at) {
  if (c.type !== 'change') return;
  const r = check(p, c, at);
  if (!r.ok) throw bad(r.why);
}
const view = (p, at = new Date()) => { const n = next(p, at), o = open(p, at); return { windows: of(p), open: o, next: n ? { text: n.text, label: n.label, at: n.at.toISOString() } : null }; };

module.exports = { of, parse, clean, set, open, next, emergency, check, guard, view };
