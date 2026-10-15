// 🧭 Lead Scrum Master (AIG-359, docs/SCRUM-MASTER.md): the 🌙 night watchman grown into one role with a day and a
// night mode. At night lib/watchman.js does the rounds (unchanged); by day, when it is in the team, this file does them, in plain
// code (free): it sorts the owner's 💡 "decide later" ideas into the right project, wakes teams asleep with To do, notes
// cards stuck in progress, cards waiting on the owner too long and look-alike cards across projects, and posts one short
// digest a day. An AI run only when the owner writes to it, when a round finds something rules can't fix, or at digest
// time with findings; never under ⛔ No Token Mode or over the token budget, and at most aiRunsPerDay a day.
// State lives in data/scrummaster.conf (not .json: every .json in data/ is a project).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DATA, ROOT, now, load, save, listSlugs, attention, owner, bad, localSettings, waitingOnRich } = require('./store');
const noTokens = require('./notokens');
const { t: tr } = require('./i18n');

const NAME = '🧭 Lead Scrum Master', SLUG = '_scrummaster';
const FILE = path.join(DATA, 'scrummaster.conf');
const FOLDER = path.join(DATA, 'scrummaster');   // its own folder: its CLAUDE.md is the role brief, for a VS Code or terminal session
const EVERY_ENV = +process.env.AIGILE_SM_MS || 0;   // tests: a short interval instead of the scale's
const WAKE_GAP_MS = 60 * 60e3, OWNER_WAIT_MS = 3 * 864e5;
// The diligence scale (AIG-441), 1..5, "push" in docs/PROFILES.md: the one table. Plain numbers, minutes:
// everyMin: how often the plain-code round runs; stuckMin: a card in progress with nobody on it this long is poked;
// remindMin: a question waiting for the owner this long gets ONE bump (0 = never); cap: the default daily AI-run cap. Level 3 is today's night behaviour.
const PUSH = {
  1: { icon: '🍽️', everyMin: 30, stuckMin: 1440, remindMin: 0, cap: 4 },
  2: { icon: '', everyMin: 20, stuckMin: 480, remindMin: 0, cap: 6 },
  3: { icon: '⚖️', everyMin: 10, stuckMin: 180, remindMin: 240, cap: 8 },
  4: { icon: '', everyMin: 5, stuckMin: 60, remindMin: 120, cap: 12 },
  5: { icon: '🏇', everyMin: 2, stuckMin: 30, remindMin: 60, cap: 16 },
};
const PUSH_DEFAULT = 3;
const pushLevel = () => { const n = parseInt((localSettings().scrumMaster || {}).push, 10); return PUSH[n] ? n : PUSH_DEFAULT; };
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {} };
const today = () => new Date().toLocaleDateString('sv');
const ago = at => at ? Date.now() - Date.parse(at) : Infinity;
const int = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const settings = () => { const s = localSettings().scrumMaster || {}; return { cap: int(s.aiRunsPerDay, PUSH[pushLevel()].cap, 0, 100), digestAt: /^\d{1,2}:\d{2}$/.test(s.digestAt || '') ? s.digestAt : '17:00' }; };
const active = () => listSlugs().map(load).filter(p => p && !p.archived);
const quiet = () => { try { return !!require('./watchman').status(); } catch { return false; } };
// The projects it may act on: every active one (a night's watch list is the watchman's own).
const watchList = () => active().map(p => p.slug);

/* ---------- the daily AI-run cap ---------- */
function runsToday(s = read()) { return s.day === today() ? s.runs || 0 : 0; }
// Take one AI run from today's allowance: null when allowed, else the reason (said in the chat).
function takeRun() {
  const s = read(), cap = settings().cap;
  if (s.day !== today()) { s.day = today(); s.runs = 0; }
  if (s.runs >= cap) { write(s); return tr('srv.sm.capped', { cap }); }
  s.runs++; write(s); return null;
}

/* ---------- the prompt (the role is the CLAUDE.md of its folder) ---------- */
// AIG-457: the role text never changes between runs (cache-friendly, and written to CLAUDE.md only when it differs); a run's
// prompt carries only the owner's new words and a short "what changed" list. Runs share one session (see session()).
function role() {
  const me = owner(), cli = `node "${path.join(ROOT, 'aigile.js')}"`;
  return [
    `You are the ${NAME} on ${me}'s AI-gile board: in charge of every project lead, by day and by night.`,
    `Each run starts with what ${me} just wrote to you and/or a short list of what changed. Make it happen now; don't just acknowledge it.`,
    `Board commands: ${cli} brief <project> (see a project), ${cli} list / show (check), ${cli} wake <project> --sprint (start a team on its To do), ${cli} add <project> "title" --status team --as "${NAME}" (an order or new work in a lead's For the team), ${cli} comment <project> <card> "text" --as "${NAME}", ${cli} move <project> <card> backlog|todo (only within ${me}'s rules).`,
    `You watch every active project (${cli} list); the changes list says when that set changes. Leave every other project alone and don't mention it.`,
    `You MAY wake teams, add cards or orders to a lead's For the team signed "${NAME}", move cards between backlog and To do within ${me}'s rules, sort ${me}'s ideas into the right project, and write to ${me} in your own chat. You MAY NOT write code, push, restart the board, change settings or permissions, accept or close cards for ${me}, or act on projects you don't watch. Talk to leads only through cards and comments.`,
    // 💡 Ideas sent to it (AIG-388): it sorts them into cards. It makes new projects and spaces itself (AIG-706).
    `A message starting "💡 Idea:" is ${me}'s idea for you to handle: add it as cards in the right project's For the team (several projects if it spans them). You can create projects and spaces: for "a new project ..." run ${cli} new-project "Name" --folder (makes and connects its folder in ${me}'s projects folder; add --parent <space> to put it inside a space), then add its cards. Only ask ${me} where the folder goes if they want it somewhere else.`,
    `When done, answer ${me} in ONE short plain line with ${cli} watchsay "...": answer what ${me} asked, or name what only ${me} can unblock. No routine reports. Then stop.`,
  ].join(' ');
}
// One run's prompt: new words, the board's own findings, and what changed since the last run (everything, on a fresh session).
function brief({ night, watch = [], asks = [], routine = [], recent = '', fresh = true, unanswered = '' } = {}) {
  const me = owner(), s = read(), last = s.lastWatch, ch = [];
  if (fresh || !last) ch.push(`Projects you watch: ${watch.join(', ') || 'none'}.`);
  else {
    const add = watch.filter(x => !last.includes(x)), gone = last.filter(x => !watch.includes(x));
    if (add.length) ch.push(`Now watching: ${add.join(', ')}.`);
    if (gone.length) ch.push(`No longer watching: ${gone.join(', ')}.`);
    if (!!s.lastNight !== !!night) ch.push(night ? `${me} is asleep: the night watch has begun.` : `${me} is back: the night watch is over.`);
  }
  s.lastWatch = watch; s.lastNight = !!night; write(s);
  return [
    asks.length ? `${me} wrote: ${asks.map(a => '"' + a + '"').join(' ')}` : '',
    // AIG-988: the owner's last message, if nothing answered it yet, comes first; a routine run with nobody asking stays silent
    !asks.length && unanswered ? `${me}'s last message is still unanswered: "${unanswered}" Answer it first.` : '',
    routine.length ? `The board's own round found something its rules can't fix: ${routine.join(' ')}` : '',
    !asks.length && !unanswered ? `Nobody wrote to you: use watchsay only if something needs ${me}; otherwise say nothing.` : '',
    ch.length ? `What changed: ${ch.join(' ')}` : '',
    fresh && recent ? `The chat so far: ${recent}` : '',
  ].filter(Boolean).join(' ');
}
// The one conversation its runs share (--session-id, then --resume), started fresh after an hour idle or when a run went wrong.
const IDLE_MS = +process.env.AIGILE_SM_IDLE_MS || 60 * 60e3;
function session(fresh) {
  const s = read(), resume = !fresh && s.session && ago(s.session.at) < IDLE_MS;
  if (!resume) s.session = { id: require('crypto').randomUUID(), at: now() };
  write(s); return { resume: !!resume, id: s.session.id };
}
function sessionUsed() { const s = read(); if (s.session) { s.session.at = now(); write(s); } }
// Its folder: the role as CLAUDE.md and the one permission it needs (the board's commands, run with node).
function folder() {
  fs.mkdirSync(path.join(FOLDER, '.claude'), { recursive: true });
  const cli = `node "${path.join(ROOT, 'aigile.js')}"`, md = path.join(FOLDER, 'CLAUDE.md');
  const text = `# ${NAME}\n\n${role()}\n\nIn a window: wait for ${owner()}'s messages with \`${cli} smwait\` (run it in the background), act on each one, answer with watchsay, then wait again.\n\nThe role in full: ${path.join(ROOT, 'docs', 'SCRUM-MASTER.md')}\n`;
  let old = ''; try { old = fs.readFileSync(md, 'utf8'); } catch {}
  if (old !== text) fs.writeFileSync(md, text);
  const st = path.join(FOLDER, '.claude', 'settings.local.json');
  if (!fs.existsSync(st)) fs.writeFileSync(st, JSON.stringify({ permissions: { allow: ['Bash(node:*)'] } }, null, 2));
  return FOLDER;
}

/* ---------- the role, status ---------- */
// AIG-476: the Lead Scrum Master is an optional team role (Setup, scrumMaster.role in aigile.local.json). In the team it is
// always on, day and night: there is no launching. Not in the team, it does nothing by day. An owner who had launched it
// before keeps it, and keeps the 🌙 night watch on: set once at start-up, never starting a run by itself.
const inTeam = () => (localSettings().scrumMaster || {}).role === true;
function migrate() {
  const s = read(); if (s.on === undefined || s.migrated) return;
  if (s.on && (localSettings().scrumMaster || {}).role === undefined) require('./setup').saveSetup({ prefs: { smRole: true, watchAll: true } });
  delete s.on; delete s.where; s.migrated = true; write(s);
}
// AIG-456: a window session counts as present for 20 minutes after each smwait poll, so while it is busy working its
// owner's messages queue for its next smwait (never a hidden second run beside it). The cursor marks what it was handed
// (or what a background run took), so nothing is lost between two waits and nothing arrives twice.
const WINDOW_MS = +process.env.AIGILE_SM_WINDOW_MS || 20 * 60e3;
const listening = (s = read()) => inTeam() && s.where !== 'background' && ago(s.heardAt) < WINDOW_MS;
function heard() { const s = read(); s.heardAt = now(); write(s); }
// The owner's messages a waiting session has not been handed yet (plus the board's notes for it), then moves the cursor on.
function handOver(msgs, since) {
  const s = read(), first = !s.cursor; if (first) s.cursor = since;   // the first wait fixes the cursor, so a later wait (with a later "since") still gets what came in between
  const out = msgs.filter(m => m.mine && m.at > s.cursor);
  const notes = (s.notes || []).map(text => ({ at: now(), mine: true, text: '(board) ' + text }));
  if (out.length) s.cursor = out[out.length - 1].at;
  if (notes.length) delete s.notes;
  if (first || out.length || notes.length) write(s);
  return [...out, ...notes];
}
// A background run took everything up to now; a window session must not be handed it again.
function passed() { const s = read(); s.cursor = now(); write(s); }
function note(text) { const s = read(); s.notes = [...(s.notes || []), text].slice(-20); write(s); }
function status() {
  const s = read(), set = settings();
  const lv = pushLevel();
  return { on: inTeam(), night: (localSettings().night || {}).watchAll !== false, push: lv, everyMin: PUSH[lv].everyMin, scale: PUSH, where: s.where || null, since: s.since || null, listening: listening(s), runsToday: runsToday(s), cap: set.cap, digestAt: set.digestAt,
    flagged: (s.flagged || []).length, ...require('./watchman').runState(), lastRound: s.lastRound || null, lastDigest: s.lastDigest || null, digestText: s.digestText || null, sorted: (s.sorted || []).slice(-20) };
}

/* ---------- 💡 decide-later ideas (AIG-351): rules first, Haiku only if unclear ---------- */
const isIdea = c => c.createdBy === 'Ideas' && c.quick && c.status === 'backlog';
const words = s => String(s || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
// Score each project by its name, slug, key and the longer words of its name in the idea's text. A "slug:" start wins outright.
// Is project s inside space top (at any depth)?
function isInside(projects, s, top) { const seen = new Set(); for (let p = projects.find(x => x.slug === s); p && p.parent && !seen.has(p.slug); p = projects.find(x => x.slug === p.parent)) { if (p.parent === top) return true; seen.add(p.slug); } return false; }
function byRules(text, projects) {
  const lo = String(text).toLowerCase(), w = new Set(words(text));
  const pre = (lo.match(/^\s*([\w-]+)\s*:/) || [])[1];
  if (pre) { const p = projects.find(p => p.slug === pre || p.key.toLowerCase() === pre || p.name.toLowerCase() === pre); if (p) return { slug: p.slug, why: 'starts with ' + pre + ':' }; }
  let scored = projects.map(p => {
    let n = 0; const hits = [];
    if (lo.includes(p.name.toLowerCase())) { n += 3; hits.push(p.name); }
    else if (w.has(p.slug)) { n += 3; hits.push(p.slug); }
    if (p.key && w.has(p.key.toLowerCase())) { n += 2; hits.push(p.key); }
    for (const x of words(p.name)) if (x.length >= 4 && w.has(x) && !hits.includes(p.name)) { n += 1; hits.push(x); }
    for (const x of (p.keywords || [])) if (x && lo.includes(String(x).toLowerCase())) { n += 2; hits.push(x); }
    return { slug: p.slug, n, hits };
  }).sort((a, b) => b.n - a.n);
  // 🪐 A space mentioned together with a project inside it steps aside: the idea lands in that child (AIG-437).
  const hitSpace = x => scored.some(y => y.n > 0 && y !== x && isInside(projects, y.slug, x.slug));
  scored = scored.filter(x => !(x.n > 0 && hitSpace(x)));
  if (scored[0] && scored[0].n > 0 && (!scored[1] || scored[0].n > scored[1].n)) return { slug: scored[0].slug, why: 'mentions ' + scored[0].hits.join(', ') };
  return null;
}
function aiAllowed() { if (noTokens.isOn() || require('./noai').isOn()) return false; try { if (require('./budget').overBudget() || require('./budget').saving()) return false; } catch {} return true; }
// One tiny Haiku call (no tools, user settings only, from a neutral folder): the reply text, or null (AIG-1105: lib/desk.js uses it too).
function haikuText(prompt) {
  const { agentCommand, spawnAgent } = require('./presence');
  return new Promise(resolve => {
    let out = '', done = false, child, t;
    const end = v => { if (done) return; done = true; clearTimeout(t); resolve(v); };
    try { child = spawnAgent(agentCommand(), ['-p', prompt.replace(/\s*\n+\s*/g, ' '), '--model', 'haiku', '--max-turns', '1', '--tools', '', '--setting-sources', 'user'], { cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return resolve(null); }
    t = setTimeout(() => { try { child.kill(); } catch {} end(null); }, 45e3);
    child.stdout.on('data', d => out += d);
    child.on('error', () => end(null));
    child.on('exit', () => end(out));
  });
}
// Which project slug is the idea for (one Haiku call), or null.
function askHaiku(text, projects) {
  const list = projects.map(p => `${p.slug} (${p.name}${p.description ? ': ' + String(p.description).slice(0, 80) : ''})`).join('; ');
  const prompt = `Projects: ${list}. The owner noted this idea: "${String(text).slice(0, 400)}". Which ONE project is it for? Reply with only its slug, or none.`;
  return haikuText(prompt).then(out => { if (out == null) return null; const lo = out.toLowerCase(); return projects.find(p => new RegExp('(^|[^\w-])' + p.slug + '([^\w-]|$)').test(lo)) || null; });
}
// Move one idea into the chosen project's For the team as a 💬 card for its lead (the same card when it is already there).
function place(from, c, to, why) {
  const note = `\n\n_${NAME}: sorted here from your 💡 ideas (${why})._`;
  if (from.slug === to.slug) {
    Object.assign(c, { status: 'team', needsYou: false, createdBy: NAME, description: (c.description || '') + note, updated: now() });
    save(from); return c.id;
  }
  const id = to.key + '-' + to.nextId++;
  to.cards.push({ id, title: c.title, description: (c.description || '') + note + (c.attachments && c.attachments.length ? `\n\n_Its files stayed on ${from.name} ${c.id}._` : ''),
    testSteps: '', type: c.type || 'task', priority: c.priority || 'normal', status: 'team', assignee: '', sprint: '', blocked: false, needsYou: false,
    createdBy: NAME, quick: true, created: now(), updated: now(), comments: [] });
  save(to);
  if (!(c.attachments && c.attachments.length)) from.cards = from.cards.filter(x => x !== c);
  else Object.assign(c, { status: 'done', needsYou: false, updated: now() }), c.comments.push({ author: NAME, at: now(), text: `- 🧭 Sorted into ${to.name} as ${id}` });
  save(from); return id;
}
let haikuBusy = false;
async function triage(s, log) {
  const ps = active(); if (!ps.length) return 0;
  let n = 0;
  for (const p0 of ps) for (const c of p0.cards.filter(isIdea)) {
    const text = [c.title.replace(/^💬\s*/, ''), c.description].join('\n');
    let pick = byRules(text, ps), how = 'rules';
    if (!pick && ps.length === 1) pick = { slug: ps[0].slug, why: 'your only project' };
    if (!pick) {
      if ((s.unclear || []).includes(p0.slug + '/' + c.id) || haikuBusy || !aiAllowed()) continue;
      haikuBusy = true; let h = null; try { h = await askHaiku(text, ps); } catch {} haikuBusy = false;
      s = Object.assign(read(), { unclear: [...(read().unclear || []), p0.slug + '/' + c.id].slice(-200) });
      if (!h) { write(s); log(tr('srv.sm.unclear', { title: c.title.replace(/^💬\s*/, '').slice(0, 60) })); continue; }
      pick = { slug: h.slug, why: 'Haiku picked it' }; how = 'haiku';
    }
    const from = load(p0.slug), card = from && from.cards.find(x => x.id === c.id && isIdea(x)), to = pick.slug === p0.slug ? from : load(pick.slug);
    if (!card || !to) continue;
    const id = place(from, card, to, pick.why);
    s = read(); s.sorted = [...(s.sorted || []), { at: now(), from: p0.slug, card: c.id, to: to.slug, id, how, why: pick.why, title: c.title }].slice(-100); write(s);
    n++;
  }
  return n;
}

/* ---------- the day round: plain code ---------- */
const PRIO = ['urgent', 'high', 'normal', 'low'];
function lookAlike(a, b) { const x = new Set(words(a).filter(w => w.length > 3)), y = new Set(words(b).filter(w => w.length > 3)); if (x.size < 3 || y.size < 3) return false; let i = 0; for (const w of x) if (y.has(w)) i++; return i / (x.size + y.size - i) >= 0.6; }
// AIG-989: a card on the owner (a task for them, or assigned to them under a longer name: "Richard" for "Rich") isn't stuck
function onOwner(c) {
  const o = owner().toLowerCase(), a = String(c.assignee || '').trim().toLowerCase().split(/\s+/)[0];
  if (o && a.startsWith(o)) return true;
  try { return !!require('./routes/comments').openMarked(c, 'task'); } catch { return false; }
}
function findings(watch) {
  const ps = active().filter(p => watch.includes(p.slug)), out = { stuck: [], waiting: [], overlap: [] };
  const { presenceOf } = require('./presence');
  for (const p of ps) {
    const running = presenceOf(p.slug).running;
    for (const c of p.cards) {
      if (c.status === 'doing' && !running && !waitingOnRich(c) && !onOwner(c) && ago(c.updated) > PUSH[pushLevel()].stuckMin * 60e3 * require('./today').factor(p.slug)) out.stuck.push({ project: p.slug, name: p.name, id: c.id, title: c.title });
      if (waitingOnRich(c) && !isIdea(c) && ago(c.updated) > OWNER_WAIT_MS) out.waiting.push({ project: p.slug, name: p.name, id: c.id, title: c.title });
    }
  }
  const open = ps.flatMap(p => p.cards.filter(c => !['done'].includes(c.status) && !isIdea(c)).map(c => ({ p, c })));
  for (let i = 0; i < open.length; i++) for (let j = i + 1; j < open.length; j++)
    if (open[i].p.slug !== open[j].p.slug && lookAlike(open[i].c.title, open[j].c.title)) out.overlap.push([`${open[i].p.name} ${open[i].c.id}`, `${open[j].p.name} ${open[j].c.id}`, open[i].c.title]);
  return out;
}
let rounding = false;
async function round() {
  if (rounding) return status();
  let s = read(); const night = quiet(), on = inTeam();
  if (!on && !night) return status();
  rounding = true;
  const said = [];
  try {
    await triage(s, t => said.push(t));
    s = read();
    require('./store').clearMorning();
    if (on) { remind(s); s = read(); }   // day and night: plain code, free
    if (!night) {   // by night the watchman does the rest (lib/watchman.js)
      const watch = require('./today').order(watchList()), f = findings(watch);   // AIG-596: 🔥 projects first
      s.woke = s.woke || {};
      // AIG-540: a board where nothing has moved (no card change or comment) for a while, with To do or in-progress work
      // that isn't waiting on the owner, is woken (a restart when a session hung). Over the token budget: say so once.
      s.stalled = s.stalled || {};
      if (!noTokens.isOn()) for (const slug of watch) {
        const p = load(slug); if (!p || !p.path) continue;
        const work = p.cards.filter(c => (c.status === 'todo' || c.status === 'doing') && c.approval !== 'waiting' && !waitingOnRich(c) && !c.blocked && !(c.waiting && c.waiting.length));
        if (!work.length) continue;
        const stallMs = Math.min(Math.max(PUSH[pushLevel()].stuckMin, 20), 60) * 60e3 * require('./today').factor(slug);   // AIG-596: 🔥 looked at twice as often
        const last = Math.max(0, ...p.cards.flatMap(c => [Date.parse(c.updated) || 0, ...(c.comments || []).map(m => Date.parse(m.at) || 0)]));
        if (Date.now() - last < stallMs || ago(s.stalled[slug]) < stallMs) continue;
        const over = require('./budget').overBudget();
        if (over) { if (s.stalledBudget !== over) { s.stalledBudget = over; said.push(tr('srv.sm.stalled.budget', { name: p.name, why: over })); } continue; }
        try {
          const { startTeam } = require('./presence'), r = startTeam(p, true, false, true, true);
          // AIG-598: the wake goes in that project's log, not the owner's chat (routine, not news)
          if (r && (r.running || r.queued)) { s.stalled[slug] = now(); const q = load(slug); if (q) { (q.log = q.log || []).push({ at: now(), author: NAME, kind: 'log', text: tr('srv.sm.stalled', { name: p.name, min: Math.round((Date.now() - last) / 60e3) }) }); save(q); } }
        } catch {}
      }
      if (!noTokens.isOn()) for (const slug of watch) {
        const p = load(slug), { presenceOf, startTeam } = require('./presence'), pr = presenceOf(slug), at = p && p.path && attention(p, pr);
        if (!at || at.kind !== 'asleep' || !p.cards.some(c => c.status === 'todo' && c.approval !== 'waiting' && !waitingOnRich(c)) || ago(s.woke[slug]) < WAKE_GAP_MS) continue;
        try { const r = startTeam(p, true, false, 'day', true); if (r && (r.running || r.queued)) s.woke[slug] = now(); } catch {}
      }
      // Something rules can't fix: a card stuck in progress with nobody on it. One AI run (Sonnet) per new one.
      // AIG-989: a card no longer in progress (done, or moved on) leaves the flagged list
      const inDoing = new Set(active().flatMap(p => p.cards.filter(c => c.status === 'doing').map(c => p.slug + '/' + c.id)));
      s.flagged = (s.flagged || []).filter(k => inDoing.has(k));
      const fresh = f.stuck.filter(x => !s.flagged.includes(x.project + '/' + x.id));
      if (fresh.length) {
        s.flagged = [...s.flagged, ...fresh.map(x => x.project + '/' + x.id)].slice(-200); write(s);
        // AIG-567: each newly stale card gets one free 👉 "any update?" (once: it is flagged now); the digest lists them too.
        if (!noTokens.isOn()) for (const x of fresh) try {
          const q = load(x.project), cd = q && q.cards.find(k => k.id === x.id);
          if (cd && cd.status === 'doing') { cd.comments.push({ author: NAME, text: '👉 any update?', at: now(), poke: true, auto: true }); cd.updated = now(); save(q); }   // no wake of its own: the routine() run below is the AI step
        } catch {}
        require('./watchman').routine(`Stuck in progress with nobody on it: ${fresh.map(x => `${x.name} ${x.id} "${x.title}"`).join('; ')}.`);
        s = read();
      }
      // The day's digest, once, after digestAt.
      const [h, m] = settings().digestAt.split(':').map(Number), d = new Date();
      if (s.lastDigest !== today() && d.getHours() * 60 + d.getMinutes() >= h * 60 + m) {
        // AIG-988: the digest is kept for the Scrum Master panel (status), never posted in the owner's chat
        s.lastDigest = today(); s.digestText = digest(f, s); write(s);
        if (f.stuck.length || f.overlap.length) require('./watchman').routine(`The day's digest: ${f.stuck.length} stuck, ${f.overlap.length} look-alike pairs. Settle what you can within your rules.`);
        s = read();
      }
    }
    s.lastRound = now(); write(s);
    for (const t of said) try { require('./watchman').say(t); } catch {}
  } finally { rounding = false; }
  return status();
}
// Gentle reminders (AIG-441): a question waiting for the owner longer than the scale says gets ONE bump (AIG-373), never again.
function remind(s) {
  const mins = PUSH[pushLevel()].remindMin; if (!mins) return 0;
  const { openMarked, bumpOne } = require('./routes/comments');
  s.reminded = s.reminded || []; let n = 0;
  const tired = require('./store').tiredNow();   // AIG-670: while the owner is tired, only urgent cards are bumped; the rest wait (not marked reminded) and go out once awake
  for (const p of active()) {
    let changed = false;
    for (const c of p.cards) {
      if (c.status === 'done' || !c.needsYou || c.blocked || isIdea(c)) continue;
      if (tired && c.priority !== 'urgent') continue;
      const m = openMarked(c, 'ask'); if (!m || !m.at || ago(m.at) < mins * 60e3 || m.bumps) continue;
      const key = p.slug + '/' + c.id + '/' + m.at; if (s.reminded.includes(key)) continue;
      s.reminded.push(key); bumpOne(c, m, '', []); c.updated = now(); changed = true; n++;
    }
    if (changed) save(p);
  }
  s.reminded = s.reminded.slice(-300); write(s);
  return n;
}
function digest(f, s) {
  const since = Date.now() - 864e5, ps = active();
  const done = ps.reduce((n, p) => n + p.cards.filter(c => c.status === 'done' && Date.parse(c.updated) > since).length, 0);
  const test = ps.reduce((n, p) => n + p.cards.filter(c => c.status === 'verify').length, 0);
  const sorted = (s.sorted || []).filter(x => Date.parse(x.at) > since).length;
  const lines = [tr('srv.sm.counts', { done, test, sorted: sorted ? (sorted > 1 ? tr('srv.sm.sorted', { n: sorted }) : tr('srv.sm.sorted1')) : '' })];
  if (f.waiting.length) lines.push(tr('srv.sm.waiting', { list: f.waiting.slice(0, 5).map(x => `${x.name} ${x.id}`).join(', ') }));
  if (f.stuck.length) lines.push(tr('srv.sm.stuck', { list: f.stuck.slice(0, 5).map(x => `${x.name} ${x.id}`).join(', ') }));
  if (f.overlap.length) lines.push(tr('srv.sm.alike', { list: f.overlap.slice(0, 3).map(o => tr('srv.sm.pair', { a: o[0], b: o[1] })).join('; ') }));
  return tr('srv.sm.today', { lines: lines.join('\n\n') });
}

// The round's timer follows the scale: self-rescheduling, so a changed level takes effect at once.
let timer = null;
const everyMs = () => EVERY_ENV || PUSH[pushLevel()].everyMin * 60e3;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { round().catch(() => {}).then(schedule); }, everyMs()); timer.unref();
}
function startScrumMaster() {
  migrate();
  schedule();
  setTimeout(() => { round().catch(() => {}); }, 30e3).unref();
}
// Set the diligence scale (Setup and the chat header both come here).
function setPush(level) {
  const n = parseInt(level, 10); if (!PUSH[n]) throw bad('push must be 1 to 5');
  require('./setup').saveSetup({ prefs: { smPush: n } });
  if (timer) schedule();
  return status();
}

module.exports = { aiAllowed, haikuText, NAME, SLUG, inTeam, status, round: () => round(), takeRun, runsToday, PUSH, pushLevel, setPush, remind, brief, role, session, sessionUsed, folder, watchList, listening, heard, handOver, passed, note, byRules, startScrumMaster };
