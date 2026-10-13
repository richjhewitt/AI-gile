// QA area: changewin (AIG-859): when changes may go live. API (GET/POST), CLI (change-windows, golive-ok --card), a change card moving to done
// is refused outside a window and allowed inside one, an emergency change (from an open incident) skips the window, old projects without
// windows are unchanged, and the box in the Look dialog (also at phone width, dark). Date-proof: the lib is checked with fixed dates (a clock
// stub), the server with windows made from today's weekday.
import { createRequire } from 'node:module';
import { check, mkProject, mkCard, getCard, def, openPage, noErrors, until, ROOT } from '../lib.mjs';

const cw = createRequire(import.meta.url)(ROOT + '/lib/changewin.js');
const OWN = { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' };   // the owner at a terminal, not a background run
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

def('changewin', '🔀 change windows: GET/POST, CLI, done refused outside a window, emergency skips, Look dialog box (AIG-859)', async (s, ctx) => {
  // clock stub: a fixed Wednesday 2026-11-04 at 12:00
  const at = new Date(2026, 10, 4, 12, 0), p0 = { changeWindows: [{ day: 'tue', from: '20:00', to: '22:00', label: 'Release' }, { day: 'fri', from: '09:00', to: '15:00', label: '' }] };
  check('next window from a Wednesday is Fri 09:00', cw.next(p0, at).text === 'Fri 09:00');
  check('next window after Friday 16:00 is Tue 20:00 (Release)', cw.next(p0, new Date(2026, 10, 6, 16, 0)).text === 'Tue 20:00' && cw.next(p0, new Date(2026, 10, 6, 16, 0)).label === 'Release');
  check('Friday 10:00 is inside, Friday 15:00 is outside', !!cw.open(p0, new Date(2026, 10, 6, 10, 0)) && !cw.open(p0, new Date(2026, 10, 6, 15, 0)));
  check('no windows means any time', cw.check({}, { type: 'change' }, at).ok === true && cw.next({}, at) === null);
  check('parse reads the text form', cw.parse('tue 20:00-22:00 Release|all 9:00-10:00')[1].from === '09:00');

  await mkProject(s, 'Win', 'WIN');
  const old = await mkCard(s, 'win', 'Old change', { type: 'change', status: 'todo' });
  check('old project: no windows, GET is an empty list', (await s.ok('GET', '/api/projects/win/change-windows')).windows.length === 0);
  check('old project: a change moves to done any time', (await s.ok('PATCH', `/api/projects/win/cards/${old.id}`, { status: 'done' })).status === 'done');
  check('an unknown project is a 404', (await s.api('GET', '/api/projects/nope/change-windows')).status === 404);
  check('a bad window is refused', (await s.api('POST', '/api/projects/win/change-windows', { windows: [{ day: 'xyz', from: '09:00', to: '10:00' }] })).status === 400
    && (await s.api('POST', '/api/projects/win/change-windows', { set: 'whenever' })).status === 400);
  check('nothing was saved by the refused ones', (await s.ok('GET', '/api/projects/win/change-windows')).windows.length === 0);

  // a window that is not today: tomorrow's weekday
  const tomorrow = DAYS[(new Date().getDay() + 1) % 7];
  const away = await s.ok('POST', '/api/projects/win/change-windows', { windows: [{ day: tomorrow, from: '09:00', to: '10:00', label: 'Release' }] });
  check('POST saves a window and shows the next one', away.windows.length === 1 && away.open === null && away.next && away.next.text.endsWith(' 09:00'), away);
  const stored = await s.ok('GET', '/api/projects/win');
  check('stored on the project as changeWindows', stored.changeWindows && stored.changeWindows[0].day === tomorrow, stored.changeWindows);

  const ch = await s.ok('POST', '/api/projects/win/changes', { title: 'Ship it', undo: 'revert' });
  const task = await mkCard(s, 'win', 'A task', { type: 'task', status: 'todo' });
  const no = await s.api('PATCH', `/api/projects/win/cards/${ch.id}`, { status: 'done' });
  check('done outside a window is refused with the next window', no.status === 400 && /next window: \w{3} 09:00 \(Release\)/.test(JSON.stringify(no.body || no.data || no)), no);
  check('the card stayed where it was', (await getCard(s, 'win', ch.id)).status !== 'done');
  check('other card types are not held back', (await s.ok('PATCH', `/api/projects/win/cards/${task.id}`, { status: 'done' })).status === 'done');
  check('moving a change to another column is not held back', (await s.ok('PATCH', `/api/projects/win/cards/${ch.id}`, { status: 'doing' })).status === 'doing');

  const gl = s.cli(['golive-ok', 'win', '--card', ch.id]);
  check('CLI golive-ok --card refuses and names the window', gl.code !== 0 && /next window/.test(gl.out + (gl.err || '')), gl);
  check('CLI golive-ok --card on a plain card is an error', s.cli(['golive-ok', 'win', '--card', task.id]).code !== 0);
  check('CLI golive-ok without --card is unchanged', s.cli(['golive-ok', 'win']).code === 0);

  // emergency: from an open incident
  const inc = await mkCard(s, 'win', 'Site down', { type: 'incident', status: 'todo' });
  const em = await s.ok('POST', '/api/projects/win/changes', { title: 'Hotfix', undo: 'revert', from: inc.id });
  check('golive-ok --card is ok for an emergency change', s.cli(['golive-ok', 'win', '--card', em.id]).code === 0);
  check('an emergency change skips the window', (await s.ok('PATCH', `/api/projects/win/cards/${em.id}`, { status: 'done' })).status === 'done');

  // inside a window: all day via two windows
  await s.ok('POST', '/api/projects/win/change-windows', { windows: [{ day: 'all', from: '00:00', to: '23:59' }, { day: 'all', from: '23:59', to: '00:00' }] });
  check('inside a window it is ok', s.cli(['golive-ok', 'win', '--card', ch.id]).code === 0);
  check('inside a window done is allowed', (await s.ok('PATCH', `/api/projects/win/cards/${ch.id}`, { status: 'done' })).status === 'done');

  // CLI set / show / clear
  const set = s.cli(['change-windows', 'win', 'set', 'tue 20:00-22:00 Release|fri 09:00-15:00', '--as', 'Owner'], OWN);
  check('CLI set lists the windows', set.code === 0 && /tue 20:00-22:00 Release/.test(set.out) && /fri 09:00-15:00/.test(set.out), set);
  check('CLI show', /tue 20:00-22:00/.test(s.cli(['change-windows', 'win']).out));
  check('CLI bad window fails', s.cli(['change-windows', 'win', 'set', 'later', '--as', 'Owner'], OWN).code !== 0);
  check('CLI set none clears', /any time/.test(s.cli(['change-windows', 'win', 'set', 'none', '--as', 'Owner'], OWN).out) && (await s.ok('GET', '/api/projects/win')).changeWindows === undefined);

  // brief: next window line while an approved change waits
  await s.ok('POST', '/api/projects/win/change-windows', { set: `${tomorrow} 09:00-10:00 Release` });
  await s.ok('POST', '/api/projects/win/changes', { title: 'Waits', undo: 'revert' });
  check('brief says nothing while no change is approved', !/Next change window/.test(s.cli(['brief', 'win']).out));

  // Look dialog
  const page = await openPage(ctx, '#/p/win');
  await page.waitForLoadState('load'); await new Promise(r => setTimeout(r, 1500));
  await until(() => page.evaluate(() => typeof lookDialog === 'function' && !!state.project), 8000);
  await page.evaluate(() => lookDialog());
  check('the Look dialog has the windows box with the saved window', !!(await until(() => page.$('#look-chgwin-box'), 8000)) && (await page.$eval('#look-chgwin-box', e => e.value)).startsWith(tomorrow + ' 09:00-10:00'));
  await page.fill('#look-chgwin-box', 'mon 09:00-17:00 Office');
  await page.click('.dialog button.primary, dialog button.primary');
  await until(async () => (await s.ok('GET', '/api/projects/win/change-windows')).windows[0].day === 'mon', 8000);
  check('saving the dialog saved the window', (await s.ok('GET', '/api/projects/win/change-windows')).windows[0].label === 'Office');

  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  try {
    const pp = await ph.newPage(); await pp.goto(page.url());
    await until(() => pp.evaluate(() => typeof lookDialog === 'function' && !!state.project), 8000);
    await pp.evaluate(() => lookDialog());
    await pp.waitForSelector('#look-chgwin-box');
    const fit = await pp.evaluate(() => { const r = document.getElementById('look-chgwin-box').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
    check('phone width, dark: the windows box fits the screen', fit);
  } finally { await ph.close(); }
  await noErrors(page);
}, true);
