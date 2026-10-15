// QA area: dod (AIG-864): Definition of Ready / Done per project. Defaults for old projects, API (GET route, PATCH), CLI (print, set,
// reset, reminder on start and test), and the lists in the Look dialog.
import { check, mkProject, mkCard, def, openPage, noErrors, until } from '../lib.mjs';

def('dod', '✅ Definition of Ready / Done: defaults, GET route, PATCH, CLI dod/start/test reminders, Look dialog (AIG-864)', async (s, ctx) => {
  await mkProject(s, 'Dodo', 'DOD');
  const card = await mkCard(s, 'dodo', 'Do the thing', { status: 'todo' });
  const d0 = await s.ok('GET', '/api/projects/dodo/dod');
  check('a project with no lists gets the defaults', d0.ready.includes('test steps known') && d0.done.includes('QA green') && d0.done.length === 4, d0);
  check('an unknown project is a 404', (await s.api('GET', '/api/projects/nope/dod')).status === 404);
  check('an untouched project stores nothing', (await s.ok('GET', '/api/projects/dodo')).dod === undefined);

  await s.ok('PATCH', '/api/projects/dodo', { dod: { ready: ['one', 'two'] } });
  const d1 = await s.ok('GET', '/api/projects/dodo/dod');
  check('PATCH sets one list and leaves the other', d1.ready.join('|') === 'one|two' && d1.done.length === 4, d1);

  const cli = s.cli(['dod', 'dodo']);
  check('CLI dod prints both lists', cli.code === 0 && /Definition of Ready:\n\s+- one/.test(cli.out) && /Definition of Done:\n\s+- QA green/.test(cli.out), cli);
  const set = s.cli(['dod', 'dodo', 'done', 'a|b|c']);
  check('CLI dod done "a|b|c" sets it', set.code === 0 && /- a\n\s+- b\n\s+- c/.test(set.out), set);
  check('CLI dod with a wrong kind is refused', s.cli(['dod', 'dodo', 'maybe', 'x']).code !== 0);

  const st = s.cli(['start', 'dodo', card.id, '--as', 'Tester']);
  check('start prints the Definition of Ready and still starts', st.code === 0 && /started/.test(st.out) && /Definition of Ready:\n\s+\[ \] one\n\s+\[ \] two/.test(st.out), st);
  const ts = s.cli(['test', 'dodo', card.id, '1. Open it\n2. Click\n3. See it', '--as', 'Tester']);
  check('test prints the Definition of Done and still hands over', ts.code === 0 && /handed to/.test(ts.out) && /Definition of Done:\n\s+\[ \] a\n\s+\[ \] b\n\s+\[ \] c/.test(ts.out), ts);

  const rs = s.cli(['dod', 'dodo', 'done', '']);
  check('an empty list goes back to the default', rs.code === 0 && /- QA green/.test(rs.out), rs);
  const p = await s.ok('GET', '/api/projects/dodo');
  check('the project still has its card', p.cards.length === 1);

  const page = await openPage(ctx, '#/p/dodo');
  await until(() => page.evaluate(() => typeof lookDialog === 'function'), 8000);
  await page.evaluate(() => lookDialog());
  check('the Look dialog shows the lists', !!(await until(() => page.$('#look-dod-ready'), 8000)));
  check('Ready shows the saved list', (await page.$eval('#look-dod-ready', e => e.value)) === 'one\ntwo');
  await page.fill('#look-dod-done', 'first\nsecond');
  await page.evaluate(() => saveLook());
  check('Save stores the list', !!(await until(async () => (await s.ok('GET', '/api/projects/dodo/dod')).done.join('|') === 'first|second', 8000)));
  noErrors(page);
  await page.close();
}, true);
