// QA areas: langboot (AIG-1330) and pagea11y (AIG-1332).
// langboot: the saved language and direction are set before the first paint, and the top bar shows no English while the language file is on its way.
// pagea11y: a page title per route, a Skip to content link as the first Tab stop, and new chat messages read out once by a polite live region.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, check, sleep, mkProject, mkCard, say, openPage, noErrors, def, pinAllInit } from '../lib.mjs';

const lang = code => JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', code + '.json'), 'utf8'));

// A context where Arabic is in (a marked copy of English) and its file arrives only after `delay` ms.
async function slowArabic(b, delay, boot) {
  const en = lang('en'), files = fs.readdirSync(path.join(ROOT, 'public', 'lang')).filter(f => f !== 'languages.json').map(f => f.slice(0, -5));
  const c = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-US' });
  await c.addInitScript(pinAllInit);
  await c.addInitScript(boot => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); localStorage.setItem('aigile.lang', 'ar'); if (boot) localStorage.setItem('aigile.langBoot', boot); } catch {} }, boot || '');
  await c.route('**/api/langs', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ codes: [...new Set([...files, 'ar'])] }) }));
  const dict = Object.fromEntries(Object.entries(en).map(([k, v]) => [k, k.endsWith('.html') ? v : typeof v === 'string' ? 'ع ' + v : Object.fromEntries(Object.entries(v).map(([f, x]) => [f, 'ع ' + x]))]));
  c.arAsked = 0;
  await c.route('**/lang/ar.json', async r => { c.arAsked++; await sleep(delay); await r.fulfill({ contentType: 'application/json', body: JSON.stringify(dict) }).catch(() => {}); });
  return c;
}
// The top bar's words a person could see now: visible elements in the header (outside the brand) with their own text.
const shownWords = page => page.evaluate(() => [...document.querySelectorAll('body > header *')].filter(e => !e.closest('h1') && getComputedStyle(e).visibility === 'visible' && e.getClientRects().length
  && [...e.childNodes].some(n => n.nodeType === 3 && /[A-Za-z]{2}/.test(n.textContent))).map(e => (e.id || e.className) + ': ' + e.textContent.trim().slice(0, 30)));

def('langboot', 'start-up in your language (AIG-1330): the saved language and direction before the first paint, no English in the top bar while the language file is held back, reads side by side', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const b = ctx.browser();
  // A start after an Arabic one: lang/dir right at once, nothing English while ar.json is held back.
  const c = await slowArabic(b, 2500, JSON.stringify({ c: 'ar', l: 'ar', d: 'rtl' }));
  const page = await c.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '/#/p/alpha', { waitUntil: 'domcontentloaded' }); await sleep(900);
  const early = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, wait: document.documentElement.classList.contains('i18n-wait'), ready: i18n.ready }));
  check('held back: <html dir=rtl lang=ar> before the language file is in', early.dir === 'rtl' && early.lang === 'ar' && !early.ready, early);
  check('held back: the top bar is waiting (i18n-wait)', early.wait, early);
  const words = await shownWords(page);
  check('held back: no English words show in the top bar', words.length === 0, words);
  const sizes = await page.evaluate(() => { const h = document.querySelector('body > header'); return [h.offsetHeight, document.getElementById('bugBtn').offsetWidth]; });
  check('held back: the top bar keeps its place (no jump when the words come)', sizes[0] > 20 && sizes[1] > 20, sizes);
  check('the guessed language file is asked for at once (side by side with the others)', c.arAsked === 1, c.arAsked);
  await page.waitForFunction(() => i18n.ready, null, { timeout: 15000 }); await page.waitForSelector('.board .column');
  const after = await page.evaluate(() => ({ wait: document.documentElement.classList.contains('i18n-wait'), bug: document.getElementById('bugBtn').textContent, nt: document.getElementById('ntBtn').textContent, theme: document.getElementById('themeBtn').textContent, dir: document.documentElement.dir }));
  check('loaded: the words show, in Arabic (Raise bug, No Token Mode, the theme button)', !after.wait && after.dir === 'rtl' && [after.bug, after.nt, after.theme].every(x => x.startsWith('ع ')), after);
  check('loaded: the language is remembered for the next start', JSON.parse(await page.evaluate(() => localStorage.getItem('aigile.langBoot'))).d === 'rtl');
  check('langboot: no page errors', page.errors.length === 0, page.errors);
  await c.close();
  // A first start (nothing saved yet): still no English while the file is on its way.
  const c2 = await slowArabic(b, 2000, null), p2 = await c2.newPage();
  await p2.goto(BASE + '/#/p/alpha', { waitUntil: 'domcontentloaded' }); await sleep(800);
  const w2 = await shownWords(p2);
  check('first start: no English words while the language loads', w2.length === 0 && await p2.evaluate(() => !i18n.ready), w2);
  await p2.waitForFunction(() => i18n.ready, null, { timeout: 15000 });
  check('first start: dir=rtl once in', (await p2.evaluate(() => document.documentElement.dir)) === 'rtl');
  await c2.close();
  // English saved: nothing waits.
  const page3 = await openPage(ctx, '#/p/alpha'); await page3.waitForSelector('.board .column');
  await page3.evaluate(() => location.reload()); await page3.waitForSelector('#bugBtn');
  check('English: the top bar never waits', !(await page3.evaluate(() => document.documentElement.classList.contains('i18n-wait'))) && (await page3.evaluate(() => JSON.parse(localStorage.getItem('aigile.langBoot')).c)) === 'en');
  noErrors(page3);
}, true);

def('pagea11y', 'accessibility (AIG-1332): a page title per route (in your language), Skip to content as the first Tab stop, new chat messages read out once (card chat, Messages)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const card = await mkCard(s, 'alpha', 'Fix the door', { status: 'doing' });
  await say(s, 'alpha', card.id, 'Lead', 'An old line from before');
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#app > *');
  const go = async (h, sel) => { await page.evaluate(x => { location.hash = x; }, h); if (sel) await page.waitForSelector(sel); await sleep(700); };
  const title = () => page.evaluate(() => document.title.replace(/^\(\d+\) /, ''));
  await sleep(600);
  check('title: home is AI-gile', (await title()) === 'AI-gile', await title());
  await go('#/inbox', '#ib'); check('title: Inbox · AI-gile', (await title()) === 'Inbox · AI-gile', await page.evaluate(() => [document.title, state.route.view, pageBase, typeof ChatLive]));
  await go('#/setup', '#setupForm'); check('title: Setup · AI-gile', (await title()) === 'Setup · AI-gile', await title());
  await go('#/p/alpha', '.board .column'); check('title: the board is the project name', (await title()) === 'Alpha · AI-gile', await title());
  await go('#/p/alpha/' + card.id, '.panel'); check('title: an open card names itself', (await title()) === `${card.id} Fix the door · Alpha · AI-gile`, await title());
  // Skip to content: the first Tab stop of a freshly loaded page (after a page change inside the app focus is on the new page's heading, AIG-1428)
  await go('#/p/alpha', '.board .column');
  await page.reload(); await page.waitForSelector('.board .column'); await sleep(500);
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.focus(); });
  await page.keyboard.press('Tab');
  const sk = await page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(); return { id: a.id, text: a.textContent, inView: r.top >= 0 && r.bottom <= innerHeight && r.width > 0 }; });
  check('skip link: the first Tab stop, shown when it has focus', sk.id === 'skipLink' && sk.text === 'Skip to content' && sk.inView, sk);
  await page.keyboard.press('Enter'); await sleep(300);
  const landed = await page.evaluate(() => ({ id: document.activeElement.id, hash: location.hash }));
  check('skip link: Enter lands on the page itself, the address stays', landed.id === 'app' && landed.hash === '#/p/alpha', landed);
  const off = await page.evaluate(() => { const a = document.getElementById('skipLink'); a.blur(); const r = a.getBoundingClientRect(); return r.bottom <= 0; });
  check('skip link: out of sight when it has no focus', off);
  // A card's chat: the history is not read out; a new line from the lead is, once.
  await go('#/p/alpha/' + card.id, '.panel'); await sleep(1500);
  const live = () => page.evaluate(() => { const l = document.getElementById('chatLive'); return { role: l.getAttribute('role'), live: l.getAttribute('aria-live'), lines: [...l.children].map(p => p.textContent) }; });
  let L = await live();
  check('live region: role=log, polite; opening a card reads nothing out', L.role === 'log' && L.live === 'polite' && L.lines.length === 0, L);
  await say(s, 'alpha', card.id, 'Lead', 'The door is fixed');
  await page.waitForFunction(() => document.getElementById('chatLive').children.length > 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(3500);   // a few more polls: still said once
  L = await live();
  check('card chat: the new line is read out once', L.lines.length === 1 && /The door is fixed/.test(L.lines[0]) && /Lead/.test(L.lines[0]), L);
  await say(s, 'alpha', card.id, (await s.ok('GET', '/api/meta')).owner || 'Rich', 'My own reply');
  await sleep(3000);
  L = await live();
  check('card chat: your own message is not read out', !L.lines.some(x => /My own reply/.test(x)), L);
  // Messages: the lead chat in its own window (a 💬 card's chat is all in it).
  const chatCard = await mkCard(s, 'alpha', 'A word with the lead', { quick: true, description: 'Hello lead' });
  await say(s, 'alpha', chatCard.id, 'Lead', 'Hello back');
  const p2 = await ctx.newPage(); p2.errors = []; p2.on('pageerror', e => p2.errors.push('pageerror: ' + e.message));
  await p2.goto(BASE + '/#/pop-chat/alpha');
  await p2.waitForSelector('#dmList'); await sleep(2000);
  check('title: Messages · AI-gile in the Messages window', (await p2.evaluate(() => document.title.replace(/^\(\d+\) /, ''))) === 'Messages · AI-gile', await p2.evaluate(() => document.title));
  const before = await p2.evaluate(() => document.getElementById('chatLive').children.length);
  check('Messages: opening the chat reads nothing out', before === 0, before);
  await say(s, 'alpha', chatCard.id, 'Lead', 'Shall I paint it too?');
  await p2.waitForFunction(() => document.getElementById('chatLive').children.length > 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(3000);
  const ml = await p2.evaluate(() => [...document.getElementById('chatLive').children].map(p => p.textContent));
  check('Messages: the new line is read out once', ml.length === 1 && /paint it too/.test(ml[0]), ml);
  noErrors(page); noErrors(p2);
  await p2.close();
  // Dutch: the title and the skip link in your language.
  const nl = lang('nl');
  const p3 = await openPage(ctx, '#/setup');
  await p3.evaluate(() => { localStorage.setItem('aigile.lang', 'nl'); location.reload(); }); await p3.waitForSelector('#setupForm'); await sleep(800);
  const d = await p3.evaluate(() => ({ title: document.title.replace(/^\(\d+\) /, ''), skip: document.getElementById('skipLink').textContent }));
  check('Dutch: Setup title and skip link translated', d.title === nl['crumb.setup'] + ' · AI-gile' && d.skip === nl['a11y.skip'], d);
  await p3.evaluate(() => { localStorage.removeItem('aigile.lang'); localStorage.removeItem('aigile.langBoot'); });
  noErrors(p3);
}, true);
