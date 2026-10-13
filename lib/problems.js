// 🧩 Problem card (AIG-887): the one cause behind repeat 🔥 incidents. A problem is a card of type `problem` with a root cause,
// a workaround until it is fixed, the incident cards it explains (`incidents` here, `problemId` on each incident: linked both
// ways) and `changeId`, the change request card that carries the fix. Stored on the card itself, so old projects are untouched.
const { now, load, save, bad } = require('./store');

const ID = /^[A-Z]{1,6}-\d+$/;
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const ids = v => [...new Set((Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim().toUpperCase()).filter(s => ID.test(s)))].slice(0, 50);
const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };
const find = (p, id) => (p.cards || []).find(c => c.id.toLowerCase() === String(id).toLowerCase());
const prob = (p, id) => { const c = find(p, id); if (!c) throw bad('no such card', 404); if (c.type !== 'problem') throw bad(c.id + ' is not a problem card'); return c; };
const view = c => ({ id: c.id, title: c.title, status: c.status, rootCause: c.rootCause || '', workaround: c.workaround || '', incidents: c.incidents || [], changeId: c.changeId || '' });

// An incident card on this board, or an error.
function incidentOf(p, id) {
  const inc = find(p, id);
  if (!inc) throw bad('no card ' + id + ' on this board', 404);
  if (inc.type !== 'incident') throw bad(inc.id + ' is not an incident card');
  return inc;
}

// Links an incident to a problem, both ways. An incident belongs to one problem: linking it elsewhere moves it.
function link(p, c, incId) {
  const inc = incidentOf(p, incId);
  if (inc.problemId && inc.problemId !== c.id) { const old = find(p, inc.problemId); if (old) old.incidents = (old.incidents || []).filter(x => x !== inc.id); }
  inc.problemId = c.id; inc.updated = now();
  if (!(c.incidents || []).includes(inc.id)) c.incidents = [...(c.incidents || []), inc.id];
}

function fields(p, c, b) {
  if (b.rootCause !== undefined) c.rootCause = str(b.rootCause, 1000);
  if (b.workaround !== undefined) c.workaround = str(b.workaround, 1000);
  if (b.change !== undefined) {   // the fix goes through a change request: a card on this board
    const id = str(b.change, 20).toUpperCase();
    if (id && !find(p, id)) throw bad('no card ' + id + ' on this board for the change request', 404);
    c.changeId = id || undefined;
  }
  if (b.incidents !== undefined) for (const i of ids(b.incidents)) link(p, c, i);
}

function list(slug) { return proj(slug).cards.filter(c => c.type === 'problem').map(view); }

function add(slug, b) {
  const p = proj(slug), title = str(b.title, 200);
  if (!title) throw bad('a problem needs its title');
  for (const i of ids(b.incidents)) incidentOf(p, i);   // check all before anything is made
  const c = { id: p.key + '-' + p.nextId++, title: '🧩 ' + title.replace(/^🧩\s*/, ''), description: '', testSteps: '', type: 'problem', priority: 'high', status: 'backlog',
    assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: str(b.createdBy, 60), created: now(), updated: now(), comments: [] };
  p.cards.push(c);
  fields(p, c, b);
  save(p); return view(c);
}

function patch(slug, id, b) {
  const p = proj(slug), c = prob(p, id);
  fields(p, c, b); c.updated = now(); save(p); return view(c);
}

function linkTo(slug, id, b) {
  const p = proj(slug), c = prob(p, id), inc = str(b.incident, 20).toUpperCase();
  if (!ID.test(inc)) throw bad('give the incident card id');
  link(p, c, inc); c.updated = now(); save(p); return view(c);
}

module.exports = { list, add, patch, linkTo, view };
