// QA area: rollback (AIG-563): a plain clone lists earlier builds from releases.json, goes back to one (detached, pinned,
// boards kept), refuses bad ids and hand-changed copies, and Back to the latest returns to the branch.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { check, tmp, def, mkProject } from '../lib.mjs';

const g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
const commit = (cwd, msg) => { g(cwd, 'add', '.'); g(cwd, '-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', msg); return g(cwd, 'rev-parse', 'HEAD').stdout.trim(); };

def('rollback', '↩ go back to an earlier build from What\'s new, stay on it, back to the latest; refuses bad ids and hand changes (AIG-563)', async s => {
  const repo = process.env.QA_ROLLBACK_REPO, { sha1, sha3 } = JSON.parse(process.env.QA_ROLLBACK_SHAS);
  await mkProject(s, 'Keep', 'KEEP');
  let st = await s.ok('GET', '/api/rollback');
  check('a plain clone can go back; both older builds listed', st.can && st.builds.length === 2 && !st.pinned, st);
  check('a bad id is refused', (await s.api('POST', '/api/rollback', { commit: 'nope; rm -rf' })).status === 400);
  check('a commit that is no build is refused', (await s.api('POST', '/api/rollback', { commit: sha3 })).status === 400);
  await s.ok('POST', '/api/rollback', { commit: sha1 });
  check('the copy is on the old build', g(repo, 'rev-parse', 'HEAD').stdout.trim() === sha1 && !fs.existsSync(path.join(repo, 'b.txt')));
  st = await s.ok('GET', '/api/rollback');
  check('it says so (pinned)', st.pinned && st.pinned.commit === sha1, st);
  check('boards are kept', (await s.ok('GET', '/api/projects?all=1')).some(p => p.slug === 'keep'));
  await s.ok('POST', '/api/rollback/latest');
  check('back to the latest, on the branch', g(repo, 'rev-parse', 'HEAD').stdout.trim() === sha3 && g(repo, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim() === 'main');
  check('not pinned any more', !(await s.ok('GET', '/api/rollback')).pinned);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'changed by hand');
  st = await s.ok('GET', '/api/rollback');
  check('a hand-changed copy can\'t go back', !st.can && st.why === 'changed', st);
  g(repo, 'checkout', '--', 'a.txt');
}, false, (() => {
  const dir = tmp('rollback'), origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'install'), other = path.join(dir, 'other');
  g(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  g(dir, 'clone', '-q', origin, other);
  fs.writeFileSync(path.join(other, 'a.txt'), 'v1'); const sha1 = commit(other, 'Build 1');
  fs.writeFileSync(path.join(other, 'b.txt'), 'v2'); const sha2 = commit(other, 'Build 2');
  fs.mkdirSync(path.join(other, 'public'));
  fs.writeFileSync(path.join(other, 'public', 'releases.json'), JSON.stringify([{ id: 'r2', title: 'Two', commit: sha2 }, { id: 'r1', title: 'One', commit: sha1 }]));
  const sha3 = commit(other, 'Notes');
  g(other, 'push', '-q', '-u', 'origin', 'HEAD:main');
  g(dir, 'clone', '-q', origin, repo);
  process.env.QA_ROLLBACK_REPO = repo; process.env.QA_ROLLBACK_SHAS = JSON.stringify({ sha1, sha3 });
  return { AIGILE_REPO: repo, AIGILE_NO_RESTART: '1' };
})());
