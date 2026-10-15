// QA area: knownerrors (AIG-1106): open problem cards with a workaround, listed per project and for all projects,
// the agent brief line, the page, and the links from the board toolbar and incident cards.
import { check, mkProject, mkCard, def, openPage, noErrors, until } from '../lib.mjs';

def('knownerrors', '🧩 known errors list: API per project/all, brief line, page, board and incident links (AIG-1106)', async (s, ctx) => {
  await mkProject(s, 'Kerr', 'KER');
  const inc = await mkCard(s, 'kerr', 'Relay down', { status: 'todo', type: 'incident' });
  const p1 = await s.ok('POST', '/api/projects/kerr/problems', { title: 'Relay drops at night', incidents: [inc.id] });
  const p2 = await s.ok('POST', '/api/projects/kerr/problems', { title: 'No workaround yet' });
  check('no workaround: empty list', (await s.ok('GET', '/api/projects/kerr/known-errors')).errors.length === 0);
  check('no brief line yet', !/Known error:/.test(s.cli(['brief', 'kerr']).out));
  await s.ok('PATCH', '/api/projects/kerr/problems/' + p1.id, { workaround: 'Restart the relay service' });
  const l = (await s.ok('GET', '/api/projects/kerr/known-errors')).errors;
  check('a problem with a workaround is listed with its incident count', l.length === 1 && l[0].id === p1.id && l[0].incidentCount === 1 && l[0].workaround === 'Restart the relay service', l);
  check('the brief has one Known error line', s.cli(['brief', 'kerr']).out.split('\n').filter(x => x === 'Known error: Relay drops at night — workaround: Restart the relay service').length === 1, s.cli(['brief', 'kerr']).out);
  const all = (await s.ok('GET', '/api/known-errors')).errors;
  check('the all-projects list has it with the project name', all.some(k => k.id === p1.id && k.slug === 'kerr'), all);
  check('an unknown project is a 404', (await s.api('GET', '/api/projects/nope/known-errors')).status === 404);

  const page = await openPage(ctx, '#/known-errors/kerr');
  check('the page lists the known error', !!(await until(() => page.$('.ke-row'), 8000)));
  const txt = await page.$eval('.ke-row', e => e.textContent);
  check('row shows title, workaround and incident count', /Relay drops/.test(txt) && /Restart the relay service/.test(txt) && /1/.test(txt), txt);
  check('the title links to the card', (await page.$eval('.ke-row a', a => a.getAttribute('href'))).endsWith('/' + p1.id));
  await page.evaluate(() => { location.hash = '#/known-errors'; });
  check('the all-projects page shows it too', !!(await until(async () => (await page.$$('.ke-row')).length >= 1 && /Kerr/.test(await page.$eval('.ke-row', e => e.textContent)), 8000)));
  await page.evaluate(() => { location.hash = '#/p/kerr'; });
  check('the board has a Known errors button', !!(await until(() => page.$('button[onclick*="#/known-errors/kerr"]'), 8000)));
  await page.goto(page.url().replace(/#.*/, '') + '#/p/kerr/' + inc.id);
  check('an incident card links to the known errors', !!(await until(() => page.$('a.ke-link'), 8000)));
  await page.setViewportSize({ width: 390, height: 800 });
  noErrors(page);
  await page.close();
}, true);
