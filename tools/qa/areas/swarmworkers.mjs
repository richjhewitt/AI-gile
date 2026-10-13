// QA area: swarmworkers (AIG-901): with swarm on, the board runs one worker per unassigned To do card (highest priority first),
// each in its own git worktree on a swarm-<id> branch, up to the Setup cap; a lead active in VS Code doesn't hold them back;
// a worker that ends lets the next card go; swarm off starts no new ones. The agent is a stub script: no real AI run.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, sleep, until, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

// The fake agent: notes its folder and arguments in that folder, then waits for release-<folder name> (at most ~60 s).
const stubDir = tmp('swarmstub'), win = process.platform === 'win32';
const stub = path.join(stubDir, 'worker-stub' + (win ? '.bat' : '.sh'));
fs.writeFileSync(stub, win
  ? `@echo off\r\ncd > ".worker-ran"\r\necho %* > ".worker-args"\r\nfor %%I in (.) do set N=%%~nxI\r\nset /a T=0\r\n:loop\r\nif exist "${stubDir}\\release-%N%" exit /b 0\r\nset /a T+=1\r\nif %T% GTR 60 exit /b 0\r\nping -n 2 127.0.0.1 >nul\r\ngoto loop\r\n`
  : `#!/bin/sh\npwd > .worker-ran\necho "$@" > .worker-args\nN=$(basename "$PWD")\nfor i in $(seq 1 120); do [ -f "${stubDir}/release-$N" ] && exit 0; sleep 0.5; done\nexit 0\n`);
if (!win) fs.chmodSync(stub, 0o755);
const release = id => fs.writeFileSync(path.join(stubDir, 'release-swarm-' + id.toLowerCase()), '');

def('swarmworkers', '🐝 swarm workers: one per To do card in its own worktree up to the cap, past a lead in VS Code; off starts no more (AIG-901)', async (s, ctx) => {
  const folder = tmp('hive');
  const git = (...a) => spawnSync('git', a, { cwd: folder, encoding: 'utf8', windowsHide: true });
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 'qa@example.com'); git('config', 'user.name', 'QA');
  fs.writeFileSync(path.join(folder, 'README.md'), 'hive\n'); git('add', 'README.md'); git('commit', '-q', '-m', 'start');
  await mkProject(s, 'Hive', 'HIV', { path: folder });
  const a = await mkCard(s, 'hive', 'low one', { status: 'todo', priority: 'low' });
  const b = await mkCard(s, 'hive', 'urgent one', { status: 'todo', priority: 'urgent' });
  const c = await mkCard(s, 'hive', 'normal one', { status: 'todo', priority: 'normal' });
  const taken = await mkCard(s, 'hive', 'taken', { status: 'todo', assignee: 'Pixel' });
  const back = await mkCard(s, 'hive', 'later', { status: 'backlog' });

  // The cap from Setup: 2 at once.
  const sp = await openPage(ctx, '#/setup');
  await sp.waitForSelector('#pf-more summary', { timeout: 8000 });
  if (!(await sp.$eval('#pf-more', d => d.open))) await sp.click('#pf-more summary');
  check('Setup shows the swarm worker cap, 6 by default', (await sp.inputValue('#pf-swarmWorkers')) === '6', await sp.inputValue('#pf-swarmWorkers'));
  await sp.fill('#pf-swarmWorkers', '2'); await sp.dispatchEvent('#pf-swarmWorkers', 'change');
  check('the cap is saved', await until(async () => (await s.ok('GET', '/api/setup')).prefs.swarmWorkers === 2, 4000));
  noErrors(sp); await sp.close();

  // A lead at work in VS Code on this project.
  s.cli(['show', 'hive', a.id], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  check('the lead counts as in VS Code', (await s.ok('GET', '/api/projects/hive')).presence.where === 'vscode');

  const r = s.cli(['swarm', 'hive', '--as', 'Owner']);
  check('swarm on', /Swarm on Hive/.test(r.out), r);
  const workers = async () => (await s.ok('GET', '/api/projects/hive')).presence.workers || [];
  const two = await until(async () => (await workers()).length === 2, 10000);
  const ws = (await workers()).map(w => w.id).sort();
  check('two workers (the cap), highest priority first, past the lead in VS Code', !!two && ws.join() === [b.id, c.id].sort().join(), ws);
  const wt = id => path.join(folder, '.claude', 'worktrees', 'swarm-' + id.toLowerCase());
  const ran = id => until(() => fs.existsSync(path.join(wt(id), '.worker-ran')), 10000);
  check('each worker runs in its own worktree', !!(await ran(b.id)) && !!(await ran(c.id)));
  const br = git('branch', '--list', 'swarm-*').stdout;
  check('each worktree is on a new swarm-<id> branch', br.includes('swarm-' + b.id.toLowerCase()) && br.includes('swarm-' + c.id.toLowerCase()), br);
  const args = fs.readFileSync(path.join(wt(b.id), '.worker-args'), 'utf8');
  check('the worker prompt: only its card, aigile start first, review hand-over, no push', args.includes('ONLY on card ' + b.id) && args.includes(`aigile start hive ${b.id}`) && /review/.test(args) && /never push/.test(args) && /Bash\(git push:\*\)/.test(args), args.slice(0, 400));
  check('the assigned card and the backlog card get none', !fs.existsSync(wt(taken.id)) && !fs.existsSync(wt(back.id)));
  check('worktrees stay out of the project status', !/\.claude/.test(git('status', '--porcelain').stdout), git('status', '--porcelain').stdout);

  // In flight on the board, with the worker's log and Stop.
  const page = await openPage(ctx, '#/p/hive');
  await page.waitForSelector('.flight-worker', { timeout: 8000 }).catch(() => {});
  check('the board shows both workers in flight', (await page.$$('.flight-worker')).length === 2, await page.textContent('.flight').catch(() => ''));
  await page.click(`.flight-worker[data-worker="${c.id}"]`);
  await page.waitForSelector('#agentLog', { timeout: 4000 }).catch(() => {});
  check('a worker opens its own log', /swarm worker/.test(await page.textContent('#agentLog').catch(() => '')) && !!(await page.$('#workerStop')), await page.textContent('#agentLog').catch(() => ''));
  const home = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'hive');
  check('home summary lists the workers in flight', home.inFlight.filter(f => f.worker).length === 2, home.inFlight);

  // A worker that ends lets the next card go.
  release(b.id);
  const next = await until(async () => (await workers()).some(w => w.id === a.id), 15000);
  check('when a worker ends the next card starts', !!next && !(await workers()).some(w => w.id === b.id), await workers());
  // Stop from the log dialog.
  await page.click('#workerStop');
  check('Stop ends that worker', !!(await until(async () => !(await workers()).some(w => w.id === c.id), 6000)), await workers());
  noErrors(page);

  // Swarm off: the running worker goes on, no new ones.
  await s.ok('POST', '/api/swarm', { off: true });
  const late = await mkCard(s, 'hive', 'late one', { status: 'todo', priority: 'urgent' });
  release(a.id);
  check('the last worker ends', !!(await until(async () => !(await workers()).length, 15000)));
  await sleep(800);
  check('swarm off starts no new worker', !(await workers()).length && !fs.existsSync(wt(late.id)));
  // The hard guards still hold: ⛔ No Token Mode starts no worker.
  s.cli(['notokens', 'on']);
  s.cli(['swarm', 'hive', '--as', 'Owner']);
  await sleep(800);
  check('No Token Mode holds the workers back', !(await workers()).length && !fs.existsSync(wt(late.id)));
  s.cli(['notokens', 'off']); await s.ok('POST', '/api/swarm', { off: true });
  for (const id of [a.id, b.id, c.id, late.id]) release(id);
}, true, { AIGILE_AGENT_COMMAND: stub });
