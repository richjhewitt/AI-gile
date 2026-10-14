// QA area: trusttester (AIG-467): the "Trust the AI tester" setting, sure / likely passes, the safety rules, the ✅ Done by the tester list.
import { check, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('trusttester', '🧪 Trust the AI tester: 3 modes, sure / likely, cards that never close themselves, the Done by the tester list with Reopen (AIG-467)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const STEPS = '- Click **Theme**: it goes dark';
  const mk = async (title, extra = {}, steps = STEPS) => { const c = await mkCard(s, 'alpha', title, extra); s.cli(['test', 'alpha', c.id, steps, '--as', 'Lead']); return c; };
  const pass = (c, flag) => s.cli(['checked', 'alpha', c.id, 'pass', 'Clicked Theme, the page went dark', ...(flag ? [flag] : []), '--as', 'Tester']);
  const st = async c => (await getCard(s, 'alpha', c.id)).status;
  const mode = v => s.ok('POST', '/api/setup', { prefs: { trustTester: v } });

  // ---- the setting ----
  check('default is: I check every test', (await s.ok('GET', '/api/setup')).prefs.trustTester === 'check');
  check('a wrong value is refused', (await s.api('POST', '/api/setup', { prefs: { trustTester: 'yes' } })).status === 400);

  // ---- 👀 check: nothing closes ----
  const a = await mk('Dark mode');
  pass(a, '--sure');
  check('check mode: a sure pass stays in verify, with sure noted', (await st(a)) === 'verify' && (await getCard(s, 'alpha', a.id)).aiCheck.sure === true);

  // ---- 🤝 sure ----
  await mode('sure');
  check('the setting is saved', (await s.ok('GET', '/api/setup')).prefs.trustTester === 'sure');
  const b = await mk('Export'), c = await mk('Print');
  pass(b, '--sure'); pass(c, '--likely');
  const bc = await getCard(s, 'alpha', b.id);
  check('sure mode: a sure pass goes to done, as the tester, with a comment', bc.status === 'done' && bc.comments.at(-1).author === 'Tester' && bc.comments.at(-1).text === '✅ Moved to done by the AI tester (sure)', bc.comments.at(-1));
  check('sure mode: a likely pass stays in verify', (await st(c)) === 'verify');
  const d = await mk('Zoom');
  pass(d);
  check('a pass with no confidence counts as likely', (await st(d)) === 'verify' && (await getCard(s, 'alpha', d.id)).aiCheck.sure === false);

  // ---- 🤖 all ----
  await mode('all');
  const e = await mk('Share');
  pass(e, '--likely');
  const ec = await getCard(s, 'alpha', e.id);
  check('all mode: a likely pass goes to done too', ec.status === 'done' && /\(likely\)/.test(ec.comments.at(-1).text), ec.comments.at(-1));
  const f = await mk('Login'); s.cli(['checked', 'alpha', f.id, 'fail', 'No login box', '--as', 'Tester']);
  const g = await mk('Search'); s.cli(['checked', 'alpha', g.id, 'skip', 'Needs keys', '--as', 'Tester']);
  check('fail goes to the team and skip stays, even in all mode', (await st(f)) === 'team' && (await st(g)) === 'verify');

  // ---- safety: never auto-done ----
  const stay = [
    ['look-only steps', await mk('Colours', {}, '- Look at the **header**: the layout looks tidy')],
    ['a server task', await mk('Reboot box', { server: true })],
    ['an outside task', await mk('Ask friend', { outside: true })],
    ['a push card', await mk('Push the fix')],
    ['a release card', await mk('Release 2.0')],
    ['a budget card', await mk('Budget page')],
    ['a bug the owner raised', await mk('Crash on save', { type: 'bug', createdBy: 'Owner' })],
  ];
  for (const [why, x] of stay) { pass(x, '--sure'); check('never auto-done: ' + why, (await st(x)) === 'verify' && (await getCard(s, 'alpha', x.id)).aiCheck.result === 'pass', await st(x)); }
  const own = await mk('Crash by the team', { type: 'bug', createdBy: 'Forge' });
  pass(own, '--sure');
  check('a bug the team found does close', (await st(own)) === 'done');

  // ---- ✅ Done by the tester list and Reopen ----
  const list = await s.ok('GET', '/api/tester/done');
  check('the list holds what it closed today, newest first', list.map(x => x.id).includes(b.id) && list.map(x => x.id).includes(e.id) && !list.some(x => x.id === a.id) && list[0].id === own.id, list);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibTd .ib-td-row');
  check('For you shows the list with a sure / likely label', (await page.locator('#ibTd .ib-td-row').count()) === list.length && /likely/.test(await page.textContent(`#ibTd [data-id="${e.id}"]`)));
  await page.click(`#ibTd [data-id="${e.id}"] [data-tdreopen]`);
  await page.waitForFunction(id => !document.querySelector(`#ibTd [data-id="${id}"]`), e.id, { timeout: 5000 });
  const re = await getCard(s, 'alpha', e.id);
  check('Reopen moves it back to verify and drops it from the list', re.status === 'verify' && !(await s.ok('GET', '/api/tester/done')).some(x => x.id === e.id) && !re.testerDone);
  noErrors(page);

  // ---- the setting goes back ----
  await mode('check');
  const h = await mk('Fonts');
  pass(h, '--sure');
  check('back to check mode: nothing closes', (await st(h)) === 'verify');
}, true);
