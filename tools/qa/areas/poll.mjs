// QA area: poll (AIG-920): an open window asks the cheap /api/stamp each second and fetches the big board / inbox only when it moved.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('poll', 'a quiet open board makes no repeat project/inbox fetch; a change shows within ~2 s; inbox is lite; proof still shows (AIG-920)', async (s, ctx) => {
  const folder = tmp('poll'), g = (...a) => spawnSync('git', a, { cwd: folder, encoding: 'utf8' });
  g('init', '-q'); fs.writeFileSync(path.join(folder, 'a.js'), 'x = 1;\n'); g('add', '.'); g('-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', 'start');
  fs.writeFileSync(path.join(folder, 'a.js'), 'x = 2;\n'); g('-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qam', 'Two please');
  const sha = g('rev-parse', 'HEAD').stdout.trim();
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  const c = await mkCard(s, 'alpha', 'Watch me');
  const t = await mkCard(s, 'alpha', 'Test me');
  s.cli(['test', 'alpha', t.id, '1. look', '--as', 'Lead', '--commit', sha.slice(0, 8)]);

  // The stamp: steady while nothing changes, moves on a card change and on a lead chat write.
  const st = async () => (await s.ok('GET', '/api/stamp')).s;
  const s1 = await st();
  check('the stamp is a short string, steady when nothing changes', typeof s1 === 'string' && s1.length > 4 && s1 === await st());
  await say(s, 'alpha', c.id, 'Owner', 'hello');
  const s2 = await st();
  check('a comment moves the stamp', s2 !== s1);
  // The lite inbox leaves proof out; the full route (old clients) still has it.
  const full = await s.ok('GET', '/api/inbox'), lite = await s.ok('GET', '/api/inbox?lite=1');
  check('the full inbox keeps proof for old clients', full.some(x => x.proof));
  check('the lite inbox has none', lite.length === full.length && !lite.some(x => 'proof' in x));

  // Page: count the big fetches.
  const page = await openPage(ctx, '#/p/alpha');
  let proj = 0, inbox = 0, stamps = 0;
  page.on('request', r => { const u = new URL(r.url()).pathname; if (u === '/api/projects/alpha') proj++; else if (u === '/api/inbox') inbox++; else if (u === '/api/stamp') stamps++; });
  await page.waitForSelector('.card');
  // The stub team woken by the cards finishes by itself; wait until the board has been quiet for 3 s.
  for (let q = 0, last = ''; q < 3;) { const v = await st(); q = v === last ? q + 1 : 0; last = v; await sleep(1000); }
  await sleep(1500);
  proj = inbox = stamps = 0;
  await sleep(5000);
  check('quiet: no project fetch in 5 s', proj === 0, proj);
  check('quiet: no inbox fetch in 5 s', inbox === 0, inbox);
  check('the page does ask the stamp', stamps >= 3, stamps);

  // A change shows within about 2 s.
  await say(s, 'alpha', c.id, 'Forge', 'ZEBRA-MARK-920');
  await page.goto(page.url().replace(/#.*/, '') + '#/p/alpha/' + c.id);
  await page.waitForSelector('#modal .panel', { timeout: 5000 });
  await say(s, 'alpha', c.id, 'Forge', 'SECOND-MARK-920');
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelector('#modal').textContent.includes('SECOND-MARK-920'), null, { timeout: 4000 }).catch(() => {});
  const took = Date.now() - t0;
  check('a new comment shows within about 2 s', took < 2600, took);

  // Proof shows on a card with a commit.
  await page.goto(page.url().replace(/#.*/, '') + '#/p/alpha/' + t.id);
  await page.waitForSelector('.proof', { timeout: 5000 });
  check('proof shows when the card is opened', (await page.textContent('[data-pane="test"]')).includes('Two please'));
  noErrors(page);
}, true);
