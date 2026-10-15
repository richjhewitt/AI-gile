// QA area: immersion (AIG-722..725). Setup ticks learning languages, the 🌍 button flips the board, a weekday language and the random pick start the board in one.
import { check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('immersion', 'Language immersion: learning languages, the 🌍 button, language days, random mode (AIG-722..725)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#immBox .imm-l');
  const ls = k => page.evaluate(k => localStorage.getItem(k), k);
  const wait = () => page.waitForFunction(() => typeof i18n !== 'undefined' && i18n.ready);
  const vis = () => page.evaluate(() => !document.getElementById('immWrap').hidden && getComputedStyle(document.getElementById('immWrap')).display !== 'none');
  const reloadTo = async () => { await page.reload(); await wait(); };
  // normal language is English here
  await page.evaluate(() => { localStorage.setItem('aigile.lang', 'en'); localStorage.removeItem('aigile.immDay'); });
  await reloadTo();
  await page.waitForSelector('#immBox .imm-l');

  check('722: Setup lists the board languages to tick (more than Dutch)', await page.locator('#immBox .imm-l').count() >= 3);
  check('hidden while none are ticked', !(await vis()));
  await page.locator('#immBox [data-imm="nl"]').check();
  check('722: ticking saves aigile.learning', JSON.parse(await ls('aigile.learning')).join() === 'nl');
  check('the 🌍 button shows with one language', await vis());
  check('one language: no dropdown arrow', await page.locator('#immMore').isHidden());

  // 723 flip and back
  await page.locator('#immBtn').click(); await wait();
  check('723: one tap puts the board in Dutch', await page.evaluate(() => i18n.lang === 'nl' && document.documentElement.lang === 'nl'));
  await page.locator('#immBtn').click(); await wait();
  check('723: tap again goes back to English', await page.evaluate(() => i18n.lang === 'en'));

  // two languages: dropdown
  await page.goto(page.url().split('#')[0] + '#/setup'); await page.waitForSelector('#immBox .imm-l');
  await page.locator('#immBox [data-imm="de"]').check();
  check('723: two languages: dropdown arrow shows', await page.locator('#immMore').isVisible());
  await page.locator('#immMore').click();
  check('the list holds both learning languages', await page.locator('#immList button').count() === 2);
  await page.locator('#immList [data-imm="de"]').click(); await wait();
  check('723: the list switches to the chosen one', await page.evaluate(() => i18n.lang === 'de'));
  await page.locator('#immMore').click();
  check('in a learning language the list has a way back', await page.locator('#immList button[data-imm=""]').count() === 1);
  await page.locator('#immList button[data-imm=""]').click(); await wait();
  check('back to English from the list', await page.evaluate(() => i18n.lang === 'en'));

  // phone width and dark mode
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.emulateMedia({ colorScheme: 'dark' });
  check('dark mode: the button is visible', await vis());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 800 });

  // 724 language days
  await page.goto(page.url().split('#')[0] + '#/setup'); await page.waitForSelector('#immBox .imm-d');
  check('724: a select per weekday', await page.locator('#immBox .imm-d select').count() === 7);
  const dow = await page.evaluate(() => new Date().getDay());
  await page.locator(`#immBox select[data-day="${dow}"]`).selectOption('nl');
  check('724: saves aigile.langDays', JSON.parse(await ls('aigile.langDays'))[dow] === 'nl');
  await page.evaluate(() => { localStorage.removeItem('aigile.immDay'); localStorage.removeItem('aigile.immNow'); });
  await reloadTo();
  check('724: on that day the board starts in Dutch', await page.evaluate(() => i18n.lang === 'nl'));
  await page.reload(); await wait();
  await page.locator('#immBtn').click(); await wait();
  await page.reload(); await wait();
  check('going back by hand sticks for the rest of the day', await page.evaluate(() => i18n.lang === 'en'));

  // 725 random
  await page.evaluate(d => { const o = JSON.parse(localStorage.getItem('aigile.langDays')); delete o[d]; localStorage.setItem('aigile.langDays', JSON.stringify(o)); localStorage.removeItem('aigile.immDay'); localStorage.removeItem('aigile.immNow'); }, dow);
  await page.goto(page.url().split('#')[0] + '#/setup'); await page.waitForSelector('#immRandom');
  await page.locator('#immRandom').check();
  check('725: saves aigile.langRandom', await ls('aigile.langRandom') === '1');
  await reloadTo();
  const first = await page.evaluate(() => i18n.lang);
  check('725: random starts the board in a learning language', first === 'nl' || first === 'de', first);
  await page.evaluate(() => localStorage.removeItem('aigile.immNow'));
  await reloadTo();
  check('725: same day, no new pick (stays as chosen)', await page.evaluate(() => i18n.lang === 'en'));
  await page.evaluate(() => { localStorage.removeItem('aigile.immDay'); localStorage.removeItem('aigile.immNow'); });
  await reloadTo();
  check('725: the pick is the same all day (keyed on the date)', await page.evaluate(() => i18n.lang) === first);

  // unticking everything hides the button
  await page.evaluate(() => { localStorage.removeItem('aigile.learning'); localStorage.removeItem('aigile.immNow'); });
  await reloadTo();
  check('hidden again with none ticked', !(await vis()));
  noErrors(page);
}, true);
