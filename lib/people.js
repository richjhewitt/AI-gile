// 👥 Humans and Agents (AIG-1314): three plain counts for the teaser, sent to the relay (signed POST /people, served at GET /people.json).
// humans = you + friends who joined from one of your invite links (their contact id is the invite's id, so it is counted here, never named);
// agents = AI team members on your boards (not people, not friends, not retired); working = live sessions now (a lead + its swarm workers).
// Only the operator's board gets through (the relay takes it from RELAY_STATS_KEY only); any other board is told no and waits 6 hours.
// Sent about every 5 minutes, only when a number changed. AIGILE_PEOPLE_MS: the interval (tests); AIGILE_NO_PEOPLE: never.
const fs = require('fs');
const path = require('path');
const dm = () => require('./dm');
const EVERY = () => Number(process.env.AIGILE_PEOPLE_MS) || 5 * 60e3;
const REFUSED_MS = 6 * 3600e3;
let last = null, refused = 0;

function compute() {
  const S = require('./store');
  let agents = 0, working = 0;
  for (const slug of S.listSlugs()) {
    let p; try { p = S.load(slug); } catch { continue; }
    if (!p || p.archived || p.sample) continue;
    const crew = (p.team || []).filter(m => m && m.kind !== 'person' && !m.friend && !/retired/i.test(m.status || '')).length;
    agents += crew;
    try { const pr = require('./presence').presenceOf(slug); if (crew && pr.online) working += Math.min(crew, 1 + (pr.workers || []).length); } catch {}
  }
  let friends = 0;
  try {
    const ids = new Set(dm().contacts().filter(c => !c.blocked).map(c => c.id));
    const codes = JSON.parse(fs.readFileSync(path.join(S.DATA, 'join', 'codes.json'), 'utf8'));
    friends = new Set((Array.isArray(codes) ? codes : []).filter(c => c && c.kind !== 'site' && c.inv && ids.has(c.inv)).map(c => c.inv)).size;
  } catch {}
  return { humans: 1 + friends, agents, working: Math.min(working, agents) };
}
async function push() {
  if (refused && Date.now() - refused < REFUSED_MS) return;
  const r = dm().relayAddress(); if (!r) return;
  const body = compute(), key = JSON.stringify(body);
  if (key === last) return;
  try { await dm().relayCall(r, 'POST', '/people', body); last = key; refused = 0; }
  catch (e) { if (/said (403|404)/.test(e.message)) refused = Date.now(); }
}
function start() {
  if (process.env.AIGILE_NO_PEOPLE) return;
  setTimeout(function tick() { push().catch(() => {}); setTimeout(tick, EVERY()).unref(); }, Math.min(EVERY(), 30e3)).unref();
}
module.exports = { compute, push, start };
