// 🎮 Discord activity (AIG-642): Discord shows "Using AI-gile" on your profile (Rich Presence), through the Discord app on this
// PC: its local pipe (discord-ipc-0..9), no bot, no token. Needs a Discord application ID (free, made once at
// discord.com/developers/applications). Optional: the 🌍 Public project open on the board; Private and Personal never go out.
// Settings in data/presence.conf: { on, clientId, project }. The page tells us which project is open (POST /api/presence).
// Tests: AIGILE_PRESENCE_STUB = a file path; the activity that would go to Discord is written there instead.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { DATA, load } = require('./store');

const FILE = () => path.join(DATA, 'presence.conf');
const conf = () => { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')) || {}; } catch { return {}; } };
let sock = null, connecting = false, ready = false, open = '', since = Math.floor(Date.now() / 1000), last = '', retry = null, err = '';

const pipe = n => process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${n}`
  : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', `discord-ipc-${n}`);
function frame(op, body) {
  const j = Buffer.from(JSON.stringify(body)), h = Buffer.alloc(8);
  h.writeInt32LE(op, 0); h.writeInt32LE(j.length, 4); return Buffer.concat([h, j]);
}
// What Discord should show now, or null for nothing.
function activity() {
  const c = conf(); if (!c.on || !c.clientId) return null;
  const a = { details: 'Using AI-gile', timestamps: { start: since } };
  if (c.project && open) { let p = null; try { p = load(open); } catch {} if (p && p.public && !p.private && !p.personal) a.state = `Working on ${p.publicName || p.name || open}`; }
  return a;
}
function drop(why) { if (sock) { sock.removeAllListeners(); sock.destroy(); } sock = null; ready = false; last = ''; if (why) err = why; later(); }
function later() { if (retry || !conf().on) return; retry = setTimeout(() => { retry = null; sync(); }, 60e3); retry.unref(); }
function connect(n = 0) {
  const id = conf().clientId;
  if (n > 9) { connecting = false; err = 'discord'; return later(); }
  connecting = true;
  const s = net.createConnection(pipe(n));
  s.once('error', () => { s.destroy(); if (sock === s) sock = null; connect(n + 1); });
  s.once('connect', () => {
    sock = s; connecting = false; s.removeAllListeners('error'); s.on('error', () => drop('discord')); s.on('close', () => drop('discord'));
    let buf = Buffer.alloc(0);
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8 && buf.length >= 8 + buf.readInt32LE(4)) {
        const op = buf.readInt32LE(0), len = buf.readInt32LE(4); let m = {}; try { m = JSON.parse(buf.slice(8, 8 + len)); } catch {}
        buf = buf.slice(8 + len);
        if (op === 2) return drop(m.code === 4000 || /client.?id/i.test(m.message || '') ? 'clientId' : 'discord');   // closed: usually a wrong ID
        if (m.evt === 'READY') { ready = true; err = ''; push(); }
        else if (m.evt === 'ERROR') err = (m.data && m.data.message) || 'discord';
      }
    });
    s.write(frame(0, { v: 1, client_id: String(id) }));
  });
}
function push() {
  const a = activity(), key = JSON.stringify(a);
  if (process.env.AIGILE_PRESENCE_STUB) { fs.writeFileSync(process.env.AIGILE_PRESENCE_STUB, key); last = key; return; }
  if (!ready || !sock || key === last) return;
  last = key; sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: a }, nonce: String(Date.now()) }));
}
// Bring the connection in line with the settings, then send the activity if it changed.
function sync() {
  const c = conf();
  if (process.env.AIGILE_PRESENCE_STUB) return push();
  if (!c.on || !c.clientId) { if (sock) { push(); const s = sock; sock = null; ready = false; last = ''; s.removeAllListeners(); s.on('error', () => {}); s.end(); } err = ''; return; }
  if (!sock) return connecting ? undefined : connect();
  push();
}
// body: { on?, clientId?, project? }; only what is sent changes.
function save(b) {
  const c = conf(), out = { on: 'on' in b ? !!b.on : !!c.on, clientId: 'clientId' in b ? String(b.clientId || '').replace(/\D/g, '').slice(0, 24) : (c.clientId || ''), project: 'project' in b ? !!b.project : !!c.project };
  const changedId = out.clientId !== (c.clientId || '');
  fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(out));
  if (changedId && sock) drop();
  sync(); return status();
}
function setOpen(slug) { open = typeof slug === 'string' ? slug.slice(0, 80) : ''; sync(); return { ok: true }; }
function status() { const c = conf(); return { on: !!c.on, clientId: c.clientId || '', project: !!c.project, connected: ready, error: c.on ? err : '' }; }
function start() { sync(); }

module.exports = { start, status, save, setOpen, activity };
