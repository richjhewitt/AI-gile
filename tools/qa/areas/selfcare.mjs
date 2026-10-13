// QA area: selfcare (AIG-775, AIG-776, AIG-777). Setup box for self-care reminders, the nudge chip (Done / Later / Skip, shower Let's go),
// meds at set times that keep nudging until Done, and the Today popover. Date- and time-proof: the page clock is moved with localStorage
// aigile.scOffsetMs (set to a fixed time of today), snooze and the 10 min repeat are shortened with aigile.scSnoozeMs / aigile.scRepeatMs.
import { check, sleep, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('selfcare', '💚 self-care: Setup reminders + quiet hours + meds times, nudge chip Done / Later / Skip, shower Let\'s go, meds repeat until Done, Today popover, quiet in break/focus/night, phone + dark (AIG-775/776/777)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/setup');
  const clock = (h, m) => page.evaluate(([h, m]) => { const d = new Date(); d.setHours(h, m, 30, 0); localStorage.setItem('aigile.scOffsetMs', String(d.getTime() - Date.now())); }, [h, m]);
  const shown = sel => page.evaluate(q => { const e = document.querySelector(q); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
  const chip = () => shown('#scChip');
  const wait = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(150); } return false; };
  const stubDay = () => page.evaluate(() => { const d = new Date(Date.now() + Number(localStorage.getItem('aigile.scOffsetMs') || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });

  const patch = async src => { await page.evaluate(code => { const o = JSON.parse(localStorage.getItem('aigile.selfcare')); new Function('o', code)(o); localStorage.setItem('aigile.selfcare', JSON.stringify(o)); }, src); await page.reload(); await page.waitForSelector('#selfcareBox .sc-row'); await sleep(1300); };
  // Old or broken saved data never breaks the page
  await page.evaluate(() => { localStorage.setItem('aigile.selfcare', '{"on":true,"items":{"water":"x"},"custom":[null,{"text":5}],"meds":{"times":["99:99","08:00"]},"quiet":7}'); });
  await page.reload(); await page.waitForSelector('#selfcareBox .sc-row');
  check('half-broken saved data loads with defaults', await page.locator('#selfcareBox .sc-row').count() === 9 && await page.locator('#selfcareBox .sc-tm').count() === 1);
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^aigile\.(selfcare|meds|sc)/.test(k)) localStorage.removeItem(k); });
  await page.reload(); await page.waitForSelector('#selfcareBox .sc-row');
  await page.evaluate(() => { localStorage.setItem('aigile.scSnoozeMs', '2500'); localStorage.setItem('aigile.scRepeatMs', '2500'); });
  await clock(12, 0);

  // 775: the Setup box
  check('Setup has the box: nine reminders, meds with 08:00 and 20:00, quiet hours, add your own', await page.locator('#selfcareBox .sc-row').count() === 9 && await page.locator('#selfcareBox .sc-tm').count() === 2 && await page.locator('#selfcareBox .sc-quiet').count() === 1 && await page.locator('#scNew').count() === 1);
  check('nothing nags before it is switched on', !(await chip()));
  await page.locator('#selfcareBox .sc-main input').check();
  await page.locator('[data-sc="water"] .sc-name input').check();
  const mins = page.locator('[data-sc="water"] .sc-mins'); await mins.fill('1'); await mins.press('Tab');
  check('water set to every 1 min is saved in this browser', await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('aigile.selfcare')); return o.on && o.items.water.on && o.items.water.mins === 1; }));
  await page.locator('#scNew').fill('Call mum'); await page.locator('#scNewMins').fill('45'); await page.locator('.sc-add button').click();
  check('your own reminder is added and can be removed', await page.locator('[data-sc^="c"] .sc-mins').inputValue() === '45');
  await page.locator('[data-sc^="c"] .sc-del').click();
  check('removed again', await page.locator('[data-sc^="c"]').count() === 0);
  await page.reload(); await page.waitForSelector('#selfcareBox .sc-row');
  check('settings survive a reload', await page.locator('[data-sc="water"] .sc-name input').isChecked() && await page.locator('[data-sc="water"] .sc-mins').inputValue() === '1');

  // 776: the chip
  await clock(12, 0); await sleep(1300);
  check('not due yet: no chip', !(await chip()));
  await clock(13, 5);
  check('due: a small chip appears (not a dialog)', await wait(chip) && /glass of water/.test(await page.textContent('#scChip')) && await page.locator('dialog[open], .dialog').count() === 0);
  const names = await page.locator('#scChip button').allTextContents();
  check('chip has Done, Later, Skip (no Let\'s go on water)', ['Done', 'Later', 'Skip'].every(n => names.includes(n)) && !names.includes("Let's go"), names);
  await page.click('#scChip .sc-later');
  check('Later hides it, it comes back after the snooze', !(await chip()) && await wait(chip, 8000));
  await page.click('#scChip .sc-skip');
  check('Skip hides it and is logged as skipped', !(await chip()) && await page.evaluate(d => JSON.parse(localStorage.getItem('aigile.selfcare.log.' + d)).some(e => e.id === 'water' && e.act === 'skip'), await stubDay()));
  await sleep(1500);
  check('after Skip it stays away until the next interval', !(await chip()));
  await clock(14, 10);
  await wait(chip); await page.click('#scChip .sc-done');
  check('Done hides it and logs it', !(await chip()) && await page.evaluate(d => JSON.parse(localStorage.getItem('aigile.selfcare.log.' + d)).some(e => e.id === 'water' && e.act === 'done'), await stubDay()));

  // quiet: break, focus, night, quiet hours
  await clock(15, 20); await wait(chip);
  await page.evaluate(() => Break.start('vape'));
  await sleep(1300);
  check('no nudge while on a break', !(await chip()));
  await page.evaluate(() => Break.end()); await sleep(1300);
  check('it is back after the break', await chip());
  for (const a of ['data-focus', 'data-night']) {
    await page.evaluate(x => document.documentElement.setAttribute(x, ''), a); await sleep(1300);
    check('no nudge with ' + a, !(await chip()));
    await page.evaluate(x => document.documentElement.removeAttribute(x), a); await sleep(1300);
  }
  await patch("o.quiet = { on: true, from: '14:00', to: '17:00' };");
  check('no nudge inside quiet hours', !(await chip()));
  await clock(18, 0);
  check('nudge after quiet hours', await wait(chip));
  await page.click('#scChip .sc-done');

  // shower: Let's go starts shower mode
  await page.locator('[data-sc="water"] .sc-name input').uncheck();
  await page.locator('[data-sc="shower"] .sc-name input').check();
  const sm = page.locator('[data-sc="shower"] .sc-mins'); await sm.fill('1'); await sm.press('Tab');
  await clock(21, 30);
  await wait(async () => /shower/i.test(await page.textContent('#scChip').catch(() => '')));
  const sn = await page.locator('#scChip button').allTextContents();
  check('shower nudge also offers Let\'s go', sn.includes("Let's go"), sn);
  await page.click('#scChip .sc-go');
  await page.waitForSelector('#showerScreen:not([hidden])');
  check('Let\'s go starts shower mode', await page.evaluate(() => document.documentElement.hasAttribute('data-break')));
  await page.click('#brkBack');

  // 777: meds at set times
  await page.locator('[data-sc="shower"] .sc-name input').uncheck();
  await patch('o.quiet.on = false;');
  await clock(7, 0); await page.locator('.sc-meds-box .sc-name input').check();
  await sleep(1300);
  check('meds: nothing before the set time', !(await chip()));
  // an undismissed ordinary reminder does not block meds: meds replace it
  await page.locator('[data-sc="eyes"] .sc-name input').check();
  const em = page.locator('[data-sc="eyes"] .sc-mins'); await em.fill('1'); await em.press('Tab');
  await clock(7, 0); await sleep(1300); await clock(7, 5);
  check('an ordinary reminder is showing before the meds time', await wait(async () => (await chip()) && (await page.getAttribute('#scChip', 'data-id')) === 'eyes'));
  await clock(8, 5);
  check('meds due: they replace the undismissed ordinary reminder', await wait(async () => (await page.getAttribute('#scChip', 'data-id')) === 'meds'));
  await page.locator('[data-sc="eyes"] .sc-name input').uncheck();
  check('meds: nudge at 08:00', await wait(chip) && /Meds time \(08:00\)/.test(await page.textContent('#scChip')));
  const n1 = await page.getAttribute('#scChip', 'data-n');
  await sleep(3500);
  check('meds nudge again every 10 min (stub 2.5 s) until Done', await chip() && Number(await page.getAttribute('#scChip', 'data-n')) > Number(n1));
  await patch("o.quiet = { on: true, from: '00:00', to: '23:59' };");
  check('meds ignore quiet hours', await chip());
  await page.evaluate(() => Break.start('vape')); await sleep(1300);
  check('but not a break', !(await chip()));
  await page.evaluate(() => Break.end()); await sleep(1300);
  await page.click('#scChip .sc-td');
  check('Today popover from the chip lists 08:00 due and 20:00 coming up', await shown('#scToday') && /08:00/.test(await page.textContent('#scToday')) && /coming up/.test(await page.textContent('#scToday')), await page.textContent('#scToday'));
  await page.click('#scToday .sc-x');
  await page.click('#scChip .sc-done');
  const day = await stubDay();
  check('Done ticks aigile.meds.<date> (shared with break.js) once', await page.evaluate(d => localStorage.getItem('aigile.meds.' + d), day) === '1' && !(await chip()));
  await sleep(3000);
  check('after Done it does not come back for that dose', !(await chip()));
  await page.evaluate(() => SelfCare.today());
  const today = await page.textContent('#scToday');
  check('Today lists the tick and the next dose', /Meds taken today: 1/.test(today) && /08:00.*taken/.test(today) && /20:00.*coming up/.test(today), today);
  await page.evaluate(() => SelfCare.todayClose());
  await clock(20, 5);
  check('the 20:00 dose nudges later the same day', await wait(chip) && /20:00/.test(await page.textContent('#scChip')));
  // removing the meds time drops its chip
  await page.evaluate(() => SelfCare.delTime('20:00'));
  check('removing the shown meds time drops the chip', await wait(async () => !(await chip()), 3000));
  await page.evaluate(() => { document.getElementById('scNewTime').value = '20:00'; SelfCare.addTime(); });
  check('adding it back brings the nudge again', await wait(chip));
  // Done in another tab: the chip goes, and a late Done never counts the dose twice
  const day2 = await stubDay(), slot = day2 + ' 20:00';
  const other = (on) => page.evaluate(([d, slot, on]) => {
    const k = 'aigile.selfcare.log.' + d, l = JSON.parse(localStorage.getItem(k) || '[]').filter(e => e.slot !== slot);
    if (on) l.push({ id: 'meds', at: Date.now(), act: 'done', slot });
    localStorage.setItem(k, JSON.stringify(l));
    return k;
  }, [day2, slot, on]);
  const k2 = await other(true);
  await page.evaluate(k => window.dispatchEvent(new StorageEvent('storage', { key: k })), k2);
  check('Done in another tab clears the chip here', await wait(async () => !(await chip()), 3000));
  await other(false); await wait(chip);
  const before = await page.evaluate(d => localStorage.getItem('aigile.meds.' + d), day2);
  await other(true);
  await page.evaluate(() => SelfCare.act('done'));
  check('Done after it was settled elsewhere does not count the dose twice', await page.evaluate(d => localStorage.getItem('aigile.meds.' + d), day2) === before && await page.evaluate(([k, slot]) => JSON.parse(localStorage.getItem(k)).filter(e => e.slot === slot).length, [k2, slot]) === 1);
  await other(false);
  await wait(chip);

  // phone width and dark mode
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => SelfCare.today()); await sleep(200);
  const bc = await page.locator('#scChip').boundingBox(), bt = await page.locator('#scToday').boundingBox();
  check('phone width: chip and Today fit the screen, no sideways scroll', bc.x >= 0 && bc.x + bc.width <= 390 && bt.x >= 0 && bt.x + bt.width <= 390 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), { bc, bt });
  const col = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('scChip')); return { bg: c.backgroundColor, fg: c.color }; });
  const lum = c => { const m = c.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; };
  check('dark mode: the chip is dark with light text', lum(col.bg) < 110 && lum(col.fg) > 140, col);
  await page.locator('#scChip button').first().scrollIntoViewIfNeeded();
  const box = await page.locator('#selfcareBox').boundingBox();
  check('phone width: the Setup box fits', box.x >= 0 && box.x + box.width <= 390, box);
  noErrors(page);
}, true);
