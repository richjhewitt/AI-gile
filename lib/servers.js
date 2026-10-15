// 🖥️ My servers (AIG-374): the owner names each server and says how he opens it: a shortcut/file path (a .lnk) or a command.
// Saved in aigile.local.json ("servers": [{ name, kind: 'path'|'cmd'|'ssh', value }]). A 🖥️ task gets an "Open <name>" button;
// the board server opens ONLY what is saved here, never a path or command that comes from card text.
// A command opens in a visible PowerShell window that stays open (-NoExit). AIGILE_OPEN_STUB=<file>: tests log the open there instead.
// ssh (AIG-471): the value is an ssh address (rich@92.113.144.194); its tasks also get ⌨ Terminal, the board's own terminal
// (lib/terminal.js). A command that is just `ssh <address>` (like the Desktop shortcut's) counts as one too.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { localSettings, bad } = require('./store');

const win = process.platform === 'win32';
// AIG-677: who besides the owner gets in: { name: 'run' | 'admin' }. No entry (or none) = owner only. Old entries have no field.
const accessOf = a => {
  const o = {};
  if (a && typeof a === 'object') for (const [k, v] of Object.entries(a)) if ((v === 'run' || v === 'admin') && String(k).trim()) o[String(k).trim().slice(0, 60)] = v;
  return Object.keys(o).length ? { access: o } : {};
};
// AIG-701: may agents use sudo over ssh on this server? sudo: true (any agent) | [names] (only these) | absent = off. Old entries have no field.
const sudoField = a => {
  if (a === true) return { sudo: true };
  const n = Array.isArray(a) ? a.map(x => String(x || '').trim().slice(0, 60)).filter(Boolean).slice(0, 30) : [];
  return n.length ? { sudo: n } : {};
};
const lcn = n => String(n || '').trim().toLowerCase();
function sudoOk(srv, name) {
  const a = srv && srv.sudo;
  if (a === true) return true;
  return Array.isArray(a) && !!lcn(name) && a.some(x => lcn(x) === lcn(name));
}
// The server line for a brief: per server, sudo allowed or not (for this agent, when the name is known).
// AIG-1023: srv.sudoPw (from shown()) says a sudo password is saved, so the agent runs the step itself with aigile sudo.
function sudoLine(srv, owner, name) {
  const ok = sudoOk(srv, name), list = Array.isArray(srv.sudo) ? srv.sudo : null;
  if (ok) return `${srv.name}: sudo: allowed` + (srv.kind !== 'ssh' ? '' : srv.sudoPw ? `, sudo password saved: run it yourself with aigile sudo <proj> "${srv.name}" "command" --as NAME`
    : `, no sudo password saved (aigile sudo <proj> "${srv.name}" "command" works only where sudo needs none)`);
  return `${srv.name}: sudo: not allowed${list && !name ? ` (only ${list.join(', ')})` : ''}: hand ${owner} a --server task (aigile task ... --server) instead`;
}
// AIG-773: an ssh server may also carry port, key (a private key file), folder (where a terminal starts). All optional, old entries have none.
const USER = /^\w[\w.-]{0,63}$/;
const sshExtras = x => {
  const o = {}, port = Math.round(Number(x && x.port));
  if (port >= 1 && port <= 65535) o.port = port;
  const key = String((x && x.key) || '').trim().replace(/^["']|["']$/g, '').slice(0, 300);
  if (key && !/["'%`$\x00-\x1f]/.test(key) && !key.startsWith('-')) o.key = key;
  const folder = String((x && x.folder) || '').trim().slice(0, 300);
  if (folder && !/[\x00-\x1f]/.test(folder)) o.folder = folder;
  return o;
};
const clean = v => (Array.isArray(v) ? v : []).map(x => ({
  name: String((x && x.name) || '').trim().slice(0, 60),
  kind: x && (x.kind === 'cmd' || x.kind === 'ssh') ? x.kind : 'path',
  value: String((x && x.value) || '').trim().replace(/^["']|["']$/g, '').slice(0, 500),
  ...accessOf(x && x.access),
  ...sudoField(x && x.sudo),
  ...(x && x.kind === 'ssh' ? sshExtras(x) : {}),
})).filter(x => x.name && x.value).slice(0, 20);
const list = () => clean(localSettings().servers);
// Used by setPrefs: validates what the page sends.
function check(v) {
  const out = clean(v);
  if (out.some(x => x.kind === 'path' && /["%`$]/.test(x.value))) throw bad('that path has characters I will not pass to a shell');
  if (out.some(x => x.kind === 'ssh' && !SSH.test(x.value))) throw bad('that is not an ssh address: use user@host, like rich@92.113.144.194');
  return out;
}
// user@host, host, or ssh://user@host:port. Never starts with "-", so ssh can't read it as an option.
const SSH = /^(?:ssh:\/\/)?(?:\w[\w.-]*@)?[A-Za-z0-9][\w.-]*$|^ssh:\/\/(?:\w[\w.-]*@)?[A-Za-z0-9][\w.-]*:\d{1,5}$/;
function sshTarget(x) {
  if (x.kind === 'ssh') return SSH.test(x.value) ? x.value : '';
  const m = x.kind === 'cmd' && x.value.match(/^(?:powershell(?:\.exe)?\s+(?:-\w+\s+)*-Command\s+)?["']?ssh(?:\.exe)?\s+(\S+?)["']?$/i);
  return m && SSH.test(m[1]) ? m[1] : '';
}
// The servers the terminal can connect to: { name, target }.
const terminals = () => effective().map(x => ({ name: x.name, target: sshTarget(x), ...(x.kind === 'ssh' ? sshExtras(x) : {}) })).filter(x => x.target);
// AIG-774: a project's own choices on top of its server: { user, folder } (strings, checked here again). The user swaps the part before the @.
function projectSrv(v) {
  const o = {}, u = String((v && v.user) || '').trim(), f = String((v && v.folder) || '').trim().slice(0, 300);
  if (u && USER.test(u)) o.user = u;
  if (f && !/[\x00-\x1f]/.test(f)) o.folder = f;
  return o;
}
function withOverrides(srv, ov) {
  const o = projectSrv(ov), out = { ...srv };
  if (o.user) out.target = out.target.replace(/^(ssh:\/\/)?(?:[^@/]+@)?/, (_, p) => (p || '') + o.user + '@');
  if (o.folder) out.folder = o.folder;
  return out;
}

// .lnk files on the Desktop with "server" in the name. Only listed, never opened.
const desktop = () => process.env.AIGILE_DESKTOP || path.join(os.homedir(), 'Desktop');
function shortcuts() {
  const dir = desktop();
  try { return fs.readdirSync(dir).filter(f => /\.lnk$/i.test(f) && /server/i.test(f)).map(f => ({ name: f.replace(/\.lnk$/i, ''), path: path.join(dir, f).replace(/\\/g, '/') })); } catch { return []; }
}

// Nothing saved in Setup: one Desktop server shortcut is used as it is (AIG-469), so the Open button works with no setup.
function effective() {
  const l = list(); if (l.length) return l;
  const f = shortcuts(); return f.length === 1 ? [{ name: f[0].name, kind: 'path', value: f[0].path }] : [];
}

/* ---------- sudo password (AIG-1023) ---------- */
// One optional sudo password per ssh server, kept encrypted like a mailbox password (secrets.keep 'server:<name>:sudo'): never in
// aigile.local.json, a GET answer, the page or a log. The page only learns sudoPw: true. `aigile sudo` gets it as a one-use grant
// file (secrets.grantFile, the CLI only) and writes it to ssh's stdin, never on a command line.
const S = () => require('./secrets');
const pwKey = n => 'server:' + lcn(n) + ':sudo';
const hasSudoPw = n => { try { return S().hasKept(pwKey(n)); } catch { return false; } };
const shown = () => list().map(x => x.kind === 'ssh' && hasSudoPw(x.name) ? { ...x, sudoPw: true } : x);
function setSudoPw(name, value) {
  const s = list().find(x => x.kind === 'ssh' && lcn(x.name) === lcn(name));
  if (!s) throw bad('no such ssh server in My servers', 404);
  const v = value == null ? '' : String(value);
  if (/[\r\n\0]/.test(v)) throw bad('a sudo password is one line');
  if (v.length > 1024) throw bad('that is too long for a password');
  S().keep(pwKey(s.name), v || null);
  return { set: hasSudoPw(s.name) };
}
// After Setup saves: a password whose ssh server is gone (removed, renamed, no longer ssh) is deleted too.
function tidySudoPw() {
  try {
    const live = new Set(list().filter(x => x.kind === 'ssh').map(x => pwKey(x.name)));
    for (const k of S().keptKeys()) if (/^server:.*:sudo$/.test(k) && !live.has(k)) S().keep(k, null);
  } catch {}
}
// POST /api/servers/sudo-grant, aigile sudo only: is this agent allowed, where to ssh, and the password as a one-use file (or none).
function sudoGrant(req, b) {
  S().cliOnly(req);
  const s = effective().find(x => lcn(x.name) === lcn(b && b.name)), t = s && terminals().find(x => x.name === s.name);
  if (!t) throw bad('no such ssh server in My servers', 404);
  const by = String((b && b.by) || '').trim().slice(0, 60);
  if (!sudoOk(s, by)) throw bad(`sudo is not allowed for ${by || 'you'} on ${s.name}: hand the owner a --server task instead (aigile task ... --server)`, 403);
  const pw = s.kind === 'ssh' ? S().kept(pwKey(s.name)) : null;
  return { name: s.name, target: t.target, port: t.port || null, key: t.key || null, file: pw ? S().grantFile(pw) : null };
}

function open(name) {
  let s = effective().find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
  if (!s) throw bad('no such server in My servers: set it up in Setup', 404);
  if (s.kind === 'ssh') s = { ...s, kind: 'cmd', value: 'ssh ' + s.value };   // Open: a PowerShell window with ssh, like the Desktop shortcut
  if (process.env.AIGILE_OPEN_STUB) { fs.appendFileSync(process.env.AIGILE_OPEN_STUB, JSON.stringify({ kind: s.kind, value: s.value }) + '\n'); return { ok: true, name: s.name }; }
  const quiet = { detached: true, stdio: 'ignore' };
  if (s.kind === 'path') {
    if (!fs.existsSync(s.value)) throw bad('file not found: ' + s.value, 404);
    require('./platform').openPath(s.value);
  } else if (win) {
    const q = `'${s.value.replace(/'/g, "''")}'`;
    spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process powershell.exe -ArgumentList '-NoExit','-Command',${q}`], { ...quiet, windowsHide: true }).unref();
  } else {
    // Linux / macOS (AIG-408): a terminal window that stays open, like the PowerShell one; no terminal found: run it quietly.
    const t = require('./platform').terminalSpec(s.name, s.value, os.homedir());
    if (t) spawn(t.cmd, t.args, t.opts).unref(); else spawn('sh', ['-c', s.value], quiet).unref();
  }
  return { ok: true, name: s.name };
}

module.exports = { shown, setSudoPw, tidySudoPw, sudoGrant, hasSudoPw, projectSrv, withOverrides, USER, sudoOk, sudoLine, list, effective, check, shortcuts, open, terminals, SSH };
