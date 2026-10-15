// 📝 Post-incident review (AIG-1108, docs/SERVICE-MGMT-PLAN.md phase 2).
// When a MAJOR incident card (c.major, AIG-1049) goes done, the board orders the project's on-call agent (lib/service.js onCall, else the lead)
// with a card comment and wakes them (presence.startTeam, like lib/major.js) to write a review: timeline, what helped, action items.
// No Token Mode / AI off: no wake, the card just gets a plain "write it yourself" comment. c.review = { state: asked|manual|posted, at, by?,
// timeline?, helped?, actions?: [{ text, ok?, card? }], runbook? (the proposal card's id) }. The owner ticks actions (ok) and "Make a card" per action.
const { now, load, save, bad } = require('./store');
const { t: tr } = require('./i18n');

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const say = (c, text, extra) => { c.comments = c.comments || []; c.comments.push({ author: 'AI-gile', at: now(), text, ...extra }); c.updated = now(); };
const find = (p, id) => (p.cards || []).find(c => c.id.toLowerCase() === String(id).toLowerCase());
const onCallOf = p => { try { return require('./service').onCall(p); } catch { return require('./dispatch').leadOf(p).name; } };
const aiOff = () => { try { require('./notokens').guard(); return false; } catch { return true; } };
const short = s => (s.length > 60 ? s.slice(0, 59).replace(/\s+\S*$/, '') + '…' : s);

// Called while a major incident goes done (before the caller saves). Adds the order or the plain prompt; returns the wake to run after the save, or null.
function start(p, c) {
  if (c.review) return null;
  if (aiOff()) { c.review = { state: 'manual', at: now() }; say(c, tr('srv.pir.manual', { id: c.id, slug: p.slug }), { pir: true }); return null; }
  const name = onCallOf(p);
  c.review = { state: 'asked', at: now(), by: name };
  say(c, tr('srv.pir.order', { name, id: c.id, slug: p.slug }), { pir: true, wake: true });
  return () => {
    try { require('./dispatch').setHint(p.slug, `Major incident ${c.id} is closed: ${name}, ${tr('srv.pir.hint', { id: c.id })}`); } catch {}
    try { require('./presence').startTeam(load(p.slug) || p, true, false, false, true, true); } catch {}
  };
}

const list = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(/\r?\n|\|/)).map(x => str(x, 240)).filter(Boolean).slice(0, 10);
function done(p, id) {
  const c = find(p, id); if (!c) throw bad('no such card', 404);
  if (c.type !== 'incident' || c.status !== 'done') throw bad('a review belongs to a done incident card');
  return c;
}

// The review itself: { timeline, helped, actions: [..] | "a | b", author }.
function post(slug, id, b) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const c = done(p, id);
  if (c.review && c.review.state === 'posted') throw bad('this incident already has a review', 409);
  const timeline = String(b.timeline == null ? '' : b.timeline).trim().slice(0, 3000), helped = String(b.helped == null ? '' : b.helped).trim().slice(0, 2000);
  const actions = list(b.actions), author = str(b.author, 60) || (c.review && c.review.by) || 'Lead';
  if (!timeline) throw bad('a review needs the timeline');
  if (!helped) throw bad('a review needs what helped');
  if (!actions.length) throw bad('a review needs at least one action item');
  c.review = { ...(c.review || {}), state: 'posted', at: now(), by: author, timeline, helped, actions: actions.map(text => ({ text })) };
  c.comments.push({ author, at: now(), text: tr('srv.pir.text', { timeline, helped, actions: actions.map(a => '- ' + a).join('\n') }), pir: true });
  c.updated = now();
  save(p);
  return c;
}

// The owner's tick on one action (index, on/off).
function tick(slug, id, i, on) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const c = done(p, id), a = c.review && c.review.actions && c.review.actions[i];
  if (!a) throw bad('no such action item', 404);
  if (on) a.ok = true; else delete a.ok;
  c.updated = now(); save(p);
  return c;
}
// "Make a card" on one action: a backlog task that points back at the incident; once only.
function makeCard(slug, id, i) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const c = done(p, id), a = c.review && c.review.actions && c.review.actions[i];
  if (!a) throw bad('no such action item', 404);
  if (a.card) return { card: a.card, existing: true };
  const n = { id: p.key + '-' + p.nextId++, title: tr('srv.pir.cardtitle', { short: short(a.text) }), type: 'task', status: 'backlog', priority: 'normal',
    description: tr('srv.pir.carddesc', { text: a.text, id: c.id }), testSteps: '', assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: 'AI-gile', created: now(), updated: now(), comments: [] };
  p.cards.push(n);
  a.card = n.id; a.ok = true;
  c.updated = now(); save(p);
  return { card: n.id };
}

module.exports = { start, post, tick, makeCard };
