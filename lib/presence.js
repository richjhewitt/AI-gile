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
const SPRINT = slug => `${owner()} is asleep and the night watchman woke you. Read your notes, run the board brief for project ${slug}, deal with any comments, then keep working through To do and In progress in priority order: build, test, commit locally (no push) and hand each over with aigile test. Decide small things yourself and log them. When To do is empty, don't stop (AIG-261): pick the next backlog cards you can do without ${owner()} and do them, or plan future work as small cards with test steps. Only stop when everything left truly needs ${owner()}. Wait for your own background agents and commands to finish before you stop: the run ends when you do and takes them with it (AIG-270). Do not start the wait command.`;

// A new project's first run: there is no earlier conversation to continue.
const FIRST = slug => `You are the team for a new project (${slug}) on the AI-gile board. Read your notes and the ways of working, run the board brief, add yourself to the team roster, then stop. Do not start the wait command: the board starts you again when ${owner()} comments.`;

/* ---------- verbose runs (AIG-154) ---------- */
// The agent's stream-json events (one per line) as short readable log lines: each step and command, then the final result as before.
const ICON = { Bash: '🔧', Edit: '✏️', MultiEdit: '✏️', Write: '✏️', NotebookEdit: '✏️', Read: '📖', Grep: '🔍', Glob: '🔍', WebFetch: '🌐', WebSearch: '🌐', Task: '🤖', Agent: '🤖', TodoWrite: '📝' };
const cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function toolLine(u, cwd) {
  const i = u.input || {}, rel = f => { f = String(f || ''); const r = cwd && path.relative(cwd, f); return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.replace(/\\/g, '/') : f; };
  const what = i.command || (i.file_path || i.notebook_path ? rel(i.file_path || i.notebook_path) : '') || i.pattern || i.url || i.query || i.description
    || (u.name === 'TodoWrite' ? '' : JSON.stringify(i));
  return `${ICON[u.name] || '🔧'} ${u.name}${what ? (u.name === 'Bash' ? ': ' : ' ') + cut(what, 160) : ''}`;
}
function readable(line, cwd) {
  let ev; try { ev = JSON.parse(line); } catch { return line.trim() ? [line] : []; }
  const parts = (ev.message && Array.isArray(ev.message.content)) ? ev.message.content : [];
  if (ev.type === 'system' && ev.subtype === 'init') return [`▶ ${ev.model || 'agent'} started`];
  if (ev.type === 'assistant') return parts.map(c => c.type === 'text' && c.text.trim() ? '💬 ' + cut(c.text, 400) : c.type === 'tool_use' ? toolLine(c, cwd) : '').filter(Boolean);
  // A tool's answer: only its first line, and only when it failed or said something.
  if (ev.type === 'user') return parts.filter(c => c.type === 'tool_result').map(c => {
    const txt = Array.isArray(c.content) ? c.content.map(x => x.text || '').join(' ') : c.content;
    return txt && String(txt).trim() ? `   ${c.is_error ? '⚠️' : '↳'} ${cut(String(txt).split(/\r?\n/).find(l => l.trim()), 140)}` : '';
  }).filter(Boolean);
  if (ev.type === 'result') return [ev.result || (ev.is_error ? '⚠️ ' + (ev.subtype || 'error') : '')].filter(Boolean);
  return [];
}

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
  fs.writeSync(fd, `=== ${new Date().toISOString()} started${p.verbose ? ' (verbose)' : ''} ===\n`);
  const chat = chatLine(p);
  const args = first ? ['-p', FIRST(p.slug) + chat] : ['-p', (sprint ? SPRINT : PROMPT)(p.slug) + chat, '--continue'];
  // Verbose (AIG-154): one JSON event per line, written raw to <slug>.raw and turned into readable lines by tail().
  if (p.verbose) args.push('--output-format', 'stream-json', '--verbose');
  const raw = p.verbose ? fs.openSync(rawFile(p.slug), 'w') : null;
  // AIGILE_BACKGROUND tells the CLI inside this run that it is a background run (not a window you opened).
  // Detached (AIG-270): on Windows a child that isn't is killed with the board, so a board restart cut every team off.
  const opts = { cwd: p.path, windowsHide: true, detached: true, stdio: ['ignore', raw ?? fd, fd], env: { ...process.env, AIGILE_BACKGROUND: '1' } };
  const child = spawnAgent(exe, args, opts);
  fs.closeSync(fd); if (raw !== null) fs.closeSync(raw);
  child.unref();
  const run = { pid: child.pid, startedAt: Date.now(), verbose: !!p.verbose, off: 0, again: false, restart: false };
  track(p.slug, run);
  child.on('error', e => { try { fs.appendFileSync(logFile(p.slug), 'could not start: ' + e.message + '\n'); } catch {} ended(p.slug, run, 'error'); });
  child.on('exit', code => ended(p.slug, run, code));
}

/* ---------- runs that outlive the board (AIG-270) ---------- */
// Each run is noted in logs/<slug>.run (pid, start, verbose offset). A restarted board picks the runs that are still
// going back up from those files, so presence, 👁 Watch and the "go round again" trigger keep working.
const rawFile = slug => path.join(DATA, 'logs', slug + '.raw');
const runFile = slug => path.join(DATA, 'logs', slug + '.run');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const note = (slug, run) => { try { fs.writeFileSync(runFile(slug), JSON.stringify({ pid: run.pid, startedAt: run.startedAt, verbose: run.verbose, off: run.off })); } catch {} };
// New verbose events since the last look, as readable lines in the team log.
function tail(slug, run, all) {
  if (!run.verbose) return;
  try {
    const f = rawFile(slug), size = fs.statSync(f).size; if (size <= run.off) return;
    const b = Buffer.alloc(size - run.off), fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, b, 0, b.length, run.off); } finally { fs.closeSync(fd); }
    const s = b.toString('utf8'), end = all ? s.length : s.lastIndexOf('\n') + 1; if (!end) return;
    run.off += Buffer.byteLength(s.slice(0, end));
    const p = load(slug), txt = s.slice(0, end).split(/\r?\n/).flatMap(l => readable(l, p && p.path)).join('\n');
    if (txt) fs.appendFileSync(logFile(slug), txt + '\n');
    note(slug, run);
  } catch {}
}
function track(slug, run) {
  runs.set(slug, run); note(slug, run);
  // Every second: verbose lines; every 5 s: is the run still going (an adopted run has no exit event).
  let n = 0;
  run.timer = setInterval(() => { tail(slug, run); if (++n % 5 === 0 && !alive(run.pid)) ended(slug, run, run.adopted ? 'ended' : '?'); }, 1000);
  run.timer.unref();
}
function ended(slug, run, code) {
  if (runs.get(slug) !== run) return;
  clearInterval(run.timer);
  tail(slug, run, true);   // a verbose run's last lines go before the "exited" line (AIG-154)
  runs.delete(slug); lastEnd.set(slug, Date.now());
  try { fs.unlinkSync(runFile(slug)); } catch {}
  try { fs.appendFileSync(logFile(slug), `=== exited ${code} ===\n`); } catch {}
  if (run.again || run.restart) { const q = load(slug); if (q) try { startTeam(q, true); } catch {} }
}
// On start: pick up the runs a previous board left going. A run older than 6 hours is taken as gone (the pid may be reused).
function adopt() {
  for (const slug of listSlugs()) {
    let r; try { r = JSON.parse(fs.readFileSync(runFile(slug), 'utf8')); } catch { continue; }
    if (!r.pid || Date.now() - r.startedAt > 6 * 3600e3 || !alive(r.pid)) { try { fs.unlinkSync(runFile(slug)); } catch {} continue; }
    track(slug, { pid: r.pid, startedAt: r.startedAt, verbose: !!r.verbose, off: r.off || 0, again: false, restart: false, adopted: true });
  }
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

function killTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
  else try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch {} }   // detached: its own process group
}
// Kill a stuck run and start a fresh one.
function restartTeam(p) {
  const run = runs.get(p.slug);
  if (!run) return startTeam(p, true);
  run.restart = true; run.again = false;
  killTree(run.pid);
  if (run.adopted) ended(p.slug, run, 'killed');   // no exit event for a run a previous board started
  return { ok: true, folder: p.path, running: true };
}

// Only the end of the file is read (the 👁 Watch view asks every few seconds and a verbose log grows fast, AIG-154).
function logTail(slug, lines = 200) {
  try {
    const f = logFile(slug), size = fs.statSync(f).size, n = Math.min(size, 256 * 1024), b = Buffer.alloc(n), fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, b, 0, n, size - n); } finally { fs.closeSync(fd); }
    return b.toString('utf8').split(/\r?\n/).slice(n < size ? 1 : 0).slice(-lines - 1).join('\n').trim();
  } catch { return ''; }
}

try { adopt(); } catch {}   // a new install has no data folder yet

module.exports = { heard, gone, presenceOf, heardFromFolder, startTeam, nudge, restartTeam, logTail, agentCommand, WHERE, spawnAgent, readable };
