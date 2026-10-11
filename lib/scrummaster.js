// 🧭 Lead Scrum Master (AIG-359, docs/SCRUM-MASTER.md): the 🌙 night watchman grown into one role with a day and a
// night mode. At night lib/watchman.js does the rounds (unchanged); by day, once launched, this file does them, in plain
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

const NAME = '🧭 Lead Scrum Master', SLUG = '_scrummaster';
const FILE = path.join(DATA, 'scrummaster.conf');
const FOLDER = path.join(DATA, 'scrummaster');   // its own folder: its CLAUDE.md is the role brief, for a VS Code or terminal session
const EVERY_MS = +process.env.AIGILE_SM_MS || 10 * 60e3;
const WAKE_GAP_MS = 60 * 60e3, STUCK_MS = 24 * 3600e3, OWNER_WAIT_MS = 3 * 864e5;
const WHERE = ['vscode', 'terminal', 'background'];
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {} };
const today = () => new Date().toLocaleDateString('sv');
const ago = at => at ? Date.now() - Date.parse(at) : Infinity;
const int = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const settings = () => { const s = localSettings().scrumMaster || {}; return { cap: int(s.aiRunsPerDay, 8, 0, 100), digestAt: /^\d{1,2}:\d{2}$/.test(s.digestAt || '') ? s.digestAt : '17:00' }; };
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
  if (s.runs >= cap) { write(s); return `today's ${cap} AI runs are used up (scrumMaster.aiRunsPerDay in aigile.local.json), so I'll wait for tomorrow`; }
  s.runs++; write(s); return null;
}

/* ---------- the prompt (also the CLAUDE.md of its folder) ---------- */
function brief({ night, watch, asks = [], routine = [], recent = '' } = {}) {
  const me = owner(), cli = `node "${path.join(ROOT, 'aigile.js')}"`;
  return [
    `You are the ${NAME} on ${me}'s AI-gile board: in charge of every project lead, ${night ? `while ${me} sleeps` : 'by day and by night'}.`,
    asks.length ? `${me} just wrote to you: ${asks.map(a => '"' + a + '"').join(' ')}. Make it happen now; don't just acknowledge it.` : '',
    routine.length ? `The board's own round found something its rules can't fix: ${routine.join(' ')}. Look into it and act within your rules.` : '',
    recent ? `The chat so far: ${recent}` : '',
    `Board commands: ${cli} brief <project> (see a project), ${cli} list / show (check), ${cli} wake <project> --sprint (start a team on its To do), ${cli} add <project> "title" --status team --as "${NAME}" (an order or new work in a lead's For the team), ${cli} comment <project> <card> "text" --as "${NAME}", ${cli} move <project> <card> backlog|todo (only within ${me}'s rules).`,
    `Projects you watch: ${(watch || []).join(', ') || 'none'}. Leave every other project alone and don't mention it.`,
    `You MAY wake teams, add cards or orders to a lead's For the team signed "${NAME}", move cards between backlog and To do within ${me}'s rules, sort ${me}'s ideas into the right project, and write to ${me} in your own chat. You MAY NOT write code, push, restart the board, change settings or permissions, accept or close cards for ${me}, or act on projects you don't watch. Talk to leads only through cards and comments.`,
    // 💡 Ideas sent to it (AIG-388): it sorts them into cards; a new project needs the owner.
    `A message starting "💡 Idea:" is ${me}'s idea for you to handle: add it as cards in the right project's For the team (several projects if it spans them). You can't create projects or folders: for "a new project ..." ask ${me} where its folder should go with ONE quick-button question, ${cli} watchsay "Where should the folder for X go?" --options "C:/Projects/x,Next to AI-gile,I'll pick", and ${me} or a lead makes it.`,
    `When done, answer ${me} in ONE short plain line with ${cli} watchsay "...": answer what ${me} asked, or name what only ${me} can unblock. No routine reports. Then stop.`,
  ].filter(Boolean).join(' ');
}
// Its folder: the brief as CLAUDE.md and the one permission it needs (the board's commands, run with node).
function folder() {
  fs.mkdirSync(path.join(FOLDER, '.claude'), { recursive: true });
  const cli = `node "${path.join(ROOT, 'aigile.js')}"`;
  fs.writeFileSync(path.join(FOLDER, 'CLAUDE.md'), `# ${NAME}\n\n${brief({ watch: watchList() })}\n\nIn a window: wait for ${owner()}'s messages with \`${cli} smwait\` (run it in the background), act on each one, answer with watchsay, then wait again.\n\nThe role in full: ${path.join(ROOT, 'docs', 'SCRUM-MASTER.md')}\n`);
  const st = path.join(FOLDER, '.claude', 'settings.local.json');
  if (!fs.existsSync(st)) fs.writeFileSync(st, JSON.stringify({ permissions: { allow: ['Bash(node:*)'] } }, null, 2));
  return FOLDER;
}

/* ---------- launch, stop, status ---------- */
// where: vscode (suggested) | terminal | background. Background is just "on": rounds in plain code, AI runs only when
// needed (hidden). A window gets a session that waits for the owner's messages itself (aigile smwait).
function launch(where) {
  where = where || 'vscode';
  if (!WHERE.includes(where)) throw bad('where must be one of ' + WHERE.join(', '));
  noTokens.guard();
  const dir = folder();
  if (where !== 'background') {
    const { openWindow } = require('./presence');
    openWindow({ slug: SLUG, name: 'Lead Scrum Master', path: dir }, { where, fresh: true, prompt: `You are the ${NAME}. Read CLAUDE.md in this folder and follow it: run the briefs of the projects you watch, then wait for ${owner()}'s messages.` });
  }
  const s = read(); Object.assign(s, { on: true, where, since: now() }); delete s.heardAt; write(s);
  setTimeout(() => { try { round(); } catch {} }, 2000).unref();
  return status();
}
function stop() { const s = read(); s.on = false; write(s); return status(); }
// A window session waiting in smwait counts as listening for 2 minutes after each poll: the owner's messages go to it.
const listening = (s = read()) => !!s.on && s.where !== 'background' && ago(s.heardAt) < 2 * 60e3;
function heard() { const s = read(); s.heardAt = now(); write(s); }
function status() {
  const s = read(), set = settings();
  return { on: !!s.on, where: s.where || null, since: s.since || null, listening: listening(s), runsToday: runsToday(s), cap: set.cap, digestAt: set.digestAt,
    lastRound: s.lastRound || null, lastDigest: s.lastDigest || null, sorted: (s.sorted || []).slice(-20) };
}

/* ---------- 💡 decide-later ideas (AIG-351): rules first, Haiku only if unclear ---------- */
const isIdea = c => c.createdBy === 'Ideas' && c.quick && c.status === 'backlog';
const words = s => String(s || '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
// Score each project by its name, slug, key and the longer words of its name in the idea's text. A "slug:" start wins outright.
function byRules(text, projects) {
  const lo = String(text).toLowerCase(), w = new Set(words(text));
  const pre = (lo.match(/^\s*([\w-]+)\s*:/) || [])[1];
  if (pre) { const p = projects.find(p => p.slug === pre || p.key.toLowerCase() === pre || p.name.toLowerCase() === pre); if (p) return { slug: p.slug, why: 'starts with ' + pre + ':' }; }
  const scored = projects.map(p => {
    let n = 0; const hits = [];
    if (lo.includes(p.name.toLowerCase())) { n += 3; hits.push(p.name); }
    else if (w.has(p.slug)) { n += 3; hits.push(p.slug); }
    if (p.key && w.has(p.key.toLowerCase())) { n += 2; hits.push(p.key); }
    for (const x of words(p.name)) if (x.length >= 4 && w.has(x) && !hits.includes(p.name)) { n += 1; hits.push(x); }
    for (const x of (p.keywords || [])) if (x && lo.includes(String(x).toLowerCase())) { n += 2; hits.push(x); }
    return { slug: p.slug, n, hits };
  }).sort((a, b) => b.n - a.n);
  if (scored[0] && scored[0].n > 0 && (!scored[1] || scored[0].n > scored[1].n)) return { slug: scored[0].slug, why: 'mentions ' + scored[0].hits.join(', ') };
  return null;
}
function aiAllowed() { if (noTokens.isOn()) return false; try { if (require('./budget').overBudget()) return false; } catch {} return true; }
// One tiny Haiku call (no tools, user settings only, from a neutral folder): which project slug, or none.
function askHaiku(text, projects) {
  const { agentCommand, spawnAgent } = require('./presence');
  return new Promise(resolve => {
    const list = projects.map(p => `${p.slug} (${p.name}${p.description ? ': ' + String(p.description).slice(0, 80) : ''})`).join('; ');
    const prompt = `Projects: ${list}. The owner noted this idea: "${String(text).slice(0, 400)}". Which ONE project is it for? Reply with only its slug, or none.`;
    let out = '', done = false, child, t;
    const end = v => { if (done) return; done = true; clearTimeout(t); resolve(v); };
    try { child = spawnAgent(agentCommand(), ['-p', prompt.replace(/\s*\n+\s*/g, ' '), '--model', 'haiku', '--max-turns', '1', '--tools', '', '--setting-sources', 'user'], { cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return resolve(null); }
    t = setTimeout(() => { try { child.kill(); } catch {} end(null); }, 45e3);
    child.stdout.on('data', d => out += d);
    child.on('error', () => end(null));
    child.on('exit', () => { const lo = out.toLowerCase(); end(projects.find(p => new RegExp('(^|[^\\w-])' + p.slug + '([^\\w-]|$)').test(lo)) || null); });
  });
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
      if (!h) { write(s); log(`💡 I couldn't tell where "${c.title.replace(/^💬\s*/, '').slice(0, 60)}" goes: it waits in your inbox`); continue; }
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
function findings(watch) {
  const ps = active().filter(p => watch.includes(p.slug)), out = { stuck: [], waiting: [], overlap: [] };
  const { presenceOf } = require('./presence');
  for (const p of ps) {
    const running = presenceOf(p.slug).running;
    for (const c of p.cards) {
      if (c.status === 'doing' && !running && ago(c.updated) > STUCK_MS) out.stuck.push({ project: p.slug, name: p.name, id: c.id, title: c.title });
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
  let s = read(); const night = quiet();
  if (!s.on && !night) return status();
  rounding = true;
  const said = [];
  try {
    await triage(s, t => said.push(t));
    s = read();
    if (!night) {   // by night the watchman does the rest (lib/watchman.js)
      const watch = watchList(), f = findings(watch);
      s.woke = s.woke || {};
      if (!noTokens.isOn()) for (const slug of watch) {
        const p = load(slug), { presenceOf, startTeam } = require('./presence'), pr = presenceOf(slug), at = p && p.path && attention(p, pr);
        if (!at || at.kind !== 'asleep' || !p.cards.some(c => c.status === 'todo' && !waitingOnRich(c)) || ago(s.woke[slug]) < WAKE_GAP_MS) continue;
        try { const r = startTeam(p, true, false, 'day', true); if (r && (r.running || r.queued)) s.woke[slug] = now(); } catch {}
      }
      // Something rules can't fix: a card stuck in progress for a day with nobody on it. One AI run (Sonnet) per new one.
      s.flagged = s.flagged || [];
      const fresh = f.stuck.filter(x => !s.flagged.includes(x.project + '/' + x.id));
      if (fresh.length) {
        s.flagged = [...s.flagged, ...fresh.map(x => x.project + '/' + x.id)].slice(-200); write(s);
        require('./watchman').routine(`Stuck in progress for over a day with nobody on it: ${fresh.map(x => `${x.name} ${x.id} "${x.title}"`).join('; ')}.`);
        s = read();
      }
      // The day's digest, once, after digestAt.
      const [h, m] = settings().digestAt.split(':').map(Number), d = new Date();
      if (s.lastDigest !== today() && d.getHours() * 60 + d.getMinutes() >= h * 60 + m) {
        s.lastDigest = today(); write(s);
        said.push(digest(f, s));
        if (f.stuck.length || f.overlap.length) require('./watchman').routine(`The day's digest: ${f.stuck.length} stuck, ${f.overlap.length} look-alike pairs. Settle what you can within your rules.`);
        s = read();
      }
    }
    s.lastRound = now(); write(s);
    for (const t of said) try { require('./watchman').say(t); } catch {}
  } finally { rounding = false; }
  return status();
}
function digest(f, s) {
  const since = Date.now() - 864e5, ps = active();
  const done = ps.reduce((n, p) => n + p.cards.filter(c => c.status === 'done' && Date.parse(c.updated) > since).length, 0);
  const test = ps.reduce((n, p) => n + p.cards.filter(c => c.status === 'verify').length, 0);
  const sorted = (s.sorted || []).filter(x => Date.parse(x.at) > since).length;
  const lines = [`- ${done} done today, ${test} waiting for you to test${sorted ? `, ${sorted} idea${sorted > 1 ? 's' : ''} sorted` : ''}`];
  if (f.waiting.length) lines.push(`- Waiting on you 3+ days: ${f.waiting.slice(0, 5).map(x => `${x.name} ${x.id}`).join(', ')}`);
  if (f.stuck.length) lines.push(`- Stuck in progress: ${f.stuck.slice(0, 5).map(x => `${x.name} ${x.id}`).join(', ')}`);
  if (f.overlap.length) lines.push(`- Look alike: ${f.overlap.slice(0, 3).map(o => `${o[0]} and ${o[1]}`).join('; ')}`);
  return `🧭 **Today**\n\n${lines.join('\n\n')}`;
}

function startScrumMaster() {
  setInterval(() => { round().catch(() => {}); }, EVERY_MS).unref();
  setTimeout(() => { round().catch(() => {}); }, 30e3).unref();
}

module.exports = { NAME, SLUG, launch, stop, status, round: () => round(), takeRun, runsToday, brief, folder, watchList, listening, heard, byRules, startScrumMaster, WHERE };
