// QA area: breaks (AIG-824, AIG-837). ⏸ Break on the home page: Vape / meds or Shower pauses the owner's alerts (html[data-break]), a timer chip with
// "I'm back", it ends by itself and survives a reload; Shower fills the window with "Enjoy your shower" (Esc or I'm back ends it). A short stub time
// (localStorage aigile.breakMs) keeps the run independent of date and time.
import { check, sleep, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('breaks', '⏸ break modes: Break button on home, Vape / Shower, chip with I\'m back, ends by itself, survives reload, full-screen shower, phone + dark (AIG-824/837)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/');
  await page.evaluate(() => localStorage.setItem('aigile.breakMs', '60000'));
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-break'));
  const shown = sel => page.evaluate(q => { const e = document.querySelector(q); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);

  check('no break: no chip, no shower screen, no data-break', !(await on()) && !(await shown('#breakChip')) && !(await shown('#showerScreen')));
  await page.click('text=⏸ Break');
  await page.waitForSelector('.brk-pick');
  check('the menu offers Vape / meds and Shower', (await page.locator('.brk-pick button').count()) === 2);

  // Vape: chip only
  await page.click('.brk-pick button >> nth=0');
  await page.waitForSelector('#breakChip:not([hidden])');
  const chip = await page.textContent('#breakChip');
  check('Vape: alerts pause, a chip shows the time left and I\'m back, no full screen', await on() && /Vape/.test(chip) && /\d:\d\d/.test(chip) && /I'm back/.test(chip) && !(await shown('#showerScreen')), chip);
  await page.reload(); await page.waitForSelector('#breakChip:not([hidden])');
  check('survives a reload', await on());
  await page.click('#breakChip button');
  check('I\'m back ends it', !(await on()) && !(await shown('#breakChip')));

  // Ends by itself (short stub time)
  await page.evaluate(() => localStorage.setItem('aigile.breakMs', '2500'));
  await page.evaluate(() => Break.start('vape'));
  check('a short break is on', await on());
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-break'), null, { timeout: 8000 });
  check('it ends by itself when the time is up', !(await shown('#breakChip')));

  // Shower: full screen
  await page.evaluate(() => localStorage.setItem('aigile.breakMs', '60000'));
  await page.click('text=⏸ Break'); await page.click('.brk-pick button >> nth=1');
  await page.waitForSelector('#showerScreen:not([hidden])');
  const scr = await page.textContent('#showerScreen');
  check('Shower: full screen "Enjoy your shower 🚿", time left, I\'m back', /Enjoy your shower 🚿/.test(scr) && /\d:\d\d left/.test(scr) && /I'm back/.test(scr), scr);
  await page.reload(); await page.waitForSelector('#showerScreen:not([hidden])');
  check('the shower screen survives a reload', await on());
  // phone width and dark mode
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  const box = await page.locator('#brkBack').boundingBox(), h1 = await page.locator('.brk-main h1').boundingBox();
  check('phone width: the screen fits, nothing scrolls sideways', box.x >= 0 && box.x + box.width <= 390 && h1.x >= 0 && h1.x + h1.width <= 390 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), { box, h1 });
  const col = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('showerScreen')); return { bg: c.backgroundColor, fg: c.color, img: c.backgroundImage }; });
  check('dark mode: dark screen with light text', col.fg !== 'rgb(29, 35, 48)' && /rgb\(2[0-9]{2}|rgb\(1[5-9]\d|rgb\(2/.test(col.fg), col);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.emulateMedia({ colorScheme: 'light' });
  await page.keyboard.press('Escape');
  check('Esc closes the screen and ends the break', !(await on()) && !(await shown('#showerScreen')));

  // Shower again, closed with the button
  await page.evaluate(() => Break.start('shower'));
  await page.click('#brkBack');
  check('I\'m back closes the shower screen too', !(await on()) && !(await shown('#showerScreen')));
  await sleep(200);
  noErrors(page);
}, true);
