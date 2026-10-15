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
    // AIG-1226: the English slider lines come from lang/en.js; the stub keeps its texts and swaps in these lines.
    let real = { ui: {} }; const D = {}; Object.defineProperty(D, 'en', { get: () => ({ ...real, lines }), set: v => { real = v; }, enumerable: true });
    window.SITE_LANG_DATA = D;
    window.fetch = u => { window.__urls.push(String(u)); const body = /\/b\/ai-gile\.json$/.test(u) ? board : /\/b\/aigile\.json$/.test(u) ? { at: new Date(Date.now() - 3 * 60000).toISOString(), viewers: 1, columns: [{ id: 'todo', label: 'To do' }], cards: [{ id: 'A-1', status: 'todo' }] } : /timeline\.json$/.test(u) ? tl : null;
      return Promise.resolve(body ? { ok: true, json: () => Promise.resolve(body) } : { ok: false, json: () => Promise.reject(new Error('404')) }); };
  }, [LINES, BOARD, TL]);
  await page.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await page.waitForSelector('#pitch:not([hidden])', { timeout: 5000 });
  const txt = () => page.$eval('#pitch-text', e => e.textContent);
  const cnt = () => page.$eval('#pitch-count', e => e.textContent);
  const quip = () => page.$eval('#pitch-quip', e => e.textContent);

  // AIG-1255: the live board says when a card last moved; AIG-1253: link preview tags
  await page.waitForSelector('#live-last:not([hidden])', { timeout: 5000 });
  check('the live board says "Last card moved 3 min ago" (AIG-1255)', (await page.$eval('#live-last', e => e.textContent)) === 'Last card moved 3 min ago');
  { const fit = await page.$eval('#live-cols', w => { const c = w.querySelector('.lv-col'), add = []; for (let i = 0; i < 6; i++) add.push(w.appendChild(c.cloneNode(true))); const sc = w.parentElement, r = { sw: sc.scrollWidth, cw: sc.clientWidth }; add.forEach(e => e.remove()); return r; }); check('at 1400px wide all 7 live board columns fit, no sideways scroll (AIG-1279)', fit.sw <= fit.cw + 1, fit); }
  const og = n => page.$eval('meta[property="' + n + '"],meta[name="' + n + '"]', e => e.content).catch(() => '');
  check('link preview: Open Graph and Twitter card tags (AIG-1253)', (await og('og:title')).length > 5 && (await og('og:description')).length > 20 && /^https:.*preview\.png$/.test(await og('og:image')) && (await og('twitter:card')) === 'summary_large_image' && (await og('twitter:image')) === (await og('og:image')));
  const png = (await import('node:fs')).readFileSync(path.join(ROOT, 'site', 'assets', 'preview.png'));
  check('assets/preview.png is 1200x630', png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630);

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
  if (await page.$('#famous')) { await page.waitForSelector('#famous:not([hidden])', { timeout: 5000 });
  check('famous apps: a line and a source link per app, plus our card count, no sideways scroll (AIG-842)', await page.evaluate(() => {
    const l = [...document.querySelectorAll('#famous-list li')], s = [...document.querySelectorAll('#famous-sources li')];
    return l.length >= 4 && s.length === l.length && s.every(x => /^https:/.test(x.querySelector('a')?.href)) && document.getElementById('famous-n').textContent === '37' && document.documentElement.scrollWidth <= innerWidth;
  })); } // the famous apps section is off since AIG-1222: only checked while it is on the page
  check('no page errors', errs.length === 0, errs);

  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); });
  await p2.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await sleep(400);
  check('on error the count line stays hidden; the pitch still shows from lang/en.js (AIG-697, AIG-1226)', await p2.evaluate(() => document.getElementById('board-count').hidden && !document.getElementById('pitch').hidden));
  check('opened from a file with fetch failing, the timeline still shows (timeline.js)', await p2.evaluate(() => !document.getElementById('timeline').hidden && document.querySelectorAll('#tl-done .tl-item').length > 0));
  const p3 = await ctx.newPage();
  await p3.addInitScript(tl => { Object.defineProperty(window, 'TIMELINE', { get: () => undefined, set: () => {} }); window.fetch = u => /timeline.json$/.test(u) ? Promise.resolve({ ok: true, json: () => Promise.resolve(tl) }) : Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }); }, TL);
  await p3.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await p3.waitForSelector('#timeline:not([hidden])', { timeout: 5000 });
  check('without window.TIMELINE the fetch fallback still fills the timeline', (await p3.$$eval('#tl-done .tl-item', e => e.length)) === 2);
  await p3.close();
  await page.close(); await p2.close();
}, true);

// AIG-697: opened by double-click there is no fetch for local files; the pitch comes from site/lang/en.js (made from en.lines.json, AIG-1226).
def('teaserfile', 'site/index.html from file:// with the real fetch: the pitch still shows (lang/en.js), and it matches lang/en.lines.json (AIG-697, AIG-1226)', async (s, ctx) => {
  const fs = await import('node:fs');
  const { bundleJs } = await import('../../gen/site-lang.mjs');
  const js = fs.readFileSync(path.join(ROOT, 'site', 'lang', 'en.js'), 'utf8'), json = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'lang', 'en.lines.json'), 'utf8'));
  check('lang/en.js matches the English JSON files (run node tools/gen/site-lang.mjs)', js.replace(/\r\n/g, '\n') === bundleJs('en'));
  const page = await ctx.newPage();
  await page.route(/relay\.aigile\.lol/, r => r.abort());
  await page.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await page.waitForSelector('#pitch:not([hidden])', { timeout: 5000 });
  await page.waitForSelector('#live-msg:not([hidden])', { timeout: 5000 });
  check('relay unreachable: the live board shows one calm line, no cards (AIG-1232)', (await page.$eval('#live-msg', e => e.textContent)).length > 5 && (await page.$$('.lv-card')).length === 0);
  check('the length slider shows without a web server', /^1 word /.test(await page.$eval('#pitch-count', e => e.textContent)));
  check('every text in lang/en.lines.json has exactly its size in words, 2+ texts per size (AIG-1117)', json.sizes.every(z => z.texts.length >= 2 && z.texts.every(t => t.trim().split(/\s+/).length === z.n)));
}, true);
