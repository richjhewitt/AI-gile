// Premade expert teams (AIG-577..579): profiles/expert-teams.json holds the templates (name, purpose, roles with model and job,
// starter cards, "done looks like"). Size n = the first n roles, Lead first. The usage estimate scales a per-Sonnet-hour
// baseline taken from the board's own finished runs (data/logs/_runs.jsonl), else a plain default.
const fs = require('fs');
const path = require('path');
const PR = require('./profiles');

const FILE = path.join(__dirname, '..', 'profiles', 'expert-teams.json');
let cache = null;
const data = () => cache || (cache = JSON.parse(fs.readFileSync(FILE, 'utf8')));
const MAX = 6;

// Tokens (in + out) per hour of one Sonnet-sized agent, from the runs of the last two weeks; null when there is no history.
function baseline(rows, weights) {
  let tokens = 0, hours = 0, n = 0;
  for (const r of rows) {
    const h = (r.end - r.start) / 3600e3, tk = (r.in || 0) + (r.out || 0);
    if (!(h > 0.02) || !(tk > 0)) continue;
    const ms = (r.models || []).map(m => weights[String(m).toLowerCase().match(/haiku|sonnet|opus/) || 'sonnet'] || 1);
    tokens += tk; hours += h * (ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 1); n++;
  }
  return n ? { perSonnetHour: Math.round(tokens / hours), runs: n } : null;
}
function list() {
  const d = data();
  let rows = []; try { rows = require('./presence').recentRuns(24 * 14); } catch {}
  const b = baseline(rows.filter(r => !r.kind), d.weights);
  return { max: MAX, sprintHours: d.sprintHours, weights: d.weights, history: b ? { ...b, rough: true } : { perSonnetHour: d.defaultPerSonnetHour, runs: 0, rough: true },
    teams: d.teams };
}
// Roster ids for a size: the first n roles (Lead is always on, so size 1 is the Lead alone).
function pick(id, size) {
  const tm = data().teams.find(x => x.id === id); if (!tm) return null;
  const n = Math.max(1, Math.min(tm.roles.length, Math.floor(Number(size)) || 1));
  return { team: tm, roles: tm.roles.slice(0, n).map(r => r.role) };
}
// Applies to a project in place: p.roles becomes exactly the picked roles, the starter cards join the backlog.
function apply(p, id, size, makeCard) {
  const r = pick(id, size); if (!r) return null;
  const was = PR.roleIds(p.roles);
  p.roles = PR.storeRoles(r.roles);
  const now = PR.roleIds(p.roles), tm = r.team;
  const done = 'Done looks like:\n' + tm.done.map(x => '- ' + x).join('\n');
  const cards = tm.cards.map((title, i) => makeCard({ title, description: i === 0 ? done : '', type: 'task', priority: 'normal', status: 'backlog', createdBy: 'Expert team: ' + tm.name }));
  return { added: now.filter(x => !was.includes(x)), removed: was.filter(x => !now.includes(x)), cards };
}
module.exports = { list, pick, apply, baseline, MAX };
