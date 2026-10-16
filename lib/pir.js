// 📝 Post-incident review (AIG-1108, docs/SERVICE-MGMT-PLAN.md phase 2) and 📘 runbook from a review (AIG-1109).
// When a MAJOR incident card (c.major, AIG-1049) goes done, the board orders the project's on-call agent (lib/service.js onCall, else the lead)
// with a card comment and wakes them (presence.startTeam, like lib/major.js) to write a review: timeline, what helped, action items.
// No Token Mode / AI off: no wake, the card just gets a plain "write it yourself" comment. c.review = { state: asked|manual|posted, at, by?,
// timeline?, helped?, actions?: [{ text, ok?, card? }], runbook? (the proposal card's id) }. The owner ticks actions (ok) and "Make a card" per action.
// After a review is posted the agent proposes a runbook: a 🚦 Ready for go card (same pattern as lib/retro.js) with c.runbookProposal = { name, text, from, done?, file? };
// Go writes it to <project folder>/docs/runbooks/<name>.md (never over an existing file; see docs/runbooks, AIG-1107), Not yet closes it.
const fs = require('fs');
const path = require('path');
const { now, load, save, bad, writeAtomic } = require('./store');
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
  if (p.sample) { c.review = { state: 'manual', at: now() }; say(c, tr('sample.inc.pir'), { pir: true }); return null; }   // AIG-1327: practice, never a wake
  if (aiOff()) { c.review = { state: 'manual', at: now() }; say(c, tr('srv.pir.manual', { id: c.id, slug: p.slug }), { pir: true }); return null; }
  const name = onCallOf(p);
  c.review = { state: 'asked', at: now(), by: name };
  say(c, tr('srv.pir.order', { name, id: c.id, slug: p.slug }), { pir: true, wake: true });
  return () => {
    try { require('./dispatch').setHint(p.slug, `Major incident ${c.id} is closed: ${name}, ${tr('srv.pir.hint', { id: c.id })}`); } catch {}
    // A run already going (usually the one on the major incident) only notes 'again': try again every 2 s (up to ~2 min) until a new run starts or the review is posted.
    const go = n => { let r; try { const q = load(p.slug) || p; r = require('./presence').startTeam(q, true, false, false, true, true); } catch { return; } if (r && r.running && n < 60) { const q = load(p.slug), cc = q && find(q, c.id); if (cc && cc.review && cc.review.state === 'asked') setTimeout(() => go(n + 1), 2000).unref(); } };
    go(0);
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
  const asked = c.review && c.review.state === 'asked';
  c.review = { ...(c.review || {}), state: 'posted', at: now(), by: author, timeline, helped, actions: actions.map(text => ({ text })) };
  c.comments.push({ author, at: now(), text: tr('srv.pir.text', { timeline, helped, actions: actions.map(a => '- ' + a).join('\n') }), pir: true });
  if (asked) say(c, tr('srv.pir.rb.next', { name: c.review.by, id: c.id, slug: p.slug }), { pir: true, wake: true });   // AIG-1109: now the runbook
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

// AIG-1109: the runbook proposal card.
const cleanName = v => String(v == null ? '' : v).toLowerCase().replace(/\.md$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
function propose(slug, id, b) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const c = done(p, id);
  if (!c.review || c.review.state !== 'posted') throw bad('post the review first');
  const name = cleanName(b.name), text = String(b.text == null ? '' : b.text).replace(/\r\n/g, '\n').trim().slice(0, 8000), author = str(b.author, 60) || c.review.by || 'Lead';
  if (!name) throw bad('a runbook needs a name');
  if (!text) throw bad('a runbook needs its text');
  if (!p.path && !p.sample) throw bad('connect a folder to this project first (🔌 Connect folder)');   // AIG-1327: the sample has no folder
  const old = c.review.runbook && find(p, c.review.runbook);
  if (old && !(old.runbookProposal || {}).done) throw bad('a runbook is already proposed: ' + old.id, 409);
  const n = { id: p.key + '-' + p.nextId++, title: tr('srv.pir.rb.title', { name }), type: 'task', kind: 'plan', status: 'backlog', priority: 'normal',
    description: tr('srv.pir.rb.desc', { name, from: c.id, text }), testSteps: '', assignee: '', sprint: '', blocked: false, needsYou: true, asked: true, createdBy: author, created: now(), updated: now(),
    runbookProposal: { name, text, from: c.id }, comments: [{ author, text: tr('srv.pir.rb.ask', { name }), at: now(), mark: 'ask' }] };
  p.cards.push(n);
  c.review.runbook = n.id; c.updated = now();
  save(p);
  return n;
}

// The owner's reply on the proposal card: Go writes the file, Not yet closes it. Anything else returns false (normal comment).
const GO = /^\s*(go|yes|ja|ok|okay)\b/i;
function answer(p, c, text) {
  const r = c.runbookProposal; if (!r || r.done) return false;
  const notYet = tr('act.notyet.say').trim().replace(/[:：]\s*$/, '');
  const no = /^\s*(not yet|no|nee|nog niet)\b/i.test(text) || (notYet && text.toLowerCase().startsWith(notYet.toLowerCase()));
  const go = GO.test(text);
  if (!go && !no) return false;
  let msg;
  if (go) {
    // AIG-1327: the sample project has no folder: Go is practice, nothing is written.
    if (!p.path && p.sample) { r.done = 'added'; c.comments.push({ author: 'AI-gile', text: tr('sample.inc.rbgo', { file: 'docs/runbooks/' + cleanName(r.name) + '.md' }), at: now() }); c.status = 'done'; c.needsYou = false; c.blocked = false; return true; }
    if (!p.path) { say(c, tr('srv.pir.rb.nofolder')); return true; }
    const root = path.resolve(p.path), dir = path.join(root, 'docs', 'runbooks');
    const base = cleanName(r.name);
    if (!base) { say(c, tr('srv.pir.rb.failed', { error: 'bad runbook name' })); return true; }
    let name = base, n = 1;
    while (fs.existsSync(path.join(dir, name + '.md'))) name = base + '-' + (++n);
    const file = path.resolve(dir, name + '.md');
    try {
      // AIG-1159: a tester/QA board keeps real project paths, so the sandbox gate comes first, and the file must stay inside the project folder.
      require('./safefolder').guard(root, 'write a runbook');
      if (!file.startsWith(root + path.sep)) throw new Error('runbook path leaves the project folder');
      fs.mkdirSync(dir, { recursive: true }); writeAtomic(file, r.text + '\n');
    }
    catch (e) { say(c, tr('srv.pir.rb.failed', { error: e.message })); return true; }
    r.done = 'added'; r.file = 'docs/runbooks/' + name + '.md';
    msg = tr('srv.pir.rb.added', { file: r.file });
  } else { r.done = 'declined'; msg = tr('srv.pir.rb.declined'); }
  c.comments.push({ author: 'AI-gile', text: msg, at: now() });
  c.status = 'done'; c.needsYou = false; c.blocked = false;
  return true;
}

module.exports = { start, post, tick, makeCard, propose, answer };
