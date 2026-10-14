// QA area: scrumglance (AIG-688). The top-bar button opens a live panel with counts; it follows the poll; Pop out opens it in its own window.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('scrumglance', '📊 ScrumGlance: counts of doing, to do, to test and done today; live; Pop out; top-bar switch (AIG-688)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Build the thing', { status: 'doing' });
  await mkCard(s, 'alpha', 'Second thing', { status: 'doing' });
  await mkCard(s, 'alpha', 'Plan it', { status: 'todo' });
  await mkCard(s, 'alpha', 'Check it', { status: 'verify' });
  const old = await mkCard(s, 'beta', 'Beta job', { status: 'todo' });
  const g = await s.ok('GET', '/api/glance?project=alpha');
  check('API counts for one project', g.doing.n === 2 && g.todo.n === 1 && g.verify.n === 1 && g.done.n === 0, g);
  check('API counts for all projects', (await s.ok('GET', '/api/glance')).todo.n === 2);

  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#glanceBtn');
  await page.click('#glanceBtn');
  await page.waitForSelector('#sgPanel .sg-grp');
  const n = k => page.textContent(`#sgPanel .sg-${k} .sg-n`).then(x => +x.trim());
  check('panel shows the counts for this project', (await n('doing')) === 2 && (await n('todo')) === 1 && (await n('verify')) === 1 && (await n('done')) === 0);
  check('panel lists card titles', /Build the thing/.test(await page.textContent('#sgPanel .sg-doing')));

  const c = await mkCard(s, 'alpha', 'Finish me', { status: 'todo' });
  await page.waitForFunction(() => document.querySelector('#sgPanel .sg-todo .sg-n').textContent.trim() === '2', null, { timeout: 6000 });
  await s.ok('PATCH', `/api/projects/alpha/cards/${c.id}`, { status: 'done' });
  await page.waitForFunction(() => document.querySelector('#sgPanel .sg-done .sg-n').textContent.trim() === '1', null, { timeout: 6000 });
  check('it updates live and counts done today', (await n('done')) === 1 && (await n('todo')) === 1);

  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#sgPop')]);
  await pop.waitForSelector('.sg-pop .sg-grp');
  check('pop-out is its own small window on #/pop-glance/alpha', /#\/pop-glance\/alpha$/.test(pop.url()));
  check('pop-out has no header and shows the counts', !(await pop.isVisible('header')) && +(await pop.textContent('.sg-doing .sg-n')) === 2);
  check('the panel in the main window closed', (await page.locator('#sgPanel').count()) === 0);
  await mkCard(s, 'alpha', 'Another one', { status: 'doing' });
  await pop.waitForFunction(() => document.querySelector('.sg-doing .sg-n').textContent.trim() === '3', null, { timeout: 6000 });
  check('pop-out updates live too', true);
  await pop.close();

  const home = await openPage(ctx, '#/');
  await home.click('#glanceBtn');
  await home.waitForSelector('#sgPanel .sg-grp');
  check('home shows all projects', /Beta job/.test(await home.textContent('#sgPanel .sg-todo')) && /Plan it/.test(await home.textContent('#sgPanel .sg-todo')));

  const setup = await openPage(ctx, '#/setup');
  await setup.waitForSelector('#tbList [data-tb="glanceBtn"]');
  await setup.locator('[data-tb="glanceBtn"] .tb-on').uncheck();
  await sleep(200);
  check('Setup can switch the ScrumGlance button off', !(await setup.isVisible('#glanceBtn')));
  noErrors(page);
}, true);
