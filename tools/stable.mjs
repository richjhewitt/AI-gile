// 📦 The daily Stable step (AIG-560). Moves the local `stable` branch on to the current build, but only when something
// changed since the last Stable and the whole QA run is green. It never pushes: it prints the push line for the owner.
//   node tools/stable.mjs [--from <branch>] [--notes <project>] [--skip-qa]
//   --from   the build to promote (default: the branch checked out here)
//   --notes  also write release notes for that project first (aigile release-notes), so What's new lists the build
// Stable only ever fast-forwards (git fetch . <from>:stable), so it can't lose anything.
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.env.AIGILE_REPO || HERE;   // tests point this at a scratch clone
const args = process.argv.slice(2), flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const git = (...a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', windowsHide: true }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const stop = msg => { console.log(msg); process.exit(1); };

const from = flag('--from') || git('rev-parse', '--abbrev-ref', 'HEAD').out;
if (!from || from === 'HEAD') stop('no branch to promote: use --from <branch>');
const has = git('rev-parse', '--verify', '--quiet', 'refs/heads/stable').ok;
const ahead = has ? Number(git('rev-list', '--count', `stable..${from}`).out) || 0 : 1;
if (!ahead) { console.log('nothing new since the last Stable: no build today'); process.exit(0); }
if (has && Number(git('rev-list', '--count', `${from}..stable`).out) > 0) stop(`stable has commits that ${from} lacks: not a fast-forward, fix by hand`);
if (!args.includes('--skip-qa')) {
  console.log('running the whole QA suite...');
  const qa = spawnSync(process.execPath, [path.join(HERE, 'tools', 'qa', 'qa.mjs')], { cwd: ROOT, encoding: 'utf8', windowsHide: true, env: { ...process.env, QA_PORT: process.env.QA_PORT || '4399' } });
  const tail = (qa.stdout || '').trim().split('\n').slice(-3).join('\n');
  if (qa.status !== 0) stop('QA is not green, so no Stable build today:\n' + tail);
  console.log(tail);
}
const proj = flag('--notes');
if (proj) { const n = spawnSync(process.execPath, [path.join(HERE, 'aigile.js'), 'release-notes', proj], { cwd: ROOT, encoding: 'utf8', windowsHide: true }); console.log((n.stdout || n.stderr || '').trim());
  // The notes are part of the build: commit them on the branch being promoted (only when it is the one checked out here).
  if (/^added/.test(n.stdout || '') && from === git('rev-parse', '--abbrev-ref', 'HEAD').out && git('add', 'public/releases.json').ok) git('commit', '-q', '-m', 'Release notes', '--', 'public/releases.json'); }
const ff = git('fetch', '.', `${from}:stable`);
if (!ff.ok) stop('could not move stable on: ' + (ff.err || ff.out));
console.log(`stable is now ${git('rev-parse', '--short', 'stable').out} (${ahead} new commit${ahead === 1 ? '' : 's'}). To publish it, the owner runs:\n  git push origin stable`);
