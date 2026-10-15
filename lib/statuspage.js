// 🟢 Public status page data (AIG-1050, docs/SERVICE-MGMT-PLAN.md phase 1): every project with service on AND public goes to the relay
// (signed POST /status, shown at GET /status.json and site/status.html) as { name, offers, state, line, at }. Never a card title or text.
// red = an open incident with c.major, amber = any other open incident, green = none. line = the newest "Status:" comment on the worst
// open incident, without the prefix (masked, 200 chars). Sent about 3 s after the last change, only when it changed.
const crypto = require('crypto');
const MS = () => Number(process.env.AIGILE_PUBLIC_MS) || 3000;
const dm = () => require('./dm');
let lastHash = null, timer = null, mine = new Set();
const STATUS = /^\s*status\s*:\s*/i;

function entry(p, mask) {
  const open = (p.cards || []).filter(c => c.type === 'incident' && c.status !== 'done');
  const major = open.filter(c => c.major === true);
  const worst = major.length ? major : open;
  const lines = [];
  for (const c of worst) for (const m of c.comments || []) if (STATUS.test(String(m.text || ''))) lines.push({ text: String(m.text).replace(STATUS, ''), at: m.at });
  lines.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const last = lines[lines.length - 1];
  const line = last ? mask(last.text.replace(/\s+/g, ' ').trim()).slice(0, 200) : '';
  const at = (last && last.at) || p.updated || new Date().toISOString();
  return { name: mask(p.name), offers: mask((p.service || {}).offers || ''), state: major.length ? 'red' : open.length ? 'amber' : 'green', line, at };
}
// projects: loaded project objects (default: all).
function compute(projects) {
  const S = require('./store'), mask = require('./mask').make();
  const list = projects || S.listSlugs().map(s => { try { return S.load(s); } catch { return null; } }).filter(Boolean);
  const m = s => mask(String(s == null ? '' : s));
  return list.filter(p => !p.archived && p.service && p.service.on && p.service.public).map(p => entry(p, m)).sort((a, b) => a.name.localeCompare(b.name));
}
async function push(force) {
  const services = compute(), body = { services }, hash = crypto.createHash('sha256').update(JSON.stringify(services.map(s => ({ ...s, at: '' })))).digest('hex');
  if (!force && hash === lastHash) return;
  const r = dm().relayAddress(); if (!r) return;
  try { await dm().relayCall(r, 'POST', '/status', body); lastHash = hash; } catch { lastHash = null; }
}
// A project was saved: if it is (or was) a public service, push soon. AIG-1119: after a restart `mine` starts empty, so the
// first save seeds it from what is public now and always pushes the full list: unticking Public after a restart unpublishes.
let seeded = false;
function changed(p) {
  const on = !!(p.service && p.service.on && p.service.public);
  const first = !seeded;
  if (first) { seeded = true; try { const S = require('./store'); for (const s of S.listSlugs()) { const q = s === p.slug ? p : S.load(s); if (q && q.service && q.service.on && q.service.public) mine.add(s); } } catch {} }
  if (!on && !mine.has(p.slug) && !first) return;
  if (on) mine.add(p.slug); else mine.delete(p.slug);
  clearTimeout(timer); timer = setTimeout(() => { timer = null; push().catch(() => {}); }, MS()); if (timer.unref) timer.unref();
}
module.exports = { compute, push, changed };
