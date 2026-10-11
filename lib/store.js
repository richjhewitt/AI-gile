// Storage and the rules around cards: config paths, load/save of data/<slug>.json, project summary, validation.
const fs = require('fs');
const path = require('path');

/* ---------- config ---------- */
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const HOST = '127.0.0.1';
const ROOT = path.join(__dirname, '..');   // the AI-gile folder (where server.js lives)
const DATA = path.resolve(process.env.AIGILE_DATA || path.join(ROOT, 'data'));
const PUBLIC = path.join(ROOT, 'public');

// 'team'   = Rich commented: the team reads it, then moves it to done.
// 'verify' = built and reviewed by the team, waiting for Rich to test and accept (his inbox).
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
const TYPES = ['feature', 'bug', 'task'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const OWNER_PRIOS = ['now', 'today', 'whenever'];
const KINDS = ['decide', 'test', 'server', 'keys', 'read'];
const CARD_FIELDS = ['title', 'description', 'testSteps', 'type', 'priority', 'status', 'assignee', 'sprint', 'blocked', 'needsYou', 'step', 'openUrl', 'startCmd', 'holds', 'ownerPrio', 'kind', 'mins'];   // step: your own sub-column inside a status (AIG-117)

/* ---------- storage ---------- */
const now = () => new Date().toISOString();
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileOf = slug => path.join(DATA, slug + '.json');

function load(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try { return JSON.parse(fs.readFileSync(fileOf(slug), 'utf8')); } catch { return null; }
}
// Atomic write: temp file + rename. Node is single-threaded and we use sync IO,
// so concurrent API calls from several agents can't interleave a read-modify-write.
function save(p) {
  p.updated = now();
  const tmp = fileOf(p.slug) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  fs.renameSync(tmp, fileOf(p.slug));
}
// Machine-specific settings, kept out of git (*.local.json).
// Machine-specific settings (git-ignored). AIGILE_LOCAL points elsewhere, e.g. for tests.
const LOCAL_FILE = process.env.AIGILE_LOCAL || path.join(ROOT, 'aigile.local.json');
function localSettings() {
  try { return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')); } catch { return {}; }
}
function listSlugs() {
  return fs.readdirSync(DATA).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
}

/* ---------- project summary ---------- */
// Rich's attention is needed if a team asked him something, or a feature is waiting for his test.
// A card assigned to Rich is a task: something only he can do.
// Wait and see: a card in 'verify' can be snoozed for an hour. Compared on read, so it comes back by itself.
const SNOOZE_MS = 60 * 60e3;
// Put off for a while (Wait and see / Later): tests, questions and blocks alike (AIG-167).
const isSnoozed = c => !!c.snoozedUntil && c.snoozedUntil > now();
const waitingOnRich = c => c.status !== 'done' && !isSnoozed(c) && (c.status === 'verify' || c.needsYou || c.blocked || isRich(c.assignee));

// What agents are working on right now: cards in progress, newest activity first.
const inFlight = p => p.cards.filter(c => c.status === 'doing')
  .map(c => ({ id: c.id, title: c.title, assignee: c.assignee, updated: c.updated }))
  .sort((a, b) => b.updated.localeCompare(a.updated));

/* ---------- project look (AIG-86): a colour and emoji per project, so Rich can tell them apart at a glance ---------- */
// Picked automatically (a keyword in the name, else from the slug), unless set on the project.
const LOOK_COLORS = ['#3b82f6', '#16a34a', '#db2777', '#ea580c', '#0891b2', '#7c3aed', '#ca8a04', '#dc2626', '#0d9488', '#4f46e5'];
// First match wins, so the more specific words come first.
const LOOK_EMOJI = [[/discord|chat|bot/i, '💬'], [/a-?i-?gile|board/i, '🗂️'], [/radio|loco/i, '📻'], [/music|song|audio/i, '🎵'], [/migrat|os|windows|disk/i, '💽'],
  [/state/i, '🌀'], [/web|site/i, '🌐'], [/game/i, '🎮']];
const LOOK_SPARE = ['🚀', '🧩', '🌱', '⚙️', '🔭', '🎯', '🧪', '📦'];
function look(p) {
  const h = [...(p.slug || p.name || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const kw = LOOK_EMOJI.find(([re]) => re.test(p.name || ''));
  return { color: p.color || LOOK_COLORS[h % LOOK_COLORS.length], emoji: p.emoji || (kw ? kw[1] : LOOK_SPARE[h % LOOK_SPARE.length]), logo: p.logo || '' };   // logo (AIG-175): a picture URL that replaces the emoji
}

/* ---------- project order (AIG-189): your own order, dragged in the left rail ---------- */
// A list of slugs in data/project-order.conf (not .json: every .json in data/ is a project). Projects not in it go last, by name.
const ORDER_FILE = () => path.join(DATA, 'project-order.conf');
function projectOrder() { try { return JSON.parse(fs.readFileSync(ORDER_FILE(), 'utf8')); } catch { return []; } }
function setProjectOrder(slugs) {
  if (!Array.isArray(slugs)) throw bad('send { slugs: [...] } in the order you want');
  const known = new Set(listSlugs()), list = [...new Set(slugs.map(String))].filter(s => known.has(s));
  fs.writeFileSync(ORDER_FILE(), JSON.stringify(list));
  return list;
}
// Sorts anything with a slug and a name by your order.
function byOrder(list, key = x => x.slug) {
  const o = projectOrder(), rank = x => { const i = o.indexOf(key(x)); return i < 0 ? 1e6 : i; };
  return list.sort((a, b) => rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || '')));
}

function summary(p, presenceOf) {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const c of p.cards) counts[c.status] = (counts[c.status] || 0) + 1;
  const active = p.cards.filter(c => c.status !== 'backlog');
  return {
    slug: p.slug, name: p.name, key: p.key, description: p.description, path: p.path, ...look(p),
    archived: !!p.archived, updated: p.updated, counts,
    total: p.cards.length,
    progress: active.length ? counts.done / active.length : 0,
    needsYou: p.cards.filter(waitingOnRich).length,
    toTest: p.cards.filter(c => c.status === 'verify' && !isSnoozed(c)).length,
    blocked: p.cards.filter(c => c.blocked && c.status !== 'done').length,
    team: (p.team || []).filter(m => !/retired|idle/i.test(m.status || '')),
    inFlight: inFlight(p),
    lastLog: (p.log || []).slice(-1)[0] || null,
    presence: presenceOf(p.slug),
    attention: attention(p, presenceOf(p.slug)),
  };
}

/* ---------- needs a poke? ---------- */
// asleep: no session heard from, but there is work to do. stuck: Rich's comment has sat in For the team for 10+ minutes.
const STUCK_MS = 10 * 60e3;
const OPEN = ['todo', 'doing', 'review', 'team'];
function lastRichAt(c) {
  const ts = c.comments.filter(m => isRich(m.author)).map(m => m.at);
  if (isRich(c.createdBy)) ts.push(c.created);
  return ts.sort().pop() || c.updated;
}
function attention(p, pr) {
  if (p.archived) return null;
  // Only cards the team can act on (AIG-269): one waiting on the owner (a question, a block, a task) doesn't make a team asleep.
  const open = p.cards.filter(c => OPEN.includes(c.status) && !waitingOnRich(c));
  if (!pr.online && open.length) return { kind: 'asleep', n: open.length, why: `asleep with ${open.length} card${open.length > 1 ? 's' : ''} to do` };
  const waiting = p.cards.filter(c => c.status === 'team').map(lastRichAt).sort()[0];
  if (pr.online && waiting && Date.now() - new Date(waiting) > STUCK_MS) return { kind: 'stuck', why: 'your comment unanswered since ' + waiting, since: waiting };
  return null;
}

/* ---------- card rules and helpers ---------- */
function cleanCard(input, partial) {
  const out = {};
  for (const k of CARD_FIELDS) if (k in input) out[k] = input[k];
  if (!partial && !out.title) throw bad('title is required');
  if ('title' in out && !String(out.title).trim()) throw bad('title cannot be empty');
  if ('status' in out && !STATUSES.includes(out.status)) throw bad('status must be one of ' + STATUSES.join(', '));
  // ▶ Open it (AIG-146): a web address to open, and optionally the command that starts the app.
  if (out.openUrl && !/^https?:\/\/\S+$/i.test(out.openUrl)) throw bad('openUrl must be an http(s) address');
  // Your queue (AIG-159..162): what it holds up (card ids), your priority, its kind, a time guess in minutes.
  if ('holds' in out) out.holds = (Array.isArray(out.holds) ? out.holds : String(out.holds || '').split(',')).map(s => String(s).trim().toUpperCase()).filter(s => /^[A-Z]{1,6}-\d+$/.test(s)).slice(0, 50);
  if ('ownerPrio' in out && out.ownerPrio && !OWNER_PRIOS.includes(out.ownerPrio)) throw bad('your priority must be one of ' + OWNER_PRIOS.join(', '));
  if ('kind' in out && out.kind && !KINDS.includes(out.kind)) throw bad('kind must be one of ' + KINDS.join(', '));
  if ('mins' in out) { const m = Number(out.mins); if (out.mins !== '' && out.mins !== null && !(m >= 0 && m <= 10000)) throw bad('mins must be a number of minutes'); out.mins = m || undefined; }
  if ('startCmd' in out) out.startCmd = String(out.startCmd || '').slice(0, 300);
  if ('type' in out && !TYPES.includes(out.type)) throw bad('type must be one of ' + TYPES.join(', '));
  if ('priority' in out && !PRIORITIES.includes(out.priority)) throw bad('priority must be one of ' + PRIORITIES.join(', '));
  for (const k of ['blocked', 'needsYou']) if (k in out) out[k] = !!out[k];
  return out;
}
// The board's human (AIG-103): "owner" in aigile.local.json, default Owner. isRich() means "is the owner";
// the name is read at most every few seconds, since it's checked for every comment.
let ownerCache = { at: 0, name: 'Owner' };
function owner() {
  if (Date.now() - ownerCache.at > 5000) ownerCache = { at: Date.now(), name: String(process.env.AIGILE_OWNER || localSettings().owner || '').trim() || 'Owner' };
  return ownerCache.name;
}
const forgetOwner = () => { ownerCache.at = 0; };   // after Setup saves a new name
const isRich = a => String(a).trim().toLowerCase() === owner().toLowerCase();
function toTeam(c) {
  if (c.status === 'team') return;
  c.prevStatus = c.status;
  c.status = 'team';
}
function docList(p) {
  const out = [];
  if (p.path) for (const sub of ['', 'docs']) {
    let names;
    try { names = fs.readdirSync(path.join(p.path, sub)); } catch { continue; }
    for (const n of names.sort()) if (/\.md$/i.test(n)) out.push(sub ? sub + '/' + n : n);
  }
  return out;
}
function bad(msg, code = 400) { const e = new Error(msg); e.code = code; return e; }
function need(p) { if (!p) throw bad('project not found', 404); return p; }
function findCard(p, id) {
  const c = p.cards.find(c => c.id.toLowerCase() === String(id).toLowerCase());
  if (!c) throw bad('card not found', 404);
  return c;
}

module.exports = {
  projectOrder, setProjectOrder, byOrder,
  PORT, HOST, ROOT, DATA, PUBLIC, LOCAL_FILE, OWNER_PRIOS, KINDS, STATUSES, TYPES, PRIORITIES, CARD_FIELDS,
  now, slugify, load, save, localSettings, listSlugs,
  SNOOZE_MS, isSnoozed, waitingOnRich, inFlight, summary, attention, look,
  cleanCard, isRich, owner, forgetOwner, toTeam, docList, bad, need, findCard,
};
