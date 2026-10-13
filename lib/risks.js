// ⚠️ Risk register (AIG-863): a list of risks per project, filled in by agents, kept in data/<slug>.risks (not .json:
// every .json in data/ is a project). Score = likelihood x impact (1-3 each). A risk set to `happened` files a 🔥 incident card.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, bad, writeAtomic } = require('./store');

const STATUSES = ['open', 'watching', 'closed', 'happened'];
const file = slug => path.join(DATA, String(slug).replace(/[\/\\]/g, '') + '.risks');
// Only a missing file is an empty register; a corrupt one raises, so the next write can't wipe it.
const read = slug => {
  let raw; try { raw = fs.readFileSync(file(slug), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return { next: 1, risks: [] }; throw e; }
  let j; try { j = JSON.parse(raw); } catch { throw bad('the risk register of ' + slug + ' is damaged (' + path.basename(file(slug)) + '): not changed', 500); }
  return { next: j.next || 1, risks: Array.isArray(j.risks) ? j.risks : [] };
};
const write = (slug, s) => writeAtomic(file(slug), JSON.stringify(s));
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const level = (v, what) => { const n = Number(v); if (![1, 2, 3].includes(n)) throw bad(what + ' must be 1, 2 or 3'); return n; };
const day = v => { const s = str(v, 10); if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad('review must be YYYY-MM-DD'); return s; };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// Overdue = the review date has passed and the risk is still being watched (open or watching).
const overdue = r => !!r.review && r.review < today() && (r.status === 'open' || r.status === 'watching');
const view = r => ({ ...r, score: (r.likelihood || 1) * (r.impact || 1), overdue: overdue(r) });
const sorted = list => list.map(view).sort((a, b) => b.score - a.score || String(a.review || '9').localeCompare(String(b.review || '9')) || a.n - b.n);

function list(slug) { return sorted(read(slug).risks); }
function overdueCount(slug) { return read(slug).risks.filter(overdue).length; }

function add(slug, b) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const risk = str(b.risk, 300); if (!risk) throw bad('a risk needs its text');
  const s = read(slug), n = s.next++;
  const status = b.status ? str(b.status, 20) : 'open'; if (!STATUSES.includes(status)) throw bad('status must be ' + STATUSES.join(', '));
  const some = v => v === undefined || v === null || v === '';
  const r = { id: 'R-' + n, n, risk, card: str(b.card, 40), category: str(b.category, 40),
    likelihood: level(some(b.likelihood) ? 2 : b.likelihood, 'likelihood'), impact: level(some(b.impact) ? 2 : b.impact, 'impact'),
    owner: str(b.owner, 60), mitigation: str(b.mitigation, 1000), warning: str(b.warning, 500), status, review: day(b.review),
    createdBy: str(b.createdBy, 60), created: now(), updated: now() };
  s.risks.push(r);
  if (status === 'happened') incident(p, r);
  write(slug, s); return view(r);
}

function patch(slug, id, b) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const s = read(slug), r = s.risks.find(x => x.id === id);
  if (!r) throw bad('no such risk', 404);
  const was = r.status;
  if (b.risk !== undefined) { const t = str(b.risk, 300); if (!t) throw bad('a risk needs its text'); r.risk = t; }
  for (const [k, n] of [['card', 40], ['category', 40], ['owner', 60], ['mitigation', 1000], ['warning', 500]]) if (b[k] !== undefined) r[k] = str(b[k], n);
  if (b.likelihood !== undefined) r.likelihood = level(b.likelihood, 'likelihood');
  if (b.impact !== undefined) r.impact = level(b.impact, 'impact');
  if (b.review !== undefined) r.review = day(b.review);
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) throw bad('status must be ' + STATUSES.join(', ')); r.status = b.status; }
  r.updated = now();
  if (r.status === 'happened' && was !== 'happened' && !r.incident) incident(p, r);
  write(slug, s); return view(r);
}

// 🔥 A risk that happens becomes an incident card (bug, high), linked both ways (riskId on the card, incident on the risk).
function incident(p, r) {
  const had = p.cards.find(x => x.riskId === r.id); if (had) { r.incident = had.id; return had; }   // idempotent: one incident card per risk
  const c = { id: p.key + '-' + p.nextId++, title: '🔥 Incident: ' + r.risk, description: `Risk ${r.id} happened.` + (r.mitigation ? '\nMitigation planned: ' + r.mitigation : ''),
    testSteps: '', type: 'bug', priority: 'high', status: 'backlog', assignee: '', sprint: '', blocked: false, needsYou: false,
    riskId: r.id, createdBy: r.createdBy || '', created: now(), updated: now(), comments: [] };
  p.cards.push(c); save(p); r.incident = c.id; return c;
}
module.exports = { STATUSES, list, add, patch, overdueCount, read };
