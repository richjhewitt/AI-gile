// Team presence (is a session alive?) and running a team in the background (no terminal window), or in a window (AIG-153).
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { runTokens, tokenLine } = require('./usage');
const noTokens = require('./notokens');
const { t: tr } = require('./i18n');
const { DATA, load, save, listSlugs, localSettings, bad, owner, isRich } = require('./store');

/* ---------- presence ---------- */
// A team counts as online if its session was heard from in the last 5 minutes: hooks and 'aigile wait'
// (every 15s while idle) call /updates, and the status line reports its folder with each reading.
const ONLINE_MS = +process.env.AIGILE_ONLINE_MS || 5 * 60e3;   // tests: a short window
const CMD_MS = +process.env.AIGILE_CMD_MS || 60e3;   // a shell command with no news for this long counts as a long command (AIG-636)
const lastHeard = new Map();   // slug -> ms
const lastWhere = new Map();   // slug -> 'vscode' | 'terminal' (AIG-107)
// A session that used the board in the last 15 minutes is still at work, even between waits: no background run
// starts on top of it (AIG-107).
const ACTIVE_MS = +process.env.AIGILE_ACTIVE_MS || 15 * 60e3;   // tests: a short window
// Since when the session has only been sitting in 'aigile wait' (AIG-277): wait=true starts it, any other call from the
// session ends it, undefined (the status line, which ticks while idle too) leaves it.
const waitSince = new Map();   // slug -> ms
// AIG-447, one lead per project: when an interactive session (VS Code or a terminal) last used the board. Our own
// background runs never set this, so a run's calls can't pass for a session.
const lastLive = new Map();   // slug -> ms
// A wait that returned with news (the session goes to act on it) keeps the lead active for a grace period (AIG-523).
const GRACE_MS = +process.env.AIGILE_GRACE_MS || 5 * 60e3;   // tests: a short window
const waitEnded = new Map();   // slug -> ms
// rev (AIG-920): bumped on every presence change, so GET /api/rev moves when a team's online or running state does.
let rev = 0;
const revOf = new Map();   // slug -> its own counter, so one team's heartbeat only moves that project's stamp
const bumpRev = key => { rev++; const slug = String(key).split('#')[0]; revOf.set(slug, (revOf.get(slug) || 0) + 1); };
// The stamp also carries the states that change by the clock alone (online, live in a session), so going quiet shows at once.
const presenceRev = slug => {
  if (slug === undefined) return rev + ':' + listSlugs().map(s => presenceRev(s)).join(',');
  const t = lastHeard.get(slug), live = lastLive.get(slug), now = Date.now();
  return (revOf.get(slug) || 0) + ':' + (t && now - t < ONLINE_MS ? 1 : 0) + (live && now - live < ACTIVE_MS ? 1 : 0);
};
const heard = (slug, where, wait) => {
  bumpRev(slug);
  lastHeard.set(slug, Date.now()); if (where === 'vscode' || where === 'terminal') lastLive.set(slug, Date.now()); if (where) lastWhere.set(slug, where);
  if (wait === true) { if (!waitSince.has(slug)) waitSince.set(slug, Date.now()); } else if (wait === false) { if (waitSince.delete(slug)) waitEnded.set(slug, Date.now()); }
};
function presenceOf(slug) {
  const t = lastHeard.get(slug), r = runs.get(slug), o = opened.get(slug), w = waitSince.get(slug);
  return { online: !!r || (!!t && Date.now() - t < ONLINE_MS), lastHeard: t ? new Date(t).toISOString() : null,
    waitingMs: !r && w ? Date.now() - w : 0,
    queued: waitq.has(slug), running: !!r, startedAt: r ? new Date(r.startedAt).toISOString() : null, where: r ? 'background' : lastWhere.get(slug) || null,
    opened: o ? { where: o.where, at: new Date(o.at).toISOString() } : null,   // a window we opened (AIG-153); we can't see it end
    workers: workersOf(slug),   // 🐝 swarm workers (AIG-901), one run per card
    activity: activityOf(slug, r) };
}
// 🐝 Swarm workers of a project (AIG-901): runs keyed "<slug>#<card id>" (lib/swarmworkers.js).
const workersOf = slug => [...runs].filter(([k]) => k.startsWith(slug + '#')).map(([k, r]) => ({ id: k.slice(slug.length + 1), branch: r.branch || '', startedAt: new Date(r.startedAt).toISOString() }));
// What the team is doing right now (AIG-636), for the card chat's state line: { state: 'thinking' | 'working' | 'command',
// since (when it entered that state), signAt (last sign of life: the run's log last grew), watch (is the log a live feed?) }.
// Only a verbose run writes a line per step; any other run or session gives just 'working' and no stale watch.
const actMemo = new Map();   // slug -> { state, since }
function activityOf(slug, r) {
  if (!r) {   // a session (VS Code, terminal): no log to read, so only working, counted from when we first saw it busy
    const t = lastHeard.get(slug), w = lastWhere.get(slug);
    if (!t || Date.now() - t >= ONLINE_MS || (w !== 'vscode' && w !== 'terminal') || waitSince.has(slug)) { actMemo.delete(slug); return null; }
    if (!actMemo.get(slug)) actMemo.set(slug, { state: 'working', since: t });
    return { state: 'working', since: new Date(actMemo.get(slug).since).toISOString(), signAt: new Date(t).toISOString(), watch: false };
  }
  let st = null, last = '';
  if (r.verbose) {
    try { st = fs.statSync(logFile(slug)); const n = Math.min(st.size, 4096), b = Buffer.alloc(n), fd = fs.openSync(logFile(slug), 'r'); try { fs.readSync(fd, b, 0, n, st.size - n); } finally { fs.closeSync(fd); } last = b.toString('utf8').split(/\r?\n/).filter(l => l.trim()).pop() || ''; } catch {}
  }
  const at = st ? st.mtimeMs : r.startedAt;
  let state = 'working';
  if (r.verbose) state = /^🔧 Bash/.test(last) ? (Date.now() - at >= CMD_MS ? 'command' : 'working') : /^(🔧|✏️|📖|🔍|🌐|🤖|📝)/.test(last) ? 'working' : 'thinking';
  const m = actMemo.get(slug);
  if (!m || m.state !== state || m.run !== r) actMemo.set(slug, { state, since: at, run: r });
  return { state, since: new Date(actMemo.get(slug).since).toISOString(), signAt: new Date(at).toISOString(), watch: !!r.verbose };
}

// A session closed (SessionEnd hook, AIG-219): it no longer counts as at work, so the next comment wakes a background run.
const gone = slug => { bumpRev(slug); lastHeard.delete(slug); lastLive.delete(slug); lastWhere.delete(slug); waitSince.delete(slug); waitEnded.delete(slug); };
function heardFromFolder(dir) {
  const norm = d => String(d || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const d = norm(dir);
  if (!d) return;
  for (const s of listSlugs()) { const p = require('./store').peek(s); if (p && p.path && norm(p.path) === d) { heard(s); lastLive.set(s, Date.now()); } }   // the status line only ticks in a session
}

// Is the project's lead already at work in a session (AIG-447)? It used the board from its folder in the last 15 minutes,
// or sits in 'aigile wait'. Then no background run starts: the comment lands where the session hears it. The project
// setting "second lead" (p.secondLead) allows a run on top anyway, for when there is a lot of work.
function leadActive(p) {
  if (p.secondLead) return false;
  const live = lastLive.get(p.slug), t = lastHeard.get(p.slug);
  const ended = waitEnded.get(p.slug);
  return (!!live && Date.now() - live < ACTIVE_MS) || (!!ended && Date.now() - ended < GRACE_MS) || (waitSince.has(p.slug) && !!t && Date.now() - t < ONLINE_MS);
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
const PROMPT = slug => `${owner()} commented on the AI-gile board. Read your notes, run the board brief for project ${slug}, deal with the comments, then stop. Don't start the wait command: the board restarts you.${require('./dispatch').hint(slug)}`;

// The 🌙 watchman waking a team while the owner sleeps (AIG-222): keep working through the board, not just the comments.
const SPRINT = slug => `${owner()} is asleep and the night watchman woke you. Read your notes, run the board brief for project ${slug}, deal with any comments, then keep working through To do and In progress in priority order: build, test, commit locally (no push) and hand each over with aigile test. Decide small things yourself and log them. When To do is empty, don't stop (AIG-261): pick the next backlog cards you can do without ${owner()} and do them, or plan future work as small cards with test steps. ${owner()}'s standing order for the night (AIG-277): every To do card already has the go, and so does backlog you can build safely on a branch; "propose and wait for the go" is paused until morning. A card with an open question: make the sensible call yourself, log it as a decision, build it and hand it over with aigile test. "Nothing changed since last run" is not a reason to stop. Only stop when everything left truly needs ${owner()} in person: pushing or going live, passwords or accounts, their devices, or a card they parked. Wait for your own background agents and commands to finish before you stop: the run ends when you do and takes them with it (AIG-270). Do not start the wait command.`;

// The 🧭 Lead Scrum Master waking a team by day (AIG-359): asleep with To do, so work through it the usual way.
const DAY = slug => `The Lead Scrum Master woke you: you are asleep with cards in To do. Read your notes, run the board brief for project ${slug}, deal with any comments, then work through To do in priority order the usual way (propose and wait for the go where your ways of working say so). Stop when To do is done or everything left needs ${owner()}. Do not start the wait command: the board restarts you.`;

// A new project's first run: there is no earlier conversation to continue.
const FIRST = slug => `You are the team for a new project (${slug}) on the AI-gile board. Read your notes and the ways of working, run the board brief, add yourself to the roster, then stop. Don't start the wait command: the board restarts you.`;

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
  require('./noai').guard();   // 🚫 No AI, ever (AIG-581): the last gate, whoever asks
  // Node can't spawn .bat/.cmd directly: go through cmd.exe with the whole line quoted once.
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(exe))
    return spawn('cmd.exe', ['/d', '/s', '/c', '"' + [exe, ...args].map(a => '"' + a.replace(/"/g, '') + '"').join(' ') + '"'], { ...opts, windowsVerbatimArguments: true });
  return spawn(exe, args, opts);
}

// Hidden runs on Windows (AIG-275): a detached child has no console at all, so every console program it starts (git,
// ping, a shell) pops up its own window on the owner's screen. Instead PowerShell starts the run with Start-Process
// -WindowStyle Hidden: it gets its own hidden console that its programs share and, as the board's grandchild, it is
// outside the board's job, so it still outlives a board restart (AIG-270). cmd.exe in front appends the output to the
// log and lives exactly as long as the agent: its pid is the run's pid. Resolves with that pid.
// shell: exe is a whole command line (a card's start command), run as written.
function spawnHidden(exe, args, { cwd, env, out, err, shell, nostdin }) {
  const q = s => '"' + String(s).replace(/"/g, '') + '"';
  const line = `/d /s /c "${shell ? exe : [exe, ...args].map(q).join(' ')}${nostdin ? ' < nul' : ''} ${out === err ? `>> ${q(out)} 2>&1` : `> ${q(out)} 2>> ${q(err)}`}"`;
  const sq = s => "'" + String(s).replace(/'/g, "''") + "'";
  const ps = `$ProgressPreference='SilentlyContinue'; $p = Start-Process -FilePath 'cmd.exe' -ArgumentList ${sq(line)} -WorkingDirectory ${sq(cwd)} -WindowStyle Hidden -PassThru; [Console]::Out.Write($p.Id)`;
  return new Promise((resolve, reject) => {
    const c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = '';
    c.stdout.on('data', d => o += d); c.stderr.on('data', d => e += d);
    c.on('error', reject);
    c.on('exit', () => { const pid = parseInt(o, 10); pid > 0 ? resolve(pid) : reject(new Error((e.match(/[^\r\n<>]{8,}/) || ['no pid'])[0].trim())); });
  });
}
// Calls back once the process has gone (no exit event for a process we didn't start ourselves).
function whenGone(pid, cb) { const t = setInterval(() => { if (!alive(pid)) { clearInterval(t); cb(); } }, 1000); t.unref(); return t; }

// Pro-friendly runs (AIG-268, ⚙️ Setup "runs.light"): every FRESH_EVERY-th run starts a fresh conversation instead of
// an ever-longer --continue, and runs that only answer comments use the smaller model; night sprints keep the default.
const FRESH_EVERY = 5;
// AIG-545: for everyone (not only Pro-friendly), a resumed conversation that has grown long is dropped for a fresh one:
// every wake re-reads all of it. After RESET_RUNS runs, or when its transcript file passes RESET_BYTES.
// AIG-552: half the size (about 150k tokens of context), and fresh after RESET_IDLE_MS idle too: the prompt cache has
// gone by then, so resuming would write the whole conversation to the cache again at twice the input price.
const RESET_RUNS = 12, RESET_BYTES = 0.6 * 1024 * 1024, RESET_IDLE_MS = 55 * 60e3;
function sessionStat(sid) {
  if (!sid) return null;
  try {
    const root = path.join(require('os').homedir(), '.claude', 'projects');
    for (const d of fs.readdirSync(root)) { const f = path.join(root, d, sid + '.jsonl'); if (fs.existsSync(f)) return fs.statSync(f); }
  } catch {}
  return null;
}
const sessionBytes = sid => { const st = sessionStat(sid); return st ? st.size : 0; };
const sessionIdle = sid => { const st = sessionStat(sid); return st ? Date.now() - st.mtimeMs > RESET_IDLE_MS : false; };
// AIG-552: background runs don't need the claude.ai connectors, skills or slash commands; leaving them out trims the
// fixed prefix every call of the run carries (docs/TOKENS.md #7).
const LEAN = ['--strict-mcp-config', '--disable-slash-commands', '--disallowedTools', 'CronCreate CronDelete CronList RemoteTrigger DesignSync PushNotification ScheduleWakeup'];
// AIG-673: the owner's git push choice (Setup, 'push' in aigile.local.json: 'ask' | 'auto'): a line in every background prompt,
// and in 'auto' the run may git push. A force push is always denied. onboard.applyPush keeps the project's settings in step.
const pushMode = () => localSettings().push === 'auto' ? 'auto' : 'ask';
const FORCE = ['Bash(git push --force:*)', 'Bash(git push -f:*)', 'Bash(git push --force-with-lease:*)', 'PowerShell(git push --force:*)', 'PowerShell(git push -f:*)'];
const pushLine = () => require('./profiles').pushLine(pushMode(), owner());
// One --disallowedTools only (a second flag may replace the first): LEAN's list plus the force pushes.
const pushArgs = () => [...LEAN.slice(0, -1), LEAN[LEAN.length - 1] + ' ' + FORCE.join(' '), ...(pushMode() === 'auto' ? ['--allowedTools', 'Bash(git push:*) PowerShell(git push:*)'] : [])];
const slowed = () => { try { return !!require('./budget').slow(); } catch { return false; } };
function runsSinceFresh(slug) {
  const starts = logTail(slug, 3000).split('\n').filter(l => /^=== \S+ started/.test(l));
  return starts.length - 1 - starts.map(l => /\(fresh\)/.test(l)).lastIndexOf(true);
}
function launch(p, exe, first, sprint) {
  fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
  const eng = require('./engines').forProject(load(p.slug) || p), codex = eng.engine !== 'claude';   // AIG-704/761: the lead's engine (codex or gemini)
  if (codex) exe = require('./engines').engineExe(eng.engine);
  const light = !!(localSettings().runs || {}).light, fresh = !first && ((light && runsSinceFresh(p.slug) >= FRESH_EVERY) || runsSinceFresh(p.slug) >= RESET_RUNS || sessionBytes((load(p.slug) || p).runSession) > RESET_BYTES || sessionIdle((load(p.slug) || p).runSession));
  const fd = fs.openSync(logFile(p.slug), 'a');
  fs.writeSync(fd, `=== ${new Date().toISOString()} started${codex ? ` (${eng.engine})` : ''}${p.verbose ? ' (verbose)' : ''}${fresh ? ' (fresh)' : ''} ===\n`);
  const chat = chatLine(p) + ' ' + pushLine();
  try { require('./onboard').applyPush(p, pushMode()); } catch {}
  // AIG-447: never --continue (that picks the newest conversation in the folder, which can be the lead's own VS Code
  // session). The board keeps the id of the conversation it started (p.runSession) and resumes only that; with none, or
  // on a fresh turn, it starts a new one under an id it chooses.
  const cur = load(p.slug) || p, resume = !first && !fresh && cur.runSession, sid = resume ? '' : require('crypto').randomUUID();
  if (sid) { cur.runSession = sid; try { save(cur); } catch {} }
  const sess = resume ? ['--resume', cur.runSession] : ['--session-id', sid];
  let args = first ? ['-p', FIRST(p.slug) + chat, ...sess] : ['-p', (sprint === 'day' ? DAY : sprint ? SPRINT : PROMPT)(p.slug) + chat, ...sess];
  args.push(...pushArgs());
  if ((light || slowed()) && !first && !sprint) args.push('--model', 'sonnet');   // AIG-466: the pace guard picks the smaller model too
  // Verbose (AIG-154): one JSON event per line, written raw to <slug>.raw and turned into readable lines by tail().
  if (p.verbose && !codex) args.push('--output-format', 'stream-json', '--verbose');
  // Codex (AIG-704/705, lib/engines.js): its own command line, always JSON events (read like a verbose run), a new conversation each time.
  const verbose = codex || !!p.verbose;
  if (codex) { const E = require('./engines'); args = E.ENGINES[eng.engine].args({ prompt: E.preambleFor(eng.engine) + (first ? FIRST : sprint === 'day' ? DAY : sprint ? SPRINT : PROMPT)(p.slug) + chat, model: eng.model }); }
  // AIGILE_BACKGROUND tells the CLI inside this run that it is a background run (not a window you opened).
  const env = { ...process.env, AIGILE_BACKGROUND: '1' };
  if (win) {
    fs.closeSync(fd);
    if (verbose) fs.writeFileSync(rawFile(p.slug), '');
    const run = { pid: 0, startedAt: Date.now(), verbose, engine: eng.engine, off: 0, again: false, restart: false, polled: true };
    track(p.slug, run);
    // Verbose: errors go to the raw file too (shown as plain lines); cmd.exe locks the file it writes, so the board
    // couldn't add the readable lines to a log the run also writes to.
    const out = verbose ? rawFile(p.slug) : logFile(p.slug);
    spawnHidden(exe, args, { cwd: p.path, env, out, err: out, nostdin: codex })   // codex/gemini wait on stdin unless it is closed
      .then(pid => { run.pid = pid; if (run.stopped) killTree(pid); note(p.slug, run); }, e => { try { fs.appendFileSync(logFile(p.slug), 'could not start: ' + e.message + '\n'); } catch {} ended(p.slug, run, 'error'); });
    return;
  }
  const raw = verbose ? fs.openSync(rawFile(p.slug), 'w') : null;
  // Detached (AIG-270): a child that isn't is killed with the board, so a board restart cut every team off.
  const child = spawnAgent(exe, args, { cwd: p.path, windowsHide: true, detached: true, stdio: ['ignore', raw ?? fd, fd], env });
  fs.closeSync(fd); if (raw !== null) fs.closeSync(raw);
  child.unref();
  const run = { pid: child.pid, startedAt: Date.now(), verbose, engine: eng.engine, off: 0, again: false, restart: false };
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
const note = (slug, run) => { try { fs.writeFileSync(runFile(slug), JSON.stringify({ pid: run.pid, startedAt: run.startedAt, verbose: run.verbose, off: run.off, engine: run.engine, cwd: run.cwd, branch: run.branch })); } catch {} };
// New verbose events since the last look, as readable lines in the team log.
function tail(slug, run, all) {
  if (!run.verbose) return;
  try {
    const f = rawFile(slug), size = fs.statSync(f).size; if (size <= run.off) return;
    const b = Buffer.alloc(size - run.off), fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, b, 0, b.length, run.off); } finally { fs.closeSync(fd); }
    const s = b.toString('utf8'), end = all ? s.length : s.lastIndexOf('\n') + 1; if (!end) return;
    const p = load(slug.split('#')[0]), txt = s.slice(0, end).split(/\r?\n/).flatMap(l => run.engine === 'codex' || run.engine === 'gemini' ? require('./engines').ENGINES[run.engine].read(l, p && p.path) : readable(l, p && p.path)).join('\n');
    if (txt) fs.appendFileSync(logFile(slug), txt + '\n');
    run.off += Buffer.byteLength(s.slice(0, end));   // only once written: a failed write is tried again next second
    note(slug, run);
  } catch {}
}
function track(slug, run) {
  runs.set(slug, run); bumpRev(slug); note(slug, run);
  // Every second: verbose lines; every 5 s: is the run still going (an adopted run has no exit event). A hidden run
  // (AIG-275) has none either: checked every second, once its pid is known (given up if it never is).
  let n = 0;
  run.timer = setInterval(() => {
    tail(slug, run); n++;
    if (run.polled && !run.pid) { if (n > 60) ended(slug, run, 'no pid'); return; }
    if ((run.polled || n % 5 === 0) && !alive(run.pid)) return ended(slug, run, run.adopted || run.polled ? 'ended' : '?');
    if (n % 5 === 0 && silent(rawFile(slug), run)) hung(slug, run);
  }, 1000);
  run.timer.unref();
}
/* ---------- hang watchdog (AIG-359) ---------- */
// A verbose background run writes a line for every step. No new line for HANG_MS (15 min) means it hangs: the 🧭 Lead
// Scrum Master kills it and starts it again, with a note on the card in progress; after 3 hangs in a day for one team only
// the kill. A run that isn't verbose writes nothing until it ends, so it can't be watched this way.
const HANG_MS = +process.env.AIGILE_HANG_MS || 15 * 60e3, MAX_HANGS = 3, SM = '🧭 Lead Scrum Master';
const hangs = new Map();   // slug -> { day, n }
// Has this file not grown for HANG_MS? (keeps its own last size and time on the run object)
function silent(file, run) {
  if (!run.verbose) return false;
  let size = 0; try { size = fs.statSync(file).size; } catch {}
  if (size !== run.seenSize || !run.seenAt) { run.seenSize = size; run.seenAt = Date.now(); return false; }
  return Date.now() - run.seenAt >= HANG_MS;
}
function hung(slug, run) {
  const day = new Date().toLocaleDateString('sv'), h = hangs.get(slug);
  const n = h && h.day === day ? h.n + 1 : 1; hangs.set(slug, { day, n });
  const mins = Math.round(HANG_MS / 60e3), again = n <= MAX_HANGS;
  run.again = false; run.restart = false; run.stopped = true;
  if (run.pid) killTree(run.pid);
  ended(slug, run, 'hung');
  try { fs.appendFileSync(logFile(slug), `=== hung: no new log lines for ${mins} min, stopped${again ? ' and started again' : ''} by the ${SM} ===\n`); } catch {}
  let started = false;
  if (again) { const p = load(slug); try { if (p) { const r = startTeam(p, true, false, false, true, false, true); started = !!(r && (r.running || r.queued)); } } catch {} }
  try {
    const p = load(slug), c = p && p.cards.filter(c => c.status === 'doing').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
    if (c) {
      c.comments.push({ author: SM, at: new Date().toISOString(), text: tr('srv.restart.base', { mins, tail: started ? tr('srv.restart.started') : again ? tr('srv.restart.nostart') : tr('srv.restart.giveup', { n }) }) });
      c.updated = new Date().toISOString(); require('./store').save(p);
    }
  } catch {}
}

// Cards a team worked on during a run (AIG-299): any card with a comment (not the owner's) or a change in the window.
function cardsWorked(p, from, to) {
  const inWin = t => { const x = Date.parse(t); return x >= from - 1000 && x <= to + 1000; };
  return (p.cards || []).filter(c => (c.comments || []).some(m => inWin(m.at) && !isRich(m.author)) || inWin(c.updated)).map(c => c.id);
}
// What this run cost (AIG-266): one line in the team's log and one row in data/logs/_runs.jsonl for the Usage page.
function logTokens(slug, run) {
  try {
    const base = slug.split('#')[0], p = load(base), end = Date.now(), tk = p && runTokens(process.env.AIGILE_USAGE_DIR || localSettings().usageDir, run.cwd || p.path, run.startedAt, end);   // a swarm worker (AIG-901): its worktree
    if (!tk) return;
    fs.appendFileSync(logFile(slug), tokenLine(tk) + '\n');
    fs.appendFileSync(path.join(DATA, 'logs', '_runs.jsonl'), JSON.stringify({ slug: base, start: run.startedAt, end, cards: cardsWorked(p, run.startedAt, end), ...tk }) + '\n');
  } catch {}
}
// Runs that ended in the last day (default), biggest first.
function recentRuns(hours = 24) {
  let rows = [];
  try { rows = fs.readFileSync(path.join(DATA, 'logs', '_runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch {}
  return rows.filter(r => r.end >= Date.now() - hours * 3600e3).sort((a, b) => (b.in + b.out) - (a.in + a.out));
}
function ended(slug, run, code) {
  if (runs.get(slug) !== run) return;
  clearInterval(run.timer);
  tail(slug, run, true);   // a verbose run's last lines go before the "exited" line (AIG-154)
  runs.delete(slug); bumpRev(slug); lastEnd.set(slug, Date.now());
  try { fs.unlinkSync(runFile(slug)); } catch {}
  try { fs.appendFileSync(logFile(slug), `=== exited ${code} ===\n`); } catch {}
  logTokens(slug, run);
  for (const [q, a] of [...waitq]) {   // a place is free: the first in line goes (AIG-353)
    const cap = require('./budget').budget().parallel;
    if (cap && runs.size >= cap) break;
    waitq.delete(q); const pq = load(q); try { if (pq && !runs.has(q)) startTeam(pq, true, a[0], a[1], true, false, true); } catch {}   // it passed the checks when it was queued
  }
  if (slug.includes('#')) { setImmediate(() => { try { require('./swarmworkers').fill(); } catch {} }); return; }   // 🐝 a swarm worker ended: the next card (AIG-901)
  if (run.again || run.restart) { const q = load(slug); if (q && (run.restart || ownerNews(q).length)) try { startTeam(q, true, false, false, false, !!run.byOwner, !!run.restart); } catch {} }   // again: only for news still unseen (AIG-272)
}
// On start: pick up the runs a previous board left going. A run older than 6 hours is taken as gone (the pid may be reused).
function adopt() {
  let workers = []; try { workers = fs.readdirSync(path.join(DATA, 'logs')).filter(f => f.endsWith('.run') && f.includes('#')).map(f => f.slice(0, -4)); } catch {}   // 🐝 swarm workers (AIG-901)
  for (const slug of [...listSlugs(), ...workers]) {
    let r; try { r = JSON.parse(fs.readFileSync(runFile(slug), 'utf8')); } catch { continue; }
    if (!r.pid || Date.now() - r.startedAt > 6 * 3600e3 || !alive(r.pid)) { try { fs.unlinkSync(runFile(slug)); } catch {} continue; }
    track(slug, { pid: r.pid, startedAt: r.startedAt, verbose: !!r.verbose, engine: r.engine, off: r.off || 0, cwd: r.cwd, branch: r.branch, again: false, restart: false, adopted: true });
  }
}

/* ---------- where a team runs (AIG-153) ---------- */
// background (hidden, the default), terminal (a window you can watch), vscode (code <folder>; the team works there via
// its hooks) or other (the owner's own command, {folder} filled in). Per project p.runIn / p.runCmd, else "runs" in
// aigile.local.json (⚙️ Setup). Only background runs are ours to track: for the others we only know when we opened them.
const WHERE = ['background', 'terminal', 'vscode', 'other'];
const runIn = p => { const r = localSettings().runs || {}; return { where: p.runIn || r.where || 'background', cmd: p.runCmd || r.cmd || '' }; };
const waitq = new Map();   // slug -> [first, sprint]: wakes waiting for a free place (AIG-353)
const opened = new Map();   // slug -> { where, at }
const busyTries = new Map();   // slug -> tries while its log was locked (AIG-817)
const logBusy = slug => { try { fs.closeSync(fs.openSync(logFile(slug), 'a')); return false; } catch (e) { return e.code === 'EBUSY' || e.code === 'EPERM'; } };
const win = process.platform === 'win32';
let wtFound = null;   // is Windows Terminal on the PATH? (checked once)
const hasWt = () => wtFound ?? (wtFound = win && spawnSync('where', ['wt'], { windowsHide: true }).status === 0);

function openWindow(p, how) {
  require('./noai').guard();   // 🚫 (AIG-581)
  require('./safefolder').guard(p.path, 'open a terminal');   // AIG-944
  const dir = p.path, note = s => { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(logFile(p.slug), `=== ${new Date().toISOString()} opened (${how.where}): ${s} ===\n`); };
  // Quotes and % could break out of the quoted folder in a shell; Windows folder names can't contain quotes anyway.
  if (/["%`$]/.test(dir)) throw bad('that folder has characters I will not pass to a shell');
  // AIGILE_NO_WINDOWS (tests): write what would run to the log instead of opening anything.
  const go = (line, fn) => { note(line); if (!process.env.AIGILE_NO_WINDOWS) fn(); };
  const bye = { detached: true, stdio: 'ignore', cwd: dir };
  if (how.where === 'terminal') {
    if (!win) {
      // Linux / macOS (AIG-408): the same run in the first terminal program found, left open when the agent ends.
      const plat = require('./platform'), prompt = how.prompt || PROMPT(p.slug) + chatLine(p);
      const line = `${plat.shq(agentCommand())} ${how.prompt ? '' : '--continue '}${plat.shq(prompt)}`;
      const t = plat.terminalSpec('AI-gile: ' + p.name, line, dir);
      if (!t) throw bad('no terminal program found (x-terminal-emulator, gnome-terminal, konsole or xterm)');
      go(t.cmd + ' ' + t.args.join(' '), () => spawn(t.cmd, t.args, t.opts).unref());
    } else {
    // The same prompt and --continue as a background run, but interactive, in a PowerShell window that stays open.
    const q = s => "'" + String(s).replace(/'/g, "''").replace(/"/g, '') + "'", script = path.join(DATA, 'logs', p.slug + '.window.ps1');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, `$Host.UI.RawUI.WindowTitle = ${q('AI-gile: ' + p.name)}\nSet-Location -LiteralPath ${q(dir)}\n& ${q(agentCommand())} ${how.prompt ? '' : '--continue '}${q(how.prompt || PROMPT(p.slug) + chatLine(p))}\n`);
    const ps = ['powershell', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', script];
    if (hasWt()) go('wt -d ' + dir + ' ' + ps.join(' '), () => spawn('wt.exe', ['-w', 'new', '-d', dir, ...ps], bye).unref());
    else go(ps.join(' '), () => spawn('powershell.exe', ps.slice(1), bye).unref());   // detached = its own console window
    }
  } else if (how.where === 'vscode') go(`code "${dir}"`, () => spawn(`code "${dir}"`, { ...bye, shell: true, windowsHide: true }).unref());
  else {
    if (!how.cmd.trim()) throw bad('give the command for "Other" first (⚙️ Setup or 🎨 Look)');
    const line = how.cmd.split('{folder}').join(dir);
    go(line, () => spawn(line, { ...bye, shell: true, windowsHide: true }).unref());
  }
  opened.set(p.slug, { where: how.where, at: Date.now() }); bumpRev(p.slug);
}

// Start a background run (or ask a running one to go round again). Not when a terminal session already hears the owner,
// unless force is set; first starts a fresh conversation. Throws bad() when there is no folder or agent program.
// Outside the background (AIG-153) a window is opened instead, once per 15 minutes unless forced (▶ Wake); first runs,
// the night watchman (sprint) and bg (going quiet) always stay in the background.
// A plain wake (the "owner commented" prompt) needs news the team has not seen, the same ownerNews that /updates shows
// (AIG-465): else a whole session is spent hearing "Nothing new". Not for first runs, sprints, the owner's own click or
// anyway (a restart of a stuck run).
function startTeam(p, force, first, sprint, bg, byOwner, anyway) {
  let warn = false;
  noTokens.guard();   // ⛔ No Token Mode (AIG-337)
  require('./today').aiOffGuard(p);   // AIG-608: AI off for this project, whoever asks
  if (!p.path) throw bad('connect a folder to this project first (🔌 Connect folder)');
  if (!fs.existsSync(p.path)) throw bad(require('./i18n').t('srv.folder.missing', { path: p.path }));   // AIG-740
  const how = runIn(p), run = runs.get(p.slug), t = lastHeard.get(p.slug);
  if (run) { run.again = true; if (byOwner) run.byOwner = true; return { ok: true, folder: p.path, running: true }; }   // byOwner: the go-round-again keeps the owner's own ask (the DM me button)
  // One lead per project (AIG-447): force, the watchman and the Lead Scrum Master don't override a lead in a session.
  // Only the owner's own ▶ Wake click does, and a project's very first run.
  if (!first && !byOwner && leadActive(p)) {
    try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(logFile(p.slug), `=== ${new Date().toISOString()} lead active in a session: not starting a background run ===\n`); } catch {}
    return { ok: true, folder: p.path, terminal: true, leadActive: true };
  }
  if (!first && !sprint && !byOwner && !anyway && !ownerNews(load(p.slug) || p).length) {   // fresh from disk: a wake queued earlier may be stale
    try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(logFile(p.slug), `=== ${new Date().toISOString()} nothing new for the team: not starting a background run ===\n`); } catch {}
    return { ok: true, folder: p.path, nothingNew: true };
  }
  if (require('./swarm').holds(p, byOwner)) {   // 🚨 swarm on another project (AIG-822): woken again when it ends
    try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(logFile(p.slug), `=== ${new Date().toISOString()} swarm on another project: not starting a background run ===\n`); } catch {}
    return { ok: true, folder: p.path, swarmPaused: true };
  }
  if (byOwner && !first && !sprint && leadActive(p)) warn = true;   // the owner's own Wake goes ahead, with a warning
  if (!force && !p.secondLead && t && Date.now() - t < ACTIVE_MS && t > (lastEnd.get(p.slug) || 0)) return { ok: true, folder: p.path, terminal: true };
  require('./budget').mayRun();   // over the token budget (AIG-353): refused with the reason
  require('./today').guard(p, { bg, byOwner });   // AIG-596/597: 💤 rest only wakes for the owner's comments; a project past its day share slows down
  require('./budget').saverGuard(p);   // usage saver (AIG-550): only a project with a ⭐ crucial card runs; a run going is not killed, but gets no go-round-again
  const engine = require('./engines').forProject(load(p.slug) || p).engine;   // AIG-704: a Codex lead runs in the background only (windows open Claude)
  if (how.where !== 'background' && !first && !sprint && !bg && engine === 'claude') {
    const o = opened.get(p.slug);
    if (!force && o && Date.now() - o.at < ACTIVE_MS) return { ok: true, folder: p.path, opened: o.where, already: true };
    openWindow(p, how);
    return { ok: true, folder: p.path, opened: how.where };
  }
  // Max parallel team runs (AIG-353): over the cap the wake waits in line until a run ends.
  const cap = require('./budget').budget().parallel;
  if (cap && runs.size >= cap) { waitq.set(p.slug, [first, sprint]); return { ok: true, folder: p.path, queued: true }; }
  // AIG-817: just after a run ends, its log can still be held for a moment (cmd.exe, or a process it left behind), and
  // opening it failed the wake with "EBUSY". Try again every 5 s for a minute instead.
  if (logBusy(p.slug)) {
    const n = (busyTries.get(p.slug) || 0) + 1;
    if (n > 12) { busyTries.delete(p.slug); throw bad(`the team log is still in use by another program: data/logs/${p.slug}.log`); }
    busyTries.set(p.slug, n);
    setTimeout(() => { const q = load(p.slug); try { if (q && !runs.has(p.slug)) startTeam(q, true, first, sprint, true, false, true); } catch {} }, 5000).unref();
    return { ok: true, folder: p.path, queued: true };
  }
  busyTries.delete(p.slug);
  if (engine !== 'claude' && !require('./engines').engineExe(engine)) return codexMissing(p, engine);   // fails softly: never falls back to Claude
  launch(p, engine !== 'claude' ? '' : agentCommand(), first, sprint);
  return { ok: true, folder: p.path, running: true, ...(warn ? { warning: 'a lead is already working in a session: two leads now' } : {}) };
}
// Codex is not on this PC (AIG-704): a note in the log and one comment on the card in progress (else the newest card), no run.
function codexMissing(p, engine = 'codex') {
  const msg = tr('srv.engine.no' + engine);
  try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(logFile(p.slug), `=== ${new Date().toISOString()} ${msg} ===\n`); } catch {}
  try {
    const q = load(p.slug), cards = (q.cards || []).filter(c => c.status !== 'done').sort((a, b) => (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1) || (b.updated || '').localeCompare(a.updated || '')), c = cards[0];
    if (c && !(c.comments || []).slice(-1).some(m => m.text === msg)) { c.comments.push({ author: 'AI-gile', at: new Date().toISOString(), text: msg }); c.updated = new Date().toISOString(); save(q); }
  } catch {}
  return { ok: true, folder: p.path, engineMissing: engine };
}
// Unseen owner news for a project, the rule /updates uses: the owner's comments and cards since the team last looked,
// ignoring a bare "Accepted", plus the 🌙 watchman's "keep going" (AIG-277). Returns [{ c, items }] (AIG-272).
function ownerNews(p, since = p.teamSeenAt || '') {
  const out = [];
  for (const c of p.cards) {
    const items = c.comments.filter(m => (isRich(m.author) || m.wake) && m.at > since && !(m.verdict === 'accept' && m.text === '✅ Accepted' && !m.attachments)).map(m => ({ kind: m.poke ? 'poke' : 'comment', text: m.text, at: m.at, attachments: m.attachments }));
    if (isRich(c.createdBy) && c.created > since) items.unshift({ kind: 'new card', text: c.description || '', at: c.created, attachments: c.attachments });
    if (items.length) out.push({ c, items });
  }
  const lc = require('./leadchat').news(p.slug, since);   // AIG-872: the card-free Lead chat
  if (lc) out.push(lc);
  return out;
}
// Best-effort trigger for the owner's activity: never fails the request. Only when there is news the team hasn't seen
// (AIG-272: the LocoRadio lead was started 6 times for comments it had already read).
function nudge(slug) { try { const p = load(slug), news = p ? ownerNews(p) : []; if (news.length) require('./dispatch').wake(p, news, startTeam).catch(() => {}); } catch {} }   // AIG-364: dispatch.js decides who is told

function killTree(pid) {
  require('./platform').killTree(pid);   // taskkill /T on Windows; elsewhere the detached run's own process group
}
// Kill a stuck run and start a fresh one.
function restartTeam(p) {
  const run = runs.get(p.slug);
  if (!run) return startTeam(p, true, false, false, false, false, true);
  run.restart = true; run.again = false;
  killTree(run.pid);
  if (run.adopted || run.polled) ended(p.slug, run, 'killed');   // no exit event for a run a previous board started, or a hidden one
  return { ok: true, folder: p.path, running: true };
}

// ⛔ No Token Mode: end every background run, with no go-round-again.
function stopAll() { for (const [slug, run] of [...runs]) { run.again = false; run.restart = false; run.stopped = true; if (run.pid) killTree(run.pid); ended(slug, run, 'no tokens'); } }

// Only the end of the file is read (the 👁 Watch view asks every few seconds and a verbose log grows fast, AIG-154).
function logTail(slug, lines = 200) {
  try {
    const f = logFile(slug), size = fs.statSync(f).size, n = Math.min(size, 256 * 1024), b = Buffer.alloc(n), fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, b, 0, n, size - n); } finally { fs.closeSync(fd); }
    return b.toString('utf8').split(/\r?\n/).slice(n < size ? 1 : 0).slice(-lines - 1).join('\n').trim();
  } catch { return ''; }
}

/* ---------- swarm worker runs (AIG-901) ---------- */
// One run under key "<slug>#<card id>" in a worktree (lib/swarmworkers.js decides what and when). Same log, watch, hang
// watchdog, stop and token line as a team run. Returns the run.
function startWorker(key, exe, args, { cwd, engine, branch }) {
  fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
  fs.appendFileSync(logFile(key), `=== ${new Date().toISOString()} started (swarm worker${engine !== 'claude' ? ', ' + engine : ''}) on ${branch} ===\n`);
  fs.writeFileSync(rawFile(key), '');
  const env = { ...process.env, AIGILE_BACKGROUND: '1' }, codex = engine !== 'claude';
  const run = { pid: 0, startedAt: Date.now(), verbose: true, engine, cwd, branch, off: 0, again: false, restart: false };
  if (win) {
    run.polled = true; track(key, run);
    spawnHidden(exe, args, { cwd, env, out: rawFile(key), err: rawFile(key), nostdin: codex })
      .then(pid => { run.pid = pid; if (run.stopped) killTree(pid); note(key, run); }, e => { try { fs.appendFileSync(logFile(key), 'could not start: ' + e.message + '\n'); } catch {} ended(key, run, 'error'); });
    return run;
  }
  const raw = fs.openSync(rawFile(key), 'w');
  const child = spawnAgent(exe, args, { cwd, windowsHide: true, detached: true, stdio: ['ignore', raw, raw], env });
  fs.closeSync(raw); child.unref();
  run.pid = child.pid; track(key, run);
  child.on('error', e => { try { fs.appendFileSync(logFile(key), 'could not start: ' + e.message + '\n'); } catch {} ended(key, run, 'error'); });
  child.on('exit', code => ended(key, run, code));
  return run;
}
function stopWorker(key) {
  const run = runs.get(key); if (!run) return false;
  run.stopped = true; if (run.pid) killTree(run.pid);
  ended(key, run, 'stopped');
  return true;
}
const workerKeys = slug => [...runs.keys()].filter(k => k.startsWith(slug + '#'));

try { adopt(); } catch {}   // a new install has no data folder yet
try { require('./swarmworkers').start(); } catch {}   // 🐝 the swarm's worker tick (AIG-901)

module.exports = { presenceRev, pushMode, pushLine, pushArgs, leadActive, silent, HANG_MS, openWindow, heard, gone, presenceOf, heardFromFolder, startTeam, nudge, ownerNews, restartTeam, stopAll, killTree, logTail, recentRuns, agentCommand, WHERE, spawnAgent, spawnHidden, whenGone, readable, startWorker, stopWorker, workerKeys, workersOf };
