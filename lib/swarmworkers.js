// 🐝 Swarm workers (AIG-901): while 🚨 swarm is on for a project, the board itself runs one worker per unassigned To do card
// (highest priority first), each in its own git worktree <folder>/.claude/worktrees/swarm-<card id> on a new branch from the
// project's current branch, up to budget.swarmWorkers at once (Setup, default 6). Workers start even with a lead active in a
// session (that lead merges). The hard guards still hold (usage limit, ⛔ No Token Mode, AI off); the pace guard and usage
// saver don't. A worker that ends lets the next card go; a card gets one worker per swarm. Runs live in presence.js `runs`
// under "<slug>#<card id>", so the log, 👁 watch, stop and the In flight list see them.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DATA, load, owner, PRIORITIES } = require('./store');

const TICK_MS = +process.env.AIGILE_SWARM_TICK_MS || 30e3;
let since = '';             // the swarm these cards were tried in
const tried = new Set();    // "<slug>#<id>": had a worker in this swarm (never twice)
const told = new Set();     // reasons already written to the project log in this swarm

const say = (slug, text) => { try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(path.join(DATA, 'logs', slug + '.log'), `=== ${new Date().toISOString()} swarm: ${text} ===\n`); } catch {} };
const sayOnce = (slug, text) => { if (told.has(text)) return; told.add(text); say(slug, text); };
const cap = () => require('./budget').budget().swarm;

// Never touch real project folders from the tester's sandbox (a copy of the board whose projects point at real folders) or
// from QA unless the folder is a temp one (AIGILE_SANDBOX=1 is set by tools/tester/sandbox.mjs).
function unsafe(p) {
  if (process.env.AIGILE_SANDBOX) return true;
  if (!process.env.AIGILE_QA_TOKEN) return false;
  const norm = x => path.resolve(String(x)).split(path.sep).join('/').toLowerCase();
  const tmpd = [require('os').tmpdir(), process.env.TEMP, process.env.TMP].filter(Boolean).map(norm);
  return !tmpd.some(t => norm(p.path).startsWith(t + '/'));
}

// The worktree for a card: made once (branch from the folder's current branch), reused on a later swarm.
function worktree(p, c) {
  if (unsafe(p)) throw new Error('sandbox: project folders are not touched');
  const branch = 'swarm-' + c.id.toLowerCase(), dir = path.join(p.path, '.claude', 'worktrees', branch);
  const git = (...a) => spawnSync('git', a, { cwd: p.path, windowsHide: true, encoding: 'utf8' });
  if (fs.existsSync(dir)) return { dir, branch };
  const head = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (head.status !== 0) throw new Error('the project folder is not a git repository');
  try {   // keep the worktrees out of the project's git status
    const ex = path.join(p.path, '.git', 'info', 'exclude');
    if (fs.existsSync(path.dirname(ex)) && !/^\.claude\/worktrees\/$/m.test(fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '')) fs.appendFileSync(ex, '\n.claude/worktrees/\n');
  } catch {}
  const exists = git('rev-parse', '--verify', '--quiet', 'refs/heads/' + branch).status === 0;
  const r = exists ? git('worktree', 'add', dir, branch) : git('worktree', 'add', '-b', branch, dir, head.stdout.trim());
  if (r.status !== 0) throw new Error(((r.stderr || r.stdout || '').trim().split(/\r?\n/).pop()) || 'git worktree add failed');
  return { dir, branch, from: head.stdout.trim() };
}

// No double quotes or angle brackets: spawnHidden strips quotes and the line goes through cmd.exe.
const PROMPT = (p, c, branch) => `You are a swarm worker on the AI-gile board, project ${p.slug}. Work ONLY on card ${c.id} ('${String(c.title || '').replace(/["<>|&^%]/g, '')}'); leave every other card alone. ` +
  `First run: aigile start ${p.slug} ${c.id} --as Swarm-${c.id}. Read the card (aigile show ${p.slug} ${c.id}), the project's AGENTS.md and your notes, then build it in this folder, ` +
  `a git worktree on branch ${branch}. Commit on ${branch} with explicit paths (git commit -m with your message, then -- and the file paths); never push, merge, rebase or reset. ` +
  `No AI attribution or co-author lines, and don't open windows or start servers. When done, hand over: aigile comment ${p.slug} ${c.id} 'Branch ${branch}: short summary and how to test' --as Swarm-${c.id}, ` +
  `then aigile move ${p.slug} ${c.id} review --as Swarm-${c.id}, then stop. If you are stuck, say so in a comment on the card and stop. ${owner()}'s lead merges your branch. Do not start the wait command.`;

// No push for a worker, whatever the owner's push setting: added to presence's one --disallowedTools list.
function noPushArgs() {
  const a = require('./presence').pushArgs(), i = a.indexOf('--allowedTools');
  if (i >= 0) a.splice(i, 2);
  const d = a.indexOf('--disallowedTools');
  if (d >= 0) a[d + 1] += ' Bash(git push:*) PowerShell(git push:*)';
  return a;
}

const rank = c => PRIORITIES.indexOf(c.priority || 'normal');
// Cards that may get a worker now: To do, nobody on them, not waiting, snoozed or with the owner; highest priority first.
function candidates(p) {
  const S = require('./store');
  return (p.cards || []).filter(c => c.status === 'todo' && !c.assignee && !c.blocked && !c.needsYou && !S.isSnoozed(c) && !(c.waiting && c.waiting.length) && !tried.has(p.slug + '#' + c.id))
    .sort((a, b) => rank(b) - rank(a) || (a.sortPos ?? 1e9) - (b.sortPos ?? 1e9) || String(a.created || '').localeCompare(String(b.created || '')));
}

// Start workers for the swarm project up to the cap. Safe to call any time (a tick, swarm on, a worker's end).
function fill() {
  const s = require('./swarm').status();
  if (!s.on) return { started: [] };
  if (s.since !== since) { since = s.since; tried.clear(); told.clear(); }
  const P = require('./presence'), p = load(s.slug);
  if (!p || !p.path || !fs.existsSync(p.path)) return { started: [] };
  if (unsafe(p)) { sayOnce(p.slug, 'no workers: running as a sandbox/QA copy, project folders are left alone'); return { started: [], sandbox: true }; }
  try { require('./notokens').guard(); require('./today').aiOffGuard(p); require('./budget').mayRun(); }   // the hard guards only (AIG-901)
  catch (e) { sayOnce(p.slug, 'workers held: ' + e.message); return { started: [], held: e.message }; }
  const E = require('./engines'), eng = E.forProject(p), codex = eng.engine !== 'claude';
  let exe;
  try { exe = codex ? E.engineExe(eng.engine) : P.agentCommand(); } catch (e) { sayOnce(p.slug, 'no workers: ' + e.message); return { started: [] }; }
  if (!exe) { sayOnce(p.slug, 'no workers: ' + eng.engine + ' is not installed'); return { started: [] }; }
  const started = [];
  for (const c of candidates(p)) {
    if (P.workerKeys(p.slug).length >= cap()) break;
    const key = p.slug + '#' + c.id;
    tried.add(key);
    let wt; try { wt = worktree(p, c); } catch (e) { say(p.slug, `no worker for ${c.id}: ${e.message}`); continue; }
    const prompt = PROMPT(p, c, wt.branch);
    const args = codex ? E.ENGINES[eng.engine].args({ prompt: E.preambleFor(eng.engine) + prompt, model: eng.model })
      : ['-p', prompt, '--session-id', require('crypto').randomUUID(), ...noPushArgs(), '--output-format', 'stream-json', '--verbose'];
    try { P.startWorker(key, exe, args, { cwd: wt.dir, engine: eng.engine, branch: wt.branch }); } catch (e) { say(p.slug, `no worker for ${c.id}: ${e.message}`); continue; }
    say(p.slug, `worker for ${c.id} started on ${wt.branch}`);
    started.push(c.id);
  }
  return { started };
}

// Stop one worker (its card is not given another in this swarm).
function stop(slug, id) {
  const key = slug + '#' + id; tried.add(key);
  return { ok: require('./presence').stopWorker(key) };
}

let timer = null;
function start() { if (!timer) { timer = setInterval(() => { try { fill(); } catch {} }, TICK_MS); timer.unref(); } }

module.exports = { fill, stop, start, PROMPT, worktree };
