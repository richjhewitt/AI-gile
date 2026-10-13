// Life admin without tokens (AIG-798): plain-code reminders (one-off or repeating) and simple lists (shopping, to pack).
// Never wakes an agent and never makes an AI call. Kept in data/lifeadmin.conf (not .json, so it is never read as a project).
// A reminder: { id, kind:'reminder', text, due (ISO), repeat ('' | daily | weekly | monthly), done, snoozedUntil }.
// A list: { id, kind:'list', name, items:[{ id, text, done, snoozedUntil }] }. Ids are r1, l2, i3... (one counter), so one
// act(id, op) works for a reminder, a list or a list item. Also holds the "Start my day" state (AIG-797): which day was offered.
const fs = require('fs');
const path = require('path');
const { DATA, bad, localSettings } = require('./store');

const REPEATS = ['', 'daily', 'weekly', 'monthly'];
const FILE = () => path.join(DATA, 'lifeadmin.conf');
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
function read() {
  let s = null; try { s = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch {}
  s = s && typeof s === 'object' ? s : {};
  const objs = v => (Array.isArray(v) ? v : []).filter(x => x && typeof x === 'object' && typeof x.id === 'string');   // old or half-broken data is skipped, never a crash
  return { n: +s.n || 0, reminders: objs(s.reminders), lists: objs(s.lists).map(l => ({ ...l, items: objs(l.items) })), dayStart: s.dayStart || '' };
}
const write = s => { try { fs.writeFileSync(FILE(), JSON.stringify(s)); } catch (e) { throw bad('could not save: ' + e.message); } };
const nextId = (s, p) => p + (++s.n);
const iso = ms => new Date(ms).toISOString();
const when = v => { const d = new Date(v); if (isNaN(d)) throw bad('due must be a date and time'); return d; };
const endOfToday = (at = Date.now()) => { const d = new Date(at); d.setHours(23, 59, 59, 999); return d.getTime(); };
const tomorrow9 = (at = Date.now()) => { const d = new Date(at); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); };
const asleep = (x, at) => !!x.snoozedUntil && Date.parse(x.snoozedUntil) > at;

// Step a repeating reminder on, past now.
function advance(r, at = Date.now()) {
  let d = new Date(r.due);
  for (let i = 0; i < 1000 && d.getTime() <= at; i++) {
    if (r.repeat === 'daily') d.setDate(d.getDate() + 1); else if (r.repeat === 'weekly') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
  }
  r.due = d.toISOString();
}
function addReminder(b) {
  b = b || {}; const text = clip(b.text, 200); if (!text) throw bad('type what to remind you of');
  const rep = String(b.repeat || ''); if (!REPEATS.includes(rep)) throw bad('repeat must be ' + REPEATS.filter(Boolean).join(', ') + ' or empty');
  const s = read(), r = { id: nextId(s, 'r'), kind: 'reminder', text, due: when(b.due || Date.now()).toISOString(), repeat: rep, done: false, created: iso(Date.now()) };
  s.reminders.push(r); write(s); return r;
}
function addList(b) {
  const name = clip(b && b.name, 80); if (!name) throw bad('give the list a name');
  const s = read(), l = { id: nextId(s, 'l'), kind: 'list', name, items: [] };
  s.lists.push(l); write(s); return l;
}
function addItem(listId, b) {
  const text = clip(b && b.text, 200); if (!text) throw bad('type the item');
  const s = read(), l = s.lists.find(x => x.id === listId); if (!l) throw bad('no such list', 404);
  const it = { id: nextId(s, 'i'), text, done: false }; l.items.push(it); write(s); return it;
}
function find(s, id) {
  const r = s.reminders.find(x => x.id === id); if (r) return { r, arr: s.reminders };
  for (const l of s.lists) { if (l.id === id) return { l, arr: s.lists }; const i = l.items.find(x => x.id === id); if (i) return { i, l, arr: l.items }; }
  throw bad('no such item', 404);
}
// op: tick (done; a repeating reminder just moves on), snooze ({mins} or {tomorrow:true}), delete. A list can only be deleted.
function act(id, op, b = {}) {
  const s = read(), f = find(s, id), x = f.r || f.i || f.l, at = Date.now();
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
function seen() { const s = read(); s.dayStart = require('./today').dayKey(); write(s); return day(); }

module.exports = { REPEATS, addReminder, addList, addItem, act, dueToday, view, day, seen, _advance: advance };
