// 🔀 Change card (AIG-857): a change request is a card of type `change`; its fields live in one object `c.change` so they never
// clash with the queue `kind` or the size label `risk`. Stored on the card itself, so old projects are untouched.
//   kind: change | feature | fix | other   what, why, undo: text (600)   riskId: a risk in the register   when: { from, to } ISO times
//   from: the incident or problem card it came from. Approvers and votes (AIG-858) are added to the same object later.
const { now, load, save, bad } = require('./store');

const KINDS = ['change', 'feature', 'fix', 'other'];
const ID = /^[A-Z0-9]{1,8}-\d{1,9}$/;
const str = (v, n) => String(v == null ? '' : v).replace(/[ \t]+/g, ' ').trim().slice(0, n);
const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };
const find = (p, id) => (p.cards || []).find(c => c.id.toLowerCase() === String(id).toLowerCase());
const chg = (p, id) => { const c = find(p, id); if (!c) throw bad('no such card', 404); if (c.type !== 'change') throw bad(c.id + ' is not a change card'); return c; };
const view = (p, c) => ({ id: c.id, title: c.title, status: c.status, ...(c.change || {}),
  problems: (p.cards || []).filter(x => x.type === 'problem' && x.changeId === c.id).map(x => x.id) });

function iso(v, what) {
  const s = str(v, 40); if (!s) return '';
  const t = Date.parse(s); if (isNaN(t)) throw bad(what + ' must be a date and time (like 2026-11-03T20:00)');
  return new Date(t).toISOString();
}
// "from..to" (CLI) or { from, to }; both ends or none, and the end after the start.
function slot(v) {
  if (v === null || v === '') return undefined;
  if (typeof v === 'string') { const [a, b] = v.split('..'); v = { from: a, to: b }; }
  if (!v || typeof v !== 'object') throw bad('when must be { from, to }');
  const from = iso(v.from, 'when.from'), to = iso(v.to, 'when.to');
  if (!from && !to) return undefined;
  if (!from || !to) throw bad('give both ends of the slot (from and to)');
  if (Date.parse(to) <= Date.parse(from)) throw bad('the slot must end after it starts');
  return { from, to };
}

function fields(p, slug, c, b) {
  const o = { ...(c.change || {}) };
  if (b.kind !== undefined) { const k = str(b.kind, 20).toLowerCase(); if (!KINDS.includes(k)) throw bad('kind must be ' + KINDS.join(', ')); o.kind = k; }
  for (const k of ['what', 'why', 'undo']) if (b[k] !== undefined) o[k] = str(b[k], 600);
  if (b.riskId !== undefined || b.risk !== undefined) {   // a risk in the register; empty = none
    const id = str(b.riskId !== undefined ? b.riskId : b.risk, 20).toUpperCase();
    if (id && !require('./risks').read(slug).risks.some(r => r.id === id)) throw bad('no risk ' + id + ' in the register', 404);
    if (id) o.riskId = id; else delete o.riskId;
  }
  if (b.when !== undefined) { const w = slot(b.when); if (w) o.when = w; else delete o.when; }
  if (b.from !== undefined) {   // the incident or problem it came from
    const id = str(b.from, 20).toUpperCase();
    if (id) {
      if (!ID.test(id)) throw bad('"' + id + '" is not a card id (like AIG-12)');
      const f = find(p, id); if (!f) throw bad('no card ' + id + ' on this board', 404);
      if (f.type !== 'incident' && f.type !== 'problem') throw bad(f.id + ' is not an incident or a problem card');
      o.from = f.id;
    } else delete o.from;
  }
  if (!o.kind) o.kind = 'change';
  if (b.when !== undefined || b.from !== undefined) {   // AIG-859: the whole slot must sit inside a change window (an emergency may not)
    const cw = require('./changewin'), why = o.when && !cw.emergency(p, { change: o }) ? cw.slotWhy(p, o.when) : '';
    if (why) throw bad(why);
    delete o.slotMisfit;
  }
  c.change = o;
}

function list(slug) { const p = proj(slug); return p.cards.filter(c => c.type === 'change').map(c => view(p, c)); }

function add(slug, b) {
  const p = proj(slug), title = str(b.title, 200);
  if (!title) throw bad('a change needs its title');
  const c = { id: p.key + '-' + p.nextId++, title: '🔀 ' + title.replace(/^🔀\s*/, ''), description: '', testSteps: '', type: 'change', priority: 'normal', status: 'backlog',
    assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: str(b.createdBy, 60), created: now(), updated: now(), comments: [] };
  fields(p, slug, c, b);   // before the card is stored: a bad field leaves the board as it was
  p.cards.push(c);
  save(p); return view(p, c);
}

function patch(slug, id, b) {
  const p = proj(slug), c = chg(p, id);
  fields(p, slug, c, b); c.updated = now(); save(p); return view(p, c);
}

module.exports = { KINDS, list, add, patch, view };
