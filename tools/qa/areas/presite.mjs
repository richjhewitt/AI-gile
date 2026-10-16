// QA area: presite (AIG-1320): the aigile.lol pre-teaser. tools/gen/presite.mjs copies site/ files in; the page from file://, fetch
// and EventSource stubbed: the live board moves behind the glass (made-up board when the relay can't be reached, still with reduced
// motion), the button is first after the heading and opens the sealed interest form, people line, 390px, light/dark/black, nl, right-to-left.
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { check, sleep, ROOT, def } from '../lib.mjs';
import { build } from '../../gen/presite.mjs';

const COLUMNS = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'].map(id => ({ id, label: id }));
const SNAP = { at: new Date().toISOString(), viewers: 2, columns: COLUMNS, cards: Array.from({ length: 14 }, (_, i) => ({ id: 'A-' + i, status: COLUMNS[i % 7].id, type: i % 2 ? 'bug' : 'task', len: 3 + (i % 5) })) };

// stub: relay answers (or not), and an EventSource the test can push snapshots into
const stub = ([snap, ok]) => {
  window.fetch = u => { u = String(u); const body = !ok ? null : /\/people\.json$/.test(u) ? { humans: 4, agents: 120, working: 3 } : /\/b\/aigile\.json$/.test(u) ? snap : null;
    return Promise.resolve(body ? { ok: true, json: () => Promise.resolve(body) } : { ok: false, json: () => Promise.reject(new Error('404')) }); };
  window.EventSource = function (u) { this.h = {}; window.__es = this; this.url = u; };
  window.EventSource.prototype.addEventListener = function (k, f) { this.h[k] = f; };
  window.EventSource.prototype.close = function () {};
};
// "rgb(1, 2, 3)" or "color(srgb 0.1 0.2 0.3 / 0.9)" -> relative luminance
const lum = c => { const m = c.match(/[\d.]+/g).map(Number); let [r, g, b] = /^color\(/.test(c) ? m.slice(0, 3) : m.slice(0, 3).map(x => x / 255);
  const f = v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

def('presite', 'aigile.lol pre-teaser (presite/, file://): live board moving behind a light veil, made-up board when offline, button first after the heading opens the interest form, people line, 390px, themes, nl, right-to-left (AIG-1320)', async (s, ctx) => {
  const copied = build();
  check('presite.mjs copies the site files and every language bundle in', ['style.css', 'i18n.js', 'live.js', 'forms.js', 'interest.html', 'privacy.html', 'status.html', 'install-site.sh', 'assets/icon.png', 'lang/en.js', 'lang/languages.js', 'lang/ar.js'].every(f => copied.includes(f) && fs.existsSync(path.join(ROOT, 'presite', f))), copied.length);
  const url = pathToFileURL(path.join(ROOT, 'presite', 'index.html')).href;
  const errs = [];
  const open = async (ok, opts = {}) => {
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
    if (opts.reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
    if (opts.w) await page.setViewportSize({ width: opts.w, height: 844 });
    await page.addInitScript(stub, [SNAP, ok]);
    await page.goto(url); return page;
  };

  // live: the real board behind the glass
  let page = await open(true);
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'live', null, { timeout: 6000 });
  check('heading and line on top; the people line shows the relay counts', (await page.$eval('h1', e => e.textContent)) === "Something's being built here. 🤫" && (await page.$eval('#people-count', e => !e.hidden && e.textContent)) === '👥 4 humans·🤖 120 agents·⚡ 3 at work right now', await page.$eval('#people-count', e => e.textContent));
  check('the live board fills the back with bars, hidden from screen readers and clicks', await page.evaluate(() => { const b = document.getElementById('pre-back'); return b.getAttribute('aria-hidden') === 'true' && b.hasAttribute('inert') && document.querySelectorAll('#live-cols .lv-card').length === 14 && document.querySelectorAll('#live-cols .lv-col').length === 7; }));
  check('the caption says it is the real board', (await page.$eval('#pre-peek', e => e.textContent)).startsWith('Behind the glass: the real board'));
  const veil = await page.evaluate(() => ({ f: getComputedStyle(document.getElementById('pre-back')).filter, bar: document.querySelector('#live-cols .lv-card').getBoundingClientRect().height }));
  check('a light veil: blur of at most 2px, bars big enough to see', /blur\((0|1|1\.\d+|2)px\)/.test(veil.f) && veil.bar >= 14, veil);
  await page.evaluate(snap => { const s = JSON.parse(JSON.stringify(snap)); s.cards[0].status = 'done'; window.__es.h.snapshot({ data: JSON.stringify(s) }); }, SNAP);
  await sleep(100);
  check('a card the relay moves glides to its new column (FLIP glow)', await page.evaluate(() => !!document.querySelector('#live-cols .k-done .lv-card.moved')));
  await page.keyboard.press('Tab');
  const order = [await page.evaluate(() => document.activeElement.id)];
  await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id));
  await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id));
  check('focus order: the button first, then language, then theme', order.join() === 'pre-notify,lang-btn,theme', order);
  // themes: readable text on the card in light, dark and black
  const look = () => page.evaluate(() => { const c = getComputedStyle(document.querySelector('.pre-card')), h = getComputedStyle(document.querySelector('.pre-line')), f = getComputedStyle(document.querySelector('.pre-foot'));
    return { card: c.backgroundColor, text: h.color, foot: f.backgroundColor, ftext: f.color, body: getComputedStyle(document.body).backgroundColor, black: document.documentElement.hasAttribute('data-black') }; });
  const seen = [];
  for (let i = 0; i < 3; i++) { await page.click('#theme'); seen.push(await look()); }
  check('the theme button goes through light, dark and black; text on the card and footer is readable (4.5:1)', new Set(seen.map(x => x.body)).size === 3 && seen.some(x => x.black && x.body === 'rgb(0, 0, 0)') && seen.every(x => ratio(x.card, x.text) >= 4.5 && ratio(x.foot, x.ftext) >= 4.5), seen.map(x => [x.body, ratio(x.card, x.text).toFixed(1), ratio(x.foot, x.ftext).toFixed(1)]));
  await page.click('#pre-notify');
  await page.waitForSelector('form[data-post="/interest"]', { timeout: 5000 });
  check('the button opens the sealed interest form (presite copy, forms.js)', /presite\/interest\.html$/.test(page.url()) && await page.evaluate(() => !!document.querySelector('script[src="forms.js"]') && !!document.querySelector('input[type=email]')));
  await page.close();

  // phone, Dutch, right-to-left
  page = await open(true, { w: 390 });
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'live', null, { timeout: 6000 });
  const fit = () => page.evaluate(() => { const r = document.querySelector('.pre-card').getBoundingClientRect(); return document.documentElement.scrollWidth <= innerWidth && r.left >= 0 && r.right <= innerWidth; });
  check('at 390px: no sideways scroll, the card fits', await fit());
  await page.evaluate(() => SiteI18n.set('nl')); await page.waitForFunction(() => document.documentElement.lang === 'nl');
  check('in Dutch: heading, button and caption', (await page.$eval('h1', e => e.textContent)) === 'Hier wordt iets gebouwd. 🤫' && /opengaat/.test(await page.$eval('#pre-notify', e => e.textContent)) && /Achter het glas/.test(await page.$eval('#pre-peek', e => e.textContent)));
  await page.evaluate(() => SiteI18n.set('ar')); await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  check('right-to-left: the tools move to the left, still no sideways scroll', await fit() && await page.evaluate(() => document.getElementById('lang-btn').getBoundingClientRect().left < innerWidth / 2));
  await page.close();

  // relay down: a made-up board that moves
  page = await open(false);
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'fake', null, { timeout: 8000 });
  const where = () => page.evaluate(() => [...document.querySelectorAll('#pre-fake-cols .lv-col')].map(c => c.querySelectorAll('.lv-card').length).join());
  const a = await where(); await sleep(2700); const b = await where();
  check('relay down: a made-up board shows, says so, and its cards move on their own', (await page.$eval('#pre-fake', e => !e.hidden)) && (await page.evaluate(() => document.getElementById('pre-peek').textContent === SiteI18n.t('pre.peekFake'))) && a !== b, [a, b]);
  check('relay down: the people line stays hidden', await page.$eval('#people-count', e => e.hidden));
  await page.close();

  // reduced motion: nothing moves
  page = await open(false, { reduce: true });
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'fake', null, { timeout: 8000 });
  const c = await where(); await sleep(2800);
  check('reduced motion: the board stands still, the sheet does not drift', c === await where() && await page.$eval('.pre-sheet', e => getComputedStyle(e).animationName === 'none'));
  await page.close();
  check('no page errors', errs.length === 0, errs);
}, true);
