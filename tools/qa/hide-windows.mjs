// Every process the tests start runs without a window (AIG-391). On Windows a child of a process with no
// console of its own (an agent's background run) otherwise pops up a terminal window over the owner's work.
// Imported first by the QA runner and the tester sandbox, so all later imports of child_process get these.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const hide = o => ({ windowsHide: true, ...(o || {}) });
for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
  const orig = cp[name];
  cp[name] = (file, args, opts, ...rest) => Array.isArray(args) ? orig(file, args, hide(opts), ...rest)
    : orig(file, hide(args), opts, ...rest);
}
for (const name of ['exec', 'execSync']) {
  const orig = cp[name];
  cp[name] = (cmd, opts, ...rest) => typeof opts === 'function' ? orig(cmd, hide(), opts, ...rest) : orig(cmd, hide(opts), ...rest);
}
syncBuiltinESMExports();
