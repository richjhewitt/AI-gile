// QA area: blacktheme (AIG-916). The Black theme in the theme picker: true #000 page, no grey panels, saved choice.
import { check, sleep, openPage, def } from '../lib.mjs';

def('blacktheme', '⚫ Black theme for OLED: in the Setup picker and the top bar cycle, #000 page and panels, dim text (AIG-916)', async (s, ctx) => {
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('select.setup-theme');
  const opts = await page.$$eval('select.setup-theme option', o => o.map(x => x.value));
  opts.length = Math.min(opts.length, 4);
  check('the Setup theme picker has system, light, dark, black in order', opts.join() === 'system,light,dark,black', opts.join());
  await page.selectOption('select.setup-theme', 'black'); await sleep(300);
  const look = () => page.evaluate(() => {
    const cs = n => getComputedStyle(n).backgroundColor, h = document.querySelector('header');
    return { attr: document.documentElement.dataset.theme || '', body: cs(document.body), header: cs(h), text: getComputedStyle(document.body).color, saved: localStorage.getItem('aigile.theme') };
  });
  let l = await look();
  check('black: page and top bar are rgb(0, 0, 0)', l.attr === 'black' && l.body === 'rgb(0, 0, 0)' && l.header === 'rgb(0, 0, 0)', JSON.stringify(l));
  check('black: text is dim, not white', l.text !== 'rgb(255, 255, 255)' && l.text !== 'rgb(230, 233, 239)', l.text);
  check('black is remembered', l.saved === 'black');
  await page.reload(); await page.waitForSelector('#themeBtn'); await sleep(300);
  l = await look();
  check('black survives a reload', l.attr === 'black' && l.body === 'rgb(0, 0, 0)', JSON.stringify(l));
  // AIG-1291: black from the first paint, before app.js has loaded (a restart used to flash the system colours first)
  {
    const c2 = await ctx.browser().newContext({ serviceWorkers: 'block' }), p2 = await c2.newPage();
    await p2.addInitScript(() => { try { localStorage.setItem('aigile.theme', 'black'); } catch {} });
    let release; const held = new Promise(r => { release = r; });
    await p2.route('**/js/app.js*', async route => { await held; await route.continue(); });
    await p2.goto(page.url().split('#')[0], { waitUntil: 'commit' });
    await p2.waitForSelector('body', { state: 'attached' }); await sleep(500);
    const early = await p2.evaluate(() => ({ attr: document.documentElement.dataset.theme || '', body: getComputedStyle(document.body).backgroundColor, app: typeof theme === 'function' }));
    release(); await c2.close();
    check('black is there before app.js loads: no flash of the system colours on a restart (AIG-1291)', !early.app && early.attr === 'black' && early.body === 'rgb(0, 0, 0)', JSON.stringify(early));
  }
  const label = (await page.textContent('#themeBtn')).trim();
  check('the top bar button names it', /Black|Zwart/.test(label), label);
  await page.click('#themeBtn'); await sleep(200);
  check('clicking the button after Black goes back to System', (await look()).attr === '');
  await page.close();
  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  await ph.addInitScript(() => { try { localStorage.setItem('aigile.theme', 'black'); } catch {} });
  const pp = await openPage(ph, '#/setup');
  const fit = await pp.evaluate(() => ({ w: document.documentElement.scrollWidth, bg: getComputedStyle(document.body).backgroundColor }));
  check('phone width, black: no sideways scroll, page is #000', fit.w <= 390 && fit.bg === 'rgb(0, 0, 0)', JSON.stringify(fit));
  await ph.close();
}, true);
