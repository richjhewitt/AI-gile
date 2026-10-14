// New-user trial (AIG-201..203): a fresh, empty copy of the board on its own port, with made-up project folders to
// find, so the owner can walk a friend's first run (Setup → 🔎 Find my projects → 🎓 tour) without touching the real
// board. Its agent program is a pretend team (tools/trial/pretend-team.js: no AI, no cost); it all lives in a temp folder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ROOT } = require('./store');
const { t: tr, lang: ownerLang } = require('./i18n');

const PORT = 4400;
const DEMOS = ['pancake', 'garden', 'band'];   // names and about-lines are language keys (demo.<id>.name / .about, AIG-488)
let child = null;

// Which code a trial or pretend board runs (AIG-468): 'today' is this folder; 'release' is the newest git tag, exported once
// into a cache folder in the temp dir (git archive) and reused. Says clearly when that copy can't be made or can't run.
function codeDir(pick) {
  if (pick !== 'release') return ROOT;
  const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  const tag = (git('tag', '--sort=-creatordate').stdout || '').split(/\r?\n/).find(Boolean);
  if (!tag) throw Object.assign(new Error(tr('srv.err.norelease')), { status: 409 });
  const dir = path.join(os.tmpdir(), 'aigile-release-' + tag.replace(/[^\w.-]/g, '_'));
  if (!fs.existsSync(path.join(dir, 'server.js'))) {
    const tar = dir + '.tar';
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const a = git('archive', '--format=tar', '-o', tar, tag);
    const x = a.status === 0 && spawnSync('tar', ['-xf', '../' + path.basename(tar)], { cwd: dir, windowsHide: true });   // relative, so a GNU tar never reads "C:" as a host
    try { fs.rmSync(tar, { force: true }); } catch {}
    if (!x || x.status !== 0 || !fs.existsSync(path.join(dir, 'server.js'))) {
      fs.rmSync(dir, { recursive: true, force: true });
      throw Object.assign(new Error(tr('srv.err.unpack', { tag, why: String(a.stderr || '').trim().slice(0, 200) })), { status: 500 });
    }
  }
  return dir;
}
const releaseError = (dir, what) => dir === ROOT ? what : tr('srv.err.release', { what, dir });

// Made-up projects: a folder each with a README and one commit, like real ones, in the owner's language.
function demoFolders(dir, lang) {
  for (const id of DEMOS) {
    const name = tr(`demo.${id}.name`, null, lang), about = tr(`demo.${id}.about`, null, lang), d = path.join(dir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'README.md'), `# ${name}\n\n${about}\n`);
    const git = (...a) => spawnSync('git', ['-c', 'user.name=Demo', '-c', 'user.email=demo@example.invalid', ...a], { cwd: d, windowsHide: true });
    git('init', '-q'); git('add', '.'); git('commit', '-q', '-m', tr('demo.commit', null, lang));
  }
}
function stopTrial() {
  if (!child) return;
  if (process.platform === 'win32') require('./platform').killTree(child.pid);
  else try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill(); } catch {} }
  child = null;
}
// Starts a fresh trial (a running one is replaced) and says where it is once it answers.
async function startTrial(b = {}) {
  stopTrial();
  const root = codeDir(b.code);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-trial-'));
  const data = path.join(dir, 'data'), projects = path.join(dir, 'Projects'), local = path.join(dir, 'aigile.local.json'), stub = path.join(dir, 'pretend-team' + require('./platform').stubExt());
  fs.mkdirSync(data); fs.mkdirSync(projects);
  const lang = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(b.lang || '') ? b.lang : ownerLang();   // the trial board speaks the owner's language (AIG-488)
  fs.writeFileSync(local, JSON.stringify({ lang }));
  // The pretend team (AIG-205) stands in for an AI: it answers, makes cards and hands work over, at no cost.
  require('./platform').writeStub(fs, stub, 'run', `"${process.execPath}" "${path.join(ROOT, 'tools', 'trial', 'pretend-team.js')}"`);
  demoFolders(projects, lang);
  const env = { ...process.env, AIGILE_PORT: String(PORT), AIGILE_DATA: data, AIGILE_LOCAL: local, AIGILE_HOME: projects, AIGILE_URL: `http://localhost:${PORT}`,
    AIGILE_AGENT_COMMAND: stub, AIGILE_NO_RESTART: '1', AIGILE_NO_USAGE_AUTO: '1', AIGILE_OWNER: '', AIGILE_NO_TERMINAL: '1' };   // no terminal on the trial board (AIG-471)
  delete env.AIGILE_AS;
  child = spawn(process.execPath, [path.join(root, 'server.js')], { cwd: root, env, stdio: 'ignore', windowsHide: true, ...require('./platform').groupOpts() });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/meta`)).ok) return { url: `http://localhost:${PORT}/`, projects, code: b.code === 'release' ? 'release' : 'today', dir: root }; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  stopTrial();
  throw Object.assign(new Error(releaseError(root, tr('srv.err.trialstart', { port: PORT }))), { status: 500 });
}
process.on('exit', stopTrial);

module.exports = { startTrial, stopTrial, codeDir, releaseError };
