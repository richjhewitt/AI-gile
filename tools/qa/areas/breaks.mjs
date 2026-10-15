// QA area: breaks (AIG-824, AIG-837). ⏸ Break on the home page: Vape / meds or Shower pauses the owner's alerts (html[data-break]), a timer chip with
// "I'm back", it ends by itself and survives a reload; Shower fills the window with "Enjoy your shower" (Esc or I'm back ends it). A short stub time
// (localStorage aigile.breakMs) keeps the run independent of date and time.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

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

  // AIG-825: back from a break, one line of what happened meanwhile; Vape / meds offers 💊 Taken
  await mkCard(s, 'alpha', 'Check the export', { status: 'verify', testSteps: 'Click it' });
  await page.evaluate(() => Break.dismiss());
  await page.evaluate(() => { localStorage.removeItem('aigile.meds.' + (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date())); Break.start('vape'); });
  await page.click('#breakChip button');
  await page.waitForSelector('#breakBack:not([hidden]) .brk-took');
  const away = await page.textContent('#breakBack');
  check('back from Vape: "While you were away" line with the card to test, and 💊 Taken', /While you were away: .*1 card to test/.test(away) && /💊 Taken/.test(away), away);
  await page.click('.brk-took');
  check('💊 Taken counts the tick for today (localStorage)', /Taken · 1/.test(await page.textContent('#breakBack')) && await page.evaluate(() => Object.keys(localStorage).some(k => /^aigile\.meds\.\d{4}-\d\d-\d\d$/.test(k) && localStorage.getItem(k) === '1')));
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  const bb = await page.locator('#breakBack').boundingBox();
  check('phone + dark: the line fits the screen', bb.x >= 0 && bb.x + bb.width <= 390 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), bb);
  await page.setViewportSize({ width: 1280, height: 800 }); await page.emulateMedia({ colorScheme: 'light' });
  await page.click('#breakBack button >> nth=-1');
  check('the line can be closed', !(await shown('#breakBack')));
  await page.evaluate(() => Break.start('shower')); await page.click('#brkBack');
  await page.waitForSelector('#breakBack:not([hidden])');
  check('back from Shower: the line, no 💊 Taken', !/Taken/.test(await page.textContent('#breakBack')));
  await page.evaluate(() => Break.dismiss());

  // comments on any project card count, not only the inbox ones
  const plain = await mkCard(s, 'alpha', 'Plain work', { status: 'todo' });
  await page.evaluate(() => Break.start('vape'));
  await sleep(50);
  await s.ok('POST', `/api/projects/alpha/cards/${plain.id}/comments`, { author: 'Lead', text: 'done a bit' });
  await page.evaluate(() => Break.end());
  await page.waitForFunction(() => /comment/.test(document.getElementById('brkAway')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  check('"while you were away" counts comments on cards that are not in the inbox', /1 comment/.test(await page.textContent('#breakBack')), await page.textContent('#breakBack'));
  await page.evaluate(() => Break.dismiss());

  // a break that ran out while the page was closed still gets its welcome-back line, then is cleared
  await page.evaluate(() => { localStorage.setItem('aigile.break', JSON.stringify({ kind: 'vape', from: Date.now() - 120000, until: Date.now() - 60000 })); });
  await page.reload();
  await page.waitForSelector('#breakBack:not([hidden]) .brk-took', { timeout: 8000 }).catch(() => {});
  check('expired while closed: the welcome-back line and 💊 Taken show, the break is cleared', await shown('#breakBack') && /While you were away/.test(await page.textContent('#breakBack')) && !(await on()) && (await page.evaluate(() => localStorage.getItem('aigile.break'))) === null);
  await page.evaluate(() => Break.dismiss());

  // AIG-838: 🚿 Shower button on home; "Right, let's do this" on life reminders
  await page.click('text=🚿 Shower');
  await page.waitForSelector('#showerScreen:not([hidden])');
  check('🚿 Shower on home starts shower mode', await on() && /Enjoy your shower/.test(await page.textContent('#showerScreen')));
  await page.click('#brkBack');
  await mkCard(s, 'alpha', 'Take a shower', { lifeType: 'health', remindEvery: 60 });
  await mkCard(s, 'alpha', 'Drink water', { lifeType: 'health', remindEvery: 60 });
  await page.goto(page.url().split('#')[0] + '#/inbox'); await page.reload();
  await page.waitForSelector('.ib-item [data-act="letsgo"]');
  check('life reminders have Snooze and Right, let\'s do this', (await page.locator('.ib-item [data-act="letsgo"]').count()) === 2 && (await page.locator('.ib-item .ib-top ~ .actions [data-act="wait"]').count()) >= 2, [await page.locator('.ib-item [data-act="letsgo"]').count(), await page.locator('.ib-item .actions [data-act="wait"]').count()]);
  await page.locator('.ib-item', { hasText: 'Drink water' }).locator('[data-act="letsgo"]').click();
  await sleep(600);
  const water = (await s.ok('GET', '/api/projects/alpha')).cards.find(x => x.title === 'Drink water');
  check('on another reminder it only puts it off: no shower mode, not done', !(await on()) && water.status !== 'done' && !!water.snoozedUntil, water);
  await page.locator('.ib-item', { hasText: 'Take a shower' }).locator('[data-act="letsgo"]').click();
  await page.waitForSelector('#showerScreen:not([hidden])');
  const sh = (await s.ok('GET', '/api/projects/alpha')).cards.find(x => x.title === 'Take a shower');
  check('on a shower reminder it starts shower mode (card not done)', await on() && sh.status !== 'done', sh);
  await page.keyboard.press('Escape');
  noErrors(page);
}, true);
