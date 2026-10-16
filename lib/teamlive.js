// AIG-1344: who on a team is really working now, the one rule for every place that shows team status (board Team panel,
// Home crew line, What's happening, stand-ups, the public board). A member counts as working when their status says working
// or in review and they are running now (a swarm worker on their card, or the lead while the team is online) or were heard
// from in the last 12 hours (AIG-1257/AIG-1211). Everyone else is idle, with `updated` as "last seen".
// tidy() clears a stale "working" so the data stops lying: after 12 hours, or when the project's run ends with no
// session left. Nobody is removed and the task and last-seen time stay. The page has the same rule in public/js/board.js (teamLive).
const LIVE_MS = 12 * 3600e3;
const IDLE = '💤 idle';
const isLead = m => /lead/i.test((m.name || '') + ' ' + (m.role || ''));
const busy = m => /working|review/i.test(m.status || '');
const fresh = (m, t = Date.now()) => t - Date.parse(m.updated || 0) < LIVE_MS;
// ctx: { names: Set of lower-case names running now, online: the team's session or run is live }
function ctxOf(p, pr) {
  pr = pr || {};
  const ids = new Set((pr.workers || []).map(w => w.id));
  const names = new Set((p.cards || []).filter(c => ids.has(c.id) && c.assignee).map(c => String(c.assignee).toLowerCase()));
  return { names, online: !!(pr.online || pr.running) };
}
const live = (m, ctx = {}) => busy(m) && ((ctx.names && ctx.names.has(String(m.name || '').toLowerCase())) || (isLead(m) && !!ctx.online) || fresh(m));
// Helpers idle for 12 hours are from an earlier session (AIG-269): left out of the brief and the stand-up.
// A stale "working" counts as idle here too, so the brief and the stand-up never wait on an agent from weeks ago.
const stale = (m, ctx) => m.kind !== 'person' && !isLead(m) && (/idle/i.test(m.status || '') || (busy(m) && !live(m, ctx))) && !fresh(m);

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

module.exports = { LIVE_MS, IDLE, isLead, busy, fresh, ctxOf, live, stale, tidy, sweep, runEnded, start };
