// QA area: tired (AIG-669). The top bar 🔋 / 😴 switch, the Setup "Tired mode" pref, and tiredNow in GET /api/setup.
// The server clock is faked to 23:30 (AIGILE_TIRED_NOW), so a bedtime of 22:00-07:00 applies and 08:00-09:00 does not.
import { check, sleep, openPage, noErrors, def, mkProject, mkCard, getCard } from '../lib.mjs';

def('tired', '🔋 / 😴 Tired mode: top bar switch, saved pref, bedtime (faked clock), follow dark mode, always, old data = off (AIG-669)', async (s, ctx) => {
  const setup = () => s.ok('GET', '/api/setup');
  let st = await setup();
  check('old data without it = off, awake', st.prefs.tired.mode === 'off' && st.tiredNow === false, JSON.stringify(st.prefs.tired));

  let page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#tiredBtn');
  const face = () => page.textContent('#tiredBtn');
  check('the top bar shows 🔋 when awake', (await face()).trim() === '🔋');
  await page.click('#tiredBtn'); await sleep(400);
  st = await setup();
  check('click: 😴 and saved as an owner pref', (await face()).trim() === '😴' && st.prefs.tired.mode === 'on' && st.tiredNow === true, JSON.stringify(st.prefs.tired));
  await page.reload(); await page.waitForSelector('#tiredBtn'); await sleep(400);
  check('it survives a reload', (await face()).trim() === '😴');
  await page.click('#tiredBtn'); await sleep(400);
  check('click again: back to 🔋', (await face()).trim() === '🔋' && !(await setup()).tiredNow);

  // Setup section
  await page.waitForSelector('#pf-tired');
  check('Setup has the Tired mode section with 4 choices', await page.locator('#pf-tired input[type=radio]').count() === 4);
  await page.check('#pf-tired input[value=bedtime]'); await sleep(400);
  st = await setup();
  check('bedtime 22:00-07:00 at 23:30: tiredNow is true', st.prefs.tired.mode === 'bedtime' && st.tiredNow === true, JSON.stringify(st.prefs.tired));
  await page.waitForSelector('#pf-tired-bedtime');
  check('...the times are saved with the pref', st.prefs.tired.bedtime === '22:00' && st.prefs.tired.wake === '07:00');
  await page.fill('#pf-tired-bedtime', '08:00'); await page.fill('#pf-tired-wake', '09:00'); await sleep(600);
  st = await setup();
  check('bedtime 08:00-09:00 at 23:30: tiredNow is false', st.prefs.tired.bedtime === '08:00' && st.prefs.tired.wake === '09:00' && st.tiredNow === false, JSON.stringify(st.prefs.tired));
  await s.ok('POST', '/api/setup', { prefs: { tired: { bedtime: '22:00', wake: '07:00' } } });
  await page.reload(); await page.waitForSelector('#tiredBtn'); await sleep(500);
  check('the top bar shows 😴 by itself during bedtime', (await face()).trim() === '😴');
  await page.click('#tiredBtn'); await sleep(400);
  check('a click overrides it to 🔋', (await face()).trim() === '🔋' && !(await setup()).tiredNow);
  await s.ok('POST', '/api/setup', { prefs: { tired: { wake: '08:00' } } });   // still the same state (tired); override stays
  check('...until the automatic state changes (a new bedtime window outside now brings it back)', !(await setup()).tiredNow);
  await s.ok('POST', '/api/setup', { prefs: { tired: { bedtime: '08:00', wake: '09:00' } } });
  await s.ok('POST', '/api/setup', { prefs: { tired: { bedtime: '22:00', wake: '07:00' } } });
  check('...and after the change it is tired again', (await setup()).tiredNow === true);

  // Always, and bad input
  await s.ok('POST', '/api/setup', { prefs: { tired: { mode: 'always' } } });
  check('always tired', (await setup()).tiredNow === true);
  const r = await s.api('POST', '/api/setup', { prefs: { tired: { bedtime: '25:99' } } });
  check('a bad time is refused', r.status === 400, r.status);

  // Dark mode: the page tells the server
  await s.ok('POST', '/api/setup', { prefs: { tired: { mode: 'dark' }, tiredFlip: false } });
  await page.close();
  const dark = await ctx.browser().newContext({ viewport: { width: 1200, height: 800 }, colorScheme: 'dark' });
  let dp = await openPage(dark, '#/');
  await dp.waitForSelector('#tiredBtn'); await sleep(800);
  check('follow dark mode: a dark page makes tiredNow true and 😴', (await setup()).tiredNow === true && (await dp.textContent('#tiredBtn')).trim() === '😴');
  await dp.evaluate(() => theme('light')); await sleep(2800);
  check('...switching the page to light makes it awake again', (await setup()).tiredNow === false && (await dp.textContent('#tiredBtn')).trim() === '🔋');
  await dp.close(); await dark.close();

  // Phone width + dark: the button is on the bar and the Setup section fits
  await s.ok('POST', '/api/setup', { prefs: { tired: { mode: 'always' } } });
  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  const pp = await openPage(ph, '#/setup');
  await pp.waitForSelector('#pf-tired'); await sleep(400);
  await pp.click('#tbMoreBtn');   // AIG-931: on a phone the button is in the ☰ menu
  const fit = await pp.evaluate(() => { const b = document.getElementById('tiredBtn').getBoundingClientRect(), box = document.getElementById('pf-tired').getBoundingClientRect(); return { btn: b.width > 0 && b.height > 0, boxFits: box.right <= innerWidth + 1, noScroll: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  check('phone width, dark: button visible, Tired mode section fits', fit.btn && fit.boxFits, JSON.stringify(fit));
  noErrors(pp);
  await pp.close(); await ph.close();
  // Tired mode 2/3 and 3/3 (AIG-670, AIG-671): the brief line, and tests that wait for morning
  await mkProject(s, 'Tiredy', 'TRD');
  const line = /is tired: keep messages to \S+ very short, no questions unless blocked, batch anything for them until morning\./;
  await s.ok('POST', '/api/setup', { prefs: { tired: { mode: 'off' } } });
  check('brief: no tired line when awake', !line.test(s.cli(['brief', 'tiredy']).out));
  await s.ok('POST', '/api/setup', { prefs: { tired: { mode: 'always' } } });
  check('brief: the tired line when tired', line.test(s.cli(['brief', 'tiredy']).out), s.cli(['brief', 'tiredy']).out.slice(0, 1500));
  const n1 = await mkCard(s, 'tiredy', 'Normal one'), n2 = await mkCard(s, 'tiredy', 'Urgent one', { priority: 'urgent' });
  const tr = [s.cli(['test', 'tiredy', n1.id, 'Look at it.', '--as', 'Tester']), s.cli(['test', 'tiredy', n2.id, 'Look at it.', '--as', 'Tester'])]; check('the CLI test command worked', tr.every(r => r.code === 0), JSON.stringify(tr));
  const inbox = async () => (await s.ok('GET', '/api/inbox')).filter(x => x.project === 'tiredy').map(x => x.id);
  const toTest = async () => (await s.ok('GET', '/api/projects')).find(x => x.slug === 'tiredy').toTest;
  const c1 = await getCard(s, 'tiredy', n1.id), c2 = await getCard(s, 'tiredy', n2.id);
  check('tired: both are in verify, the normal one marked morning, the urgent one not', c1.status === 'verify' && c1.morning === true && c2.status === 'verify' && !c2.morning, JSON.stringify([c1.morning, c2.morning]));
  const ib = await inbox();
  check('tired: the normal test is hidden, the urgent one shows', !ib.includes(n1.id) && ib.includes(n2.id), ib);
  check('tired: the to test count is 1', await toTest() === 1, await toTest());
  await s.ok('POST', '/api/setup', { prefs: { tired: { mode: 'off' } } });
  const ib2 = await inbox();
  check('awake: both show', ib2.includes(n1.id) && ib2.includes(n2.id), ib2);
  check('awake: the to test count is 2 and the morning flag is cleared', await toTest() === 2 && !(await getCard(s, 'tiredy', n1.id)).morning);
}, true, { AIGILE_TIRED_NOW: '23:30' });
