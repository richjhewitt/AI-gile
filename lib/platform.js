// One place for "what do I run on this computer?" (AIG-408). Windows keeps its own commands exactly; Linux and macOS get
// their twins. Every function takes the platform last (default: this computer) and the ones that would run something
// have a *Spec twin that only describes the command, so the QA `platform` area can check Linux from a Windows machine.
const { spawn, spawnSync } = require('child_process');

const cur = () => process.platform;
const isWin = (p = cur()) => p === 'win32';
const isMac = (p = cur()) => p === 'darwin';

// Kill a process and everything it started. Windows: taskkill /T. Elsewhere: the whole process group (children started
// with `detached` lead their own group), else just the process.
function killSpec(pid, p = cur()) {
  return isWin(p) ? { cmd: 'taskkill', args: ['/pid', String(pid), '/T', '/F'] } : { signal: 'SIGKILL', group: -pid, pid };
}
function killTree(pid, p = cur()) {
  const k = killSpec(pid, p);
  if (k.cmd) return void spawnSync(k.cmd, k.args, { windowsHide: true });
  try { process.kill(k.group, k.signal); } catch { try { process.kill(k.pid, k.signal); } catch {} }
}
// spawn options that make a child killable as a tree: its own process group where there are no job objects.
const groupOpts = (p = cur()) => isWin(p) ? {} : { detached: true };

// Open a file or folder with the system's own app (explorer / start / open / xdg-open).
function openSpec(target, { folder = false } = {}, p = cur()) {
  if (isWin(p)) return folder
    ? { cmd: 'explorer', args: [target.replace(/\//g, '\\')], opts: { detached: true, stdio: 'ignore', windowsHide: false } }   // Explorer wants Windows slashes (AIG-398)
    : { cmd: 'cmd', args: ['/c', 'start', '""', `"${target}"`], opts: { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true } };
  return { cmd: isMac(p) ? 'open' : 'xdg-open', args: [target], opts: { detached: true, stdio: 'ignore' } };
}
const openPath = (target, o, p) => { const s = openSpec(target, o, p); spawn(s.cmd, s.args, s.opts).unref(); };

// Is a program on the PATH?
const has = (name, p = cur()) => { try { return spawnSync(isWin(p) ? 'where' : 'which', [name], { windowsHide: true, stdio: 'ignore' }).status === 0; } catch { return false; } };

const shq = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
// A terminal window that stays open and runs `shLine` (a /bin/sh line). First terminal found wins; null when none.
const TERMINALS = [
  ['x-terminal-emulator', (t, line) => ['-T', t, '-e', 'sh', '-c', line]],
  ['gnome-terminal', (t, line) => ['--title=' + t, '--', 'sh', '-c', line]],
  ['konsole', (t, line) => ['-p', 'tabtitle=' + t, '-e', 'sh', '-c', line]],
  ['xterm', (t, line) => ['-T', t, '-e', 'sh', '-c', line]],
];
const keepOpen = line => line + '; exec "${SHELL:-sh}"';
function terminalSpec(title, shLine, dir, p = cur(), found = n => has(n, p)) {
  if (isMac(p)) return { cmd: 'osascript', args: ['-e', `tell application "Terminal" to do script ${JSON.stringify(`cd ${shq(dir)} && ${shLine}`)}`], opts: { detached: true, stdio: 'ignore', cwd: dir } };
  const t = TERMINALS.find(x => found(x[0]));
  if (!t) return null;
  return { cmd: t[0], args: t[1](title, keepOpen(shLine)), opts: { detached: true, stdio: 'ignore', cwd: dir } };
}

// Fake agent program for tests and the pretend team: a .bat on Windows, a .sh elsewhere.
// kind 'log': write the folder, then the arguments, to file `arg` and wait ~3 s. kind 'run': run command line `arg`.
const stubExt = (p = cur()) => isWin(p) ? '.bat' : '.sh';
function stubBody(kind, arg, p = cur()) {
  if (kind === 'log') return isWin(p)
    ? `@echo off\r\ncd > "${arg}"\r\necho %* >> "${arg}"\r\nping -n 4 127.0.0.1 >nul\r\nexit\r\n`
    : `#!/bin/sh\npwd > "${arg}"\necho "$@" >> "${arg}"\nsleep 3\nexit 0\n`;
  if (kind === 'run') return isWin(p) ? `@echo off\r\n${arg}\r\n` : `#!/bin/sh\nexec ${arg}\n`;
  return isWin(p) ? '@echo off\r\n' : '#!/bin/sh\nexit 0\n';
}
function writeStub(fs, file, kind, arg, p = cur()) { fs.writeFileSync(file, stubBody(kind, arg, p)); if (!isWin(p)) fs.chmodSync(file, 0o755); return file; }

module.exports = { isWin, isMac, killSpec, killTree, groupOpts, openSpec, openPath, has, terminalSpec, keepOpen, shq, stubExt, stubBody, writeStub };
