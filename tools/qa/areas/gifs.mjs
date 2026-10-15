// QA area: gifs (AIG-343). Giphy is faked by a local server (AIGILE_GIPHY_BASE); the real API is never called.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PORT, BASE, check, mkProject, mkCard, getCard, openPage, noErrors, def, sleep, tmp, startServer, startRelay, freePort, until, portFree } from '../lib.mjs';

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const FAKE_PORT = PORT + 500;
const LOCAL = path.join(tmp('gifs'), 'aigile.local.json');
fs.writeFileSync(LOCAL, JSON.stringify({ owner: 'Owner', agent: { command: 'x', notesFile: 'CLAUDE.local.md', settingsFile: '.claude/settings.local.json' } }));

function fakeGiphy(log) {
  const base = `http://127.0.0.1:${FAKE_PORT}`;
  const gif = id => ({ id, title: 'Cat ' + id, slug: 'cat-' + id, images: { original: { url: `${base}/media/${id}.gif`, width: '200', height: '200', size: String(GIF.length) }, fixed_width_small: { url: `${base}/media/${id}.gif`, width: '100', height: '100', size: '40' } } });
  return http.createServer((req, res) => {
    const u = new URL(req.url, base); log.push({ path: u.pathname, q: Object.fromEntries(u.searchParams) });
    const json = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname.startsWith('/media/')) {
      if (u.pathname.includes('notgif')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<b>no</b>'); }
      res.writeHead(200, { 'Content-Type': 'image/gif' }); return res.end(GIF);
    }
    if (u.searchParams.get('api_key') !== 'KEY-abcd1234') { res.writeHead(401); return res.end('{}'); }
    if (u.pathname === '/v1/gifs/search' || u.pathname === '/v1/gifs/trending') return json({ data: ['aaa111', 'bbb222', 'ccc333'].map(gif) });
    const m = u.pathname.match(/^\/v1\/gifs\/(\w+)$/);
    if (m) return json({ data: gif(m[1]) });
    res.writeHead(404); res.end('{}');
  });
}

def('gifs', 'GIFs in comments and DMs: pasted .gif file and GIF links show inline and open in the lightbox; the 🎞️ Giphy search runs on the server with the Setup key (masked), pg-13, "Powered by GIPHY" (AIG-343)', async (s, ctx) => {
  const log = [];
  if (!(await portFree(FAKE_PORT))) throw new Error('fake Giphy port busy: ' + FAKE_PORT);
  const fake = fakeGiphy(log); await new Promise(r => fake.listen(FAKE_PORT, '127.0.0.1', r));
  const relay = await startRelay({ RELAY_RATE: '100000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    await mkProject(s, 'Alpha', 'ALP');
    const c1 = await mkCard(s, 'alpha', 'Gif card');

    // No key yet.
    check('no key: the board says so', (await s.ok('GET', '/api/giphy')).key === false);
    check('no key: search is refused', (await s.api('POST', '/api/giphy/search', { q: 'cat' })).status === 400);
    const f0 = (await s.ok('GET', '/api/setup')).fields.find(f => f.key === 'giphyKey');
    check('Setup has a Giphy key box, empty', f0 && f0.value === '', f0);
    const page = await openPage(ctx, '#/p/alpha/' + c1.id);
    await page.click('[data-ctab="reply"]');
    await page.waitForSelector('.reply .att-gif');
    await page.click('.reply .att-gif');
    await page.waitForSelector('.gif-picker .gif-nokey');
    check('no key: the button invites you to Setup', /Add a free Giphy key in Setup/.test(await page.textContent('.gif-picker')));
    await page.keyboard.press('Escape');
    check('Esc closes the picker', await page.locator('.gif-picker').count() === 0);

    // The key goes in through Setup, comes back masked.
    const saved = await s.ok('POST', '/api/setup', { giphyKey: 'KEY-abcd1234' });
    const f1 = saved.fields.find(f => f.key === 'giphyKey');
    check('the key comes back masked', f1.value.endsWith('1234') && !f1.value.includes('KEY') && /^•+/.test(f1.value), f1);
    check('the key is kept in the git-ignored local file', JSON.parse(fs.readFileSync(LOCAL, 'utf8')).giphyKey === 'KEY-abcd1234');
    await s.ok('POST', '/api/setup', { giphyKey: f1.value, owner: 'Owner' });
    check('saving the masked value keeps the key', JSON.parse(fs.readFileSync(LOCAL, 'utf8')).giphyKey === 'KEY-abcd1234');

    // Server-side search.
    const sr = await s.ok('POST', '/api/giphy/search', { q: 'cat' });
    check('search returns the grid', sr.results.length === 3 && sr.results[0].id === 'aaa111' && /^http:\/\/127\.0\.0\.1:/.test(sr.results[0].preview), sr);
    check('the key never reaches the page', !JSON.stringify(sr).includes('KEY-abcd1234') && !JSON.stringify(await s.ok('GET', '/api/setup')).includes('KEY-abcd1234'));
    const call = log.find(l => l.path === '/v1/gifs/search');
    check('called Giphy search with key, query and rating pg-13', call && call.q.api_key === 'KEY-abcd1234' && call.q.q === 'cat' && call.q.rating === 'pg-13', call);
    const pk = await s.ok('POST', '/api/giphy/pick', { id: 'aaa111' });
    check('pick downloads the GIF as an attachment payload', pk.type === 'image/gif' && /\.gif$/.test(pk.name) && Buffer.from(pk.data, 'base64').equals(GIF), pk.name);
    check('a bad id is refused', (await s.api('POST', '/api/giphy/pick', { id: '../x' })).status === 400);
    check('a reply that is not a GIF is refused', (await s.api('POST', '/api/giphy/pick', { id: 'notgif' })).status === 502);

    // Picker in a card reply.
    await page.goto(BASE + '/#/p/alpha/' + c1.id);
    await page.click('[data-ctab="reply"]');
    await page.waitForSelector('.reply .att-gif');
    await page.click('.reply .att-gif');
    await page.waitForSelector('.gif-picker .gif-tile');
    check('picker shows tiles and Powered by GIPHY', await page.locator('.gif-picker .gif-tile').count() === 3 && /Powered by GIPHY/.test(await page.textContent('.gif-picker')));
    await page.fill('.gif-picker .gif-q', 'dog');
    await until(() => log.some(l => l.q.q === 'dog'));
    check('typing searches', log.some(l => l.q.q === 'dog'));
    await page.click('.gif-picker .gif-tile:nth-child(2)');
    await page.waitForSelector('.reply .att-chip');
    check('click adds the GIF as an attachment chip and closes', /\.gif/.test(await page.textContent('.reply .att-chip')) && await page.locator('.gif-picker').count() === 0);
    await page.click('.reply button:has-text("Send reply")');
    await sleep(700);
    let c = await getCard(s, 'alpha', c1.id);
    const att = (c.comments.at(-1).attachments || [])[0] || {};
    check('the comment carries the GIF', /\.gif$/.test(att.name || '') && fs.existsSync(att.path || '-'), c.comments.at(-1));
    const r = await fetch(BASE + '/api/projects/alpha/attachments/' + encodeURIComponent(att.id));
    check('served as image/gif', r.headers.get('content-type') === 'image/gif');
    await page.goto(BASE + '/#/p/alpha/' + c1.id);
    await page.waitForSelector('.att-shown img');
    await page.click('.att-shown a > img');
    await page.waitForSelector('.att-lightbox img');
    check('the GIF opens in the lightbox', await page.locator('.att-lightbox').count() === 1);
    await page.keyboard.press('Escape');

    // A pasted .gif file.
    await page.click('[data-ctab="reply"]');
    await page.waitForSelector('#r-text');
    await page.evaluate(b64 => {
      const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
      dt.items.add(new File([bytes], 'wiggle.gif', { type: 'image/gif' }));
      const ta = document.getElementById('r-text'); ta.focus();
      ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, GIF.toString('base64'));
    await page.waitForSelector('.reply .att-chip');
    check('a pasted .gif keeps its name', /wiggle\.gif/.test(await page.textContent('.reply .att-chip')));
    await page.click('.reply button:has-text("Send reply")');
    await sleep(700);
    c = await getCard(s, 'alpha', c1.id);
    const a2 = (c.comments.at(-1).attachments || [])[0] || {};
    check('pasted .gif stored as a gif', /wiggle\.gif$/.test(a2.name || '') && a2.type === 'image/gif', a2);

    // Pasted GIF links show inline (the images are served by the test, not the internet).
    await page.route(/^https:\/\/(media\.giphy\.com|example\.org)\//, route => route.fulfill({ status: 200, contentType: 'image/gif', body: GIF }));
    await s.ok('POST', `/api/projects/alpha/cards/${c1.id}/comments`, { author: 'Owner', text: 'one https://media.giphy.com/media/xyz789/giphy.gif and https://example.org/a/b.gif and http://example.org/plain.gif and https://giphy.com/gifs/funny-cat-abc123XY and https://example.org/page.html' });
    await page.goto(BASE + '/#/p/alpha/' + c1.id);
    await page.waitForSelector('img.gif-inline');
    await sleep(500);
    const srcs = await page.$$eval('img.gif-inline', els => els.map(e => e.src));
    check('GIF links show as pictures (https .gif, giphy media, giphy page link)', srcs.length === 3 && srcs.includes('https://media.giphy.com/media/xyz789/giphy.gif') && srcs.includes('https://example.org/a/b.gif') && srcs.includes('https://media.giphy.com/media/abc123XY/giphy.gif'), srcs);
    check('http and non-gif links stay plain links', !srcs.some(x => x.startsWith('http://')) && !srcs.some(x => x.endsWith('page.html')));
    check('they load lazily', await page.$$eval('img.gif-inline', els => els.every(e => e.loading === 'lazy')));
    await page.click('img.gif-inline');
    await page.waitForSelector('.att-lightbox img');
    check('a linked GIF opens in the lightbox', await page.locator('.att-lightbox').count() === 1);
    await page.keyboard.press('Escape');

    // Private DM: pick a GIF and send it sealed.
    await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
    await s.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await s.ok('POST', '/api/dms/invites', { name: 'Beatrix' });
    const cb = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });
    const ca = await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0]);
    await page.goto(BASE + '/#/');
    await page.waitForSelector('#dmRail [data-dms]');
    await page.click('#dmRail [data-dms]');
    await page.waitForSelector(`#dmPanel [data-dm="dm:${ca.id}"]`);
    await page.click(`#dmPanel [data-dm="dm:${ca.id}"]`);
    await page.waitForSelector('#dmPanel .att-gif');
    await page.click('#dmPanel .att-gif');
    await page.waitForSelector('.gif-picker .gif-tile');
    await page.click('.gif-picker .gif-tile:nth-child(1)');
    await page.waitForSelector('#dmPanel .att-chip');
    await page.fill('#dmText', 'look');
    await page.press('#dmText', 'Enter');
    await page.waitForSelector('#dmList .att-shown img');
    const got = await until(async () => (await b.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).find(m => m.attachments));
    check('the friend gets the GIF over the sealed DM', got && /\.gif$/.test(got.attachments[0].name) && got.attachments[0].type === 'image/gif', got);
    await page.click('#dmList .att-shown img');
    await page.waitForSelector('.att-lightbox img');
    check('a GIF in a DM opens in the lightbox', await page.locator('.att-lightbox').count() === 1);
    noErrors(page);
  } finally { b.stop(); relay.stop(); fake.close(); }
}, true, { AIGILE_LOCAL: LOCAL, AIGILE_GIPHY_BASE: `http://127.0.0.1:${FAKE_PORT}`, AIGILE_DM_POLL_MS: '300' });
