// QA area: platform (AIG-408), lib/platform.js with a faked platform: what would run on Linux / macOS, and that Windows is unchanged.
// Nothing is executed: the *Spec functions only describe the command.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { check, tmp, def } from '../lib.mjs';

const P = createRequire(import.meta.url)('../../../lib/platform.js');

def('platform', 'Linux / macOS twins of the Windows-only commands (kill, open, terminal, agent stub), checked with a faked platform and nothing run (AIG-408)', async () => {
  // kill a tree
  const kw = P.killSpec(123, 'win32'), kl = P.killSpec(123, 'linux');
  check('Windows kills with taskkill /T /F', kw.cmd === 'taskkill' && kw.args.join(' ') === '/pid 123 /T /F', kw);
  check('Linux kills the process group (-pid), SIGKILL, falling back to the pid', kl.group === -123 && kl.pid === 123 && kl.signal === 'SIGKILL' && !kl.cmd, kl);
  check('Linux runs get their own process group; Windows spawn options unchanged', P.groupOpts('linux').detached === true && Object.keys(P.groupOpts('win32')).length === 0);

  // open a file / folder
  const ow = P.openSpec('C:/a/b.txt', {}, 'win32'), fw = P.openSpec('C:/a/b', { folder: true }, 'win32');
  check('Windows file: cmd /c start "" "path", as before', ow.cmd === 'cmd' && ow.args.join('|') === '/c|start|""|"C:/a/b.txt"' && ow.opts.windowsVerbatimArguments === true && ow.opts.windowsHide === true, ow);
  check('Windows folder: explorer with backslashes, window not hidden', fw.cmd === 'explorer' && fw.args[0] === 'C:\\a\\b' && fw.opts.windowsHide === false, fw);
  const ol = P.openSpec('/home/x/a b.txt', {}, 'linux'), fl = P.openSpec('/home/x', { folder: true }, 'linux'), om = P.openSpec('/x', {}, 'darwin');
  check('Linux file and folder: xdg-open <path>, detached, no output', ol.cmd === 'xdg-open' && ol.args[0] === '/home/x/a b.txt' && fl.cmd === 'xdg-open' && ol.opts.detached && ol.opts.stdio === 'ignore', [ol, fl]);
  check('macOS: open <path>', om.cmd === 'open' && om.args[0] === '/x');

  // terminal window: first terminal found wins
  const only = name => n => n === name;
  const t1 = P.terminalSpec('AI-gile: Alpha', "'claude' --continue 'hi'", '/proj', 'linux', () => true);
  check('Linux terminal: x-terminal-emulator first, runs the line then keeps a shell open', t1.cmd === 'x-terminal-emulator' && t1.args.slice(0, 5).join(' ') === '-T AI-gile: Alpha -e sh -c' && /^'claude' --continue 'hi'; exec "\$\{SHELL:-sh\}"$/.test(t1.args[5]) && t1.opts.cwd === '/proj' && t1.opts.detached, t1);
  const t2 = P.terminalSpec('T', 'ls', '/p', 'linux', only('gnome-terminal')), t3 = P.terminalSpec('T', 'ls', '/p', 'linux', only('konsole')), t4 = P.terminalSpec('T', 'ls', '/p', 'linux', only('xterm'));
  check('then gnome-terminal, konsole, xterm', t2.cmd === 'gnome-terminal' && t2.args[1] === '--' && t3.cmd === 'konsole' && t4.cmd === 'xterm', [t2, t3, t4]);
  check('no terminal found: null (the board says so)', P.terminalSpec('T', 'ls', '/p', 'linux', () => false) === null);
  const tm = P.terminalSpec('T', 'ls', "/it's", 'darwin');
  check('macOS terminal: Terminal.app through osascript, folder quoted', tm.cmd === 'osascript' && /do script/.test(tm.args[1]) && tm.args[1].includes("it'\\\\''s"), tm);
  check('shell quoting keeps a quote safe', P.shq("a'b") === "'a'\\''b'");

  // agent stub (.bat / .sh)
  check('stub extension: .bat on Windows, .sh elsewhere', P.stubExt('win32') === '.bat' && P.stubExt('linux') === '.sh' && P.stubExt('darwin') === '.sh');
  check('Windows stub is byte-for-byte the old agent-stub.bat', P.stubBody('log', 'C:\\o.txt', 'win32') === '@echo off\r\ncd > "C:\\o.txt"\r\necho %* >> "C:\\o.txt"\r\nping -n 4 127.0.0.1 >nul\r\nexit\r\n');
  check('Windows pretend-team stub is unchanged', P.stubBody('run', '"node" "x.js"', 'win32') === '@echo off\r\n"node" "x.js"\r\n');
  const sl = P.stubBody('log', '/tmp/o.txt', 'linux');
  check('Linux stub: shebang, writes the folder and the arguments, waits, exits', /^#!\/bin\/sh\n/.test(sl) && /pwd > "\/tmp\/o.txt"/.test(sl) && /echo "\$@" >> "\/tmp\/o.txt"/.test(sl) && /sleep 3/.test(sl) && !/\r/.test(sl), sl);
  check('Linux pretend-team stub execs the command', P.stubBody('run', '"node" "x.js"', 'linux') === '#!/bin/sh\nexec "node" "x.js"\n');
  // writeStub on the real disk, with a faked platform (chmod is a no-op on Windows)
  const f = path.join(tmp('platform'), 'stub.sh');
  P.writeStub(fs, f, 'log', '/tmp/o.txt', 'linux');
  check('writeStub writes the Linux body', fs.readFileSync(f, 'utf8') === sl);
});
