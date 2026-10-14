// 🔌 The phone tunnel (AIG-1008): the board reaches the owner's own server, which can then show this board on a public name
// (https://test.aigile.lol) for his phone. aigile.local.json `phone.tunnel = { server, host, port }`: server is a saved ssh server
// in My servers, host the name the phone opens, port the server-side loopback port (default 14321). While it is set the board keeps
//   ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -R 127.0.0.1:<port>:127.0.0.1:<board port> <server>
// running (restart with a 5 s .. 5 min back-off) and stops it when the board exits. The tunnel host is also a `phone.hosts` entry,
// so server.js guardPhone treats it like any phone host: device cookie or Bearer, Origin, deny list. Nothing is loosened here.
// AIGILE_SSH_STUB=<node script> stands in for ssh in tests (never a real connection); AIGILE_TUNNEL_UP_MS: how long it must stay alive to count as up.
const { spawn } = require('child_process');
const { localSettings, bad } = require('./store');

const DEFAULT_PORT = 14321;
let boardPort = 0, child = null, timer = null, upTimer = null, wait = 5000, startedAt = 0, stopped = true;
const st = { state: 'off', error: '', since: null };   // off | starting | up | down

const cfg = () => {
  const t = (localSettings().phone || {}).tunnel;
  if (!t || typeof t !== 'object' || !t.server || !t.host) return null;
  const port = Math.round(Number(t.port));
  return { server: String(t.server), host: String(t.host), port: port >= 1024 && port <= 65535 ? port : DEFAULT_PORT };
};
const hostOfTunnel = () => { const c = cfg(); return c ? c.host : ''; };

// The ssh arguments for this server (its saved address, port and key file); null when the server is gone or not ssh.
function argsFor(c, bp) {
  const srv = require('./servers').terminals().find(x => x.name.toLowerCase() === c.server.toLowerCase());
  if (!srv) return null;
  return ['-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30',
    '-R', `127.0.0.1:${c.port}:127.0.0.1:${bp}`, ...(srv.port ? ['-p', String(srv.port)] : []), ...(srv.key ? ['-i', srv.key] : []), '--', srv.target];
}

function clear() { clearTimeout(timer); clearTimeout(upTimer); timer = upTimer = null; }
function kill() { const c = child; child = null; if (c) { c.removeAllListeners('close'); c.removeAllListeners('error'); try { c.kill(); } catch {} } }

function launch() {
  clear(); if (stopped) return;
  const c = cfg();
  if (!c) { st.state = 'off'; st.error = ''; return; }
  const args = argsFor(c, boardPort);
  if (!args) { st.state = 'down'; st.error = `"${c.server}" is not an ssh server in My servers`; timer = setTimeout(launch, 30e3); return; }
  st.state = 'starting'; st.since = new Date().toISOString(); startedAt = Date.now();
  const stub = process.env.AIGILE_SSH_STUB;
  let ch;
  try { ch = stub ? spawn(process.execPath, [stub, ...args], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }) : spawn('ssh', args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }); }
  catch (e) { st.state = 'down'; st.error = 'could not start ssh: ' + e.message; timer = setTimeout(launch, wait); return; }
  child = ch;
  ch.stdin.on('error', () => {});
  ch.stderr.setEncoding('utf8');
  ch.stderr.on('data', d => { const l = String(d).split(/\r?\n/).map(x => x.trim()).filter(Boolean).pop(); if (l) st.error = l.slice(0, 300); });
  const gone = msg => {
    if (child !== ch) return; child = null; clear();
    if (msg) st.error = msg;
    wait = Date.now() - startedAt > 60e3 ? 5000 : Math.min(wait * 2, 300e3);
    st.state = 'down'; st.since = new Date().toISOString();
    timer = setTimeout(launch, wait);
  };
  ch.on('error', e => gone('could not start ssh: ' + e.message));
  ch.on('close', code => gone(st.error || `ssh ended (${code})`));
  upTimer = setTimeout(() => { if (child === ch) { st.state = 'up'; st.error = ''; st.since = new Date().toISOString(); wait = 5000; } }, Number(process.env.AIGILE_TUNNEL_UP_MS) || 3000);
}

// Called by server.js once the board listens, and again when Setup saves the tunnel.
function start(port) {
  if (port) boardPort = port;
  stopped = false; kill(); wait = 5000; launch();
}
function stop() { stopped = true; clear(); kill(); st.state = 'off'; }
process.on('exit', () => { stopped = true; kill(); });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stopped = true; kill(); if (process.listenerCount(sig) === 1) process.exit(0); });   // Ctrl+C: ssh goes too

const status = () => { const c = cfg(); return c ? { ...c, state: st.state, error: st.error, since: st.since } : null; };

// Setup > Phone > Over my server: server '' removes the tunnel (its host stays a phone host with its paired phones).
function save(b, cleanHost) {
  if (!b || !String(b.server || '').trim()) return null;
  const srv = require('./servers').terminals().find(x => x.name.toLowerCase() === String(b.server).trim().toLowerCase());
  if (!srv) throw bad('pick an ssh server saved in My servers', 400);
  const host = cleanHost(b.host);
  const raw = b.port === undefined || b.port === '' || b.port === null ? DEFAULT_PORT : Math.round(Number(b.port));
  if (!(raw >= 1024 && raw <= 65535)) throw bad('the server port is a number from 1024 to 65535', 400);
  return { server: srv.name, host, port: raw };
}

module.exports = { start, stop, status, cfg, hostOfTunnel, save, argsFor, DEFAULT_PORT };
