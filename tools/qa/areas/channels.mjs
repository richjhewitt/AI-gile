// QA area: channels (AIG-560): Setup shows Stable / Live for a clone; switching points the branch at origin/stable or
// origin/main; no Stable yet is refused; tools/stable.mjs moves stable on only when something changed.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { check, tmp, def, ROOT, openPage, noErrors } from '../lib.mjs';

const g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
const commit = (cwd, msg) => { g(cwd, 'add', '.'); g(cwd, '-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', msg); };

def('channels', '📦 Stable / Live update channel in Setup, switching upstream, tools/stable.mjs only when something changed (AIG-560)', async (s, ctx) => {
  const { repo, other } = JSON.parse(process.env.QA_CHANNEL_DIRS);
  let st = await s.ok('GET', '/api/channel');
  check('a clone on main is Live; no Stable yet', st.can && st.channel === 'live' && !st.stableExists, st);
  check('Stable is refused while there is none', (await s.api('PUT', '/api/channel', { channel: 'stable' })).status === 409);
  check('a made-up channel is refused', (await s.api('PUT', '/api/channel', { channel: 'nightly' })).status === 400);
  // The owner's machine makes the first Stable build (no QA here: --skip-qa) and pushes it.
  const stable = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools', 'stable.mjs'), ...a], { encoding: 'utf8', env: { ...process.env, AIGILE_REPO: other } });
  let r = stable('--from', 'main', '--skip-qa');
  check('stable.mjs makes the first Stable and prints the push line', r.status === 0 && /git push origin stable/.test(r.stdout), r.stdout + r.stderr);
  r = stable('--from', 'main', '--skip-qa');
  check('nothing new: no build', r.status === 0 && /nothing new/.test(r.stdout), r.stdout);
  g(other, 'push', '-q', 'origin', 'stable');
  st = await s.ok('PUT', '/api/channel', { channel: 'stable' });
  check('switched to Stable', st.channel === 'stable' && st.upstream === 'origin/stable' && g(repo, 'rev-parse', '--abbrev-ref', '@{u}').stdout.trim() === 'origin/stable', st);
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#channelPick', { timeout: 8000 });
  check('Setup shows the picker on Stable', await page.$eval('#channelPick', e => e.value) === 'stable');
  page.once('dialog', d => d.accept());
  await page.selectOption('#channelPick', 'live');
  await page.waitForFunction(() => /Live/.test(document.getElementById('channelHelp')?.textContent || '') , null, { timeout: 8000 }).catch(() => {});
  check('picking Live (after the warning) switches back', g(repo, 'rev-parse', '--abbrev-ref', '@{u}').stdout.trim() === 'origin/main');
  noErrors(page);
  await page.close();
}, true, (() => {
  const dir = tmp('channels'), origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'install'), other = path.join(dir, 'other');
  g(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  g(dir, 'clone', '-q', origin, other);
  fs.writeFileSync(path.join(other, 'a.txt'), 'v1'); commit(other, 'Build 1');
  g(other, 'push', '-q', '-u', 'origin', 'HEAD:main');
  g(dir, 'clone', '-q', origin, repo);
  process.env.QA_CHANNEL_DIRS = JSON.stringify({ repo, other });
  return { AIGILE_REPO: repo, AIGILE_NO_RESTART: '1' };
})());
