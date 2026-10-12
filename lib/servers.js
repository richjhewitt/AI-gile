// 🖥️ My servers (AIG-374): the owner names each server and says how he opens it: a shortcut/file path (a .lnk) or a command.
// Saved in aigile.local.json ("servers": [{ name, kind: 'path'|'cmd', value }]). A 🖥️ task gets an "Open <name>" button;
// the board server opens ONLY what is saved here, never a path or command that comes from card text.
// A command opens in a visible PowerShell window that stays open (-NoExit). AIGILE_OPEN_STUB=<file>: tests log the open there instead.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { localSettings, bad } = require('./store');

const win = process.platform === 'win32';
const clean = v => (Array.isArray(v) ? v : []).map(x => ({
  name: String((x && x.name) || '').trim().slice(0, 60),
  kind: x && x.kind === 'cmd' ? 'cmd' : 'path',
  value: String((x && x.value) || '').trim().replace(/^["']|["']$/g, '').slice(0, 500),
})).filter(x => x.name && x.value).slice(0, 20);
const list = () => clean(localSettings().servers);
// Used by setPrefs: validates what the page sends.
function check(v) {
  const out = clean(v);
  if (out.some(x => x.kind === 'path' && /["%`$]/.test(x.value))) throw bad('that path has characters I will not pass to a shell');
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

function open(name) {
  const s = effective().find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
  if (!s) throw bad('no such server in My servers: set it up in Setup', 404);
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

module.exports = { list, effective, check, shortcuts, open };
