// QA area: presite (AIG-1320): the aigile.lol pre-teaser. tools/gen/presite.mjs copies site/ files in; the page from file://, fetch
// and EventSource stubbed: the live board moves behind the glass (made-up board when the relay can't be reached, still with reduced
// motion), the button is first after the heading and opens the sealed interest form, people line, 390px, light/dark/black, nl, right-to-left.
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { check, sleep, ROOT, def } from '../lib.mjs';
import { build } from '../../gen/presite.mjs';

const LABELS = ['Backlog', 'To do', 'In progress', 'Team checking', 'For you to test', 'For the team', 'Done'];
const COLUMNS = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'].map((id, i) => ({ id, label: LABELS[i] }));
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

def('presite', 'aigile.lol pre-teaser (presite/, file://): live board moving behind a light veil, made-up board when offline, button first after the heading opens the interest form, people line, 390px, themes, nl, right-to-left (AIG-1320), 🌙 night watchman line and colours (AIG-1388)', async (s, ctx) => {
  const copied = build();
  check('presite.mjs copies the site files and every language bundle in', ['style.css', 'i18n.js', 'live.js', 'forms.js', 'interest.html', 'privacy.html', 'status.html', 'install-site.sh', 'assets/icon.png', 'lang/en.js', 'lang/languages.js', 'lang/ar.js'].every(f => copied.includes(f) && fs.existsSync(path.join(ROOT, 'presite', f))), copied.length);
  const url = pathToFileURL(path.join(ROOT, 'presite', 'index.html')).href;
  const errs = [];
  const open = async (ok, opts = {}) => {
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
    if (opts.reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
    if (opts.w) await page.setViewportSize({ width: opts.w, height: 844 });
    if (opts.words) await page.addInitScript(() => { try { localStorage.setItem('aigile-site-devwords', '1'); localStorage.setItem('aigile-site-lang', 'en'); } catch {} });
    await page.addInitScript(stub, [opts.night ? { ...SNAP, night: opts.night } : SNAP, ok]);
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
  await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id));
  await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id));
  check('focus order: the button first, then 📖 jargon and its Abc switch, language, theme (AIG-1341)', order.join() === 'pre-notify,words-btn,words-ul,lang-btn,theme', order);
  await page.keyboard.press('Tab');
  check('...then the footer links in the same bottom bar (AIG-1343)', await page.evaluate(() => !!document.activeElement.closest('.pre-bar .pre-foot')));
  // AIG-1343: the controls sit in one small bar at the bottom, so nothing on top covers the board's column headings
  const clear = () => page.evaluate(() => {
    const over = [...document.querySelectorAll('.pre-bar,.pre-card,.pre-peek')].map(e => e.getBoundingClientRect());
    const hs = [...document.querySelectorAll('#live-cols .lv-col h3,#pre-fake-cols .lv-col h3')].filter(h => h.offsetParent).map(h => h.getBoundingClientRect());
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const bar = document.querySelector('.pre-bar').getBoundingClientRect(), bell = document.getElementById('pre-notify').getBoundingClientRect();
    return { heads: hs.length, covered: hs.filter(h => over.some(o => hit(h, o))).length, barLow: bar.bottom > innerHeight - 30 && bar.top > innerHeight / 2, bell: !hit(bar, bell), inside: bar.left >= 0 && bar.right <= innerWidth,
      tools: !!document.querySelector('.pre-bar #lang-btn') && !!document.querySelector('.pre-bar #theme') && !!document.querySelector('.pre-bar #words-btn') };
  });
  const cl = await clear();
  check('the column headings at the top are clear: the controls are in a small bar at the bottom of the window', cl.heads === 7 && cl.covered === 0 && cl.barLow && cl.bell && cl.inside && cl.tools, cl);
  let u;
  const upOk = () => page.evaluate(async () => { document.getElementById('lang-btn').click(); await new Promise(r => setTimeout(r, 50));
    const p = document.querySelector('.lang-pop').getBoundingClientRect(), b = document.getElementById('lang-btn').getBoundingClientRect();
    const ok = !document.querySelector('.lang-pop').hidden && p.bottom <= b.top + 1 && p.top >= 0 && p.height > 150 && p.left >= 0 && p.right <= innerWidth && document.activeElement === document.querySelector('.lang-pop input');
    const got = [Math.round(p.top), Math.round(p.bottom), Math.round(b.top)].join();
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return (ok && document.querySelector('.lang-pop').hidden) || got; });
  check('the 🌐 language list opens upwards from the bottom bar, inside the window', (u = await upOk()) === true, u);
  await page.click('#words-btn');
  check('the 📖 jargon dialog opens inside the window', await page.evaluate(() => { const r = document.getElementById('words-dlg').getBoundingClientRect(); return document.getElementById('words-dlg').open && r.top >= 0 && r.bottom <= innerHeight; }));
  await page.keyboard.press('Escape');
  // themes: readable text on the card in light, dark and black
  const look = () => page.evaluate(() => { const c = getComputedStyle(document.querySelector('.pre-card')), h = getComputedStyle(document.querySelector('.pre-line')), f = { backgroundColor: getComputedStyle(document.querySelector('.pre-bar')).backgroundColor, color: getComputedStyle(document.querySelector('.pre-foot')).color };
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
  const cp = await clear();
  check('at 390px: the bottom bar wraps inside the window, covers neither the 🔔 button nor the column headings', cp.heads === 7 && cp.covered === 0 && cp.barLow && cp.bell && cp.inside, cp);
  check('at 390px: the language list opens upwards, inside the window', (u = await upOk()) === true, u);
  await page.evaluate(() => SiteI18n.set('nl')); await page.waitForFunction(() => document.documentElement.lang === 'nl');
  check('in Dutch: heading, button and caption', (await page.$eval('h1', e => e.textContent)) === 'Hier wordt iets gebouwd. 🤫' && /opengaat/.test(await page.$eval('#pre-notify', e => e.textContent)) && /Achter het glas/.test(await page.$eval('#pre-peek', e => e.textContent)));
  await page.evaluate(() => SiteI18n.set('ar')); await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  const rtl = await clear();
  check('right-to-left: the bar flips (theme left of the language button), still at the bottom, no sideways scroll', await fit() && rtl.covered === 0 && rtl.barLow && rtl.bell && rtl.inside && await page.evaluate(() => document.getElementById('theme').getBoundingClientRect().left < document.getElementById('lang-btn').getBoundingClientRect().left), rtl);
  check('right-to-left: the language list opens upwards, inside the window', (u = await upOk()) === true, u);
  await page.close();

  // AIG-1342: 📖 jargon underline on the board behind the glass: Backlog (glossary) and the other column names (own tip),
  // the tip opens on hover and tap through the glass (the board has no pointer events), never through the card; kept on a redraw
  page = await open(true, { words: true });
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'live', null, { timeout: 6000 });
  await page.waitForSelector('#live-cols .k-todo h3 abbr.devw', { timeout: 5000 }).catch(() => {});
  const heads = await page.$$eval('#live-cols .lv-col h3', hs => hs.map(h => { const a = h.querySelector('abbr.devw'); return a ? a.textContent + '=' + (a.getAttribute('data-tip') || '').length : '-'; }));
  check('behind the glass every column heading is underlined with its explanation (Backlog from the glossary, To do... their own)', heads.length === 7 && heads.every(x => x !== '-' && +x.split('=')[1] > 10) && heads[0].startsWith('Backlog') && heads[1].startsWith('To do'), heads);
  check('...not focusable there (the board is inert and hidden from screen readers)', await page.$$eval('#pre-back abbr.devw', e => e.length > 0 && e.every(x => !x.hasAttribute('tabindex'))));
  const ptAt = sel => page.$eval(sel, a => { const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const tipNow = () => page.evaluate(() => { const t = document.getElementById('words-tip'); return t && !t.hidden ? t.textContent : ''; });
  const todoTip = await page.evaluate(() => SiteI18n.t('words.col.todo'));
  let pt = await ptAt('#live-cols .k-todo h3 abbr.devw');
  check('the heading sits under the glass (the top layer is what the pointer hits)', await page.evaluate(p => !document.elementFromPoint(p.x, p.y).closest('#pre-back'), pt));
  await page.mouse.move(pt.x, pt.y);
  check('hover through the glass: the To do tip opens', (await tipNow()) === todoTip && todoTip.length > 10, await tipNow());
  await page.mouse.move(pt.x, pt.y + 120);
  check('moving off it hides the tip', (await tipNow()) === '');
  await page.mouse.click(pt.x, pt.y);
  check('a click (tap) on it through the glass shows the tip too', (await tipNow()) === todoTip);
  const card = await page.$eval('.pre-card', c => { const r = c.getBoundingClientRect(); return { x: r.left + 10, y: r.top + 10 }; });
  await page.mouse.move(card.x, card.y);
  check('over the card on top, the board behind it shows no tip', (await tipNow()) === '');
  await page.evaluate(snap => { const s = JSON.parse(JSON.stringify(snap)); s.cards[1].status = 'done'; window.__es.h.snapshot({ data: JSON.stringify(s) }); }, SNAP);
  await sleep(500);
  check('when live.js redraws the columns, the headings are underlined again', (await page.$$eval('#live-cols .lv-col h3', hs => hs.filter(h => h.querySelector('abbr.devw')).length)) === 7);
  await page.close();
  page = await open(false, { words: true, w: 390 });
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'fake', null, { timeout: 8000 }); await sleep(400);
  check('relay down, at 390px: the made-up board\'s headings are underlined too', (await page.$$eval('#pre-fake-cols .lv-col h3 abbr.devw', e => e.length)) === 7 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  pt = await ptAt('#pre-fake-cols .k-backlog h3 abbr.devw');
  await page.mouse.click(pt.x, pt.y);
  check('a tap on Backlog behind the glass shows its glossary tip', (await tipNow()).length > 10);
  await page.close();

  // 🌙 AIG-1388: the snapshot says night while Rich is quiet: a line under the people count, the night colours; off again when he's back
  page = await open(true, { night: true, w: 390 });
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'live', null, { timeout: 6000 });
  await page.waitForFunction(() => window.__pre.night(), null, { timeout: 3000 }).catch(() => {});
  const faded = async () => { await page.waitForFunction(() => !document.documentElement.hasAttribute('data-nightfade'), null, { timeout: 4000 }).catch(() => {}); await sleep(1000); };   // the soft fade is over
  await faded();
  const nl = () => page.evaluate(() => { const n = document.getElementById('pre-night'), p = document.getElementById('people-count');
    return { on: document.documentElement.hasAttribute('data-night'), shown: !n.hidden && n.offsetParent !== null, text: n.textContent, under: !p.hidden && n.getBoundingClientRect().top >= p.getBoundingClientRect().bottom - 1,
      body: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('.pre-card')).backgroundColor, line: getComputedStyle(document.querySelector('.pre-line')).color,
      ntext: getComputedStyle(n).color, btn: getComputedStyle(document.getElementById('pre-notify')).backgroundColor, btext: getComputedStyle(document.getElementById('pre-notify')).color,
      tc: document.querySelector('meta[name="theme-color"]').content, fade: getComputedStyle(document.body).transitionDuration }; });
  const reddish = c => { const m = (c.match(/[\d.]+/g) || []).map(Number); return m[0] > m[1] && m[1] >= m[2] && m[0] > 120; };
  let ni = await nl();
  check('night snapshot: the line under the people count says the night watchman is in charge', ni.on && ni.shown && ni.under && ni.text === '🌙 The night watchman is in charge', ni);
  check('night colours: near-black page (#0b0605), red-tinted text, readable (4.5:1) on the card and the button', ni.body === 'rgb(11, 6, 5)' && ni.tc === '#0b0605' && reddish(ni.line) && ratio(ni.card, ni.line) >= 4.5 && ratio(ni.card, ni.ntext) >= 4.5 && ratio(ni.btn, ni.btext) >= 4.5 && ni.fade === '0s', ni);   // the fade is over, so a theme click is instant again
  check('night at 390px: no sideways scroll, the card fits', await fit());
  await page.evaluate(() => SiteI18n.set('nl')); await page.waitForFunction(() => document.documentElement.lang === 'nl');
  check('night in Dutch: the line is translated', (await page.$eval('#pre-night', e => e.textContent)) === '🌙 De nachtwaker heeft nu de leiding');
  await page.evaluate(snap => window.__es.h.snapshot({ data: JSON.stringify(snap) }), SNAP);
  await sleep(50); await faded();
  ni = await nl();
  check('Rich is back (no night in the snapshot): the line hides and the colours go back', !ni.on && !ni.shown && ni.body !== 'rgb(11, 6, 5)' && ni.tc === '#12151b', ni);
  await page.evaluate(snap => window.__es.h.snapshot({ data: JSON.stringify({ ...snap, night: true }) }), SNAP);
  check('a live snapshot with night turns it on again without a reload, with a soft fade', await page.waitForFunction(() => window.__pre.night() && !document.getElementById('pre-night').hidden, null, { timeout: 3000 }).then(() => true, () => false) && await page.evaluate(() => document.documentElement.hasAttribute('data-nightfade') && parseFloat(getComputedStyle(document.body).transitionDuration) > 0.3));
  await page.close();
  page = await open(true, { night: 'yes' });
  await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'live', null, { timeout: 6000 }); await sleep(200);
  check('only night === true counts (anything else stays day)', !(await page.evaluate(() => window.__pre.night())) && await page.$eval('#pre-night', e => e.hidden));
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
  // AIG-1445: every screen size, phone to 4K, by day and by night (the card is taller then): no sideways scroll, the whole
  // card on screen, the button and the bar's buttons at least 44px tall
  const SIZES = ['320x568', '360x740', '375x667', '390x844', '414x896', '430x932', '844x390', '667x375', '768x1024', '1024x768', '1366x768', '1440x900', '1920x1080', '2560x1440', '3840x2160'];
  const bad = [];
  for (const nightOn of [false, true]) {
    page = await open(true, { night: nightOn || undefined });
    await page.waitForFunction(() => window.__pre && window.__pre.mode() === 'live', null, { timeout: 6000 });
    if (nightOn) await page.waitForFunction(() => window.__pre.night() && !document.getElementById('people-count').hidden, null, { timeout: 3000 }).catch(() => {});
    for (const sz of SIZES) {
      const [w, h] = sz.split('x').map(Number);
      await page.setViewportSize({ width: w, height: h }); await sleep(60);
      const r = await page.evaluate(() => { const c = document.querySelector('.pre-card').getBoundingClientRect(), b = document.getElementById('pre-notify').getBoundingClientRect();
        const small = [...document.querySelectorAll('.pre-tools button')].filter(x => x.offsetParent && x.getBoundingClientRect().height < 44).map(x => x.id);
        return { side: document.documentElement.scrollWidth <= innerWidth, card: c.left >= 0 && c.top >= 0 && c.right <= innerWidth + 0.5 && c.bottom <= innerHeight + 0.5, btn: Math.round(b.height), small }; });
      if (!r.side || !r.card || r.btn < 44 || r.small.length) bad.push({ sz, night: nightOn, ...r });
    }
    await page.close();
  }
  check('every size from 320x568 to 3840x2160, day and night: no sideways scroll, the card fully on screen, the button and bar buttons at least 44px tall (AIG-1445)', bad.length === 0, bad);
  check('no page errors', errs.length === 0, errs);
}, true);
