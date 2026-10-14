// Roles (AIG-676, AIG-677): who may make projects, and who gets access to the owner's servers.
// canMake: aigile.local.json { canMake: { "name": true|false } }. No entry = the default: on for the owner and for leads, off
// for friends, helpers and everyone else. Old data has no field, so it gets the defaults.
// Server access lives on each servers entry: access { "name": "run"|"admin" } (none = no entry). Default: owner only.
// The board enforces what it controls: new projects, and the ▶ Run buttons. "admin" is a record: the ssh key is added on the server by hand.
const { localSettings, load, listSlugs, owner, isRich, bad } = require('./store');

const LEVELS = ['none', 'run', 'admin'];
const lc = n => String(n || '').trim().toLowerCase();

// Everyone on any active roster (agent or person), once, with what they are and where (AIG-1004: places = project + role).
function roster() {
  const seen = new Map();
  for (const slug of listSlugs()) {
    const p = load(slug); if (!p || p.archived) continue;
    for (const m of p.team || []) {
      if (!m.name || /retired/i.test(m.status || '') || isRich(m.name)) continue;
      const k = lc(m.name), o = seen.get(k) || { name: m.name, kind: m.kind === 'person' ? 'person' : 'agent', lead: false, friend: false, helper: false, places: [] };
      o.places.push({ project: p.name || slug, role: String(m.role || '').trim() });
      if (/lead/i.test(m.name + ' ' + (m.role || ''))) o.lead = true;
      if (m.friend) o.friend = true;
      if (/helper/i.test(m.name + ' ' + (m.role || ''))) o.helper = true;
      seen.set(k, o);
    }
  }
  return [...seen.values()];
}
const defaultOf = e => !e.friend && !e.helper && e.lead;
function canMake(name) {
  if (!lc(name) || isRich(name)) return true;
  const set = (localSettings().canMake || {})[lc(name)];
  if (typeof set === 'boolean') return set;
  const e = roster().find(x => lc(x.name) === lc(name));
  return e ? defaultOf(e) : false;
}
function status() {
  const stored = localSettings().canMake || {};
  const people = [{ name: owner(), kind: 'owner', canMake: true, fixed: true }, ...roster().map(e => ({ name: e.name, kind: e.kind, places: e.places, canMake: typeof stored[lc(e.name)] === 'boolean' ? stored[lc(e.name)] : defaultOf(e), isDefault: typeof stored[lc(e.name)] !== 'boolean' }))];
  return { people, makers: people.filter(x => x.canMake).map(x => x.name), levels: LEVELS };
}
// Saved with the other local settings (setup.js applyPrefs, key canMake).
function setCanMake(name, on) {
  if (!lc(name)) throw bad('name is required');
  if (isRich(name)) throw bad('the owner can always make projects');
  const cur = { ...(localSettings().canMake || {}) };
  cur[lc(name)] = !!on;
  require('./setup').applyPrefs({ canMake: cur });
  return status();
}
// Routes call this with the caller's name (X-Aigile-As). No name = the board's page or the owner's own terminal.
function mayMake(as) {
  if (!lc(as) || canMake(as)) return;
  const who = status().makers.filter(n => !isRich(n));
  throw bad(`${as} can't make projects: ask someone who can (${[owner(), ...who].join(', ')})`, 403);
}

// ---- servers (AIG-677)
function levelIn(srv, name) {
  if (!lc(name) || isRich(name)) return 'admin';
  const a = (srv && srv.access) || {}, k = Object.keys(a).find(x => lc(x) === lc(name));
  return k && LEVELS.includes(a[k]) ? a[k] : 'none';
}
const canRun = lvl => lvl === 'run' || lvl === 'admin';

module.exports = { LEVELS, roster, canMake, status, setCanMake, mayMake, levelIn, canRun };
