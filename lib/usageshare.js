// Token use, shared with friends (AIG-685/686). Per project, off by default: p.shareUsage turns it on, and
// p.shareUsageWith says who sees it: 'all' (every friend) or a list of contact ids (none picked at first).
// Only numbers cross: the project's name, its tokens today and in the last 7 days. No card text, no logs.
//
// Wire: a DM payload { t: 'usage', seq, projects: [{ id, name, today, week }] } sealed by dm.js (its outbox and relay,
// like lib/share.js and lib/ask.js). Each friend gets one list: every project shared with them. A list that changes
// shape (a project switched on or off for them) goes at once; a list whose numbers alone changed goes at most every
// 10 minutes (AIGILE_USAGE_SHARE_MS). A friend who never had anything shared gets nothing at all.
// Files (git-ignored): data/dms/usage-sent.json (what each friend last got), data/dms/usage-got.json (what friends sent me).
const fs = require('fs');
const path = require('path');
const { DATA, load, listSlugs, localSettings, bad } = require('./store');
const { usage } = require('./usage');
const dm = require('./dm');

const EVERY = Number(process.env.AIGILE_USAGE_SHARE_MS) || 10 * 60e3;
const TICK = Math.min(60e3, EVERY);
const MAX_AGE = 8 * 24 * 3600e3, MAX_AHEAD = 10 * 60e3, MAX_PROJECTS = 50;
const SENT = () => path.join(DATA, 'dms', 'usage-sent.json');
const GOT = () => path.join(DATA, 'dms', 'usage-got.json');
const isCid = s => /^[0-9a-f]{12}$/.test(String(s));

function readJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }
function writeJson(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2), { mode: 0o600 });
  fs.renameSync(f + '.tmp', f);
}

/* ---------- the project setting (PATCH /api/projects/:slug) ---------- */
// { shareUsage?, shareUsageWith? }. Old projects have neither: off, nobody picked.
function setFlags(p, b) {
  if ('shareUsage' in b) p.shareUsage = !!b.shareUsage || undefined;
  if ('shareUsageWith' in b) {
    const w = b.shareUsageWith;
    if (w === 'all') p.shareUsageWith = 'all';
    else if (Array.isArray(w) && w.every(isCid)) p.shareUsageWith = [...new Set(w)].slice(0, 200);
    else throw bad("shareUsageWith must be 'all' or a list of contact ids");
  }
}
const withOf = p => p.shareUsageWith === 'all' ? 'all' : Array.isArray(p.shareUsageWith) ? p.shareUsageWith : [];
const allowed = (p, cid) => !!p.shareUsage && (withOf(p) === 'all' || withOf(p).includes(cid));

// The Usage page's switches: each project's setting and the friends to pick from.
function settings() {
  const projects = {};
  for (const p of listSlugs().map(load).filter(Boolean)) projects[p.slug] = { on: !!p.shareUsage, with: withOf(p) };
  return { dms: dm.on(), projects, friends: dm.contacts().filter(c => !c.blocked).map(c => ({ id: c.id, name: c.name })) };
}

/* ---------- sending ---------- */
let running = null;
const tick = () => running || (running = send().finally(() => { running = null; }));
async function send() {
  if (!dm.on()) return;
  const projects = listSlugs().map(load).filter(Boolean).filter(p => p.shareUsage);
  const sent = readJson(SENT(), {});
  let u = null, queued = false;
  if (projects.length) { u = usage(process.env.AIGILE_USAGE_DIR || localSettings().usageDir, projects.map(p => ({ slug: p.slug, path: p.path }))); if (u.cold) return; }   // AIG-1102: the first scan is still running: do not share partial numbers
  const nums = slug => {
    u = u || usage(process.env.AIGILE_USAGE_DIR || localSettings().usageDir, projects.map(p => ({ slug: p.slug, path: p.path })));
    const t = u.enabled && u.projects[slug];
    return { today: t ? t.today : 0, week: t ? t.d7 : 0 };
  };
  for (const c of dm.contacts()) {
    if (c.blocked) continue;
    const list = projects.filter(p => allowed(p, c.id)).map(p => ({ id: p.slug, name: String(p.name || p.slug).slice(0, 80), ...nums(p.slug) }));
    const last = sent[c.id], shape = list.map(x => x.id + '|' + x.name).join('\n');
    if (!last && !list.length) continue;   // never shared with them: nothing is sent
    if (last && last.shape === shape && (JSON.stringify(last.list) === JSON.stringify(list) || Date.now() - last.at < EVERY)) continue;
    const seq = Math.max(Date.now(), (last && last.seq || 0) + 1);
    try { dm.queue(dm.contactRaw(c.id), { t: 'usage', seq, projects: list }); } catch { continue; }
    sent[c.id] = { shape, list, at: Date.now(), seq };
    queued = true;
  }
  if (!queued) return;
  writeJson(SENT(), sent);
  await dm.flush();
}
setInterval(() => tick().catch(() => {}), TICK).unref();

/* ---------- receiving ---------- */
// A verified { t: 'usage' } payload from contact c. Numbers only; anything else is dropped. A newer list replaces the old.
const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e13;
function receive(c, env, p) {
  try {
    if (!(env.ts >= Date.now() - MAX_AGE && env.ts <= Date.now() + MAX_AHEAD)) return 'dropped';
    if (!Number.isSafeInteger(p.seq) || p.seq < 1 || !Array.isArray(p.projects) || p.projects.length > MAX_PROJECTS) return 'dropped';
    const projects = [];
    for (const x of p.projects) {
      if (!x || typeof x.id !== 'string' || !/^[\w-]{1,64}$/.test(x.id) || typeof x.name !== 'string' || x.name.length > 80 || !count(x.today) || !count(x.week)) return 'dropped';
      projects.push({ id: x.id, name: x.name.replace(/[\u0000-\u001f<>]/g, '').trim() || x.id, today: x.today, week: x.week });
    }
    const got = readJson(GOT(), {});
    if (got[c.id] && p.seq <= got[c.id].seq) return 'stale';
    got[c.id] = { seq: p.seq, at: new Date(env.ts).toISOString(), projects };
    writeJson(GOT(), got);
    return 'usage';
  } catch { return 'dropped'; }
}
// What this friend shares with me: { at, projects } or { at: null, projects: [] }.
function glance(cid) {
  dm.contactRaw(cid);
  const g = readJson(GOT(), {})[cid];
  return g ? { at: g.at, projects: g.projects } : { at: null, projects: [] };
}

dm.hooks.usage = receive;

module.exports = { setFlags, settings, tick, receive, glance };
