// AIG-1344: who on a team is really working now, the one rule for every place that shows team status (board Team panel,
// Home crew line, What's happening, stand-ups, the public board). A member counts as working when their status says working
// or in review and they are running now (a swarm worker on their card, or the lead while the team is online) or were heard
// from in the last 12 hours (AIG-1257/AIG-1211). Everyone else is idle, with `updated` as "last seen".
// tidy() clears a stale "working" so the data stops lying: after 12 hours, or when the project's run ends with no
// session left. Nobody is removed and the task and last-seen time stay. The page has the same rule in public/js/board.js (teamLive).
// AIG-1434: a named helper's CLI write (node aigile.js ... --as <Name>: comment, move, test, checked, add, edit) counts as working
// for 15 minutes after its last one, on the team or not (a helper not on the team shows as a guest row). The owner never counts.
// The writes are kept in memory per project and go out in presence.cli ([{ name, at }]), so the page and every count see them.
const LIVE_MS = 12 * 3600e3;
const CLI_MS = () => Number(process.env.AIGILE_CLI_LIVE_MS) || 15 * 60e3;
const cliWrites = new Map(), expiry = new Map();   // slug -> Map(lower-case name -> { name, at }); slug -> timer
function wrote(slug, name) {
  name = String(name || '').trim().slice(0, 60);
  if (!slug || !name) return;
  try { if (require('./store').isRich(name)) return; } catch {}
  if (!cliWrites.has(slug)) cliWrites.set(slug, new Map());
  cliWrites.get(slug).set(name.toLowerCase(), { name, at: Date.now() });
  // When the window ends nothing is saved, so a public board is sent again then and drops the helper from its team.
  clearTimeout(expiry.get(slug));
  const tm = setTimeout(() => { expiry.delete(slug); try { if ((require('./store').load(slug) || {}).public) require('./publicboard').changed(slug); } catch {} }, CLI_MS() + 1000);
  if (tm.unref) tm.unref();
  expiry.set(slug, tm);
}
function cliOf(slug) {
  const m = cliWrites.get(slug); if (!m) return [];
  const t = Date.now(), out = [];
  for (const [k, w] of m) { if (t - w.at >= CLI_MS()) m.delete(k); else out.push({ name: w.name, at: new Date(w.at).toISOString(), until: new Date(w.at + CLI_MS()).toISOString() }); }
  if (!m.size) cliWrites.delete(slug);
  return out;
}
const IDLE = '💤 idle';
const isLead = m => /lead/i.test((m.name || '') + ' ' + (m.role || ''));
const busy = m => /working|review/i.test(m.status || '');
const fresh = (m, t = Date.now()) => t - Date.parse(m.updated || 0) < LIVE_MS;
// ctx: { names: Set of lower-case names running now, online: the team's session or run is live }
function ctxOf(p, pr) {
  pr = pr || {};
  const ids = new Set((pr.workers || []).map(w => w.id));
  const names = new Set((p.cards || []).filter(c => ids.has(c.id) && c.assignee).map(c => String(c.assignee).toLowerCase()));
  const cli = new Map((pr.cli || []).map(w => [String(w.name).toLowerCase(), Date.parse(w.at)])), cliNames = {};
  for (const w of pr.cli || []) cliNames[String(w.name).toLowerCase()] = w.name;
  return { names, online: !!(pr.online || pr.running), cli, cliNames };
}
const viaCli = (m, ctx = {}) => { const k = String(m.name || '').toLowerCase(); return !!ctx.cli && ctx.cli.has(k) && Date.now() - ctx.cli.get(k) < CLI_MS(); };
const live = (m, ctx = {}) => viaCli(m, ctx) || busy(m) && ((ctx.names && ctx.names.has(String(m.name || '').toLowerCase())) || (isLead(m) && !!ctx.online) || fresh(m));
// Helpers idle for 12 hours are from an earlier session (AIG-269): left out of the brief and the stand-up.
// A stale "working" counts as idle here too, so the brief and the stand-up never wait on an agent from weeks ago.
const stale = (m, ctx) => !viaCli(m, ctx) && m.kind !== 'person' && !isLead(m) && (/idle/i.test(m.status || '') || (busy(m) && !live(m, ctx))) && !fresh(m);

// The team plus a guest row for each helper heard from on the CLI who is not on it (AIG-1434).
function members(p, ctx = {}) {
  const team = p.team || [], on = new Set(team.map(m => String(m.name || '').toLowerCase()));
  const guests = [...(ctx.cli || new Map())].filter(([k, at]) => !on.has(k) && Date.now() - at < CLI_MS()).map(([k, at]) => ({ name: (ctx.cliNames || {})[k] || k, status: '', updated: new Date(at).toISOString(), cli: true }));
  return guests.length ? [...team, ...guests] : team;
}

// Clears stale "working" / "in review" statuses on an agent. ended: the run is over, so nobody of it is working any more.
function tidy(p, o = {}) {
  let n = 0;
  const ctx = o.ctx || { names: new Set(), online: false }, t = Date.now();
  for (const m of p.team || []) {
    if (!m || m.kind === 'person' || !busy(m) || /retired/i.test(m.status || '')) continue;
    if (o.ended ? !(ctx.names.has(String(m.name || '').toLowerCase())) : !live(m, ctx) && !fresh(m, t)) { m.status = IDLE; n++; }   // m.updated stays: last seen
  }
  return n;
}
function sweep() {
  const S = require('./store'), P = require('./presence');
  let n = 0;
  for (const slug of S.listSlugs()) {
    let p; try { p = S.load(slug); } catch { continue; }
    if (!p || !(p.team || []).length) continue;
    let pr = {}; try { pr = P.presenceOf(slug); } catch {}
    const k = tidy(p, { ctx: ctxOf(p, pr) });
    if (k) { try { S.save(p); n += k; } catch {} }
  }
  return n;
}
// The project's background run ended (or its session closed) and no session is left: its "working" members go idle.
function runEnded(slug) {
  try {
    const S = require('./store'), P = require('./presence'), p = S.load(slug);
    if (!p || P.leadActive(p) || P.presenceOf(slug).running) return 0;
    const n = tidy(p, { ended: true, ctx: ctxOf(p, P.presenceOf(slug)) });
    if (n) S.save(p);
    return n;
  } catch { return 0; }
}
let timer = null;
function start() {
  if (timer) return;
  const every = Number(process.env.AIGILE_TEAMTIDY_MS) || 30 * 60e3;
  setTimeout(() => { try { sweep(); } catch {} }, Math.min(every, 10e3)).unref();
  timer = setInterval(() => { try { sweep(); } catch {} }, every); timer.unref();
}

module.exports = { LIVE_MS, CLI_MS, IDLE, isLead, busy, fresh, ctxOf, live, viaCli, wrote, cliOf, members, stale, tidy, sweep, runEnded, start };
