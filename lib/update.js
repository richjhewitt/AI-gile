// Auto-update (AIG-92): installs that were cloned from GitHub check their upstream branch every so often.
// When it has new commits, the page shows an ⬆ Update pill; applying fast-forwards and restarts the server.
// Safe by design: only a fast-forward of the branch's own upstream, never with local changes to tracked
// files, and never while a team is running in the background.
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ROOT, listSlugs, bad } = require('./store');
const { presenceOf } = require('./presence');

const REPO = process.env.AIGILE_REPO || ROOT;       // tests point this at a scratch clone
const EVERY_MS = 30 * 60e3;
let status = { behind: 0, checkedAt: null, note: 'not checked yet' };

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};

function checkUpdate() {
  const up = git('rev-parse', '--abbrev-ref', '@{u}');
  if (!up.ok) return (status = { behind: 0, checkedAt: new Date().toISOString(), note: 'no upstream branch: updates are off' });
  const f = git('fetch', '--quiet');
  if (!f.ok) return (status = { ...status, checkedAt: new Date().toISOString(), note: 'could not reach GitHub' });
  const behind = Number(git('rev-list', '--count', 'HEAD..@{u}').out) || 0;
  const ahead = Number(git('rev-list', '--count', '@{u}..HEAD').out) || 0;
  const subjects = behind ? git('log', '--format=%s', '-n', '5', 'HEAD..@{u}').out.split('\n').filter(Boolean) : [];
  return (status = { behind, ahead, upstream: up.out, subjects, checkedAt: new Date().toISOString(), note: '' });
}

function applyUpdate() {
  checkUpdate();
  if (!status.behind) throw bad('already up to date');
  if (status.ahead) throw bad('this copy has its own commits; update it by hand with git');
  if (git('status', '--porcelain', '--untracked-files=no').out) throw bad('files here were changed by hand; update it by hand with git');
  const busy = listSlugs().filter(s => presenceOf(s).running);
  if (busy.length) throw bad('a team is running (' + busy.join(', ') + '); try again when it has finished');
  const pull = git('merge', '--ff-only', '@{u}');
  if (!pull.ok) throw bad('update failed: ' + (pull.err || pull.out));
  const done = status.behind;
  status = { behind: 0, ahead: 0, checkedAt: new Date().toISOString(), note: 'updated' };
  if (!process.env.AIGILE_NO_RESTART) restartSoon();
  return { ok: true, updated: done };
}

// A small helper process starts a fresh server once this one has exited and freed the port.
function restartSoon() {
  const code = `setTimeout(() => require('child_process').spawn(process.execPath, ['server.js'], { cwd: ${JSON.stringify(ROOT)}, detached: true, stdio: 'ignore', windowsHide: true }).unref(), 1500)`;
  spawn(process.execPath, ['-e', code], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref();
  setTimeout(() => process.exit(0), 300);
}

// First check a minute after start, then every 30 minutes.
setTimeout(() => { try { checkUpdate(); } catch {} setInterval(() => { try { checkUpdate(); } catch {} }, EVERY_MS).unref(); }, 60e3).unref();

// 🔄 Restart the board (AIG-206): picks up new server code. Never while a team is running: they'd lose their work.
function restartBoard() {
  const busy = listSlugs().filter(s => presenceOf(s).running);
  if (busy.length) throw bad('a team is running (' + busy.join(', ') + '); try again when it has finished');
  if (!process.env.AIGILE_NO_RESTART) restartSoon();
  return { ok: true };
}

module.exports = { updateStatus: () => status, checkUpdate, applyUpdate, restartBoard };
