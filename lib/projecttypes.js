// Project types (AIG-442): profiles/project-types.json holds default scale tweaks per type of project. Picking one writes them as
// the project's own numbers (p.profiles, the same per-project override the Team dialog edits), for every role on the team.
// The earlier numbers and type are kept in p.typeUndo so one Undo puts them back.
const fs = require('fs');
const path = require('path');
const PR = require('./profiles');

const FILE = path.join(__dirname, '..', 'profiles', 'project-types.json');
let cache = null;
const types = () => cache || (cache = JSON.parse(fs.readFileSync(FILE, 'utf8')).types);
const list = () => types().map(t => ({ id: t.id, owner: t.owner || {}, roles: t.roles || {} }));

const clean = (sc, keys) => Object.fromEntries(Object.entries(sc || {}).filter(([k, v]) => keys.includes(k) && PR.inRange(k, v) !== null).map(([k, v]) => [k, Number(v)]));
// The numbers a type gives each role on the project (role id -> scales), and the owner's.
function plan(type, roles) {
  const t = types().find(x => x.id === type); if (!t) return null;
  const out = {}, owner = clean(t.owner, PR.OWNER_KEYS);
  for (const id of PR.roleIds(roles)) {
    const sc = { ...clean((t.roles || {}).all, PR.ROLE_KEYS), ...clean((t.roles || {})[PR.groupOf(id)], PR.ROLE_KEYS) };
    if (Object.keys(sc).length) out[id] = sc;
  }
  return { roles: out, owner };
}
// Applies it to the project in place; returns what changed, for the "what changed" line.
function apply(p, type) {
  const pl = plan(type, p.roles); if (!pl) return null;
  const before = p.profiles || {}, next = { ...(Object.keys(pl.owner).length ? { owner: pl.owner } : {}), ...pl.roles };
  p.typeUndo = { type: p.projectType || '', profiles: p.profiles || null };
  p.projectType = type;
  p.profiles = Object.keys(next).length ? next : undefined;
  const changed = Object.keys(next).filter(k => JSON.stringify(next[k]) !== JSON.stringify(before[k])).map(k => ({ role: k, scales: next[k] }));
  return { type, changed, cleared: Object.keys(before).filter(k => !(k in next)) };
}
function undo(p) {
  if (!p.typeUndo) return null;
  const u = p.typeUndo; delete p.typeUndo;
  if (u.type) p.projectType = u.type; else delete p.projectType;
  p.profiles = u.profiles || undefined;
  return { type: u.type };
}
// Load another template's numbers into one role on this project (that role only): replaces that role's project numbers.
function loadTemplate(p, roleId, templateId) {
  const t = PR.template(templateId); if (!t) return null;
  const pp = p.profiles || {}, sc = clean(t.scales, PR.ROLE_KEYS);
  if (Object.keys(sc).length) pp[roleId] = sc; else delete pp[roleId];
  p.profiles = Object.keys(pp).length ? pp : undefined;
  return sc;
}

module.exports = { list, plan, apply, undo, loadTemplate };
