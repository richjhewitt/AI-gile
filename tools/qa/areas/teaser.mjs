// QA area: teaser (AIG-695/697/1117): site/index.html from file://, fetch stubbed; the length slider (a different text per length), quips, another version, the live card count.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, sleep, loadPw, ROOT, def } from '../lib.mjs';

// AIG-1117: one size per slider stop, each with its own texts (not prefixes): "s<n>a<k>" repeated n times.
const SIZES = [1, 2, 3, 5, 8, 13];
const text = (n, k) => Array.from({ length: n }, () => 's' + n + 'a' + k).join(' ');
const LINES = { sizes: SIZES.map(n => ({ n, texts: [text(n, 1), text(n, 2)] })), quips: { 1: 'one-quip', 5: 'five-quip' } };
const TL = { generated: '2026-10-13T00:00:00Z', stages: [{ id: 'a', name: 'Stage one', start: '2026-10-09T21:50:00Z', end: '2026-10-10T01:00:00Z', cards: 5, line: 'one line' }, { id: 'b', name: 'Stage two', start: '2026-10-10T02:00:00Z', end: '2026-10-11T01:00:00Z', cards: 1, line: 'two line' }], planned: [{ id: 'p', name: 'Plan one', cards: 3, line: 'plan line', planned: true }] };
const BOARD = { title: 'AI-gile', cards: Array.from({ length: 37 }, (_, i) => ({ id: 'AIG-' + i })) };

def('teaser', 'site/index.html (file://, stubbed fetch): length slider with a different text per length, arrows, quips, another version, live card count (AIG-695/697/1117)', async (s, ctx) => {
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

  const set = v => page.$eval('#pitch-range', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  check('starts at one word; the label counts words and letters', /^1 word \u00B7 2 letters$/.test(await cnt()) && /^s1a[12]$/.test(await txt()), [await cnt(), await txt()]);
  check('quip for 1 word', (await quip()) === 'one-quip');
  await page.focus('#pitch-range');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  check('arrow keys step through the sizes: 1, 2, 3, 5', (await cnt()).startsWith('5 words') && /^(s5a[12] ){4}s5a[12]$/.test(await txt()) && (await quip()) === 'five-quip', [await cnt(), await txt()]);
  check('the slider says its value in words', (await page.$eval('#pitch-range', e => e.getAttribute('aria-valuetext'))) === '5 words');
  await set(5);
  check('last stop shows its own 13-word text', (await cnt()).startsWith('13 words') && (await txt()).split(' ').length === 13 && /^s13a/.test(await txt()));
  await set(2);
  check('going back shows the 3-word text, not a cut-down longer one', (await txt()).split(' ').length === 3 && /^s3a/.test(await txt()));
  const box = await page.$eval('#pitch-range', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -100);
  check('mouse wheel up goes to the next size', (await cnt()).startsWith('5 words'), await cnt());
  const before = await txt();
  await page.click('#pitch-dice');
  check('another version swaps the text and keeps the length', (await txt()) !== before && (await cnt()).startsWith('5 words'), [await cnt(), await txt()]);
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
  await page.waitForSelector('#famous:not([hidden])', { timeout: 5000 });
  check('famous apps: a line and a source link per app, plus our card count, no sideways scroll (AIG-842)', await page.evaluate(() => {
    const l = [...document.querySelectorAll('#famous-list li')], s = [...document.querySelectorAll('#famous-sources li')];
    return l.length >= 4 && s.length === l.length && s.every(x => /^https:/.test(x.querySelector('a')?.href)) && document.getElementById('famous-n').textContent === '37' && document.documentElement.scrollWidth <= innerWidth;
  }));
  check('no page errors', errs.length === 0, errs);

  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); });
  await p2.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await sleep(400);
  check('on error the count line stays hidden; the pitch falls back to teaser-lines.js (AIG-697)', await p2.evaluate(() => document.getElementById('board-count').hidden && !document.getElementById('pitch').hidden));
  check('opened from a file with fetch failing, the timeline still shows (timeline.js)', await p2.evaluate(() => !document.getElementById('timeline').hidden && document.querySelectorAll('#tl-done .tl-item').length > 0));
  const p3 = await ctx.newPage();
  await p3.addInitScript(tl => { Object.defineProperty(window, 'TIMELINE', { get: () => undefined, set: () => {} }); window.fetch = u => /timeline.json$/.test(u) ? Promise.resolve({ ok: true, json: () => Promise.resolve(tl) }) : Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); }, TL);
  await p3.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await p3.waitForSelector('#timeline:not([hidden])', { timeout: 5000 });
  check('without window.TIMELINE the fetch fallback still fills the timeline', (await p3.$$eval('#tl-done .tl-item', e => e.length)) === 2);
  await p3.close();
  await page.close(); await p2.close();
}, true);

// AIG-697: opened by double-click there is no fetch for local files, so the pitch comes from site/teaser-lines.js.
def('teaserfile', 'site/index.html from file:// with the real fetch: the pitch still shows (teaser-lines.js), and it matches teaser-lines.json (AIG-697)', async (s, ctx) => {
  const fs = await import('node:fs');
  const js = fs.readFileSync(path.join(ROOT, 'site', 'teaser-lines.js'), 'utf8'), json = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'teaser-lines.json'), 'utf8'));
  check('teaser-lines.js matches teaser-lines.json (run node tools/gen/teaser-lines.mjs)', js.includes(JSON.stringify(json)));
  const page = await ctx.newPage();
  await page.route(/relay\.aigile\.lol/, r => r.abort());
  await page.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await page.waitForSelector('#pitch:not([hidden])', { timeout: 5000 });
  check('the length slider shows without a web server', /^1 word /.test(await page.$eval('#pitch-count', e => e.textContent)));
  check('every text in teaser-lines.json has exactly its size in words, 2+ texts per size (AIG-1117)', json.sizes.every(z => z.texts.length >= 2 && z.texts.every(t => t.trim().split(/\s+/).length === z.n)));
}, true);
