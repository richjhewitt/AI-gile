// 🎯 Today (AIG-595/596/597): the owner's weight for each project for today: 🔥 high, normal, 🐢 low or 💤 rest. Weights reset each
// morning ("Keep yesterday's" brings them back). The Lead Scrum Master's day round and the night watchman ask this one module:
// order() = who goes first, factor() = how often to look, guard() = may an automatic wake start this project. The token budget
// of the day is split by weight in split() (the one function to swap when AIG-607 lets the owner type exact percentages).
// Not the 🎯 focus mode (lib/focus.js, AIG-395): that is one calm screen for one task.
// State: data/today.conf. A plain file data/today.stub holding YYYY-MM-DD stands in for the date (tests only).
const fs = require('fs');
const path = require('path');
const { DATA, peekSettings, listSlugs, peek, bad } = require('./store');
const { t: tr } = require('./i18n');

const WEIGHTS = ['high', 'normal', 'low', 'rest'];
const POOL = { high: 50, normal: 30, low: 20, rest: 0 };   // the day's tokens, in %, shared out among the projects at each level
const FILE = () => path.join(DATA, 'today.conf');
const STUB = () => path.join(DATA, 'today.stub');
const pad = n => String(n).padStart(2, '0');
// AIG-1063: the owner's day turns over at his day start (Setup, day.start, default 09:00; AIG-678), not at midnight.
function startMin() {
  let start = '09:00'; try { start = require('./tired').dayTimes(peekSettings()).start; } catch {}
  const [h, m] = String(start).split(':').map(Number); return (h || 0) * 60 + (m || 0);
}
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// The day as the owner counts it: before the day start it is still yesterday. today.stub wins (tests).
function dayKey(at) {
  if (at === undefined) try { const s = fs.readFileSync(STUB(), 'utf8').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch {}
  const d = new Date(at === undefined ? Date.now() : at); if (d.getHours() * 60 + d.getMinutes() < startMin()) d.setDate(d.getDate() - 1);
  return ymd(d);
}
// When the day with this key began (its day-start time), and when the next one begins.
const dayBegin = (key = dayKey()) => { const m = startMin(), d = new Date(key + 'T00:00:00'); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };
const nextDayBegin = (at = Date.now()) => { const d = new Date(dayBegin(dayKey(at))); d.setDate(d.getDate() + 1); return d.getTime(); };
const write = s => { cache = null; try { fs.writeFileSync(FILE(), JSON.stringify(s)); } catch {} };
// The state for today: a new day starts empty (everything normal), with yesterday's choices kept for the button.
function read() {
  let s = null; try { s = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch {}
  const day = dayKey();
  if (s && s.day === day && s.weights) return s;   // pct / equal (AIG-607) are kept across days: only the weights reset
  const n = { ...(s && s.pct ? { pct: s.pct, ...(s.added ? { added: s.added } : {}) } : {}),...(s && s.equal ? { equal: true } : {}), day, weights: {}, yesterday: s && s.weights && Object.keys(s.weights).length ? s.weights : (s && s.yesterday) || {} };
  write(n); return n;
}
const clean = w => Object.fromEntries(Object.entries(w || {}).filter(([, v]) => v !== 'normal' && WEIGHTS.includes(v)));
// view() reads the day's state once and holds it while it works, so weight() is not a file read per project (AIG-1091).
let held = null;
const weight = slug => (held || read()).weights[slug] || 'normal';
function set(slug, w) {
  if (!WEIGHTS.includes(w)) throw bad('weight must be one of ' + WEIGHTS.join(', '));
  if (!listSlugs().includes(slug)) throw bad('no such project', 404);
  const s = read(); if (w === 'normal') delete s.weights[slug]; else s.weights[slug] = w;
  write(s); return view();
}
// AIG-607: { equal: true } or { pct: { slug: n, ... } } (must add up to 100) or {} to go back to the weights. Kept across days.
function setShares(b) {
  const s = read(); b = b || {}; delete s.added;
  if (b.equal) { delete s.pct; s.equal = true; }
  else if (b.pct && typeof b.pct === 'object') {
    const live = liveSlugs(), pct = {};
    for (const [k, v] of Object.entries(b.pct)) { if (!live.includes(k)) throw bad('no such project: ' + k, 404); const n = Number(v); if (!(n >= 0 && n <= 100)) throw bad('each share must be between 0 and 100'); if (n) pct[k] = n; }
    const total = Object.values(pct).reduce((a, n) => a + n, 0);
    if (Math.abs(total - 100) > 0.05) throw bad(tr('srv.today.total', { total: Math.round(total * 10) / 10 }));
    delete s.equal; s.pct = pct;
  } else { delete s.equal; delete s.pct; }
  write(s); return view();
}
// AIG-608: AI off for one project: no team run starts for it (not even for the owner's comments) and the dispatcher does not wake. By hand still works.
const aiOff = p => !!(p && p.aiOff);
function aiOffGuard(p, { byOwner } = {}) {
  if (aiOff(p)) throw bad(tr('srv.aioff.guard', { name: p.name }), 409);
  if (!byOwner) require('./tokencap').guard(p);   // AIG-1156: the monthly token cap per service stops background starts (the shared gate: team, swarm workers, groups, reviews)
}
// AIG-829/830: the morning picker. { slugs: [ticked] } or { skip: true }. Ticked = normal (or high if it was); unticked = rest.
// left = the unpicked projects the owner no longer sees today (the page hides them; the Scrum Master keeps its weights). Resets each morning with the weights.
const pickOn = () => (peekSettings().today || {}).pick === true;
function pick(b) {
  b = b || {}; const s = read();
  if (b.skip) { s.skipped = true; write(s); return view(); }
  if (!Array.isArray(b.slugs)) throw bad('slugs must be a list');
  const live = liveSlugs(), on = b.slugs.map(String).filter(x => live.includes(x));
  for (const slug of live) {
    if (on.includes(slug)) { if (s.weights[slug] !== 'high') delete s.weights[slug]; } else s.weights[slug] = 'rest';
  }
  s.picked = true; s.left = live.filter(x => !on.includes(x)); delete s.skipped;
  write(s); return view();
}
// AIG-1298: a project made during the day joins today's focus on Normal: never left out by the morning pick (an old weight for the
// same slug goes), and with exact percentages it is not held to a 0% share it never had (s.added, kept with pct, cleared on a new split).
function welcome(slug) {
  const s = read(); delete s.weights[slug];
  if (s.left) s.left = s.left.filter(x => x !== slug);
  if (s.yesterday) delete s.yesterday[slug];   // the picker shown later starts it ticked
  if (s.pct && !(slug in s.pct)) s.added = [...new Set([...(s.added || []), slug])];
  write(s);
}
function keepYesterday() { const s = read(); s.weights = clean(s.yesterday); write(s); return view(); }

const RANK = { high: 0, normal: 1, low: 2, rest: 3 };
// Slugs, 🔥 first (stable within a level).
const order = slugs => [...slugs].sort((a, b) => RANK[weight(a)] - RANK[weight(b)]);
// How much of the usual waiting time a project gets: 🔥 half (looked at twice as often), 🐢 double.
const factor = slug => ({ high: 0.5, low: 2 }[weight(slug)] || 1);

const crucialWork = p => { try { return require('./budget').crucialWork(p); } catch { return false; } };
// 💤 only wakes for the owner's own comments; ⭐ crucial cards run whatever the weight.
const resting = p => weight(p.slug) === 'rest' && !crucialWork(p);

// AIG-597: each project's share of the day's tokens, in %. pools = the level's % (POOL), divided among the projects at that level;
// the levels in use are scaled to 100. 💤 gets 0. Swap this one function for exact percentages (AIG-607).
function split(slugs, w = weight) {
  const st = held || read();   // AIG-607: exact percentages, or an equal split, replace the weights
  if (st.equal && slugs.length) return Object.fromEntries(slugs.map(s => [s, Math.round(1000 / slugs.length) / 10]));
  if (st.pct && Object.keys(st.pct).length) return Object.fromEntries(slugs.map(s => [s, +st.pct[s] || 0]));
  const lv = Object.fromEntries(WEIGHTS.map(k => [k, slugs.filter(s => w(s) === k)]));
  const total = WEIGHTS.reduce((n, k) => n + (lv[k].length ? POOL[k] : 0), 0);
  const out = {};
  for (const k of WEIGHTS) for (const s of lv[k]) out[s] = total && POOL[k] ? Math.round(POOL[k] / total * 1000 / lv[k].length) / 10 : 0;
  return out;
}
// The day's token budget in the budget.js unit: "budget": { "day": N } in aigile.local.json, else the nightly limit. 0 = no cap.
function dayLimit() {
  const n = (peekSettings().budget || {}).day;
  if (n !== undefined && n !== null && n !== '' && Number.isFinite(+n) && +n >= 0) return +n;
  try { return require('./budget').nightLimit(); } catch { return 0; }
}
const startOfDay = () => dayBegin();   // the usage window starts at the day-start time of the day's key
// Units each project's finished runs used today (the _runs.jsonl rows, as the nightly budget reads them).
function usedToday() {
  let rows = []; try { rows = fs.readFileSync(path.join(DATA, 'logs', '_runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch {}
  const from = startOfDay(), units = require('./budget').units, out = {};
  for (const r of rows) if (r.slug && r.end >= from) out[r.slug] = (out[r.slug] || 0) + units(r);
  return out;
}
const liveSlugs = () => listSlugs().filter(s => { const p = peek(s); return p && !p.archived; });
// Past its share of the day: slows down like the usage saver (no automatic start unless a ⭐ crucial card is waiting).
function overShare(p, shares = split(liveSlugs()), used = usedToday(), limit = dayLimit()) {
  if (!limit || crucialWork(p)) return false;
  if (((held || read()).added || []).includes(p.slug)) return false;   // made after the split was set (AIG-1298)
  return (used[p.slug] || 0) > (shares[p.slug] || 0) / 100 * limit;
}
// Called by presence.startTeam. bg = an automatic wake (the watchman, the Scrum Master); byOwner = his own Wake click.
function guard(p, { bg, byOwner } = {}) {
  if (byOwner) return;
  if (bg && resting(p)) throw bad(tr('srv.today.rest', { name: p.name }));
  if (overShare(p)) throw bad(tr('srv.today.over', { name: p.name }));
}

// For the page and the usage burn-down.
// Cached for 2 s, and only while nothing in data/ moved (the same stamp as GET /api/rev), AIG-1091: the page asks often and each build walks every project.
let cache = null;
function stamp() {
  let key = ''; try { key = require('./rev')().rev; } catch {}
  try { const st = fs.statSync(path.join(DATA, 'logs', '_runs.jsonl'), { bigint: true }); key += ':' + st.mtimeNs + ':' + st.size; } catch {}   // the usage rows live below data/, outside the rev
  return key;
}
function view() {
  const now = Date.now();
  if (cache && cache.key && cache.key === stamp() && now - cache.at < 2000) return cache.value;
  const value = build(); cache = { key: stamp(), at: now, value }; return value;   // the key after the build: a new day writes today.conf while building
}
function build() {
  const s = read(); held = s;
  try {
  const slugs = liveSlugs(), shares = split(slugs), used = usedToday(), limit = dayLimit();
  return {
    mode: s.equal ? 'equal' : s.pct && Object.keys(s.pct).length ? 'pct' : 'weights', pctTotal: Math.round(Object.values(s.pct || {}).reduce((a, n) => a + n, 0) * 10) / 10,
    at: Date.now(),   // when this was built: the same value twice means the second answer came from the cache
    day: s.day, askPick: pickOn() && !s.picked && !s.skipped, left: s.picked ? (s.left || []).filter(x => slugs.includes(x)) : [], limit, yesterday: Object.keys(clean(s.yesterday)).length, weights: WEIGHTS,
    projects: slugs.map(slug => {
      const p = peek(slug), share = shares[slug] || 0, u = Math.round(used[slug] || 0);
      return { slug, name: p.name, emoji: p.emoji || '', weight: weight(slug), pickDefault: s.picked ? weight(slug) : (s.yesterday || {})[slug] || 'normal', share, used: u, allowed: Math.round(share / 100 * limit),
        pct: limit && share ? Math.round(u / (share / 100 * limit) * 100) : 0, over: overShare(p, shares, used, limit), resting: resting(p), setPct: (s.pct || {})[slug] || 0, aiOff: aiOff(p) };
    }),
    order: order(slugs),
  };
  } finally { held = null; }
}

module.exports = { welcome, setShares, aiOff, aiOffGuard, WEIGHTS, POOL, weight, set, keepYesterday, order, factor, resting, split, pick, dayLimit, usedToday, overShare, guard, view, dayKey, dayBegin, nextDayBegin };
