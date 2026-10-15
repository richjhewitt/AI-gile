// Token cap per service (AIG-1156, docs/SERVICE-MGMT-PLAN.md phase 4): an optional monthly token limit per project,
// p.service.tokenCap (a whole number of tokens, empty = none). Month-to-date tokens are the finished runs' rows in
// data/logs/_runs.jsonl (input + cache writes + output, as lib/usage.js counts) since the 1st of this month, local time.
// guard(p) is called from today.aiOffGuard, the one gate every background start passes (presence.startTeam, swarm workers,
// group members, review wakes): at 100% it refuses with a reason and says so once a month on the board. note(p) is the
// brief line at 80%. The owner's own window sessions never pass here (startTeam passes byOwner and skips it).
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');
const { t: tr } = require('./i18n');

const capOf = p => { const sv = (p && p.service) || {}, n = sv.on ? Math.floor(+sv.tokenCap) : 0; return Number.isFinite(n) && n > 0 ? n : 0; };
const monthStart = (now = Date.now()) => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
function used(slug, now = Date.now()) {
  let rows = []; try { rows = fs.readFileSync(path.join(DATA, 'logs', '_runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch {}
  const from = monthStart(now);
  return rows.filter(r => r.slug === slug && r.end >= from).reduce((n, r) => n + (r.in || 0) + (r.out || 0), 0);
}
// null when no cap, else { cap, used, pct }.
function status(p, now = Date.now()) {
  const cap = capOf(p); if (!cap) return null;
  const u = used(p.slug, now);
  return { cap, used: u, pct: Math.floor(u / cap * 100) };
}
const m = n => (n >= 1e7 ? Math.round(n / 1e6) : +(n / 1e6).toFixed(1)) + 'M';
// The brief line at 80% or more, else ''.
function note(p) {
  const s = status(p); if (!s || s.pct < 80) return '';
  return s.pct >= 100 ? tr('srv.tokencap.brief100', { used: m(s.used), cap: m(s.cap) }) : tr('srv.tokencap.brief80', { used: m(s.used), cap: m(s.cap) });
}
const TOLD = path.join(DATA, 'tokencap.told');
// Throws when this month's tokens have reached the cap. Says why once a month on the newest doing card (else the team log).
function guard(p) {
  const s = status(p); if (!s || s.pct < 100) return;
  const text = tr('srv.tokencap.hold', { name: p.name, used: m(s.used), cap: m(s.cap) });
  const key = p.slug + '@' + new Date(monthStart()).toISOString().slice(0, 7) + '@' + s.cap;
  let told = []; try { told = JSON.parse(fs.readFileSync(TOLD, 'utf8')); } catch {}
  if (!told.includes(key)) {
    try {
      told.push(key); fs.writeFileSync(TOLD, JSON.stringify(told.slice(-200)));
      const S = require('./store'), q = S.load(p.slug) || p;
      const c = q.cards.filter(c => c.status === 'doing').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
      if (c) { c.comments.push({ author: '🧭 Lead Scrum Master', at: new Date().toISOString(), text }); c.updated = new Date().toISOString(); S.save(q); }
      else { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(path.join(DATA, 'logs', p.slug + '.log'), '=== token cap: ' + text + ' ===\n'); }
    } catch {}
  }
  throw bad(text, 409);
}
module.exports = { capOf, monthStart, used, status, note, guard };
