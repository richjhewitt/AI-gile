// 🚨 All hands on deck (AIG-822): every team drops what it's doing and the one swarm project gets the usage left.
// While on, background runs for other projects don't start (the owner's own Wake still does); they are noted and woken
// again when the swarm ends. The swarm project's brief lifts the helper cap. State lives in data/swarm.conf.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, bad, listSlugs } = require('./store');

const FILE = path.join(DATA, 'swarm.conf');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {} };

function status() {
  const s = read(), p = s.slug && load(s.slug);
  return s.slug && p ? { on: true, slug: s.slug, name: p.name, since: s.since, by: s.by || '', paused: s.paused || [] } : { on: false };
}
// { slug, by } starts it (or moves it to another project); { off: true } ends it and wakes the teams it held back.
function set(b) {
  if (b && b.off) {
    const was = read(); write({});
    for (const slug of was.paused || []) { const p = load(slug); try { if (p) require('./presence').startTeam(p, true, false, false, true, false, true); } catch {} }
    return status();
  }
  const slug = String((b && b.slug) || ''), p = slug && load(slug);
  if (!p) throw bad('project not found', 404);
  const was = read();
  write({ slug, since: was.slug === slug ? was.since : now(), by: String(b.by || ''), paused: (was.paused || []).filter(x => x !== slug) });
  if (was.slug !== slug) stopNote(slug, p.name);
  setImmediate(() => { try { require('./swarmworkers').fill(); } catch {} });   // 🐝 workers per To do card (AIG-901)
  return status();
}
// A plain agent message (not a kill) to every other project whose team is running now: finish the step, commit, stop (AIG-827).
function stopNote(slug, name) {
  let pr; try { pr = require('./presence'); } catch { return; }
  for (const o of listSlugs()) {
    if (o === slug) continue;
    try { if (pr.presenceOf(o).running) require('./agentmsg').send(o, { from: 'Swarm', to: 'Lead', text: `Swarm on ${name}: finish your current step, commit, then stop` }); } catch {}
  }
}
// Called by presence.startTeam: true when this run must wait for the swarm to end (noted so it is woken then).
function holds(p, byOwner) {
  const s = read();
  if (!s.slug || s.slug === p.slug || byOwner) return false;
  if (!(s.paused || []).includes(p.slug)) write({ ...s, paused: [...(s.paused || []), p.slug] });
  return true;
}
module.exports = { status, set, holds };
