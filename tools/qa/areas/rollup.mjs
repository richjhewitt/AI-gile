// QA area: rollup (AIG-436): a space board can show the open cards of the projects inside it, by column, with a chip per child
// to hide or show its cards; off by default; links go to the child's card.
import { check, def, mkProject, mkCard, openPage, noErrors, sleep } from '../lib.mjs';

def('rollup', '🪐 a space board rolls up its children\'s open cards: switch, chips to filter, links to the child card (AIG-436)', async (s, ctx) => {
  await mkProject(s, 'Fleet', 'FLT');
  await mkProject(s, 'Ship', 'SHP', { parent: 'fleet' });
  await mkProject(s, 'Dock', 'DCK', { parent: 'fleet' });
  const a = await mkCard(s, 'ship', 'Paint the hull', { status: 'doing' });
  await mkCard(s, 'dock', 'Fix the crane', { status: 'todo' });
  await mkCard(s, 'dock', 'Old job', { status: 'done' });
  const sp = await s.ok('GET', '/api/projects/fleet');
  check('the space sends its children\'s open cards (not done ones)', sp.space.rollup.length === 2 && sp.space.rollup.every(c => c.status !== 'done'), sp.space.rollup);
  const page = await openPage(ctx, '#/p/fleet');
  await page.waitForSelector('#rollOn', { timeout: 8000 });
  check('off by default', !(await page.isChecked('#rollOn')) && !(await page.$('.roll-card')));
  await page.click('#rollOn');
  await page.waitForSelector('.roll-card', { timeout: 8000 });
  check('on: both children\'s cards show, in their columns', (await page.locator('.roll-card').count()) === 2 && /Paint the hull/.test(await page.textContent('.roll-board')));
  await page.click('.roll-chip:has-text("Dock")');
  await sleep(800);
  check('a chip hides that child\'s cards', (await page.locator('.roll-card').count()) === 1 && !/Fix the crane/.test(await page.textContent('.roll-board')));
  await page.reload(); await page.waitForSelector('.roll-card', { timeout: 8000 });
  check('the choice is kept', (await page.locator('.roll-card').count()) === 1);
  await page.click('.roll-card');
  await page.waitForFunction(id => location.hash.includes('/ship/' + id), a.id, { timeout: 8000 }).catch(() => {});
  check('a card opens on its own project', page.url().includes('/ship/' + a.id), page.url());
  noErrors(page); await page.close();
}, true);
