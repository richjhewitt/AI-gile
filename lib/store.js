// Storage and the rules around cards: config paths, load/save of data/<slug>.json, project summary, validation.
const fs = require('fs');
const path = require('path');
const tr = (k, v) => require('./i18n').t(k, v);

/* ---------- config ---------- */
const PORT = Number(process.env.AIGILE_PORT) || 4321;
const HOST = '127.0.0.1';
const ROOT = path.join(__dirname, '..');   // the AI-gile folder (where server.js lives)
const DATA = path.resolve(process.env.AIGILE_DATA || path.join(ROOT, 'data'));
const PUBLIC = path.join(ROOT, 'public');

// 'team'   = the owner commented: the team reads it, then moves it to done.
// 'verify' = built and reviewed by the team, waiting for the owner to test and accept (his inbox).
const STATUSES = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
const TYPES = ['feature', 'bug', 'task', 'incident', 'problem', 'change'];   // incident (AIG-614): live is broken; problem (AIG-887): the cause behind repeat incidents; change (AIG-857): a change request
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const RISKS = ['small', 'normal', 'risky'];   // pro practice (AIG-612): risky = plan first
const OWNER_PRIOS = ['now', 'today', 'whenever'];
const KINDS = ['decide', 'plan', 'test', 'server', 'outside', 'keys', 'read'];   // plan: 🚦 ready for go / no-go (AIG-828)
const CARD_FIELDS = ['title', 'description', 'testSteps', 'type', 'priority', 'status', 'assignee', 'sprint', 'group', 'blocked', 'needsYou', 'step', 'openUrl', 'startCmd', 'holds', 'ownerPrio', 'kind', 'mins', 'server', 'serverName', 'outside', 'info', 'lifeType', 'apptAt', 'remindMins', 'remindEvery', 'focus', 'checklist', 'waitsFor', 'startDay', 'crucial', 'prevPriority', 'hidePublic', 'risk', 'qa', 'featureKey'];   // step: your own sub-column inside a status (AIG-117)

/* ---------- storage ---------- */
const now = () => new Date().toISOString();
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A slug is one name inside data/: a %5C or .. in a URL must not reach a file outside it.
const fileOf = slug => { if (/[\\/]|^\.\.?$/.test(String(slug))) throw bad(tr('srv.e.noproject'), 404); return path.join(DATA, slug + '.json'); };

/* ---------- parsed-file cache (AIG-920) ----------
   Every poll read and parsed every project file again (3.5 MB for ai-gile), so one window cost ~250 ms of server time a second.
   A file is parsed once per change (its mtime + size); load() hands out its own copy as before (callers change and save it),
   peek() hands out the shared one for read-only routes (the polls): never change what peek() returns. */
// AIG-1405: the text is kept too. load()'s own copy is JSON.parse of that text (about 15 ms for the 4.5 MB board) instead of
// structuredClone of the parsed value (about 35 ms), and save() puts what it wrote straight back here (parsed on the next read,
// never read from disk again), so a busy night of saves and polls costs the single server thread far less.
const parsed = new Map();   // file -> { sig, text, value }   (value undefined: not parsed yet)
function cached(file) {
  const st = fs.statSync(file, { bigint: true }), sig = st.mtimeNs + ':' + st.size;
  let hit = parsed.get(file);
  if (!hit || hit.sig !== sig) hit = { sig, text: fs.readFileSync(file, 'utf8'), value: undefined };
  if (hit.value === undefined) {
    hit.value = JSON.parse(hit.text);
    parsed.set(file, hit);
    damaged.delete(file);   // readable again (fixed by hand, or put back from a backup)
  }
  return hit;
}
const readJson = file => cached(file).value;
/* ---------- damaged files (AIG-1261) ----------
   A board or settings file that is there but does not parse is not "no board" or "no settings": reading it used to give null / {},
   so the project vanished from view and the next settings save wrote {} over everything. Now the first failed read keeps a copy
   aside (data/damaged/<name>-<time>.bad), the file is listed for the Home warning (GET /api/meta `damaged`), and save() and
   writeSettings() refuse to write over it until it reads again. A missing file (ENOENT) is still just missing. */
const damaged = new Map();   // file -> { file, kind, slug, sig, at, kept }
const DAMAGED_DIR = () => path.join(DATA, 'damaged');
const sigOf = file => { try { const st = fs.statSync(file, { bigint: true }); return st.mtimeNs + ':' + st.size; } catch { return null; } };
function markDamaged(file, kind, slug) {
  const sig = sigOf(file); if (!sig) { damaged.delete(file); return; }
  const had = damaged.get(file); if (had && had.sig === sig) return;
  let kept = '';
  try {   // one copy per damaged version, never over another copy
    fs.mkdirSync(DAMAGED_DIR(), { recursive: true });
    kept = path.join(DAMAGED_DIR(), path.basename(file).replace(/\.json$/, '') + '-' + now().replace(/[:.]/g, '-') + '.bad');
    fs.copyFileSync(file, kept, fs.constants.COPYFILE_EXCL);
  } catch { kept = had ? had.kept : ''; }
  damaged.set(file, { file, kind, slug, sig, at: now(), kept });
  console.error(`Damaged ${kind} file, not read and not saved over: ${file}${kept ? ' (copy: ' + kept + ')' : ''}`);
}
// Reads a file that must parse: a missing one gives null, a damaged one is marked and gives null.
function readOrMark(file, kind, slug) {
  try { return readJson(file); } catch (e) { if (e.code === 'ENOENT') damaged.delete(file); else markDamaged(file, kind, slug); return null; }
}
// True when the file is there but does not parse (read again, so a file fixed by hand can be saved at once).
function unreadable(file, kind, slug) {
  try { readJson(file); return false; } catch (e) { if (e.code === 'ENOENT') { damaged.delete(file); return false; } markDamaged(file, kind, slug); return true; }
}
function damagedList() {
  readOrMark(LOCAL_FILE, 'settings', null);   // the settings file is always looked at (cached: one stat when unchanged)
  for (const d of [...damaged.values()]) if (d.sig !== sigOf(d.file)) unreadable(d.file, d.kind, d.slug);   // changed since: read again
  const fwd = s => String(s || '').replace(/\\/g, '/');
  return [...damaged.values()].map(({ file, kind, slug, at, kept }) => ({ file: fwd(file), name: path.basename(file), kind, slug, at, kept: fwd(kept) }));
}
const refuseDamaged = file => { const e = bad(require('./i18n').t('damaged.nosave', { file: path.basename(file) }), 409); e.damaged = true; return e; };
function load(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const v = readOrMark(fileOf(slug), 'project', slug); if (!v) return null;
  try { const hit = parsed.get(fileOf(slug)), p = hit && hit.value === v ? JSON.parse(hit.text) : structuredClone(v); deriveWaits(p); return p; } catch { return null; }
}
function peek(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const p = readOrMark(fileOf(slug), 'project', slug); if (!p) return null;
  try { deriveWaits(p); return p; } catch { return null; }
}
// ⏳ Waits for (AIG-406): c.waiting = the ids of its blockers (same project) that are not done yet. Worked out on every load and save,
// so it can never be stale. c.waitHeld remembers it was waiting: when the last blocker is done the card pops back (top of its pile,
// and a team card wakes its team), here in save() so it happens at once, whatever finished the blocker.
const keyOf = id => String(id).replace(/-\d+$/, '');
const openBlockers = (p, c) => (c.waitsFor || []).filter(id => {
  if (keyOf(id) !== p.key) { const st = crossStatus(p, id); return !!st && st !== 'done'; }   // 🪐 another project in the space (AIG-450)
  const b = p.cards.find(x => x.id === id); return b && b.status !== 'done' && b !== c;
});
/* ---------- ⏳ waits across projects in one space (AIG-450) ----------
   A card may wait for a card of another project in the same space (same outermost project): APP-7 waits for WEB-3. A small index
   of every project file (key, parent, card statuses, which other keys its cards wait on), refreshed by file time and size, keeps
   load() cheap. When a project is saved, projects in its space with a card whose wait just cleared are saved too, so the card pops. */
const idx = new Map();
function indexed(slug) {
  let st; try { st = fs.statSync(fileOf(slug)); } catch { idx.delete(slug); return null; }
  const hit = idx.get(slug), sig = st.mtimeMs + ':' + st.size;
  if (hit && hit.sig === sig) return hit;
  try {
    const p = readJson(fileOf(slug)), cards = p.cards || [];   // AIG-1405: the shared parse (read only here), not a second one
    const e = { sig, slug, key: p.key, name: p.name, parent: p.parent || '', status: new Map(cards.map(c => [c.id, c.status])),
      titles: new Map(cards.map(c => [c.id, c.title])), waitsOn: new Set(cards.flatMap(c => (c.waitsFor || []).map(keyOf)).filter(k => k !== p.key)) };
    idx.set(slug, e); return e;
  } catch { return null; }
}
function rootOf(slug) { const seen = new Set(); let s = slug, e; while ((e = indexed(s)) && e.parent && !seen.has(s) && seen.size < 50) { seen.add(s); s = e.parent; } return s; }
// The other projects in p's space (none when p sits in no space and has no children).
function spaceMates(p) { const r = p.parent ? rootOf(p.parent) : p.slug; return listSlugs().filter(s => s !== p.slug && rootOf(s) === r).map(indexed).filter(Boolean); }
function crossCard(p, id) { const e = spaceMates(p).find(x => x.key === keyOf(id)); return e && e.status.has(id) ? { project: e, status: e.status.get(id), title: e.titles.get(id) } : null; }
const crossStatus = (p, id) => { const x = crossCard(p, id); return x ? x.status : null; };
let crossing = false;
function popCross(p) {
  if (crossing) return;
  crossing = true;
  try {
    for (const e of spaceMates(p)) {
      if (!e.waitsOn.has(p.key)) continue;
      const o = load(e.slug);   // load() works out c.waiting again; a held card with nothing left to wait for pops on save
      if (o && o.cards.some(c => c.waitHeld && !(c.waiting || []).length)) save(o);
    }
  } finally { crossing = false; }
}
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
  if (damaged.has(fileOf(p.slug)) && unreadable(fileOf(p.slug), 'project', p.slug)) throw refuseDamaged(fileOf(p.slug));   // AIG-1261: never over a damaged board
  const wake = popWaits(p);
  try { require('./licences').onSave(p); } catch {}   // 📮 a website-form card that is done: Replied, delete (AIG-1339)
  p.updated = now();
  const file = fileOf(p.slug), tmp = file + '.tmp', text = JSON.stringify(p);   // compact (AIG-1091): indenting a 4.6 MB board on every save cost time and bytes
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  // AIG-1405: what was just written is the cache (parsed on the next read), so the next poll does not read 4.5 MB from disk again
  parsed.delete(file);
  try { const st = fs.statSync(file, { bigint: true }); parsed.set(file, { sig: st.mtimeNs + ':' + st.size, text, value: undefined }); } catch {}
  if (p.public) setImmediate(() => { try { require('./publicboard').changed(p.slug); } catch {} });   // 🌍 a public board is sent on (AIG-603)
  setImmediate(() => { try { require('./statuspage').changed(p); } catch {} });   // 🟢 public status page (AIG-1050)
  if (wake) setImmediate(() => { try { require('./presence').nudge(p.slug); } catch {} });
  try { popCross(p); } catch {}   // 🪐 cards in the space waiting on this project (AIG-450)
}
// Machine-specific settings, kept out of git (*.local.json).
// Machine-specific settings (git-ignored). AIGILE_LOCAL points elsewhere, e.g. for tests.
const LOCAL_FILE = process.env.AIGILE_LOCAL || path.join(ROOT, 'aigile.local.json');
// Read-only view of the settings, no clone (AIG-1091): never change what it returns.
function peekSettings() { return readOrMark(LOCAL_FILE, 'settings', null) || {}; }
function localSettings() {
  try { return structuredClone(readOrMark(LOCAL_FILE, 'settings', null) || {}); } catch { return {}; }
}
// Every settings save goes through here (AIG-1261): a damaged settings file is never replaced by the {} localSettings() gave.
function writeSettings(s) {
  if (unreadable(LOCAL_FILE, 'settings', null)) throw refuseDamaged(LOCAL_FILE);
  writeAtomic(LOCAL_FILE, JSON.stringify(s, null, 2) + '\n');
  parsed.delete(LOCAL_FILE);
}
// After a file was put back from a backup (lib/backup.js): forget what was read before.
const forgetFile = file => { parsed.delete(file); damaged.delete(file); };
// 📁 Where new project folders go (AIG-706): "projectsFolder" in aigile.local.json, default next to AI-gile.
const projectsFolder = () => process.env.AIGILE_HOME || String(localSettings().projectsFolder || '').trim() || path.dirname(ROOT);
// AIG-1298: the folder "Make one for me" and a new project's default folder get: <projectsFolder>/<name>, or "<name> 2", "<name> 3"...
// when that one is already some other project's folder (an existing folder no project uses is taken as it is).
function newFolderFor(name, slug, under = projectsFolder()) {
  const base = String(name || '').replace(/[<>:"/\\|?*]/g, '').trim() || slug, norm = x => path.resolve(x).replace(/\\/g, '/').toLowerCase();
  const used = new Set(listSlugs().map(peek).filter(p => p && p.path && p.slug !== slug).map(p => norm(p.path)));
  for (let i = 1; i < 100; i++) { const dir = path.join(under, i === 1 ? base : base + ' ' + i); if (!used.has(norm(dir))) return dir; }
  return path.join(under, base + ' ' + Date.now());
}
function listSlugs() {
  return fs.readdirSync(DATA).filter(f => f.endsWith('.json') && !f.endsWith('.dm-archive.json')).map(f => f.slice(0, -5));
}

/* ---------- project summary ---------- */
// The owner's attention is needed if a team asked him something, or a feature is waiting for his test.
// A card assigned to the owner is a task: something only he can do.
// Wait and see: a card in 'verify' can be snoozed for an hour. Compared on read, so it comes back by itself.
const SNOOZE_MS = 60 * 60e3;
// Put off for a while (Wait and see / Later): tests, questions and blocks alike (AIG-167).
// AIG-671: a test that waits for morning (c.morning, set when it went to verify while the owner was tired) stays hidden while tired.
const tiredNow = () => { try { return require('./tired').now(localSettings()); } catch { return false; } };
// 🛌 AIG-985: on a rest day only urgent cards (showstoppers) wait on the owner; the rest come back when the rest day ends.
const isSnoozed = c => (!!c.snoozedUntil && c.snoozedUntil > now()) || (!!c.morning && tiredNow()) || (!require('./status').critical(c) && require('./status').resting());
// Awake again: the morning flag goes (housekeeping; isSnoozed already ignores it when awake).
function clearMorning() {
  if (tiredNow()) return;
  for (const slug of listSlugs()) { const q = peek(slug); if (!q || !q.cards.some(c => c.morning)) continue; const p = load(slug); if (p && p.cards.some(c => c.morning)) { p.cards.forEach(c => { delete c.morning; }); save(p); } }
}
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

// 🐝 Swarm workers (AIG-901) are in flight from the moment they start, before their aigile start moves the card.
function withWorkers(p, list, pr) {
  const ws = (pr && pr.workers) || [];
  if (!ws.length) return list;
  const out = list.map(f => { const w = ws.find(x => x.id === f.id); return w ? { ...f, worker: w.branch } : f; });
  for (const w of ws) { const c = !out.some(f => f.id === w.id) && p.cards.find(c => c.id === w.id); if (c) out.unshift({ id: c.id, title: c.title, assignee: c.assignee, updated: w.startedAt, worker: w.branch }); }
  return out;
}

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
function projectOrder() { try { return [...readJson(ORDER_FILE())]; } catch { return []; } }
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
  if (parent === slug) throw bad(tr('srv.st.inself'));
  if (!load(parent)) throw bad(tr('srv.st.noparent', { name: parent }));
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
    slug: p.slug, name: p.name, key: p.key, description: p.description, path: p.path, pathMissing: pathMissing(p) || undefined, ...look(p), parent: p.parent || undefined,
    archived: !!p.archived, sample: !!p.sample || undefined, private: !!p.private || undefined, personal: !!p.personal || undefined, aiOff: !!p.aiOff || undefined, approvals: !!p.approvals || undefined, peerReview: !!p.peerReview || undefined, feedback: p.feedback || undefined, callUrl: p.callUrl || undefined, service: (s => s && { ...s, up: require('./uptime').upOf(p.slug) })(require('./service').of(p)) || undefined, public: !!p.public || undefined, publicName: p.publicName || undefined, publicHideTitles: p.publicHideTitles || undefined, srv: p.srv || undefined, updated: p.updated, counts,
    total: p.cards.length,
    progress: active.length ? counts.done / active.length : 0,
    needsYou: p.cards.filter(waitingOnRich).length,
    toTest: p.cards.filter(c => c.status === 'verify' && !isSnoozed(c) && !isTimed(c) && !isWaiting(c)).length,
    blocked: p.cards.filter(c => c.blocked && c.status !== 'done').length,
    team: (TL => { const x = TL.ctxOf(p, presenceOf(p.slug)); return (p.team || []).filter(m => !/retired/i.test(m.status || '') && TL.live(m, x)); })(require('./teamlive')),   // AIG-1344: only who is really working now
    crew: (p.team || []).filter(m => m.kind !== 'person' && !m.friend && !/retired/i.test(m.status || '')).map(m => ({ name: m.name, role: m.role || '' })),   // idle too: the idea box's Send to (AIG-833)
    noTeam: (!p.teamless && !(p.team || []).some(m => !/retired/i.test(m.status || ''))) || undefined,   // AIG-1298: nobody on it, so nothing gets worked on
    teamless: !!p.teamless || undefined,
    inFlight: withWorkers(p, inFlight(p), presenceOf(p.slug)),
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
function teamOwes(c) {
  const last = (c.comments || []).filter(m => !m.poke && !m.wake).pop();
  return !last || isRich(last.author);
}
// A folder is set but isn't on disk (yet, or any more) (AIG-740).
const pathMissing = p => !!p.path && !fs.existsSync(p.path);
function attention(p, pr) {
  if (p.archived || !p.path || pathMissing(p)) return null;   // no folder (or not on disk): no team to wake (AIG-721, AIG-740)
  // Only cards the team can act on (AIG-269): one waiting on the owner (a question, a block, a task) doesn't make a team asleep.
  const open = p.cards.filter(c => OPEN.includes(c.status) && !waitingOnRich(c) && !isTimed(c) && !isWaiting(c));
  if (!pr.online && open.length) return { kind: 'asleep', n: open.length, why: `asleep with ${open.length} card${open.length > 1 ? 's' : ''} to do` };
  // AIG-767: only a team card whose latest comment is the owner's waits on the team; once the lead has answered (and the
  // board's own pokes don't count) it waits on the owner, and no poke or wake is due.
  const waiting = p.cards.filter(c => c.status === 'team' && teamOwes(c)).map(lastRichAt).sort()[0];
  if (pr.online && waiting && Date.now() - new Date(waiting) > STUCK_MS) return { kind: 'stuck', why: 'your comment unanswered since ' + waiting, since: waiting };
  return null;
}

/* ---------- card rules and helpers ---------- */
function cleanCard(input, partial) {
  const out = {};
  for (const k of CARD_FIELDS) if (k in input) out[k] = input[k];
  if (!partial && !out.title) throw bad(tr('srv.e.title'));
  if ('title' in out && !String(out.title).trim()) throw bad(tr('srv.st.titleempty'));
  if ('status' in out && !STATUSES.includes(out.status)) throw bad(tr('srv.e.statusof', { list: STATUSES.join(', ') }));
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
  if ('startDay' in out) out.startDay = out.startDay === true || out.startDay === 'true' || out.startDay === 1 || undefined;   // AIG-546: a start-the-day task
  if ('crucial' in out) out.crucial = out.crucial === true || out.crucial === 'true' || out.crucial === 1 || undefined;   // ⭐ crucial (AIG-549): runs even while the usage saver is on
  if ('focus' in out) out.focus = !!out.focus || undefined;   // 🎯 needs focus (AIG-395)
  if ('startCmd' in out) out.startCmd = String(out.startCmd || '').slice(0, 300);
  if ('type' in out && !TYPES.includes(out.type)) throw bad('type must be one of ' + TYPES.join(', '));
  if ('priority' in out && !PRIORITIES.includes(out.priority)) throw bad('priority must be one of ' + PRIORITIES.join(', '));
  if ('risk' in out) { if (out.risk === '' || out.risk === null || out.risk === 'normal') out.risk = undefined; else if (!RISKS.includes(out.risk)) throw bad('risk must be one of ' + RISKS.join(', ')); }
  if ('featureKey' in out) { const k = String(out.featureKey || '').trim(); if (k && !/^[a-z0-9][a-z0-9-]{0,29}$/.test(k)) throw bad('featureKey must be 1 to 30 of a-z, 0-9 and -'); out.featureKey = k || undefined; }   // AIG-847: the switch a "for <friend>" card belongs to
  if ('qa' in out) out.qa = cleanQa(out.qa);   // 🟢/🔴 the merge gate (AIG-613)
  if ('group' in out) out.group = String(out.group === true ? '' : out.group || '').replace(/\s+/g, ' ').trim().slice(0, 60);   // card groups (AIG-386)
  if ('serverName' in out) out.serverName = String(out.serverName || '').trim().slice(0, 60);
  for (const k of ['blocked', 'needsYou', 'server', 'outside', 'info']) if (k in out) out[k] = !!out[k];
  require('./life').clean(out);   // AIG-394: lifeType, apptAt, remindMins, focus
  return out;
}
// The merge gate (AIG-613): { areas, result, full, at, by, note }; result and full are pass or fail. Empty clears it.
function cleanQa(q) {
  if (!q) return undefined;
  if (typeof q !== 'object' || Array.isArray(q)) throw bad('qa must be { areas, result, full, note, by }');
  const pf = (v, k, opt) => { if (opt && (v === undefined || v === '' || v === null)) return undefined; if (!['pass', 'fail'].includes(v)) throw bad('qa ' + k + ' must be pass or fail'); return v; };
  const areas = (Array.isArray(q.areas) ? q.areas : String(q.areas || '').split(',')).map(a => String(a).trim().slice(0, 40)).filter(Boolean).slice(0, 30);
  return { areas, result: pf(q.result, 'result'), full: pf(q.full, 'full', true), at: now(), by: String(q.by || '').trim().slice(0, 40) || undefined, note: String(q.note || '').replace(/\s+/g, ' ').trim().slice(0, 300) || undefined };
}
// A checklist given as plain words keeps the ticks of items with the same text (AIG-406); `fresh` marks those.
function keepTicks(old, list) {
  return list.map(({ fresh, ...x }) => { const o = fresh && (old || []).find(y => y.done && y.text.toLowerCase() === x.text.toLowerCase()); return o ? { ...x, done: true, by: o.by, at: o.at } : x; });
}
// ⏳ Waits for: only cards of this project that exist, not itself, and no two cards waiting for each other. A card of another
// project in the same space is fine too (AIG-450).
function checkWaits(p, c, ids) {
  for (const id of ids) {
    if (keyOf(id) !== p.key) {
      if (!crossCard(p, id)) throw bad(tr('srv.st.nowaitspace', { id }));
      continue;
    }
    const b = p.cards.find(x => x.id === id);
    if (!b) throw bad(tr('srv.st.nowait', { id }));
    if (b === c) throw bad(tr('srv.st.waitself'));
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
function toTeam(c, back) {
  if (require('./noai').isOn()) { if (back && c.status !== 'todo') { c.status = back; delete c.prevStatus; } return; }   // AIG-821: no AI, no team to hand it to: it stays put, a send back goes to `back`
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
// A call link (AIG-861): http(s) only, up to 500 characters; empty clears it. The app only shows a link, it never carries the call.
function callUrl(v) {
  const s = String(v == null ? '' : v).trim(); if (!s) return undefined;
  let u; try { u = new URL(s); } catch { throw bad(tr('srv.st.callurl')); }
  if (!/^https?:$/.test(u.protocol) || s.length > 500) throw bad(tr('srv.st.callhttp'));
  return s;
}
function need(p) { if (!p) throw bad(tr('srv.e.project404'), 404); return p; }
function findCard(p, id) {
  const c = p.cards.find(c => c.id.toLowerCase() === String(id).toLowerCase());
  if (!c) throw bad(tr('srv.e.card404'), 404);
  return c;
}

// Atomic write for the small side files (temp file + rename), like save().
function writeAtomic(file, text) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }

module.exports = {
  peek, rootOf,
  writeAtomic, projectOrder, setProjectOrder, byOrder, checkParent,
  PORT, HOST, ROOT, DATA, PUBLIC, LOCAL_FILE, OWNER_PRIOS, KINDS, STATUSES, TYPES, PRIORITIES, CARD_FIELDS,
  INFO_RE, isInfoSteps,
  now, slugify, load, save, localSettings, peekSettings, writeSettings, damagedList, forgetFile, projectsFolder, newFolderFor, listSlugs,
  teamOwes,   TEAM_ROLES, rolesOn, SNOOZE_MS, isSnoozed, isTimed, waitingOnRich, taskReplied, inFlight, summary, attention, look, clearMorning, tiredNow,
  cleanCard, keepTicks, checkWaits, syncHolds, isWaiting, openBlockers, crossCard, spaceMates, isRich, owner, forgetOwner, toTeam, docList, bad, need, findCard, callUrl,
};
