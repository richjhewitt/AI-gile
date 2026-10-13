// QA area: incident (AIG-614): a 🔥 incident card jumps the queue, and closing it asks for a post-mortem.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('incident', '🔥 incident card: tops next up, red edge, done needs what happened / why / what we change (CLI and card page), post-mortem shown (AIG-614)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Urgent bug', { type: 'bug', priority: 'urgent', status: 'todo' });
  const inc = await mkCard(s, 'alpha', 'Live is down', { type: 'incident', status: 'todo' });
  const inc2 = await mkCard(s, 'alpha', 'Checkout broken', { type: 'incident', status: 'todo' });
  check('incident is a card type', inc.type === 'incident');
  check('a bad type is still refused', (await s.api('POST', '/api/projects/alpha/cards', { title: 'x', type: 'nonsense' })).status === 400);

  const nx = s.cli(['next', 'alpha']).out;
  check('next lists the incident before the urgent bug', nx.indexOf('Live is down') >= 0 && nx.indexOf('Live is down') < nx.indexOf('Urgent bug'), nx);
  const br = s.cli(['brief', 'alpha']).out;
  check('the brief puts the incident first in Next up', br.indexOf('Live is down') >= 0 && br.indexOf('Live is down') < br.indexOf('Urgent bug'), br);

  // CLI
  await s.ok('PATCH', `/api/projects/alpha/cards/${inc.id}`, { status: 'team' });
  const no = s.cli(['move', 'alpha', inc.id, 'done']);
  check('done without a post-mortem is refused in the CLI', no.code !== 0 && /post-mortem/.test(no.out + (no.err || '')), no);
  const part = s.cli(['move', 'alpha', inc.id, 'done', '--happened', 'site down']);
  check('a partial post-mortem is refused too', part.code !== 0, part);
  check('and the card did not move', (await getCard(s, 'alpha', inc.id)).status === 'team');
  const yes = s.cli(['move', 'alpha', inc.id, 'done', '--happened', 'site down', '--why', 'bad deploy', '--change', 'smoke test first']);
  check('with all three it is accepted', yes.code === 0, yes);
  const c = await getCard(s, 'alpha', inc.id);
  check('the post-mortem is stored', c.status === 'done' && c.postmortem && c.postmortem.happened === 'site down' && c.postmortem.why === 'bad deploy' && c.postmortem.change === 'smoke test first', c.postmortem);

  // API refuses too
  const r = await s.api('PATCH', `/api/projects/alpha/cards/${inc2.id}`, { status: 'done' });
  check('the API refuses done without a post-mortem', r.status === 400, r.status);

  // Page
  const board = await openPage(ctx, '#/p/alpha');
  await board.waitForSelector('.card.is-incident');
  check('the open incident has the red-edge class on the board', (await board.locator(`.card.is-incident[data-id="${inc2.id}"]`).count()) === 1);
  check('the closed incident does not', (await board.locator(`.card.is-incident[data-id="${inc.id}"]`).count()) === 0);
  const page = await openPage(ctx, `#/p/alpha/${inc2.id}`);
  await page.waitForSelector('#mv-to');
  await page.selectOption('#mv-to', 'done');
  await page.waitForSelector('#pm-form');
  check('moving to done opens the post-mortem dialog', await page.isVisible('#pm-happened'));
  await page.click('#pm-cancel');
  await sleep(400);
  check('cancel keeps the card where it was', (await getCard(s, 'alpha', inc2.id)).status === 'todo');
  await page.selectOption('#mv-to', 'done');
  await page.waitForSelector('#pm-form');
  await page.fill('#pm-happened', 'cart errors');
  await page.fill('#pm-why', 'config typo');
  await page.fill('#pm-change', 'review configs');
  await page.click('#pm-form button[type=submit]');
  await sleep(800);
  const d = await getCard(s, 'alpha', inc2.id);
  check('submitting closes it with the post-mortem', d.status === 'done' && d.postmortem && d.postmortem.why === 'config typo', d);
  await page.waitForSelector('.postmortem');
  check('the card shows the post-mortem', /cart errors/.test(await page.innerText('.postmortem')) && /review configs/.test(await page.innerText('.postmortem')));
  await noErrors(page);
}, true);
