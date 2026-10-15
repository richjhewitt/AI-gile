// QA area: callhold (AIG-1242): no automatic reload or restart while on a call; it runs right after the call ends.
import { check, sleep, openPage, noErrors, def } from '../lib.mjs';

def('callhold', 'reloads and restarts wait while a call is active, note shows, they run after it ends', async (s, ctx) => {
  const page = await openPage(ctx, '#/');
  await page.waitForFunction(() => typeof afterCall === 'function' && typeof Call !== 'undefined');
  check('Call.active() exists and is false off a call', await page.evaluate(() => typeof Call.active === 'function' && Call.active() === false));
  await page.evaluate(() => { window.__ran = 0; afterCall('t', () => { window.__ran++; }); });
  check('off a call it runs at once', await page.evaluate(() => window.__ran) === 1);
  await page.evaluate(() => { window.__live = true; Call.active = () => window.__live; window.__ran = 0; afterCall('t', () => { window.__ran++; }); afterCall('t', () => { window.__ran++; }); });
  await sleep(1500);
  check('on a call it waits', await page.evaluate(() => window.__ran) === 0);
  const note = await page.locator('#callHold').textContent().catch(() => '');
  check('the note says the update waits', /Update waiting until your call ends/.test(note), note);
  const box = await page.locator('#callHold').boundingBox();
  check('the note fits the screen', !!box && box.x >= 0 && box.x + box.width <= page.viewportSize().width);
  await page.evaluate(() => { window.__live = false; });
  await sleep(2000);
  check('after the call it runs once', await page.evaluate(() => window.__ran) === 1);
  check('the note is gone', await page.locator('#callHold').count() === 0);
  noErrors(page);
}, true);
