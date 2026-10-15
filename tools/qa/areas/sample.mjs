// QA area: sample (AIG-1072). The sample project for demos: one click on the empty home makes it (once), it shows on home marked Sample, one click removes it.
import { check, sleep, openPage, noErrors, def } from '../lib.mjs';

def('sample', 'sample project: Add a sample project on the empty home creates it once (cards, comments, a test, a question), marked Sample, removed in one click', async (s, ctx) => {
  check('starts with no projects', (await s.ok('GET', '/api/projects')).length === 0);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#sampleBtn');
  await page.click('#sampleBtn');
  await page.waitForSelector('#sampleRemove');
  const ps = await s.ok('GET', '/api/projects');
  check('one project, marked sample', ps.length === 1 && ps[0].sample === true && ps[0].slug === 'sample-project', ps);
  const p = await s.ok('GET', '/api/projects/sample-project');
  const st = new Set(p.cards.map(c => c.status));
  check('8-12 cards over backlog, todo, doing, verify, done', p.cards.length >= 8 && p.cards.length <= 12 && ['backlog', 'todo', 'doing', 'verify', 'done'].every(x => st.has(x)), [...st]);
  check('a test card with steps waits in For you', p.cards.some(c => c.status === 'verify' && c.testSteps));
  check('a question for the owner', p.cards.some(c => c.needsYou && c.comments.some(m => m.mark === 'ask')));
  check('at least two comments', p.cards.reduce((n, c) => n + c.comments.length, 0) >= 2);
  check('no folder and no team', !p.path && !(p.team || []).length);
  check('creating again is refused (once)', (await s.api('POST', '/api/sample-project')).status === 409 && (await s.ok('GET', '/api/projects')).length === 1);
  await page.goto((await page.url()).split('#')[0] + '#/'); await sleep(500);
  await page.waitForSelector('.proj .sample-pill');
  check('home shows it with the Sample pill', /Sample|Voorbeeld/.test(await page.textContent('.proj .sample-pill')));
  await page.goto((await page.url()).split('#')[0] + '#/p/sample-project');
  await page.waitForSelector('#sampleRemove');
  page.once('dialog', d => d.accept());
  await page.click('#sampleRemove');
  await page.waitForSelector('#sampleBtn');
  check('removed in one click: no projects left', (await s.ok('GET', '/api/projects')).length === 0 && (await s.api('GET', '/api/projects/sample-project')).status === 404);
  check('removing again is a 404', (await s.api('DELETE', '/api/sample-project')).status === 404);
  noErrors(page);
  await page.close();
}, true);
