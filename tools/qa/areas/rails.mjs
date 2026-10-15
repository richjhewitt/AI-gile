// QA area: rails (AIG-616): guard rails by skill level. Beginner hides the list, some shows it read-only, expert gets a switch each.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('rails', '🛡️ guard rails by skill level: beginner hides them, some lists them read-only, expert switches each (qaGate off lets a red card through, on refuses again) (AIG-616)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const post = prefs => s.ok('POST', '/api/setup', { prefs });
  const card = await mkCard(s, 'alpha', 'Red change', { status: 'doing' });
  s.cli(['qa', 'alpha', card.id, '--areas', 'card', '--result', 'fail', '--full', 'fail', '--as', 'Backend']);
  const test = () => s.cli(['test', 'alpha', card.id, 'Open it and look', '--as', 'Backend']);

  // Beginner: all on, not shown
  await post({ techLevel: 'beginner' });
  let page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#quietTimes', { state: 'attached' });
  check('beginner: the guard rails list is hidden', (await page.locator('#guardRails').count()) === 0);
  check('beginner: the red card is refused', test().code !== 0);

  // Some: shown, read-only
  await post({ techLevel: 'some' });
  page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#guardRails', { state: 'attached' });
  check('some: four rails listed', (await page.locator('#guardRails .rail-row').count()) === 4);
  check('some: no switches', (await page.locator('#guardRails input').count()) === 0);
  check('some: the red card is refused', test().code !== 0);
  // An expert setting saved earlier does not count below expert
  await post({ techLevel: 'expert' });
  await post({ rails: { qaGate: false } });
  await post({ techLevel: 'some' });
  check('some: a stored off switch is ignored, the rail is on', test().code !== 0);
  await post({ techLevel: 'beginner' });
  check('beginner: likewise', test().code !== 0);

  // Help level mapping
  await post({ techLevel: '', helpLevel: '1' });
  page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#quietTimes', { state: 'attached' });
  check('help level 1: hidden', (await page.locator('#guardRails').count()) === 0);

  // Expert: a switch each
  await post({ techLevel: 'expert', helpLevel: '', rails: {} });
  page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#guardRails', { state: 'attached' });
  check('expert: four switches, all on', (await page.locator('#guardRails input:checked').count()) === 4);
  check('a bad rail name is refused', (await s.api('POST', '/api/setup', { prefs: { rails: { nope: false } } })).status === 400);
  check('expert, switch on: refused', test().code !== 0);
  await page.uncheck('#rail-qaGate'); await sleep(700);
  check('the switch saves', ((await s.ok('GET', '/api/setup')).prefs.rails || {}).qaGate === false);
  await page.waitForSelector('#guardRails', { state: 'attached' });
  check('and stays unticked after the page repaints', !(await page.isChecked('#rail-qaGate')) && (await page.locator('#guardRails input:checked').count()) === 3);
  const t1 = test();
  check('expert, qaGate off: aigile test hands the red card over', t1.code === 0 && (await getCard(s, 'alpha', card.id)).status === 'verify', t1);

  // Back on: refused again
  const card2 = await mkCard(s, 'alpha', 'Red again', { status: 'doing' });
  s.cli(['qa', 'alpha', card2.id, '--result', 'fail', '--as', 'Backend']);
  check('qaGate off: a second red card also goes', s.cli(['test', 'alpha', card2.id, 'Open it and look', '--as', 'Backend']).code === 0);
  await page.check('#rail-qaGate'); await sleep(700);
  const card3 = await mkCard(s, 'alpha', 'Red third', { status: 'doing' });
  s.cli(['qa', 'alpha', card3.id, '--result', 'fail', '--as', 'Backend']);
  const t3 = s.cli(['test', 'alpha', card3.id, 'Open it and look', '--as', 'Backend']);
  check('switched back on: refused again', t3.code !== 0 && /QA is red/.test(t3.out + (t3.err || '')), t3);
  check('and the rails setting is cleared', !(await s.ok('GET', '/api/setup')).prefs.rails || !Object.keys((await s.ok('GET', '/api/setup')).prefs.rails).length);

  // The other rails: quiet times
  const d = new Date(), n = d.getHours() * 60 + d.getMinutes();
  const hm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  await post({ quiet: [{ day: 'all', from: hm(n - 60), to: hm(n + 60), label: 'Stream' }], rails: { quietTimes: false } });
  check('quietTimes off: golive-ok says ok inside a quiet time', s.cli(['golive-ok', 'alpha']).code === 0);
  await post({ rails: {} });
  check('quietTimes back on: golive-ok says quiet', s.cli(['golive-ok', 'alpha']).code === 1);
  await post({ quiet: [] });
  await noErrors(page);
}, true);
