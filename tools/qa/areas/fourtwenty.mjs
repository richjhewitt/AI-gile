// QA area: fourtwenty (AIG-663/664/665). The 4:20 alarm is off by default; a Setup level and heads-up minutes; a fake page clock walks to 16:15
// (heads-up) and 16:20 (the alarm); WeedGlance pops out with a countdown; it fits a phone and dark mode.
import { check, sleep, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('fourtwenty', '🌿 4:20 alarm: Setup level + heads-up minutes, toast at the time, WeedGlance pop-out countdown, phone and dark fit (AIG-663/664/665)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const pr = async () => (await s.ok('GET', '/api/setup')).prefs;
  const p0 = await pr();
  check('default is No thanks (off) with 5 minutes of heads-up', p0.fourTwenty === 'off' && p0.fourTwentyBefore === 5, p0);
  check('the API refuses a rubbish level and a too-big heads-up', (await s.api('POST', '/api/setup', { prefs: { fourTwenty: 'lots' } })).status === 400 && (await s.api('POST', '/api/setup', { prefs: { fourTwentyBefore: 99 } })).status === 400);

  // Off: nothing shows
  await ctx.clock.install({ time: new Date(2026, 9, 13, 16, 14, 0) });
  let page = await openPage(ctx, '#/');
  await ctx.clock.runFor(10 * 60000);
  check('off: no WeedGlance button, no toast, even at 16:20', !(await page.isVisible('#weedBtn')) && (await page.locator('#weedToast').count()) === 0);

  // Setup: pick a level, and the heads-up number shows up
  const setup = await openPage(ctx, '#/setup');
  await setup.waitForSelector('#pf-420');
  check('Setup has the 4:20 choice with five levels, heads-up hidden while off', (await setup.locator('#pf-420 option').count()) === 5 && (await setup.locator('#pf-420b').count()) === 0);
  await setup.selectOption('#pf-420', 'day');
  await setup.waitForSelector('#pf-420b');
  check('chosen level is saved', (await pr()).fourTwenty === 'day');
  await setup.fill('#pf-420b', '5'); await setup.locator('#pf-420b').dispatchEvent('change');
  await sleep(300);
  check('heads-up minutes are saved', (await pr()).fourTwentyBefore === 5);
  await setup.close(); await page.close();

  // Walk the clock: 16:14 -> heads-up at 16:15 -> alarm at 16:20
  await ctx.clock.install({ time: new Date(2026, 9, 14, 16, 14, 0) });
  page = await openPage(ctx, '#/');
  await page.waitForSelector('#weedBtn:visible');
  check('WeedGlance button shows once the alarm is on', await page.isVisible('#weedBtn'));
  await ctx.clock.runFor(60000 + 5000);   // 16:15:05
  await page.waitForSelector('#weedToast');
  const soon = await page.textContent('#weedToast');
  check('heads-up toast: "4:20 in 5 min"', /4:20/.test(soon) && /\b[45] min/.test(soon) && soon.includes('🌿'), soon);
  await ctx.clock.runFor(5 * 60000);   // 16:20:05
  await page.waitForFunction(() => /It is 4:20/.test((document.getElementById('weedToast') || {}).textContent || ''), null, { timeout: 5000 });
  check('alarm toast at 16:20 with a leaf', true);

  // Phone width and dark mode
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  const box = await page.locator('#weedToast').boundingBox();
  check('phone width: the toast fits the screen and nothing scrolls sideways', box && box.x >= 0 && box.x + box.width <= 390 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), box);
  const dark = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('weedToast')); return { bg: c.backgroundColor, fg: c.color }; });
  check('dark mode: the toast is not a white box with white text', dark.bg !== dark.fg, dark);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.emulateMedia({ colorScheme: 'light' });

  // WeedGlance pops out with a countdown
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#weedBtn')]);
  await pop.waitForSelector('#weedCount');
  check('pop-out is its own small window on #/pop-weed', /#\/pop-weed$/.test(pop.url()));
  const c1 = await pop.textContent('#weedCount');
  check('pop-out has no header and counts down to tomorrow 16:20 (just under 24h)', !(await pop.isVisible('header')) && /^23:5\d:\d\d$/.test(c1.trim()), c1);
  await ctx.clock.runFor(3000);
  const c2 = await pop.textContent('#weedCount');
  check('the countdown ticks', c2 !== c1, c1 + ' -> ' + c2);
  check('the pop-out raised no alarm toast of its own', (await pop.locator('#weedToast').count()) === 0);

  // Anywhere it is 4:20: a place is named
  await s.ok('POST', '/api/setup', { prefs: { fourTwenty: 'world', fourTwentyBefore: 0 } });
  await ctx.clock.runFor(11000);
  await pop.waitForFunction(() => /^world/.test((document.getElementById('weedPop') || { dataset: {} }).dataset.lvl || ''), null, { timeout: 5000 });
  const w = await pop.evaluate(() => { const n = Weed.next('world', Date.now()); return { places: n.places, mins: Math.round((n.at - Date.now()) / 60000) }; });
  check('"anywhere" finds a 4:20 within a few hours somewhere on Earth', w.places.length > 0 && w.mins <= 180, w);
  const where = await pop.evaluate(() => { const e = document.getElementById('weedWhere'); return e ? e.textContent : ''; });
  check('WeedGlance names the place (when it is not this computer\'s own clock)', where === '' ? w.places.includes('') : /\w/.test(where), where);

  // Back to No thanks: the button goes, the pop-out says it is off
  await s.ok('POST', '/api/setup', { prefs: { fourTwenty: 'off' } });
  await ctx.clock.runFor(11000);
  await page.waitForFunction(() => document.getElementById('weedBtn').classList.contains('wd-off'), null, { timeout: 5000 });
  check('No thanks hides the button again', !(await page.isVisible('#weedBtn')));
  await pop.waitForSelector('#weedOff');
  check('and the pop-out says the alarm is off', true);
  noErrors(page);
}, true);
