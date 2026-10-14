// 🛎️ Service details on a project (AIG-1046, docs/SERVICE-MGMT-PLAN.md phase 1): an opt-in section saying "this project is a
// service": what it offers, who uses it, its web address, who is on call and whether it may show on a public status page.
// Stored as p.service = { on, offers, users, url, onCall, public }, only when set. Other cards (uptime checks, incidents,
// status page) read it through of(p), onCall(p) and services().
const roster = p => (p.team || []).filter(m => !/retired/i.test(m.status || '') && m.kind !== 'person');
const leadName = p => { const t = roster(p), l = t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0]; return l ? l.name : 'Lead'; };

// The web address: http(s) only, up to 500 characters; empty clears it (like store.callUrl).
function urlOf(v) {
  const s = String(v == null ? '' : v).trim(); if (!s) return '';
  let u; try { u = new URL(s); } catch { throw require('./store').bad('the web address must be a web address (https://...)'); }
  if (!/^https?:$/.test(u.protocol) || s.length > 500) throw require('./store').bad('the web address must start with http:// or https://');
  return s;
}
const line = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

// The project's service, normalised, or null when it is not (switched on as) a service.
function of(p) {
  const s = p && p.service; if (!s || !s.on) return null;
  return { on: true, offers: s.offers || '', users: s.users || '', url: s.url || '', onCall: onCall(p), public: !!s.public };
}
// The on-call agent's name: the chosen one while still on the roster, else the lead.
function onCall(p) {
  const want = String((p.service || {}).onCall || '').trim().toLowerCase();
  const m = want && roster(p).find(m => m.name.toLowerCase() === want);
  return m ? m.name : leadName(p);
}
// Every service across projects: [{ slug, name, ...service }].
function services(projects) {
  const S = require('./store'), list = projects || S.listSlugs().map(s => { try { return S.load(s); } catch { return null; } }).filter(Boolean);
  return list.filter(p => !p.archived).map(p => { const s = of(p); return s && { slug: p.slug, name: p.name, ...s }; }).filter(Boolean);
}
// PATCH: validates and stores b (an object); off with nothing else filled in stores nothing.
function set(p, b) {
  b = b && typeof b === 'object' ? b : {};
  const old = p.service || {}, on = 'on' in b ? !!b.on : !!old.on;
  const s = {
    on,
    offers: 'offers' in b ? line(b.offers, 200) : old.offers || '',
    users: 'users' in b ? line(b.users, 200) : old.users || '',
    url: 'url' in b ? urlOf(b.url) : old.url || '',
    onCall: 'onCall' in b ? line(b.onCall, 60) : old.onCall || '',
    public: 'public' in b ? !!b.public : !!old.public,
  };
  if (s.onCall && !roster(p).some(m => m.name.toLowerCase() === s.onCall.toLowerCase())) throw require('./store').bad('the on-call agent must be on this project\'s team');
  for (const k of ['offers', 'users', 'url', 'onCall']) if (!s[k]) delete s[k];
  if (!s.public) delete s.public;
  p.service = s.on || Object.keys(s).length > 1 ? s : undefined;
}
module.exports = { of, onCall, services, set, roster, leadName };
