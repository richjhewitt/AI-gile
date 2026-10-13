// Change roles (AIG-856, spec: docs/CHANGE-CONTROL.md "Change system"). Three roles on top of a friend's share role,
// set per project by the owner only: Project manager (one or more friends), Test lead and Dev lead (one "who" each).
// A "who" is a roster name (agent or person) or `@<contactId>` for a friend. Stored as p.changeRoles =
// { pm: ['@cid'], testLead: 'who', devLead: 'who' }; a project without it has no change roles, so old data is untouched.
// The change card (AIG-857) and the go / no-go chain (AIG-858) ask this module, never the project file: holds(), pmOf(), leads().
const fs = require('fs');
const path = require('path');
const { DATA, load, save, bad } = require('./store');

const ROLES = ['pm', 'testLead', 'devLead'];
const cid = /^@[A-Za-z0-9_-]{1,64}$/;
const proj = slug => { const p = load(slug); if (!p) throw bad('project not found', 404); return p; };
const contacts = () => { try { return require('./dm').contacts(); } catch { return []; } };

// One "who": a friend (@id, must be one of my contacts) or a roster name on this project. '' = nobody.
function who(p, v, friendOnly) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!s) return '';
  if (s[0] === '@') {
    if (!cid.test(s) || !contacts().some(c => '@' + c.id === s)) throw bad(s.slice(0, 40) + ' is not one of your friends', 404);
    return s;
  }
  if (friendOnly) { const c = contacts().find(c => String(c.name).toLowerCase() === s.toLowerCase()); if (!c) throw bad('"' + s + '" is not one of your friends', 404); return '@' + c.id; }
  const m = (p.team || []).find(m => String(m.name).toLowerCase() === s.toLowerCase());
  const f = !m && contacts().find(c => String(c.name).toLowerCase() === s.toLowerCase());
  if (f) return '@' + f.id;
  if (!m) throw bad('"' + s + '" is not on the team of this project', 404);
  return m.name;
}

const friendId = v => { const s = String(v || '').trim(); if (cid.test(s)) return s; const c = contacts().find(c => String(c.name).toLowerCase() === s.toLowerCase()); return c ? '@' + c.id : s; };

const clean = cr => ({ pm: Array.isArray(cr && cr.pm) ? cr.pm.filter(x => typeof x === 'string') : [], testLead: String((cr && cr.testLead) || ''), devLead: String((cr && cr.devLead) || '') });
const get = p => clean(p && p.changeRoles);
const isEmpty = r => !r.pm.length && !r.testLead && !r.devLead;

// Which change roles this friend holds on this project, e.g. ['pm', 'testLead'].
// The roles are read from the project file only when its time or size changed: this runs for every link on every poll.
const seen = new Map();
function rolesOf(slug) {
  let st; try { st = fs.statSync(path.join(DATA, slug + '.json')); } catch { return null; }
  const key = st.mtimeMs + ':' + st.size, hit = seen.get(slug);
  if (hit && hit.key === key) return hit.r;
  const p = load(slug), r = p ? get(p) : null;
  seen.set(slug, { key, r }); return r;
}
function holds(slug, contact) {
  const r = slug && contact && /^[a-z0-9-]+$/.test(slug) ? rolesOf(slug) : null; if (!r) return [];
  const me = '@' + contact, out = [];
  if (r.pm.includes(me)) out.push('pm');
  if (r.testLead === me) out.push('testLead');
  if (r.devLead === me) out.push('devLead');
  return out;
}
const pmOf = p => get(p).pm.slice();
const leads = p => { const r = get(p); return { testLead: r.testLead, devLead: r.devLead }; };

// Body: { pm: ['@id'] (replace) | { add, remove }, testLead, devLead } (a "who", '' clears).
function set(slug, b) {
  b = b || {};
  const p = proj(slug), r = get(p), before = JSON.stringify(r);
  if ('pm' in b) {
    const m = b.pm;
    if (Array.isArray(m)) r.pm = [...new Set(m.map(x => who(p, x, true)).filter(Boolean))];
    else if (m && typeof m === 'object') {
      if (m.add) r.pm = [...new Set([...r.pm, who(p, m.add, true)])];
      if (m.remove) { const x = friendId(m.remove); r.pm = r.pm.filter(y => y !== x); }
    } else throw bad('pm must be a list of friends, or { add, remove }');
    if (r.pm.length > 20) throw bad('at most 20 project managers');
  }
  for (const k of ['testLead', 'devLead']) if (k in b) r[k] = who(p, b[k]);
  const changed = JSON.stringify(r) !== before;
  if (isEmpty(r)) delete p.changeRoles; else p.changeRoles = r;
  if (changed) save(p);
  if (changed) tell(slug, before, r);
  return view(p);
}

const view = p => ({ ...get(p), friends: contacts().map(c => ({ id: '@' + c.id, name: c.name })) });

// Tell the friends whose roles moved (a label, like the share role message: it never gives them a power by itself).
function tell(slug, beforeJson, now) {
  setImmediate(async () => {
    try {
      const base = require('./share-base'), was = JSON.parse(beforeJson);
      const ids = new Set([...was.pm, was.testLead, was.devLead, ...now.pm, now.testLead, now.devLead].filter(x => x && x[0] === '@').map(x => x.slice(1)));
      for (const L of base.all()) if (L.slug === slug && ids.has(L.contact) && L.state === 'live' && L.on !== false) await base.sendOn(L.id, 'role', base.roleMsg(L)).catch(() => {});
    } catch {}
  });
}

const viewOf = slug => view(proj(slug));

module.exports = { ROLES, get, set, view, viewOf, holds, pmOf, leads };
