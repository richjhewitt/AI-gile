// QA area: daystart (AIG-678): Setup asks when your day starts (default 09:00) and optionally when it stops; saved in the owner's
// settings, kept over a reload, and Going quiet's "until" box starts at it. Phone width and dark mode.
import { check, sleep, openPage, noErrors, def } from '../lib.mjs';

def('daystart', '🌅 Setup: when your day starts and stops (default 09:00), saved, kept on reload, Going quiet uses it, phone + dark (AIG-678)', async (s, ctx) => {
  await s.ok('POST', '/api/setup', { prefs: { day: { start: '' } } });   // AIG-1150: the QA board starts its day at 00:00 (AIG-1063); clear it to see the real default
  let st = await s.ok('GET', '/api/setup');
  check('default: day starts 09:00, no stop time', st.prefs.day.start === '09:00' && st.prefs.day.stop === '');
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#pf-day-start');
  check('Setup shows 09:00 by default', await page.inputValue('#pf-day-start') === '09:00' && await page.inputValue('#pf-day-stop') === '');
  await page.fill('#pf-day-start', '06:30'); await sleep(600);
  await page.fill('#pf-day-stop', '21:15'); await sleep(600);
  st = await s.ok('GET', '/api/setup');
  check('saved in the owner settings', st.prefs.day.start === '06:30' && st.prefs.day.stop === '21:15', JSON.stringify(st.prefs.day));
  await page.reload(); await page.waitForSelector('#pf-day-start'); await sleep(500);
  check('kept after a reload', await page.inputValue('#pf-day-start') === '06:30' && await page.inputValue('#pf-day-stop') === '21:15');
  const r = await s.api('POST', '/api/setup', { prefs: { day: { start: '25:99' } } });
  check('a bad time is refused and the old one stays', r.status === 400 && (await s.ok('GET', '/api/setup')).prefs.day.start === '06:30', String(r.status));

  await page.goto(page.url().split('#')[0] + '#/'); await page.waitForSelector('#app > *'); await sleep(800);
  await page.evaluate(() => goQuiet()); await page.waitForSelector('#quietUntil');
  check('Going quiet ends at your start time', await page.inputValue('#quietUntil') === '06:30');
  await page.evaluate(() => closeDialog());

  await page.goto(page.url().split('#')[0] + '#/setup'); await page.waitForSelector('#pf-day-start');
  await page.setViewportSize({ width: 390, height: 800 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await sleep(300);
  await page.locator('#pf-day').scrollIntoViewIfNeeded();
  check('phone width: no sideways scroll, the boxes fit', await page.evaluate(() => { const r = document.getElementById('pf-day-stop').getBoundingClientRect(); return document.documentElement.scrollWidth <= window.innerWidth + 1 && r.right <= window.innerWidth && r.left >= 0; }));
  check('dark mode: the time box is not white', await page.evaluate(() => { const c = getComputedStyle(document.getElementById('pf-day-start')).backgroundColor.match(/\d+/g).map(Number); return c[0] + c[1] + c[2] < 600; }));
  await page.screenshot({ path: 'R:/wt/shot-aig678-daystart.png' }).catch(() => {});
  await noErrors(page);
}, true);
