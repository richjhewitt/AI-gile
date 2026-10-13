// QA area: swarmsandbox: a server run as the tester's sandbox (AIGILE_SANDBOX=1) never makes worktrees or branches in a project's folder,
// even with swarm on and To do cards waiting.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, sleep, tmp, mkProject, mkCard, def } from '../lib.mjs';

def('swarmsandbox', '🐝 swarm in the tester sandbox leaves project folders alone (no worktrees, no branches)', async (s) => {
  const folder = tmp('sbhive');
  const git = (...a) => spawnSync('git', a, { cwd: folder, encoding: 'utf8', windowsHide: true });
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'qa@example.com'); git('config', 'user.name', 'QA');
  fs.writeFileSync(path.join(folder, 'README.md'), 'x\n'); git('add', 'README.md'); git('commit', '-q', '-m', 'start');
  await mkProject(s, 'SbHive', 'SBH', { path: folder });
  await mkCard(s, 'sbhive', 'one', { status: 'todo', priority: 'urgent' });
  await mkCard(s, 'sbhive', 'two', { status: 'todo' });
  s.cli(['swarm', 'sbhive', '--as', 'Owner']);
  await sleep(2500);
  check('no worker started', !((await s.ok('GET', '/api/projects/sbhive')).presence.workers || []).length);
  check('no .claude/worktrees folder made', !fs.existsSync(path.join(folder, '.claude', 'worktrees')));
  check('no swarm branches made', !git('branch', '--list', 'swarm-*').stdout.trim(), git('branch', '--list', 'swarm-*').stdout);
  await s.ok('POST', '/api/swarm', { off: true });
}, false, { AIGILE_SANDBOX: '1' });
