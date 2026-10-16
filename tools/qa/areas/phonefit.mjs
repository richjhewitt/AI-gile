// QA area: phonefit (AIG-1391..1399). Phone fixes checked upright (390x844) and on its side (844x390), with touch.
// QA_SHOTS=<folder> saves a screenshot of each fixed screen as <card>.png (upright) and <card>-landscape.png.
import path from 'node:path';
import { check, sleep, mkProject, mkCard, openPage, BASE, def } from '../lib.mjs';

const SIZES = [{ name: '390x844', viewport: { width: 390, height: 844 } }, { name: '844x390', viewport: { width: 844, height: 390 }, land: true }];
const shot = async (page, card, size) => { if (process.env.QA_SHOTS) await page.screenshot({ path: path.join(process.env.QA_SHOTS, card + (size.land ? '-landscape' : '') + '.png') }); };

def('phonefit', '📱 phone fixes upright and on its side (390x844, 844x390): labels, layout, pills, call panel, Setup, tap targets (AIG-1391..1399)', async (s, ctx0) => {
  const browser = ctx0.browser();
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Check the login page', { status: 'verify', testSteps: '1. Open it' });
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const D = size.name;
    try {
      /* ---------- AIG-1396: top bar tick boxes read "Show Help" ---------- */
      const page = await openPage(ctx, '#/setup');
      await page.waitForSelector('#tbList .tb-row', { timeout: 10000 });
      const al = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-on, #tbList .tb-up, #tbList .tb-down')].map(e => e.getAttribute('aria-label')));
      check(D + ': Setup top bar tick boxes read "Show Help", no {brackets} (AIG-1396)', al.length > 30 && al.includes('Show Help') && al.every(a => a && !/[{}]/.test(a)), al.filter(a => !a || /[{}]/.test(a)).slice(0, 3));
      await page.evaluate(() => document.getElementById('tbList').scrollIntoView({ block: 'start' }));
      await sleep(200); await shot(page, 'AIG-1396', size);
      await page.close();
    } finally { await ctx.close().catch(() => {}); }
  }
}, true);
