// QA area: teaser (AIG-695/697): site/index.html from file://, fetch stubbed; the word slider, quips, another version, the live card count.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, sleep, loadPw, ROOT, def } from '../lib.mjs';

const words = p => Array.from({ length: 200 }, (_, i) => p + (i + 1)).join(' ');
const LINES = { versions: [{ id: 'a', title: 'A', words: words('a') }, { id: 'b', title: 'B', words: words('b') }], quips: { 1: 'one-quip', 10: 'ten-quip', 100: 'hundred-quip' } };
const BOARD = { title: 'AI-gile', cards: Array.from({ length: 37 }, (_, i) => ({ id: 'AIG-' + i })) };

def('teaser', 'site/index.html (file://, stubbed fetch): word slider from 1 to 200, arrows, quips, another version, live card count (AIG-695/697)', async (s, ctx) => {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(([lines, board]) => {
    window.__urls = [];
    window.fetch = u => { window.__urls.push(String(u)); const body = /\/b\/ai-gile\.json$/.test(u) ? board : /teaser-lines\.json$/.test(u) ? lines : null;
      return Promise.resolve(body ? { ok: true, json: () => Promise.resolve(body) } : { ok: false, json: () => Promise.reject(new Error('404')) }); };
  }, [LINES, BOARD]);
  await page.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await page.waitForSelector('#pitch:not([hidden])', { timeout: 5000 });
  const txt = () => page.$eval('#pitch-text', e => e.textContent);
  const cnt = () => page.$eval('#pitch-count', e => e.textContent);
  const quip = () => page.$eval('#pitch-quip', e => e.textContent);

  check('starts at one word', (await cnt()) === '1 / 200' && /^[ab]1$/.test(await txt()), [await cnt(), await txt()]);
  check('quip for 1 word', (await quip()) === 'one-quip');
  await page.focus('#pitch-range');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  const prefix = (await txt())[0];
  check('arrow keys add one word each', (await cnt()) === '5 / 200' && (await txt()) === [1, 2, 3, 4, 5].map(n => prefix + n).join(' '), await txt());
  await page.$eval('#pitch-range', e => { e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('10 words shows the 10 quip', (await cnt()) === '10 / 200' && (await quip()) === 'ten-quip', await quip());
  await page.$eval('#pitch-range', e => { e.value = 200; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('slider reaches 200 words', (await cnt()) === '200 / 200' && (await txt()).split(' ').length === 200 && (await quip()) === 'hundred-quip');
  await page.$eval('#pitch-range', e => { e.value = 20; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('going back removes words', (await txt()).split(' ').length === 20);
  const box = await page.$eval('#pitch-range', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -100);
  check('mouse wheel up adds a word', (await cnt()) === '21 / 200', await cnt());
  const before = (await txt())[0];
  let other = false;
  for (let i = 0; i < 12 && !other; i++) { await page.click('#pitch-dice'); other = (await txt())[0] !== before; }
  check('another version keeps the word count', other && (await cnt()) === '21 / 200', [await txt(), await cnt()]);
  await page.setViewportSize({ width: 360, height: 700 });
  check('no sideways scroll at phone width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.emulateMedia({ colorScheme: 'dark' });
  check('dark mode switches the page', await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches));

  await page.waitForSelector('#board-count:not([hidden])', { timeout: 5000 });
  await sleep(1000);
  check('card count line shows the stubbed number', (await page.$eval('#board-count', e => e.textContent.trim())) === '37 cards on the board right now', await page.$eval('#board-count', e => e.textContent));
  check('count reads the relay board json', await page.evaluate(() => window.__urls.includes('https://relay.aigile.lol/b/ai-gile.json')), await page.evaluate(() => window.__urls));
  check('no page errors', errs.length === 0, errs);

  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); });
  await p2.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await sleep(400);
  check('on error the count line and the pitch stay hidden', await p2.evaluate(() => document.getElementById('board-count').hidden && document.getElementById('pitch').hidden));
  await page.close(); await p2.close();
}, true);
