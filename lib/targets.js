// Response targets (AIG-1048): a "reply by" time per card kind and priority, and the red clock on a card that is late.
// ONE table, in hours: TABLE[kind][priority]. 0 or missing = no target. The owner changes it in Setup (aigile.local.json "targets").
// Kinds: incident, friend (a card raised by a friend or the public feedback form), bug. Other types have none.
const fs = require('fs');
const path = require('path');
const { DATA, localSettings, owner } = require('./store');

const KINDS = ['incident', 'friend', 'bug'], PRIOS = ['low', 'normal', 'high', 'urgent'];
const all = h => ({ low: h, normal: h, high: h, urgent: h });
const TABLE = { incident: all(1), friend: all(48), bug: all(168) };   // hours: incident 1 h, friend request 2 days, bug 1 week

// The clock: AIGILE_NOW (ISO date-time or ms) or a data/now.stub file with the same, for tests; else the real time.
function now() {
  let v = process.env.AIGILE_NOW;
  if (!v) { try { v = fs.readFileSync(path.join(DATA, 'now.stub'), 'utf8').trim(); } catch {} }
  const t = v ? (/^\d+$/.test(v) ? Number(v) : Date.parse(v)) : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 365) : 0; };
// The table in force: the defaults with the owner's saved numbers on top.
function table(s = localSettings()) {
  const o = {}, saved = s.targets && typeof s.targets === 'object' ? s.targets : {};
  for (const k of KINDS) { o[k] = {}; for (const pr of PRIOS) o[k][pr] = saved[k] && pr in saved[k] ? num(saved[k][pr]) : TABLE[k][pr]; }
  return o;
}
// What Setup sends back: only known kinds and priorities, numbers of hours (blank/0 = none). Returns undefined when it equals the defaults.
function clean(v) {
  const o = {}; let diff = false;
  for (const k of KINDS) { o[k] = {}; for (const pr of PRIOS) { const n = v && v[k] && pr in v[k] ? num(v[k][pr]) : TABLE[k][pr]; o[k][pr] = n; if (n !== TABLE[k][pr]) diff = true; } }
  return diff ? o : undefined;
}
const kindOf = c => c.type === 'incident' ? 'incident' : (c.from === 'feedback' || c.forFriend || (c.share && c.share.theirs) || /\(via /.test(c.createdBy || '')) ? 'friend' : c.type === 'bug' ? 'bug' : '';
const isService = p => !!(p && p.service && p.service.on);
const hoursOf = (c, tb) => { const k = kindOf(c); return k ? (tb[k] || {})[c.priority] || 0 : 0; };
// Since when the reply is owed: the creation, or the owner's last comment.
function since(c) {
  const me = String(owner() || '').toLowerCase();
  let at = Date.parse(c.created || c.updated || 0);
  for (const m of c.comments || []) if (String(m.author || '').toLowerCase() === me && Date.parse(m.at) > at) at = Date.parse(m.at);
  return at;
}
// Hours of the target when the card is late, else 0. Open, not waiting on the owner, in a service project or an incident anywhere.
function late(c, p, tb = table()) {
  if (!c || c.status === 'done' || c.needsYou || c.status === 'verify' || c.dm || c.lifeType) return 0;
  if (c.type !== 'incident' && !isService(p)) return 0;
  const h = hoursOf(c, tb), at = since(c);
  return h && at && now() - at > h * 3600e3 ? h : 0;
}
// The project's cards with `late` (hours) stamped on the late ones; copies, the saved cards are untouched.
function stamp(p) {
  const tb = table();
  return (p.cards || []).map(c => { const h = late(c, p, tb); return h ? { ...c, late: h } : c; });
}
module.exports = { TABLE, KINDS, PRIOS, now, table, clean, kindOf, late, stamp };
