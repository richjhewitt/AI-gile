// Life admin without tokens (AIG-798): plain-code reminders (one-off or repeating) and simple lists (shopping, to pack).
// Never wakes an agent and never makes an AI call. Kept in data/lifeadmin.conf (not .json, so it is never read as a project).
// A reminder: { id, kind:'reminder', text, due (ISO), repeat ('' | daily | weekly | monthly), done, snoozedUntil }.
// A list: { id, kind:'list', name, items:[{ id, text, done, snoozedUntil }] }. Ids are r1, l2, i3... (one counter), so one
// act(id, op) works for a reminder, a list or a list item. Also holds the "Start my day" state (AIG-797): which day was offered.
const fs = require('fs');
const path = require('path');
const { DATA, bad, localSettings, writeAtomic } = require('./store');

const REPEATS = ['', 'daily', 'weekly', 'monthly'];
const FILE = () => path.join(DATA, 'lifeadmin.conf');
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
// strict (every write path): a missing file is empty, but a damaged one throws, so it is never read as empty and overwritten.
function read(strict) {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(FILE(), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT' && strict) throw bad('data/lifeadmin.conf is damaged: fix or remove it first (nothing was changed)', 409); }
  s = s && typeof s === 'object' ? s : {};
  const objs = v => (Array.isArray(v) ? v : []).filter(x => x && typeof x === 'object' && typeof x.id === 'string');   // old or half-broken data is skipped, never a crash
  const out = { n: +s.n || 0, reminders: objs(s.reminders), lists: objs(s.lists).map(l => ({ ...l, items: objs(l.items) })), dayStart: s.dayStart || '' };
  const ids = [...out.reminders, ...out.lists, ...out.lists.flatMap(l => l.items)].map(x => parseInt(String(x.id).slice(1), 10)).filter(n => n > 0);
  out.n = Math.max(out.n, ...ids, 0);   // a missing or stale counter never hands out an id twice
  return out;
}
const write = s => { try { writeAtomic(FILE(), JSON.stringify(s)); } catch (e) { throw bad('could not save: ' + e.message); } };
const nextId = (s, p) => p + (++s.n);
const iso = ms => new Date(ms).toISOString();
const when = v => { const d = new Date(v); if (isNaN(d)) throw bad('due must be a date and time'); return d; };
const endOfToday = (at = Date.now()) => require('./today').nextDayBegin(at) - 1;   // the owner's day ends when the next one starts (AIG-1063)
const tomorrow9 = (at = Date.now()) => require('./today').nextDayBegin(at);   // the owner's next day start (AIG-678/1063), 09:00 unless set
const asleep = (x, at) => !!x.snoozedUntil && Date.parse(x.snoozedUntil) > at;

// Step a repeating reminder to its next occurrence after both its due time and now (at least one step), worked out directly.
// Monthly keeps the intended day of the month (r.dom) and clamps to the month's last day (31 Jan -> 28 Feb -> 31 Mar).
function advance(r, at = Date.now()) {
  const due = new Date(r.due), from = Math.max(due.getTime(), at);
  if (r.repeat === 'monthly') {
    const dom = r.dom || due.getDate(), at0 = new Date(from);
    let k = Math.max(1, (at0.getFullYear() - due.getFullYear()) * 12 + at0.getMonth() - due.getMonth() - 1), d;
    for (;; k++) {
      d = new Date(due.getFullYear(), due.getMonth() + k, 1, due.getHours(), due.getMinutes(), due.getSeconds(), due.getMilliseconds());
      d.setDate(Math.min(dom, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      if (d.getTime() > from) break;
    }
    r.due = d.toISOString(); return;
  }
  const step = r.repeat === 'weekly' ? 7 : 1;
  const days = Math.floor((from - due.getTime()) / (864e5 * step));
  let k = Math.max(1, days - 1), d;
  for (;; k++) { d = new Date(due); d.setDate(d.getDate() + k * step); if (d.getTime() > from) break; }
  r.due = d.toISOString();
}
function addReminder(b) {
  b = b || {}; const text = clip(b.text, 200); if (!text) throw bad('type what to remind you of');
  const rep = String(b.repeat || ''); if (!REPEATS.includes(rep)) throw bad('repeat must be ' + REPEATS.filter(Boolean).join(', ') + ' or empty');
  const s = read(true), dd = when(b.due || Date.now()), r = { id: nextId(s, 'r'), kind: 'reminder', text, due: dd.toISOString(), dom: dd.getDate(), repeat: rep, done: false, created: iso(Date.now()) };
  s.reminders.push(r); write(s); return r;
}
function addList(b) {
  const name = clip(b && b.name, 80); if (!name) throw bad('give the list a name');
  const s = read(true), l = { id: nextId(s, 'l'), kind: 'list', name, items: [] };
  s.lists.push(l); write(s); return l;
}
function addItem(listId, b) {
  const text = clip(b && b.text, 200); if (!text) throw bad('type the item');
  const s = read(true), l = s.lists.find(x => x.id === listId); if (!l) throw bad('no such list', 404);
  const it = { id: nextId(s, 'i'), text, done: false }; l.items.push(it); write(s); return it;
}
function find(s, id) {
  const r = s.reminders.find(x => x.id === id); if (r) return { r, arr: s.reminders };
  for (const l of s.lists) { if (l.id === id) return { l, arr: s.lists }; const i = l.items.find(x => x.id === id); if (i) return { i, l, arr: l.items }; }
  throw bad('no such item', 404);
}
// op: tick (done; a repeating reminder just moves on), snooze ({mins} or {tomorrow:true}), delete. A list can only be deleted.
function act(id, op, b = {}) {
  const s = read(true), f = find(s, id), x = f.r || f.i || f.l, at = Date.now();
  if (op === 'delete') { f.arr.splice(f.arr.indexOf(x), 1); write(s); return { ok: true }; }
  if (x.kind === 'list') throw bad('a list can only be deleted');
  if (op === 'tick') {
    if (f.r && f.r.repeat) { advance(f.r, at); delete f.r.snoozedUntil; f.r.lastDone = iso(at); f.r.done = false; }
    else { x.done = !x.done; if (x.done) delete x.snoozedUntil; if (f.r && x.done) x.doneAt = iso(at); }
  } else if (op === 'snooze') {
    const m = Number(b.mins);
    if (b.tomorrow) x.snoozedUntil = iso(tomorrow9(at));
    else { if (!(m >= 1 && m <= 10080)) throw bad('mins must be 1 to 10080'); x.snoozedUntil = iso(at + m * 60e3); }
    if (x.done) x.done = false;
  } else throw bad('unknown action');
  write(s); return x;
}
// What is due now or earlier today (and not asleep or done): for Start my day and the page badge.
function dueToday(at = Date.now()) {
  const s = read(), end = endOfToday(at);
  return s.reminders.filter(r => !r.done && !asleep(r, at) && Date.parse(r.due) <= end).sort((a, b) => a.due < b.due ? -1 : 1);
}
function view(at = Date.now()) {
  const s = read();
  const mark = x => ({ ...x, asleep: asleep(x, at) });
  return { reminders: s.reminders.map(r => ({ ...mark(r), overdue: !r.done && Date.parse(r.due) <= at })), lists: s.lists.map(l => ({ ...l, items: l.items.map(mark) })),
    dueToday: dueToday(at).length, repeats: REPEATS.filter(Boolean) };
}
// 🌅 Start my day (AIG-797): offered once a morning when the owner turned it on in Setup (aigile.local.json dayStart).
const pickOn = () => { try { return !!(localSettings().today || {}).pick; } catch { return false; } };
const dayOn = () => { try { return localSettings().dayStart === true; } catch { return false; } };
function day() {
  const s = read(), key = require('./today').dayKey();
  return { on: dayOn(), ask: dayOn() && s.dayStart !== key, day: key, pickOn: pickOn(), lifeDue: dueToday().map(r => ({ id: r.id, text: r.text, due: r.due })) };
}
function seen() { const s = read(true); s.dayStart = require('./today').dayKey(); write(s); return day(); }

// "remind me at 15:00 / 3pm / 3:30pm / 3 to X", "remind me tomorrow at 3pm to X", "remind me to X at 3pm [tomorrow]" (AIG-964).
// Plain regex, no AI. Returns { text, due (Date), tomorrow } or null when it can't be read. A bare "3" is the next 3 o'clock ahead
// (03:00 or 15:00); a time already passed today means tomorrow. With "tomorrow" a bare 1..6 is the afternoon, 7..11 the morning.
const TIME = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?';
function parseRemind(msg, at = Date.now()) {
  const m = String(msg || '').trim().match(/^remind me\b[\s,:]*(.*)$/is); if (!m) return null;
  const rest = m[1].trim(); let tm, what, tmr = false, x;
  if ((x = rest.match(new RegExp('^(tomorrow\\s+)?at\\s+' + TIME + '(\\s+tomorrow)?\\s+(?:to\\s+|that\\s+|about\\s+)?(.+)$', 'is')))) { tm = [x[2], x[3], x[4]]; tmr = !!(x[1] || x[5]); what = x[6]; }
  else if ((x = rest.match(new RegExp('^to\\s+(.+?)\\s+(?:(tomorrow)\\s+)?at\\s+' + TIME + '(\\s+tomorrow)?\\s*[.!]?$', 'is')))) { tm = [x[3], x[4], x[5]]; tmr = !!(x[2] || x[6]); what = x[1]; }
  else return null;
  what = clip(what.replace(/[\s.!]+$/, ''), 200); if (!what || /^(to|that|about)$/i.test(what)) return null;
  let h = +tm[0], mi = tm[1] == null ? 0 : +tm[1]; const ap = (tm[2] || '').toLowerCase();
  if (mi > 59) return null;
  const now = new Date(at), day = (add, hh) => { const d = new Date(at); d.setDate(d.getDate() + add); d.setHours(hh, mi, 0, 0); return d; };
  let due;
  if (ap) { if (h < 1 || h > 12) return null; h = h % 12 + (ap === 'pm' ? 12 : 0); due = day(tmr ? 1 : 0, h); if (!tmr && due <= now) due = day(1, h); }
  else if (h > 23) return null;
  else if (h >= 1 && h <= 12 && !/^0/.test(tm[0])) {   // 12-hour clock without am/pm: the next one ahead
    if (tmr) due = day(1, h === 12 ? 12 : h <= 6 ? h + 12 : h);
    else { due = [day(0, h % 12), day(0, h % 12 + 12)].find(d => d > now) || day(1, h % 12); }
  } else { due = day(tmr ? 1 : 0, h); if (!tmr && due <= now) due = day(1, h); }
  return { text: what, due, tomorrow: due.toDateString() !== now.toDateString() };
}
module.exports = { parseRemind, REPEATS, addReminder, addList, addItem, act, dueToday, view, day, seen, _advance: advance };
