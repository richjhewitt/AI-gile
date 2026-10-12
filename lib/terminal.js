// ⌨ The built-in terminal (AIG-471): one terminal per 🖥️ server task, connected with the owner's own ssh (ssh.exe and his
// keys or agent, like his Desktop shortcut). No password is stored: if ssh asks for one, he types it into the terminal.
// The pty: node-pty 1.1.0 (optionalDependencies in package.json). It installs with prebuilt binaries on Windows (ConPTY,
// no window), and ssh wants a real tty for its prompts and colours, which pipes with `ssh -tt` only half give. Without
// node-pty the board still starts: the terminal says it is unavailable and offers an Install button (npm install).
// The fence: only the board's own page on this computer can use it.
// - every route needs the per-start token, which GET /api/terminal/token hands only to the page (never to a CLI or hook
//   call), from the loopback address; server.js's guard adds Host, Origin and JSON on top;
// - the trial board and the pretend friend's board start with AIGILE_NO_TERMINAL (lib/trial.js, lib/pretend.js);
// - a friend's share or the relay is data only (lib/share.js): nothing they send reaches these routes;
// - what to connect to comes from Setup > My servers by name, never from card text.
// ▶ Run: the page sends the lines; the board types one at a time, each with an echo of its exit status and a random marker,
// and a non-zero status stops the block. The first run on each card needs { confirm: true }. Nothing runs without a click.
// Transcript: ANSI stripped, capped, in data/terminal/<slug>-<id>.log, for the lead (`aigile termlog`).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { DATA, ROOT, bad, load, findCard } = require('./store');
const servers = require('./servers');

const win = process.platform === 'win32';
const TOKEN = crypto.randomBytes(24).toString('hex');
const DIR = path.join(DATA, 'terminal');
const LOG_MAX = 256 * 1024, LOG_KEEP = 192 * 1024, REPLAY = 128 * 1024, MAX_OPEN = 8;
const off = () => /^(1|true|yes)$/i.test(process.env.AIGILE_NO_TERMINAL || '') || !!process.env.AIGILE_PRETEND;

let pty = null, installing = null;
const loadPty = () => { if (!pty) try { pty = require('node-pty'); } catch {} return pty; };
const state = () => off() ? { available: false, why: 'off' } : loadPty() ? { available: true } : { available: false, why: 'nopty', installing: installing && installing.state, installOut: installing && installing.out };

/* ---------- the fence ---------- */
const loopback = a => /^(127\.|::1$|::ffff:127\.)/.test(String(a || ''));
function asked(req) {
  if (off()) throw bad('the terminal is off on this board', 403);
  if (!loopback(req && req.socket && req.socket.remoteAddress)) throw bad('the terminal answers on this computer only', 403);
  if (req.headers['x-aigile-where']) throw bad('the terminal is the owner\'s, from the board page', 403);
}
function gate(req, tok) {
  asked(req);
  const a = Buffer.from(String(tok || '')), b = Buffer.from(TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw bad('wrong or missing terminal token: refresh the page', 403);
}
// The page asks for the token once; a page on another site can't read this answer (no CORS), and the CLI is refused.
function token(req) {
  asked(req);
  const site = req.headers['sec-fetch-site'];
  if (site && !['same-origin', 'none'].includes(site)) throw bad('the terminal is the owner\'s, from the board page', 403);
  return { token: TOKEN, ...state() };
}

/* ---------- the transcript ---------- */
const ESC = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[()][0-9A-Za-z]|[@-Z\\-_=>78])/g;
// Plain text: a cursor jump becomes a new line (ConPTY draws lines that way), escapes and other control characters go.
const plain = t => t.replace(/\x1b\[\d*(?:;\d*)?[Hf]/g, '\n').replace(ESC, '').replace(/\r+\n/g, '\n').replace(/\r/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/[ \t]+\n/g, '\n');
const logFile = (slug, id) => path.join(DIR, `${slug}-${id}.log`.replace(/[^\w.-]/g, '_'));
function strip(s, d) {
  let t = s.pend + d; s.pend = '';
  const e = t.lastIndexOf('\x1b');   // an escape split over two chunks waits for the rest
  if (e >= 0 && t.length - e < 256 && t.slice(e).replace(ESC, '').startsWith('\x1b')) { s.pend = t.slice(e); t = t.slice(0, e); }
  return plain(t);
}
function log(s, text) {
  s.logQ += text;
  if (!s.logT) s.logT = setTimeout(() => flush(s), 500);
}
function flush(s) {
  clearTimeout(s.logT); s.logT = null;
  if (!s.logQ) return;
  const f = logFile(s.slug, s.id), q = s.logQ.replace(/\n{3,}/g, '\n\n'); s.logQ = '';
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(f, q);
    if (fs.statSync(f).size > LOG_MAX) { const t = fs.readFileSync(f, 'utf8'), keep = t.slice(-LOG_KEEP); fs.writeFileSync(f, '[… older lines cut]\n' + keep.slice(keep.indexOf('\n') + 1)); }
  } catch {}
}
const note = (s, text) => log(s, `\n[AI-gile] ${text}\n`);
function termlog(slug, id) {
  const p = load(slug); if (!p) throw bad('no such project', 404);
  const c = findCard(p, id), f = logFile(p.slug, c.id), s = sessions.get(p.slug + '/' + c.id);
  if (s) flush(s);
  let text = '', at = null; try { text = fs.readFileSync(f, 'utf8'); at = fs.statSync(f).mtime.toISOString(); } catch {}
  return { card: c.id, text, at, open: !!(s && s.alive) };
}

/* ---------- sessions ---------- */
const sessions = new Map();   // slug/id -> { pty, alive, buf, clients, run, ... }
const confirmed = new Set();  // cards whose first run the owner confirmed (since the board started)
const send = (s, o) => { for (const res of s.clients) try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch {} };
// QA (AIGILE_TERM_LOCAL): a local shell instead of ssh, so a test never connects anywhere.
function spec(srv) {
  if (process.env.AIGILE_TERM_LOCAL) return win ? { file: 'cmd.exe', args: ['/d', '/q', '/v:on', '/k', 'prompt $G '], dialect: 'cmd', what: 'local shell' } : { file: '/bin/sh', args: ['-i'], dialect: 'sh', what: 'local shell' };
  const sys = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH', 'ssh.exe');
  return { file: win && fs.existsSync(sys) ? sys : 'ssh', args: [srv.target], dialect: 'sh', what: srv.target };
}
const size = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || d));
const info = s => ({ key: s.key, server: s.server, alive: s.alive, running: !!s.run, confirmed: confirmed.has(s.key) });
function sessionOf(slug, id) { const s = sessions.get(slug + '/' + id); if (!s) throw bad('no terminal open on this card', 404); return s; }
// On Windows node-pty's kill() forks a little helper; without windowsHide that would flash a console window.
function killPty(t) {
  const fork = cp.fork;
  if (win) cp.fork = (f, a, o) => fork(f, a, { windowsHide: true, ...(o || {}) });
  try { t.kill(); } catch {} finally { cp.fork = fork; }
}

function open(b) {
  const p = load(String(b.slug || '')); if (!p) throw bad('no such project', 404);
  const c = findCard(p, b.id);
  if (!c.server) throw bad('the terminal opens on 🖥️ server tasks only', 400);
  const srv = servers.terminals().find(x => x.name.toLowerCase() === String(b.name || '').trim().toLowerCase());
  if (!srv) throw bad('no server with an ssh address by that name in My servers: set it up in Setup', 404);
  const key = p.slug + '/' + c.id, old = sessions.get(key);
  if (old && old.alive && old.server === srv.name) return info(old);
  if (old) close(old);
  if (!loadPty()) throw bad('the terminal needs node-pty: press Install in the terminal panel, or run npm install in the AI-gile folder', 503);
  if ([...sessions.values()].filter(x => x.alive).length >= MAX_OPEN) throw bad('too many terminals open: close one first', 429);
  const sp = spec(srv);
  let t;
  try { t = pty.spawn(sp.file, sp.args, { name: 'xterm-256color', cols: size(b.cols, 20, 400, 100), rows: size(b.rows, 5, 200, 28), cwd: os.homedir(), env: process.env }); }
  catch (e) { throw bad('could not start ' + path.basename(sp.file) + ': ' + e.message, 500); }
  const s = { key, slug: p.slug, id: c.id, server: srv.name, dialect: sp.dialect, pty: t, alive: true, buf: '', clients: new Set(), run: null, pend: '', logQ: '', logT: null };
  sessions.set(key, s);
  log(s, `\n--- ${new Date().toLocaleString('sv')} · ${srv.name} (${sp.what}) ---\n`);
  t.onData(d => {
    s.buf = (s.buf + d).slice(-REPLAY);
    send(s, { o: d });
    const text = strip(s, d); log(s, text);
    if (s.run) { s.run.seen = (s.run.seen + text).slice(-8192); heard(s); }
  });
  t.onExit(({ exitCode }) => {
    s.alive = false;
    if (s.run) finish(s, { state: 'stopped', why: 'closed' });
    note(s, `the connection closed (exit ${exitCode})`); flush(s);
    send(s, { exit: exitCode });
  });
  return info(s);
}
function close(s) {
  if (s.alive) killPty(s.pty);
  s.alive = false; s.run = null; flush(s);
  send(s, { closed: true });
  for (const res of s.clients) try { res.end(); } catch {}
  s.clients.clear();
  sessions.delete(s.key);
}
// GET .../stream: Server-Sent Events. First what the screen had (so a pop-out or a refresh catches up), then live output.
function stream(s) {
  return (res, req) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.write('data: ' + JSON.stringify({ replay: s.buf, ...info(s), run: s.run && runInfo(s) }) + '\n\n');
    s.clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
    req.on('close', () => { clearInterval(ping); s.clients.delete(res); });
  };
}
function input(s, data) {
  if (!s.alive) throw bad('the terminal is not connected: press Reconnect', 409);
  s.pty.write(String(data || '').slice(0, 65536));
  return { ok: true };
}
function resize(s, b) { if (s.alive) try { s.pty.resize(size(b.cols, 20, 400, 100), size(b.rows, 5, 200, 28)); } catch {} return { ok: true }; }

/* ---------- ▶ run ---------- */
// The commands in a block: blank lines, comments and a leading "$ " prompt go; a line ending in \ (or ^, | , &&, ||) joins the next.
function prep(lines, dialect) {
  const raw = (Array.isArray(lines) ? lines.join('\n') : String(lines || '')).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').split('\n');
  const out = []; let cur = '';
  const comment = dialect === 'cmd' ? /^\s*(rem\b|::)/i : /^\s*#/;
  for (let l of raw) {
    l = l.replace(/\s+$/, ''); if (!cur) l = l.replace(/^\s*\$\s+/, '');
    if (!cur && (!l.trim() || comment.test(l))) continue;
    if (dialect !== 'cmd') l = noComment(l);
    if (l.endsWith(dialect === 'cmd' ? '^' : '\\')) { cur += l.slice(0, -1) + ' '; continue; }
    if (/(\||&&)$/.test(l)) { cur += l + ' '; continue; }
    out.push((cur + l).trim()); cur = '';
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean).slice(0, 200).map(l => l.slice(0, 4000));
}
// A trailing # comment would swallow the status echo: cut it (outside quotes, after a space).
function noComment(l) {
  let q = '';
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === q) q = ''; else if (ch === '\\' && q === '"') i++; continue; }
    if (ch === '\\') { i++; continue; }
    if (ch === "'" || ch === '"') q = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(l[i - 1]))) return l.slice(0, i).replace(/\s+$/, '');
  }
  return l;
}
// What is typed: the command, then an echo of its exit status with this run's marker. The typed text shows $? (or
// !errorlevel!), the output shows the number, so only the real status matches.
function typed(line, nonce, dialect) {
  if (dialect === 'cmd') return `cd . & ${line} & echo __AIG_!errorlevel!_${nonce}__`;   // cd . sets errorlevel to 0 first: echo and friends leave it as it was
  return line + (/(^|[^&])&$|;$/.test(line) ? ' ' : '; ') + `echo "__AIG_$?_${nonce}__"`;
}
const runInfo = s => ({ i: s.run.i, n: s.run.lines.length, line: s.run.lines[s.run.i], block: s.run.block, state: 'running' });
function run(s, b) {
  if (!s.alive) throw bad('the terminal is not connected: press Reconnect', 409);
  if (s.run) throw bad('still running the last command: wait for it, or press Stop', 409);
  const lines = prep(b.lines, s.dialect);
  if (!lines.length) throw bad('no command in that block');
  if (!confirmed.has(s.key) && b.confirm !== true) return { needConfirm: true, lines };
  confirmed.add(s.key);
  s.run = { lines, i: -1, seen: '', nonce: '', block: String(b.block || '').slice(0, 80), at: b.at | 0 };
  note(s, lines.length > 1 ? `▶ running ${lines.length} commands, stopping at the first that fails` : '▶ running 1 command');
  next(s);
  return { ok: true, lines };
}
function next(s) {
  const r = s.run; r.i++;
  if (r.i >= r.lines.length) return finish(s, { state: 'done' });
  r.nonce = crypto.randomBytes(4).toString('hex'); r.seen = '';
  s.pty.write(typed(r.lines[r.i], r.nonce, s.dialect) + '\r');
  send(s, { run: runInfo(s) });
}
function heard(s) {
  const r = s.run, m = r.seen.match(new RegExp('__AIG_(-?\\d+)_' + r.nonce + '__'));
  if (!m) return;
  const code = Number(m[1]);
  send(s, { run: { ...runInfo(s), state: code ? 'fail' : 'ok', code } });
  if (code) return finish(s, { state: 'failed', code });
  next(s);
}
function finish(s, out) {
  const r = s.run; s.run = null;
  note(s, out.state === 'done' ? `✓ done: ${r.lines.length} command${r.lines.length > 1 ? 's' : ''} ran without an error`
    : out.state === 'failed' ? `✗ stopped: "${r.lines[r.i]}" exited with ${out.code}${r.lines.length - r.i > 1 ? `, ${r.lines.length - r.i - 1} not run` : ''}`
    : `■ stopped${out.why === 'closed' ? ': the connection closed' : ''} at "${r.lines[r.i]}"`);
  send(s, { run: { i: r.i, n: r.lines.length, block: r.block, at: r.at, line: r.lines[r.i], ...out, state: out.state } });
}
function stop(s) { if (s.run) finish(s, { state: 'stopped' }); return { ok: true }; }

/* ---------- install node-pty (the Install button) ---------- */
function install() {
  if (loadPty()) return state();
  if (installing && installing.state === 'running') return state();
  installing = { state: 'running', out: '' };
  // A fixed command, no input from the page. shell: npm is npm.cmd on Windows.
  const child = cp.spawn('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const keep = d => { installing.out = (installing.out + d).slice(-2000); };
  child.stdout.on('data', keep); child.stderr.on('data', keep);
  child.on('error', e => { installing.state = 'failed'; keep(e.message); });
  child.on('close', code => { installing.state = code === 0 && loadPty() ? 'done' : 'failed'; });
  return state();
}

process.on('exit', () => { for (const s of sessions.values()) { if (s.alive) killPty(s.pty); flush(s); } });

module.exports = { off, token, gate, state, open, close, stream, input, resize, run, stop, termlog, install, sessionOf, prep, plain };
