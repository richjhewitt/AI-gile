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
const lastWhere = new Map();   // slug -> 'vscode' | 'terminal' (AIG-107)
// A session that used the board in the last 15 minutes is still at work, even between waits: no background run
// starts on top of it (AIG-107).
const ACTIVE_MS = 15 * 60e3;
const heard = (slug, where) => { lastHeard.set(slug, Date.now()); if (where) lastWhere.set(slug, where); };
function presenceOf(slug) {
  const t = lastHeard.get(slug), r = runs.get(slug);
  return { online: !!r || (!!t && Date.now() - t < ONLINE_MS), lastHeard: t ? new Date(t).toISOString() : null,
    running: !!r, startedAt: r ? new Date(r.startedAt).toISOString() : null, where: r ? 'background' : lastWhere.get(slug) || null };
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
const SPRINT = slug => `${owner()} is asleep and the night watchman woke you. Read your notes, run the board brief for project ${slug}, deal with any comments, then keep working through To do and In progress in priority order: build, test, commit locally (no push) and hand each over with aigile test. Decide small things yourself and log them. Stop when nothing is left or everything left needs ${owner()}. Do not start the wait command.`;

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

function launch(p, exe, first, sprint) {
  fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
  const fd = fs.openSync(logFile(p.slug), 'a');
  fs.writeSync(fd, `=== ${new Date().toISOString()} started${p.verbose ? ' (verbose)' : ''} ===\n`);
  // A chatty lead (AIG-140) may add one short friendly line to the owner's chat while it's there.
  const chat = p.chatty ? ' Chatty lead is on: if it helps, send at most one short friendly line with aigile dm (a nudge about what is waiting on them, or a light joke).' : '';
  const args = first ? ['-p', FIRST(p.slug) + chat] : ['-p', (sprint ? SPRINT : PROMPT)(p.slug) + chat, '--continue'];
  // Verbose (AIG-154): one JSON event per line on stdout, which we turn into readable lines as they come.
  if (p.verbose) args.push('--output-format', 'stream-json', '--verbose');
  // AIGILE_BACKGROUND tells the CLI inside this run that it is a background run (not a window you opened).
  const opts = { cwd: p.path, windowsHide: true, stdio: ['ignore', p.verbose ? 'pipe' : fd, fd], env: { ...process.env, AIGILE_BACKGROUND: '1' } };
  let child;
  // Node can't spawn .bat/.cmd directly: go through cmd.exe with the whole line quoted once.
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(exe))
    child = spawn('cmd.exe', ['/d', '/s', '/c', '"' + [exe, ...args].map(a => '"' + a.replace(/"/g, '') + '"').join(' ') + '"'], { ...opts, windowsVerbatimArguments: true });
  else child = spawn(exe, args, opts);
  fs.closeSync(fd);
  if (p.verbose && child.stdout) {
    let buf = '';
    const out = (s, all) => { buf += s; const ls = buf.split(/\r?\n/); buf = all ? '' : ls.pop();
      const txt = ls.flatMap(l => readable(l, p.path)).join('\n'); if (txt) try { fs.appendFileSync(logFile(p.slug), txt + '\n'); } catch {} };
    child.stdout.setEncoding('utf8'); child.stdout.on('data', s => out(s)); child.stdout.on('end', () => out('', true));
  }
  const run ={ child, startedAt: Date.now(), again: false, restart: false };
  runs.set(p.slug, run);
  const done = code => {
    if (runs.get(p.slug) !== run) return;
    runs.delete(p.slug); lastEnd.set(p.slug, Date.now());
    try { fs.appendFileSync(logFile(p.slug), `=== exited ${code} ===\n`); } catch {}
    if (run.again || run.restart) { const q = load(p.slug); if (q) try { startTeam(q, true); } catch {} }
  };
  child.on('error', e => { try { fs.appendFileSync(logFile(p.slug), 'could not start: ' + e.message + '\n'); } catch {} done('error'); });
  // A verbose run's last lines may still be on their way: write them before the "exited" line (AIG-154).
  child.on('exit', code => { if (!child.stdout || child.stdout.readableEnded) return done(code); child.stdout.once('end', () => done(code)); setTimeout(() => done(code), 3000); });
}

// Start a background run (or ask a running one to go round again). Not when a terminal session already hears Rich,
// unless force is set; first starts a fresh conversation. Throws bad() when there is no folder or agent program.
function startTeam(p, force, first, sprint) {
  if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first (🔌 Connect folder)');
  const exe = agentCommand(), run = runs.get(p.slug), t = lastHeard.get(p.slug);
  if (run) { run.again = true; return { ok: true, folder: p.path, running: true }; }
  if (!force && t && Date.now() - t < ACTIVE_MS && t > (lastEnd.get(p.slug) || 0)) return { ok: true, folder: p.path, terminal: true };
  launch(p, exe, first, sprint);
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

// Only the end of the file is read (the 👁 Watch view asks every few seconds and a verbose log grows fast, AIG-154).
function logTail(slug, lines = 200) {
  try {
    const f = logFile(slug), size = fs.statSync(f).size, n = Math.min(size, 256 * 1024), b = Buffer.alloc(n), fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, b, 0, n, size - n); } finally { fs.closeSync(fd); }
    return b.toString('utf8').split(/\r?\n/).slice(n < size ? 1 : 0).slice(-lines - 1).join('\n').trim();
  } catch { return ''; }
}

module.exports = { heard, gone, presenceOf, heardFromFolder, startTeam, nudge, restartTeam, logTail, agentCommand, readable };
