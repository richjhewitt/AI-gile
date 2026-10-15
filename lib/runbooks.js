// 📖 Runbooks (AIG-1107, docs/SERVICE-MGMT-PLAN.md phase 2): step-by-step "how to fix X" notes, plain markdown files in the project's
// folder, `docs/runbooks/<name>.md`. A problem or incident card may link one (`c.runbook` = the name); an incident card also shows
// the runbooks whose name shares a word with its title. A project without a folder has none.
const fs = require('fs');
const path = require('path');
const { now, load, save, bad } = require('./store');

const NAME = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,80}$/;
const SKIP = new Set(['incident', 'the', 'and', 'for', 'with', 'down', 'not', 'from', 'this', 'that', 'broken', 'error', 'issue']);
const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };
const dir = p => p.path ? path.join(p.path, 'docs', 'runbooks') : '';

// The runbook names (file names without .md), sorted.
function names(p) {
  const d = dir(p); if (!d) return [];
  try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isFile() && /\.md$/i.test(e.name)).map(e => e.name.replace(/\.md$/i, '')).filter(n => NAME.test(n)).sort(); } catch { return []; }
}
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 4 && !SKIP.has(w));
// The runbooks for a card: the linked one first, then those whose name shares a word with the card title.
function forCard(p, c) {
  const all = names(p), tw = new Set(words(c.title));
  const out = [];
  if (c.runbook && all.includes(c.runbook)) out.push({ name: c.runbook, linked: true });
  for (const n of all) if (n !== c.runbook && words(n).some(w => tw.has(w))) out.push({ name: n, linked: false });
  return out;
}
function read(slug, name) {
  const p = proj(slug), n = String(name || '').replace(/\.md$/i, '');
  if (!names(p).includes(n)) throw bad('no runbook "' + n.slice(0, 60) + '"', 404);
  return { name: n, path: 'docs/runbooks/' + n + '.md', text: fs.readFileSync(path.join(dir(p), n + '.md'), 'utf8') };
}
function list(slug) { return { runbooks: names(proj(slug)) }; }
function ofCard(slug, id) {
  const p = proj(slug), c = card(p, id);
  return { linked: c.runbook || '', names: names(p), matches: forCard(p, c) };
}
function card(p, id) {
  const c = (p.cards || []).find(x => x.id.toLowerCase() === String(id).toLowerCase());
  if (!c) throw bad('no such card', 404);
  if (c.type !== 'incident' && c.type !== 'problem') throw bad(c.id + ' is not an incident or problem card');
  return c;
}
// Links (or, with an empty name, unlinks) a runbook on a problem or incident card.
function link(slug, id, b) {
  const p = proj(slug), c = card(p, id), n = String((b || {}).runbook == null ? '' : b.runbook).trim().replace(/\.md$/i, '');
  if (n && !names(p).includes(n)) throw bad('no runbook "' + n.slice(0, 60) + '" in docs/runbooks', 404);
  if (n) c.runbook = n; else delete c.runbook;
  c.updated = now(); save(p);
  return ofCard(slug, id);
}
// The brief line for a service project: its runbook names, or ''.
function briefLine(p) {
  const n = names(p); if (!n.length) return '';
  return 'Runbooks: ' + n.slice(0, 20).join(', ') + (n.length > 20 ? ` (+${n.length - 20} more)` : '') + ' (aigile runbook ' + p.slug + ' <name>)';
}

module.exports = { names, forCard, read, list, ofCard, link, briefLine };
