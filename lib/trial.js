// New-user trial (AIG-201..203): a fresh, empty copy of the board on its own port, with made-up project folders to
// find, so the owner can walk a friend's first run (Setup → 🔎 Find my projects → 🎓 tour) without touching the real
// board. Its agent program does nothing, so no AI team ever starts there; it all lives in a temp folder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ROOT } = require('./store');

const PORT = 4400;
const DEMOS = [
  ['Pancake Shop', 'An online shop for pancake mixes, with a recipe of the week.'],
  ['Garden Planner', 'Plan what to plant and when, with reminders for watering.'],
  ['Band Website', 'Gig dates, songs and a mailing list for the band.'],
];
let child = null;

// Made-up projects: a folder each with a README and one commit, like real ones.
function demoFolders(dir) {
  for (const [name, about] of DEMOS) {
    const d = path.join(dir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'README.md'), `# ${name}\n\n${about}\n`);
    const git = (...a) => spawnSync('git', ['-c', 'user.name=Demo', '-c', 'user.email=demo@example.invalid', ...a], { cwd: d, windowsHide: true });
    git('init', '-q'); git('add', '.'); git('commit', '-q', '-m', 'First version');
  }
}
function stopTrial() {
  if (!child) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  else try { child.kill(); } catch {}
  child = null;
}
// Starts a fresh trial (a running one is replaced) and says where it is once it answers.
async function startTrial() {
  stopTrial();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-trial-'));
  const data = path.join(dir, 'data'), projects = path.join(dir, 'Projects'), local = path.join(dir, 'aigile.local.json'), stub = path.join(dir, 'no-agent.bat');
  fs.mkdirSync(data); fs.mkdirSync(projects);
  fs.writeFileSync(local, '{}');
  fs.writeFileSync(stub, '@echo off\r\nexit\r\n');
  demoFolders(projects);
  const env = { ...process.env, AIGILE_PORT: String(PORT), AIGILE_DATA: data, AIGILE_LOCAL: local, AIGILE_HOME: projects,
    AIGILE_AGENT_COMMAND: stub, AIGILE_NO_RESTART: '1', AIGILE_NO_USAGE_AUTO: '1', AIGILE_OWNER: '' };
  delete env.AIGILE_AS;
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: ROOT, env, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/meta`)).ok) return { url: `http://localhost:${PORT}/`, projects }; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  stopTrial();
  throw Object.assign(new Error('the trial board did not start (is port ' + PORT + ' busy?)'), { status: 500 });
}
process.on('exit', stopTrial);

module.exports = { startTrial, stopTrial };
