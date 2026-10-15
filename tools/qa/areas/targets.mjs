// QA area: targets (AIG-1048): a reply-by time per card kind; a late incident shows a red clock and a brief line.
import fs from 'node:fs';
import path from 'node:path';
import { check, until, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('targets', '⏰ response targets: a late incident shows the clock chip and the brief line, a fresh one does not; Setup changes the target; a bug outside a service has no clock (AIG-1048)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const inc = await mkCard(s, 'alpha', 'Live is down', { type: 'incident', status: 'todo' });
  const bug = await mkCard(s, 'alpha', 'Small bug', { type: 'bug', status: 'todo' });
  const stub = path.join(s.data, 'now.stub');
  const late = async id => (await getCard(s, 'alpha', id)).late || 0;

  check('a fresh incident is not late', !(await late(inc.id)));
  check('and the brief has no clock line', !/past their reply-by/.test(s.cli(['brief', 'alpha']).out));

  const pr = (await s.ok('GET', '/api/setup')).prefs;
  check('Setup knows the table: incident 1 h, friend 48 h, bug 168 h', pr.targets.incident.normal === 1 && pr.targets.friend.normal === 48 && pr.targets.bug.normal === 168, pr.targets);

  fs.writeFileSync(stub, new Date(Date.now() + 10 * 864e5).toISOString());   // the test clock: 10 days on
  check('an incident past 1 h is late (target 1 h)', (await late(inc.id)) === 1);
  check('a bug in a project that is not a service has no clock', !(await late(bug.id)));
  const br = s.cli(['brief', 'alpha']).out;
  check("the brief lists the late incident", br.includes(`1 card past their reply-by time: ${inc.id}`) && !br.includes(`${inc.id}, `), br);

  const board = await openPage(ctx, '#/p/alpha');
  await board.waitForSelector(`.card[data-id="${inc.id}"]`);
  check('the board card has the red clock chip with the tooltip', (await board.locator(`.card[data-id="${inc.id}"] .late-chip`).getAttribute('title')) === 'past its reply-by time (1 h)');
  check('the bug has none', (await board.locator(`.card[data-id="${bug.id}"] .late-chip`).count()) === 0);
  const page = await openPage(ctx, `#/p/alpha/${inc.id}`);
  await page.waitForSelector('.panel .late-chip');
  check('the card view has the chip too', (await page.locator('.panel .late-chip').count()) === 1);
  noErrors(page);

  // The owner waiting: a question for them stops the clock.
  await s.ok('PATCH', `/api/projects/alpha/cards/${inc.id}`, { needsYou: true });
  check('a card waiting on the owner is not late', !(await late(inc.id)));
  await s.ok('PATCH', `/api/projects/alpha/cards/${inc.id}`, { needsYou: false });
  check('and is late again after', (await late(inc.id)) === 1);

  // Setup: a longer target
  const setup = await openPage(ctx, '#/setup');
  await setup.waitForSelector('#pf-targets');
  await setup.fill('#pf-targets input[data-tk="incident"][data-tp="normal"]', '500');
  await setup.dispatchEvent('#pf-targets input[data-tk="incident"][data-tp="normal"]', 'change');
  check("changing the target in Setup is saved", !!(await until(async () => (await s.ok("GET", "/api/setup")).prefs.targets.incident.normal === 500)));
  check('the incident is no longer late', !(await late(inc.id)));
  check('and the brief line is gone', !/past their reply-by/.test(s.cli(['brief', 'alpha']).out));
  await s.ok('POST', '/api/setup', { prefs: { targets: { incident: { normal: 1 } } } });
  fs.rmSync(stub, { force: true });
}, true);
