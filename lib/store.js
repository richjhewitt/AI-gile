// Storage and the rules around cards: config paths, load/save of data/<slug>.json, project summary, validation.
const fs = require('fs');
const path = require('path');

/* ---------- config ---------- */
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const HOST = '127.0.0.1';
const ROOT = path.join(__dirname, '..');   // the AI-gile folder (where server.js lives)
const DATA = path.resolve(process.env.AIGILE_DATA || path.join(ROOT, 'data'));
const PUBLIC = path.join(ROOT, 'public');

// 'team'   = the owner commented: the team reads it, then moves it to done.
// 'verify' = built and reviewed by the team, waiting for the owner to test and accept (his inbox).
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
const TYPES = ['feature', 'bug', 'task'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const OWNER_PRIOS = ['now', 'today', 'whenever'];
const KINDS = ['decide', 'test', 'server', 'outside', 'keys', 'read'];
const CARD_FIELDS = ['title', 'description', 'testSteps', 'type', 'priority', 'status', 'assignee', 'sprint', 'group', 'blocked', 'needsYou', 'step', 'openUrl', 'startCmd', 'holds', 'ownerPrio', 'kind', 'mins', 'server', 'serverName', 'outside', 'info', 'lifeType', 'apptAt', 'remindMins', 'focus', 'checklist', 'waitsFor'];   // step: your own sub-column inside a status (AIG-117)

/* ---------- storage ---------- */
const now = () => new Date().toISOString();
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A slug is one name inside data/: a %5C or .. in a URL must not reach a file outside it.
const fileOf = slug => { if (/[\\/]|^\.\.?$/.test(String(slug))) throw bad('no such project', 404); return path.join(DATA, slug + '.json'); };

function load(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try { const p = JSON.parse(fs.readFileSync(fileOf(slug), 'utf8')); deriveWaits(p); return p; } catch { return null; }
}
// ⏳ Waits for (AIG-406): c.waiting = the ids of its blockers (same project) that are not done yet. Worked out on every load and save,
// so it can never be stale. c.waitHeld remembers it was waiting: when the last blocker is done the card pops back (top of its pile,
// and a team card wakes its team), here in save() so it happens at once, whatever finished the blocker.
const openBlockers = (p, c) => (c.waitsFor || []).filter(id => { const b = p.cards.find(x => x.id === id); return b && b.status !== 'done' && b !== c; });
function deriveWaits(p) { for (const c of p.cards || []) { const w = c.waitsFor && c.waitsFor.length ? openBlockers(p, c) : []; if (w.length) c.waiting = w; else delete c.waiting; } }
function popWaits(p) {
  let wake = false;
  for (const c of p.cards || []) {
    const w = c.waitsFor && c.waitsFor.length ? openBlockers(p, c) : [];
    if (w.length) { c.waiting = w; c.waitHeld = true; continue; }
    delete c.waiting;
    if (!c.waitHeld) continue;
    delete c.waitHeld;
    if (c.status === 'done') continue;
    const at = now();
    c.bumpedAt = at; c.bumps = (c.bumps || 0) + 1; c.updated = at;
    if (c.status === 'team') { c.comments.push({ author: 'Timer', wake: true, at, text: '⏳ What this card waited for is done: pick it up.' }); wake = true; }
  }
  return wake;
}
// Atomic write: temp file + rename. Node is single-threaded and we use sync IO,
// so concurrent API calls from several agents can't interleave a read-modify-write.
function save(p) {
  const wake = popWaits(p);
  p.updated = now();
  const tmp = fileOf(p.slug) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
  fs.renameSync(tmp, fileOf(p.slug));
  if (wake) setImmediate(() => { try { require('./presence').nudge(p.slug); } catch {} });
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
// The owner's attention is needed if a team asked him something, or a feature is waiting for his test.
// A card assigned to the owner is a task: something only he can do.
// Wait and see: a card in 'verify' can be snoozed for an hour. Compared on read, so it comes back by itself.
const SNOOZE_MS = 60 * 60e3;
// Put off for a while (Wait and see / Later): tests, questions and blocks alike (AIG-167).
const isSnoozed = c => !!c.snoozedUntil && c.snoozedUntil > now();
const isTimed = c => !!c.timedUntil && c.timedUntil > now();   // AIG-385: lib/timed.js
const isWaiting = c => !!(c.waiting && c.waiting.length);   // ⏳ AIG-406
// AIG-472: the owner replied to an open task and the team hasn't answered yet, so the task waits on the team (a reply that isn't ✅ Done).
function taskReplied(c) {
  if (!isRich(c.assignee) || c.needsYou || c.blocked || c.status === 'verify') return false;
  const cs = c.comments || [];
  if (!cs.some(m => m.mark === 'task' && !isRich(m.author))) return false;
  const last = cs[cs.length - 1];
  return !!last && isRich(last.author) && !/^✅ Done/.test(last.text);
}
const waitingOnRich = c => c.status !== 'done' && !isSnoozed(c) && !isTimed(c) && !isWaiting(c) && !taskReplied(c) && (c.status === 'verify' || c.needsYou || c.blocked || isRich(c.assignee));

// What agents are working on right now: cards in progress, newest activity first.
const inFlight = p => p.cards.filter(c => c.status === 'doing')
  .map(c => ({ id: c.id, title: c.title, assignee: c.assignee, updated: c.updated }))
  .sort((a, b) => b.updated.localeCompare(a.updated));

/* ---------- project look (AIG-86): a colour and emoji per project, so the owner can tell them apart at a glance ---------- */
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

/* ---------- spaces (AIG-433): a project can sit inside another, to any depth; each stays a full project (its own board, team, folder) ---------- */
// p.parent = the slug of the project it sits in; none = top level. Refused: a parent that doesn't exist, itself, or one of its own
// projects (a loop). Returns the clean value to store.
function checkParent(slug, parent) {
  parent = String(parent || '').trim().toLowerCase();
  if (!parent) return undefined;
  if (parent === slug) throw bad('a project cannot sit inside itself');
  if (!load(parent)) throw bad('no project "' + parent + '" to put it in');
  // Up from the new parent: meeting this project on the way means the parent sits inside it.
  for (let s = parent, seen = new Set(); s && !seen.has(s); s = (load(s) || {}).parent) {
    if (s === slug) throw bad(parent + ' is inside ' + slug + ', so ' + slug + ' cannot go inside it');
    seen.add(s);
  }
  return parent;
}

// Team roles per project (AIG-366): p.roles = the roles that are on (undefined = all); Lead is always on.
// Today's 8 keep their old names; any other role template is kept by its id (AIG-420, lib/profiles.js storeRoles).
const PR = require('./profiles');
const TEAM_ROLES = Object.keys(PR.OLD_ROLES);
const rolesOn = p => { const ids = PR.roleIds(p.roles); return TEAM_ROLES.filter(r => ids.includes(PR.OLD_ROLES[r])); };
// Night watch (AIG-516): the board pokes a watched team itself, so its need is marked for the pill (see watchman.js pokeView).
const autoPoked = (p, at) => { if (!at) return at; try { return require('./watchman').pokeView(p, at); } catch { return at; } };
function summary(p, presenceOf) {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const c of p.cards) counts[c.status] = (counts[c.status] || 0) + 1;
  const active = p.cards.filter(c => c.status !== 'backlog');
  return {
    slug: p.slug, name: p.name, key: p.key, description: p.description, path: p.path, ...look(p), parent: p.parent || undefined,
    archived: !!p.archived, updated: p.updated, counts,
    total: p.cards.length,
    progress: active.length ? counts.done / active.length : 0,
    needsYou: p.cards.filter(waitingOnRich).length,
    toTest: p.cards.filter(c => c.status === 'verify' && !isSnoozed(c) && !isTimed(c) && !isWaiting(c)).length,
    blocked: p.cards.filter(c => c.blocked && c.status !== 'done').length,
    team: (p.team || []).filter(m => !/retired|idle/i.test(m.status || '')),
    inFlight: inFlight(p),
    lastLog: (p.log || []).slice(-1)[0] || null,
    presence: presenceOf(p.slug),
    attention: autoPoked(p, attention(p, presenceOf(p.slug))),
  };
}

/* ---------- needs a poke? ---------- */
// asleep: no session heard from, but there is work to do. stuck: the owner's comment has sat in For the team for 10+ minutes.
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
  const open = p.cards.filter(c => OPEN.includes(c.status) && !waitingOnRich(c) && !isTimed(c) && !isWaiting(c));
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
  // ☑ Checklist (AIG-406): items are strings or { text, done, by, at }; a string keeps the tick of an item with the same text (see keepTicks).
  if ('checklist' in out) out.checklist = (Array.isArray(out.checklist) ? out.checklist : String(out.checklist || '').split(',')).map(x => typeof x === 'string' ? { text: x } : x || {})
    .map(x => ({ text: String(x.text || '').replace(/\s+/g, ' ').trim().slice(0, 100), ...(x.done ? { done: true, by: String(x.by || '').slice(0, 40), at: String(x.at || '') } : {}), ...(x.done === undefined ? { fresh: true } : {}) }))
    .filter(x => x.text).slice(0, 30);
  if ('waitsFor' in out) out.waitsFor = [...new Set((Array.isArray(out.waitsFor) ? out.waitsFor : String(out.waitsFor || '').split(',')).map(s => String(s).trim().toUpperCase()).filter(s => /^[A-Z]{1,6}-\d+$/.test(s)))].slice(0, 20);
  if ('ownerPrio' in out && out.ownerPrio && !OWNER_PRIOS.includes(out.ownerPrio)) throw bad('your priority must be one of ' + OWNER_PRIOS.join(', '));
  if ('kind' in out && out.kind && !KINDS.includes(out.kind)) throw bad('kind must be one of ' + KINDS.join(', '));
  if ('mins' in out) { const m = Number(out.mins); if (out.mins !== '' && out.mins !== null && !(m >= 0 && m <= 10000)) throw bad('mins must be a number of minutes'); out.mins = m || undefined; }
  if ('focus' in out) out.focus = !!out.focus || undefined;   // 🎯 needs focus (AIG-395)
  if ('startCmd' in out) out.startCmd = String(out.startCmd || '').slice(0, 300);
  if ('type' in out && !TYPES.includes(out.type)) throw bad('type must be one of ' + TYPES.join(', '));
  if ('priority' in out && !PRIORITIES.includes(out.priority)) throw bad('priority must be one of ' + PRIORITIES.join(', '));
  if ('group' in out) out.group = String(out.group === true ? '' : out.group || '').replace(/\s+/g, ' ').trim().slice(0, 60);   // card groups (AIG-386)
  if ('serverName' in out) out.serverName = String(out.serverName || '').trim().slice(0, 60);
  for (const k of ['blocked', 'needsYou', 'server', 'outside', 'info']) if (k in out) out[k] = !!out[k];
  require('./life').clean(out);   // AIG-394: lifeType, apptAt, remindMins, focus
  return out;
}
// A checklist given as plain words keeps the ticks of items with the same text (AIG-406); `fresh` marks those.
function keepTicks(old, list) {
  return list.map(({ fresh, ...x }) => { const o = fresh && (old || []).find(y => y.done && y.text.toLowerCase() === x.text.toLowerCase()); return o ? { ...x, done: true, by: o.by, at: o.at } : x; });
}
// ⏳ Waits for: only cards of this project that exist, not itself, and no two cards waiting for each other.
function checkWaits(p, c, ids) {
  for (const id of ids) {
    const b = p.cards.find(x => x.id === id);
    if (!b) throw bad('no card ' + id + ' on this board to wait for');
    if (b === c) throw bad('a card cannot wait for itself');
    if ((b.waitsFor || []).includes(c.id)) throw bad(id + ' already waits for ' + c.id);
  }
}
// The other direction is "holds": a card that waits for B is something B holds up.
function syncHolds(p, c, was) {
  const now_ = c.waitsFor || [];
  for (const b of p.cards) {
    if (now_.includes(b.id) && !(b.holds || []).includes(c.id)) b.holds = [...(b.holds || []), c.id];
    else if (was.includes(b.id) && !now_.includes(b.id) && (b.holds || []).includes(c.id)) b.holds = b.holds.filter(x => x !== c.id);
  }
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
// 📖 Info-only hand-over (AIG-392): steps that open with "Nothing to click" (en, nl, nl-BE) have nothing to test: the owner reads and says "Got it".
const INFO_RE = /^[\s*_>"'`#-]*(?:nothing to click|niets om (?:aan |op )?te klikken|niets te klikken)/i;
const isInfoSteps = s => INFO_RE.test(String(s || ''));
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
  projectOrder, setProjectOrder, byOrder, checkParent,
  PORT, HOST, ROOT, DATA, PUBLIC, LOCAL_FILE, OWNER_PRIOS, KINDS, STATUSES, TYPES, PRIORITIES, CARD_FIELDS,
  INFO_RE, isInfoSteps,
  now, slugify, load, save, localSettings, listSlugs,
  TEAM_ROLES, rolesOn, SNOOZE_MS, isSnoozed, isTimed, waitingOnRich, taskReplied, inFlight, summary, attention, look,
  cleanCard, keepTicks, checkWaits, syncHolds, isWaiting, openBlockers, isRich, owner, forgetOwner, toTeam, docList, bad, need, findCard,
};
