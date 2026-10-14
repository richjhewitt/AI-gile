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
const clean = v => (Array.isArray(v) ? v : []).map(x => ({
  name: String((x && x.name) || '').trim().slice(0, 60),
  kind: x && (x.kind === 'cmd' || x.kind === 'ssh') ? x.kind : 'path',
  value: String((x && x.value) || '').trim().replace(/^["']|["']$/g, '').slice(0, 500),
  ...accessOf(x && x.access),
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
const terminals = () => effective().map(x => ({ name: x.name, target: sshTarget(x) })).filter(x => x.target);

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

module.exports = { list, effective, check, shortcuts, open, terminals, SSH };
