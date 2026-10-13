// QA area: teaser (AIG-695/697): site/index.html from file://, fetch stubbed; the word slider, quips, another version, the live card count.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, sleep, loadPw, ROOT, def } from '../lib.mjs';

const words = p => Array.from({ length: 200 }, (_, i) => p + (i + 1)).join(' ');
const LINES = { versions: [{ id: 'a', title: 'A', words: words('a') }, { id: 'b', title: 'B', words: words('b') }], quips: { 1: 'one-quip', 10: 'ten-quip', 100: 'hundred-quip' } };
const TL = { generated: '2026-10-13T00:00:00Z', stages: [{ id: 'a', name: 'Stage one', start: '2026-10-09T21:50:00Z', end: '2026-10-10T01:00:00Z', cards: 5, line: 'one line' }, { id: 'b', name: 'Stage two', start: '2026-10-10T02:00:00Z', end: '2026-10-11T01:00:00Z', cards: 1, line: 'two line' }], planned: [{ id: 'p', name: 'Plan one', cards: 3, line: 'plan line', planned: true }] };
const BOARD = { title: 'AI-gile', cards: Array.from({ length: 37 }, (_, i) => ({ id: 'AIG-' + i })) };

def('teaser', 'site/index.html (file://, stubbed fetch): word slider from 1 to 200, arrows, quips, another version, live card count (AIG-695/697)', async (s, ctx) => {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(([lines, board, tl]) => {
    window.__urls = [];
    Object.defineProperty(window, 'TIMELINE', { get: () => tl, set: () => {} });   // the page's timeline.js must not replace the stub
    window.fetch = u => { window.__urls.push(String(u)); const body = /\/b\/ai-gile\.json$/.test(u) ? board : /teaser-lines\.json$/.test(u) ? lines : /timeline\.json$/.test(u) ? tl : null;
      return Promise.resolve(body ? { ok: true, json: () => Promise.resolve(body) } : { ok: false, json: () => Promise.reject(new Error('404')) }); };
  }, [LINES, BOARD, TL]);
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
  await page.waitForSelector('#timeline:not([hidden])', { timeout: 5000 });
  const items = await page.$$eval('#tl-done .tl-item', els => els.map(e => e.textContent));
  check('timeline renders its stages in order', items.length === 2 && /Stage one/.test(items[0]) && /Stage two/.test(items[1]) && /5 cards/.test(items[0]) && /1 card\b/.test(items[1]), items);
  check('stage dates are real, in the visitor locale', await page.$$eval('#tl-done time', ts => ts.length === 4 && ts.every(t => t.textContent.length > 3 && !isNaN(new Date(t.getAttribute('datetime'))))));
  const planned = await page.$$eval('#tl-planned .tl-item', els => els.map(e => ({ t: e.textContent, tag: !!e.querySelector('.tl-tag'), times: e.querySelectorAll('time').length })));
  check('planned part is marked planned and has no dates', planned.length === 1 && planned[0].tag && /planned/.test(planned[0].t) && planned[0].times === 0, planned);
  check('Today marker sits between done and planned', await page.evaluate(() => { const y = id => document.getElementById(id).getBoundingClientRect().top; return y('tl-done') < y('tl-today') && y('tl-today') < y('tl-planned'); }));
  check('timeline fits at phone width in dark mode', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.querySelector('.tl-item')).backgroundColor !== 'rgb(238, 240, 243)'));
  check('no page errors', errs.length === 0, errs);

  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); });
  await p2.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await sleep(400);
  check('on error the count line and the pitch stay hidden', await p2.evaluate(() => document.getElementById('board-count').hidden && document.getElementById('pitch').hidden));
  check('opened from a file with fetch failing, the timeline still shows (timeline.js)', await p2.evaluate(() => !document.getElementById('timeline').hidden && document.querySelectorAll('#tl-done .tl-item').length > 0));
  const p3 = await ctx.newPage();
  await p3.addInitScript(tl => { Object.defineProperty(window, 'TIMELINE', { get: () => undefined, set: () => {} }); window.fetch = u => /timeline.json$/.test(u) ? Promise.resolve({ ok: true, json: () => Promise.resolve(tl) }) : Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); }, TL);
  await p3.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await p3.waitForSelector('#timeline:not([hidden])', { timeout: 5000 });
  check('without window.TIMELINE the fetch fallback still fills the timeline', (await p3.$$eval('#tl-done .tl-item', e => e.length)) === 2);
  await p3.close();
  await page.close(); await p2.close();
}, true);
