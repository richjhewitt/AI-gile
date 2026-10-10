// Team presence (is a session alive?) and running a team in the background (no terminal window).
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DATA, load, listSlugs, localSettings, bad, owner } = require('./store');

/* ---------- presence ---------- */
// A team counts as online if its session was heard from in the last 5 minutes: hooks and 'aigile wait'
// (every 15s while idle) call /updates, and the status line reports its folder with each reading.
const ONLINE_MS = 5 * 60e3;
const lastHeard = new Map();   // slug -> ms
const heard = slug => lastHeard.set(slug, Date.now());
function presenceOf(slug) {
  const t = lastHeard.get(slug), r = runs.get(slug);
  return { online: !!r || (!!t && Date.now() - t < ONLINE_MS), lastHeard: t ? new Date(t).toISOString() : null,
    running: !!r, startedAt: r ? new Date(r.startedAt).toISOString() : null };
}
function heardFromFolder(dir) {
  const norm = d => String(d || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const d = norm(dir);
  if (!d) return;
  for (const s of listSlugs()) { const p = load(s); if (p && p.path && norm(p.path) === d) heard(s); }
}

/* ---------- waking a team ---------- */
// The agent command comes from aigile.local.json "agent.command"; one '*' path segment is allowed
// (resolved to the newest match), so a versioned install folder keeps working after updates.
function agentCommand() {
  const cmd = process.env.AIGILE_AGENT_COMMAND || (localSettings().agent || {}).command;
  if (!cmd) throw bad('set "agent": { "command": "<full path to the agent program>" } in aigile.local.json first');
  if (!cmd.includes('*')) return cmd;
  const parts = cmd.replace(/\\/g, '/').split('/'), i = parts.findIndex(x => x.includes('*'));
  const parent = parts.slice(0, i).join('/'), re = new RegExp('^' + parts[i].split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  const hits = (fs.existsSync(parent) ? fs.readdirSync(parent) : []).filter(n => re.test(n))
    .map(n => [parent, n, ...parts.slice(i + 1)].join('/')).filter(f => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!hits.length) throw bad('agent program not found: ' + cmd);
  return hits[0];
}

/* ---------- background runs ---------- */
// One run per team at a time. A trigger during a run sets 'again', so the run is repeated once when it ends.
const runs = new Map();      // slug -> { child, startedAt, again, restart }
const lastEnd = new Map();   // slug -> ms when our last run ended (hearing after that means a terminal session)
const logFile = slug => path.join(DATA, 'logs', slug + '.log');
const PROMPT = slug => `${owner()} commented on the AI-gile board. Read your notes, run the board brief for project ${slug}, deal with the comments, then stop. Do not start the wait command: the board starts you again on the next comment.`;

// A new project's first run: there is no earlier conversation to continue.
const FIRST = slug => `You are the team for a new project (${slug}) on the AI-gile board. Read your notes and the ways of working, run the board brief, add yourself to the team roster, then stop. Do not start the wait command: the board starts you again when ${owner()} comments.`;

function launch(p, exe, first) {
  fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
  const fd = fs.openSync(logFile(p.slug), 'a');
  fs.writeSync(fd, `=== ${new Date().toISOString()} started ===\n`);
  const args = first ? ['-p', FIRST(p.slug)] : ['-p', PROMPT(p.slug), '--continue'];
  const opts = { cwd: p.path, windowsHide: true, stdio: ['ignore', fd, fd] };
  let child;
  // Node can't spawn .bat/.cmd directly: go through cmd.exe with the whole line quoted once.
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(exe))
    child = spawn('cmd.exe', ['/d', '/s', '/c', '"' + [exe, ...args].map(a => '"' + a.replace(/"/g, '') + '"').join(' ') + '"'], { ...opts, windowsVerbatimArguments: true });
  else child = spawn(exe, args, opts);
  fs.closeSync(fd);
  const run = { child, startedAt: Date.now(), again: false, restart: false };
  runs.set(p.slug, run);
  const done = code => {
    if (runs.get(p.slug) !== run) return;
    runs.delete(p.slug); lastEnd.set(p.slug, Date.now());
    try { fs.appendFileSync(logFile(p.slug), `=== exited ${code} ===\n`); } catch {}
    if (run.again || run.restart) { const q = load(p.slug); if (q) try { startTeam(q, true); } catch {} }
  };
  child.on('error', e => { try { fs.appendFileSync(logFile(p.slug), 'could not start: ' + e.message + '\n'); } catch {} done('error'); });
  child.on('exit', code => done(code));
}

// Start a background run (or ask a running one to go round again). Not when a terminal session already hears Rich,
// unless force is set; first starts a fresh conversation. Throws bad() when there is no folder or agent program.
function startTeam(p, force, first) {
  if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first (🔌 Connect folder)');
  const exe = agentCommand(), run = runs.get(p.slug), t = lastHeard.get(p.slug);
  if (run) { run.again = true; return { ok: true, folder: p.path, running: true }; }
  if (!force && t && Date.now() - t < ONLINE_MS && t > (lastEnd.get(p.slug) || 0)) return { ok: true, folder: p.path, terminal: true };
  launch(p, exe, first);
  return { ok: true, folder: p.path, running: true };
}
// Best-effort trigger for Rich's activity: never fails the request.
function nudge(slug) { try { const p = load(slug); if (p) startTeam(p); } catch {} }

function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else try { child.kill('SIGKILL'); } catch {}
}
// Kill a stuck run and start a fresh one.
function restartTeam(p) {
  const run = runs.get(p.slug);
  if (!run) return startTeam(p, true);
  run.restart = true; run.again = false;
  killTree(run.child);
  return { ok: true, folder: p.path, running: true };
}

function logTail(slug, lines = 200) {
  try { return fs.readFileSync(logFile(slug), 'utf8').split(/\r?\n/).slice(-lines - 1).join('\n').trim(); } catch { return ''; }
}

module.exports = { heard, presenceOf, heardFromFolder, startTeam, nudge, restartTeam, logTail };
