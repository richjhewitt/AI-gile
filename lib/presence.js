// Team presence (is a session alive?) and running a team in the background (no terminal window), or in a window (AIG-153).
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DATA, load, listSlugs, localSettings, bad, owner } = require('./store');

/* ---------- presence ---------- */
// A team counts as online if its session was heard from in the last 5 minutes: hooks and 'aigile wait'
// (every 15s while idle) call /updates, and the status line reports its folder with each reading.
const ONLINE_MS = 5 * 60e3;
const lastHeard = new Map();   // slug -> ms
const lastWhere = new Map();   // slug -> 'vscode' | 'terminal' (AIG-107)
// A session that used the board in the last 15 minutes is still at work, even between waits: no background run
// starts on top of it (AIG-107).
const ACTIVE_MS = 15 * 60e3;
const heard = (slug, where) => { lastHeard.set(slug, Date.now()); if (where) lastWhere.set(slug, where); };
function presenceOf(slug) {
  const t = lastHeard.get(slug), r = runs.get(slug), o = opened.get(slug);
  return { online: !!r || (!!t && Date.now() - t < ONLINE_MS), lastHeard: t ? new Date(t).toISOString() : null,
    running: !!r, startedAt: r ? new Date(r.startedAt).toISOString() : null, where: r ? 'background' : lastWhere.get(slug) || null,
    opened: o ? { where: o.where, at: new Date(o.at).toISOString() } : null };   // a window we opened (AIG-153); we can't see it end
}
// A session closed (SessionEnd hook, AIG-219): it no longer counts as at work, so the next comment wakes a background run.
const gone = slug => { lastHeard.delete(slug); lastWhere.delete(slug); };
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

// The 🌙 watchman waking a team while the owner sleeps (AIG-222): keep working through the board, not just the comments.
const SPRINT = slug => `${owner()} is asleep and the night watchman woke you. Read your notes, run the board brief for project ${slug}, deal with any comments, then keep working through To do and In progress in priority order: build, test, commit locally (no push) and hand each over with aigile test. Decide small things yourself and log them. When To do is empty, don't stop (AIG-261): pick the next backlog cards you can do without ${owner()} and do them, or plan future work as small cards with test steps. Only stop when everything left truly needs ${owner()}. Do not start the wait command.`;

// A new project's first run: there is no earlier conversation to continue.
const FIRST = slug => `You are the team for a new project (${slug}) on the AI-gile board. Read your notes and the ways of working, run the board brief, add yourself to the team roster, then stop. Do not start the wait command: the board starts you again when ${owner()} comments.`;

// A chatty lead (AIG-140) may add one short friendly line to the owner's chat while it's there.
const chatLine = p => p.chatty ? ' Chatty lead is on: if it helps, send at most one short friendly line with aigile dm (a nudge about what is waiting on them, or a light joke).' : '';
// Start the agent program (also used by the 🌙 watchman, AIG-262).
function spawnAgent(exe, args, opts) {
  // Node can't spawn .bat/.cmd directly: go through cmd.exe with the whole line quoted once.
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(exe))
    return spawn('cmd.exe', ['/d', '/s', '/c', '"' + [exe, ...args].map(a => '"' + a.replace(/"/g, '') + '"').join(' ') + '"'], { ...opts, windowsVerbatimArguments: true });
  return spawn(exe, args, opts);
}

function launch(p, exe, first, sprint) {
  fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
  const fd = fs.openSync(logFile(p.slug), 'a');
  fs.writeSync(fd, `=== ${new Date().toISOString()} started ===\n`);
  const chat = chatLine(p);
  const args = first ? ['-p', FIRST(p.slug) + chat] : ['-p', (sprint ? SPRINT : PROMPT)(p.slug) + chat, '--continue'];
  // AIGILE_BACKGROUND tells the CLI inside this run that it is a background run (not a window you opened).
  const opts = { cwd: p.path, windowsHide: true, stdio: ['ignore', fd, fd], env: { ...process.env, AIGILE_BACKGROUND: '1' } };
  const child = spawnAgent(exe, args, opts);
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

/* ---------- where a team runs (AIG-153) ---------- */
// background (hidden, the default), terminal (a window you can watch), vscode (code <folder>; the team works there via
// its hooks) or other (the owner's own command, {folder} filled in). Per project p.runIn / p.runCmd, else "runs" in
// aigile.local.json (⚙️ Setup). Only background runs are ours to track: for the others we only know when we opened them.
const WHERE = ['background', 'terminal', 'vscode', 'other'];
const runIn = p => { const r = localSettings().runs || {}; return { where: p.runIn || r.where || 'background', cmd: p.runCmd || r.cmd || '' }; };
const opened = new Map();   // slug -> { where, at }
const win = process.platform === 'win32';
let wtFound = null;   // is Windows Terminal on the PATH? (checked once)
const hasWt = () => wtFound ?? (wtFound = win && spawnSync('where', ['wt'], { windowsHide: true }).status === 0);

function openWindow(p, how) {
  const dir = p.path, note = s => { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(logFile(p.slug), `=== ${new Date().toISOString()} opened (${how.where}): ${s} ===\n`); };
  // Quotes and % could break out of the quoted folder in a shell; Windows folder names can't contain quotes anyway.
  if (/["%`$]/.test(dir)) throw bad('that folder has characters I will not pass to a shell');
  // AIGILE_NO_WINDOWS (tests): write what would run to the log instead of opening anything.
  const go = (line, fn) => { note(line); if (!process.env.AIGILE_NO_WINDOWS) fn(); };
  const bye = { detached: true, stdio: 'ignore', cwd: dir };
  if (how.where === 'terminal') {
    if (!win) throw bad('a terminal window works on Windows only for now');
    // The same prompt and --continue as a background run, but interactive, in a PowerShell window that stays open.
    const q = s => "'" + String(s).replace(/'/g, "''").replace(/"/g, '') + "'", script = path.join(DATA, 'logs', p.slug + '.window.ps1');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, `$Host.UI.RawUI.WindowTitle = ${q('AI-gile: ' + p.name)}\nSet-Location -LiteralPath ${q(dir)}\n& ${q(agentCommand())} --continue ${q(PROMPT(p.slug) + chatLine(p))}\n`);
    const ps = ['powershell', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', script];
    if (hasWt()) go('wt -d ' + dir + ' ' + ps.join(' '), () => spawn('wt.exe', ['-w', 'new', '-d', dir, ...ps], bye).unref());
    else go(ps.join(' '), () => spawn('powershell.exe', ps.slice(1), bye).unref());   // detached = its own console window
  } else if (how.where === 'vscode') go(`code "${dir}"`, () => spawn(`code "${dir}"`, { ...bye, shell: true, windowsHide: true }).unref());
  else {
    if (!how.cmd.trim()) throw bad('give the command for "Other" first (⚙️ Setup or 🎨 Look)');
    const line = how.cmd.split('{folder}').join(dir);
    go(line, () => spawn(line, { ...bye, shell: true, windowsHide: true }).unref());
  }
  opened.set(p.slug, { where: how.where, at: Date.now() });
}

// Start a background run (or ask a running one to go round again). Not when a terminal session already hears Rich,
// unless force is set; first starts a fresh conversation. Throws bad() when there is no folder or agent program.
// Outside the background (AIG-153) a window is opened instead, once per 15 minutes unless forced (▶ Wake); first runs,
// the night watchman (sprint) and bg (going quiet) always stay in the background.
function startTeam(p, force, first, sprint, bg) {
  if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first (🔌 Connect folder)');
  const how = runIn(p), run = runs.get(p.slug), t = lastHeard.get(p.slug);
  if (run) { run.again = true; return { ok: true, folder: p.path, running: true }; }
  if (!force && t && Date.now() - t < ACTIVE_MS && t > (lastEnd.get(p.slug) || 0)) return { ok: true, folder: p.path, terminal: true };
  if (how.where !== 'background' && !first && !sprint && !bg) {
    const o = opened.get(p.slug);
    if (!force && o && Date.now() - o.at < ACTIVE_MS) return { ok: true, folder: p.path, opened: o.where, already: true };
    openWindow(p, how);
    return { ok: true, folder: p.path, opened: how.where };
  }
  launch(p, agentCommand(), first, sprint);
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

module.exports = { heard, gone, presenceOf, heardFromFolder, startTeam, nudge, restartTeam, logTail, agentCommand, WHERE, spawnAgent };
