// Releases per project (AIG-1154, service phase 4): "🚀 New release" names a release (v1.3), gathers the done cards (and done change cards)
// since the previous release, writes short notes in plain code from the titles (grouped by type, no AI), and keeps it on the project as
// p.releases [{ name, at, by, cards: [ids], notes, rollback? }]. "Roll back" turns the release's change cards' undo steps (c.change.undo)
// into a checklist card for the team: no git action is ever taken. Owner and a lead can create and roll back (see canAct).
const { now, load, save, bad, isRich } = require('./store');
const { t: tr } = require('./i18n');

const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };
const chore = c => /^(💬|📣|🧹)/u.test(c.title);   // DMs, stand-ups and tidy-ups are not release news (as tools/gen/release-notes.mjs)
const GROUPS = [['feature', 'srv.rel.new'], ['bug', 'srv.rel.fixed'], ['change', 'srv.rel.changes'], ['', 'srv.rel.other']];

// Owner always; otherwise a named team member who is a lead (by name or role), or the dev / test lead of the change roles.
function canAct(p, as) {
  as = str(as, 80);
  if (!as || isRich(as)) return true;
  const low = as.toLowerCase();
  const m = (p.team || []).find(x => String(x.name).toLowerCase() === low);
  if (m && /lead/i.test(m.name + ' ' + (m.role || ''))) return true;
  try { const r = require('./changeroles').get(p); return [r.devLead, r.testLead].some(x => x && String(x).toLowerCase() === low); } catch { return false; }
}
function guard(p, as) { if (!canAct(p, as)) throw bad('only the owner or a lead can do this', 403); }

function notesOf(cards) {
  const out = [];
  for (const [type, key] of GROUPS) {
    const list = cards.filter(c => type ? c.type === type : !['feature', 'bug', 'change'].includes(c.type));
    if (!list.length) continue;
    out.push(tr(key) + ' (' + list.length + ')', ...list.map(c => '- ' + c.title.replace(/^🔀\s*/, '') + ' (' + c.id + ')'), '');
  }
  return out.join('\n').trim() || tr('srv.rel.none');
}

const view = (p, r) => ({ name: r.name, at: r.at, by: r.by || '', cards: r.cards.slice(), notes: r.notes, ...(r.rollback ? { rollback: r.rollback } : {}),
  changes: r.cards.filter(id => { const c = (p.cards || []).find(x => x.id === id); return c && c.type === 'change' && c.change && c.change.undo; }).length });

// The done cards not in an earlier release and updated since the last one.
function pending(p) {
  const rs = p.releases || [], since = rs.length ? rs[rs.length - 1].at : '', used = new Set(rs.flatMap(r => r.cards));
  return (p.cards || []).filter(c => c.status === 'done' && !chore(c) && !used.has(c.id) && String(c.updated || c.created || '') > since);
}
const list = slug => { const p = proj(slug); return { releases: (p.releases || []).map(r => view(p, r)).reverse(), next: pending(p).length }; };

function create(slug, b, as) {
  const p = proj(slug); guard(p, as);
  const name = str(b.name, 40);
  if (!name) throw bad('a release needs its name (like v1.3)');
  if ((p.releases || []).some(r => r.name.toLowerCase() === name.toLowerCase())) throw bad('there is already a release called ' + name);
  const cards = pending(p), r = { name, at: now(), by: str(as, 60) || 'owner', cards: cards.map(c => c.id), notes: notesOf(cards) };
  (p.releases = p.releases || []).push(r);
  save(p);
  return view(p, r);
}

function rollback(slug, name, as) {
  const p = proj(slug); guard(p, as);
  const r = (p.releases || []).find(x => x.name.toLowerCase() === String(name || '').toLowerCase());
  if (!r) throw bad('no release called ' + str(name, 40), 404);
  if (r.rollback) throw bad('release ' + r.name + ' already has a roll-back card (' + r.rollback + ')');
  const steps = r.cards.map(id => (p.cards || []).find(c => c.id === id)).filter(c => c && c.type === 'change' && c.change && c.change.undo).reverse();
  if (!steps.length) throw bad('no change card in ' + r.name + ' has an undo step');
  const c = { id: p.key + '-' + p.nextId++, title: tr('srv.rel.rb.title', { name: r.name }), type: 'task', priority: 'normal', status: 'backlog',
    description: tr('srv.rel.rb.desc', { name: r.name }), testSteps: '', assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: str(as, 60) || 'owner', created: now(), updated: now(),
    checklist: steps.map(x => ({ text: x.id + ': ' + x.change.undo })), comments: [] };
  p.cards.push(c); r.rollback = c.id; save(p);
  return { release: view(p, r), card: c.id, steps: steps.length };
}

module.exports = { list, create, rollback, canAct, pending };
