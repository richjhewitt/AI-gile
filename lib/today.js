// 🎯 Today (AIG-595/596/597): the owner's weight for each project for today: 🔥 high, normal, 🐢 low or 💤 rest. Weights reset each
// morning ("Keep yesterday's" brings them back). The Lead Scrum Master's day round and the night watchman ask this one module:
// order() = who goes first, factor() = how often to look, guard() = may an automatic wake start this project. The token budget
// of the day is split by weight in split() (the one function to swap when AIG-607 lets the owner type exact percentages).
// Not the 🎯 focus mode (lib/focus.js, AIG-395): that is one calm screen for one task.
// State: data/today.conf. A plain file data/today.stub holding YYYY-MM-DD stands in for the date (tests only).
const fs = require('fs');
const path = require('path');
const { DATA, localSettings, listSlugs, load, bad } = require('./store');
const { t: tr } = require('./i18n');

const WEIGHTS = ['high', 'normal', 'low', 'rest'];
const POOL = { high: 50, normal: 30, low: 20, rest: 0 };   // the day's tokens, in %, shared out among the projects at each level
const FILE = () => path.join(DATA, 'today.conf');
const STUB = () => path.join(DATA, 'today.stub');
const pad = n => String(n).padStart(2, '0');
function dayKey() {
  try { const s = fs.readFileSync(STUB(), 'utf8').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch {}
  const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const write = s => { try { fs.writeFileSync(FILE(), JSON.stringify(s)); } catch {} };
// The state for today: a new day starts empty (everything normal), with yesterday's choices kept for the button.
function read() {
  let s = null; try { s = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch {}
  const day = dayKey();
  if (s && s.day === day && s.weights) return s;   // pct / equal (AIG-607) are kept across days: only the weights reset
  const n = { ...(s && s.pct ? { pct: s.pct } : {}), ...(s && s.equal ? { equal: true } : {}), day, weights: {}, yesterday: s && s.weights && Object.keys(s.weights).length ? s.weights : (s && s.yesterday) || {} };
  write(n); return n;
}
const clean = w => Object.fromEntries(Object.entries(w || {}).filter(([, v]) => v !== 'normal' && WEIGHTS.includes(v)));
const weight = slug => read().weights[slug] || 'normal';
function set(slug, w) {
  if (!WEIGHTS.includes(w)) throw bad('weight must be one of ' + WEIGHTS.join(', '));
  if (!listSlugs().includes(slug)) throw bad('no such project', 404);
  const s = read(); if (w === 'normal') delete s.weights[slug]; else s.weights[slug] = w;
  write(s); return view();
}
// AIG-607: { equal: true } or { pct: { slug: n, ... } } (must add up to 100) or {} to go back to the weights. Kept across days.
function setShares(b) {
  const s = read(); b = b || {};
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
function aiOffGuard(p) { if (aiOff(p)) throw bad(tr('srv.aioff.guard', { name: p.name }), 409); }
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
  const st = read();   // AIG-607: exact percentages, or an equal split, replace the weights
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
  const n = (localSettings().budget || {}).day;
  if (n !== undefined && n !== null && n !== '' && Number.isFinite(+n) && +n >= 0) return +n;
  try { return require('./budget').nightLimit(); } catch { return 0; }
}
function startOfDay() { const d = new Date(dayKey() + 'T00:00:00'); return d.getTime(); }
// Units each project's finished runs used today (the _runs.jsonl rows, as the nightly budget reads them).
function usedToday() {
  let rows = []; try { rows = fs.readFileSync(path.join(DATA, 'logs', '_runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch {}
  const from = startOfDay(), units = require('./budget').units, out = {};
  for (const r of rows) if (r.slug && r.end >= from) out[r.slug] = (out[r.slug] || 0) + units(r);
  return out;
}
const liveSlugs = () => listSlugs().filter(s => { const p = load(s); return p && !p.archived; });
// Past its share of the day: slows down like the usage saver (no automatic start unless a ⭐ crucial card is waiting).
function overShare(p, shares = split(liveSlugs()), used = usedToday(), limit = dayLimit()) {
  if (!limit || crucialWork(p)) return false;
  return (used[p.slug] || 0) > (shares[p.slug] || 0) / 100 * limit;
}
// Called by presence.startTeam. bg = an automatic wake (the watchman, the Scrum Master); byOwner = his own Wake click.
function guard(p, { bg, byOwner } = {}) {
  if (byOwner) return;
  if (bg && resting(p)) throw bad(tr('srv.today.rest', { name: p.name }));
  if (overShare(p)) throw bad(tr('srv.today.over', { name: p.name }));
}

// For the page and the usage burn-down.
function view() {
  const s = read(), slugs = liveSlugs(), shares = split(slugs), used = usedToday(), limit = dayLimit();
  return {
    mode: s.equal ? 'equal' : s.pct && Object.keys(s.pct).length ? 'pct' : 'weights', pctTotal: Math.round(Object.values(s.pct || {}).reduce((a, n) => a + n, 0) * 10) / 10,
    day: s.day, limit, yesterday: Object.keys(clean(s.yesterday)).length, weights: WEIGHTS,
    projects: slugs.map(slug => {
      const p = load(slug), share = shares[slug] || 0, u = Math.round(used[slug] || 0);
      return { slug, name: p.name, emoji: p.emoji || '', weight: weight(slug), share, used: u, allowed: Math.round(share / 100 * limit),
        pct: limit && share ? Math.round(u / (share / 100 * limit) * 100) : 0, over: overShare(p, shares, used, limit), resting: resting(p), setPct: (s.pct || {})[slug] || 0, aiOff: aiOff(p) };
    }),
    order: order(slugs),
  };
}

module.exports = { setShares, aiOff, aiOffGuard, WEIGHTS, POOL, weight, set, keepYesterday, order, factor, resting, split, dayLimit, usedToday, overShare, guard, view, dayKey };
