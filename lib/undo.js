// ↩ Undo (AIG-403): every owner click that moves a card records what it changed, so one call can put it back exactly
// (status, who it is with, flags) and take away the auto-comment it added. Only the latest move per card, only for ~60 s.
// The team wake those clicks cause is held back (wakeMs), so an undo inside that time costs no tokens: when the wake
// fires, ownerNews is recomputed and the undone comment is gone.
const { load, save, now, findCard, bad, need } = require('./store');

const KEEP_MS = 60e3;
const entries = new Map();   // "slug/id" -> { at, set: {field: old value | undefined}, added: [{at, author, text}] }
const timers = new Map();    // slug -> timer: a wake waiting out the undo window
const wakeMs = () => { const raw = process.env.AIGILE_UNDO_WAKE_MS; const n = Number(raw); return raw !== undefined && raw !== '' && Number.isFinite(n) ? n : 10e3; };

const SKIP = new Set(['comments', 'updated']);
const fields = c => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => !SKIP.has(k)))));

// begin(c) before the change, record(slug, c, s) after it (before save). Returns { undo: { id, status } } to merge into the response.
function begin(c) { return { f: fields(c), n: c.comments.length }; }
function record(slug, c, s) {
  const set = {}, after = fields(c);
  const from = (s.f.status === 'team' && s.f.prevStatus) || s.f.status;
  if (c.status === 'done' && s.f.status !== 'done') { after.reopenTo = c.reopenTo = ['verify', 'team', 'review'].includes(from) ? 'doing' : from; }   // ↩ Reopen goes back to where it came from
  for (const k of new Set([...Object.keys(s.f), ...Object.keys(after)])) if (JSON.stringify(s.f[k]) !== JSON.stringify(after[k])) set[k] = s.f[k];
  entries.set(slug + '/' + c.id, { at: Date.now(), set, added: c.comments.slice(s.n).map(m => ({ at: m.at, author: m.author, text: m.text })) });
  return { undo: { id: c.id, status: c.status } };
}

function undo(slug, id) {
  const e = entries.get(slug + '/' + id);
  if (!e || Date.now() - e.at > KEEP_MS) { entries.delete(slug + '/' + id); throw bad('too late to undo that one', 409); }
  const p = need(load(slug)), c = findCard(p, id);
  for (const [k, v] of Object.entries(e.set)) { if (v === undefined) delete c[k]; else c[k] = v; }
  c.comments = c.comments.filter(m => !e.added.some(a => a.at === m.at && a.author === m.author && a.text === m.text));
  c.updated = now();
  entries.delete(slug + '/' + id);
  try { require('./share').cardChanged(p, c); } catch {}
  save(p);
  return c;
}

// A wake for an owner move-action waits wakeMs; several actions in the window share one timer.
function nudgeSoon(slug) {
  const ms = wakeMs(), nudge = require('./presence').nudge;
  if (ms <= 0) return nudge(slug);
  if (timers.has(slug)) return;
  timers.set(slug, setTimeout(() => { timers.delete(slug); nudge(slug); }, ms));
}

module.exports = { begin, record, undo, nudgeSoon, KEEP_MS };
