// QA area: teaser (AIG-695/697/1117): site/index.html from file://, fetch stubbed; the length slider (a different text per length), quips, another version, the live card count.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, sleep, loadPw, ROOT, def } from '../lib.mjs';

// AIG-1117: one size per slider stop, each with its own texts (not prefixes): "s<n>a<k>" repeated n times.
const SIZES = [1, 2, 3, 5, 8, 13];
const text = (n, k) => Array.from({ length: n }, () => 's' + n + 'a' + k).join(' ');
const LINES = { sizes: SIZES.map(n => ({ n, texts: [text(n, 1), text(n, 2)] })), quips: { 1: 'one-quip', 5: 'five-quip' } };
const TL = { generated: '2026-10-13T00:00:00Z', stages: [{ id: 'a', name: 'Stage one', start: '2026-10-09T21:50:00Z', end: '2026-10-10T01:00:00Z', cards: 5, line: 'one line' }, { id: 'b', name: 'Stage two', start: '2026-10-10T02:00:00Z', end: '2026-10-11T01:00:00Z', cards: 1, line: 'two line' }], planned: [{ id: 'd', name: 'Doing one', cards: 4, line: 'doing line', planned: true, doing: true, built: 2 }, { id: 'p', name: 'Plan one', cards: 3, line: 'plan line', planned: true }] };
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
  check('the ChilledChat credit lives in the call itself, not the teaser footer (AIG-1312)', !(await page.$('footer [data-i18n="footer.thanks"]')));
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
  check('after Today: the in-progress stage first, then the planned one, tagged and with no dates (AIG-1323)', planned.length === 2 && /Doing one/.test(planned[0].t) && /in progress/.test(planned[0].t) && /Plan one/.test(planned[1].t) && /planned/.test(planned[1].t) && planned.every(p => p.tag && p.times === 0), planned);
  check('the in-progress stage looks different from a planned one (AIG-1323)', await page.$$eval('#tl-planned .tl-item', els => els[0].classList.contains('doing') && !els[0].classList.contains('planned') && els[1].classList.contains('planned') && getComputedStyle(els[0]).borderStyle !== getComputedStyle(els[1]).borderStyle));
  check('Today marker sits between done and planned', await page.evaluate(() => { const y = id => document.getElementById(id).getBoundingClientRect().top; return y('tl-done') < y('tl-today') && y('tl-today') < y('tl-planned'); }));
  check('timeline fits at phone width in dark mode', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.querySelector('.tl-item')).backgroundColor !== 'rgb(238, 240, 243)'));
  if (await page.$('#famous')) { await page.waitForSelector('#famous:not([hidden])', { timeout: 5000 });
  check('famous apps: a line and a source link per app, plus our card count, no sideways scroll (AIG-842)', await page.evaluate(() => {
    const l = [...document.querySelectorAll('#famous-list li')], s = [...document.querySelectorAll('#famous-sources li')];
    return l.length >= 4 && s.length === l.length && s.every(x => /^https:/.test(x.querySelector('a')?.href)) && document.getElementById('famous-n').textContent === '37' && document.documentElement.scrollWidth <= innerWidth;
  })); } // the famous apps section is off since AIG-1222: only checked while it is on the page

  // AIG-1295: the feature grid has whole rows (no gap) on desktop, tablet and phone, also right-to-left; the service card is in it
  const grid = () => page.$eval('.features', g => {
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length, cards = [...g.children], gr = g.getBoundingClientRect(), last = cards[cards.length - 1].getBoundingClientRect();
    const rtl = getComputedStyle(g).direction === 'rtl', edge = rtl ? Math.abs(last.left - gr.left) : Math.abs(gr.right - last.right);
    return { cols, n: cards.length, edge: Math.round(edge), wide: document.documentElement.scrollWidth <= innerWidth };
  });
  check('the service card is on the teaser (AIG-1295)', await page.$eval('[data-i18n="f.service.h"]', e => e.textContent.trim().length > 5 && !!e.closest('.features')).catch(() => false));
  for (const [w, cols] of [[1400, 3], [768, 2], [390, 1]]) {
    await page.setViewportSize({ width: w, height: 900 });
    const g = await grid();
    check('at ' + w + 'px the feature grid has ' + cols + ' columns and no gap in the last row (AIG-1295)', g.cols === cols && g.edge <= 1 && g.wide, g);
  }
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  { const g = await grid(); check('right-to-left: the feature grid still has no gap (AIG-1295)', g.cols === 3 && g.edge <= 1 && g.n % 3 === 0, g); }
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));
  // AIG-1304: a 4th "Messenger for your phone" button (Coming soon, not a link) and a Messenger section with a drawn phone
  {
    const dl = () => page.$eval('.downloads', d => { const b = [...d.children].map(e => e.getBoundingClientRect()), tops = [...new Set(b.map(r => Math.round(r.top)))];
      const ph = document.querySelector('.messenger .phone').getBoundingClientRect();
      return { n: b.length, rows: tops.length, perRow: tops.map(t => b.filter(r => Math.round(r.top) === t).length), same: b.every(r => Math.abs(r.width - b[0].width) <= 1), wide: document.documentElement.scrollWidth <= innerWidth, phone: ph.left >= 0 && ph.right <= innerWidth }; });
    const m = await page.$eval('.downloads', d => { const a = d.querySelector('[data-i18n="dl.messenger"]')?.closest('a'); return { n: d.children.length, txt: a?.textContent, soon: !!a?.classList.contains('soon') && a.getAttribute('aria-disabled') === 'true', third: d.children[2] === a, last: d.lastElementChild.getAttribute('href') }; });
    check('the download row has 4 buttons; the 3rd is "📱 Messenger for your phone · Coming soon", not clickable like the other two (AIG-1304)', m.n === 4 && m.txt === '📱 Messenger for your phone' + 'Coming soon' && m.soon && m.third && m.last === 'interest.html', m);
    const u0 = page.url(); await page.click('.downloads [data-i18n="dl.messenger"]'); check('clicking the Messenger button goes nowhere', page.url() === u0, page.url());
    const sec = await page.evaluate(() => { const s = document.getElementById('messenger'), h = s?.querySelector('h2'), hs = [...document.querySelectorAll('main h1,main h2,main h3')].map(e => +e.tagName[1]);
      return { h: h?.textContent, label: s?.getAttribute('aria-labelledby') === h?.id, after: !!s && document.querySelector('.features').compareDocumentPosition(s) === Node.DOCUMENT_POSITION_FOLLOWING, text: s?.querySelector('.msgr-text').textContent, hidden: s?.querySelector('.phone').getAttribute('aria-hidden') === 'true', bubs: s?.querySelectorAll('.phone .bub').length, order: hs.every((l, i) => i === 0 || l <= hs[i - 1] + 1) }; });
    check('the Messenger section follows the features: its heading, what it does, Android first then web and iPhone (AIG-1304)', sec.h === 'AI-gile Messenger: your team in your pocket' && sec.label && sec.after && /from your phone/.test(sec.text) && /QR code/.test(sec.text) && /Android first, then a web version for phones and iPhone/.test(sec.text) && /Coming soon/.test(sec.text), sec);
    check('the phone drawing is hidden from screen readers (the text says it all), with chat bubbles; headings stay in order', sec.hidden && sec.bubs === 3 && sec.order, sec);
    for (const [w, per] of [[1400, [4]], [768, [2, 2]], [390, [2, 2]]]) {
      await page.setViewportSize({ width: w, height: 900 });
      const r = await dl();
      check('at ' + w + 'px the download row is ' + per.join(' + ') + ' equal buttons, no lonely one, no sideways scroll; the phone fits (AIG-1304)', r.n === 4 && JSON.stringify(r.perRow) === JSON.stringify(per) && r.same && r.wide && r.phone, r);
    }
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    { const r = await page.evaluate(() => { const me = document.querySelector('.bub.me').getBoundingClientRect(), them = document.querySelector('.bub.them').getBoundingClientRect(); return { flip: me.left < them.left, wide: document.documentElement.scrollWidth <= innerWidth }; });
      check('right-to-left at 390px: your bubble moves to the other side, no sideways scroll', r.flip && r.wide, r); }
    await page.evaluate(() => document.documentElement.removeAttribute('dir'));
    const look = () => page.evaluate(() => { const c = e => getComputedStyle(document.querySelector(e)); return { body: getComputedStyle(document.body).backgroundColor, phone: c('.phone').backgroundColor, them: c('.bub.them').backgroundColor, themText: c('.bub.them').color, me: c('.bub.me').backgroundColor, meText: c('.bub.me').color, anim: c('.bub.me').animationName }; });
    const root = (t, b) => page.evaluate(([t, b]) => { const r = document.documentElement; r.setAttribute('data-theme', t); if (b) r.setAttribute('data-black', ''); else r.removeAttribute('data-black'); }, [t, b]);
    await root('light', false); const li = await look();
    await root('dark', false); const dk = await look();
    await root('dark', true); const bk = await look();
    const ok = x => x.phone === x.body && x.them !== x.phone && x.themText !== x.them && x.meText !== x.me;
    check('the phone follows the theme: light, dark and black (true #000 screen), bubbles readable in each (AIG-1304)', ok(li) && ok(dk) && ok(bk) && li.phone !== dk.phone && bk.phone === 'rgb(0, 0, 0)' && dk.them !== li.them, { li, dk, bk });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('reduced motion: the bubbles just show, no slide-in', (await look()).anim === 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await root('light', false);
    await page.setViewportSize({ width: 1400, height: 900 });
  }
  // AIG-1301: the theme button cycles light -> dark -> black; black is true #000 and survives a reload
  {
    const st = () => page.evaluate(() => ({ th: document.documentElement.getAttribute('data-theme'), black: document.documentElement.hasAttribute('data-black'), bg: getComputedStyle(document.body).backgroundColor, saved: localStorage.getItem('aigile-site-theme'), tip: document.getElementById('theme').title }));
    await page.evaluate(() => { localStorage.setItem('aigile-site-theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); document.documentElement.removeAttribute('data-black'); });
    await page.click('#theme'); const d = await st();
    await page.click('#theme'); const b = await st();
    check('theme button: light, then dark, then black (true #000, saved, tip names the next one) (AIG-1301)', d.th === 'dark' && !d.black && b.th === 'dark' && b.black && b.bg === 'rgb(0, 0, 0)' && b.saved === 'black' && /light/i.test(b.tip), [d, b]);
    await page.reload(); await sleep(300);
    const r = await st();
    check('black survives a reload', r.black && r.bg === 'rgb(0, 0, 0)', r);
    await page.click('#theme'); const l = await st();
    check('and the next click goes back to light', l.th === 'light' && !l.black, l);
  }
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

// AIG-1285: the 📖 Dev words button: the app's glossary in the page's language, searchable, plus dotted words on the page.
def('teaserwords', 'site/index.html (file://): 📖 Dev words button and dialog (search, Esc/close/outside, focus back), underline on the page (remembered), language switch, RTL, phone width, dark mode, reduced motion (AIG-1285)', async (s, ctx) => {
  const fs = await import('node:fs');
  const { devWords } = await import('../../gen/site-lang.mjs');
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', 'nl.json'), 'utf8'));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/relay\.aigile\.lol/, r => r.abort());
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('qa-kept')) { localStorage.clear(); sessionStorage.setItem('qa-kept', '1'); } } catch {} });
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await page.waitForSelector('#words-btn');
  const en = devWords('en');
  check('the bundles carry the app dev words: every glossary id, English fallback, nl-BE from its own file', en.list.length >= 18 && en.list.every(w => w.word && w.text) && devWords('nl-BE').button === JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', 'nl-BE.json'), 'utf8'))['scale.words']);
  check('📖 Dev words sits next to the 🌐 language button, same pill', await page.evaluate(() => { const b = document.getElementById('words-btn'), l = document.getElementById('lang-btn'); return b.closest('.top-end') === l.closest('.top-end') && b.classList.contains('lang-btn') && /📖/.test(b.textContent) && b.getAttribute('aria-haspopup') === 'dialog'; }));
  await page.click('#words-btn');
  const dlgOpen = () => page.$eval('#words-dlg', d => d.open);
  check('the button opens a dialog with the search box focused and every word', (await dlgOpen()) && (await page.evaluate(() => document.activeElement.id)) === 'words-q' && (await page.$$('#words-list .words-item')).length === en.list.length);
  check('the dialog is labelled by its title (the app\'s glossary heading)', await page.$eval('#words-dlg', d => d.getAttribute('aria-labelledby') === 'words-h' && document.getElementById('words-h').textContent.length > 3));
  await page.fill('#words-q', 'snapshot');
  const shown = () => page.$$eval('#words-list .words-item:not([hidden]) dt', e => e.map(x => x.textContent));
  check('search finds words by their explanation too ("snapshot": Commit)', (await shown()).includes('Commit') && (await page.$eval('#words-none', e => e.hidden)), await shown());
  // AIG-1296: the words in groups (h3 under the dialog's h2), a count read out as you search, search across all groups
  const enApp = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
  check('the bundles carry the groups along a project\'s life (idea to money, AIG-1408), every word in one, and the count in plural forms', en.groups.map(g => g.id).join() === 'idea,plan,agile,build,test,change,run,sec,ai,money' && en.list.length >= 400 && en.list.every(w => en.groups.some(g => g.id === w.g)) && en.count && en.count.other === enApp['gloss.count'].other, en.groups);
  const grp = await page.evaluate(() => ({ hs: [...document.querySelectorAll('#words-dlg h2, #words-dlg h3')].map(h => h.tagName + ':' + h.textContent), secs: [...document.querySelectorAll('#words-list .words-group')].map(x => x.dataset.group), labelled: [...document.querySelectorAll('#words-list .words-group')].every(x => document.getElementById(x.getAttribute('aria-labelledby'))?.tagName === 'H3') }));
  check('the dialog shows the words under group headings in order: h2, then an h3 per group', grp.secs.join() === 'idea,plan,agile,build,test,change,run,sec,ai,money' && grp.labelled && grp.hs[0].startsWith('H2:') && grp.hs.length === 11 && grp.hs.slice(1).every((h, i) => h === 'H3:' + en.groups[i].name), grp);
  await page.fill('#words-q', '');
  check('a status line under the search box says how many words there are', (await page.getAttribute('#words-count', 'role')) === 'status' && (await page.textContent('#words-count')) === en.list.length + ' words' && (await page.getAttribute('#words-q', 'aria-describedby')) === 'words-count');
  await page.focus('#words-q'); await page.keyboard.type('incident');
  const hitIds = await page.$$eval('#words-list .words-item:not([hidden])', e => e.map(x => x.dataset.id));
  check('search runs across every group (from the keyboard), empty groups fold away, the count follows', hitIds.includes('incident') && hitIds.includes('major') && hitIds.includes('postmortem') && (await page.$$eval('#words-list .words-group:not([hidden])', e => e.map(x => x.dataset.group))).every(g => g !== 'build') && (await page.textContent('#words-count')) === hitIds.length + ' words', hitIds);
  await page.fill('#words-q', 'production');
  check('search finds a word by its other names ("production": Live)', (await page.$$eval('#words-list .words-item:not([hidden])', e => e.map(x => x.dataset.id))).includes('live'));
  await page.fill('#words-q', 'zzqx');
  check('no match: the list empties and says so', (await shown()).length === 0 && !(await page.$eval('#words-none', e => e.hidden)));
  check('...and the status line reads it out without showing it twice', (await page.textContent('#words-count')) === en.none && (await page.$eval('#words-count', e => e.getBoundingClientRect().width <= 1)));
  await page.keyboard.press('Escape');
  check('Esc closes it and focus goes back to the button', !(await dlgOpen()) && (await page.evaluate(() => document.activeElement.id)) === 'words-btn');
  await page.click('#words-btn'); await page.click('#words-close');
  check('the close button closes it, focus back on the button', !(await dlgOpen()) && (await page.evaluate(() => document.activeElement.id)) === 'words-btn');
  await page.click('#words-btn'); await page.mouse.click(5, 790);
  check('a click outside the dialog closes it', !(await dlgOpen()));

  check('no dotted words until switched on', (await page.$$('abbr.devw')).length === 0);
  await page.click('#words-btn'); await page.check('#words-underline'); await page.keyboard.press('Escape');
  await sleep(300);
  const marked = () => page.$$eval('abbr.devw', e => e.map(x => x.textContent.toLowerCase()));
  check('"Underline these words on the page" puts dotted lines under them (agents...), not in links or buttons', (await marked()).includes('agents') && await page.$$eval('abbr.devw', e => e.every(x => !x.closest('a,button,dialog'))), await marked());
  check('AIG-1408: "Agile" in the page text is underlined, with its explanation', await page.$$eval('main abbr.devw', (e, t) => e.some(x => x.textContent === 'Agile' && x.getAttribute('data-tip') === t), en.list.find(w => w.id === 'agile').text));
  check('AIG-1408: Agile, Scrum, CI/CD, SLA and Hallucination are in the site\'s word list, CI/CD and SLA found by abbreviation', ['agile', 'scrum', 'cicd', 'sla', 'hallucination'].every(id => en.list.some(w => w.id === id && w.text.length > 20)) && en.list.find(w => w.id === 'cicd').word.startsWith('CI/CD') && en.list.find(w => w.id === 'sla').also.includes('SLA'));
  check('the choice is remembered (localStorage)', (await page.evaluate(() => localStorage.getItem('aigile-site-devwords'))) === '1');
  // AIG-1296: terms of more words are underlined as one, the longest first
  await page.evaluate(() => document.querySelector('main').insertAdjacentHTML('beforeend', '<p id="qa-mw">A major  incident put the status page on red until the backup came back.</p>'));
  await page.waitForSelector('#qa-mw abbr.devw', { timeout: 5000 }).catch(() => {});
  const mw = await page.$$eval('#qa-mw abbr.devw', e => e.map(x => x.textContent.replace(/\s+/g, ' ').toLowerCase() + '=' + (x.getAttribute('data-tip') || '').length));
  check('multi-word terms are underlined as one, the longest wins ("major incident", "status page"), with their explanation', mw.map(x => x.split('=')[0]).join() === 'major incident,status page,backup' && mw.every(x => +x.split('=')[1] > 10), mw);
  await page.evaluate(() => document.getElementById('qa-mw').remove());
  // AIG-1453: whole words only, also where a vowel sign (Hindi, Kannada) or a zero-width non-joiner carries a word on
  const edge = async (html) => { await page.evaluate(h => document.querySelector('main').insertAdjacentHTML('beforeend', '<p id="qa-edge">' + h + '</p>'), html); await sleep(400);
    const r = await page.$$eval('#qa-edge abbr.devw', e => e.map(x => x.textContent)); await page.evaluate(() => document.getElementById('qa-edge').remove()); return r; };
  let eg = await edge('a merge, merged, emerge');
  check('AIG-1453: Latin stays whole-word ("merge" yes, "merged"/"emerge" no)', JSON.stringify(eg) === '["merge"]', eg);
  await page.evaluate(() => SiteI18n.set('hi'));
  await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 5000 }); await sleep(300);
  eg = await edge('बगीचे में एक बग मिला');
  check('AIG-1453: Hindi "बग" on its own is underlined, not inside "बगीचे" (vowel sign after it)', JSON.stringify(eg) === '["बग"]', eg);
  await page.evaluate(() => SiteI18n.set('kn'));
  await page.waitForFunction(() => document.documentElement.lang === 'kn', null, { timeout: 5000 }); await sleep(300);
  eg = await edge('ಏಜೆಂಟ್‌ನ ಕೆಲಸ, ಒಬ್ಬ ಏಜೆಂಟ್ ಬಂದ');
  check('AIG-1453: Kannada "ಏಜೆಂಟ್" on its own is underlined, not before a zero-width non-joiner', JSON.stringify(eg) === '["ಏಜೆಂಟ್"]', eg);
  await page.evaluate(() => SiteI18n.set('en'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 5000 }); await sleep(300);
  // AIG-1342: the live board's column headings (drawn by live.js like this) get the underline too, also after a redraw
  const board = () => page.evaluate(() => { const L = ['Backlog', 'To do', 'In progress', 'Team checking', 'For you to test', 'For the team', 'Done'], ids = ['backlog', 'todo', 'doing', 'review', 'verify', 'team', 'done'];
    document.getElementById('live').hidden = false; const c = document.getElementById('live-cols'); c.hidden = false; c.textContent = '';
    ids.forEach((id, i) => { const d = document.createElement('div'), h = document.createElement('h3'); d.className = 'lv-col k-' + id; h.textContent = L[i]; const n = document.createElement('span'); n.className = 'lv-n'; n.textContent = ' 3'; h.appendChild(n); d.appendChild(h); c.appendChild(d); }); });
  const colHeads = () => page.$$eval('#live-cols .lv-col h3', hs => hs.map(h => { const x = h.querySelector('abbr.devw'); return x ? x.textContent + '=' + (x.getAttribute('data-tip') || '').length : '-'; }));
  await board(); await sleep(400);
  let ch = await colHeads();
  check('the live board: every column heading is underlined with its tip (Backlog, To do, In progress, Done...)', ch.length === 7 && ch.every(x => x !== '-' && +x.split('=')[1] > 10) && ch[0].startsWith('Backlog') && ch[6].startsWith('Done') && await page.$$eval('#live-cols .lv-n', e => e.every(x => !x.querySelector('abbr'))), ch);
  const todo = await page.$('#live-cols .k-todo abbr.devw'); await todo.scrollIntoViewIfNeeded(); await sleep(300); await todo.hover();
  check('hover the To do heading: its tip shows', await page.evaluate(() => { const t = document.getElementById('words-tip'); return !!t && !t.hidden && t.textContent === SiteI18n.t('words.col.todo'); }));
  await page.mouse.move(5, 5);
  await board(); await sleep(400); ch = await colHeads();
  check('...and again when live.js redraws the columns', ch.every(x => x !== '-'), ch);
  check('column words stay plain outside a column heading ("done" in a sentence is not a tip)', await page.evaluate(() => ![...document.querySelectorAll('main abbr.devw')].some(a => !a.closest('.lv-col') && /^(done|to do|in progress)$/i.test(a.textContent))));
  await page.evaluate(() => { document.getElementById('live').hidden = true; document.getElementById('live-cols').textContent = ''; scrollTo(0, 0); }); await sleep(300);
  const a = await page.$('abbr.devw');
  await a.hover();
  const tip = () => page.evaluate(() => { const t = document.getElementById('words-tip'); return t && !t.hidden ? t.textContent : ''; });
  check('hover a dotted word: its plain explanation shows', (await tip()).length > 10, await tip());
  await page.mouse.move(5, 5);
  check('moving away hides it', (await tip()) === '');
  await a.focus();
  check('keyboard focus shows it too, linked by aria-describedby', (await tip()).length > 10 && (await a.getAttribute('aria-describedby')) === 'words-tip');
  await page.reload(); await page.waitForSelector('abbr.devw', { timeout: 5000 });
  check('after a reload the words are still underlined', (await marked()).length > 0);
  await page.waitForSelector('#pitch:not([hidden])', { timeout: 5000 });

  await page.evaluate(() => SiteI18n.set('nl'));
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 5000 });
  await sleep(300);
  await page.click('#words-btn');
  const nlWords = await page.$$eval('#words-list dd', e => e.map(x => x.textContent));
  check('switching to Dutch: the button and the list are Dutch (app texts)', (await page.$eval('#words-btn', b => b.getAttribute('aria-label'))) === app['scale.words'] && nlWords.includes(app['gloss.commit.text']), nlWords.slice(0, 2));
  const nlTexts = Object.entries(app).filter(([k]) => /^gloss\..*\.text$/.test(k)).map(([, v]) => v);
  check('switching language keeps the underline on, with the Dutch explanations', await page.$$eval('abbr.devw', (e, t) => e.length > 0 && e.some(x => t.includes(x.getAttribute('data-tip'))), nlTexts));
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 760 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(() => SiteI18n.set('ar'));
  await page.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 5000 });
  await page.click('#words-btn');
  const geo = await page.evaluate(() => { const d = document.getElementById('words-dlg').getBoundingClientRect(), b = document.getElementById('words-btn').getBoundingClientRect(), c = getComputedStyle(document.getElementById('words-dlg'));
    return { fits: d.left >= 0 && d.right <= innerWidth && d.bottom <= innerHeight, btn: b.width >= 44 && b.height >= 44 && b.right <= innerWidth, scroll: document.documentElement.scrollWidth <= innerWidth, bg: c.backgroundColor, anim: c.animationName, dir: c.direction }; });
  check('phone width (390px), Arabic: the dialog fits, the button is 44px, no sideways scroll', geo.fits && geo.btn && geo.scroll, geo);
  check('right-to-left: the dialog reads right to left', geo.dir === 'rtl', geo);
  check('dark mode: the dialog is dark', (geo.bg.match(/\d+/g) || []).slice(0, 3).every(n => +n < 80), geo);
  check('reduced motion: no opening animation', geo.anim === 'none', geo);
  await page.uncheck('#words-underline');
  check('switching the underline off removes every dotted word and the saved choice', (await page.$$('abbr.devw')).length === 0 && (await page.evaluate(() => localStorage.getItem('aigile-site-devwords'))) === null);
  // AIG-1288: the same switch one click away on the page, next to 📖
  if (await page.$eval('#words-dlg', d => d.open)) await page.keyboard.press('Escape');
  await page.click('#words-ul'); await sleep(300);
  check('the Abc switch on the page turns the underline on in one click: pressed, named in the page language, remembered, and the dialog box ticks with it (AIG-1288)', (await page.getAttribute('#words-ul', 'aria-pressed')) === 'true' && ((await page.getAttribute('#words-ul', 'aria-label')) || '').trim().length > 0 && (await page.evaluate(() => localStorage.getItem('aigile-site-devwords'))) === '1' && await page.$eval('#words-underline', b => b.checked));
  await page.click('#words-ul'); await sleep(300);
  check('and off again in one click', (await page.$$('abbr.devw')).length === 0 && (await page.getAttribute('#words-ul', 'aria-pressed')) === 'false');
  check('no page errors', errs.length === 0, errs);
  await page.close();
}, true);

def('sitephone', 'phone header and footer on both sites (AIG-1397)', async (s, ctx) => {
  const { build } = await import('../../gen/presite.mjs'); build();
  const fs = await import('node:fs');
  const shots = process.env.QA_SHOTS;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const page = await ctx.newPage(); await page.setViewportSize({ width:390, height:844 });
  await page.route('https://**/*', r => r.fulfill({ status:404, body:'' }));
  for (const folder of ['site', 'presite']) for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) {
    await page.addInitScript(lang => localStorage.setItem('aigile-site-lang', lang), lang);
    await page.emulateMedia({ colorScheme:theme });
    await page.goto(pathToFileURL(path.join(ROOT, folder, 'index.html')).href);
    await page.waitForSelector('#words-ul');
    check(folder+' '+lang+' '+theme+' header fits one row', await page.evaluate(() => {
      const brand=document.querySelector('.brand'), buttons=[...document.querySelectorAll('.top-end button,.pre-tools button')], r=brand ? brand.getBoundingClientRect() : {height:0};
      return r.height <= 44 && buttons.every(b => Math.abs(b.getBoundingClientRect().top-buttons[0].getBoundingClientRect().top)<2) && document.documentElement.scrollWidth<=innerWidth;
    }));
    check(folder+' footer links have 44px targets', await page.$$eval('footer a', es => es.length>0 && es.every(e => e.getBoundingClientRect().height>=44)));
    if(shots && folder==='site' && lang==='en' && theme==='dark') await page.screenshot({ path:path.join(shots,'AIG-1397.png'), fullPage:true });
  }
  await page.close();
}, true);
