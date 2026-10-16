// QA area: apply (AIG-601): a firm applies at the relay (POST /apply); only the operator's key (RELAY_STATS_KEY) can read the list; Setup >
// Business licences shows it with Approve (a licence letter to copy) and Decline.
// AIG-1282: both website forms are sealed (in the browser, or by the relay on arrival), never plain on the relay's disk; the board
// collects, saves and acks, which deletes them on the relay; anything left goes after 30 days. AIG-1283: the data promise and What we keep.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { startRelay, until, check, openPage, noErrors, def, tmp, sleep, ROOT } from '../lib.mjs';

// AIG-1235: every file under dir, read as text (any plain email anywhere on the relay's disk shows up here).
const diskText = dir => { let t = ''; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else t += fs.readFileSync(f, 'utf8') + '\n'; } }; try { walk(dir); } catch {} return t; };
const sha = e => crypto.createHash('sha256').update(e).digest('hex').slice(0, 32) + '.json';   // the old (AIG-754) file name
const plainFile = (dir, o) => { fs.mkdirSync(path.join(dir, 'interest'), { recursive: true }); fs.writeFileSync(path.join(dir, 'interest', sha(o.email)), JSON.stringify(o)); };
const items = (dir, sub) => { try { return fs.readdirSync(path.join(dir, sub)).filter(f => f.endsWith('.json')); } catch { return []; } };
const SITE = 'https://relay.aigile.lol';

def('apply', '📜 website forms: licence applications and interest sealed in the browser (or by the relay), never plain on the relay, the board collects then the relay deletes, 30-day expiry; Setup > Business licences with Approve, Decline, Delete; the data promise and What we keep page (AIG-601, AIG-1282, AIG-1283)', async (s, ctx) => {
  const { key, xKey } = await s.ok('GET', '/api/licences');
  check('interest: the board offers its X25519 key for RELAY_OWNER_XPUB', /^[A-Za-z0-9_-]{43}$/.test(xKey || ''), xKey);
  const relay = await startRelay({ RELAY_STATS_KEY: key, RELAY_OWNER_XPUB: xKey });
  const extra = [];
  try {
    const pub = await fetch(relay.base + '/owner.pub');
    check('GET /owner.pub gives the owner key, open to the website (CORS)', pub.status === 200 && (await pub.json()).x === xKey && pub.headers.get('access-control-allow-origin') === '*');
    const post = (o, h = {}) => fetch(relay.base + '/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(o) });
    const good = { company: 'Acme Bees', website: 'https://acme.example', what: 'We keep bees', how: 'Pollination for the whole valley', email: 'hello@acme.example' };
    check('a half-filled application is refused', (await post({ company: 'X' })).status === 400);
    check('a bad email is refused', (await post({ ...good, email: 'nope' })).status === 400);
    check('a made-up sealed application is refused', (await post({ sealed: { v: 1, to: 'apply', from: 'web', ct: 'x' } })).status === 400);
    const ok = await post(good);
    check('an application is accepted, with open CORS for the website form', ok.status === 201 && ok.headers.get('access-control-allow-origin') === '*');
    check('the list is not readable without the operator key', (await fetch(relay.base + '/apply')).status === 401);
    await post({ ...good, company: 'Zed Ltd', email: 'zed@zed.example' });
    const adisk = diskText(path.join(relay.data, 'apply'));
    check('AIG-1282: a plain application is sealed on arrival: no company or email on the relay disk', items(relay.data, 'apply').length === 2 && !/Acme Bees|hello@acme|Zed Ltd|zed@zed/.test(adisk) && /"sealed"/.test(adisk), adisk.slice(0, 300));

    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    const page = await openPage(ctx, '#/setup');
    await page.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); }; });
    await page.waitForSelector('#licencesBox .lic-row');
    check('Setup lists both applications, newest first', (await page.locator('.lic-row').count()) === 2 && /Zed Ltd/.test(await page.locator('.lic-row').first().textContent()));
    check('the company and what it does are shown, escaped', /Acme Bees/.test(await page.textContent('#licencesBox')) && /We keep bees/.test(await page.textContent('#licencesBox')));
    check('AIG-1282: once the board has them they are deleted on the relay', !!(await until(() => items(relay.data, 'apply').length === 0)), items(relay.data, 'apply'));
    await page.click('.lic-row:has-text("Acme Bees") .lic-approve');
    await page.waitForSelector('.lic-row:has-text("Acme Bees") .lic-letter');
    const letter = await page.inputValue('.lic-row:has-text("Acme Bees") .lic-letter');
    check('Approve shows a short licence letter naming the firm', /Business licence/.test(letter) && /Acme Bees/.test(letter) && /We keep bees/.test(letter), letter);
    await page.click('.lic-row:has-text("Acme Bees") button:has-text("Copy the letter")');
    await until(async () => (await page.evaluate(() => window.__copied.length)) > 0);
    check('the letter can be copied', (await page.evaluate(() => window.__copied[0])) === letter);
    await page.click('.lic-row:has-text("Zed Ltd") .lic-decline');
    await page.waitForSelector('.lic-row:has-text("Zed Ltd") .pill:has-text("declined")');
    check('Decline marks it and offers no letter', !(await page.$('.lic-row:has-text("Zed Ltd") .lic-letter')));
    await page.reload(); await page.waitForSelector('#licencesBox .lic-row');
    check('the decisions are kept (on the board, after the relay deleted them)', /approved/.test(await page.locator('.lic-row:has-text("Acme Bees")').textContent()) && /declined/.test(await page.locator('.lic-row:has-text("Zed Ltd")').textContent()));
    check('AIG-1282: the board keeps them sealed at rest', !/Acme Bees|hello@acme/.test(fs.readFileSync(path.join(s.data, 'forms.conf'), 'utf8')));
    await page.click('.lic-row:has-text("Zed Ltd") .lic-del');
    await until(async () => (await page.locator('.lic-row').count()) === 1);
    check('Replied: delete takes the application off the board', (await page.locator('.lic-row').count()) === 1 && !(await s.ok('GET', '/api/licences')).items.some(a => a.company === 'Zed Ltd'));

    // 📝 Alpha / beta interest (AIG-754): POST /interest from the website, signed list on the board, under the licences.
    const ipost = o => fetch(relay.base + '/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
    check('interest: a bad email or a bad pick is refused', (await ipost({ email: 'nope', which: 'alpha' })).status === 400 && (await ipost({ email: 'a@b.example', which: 'gamma' })).status === 400);
    const i1 = await ipost({ email: 'Ann@Example.org', which: 'alpha' });
    check('interest: accepted with open CORS for the website form', i1.status === 201 && i1.headers.get('access-control-allow-origin') === '*');
    await ipost({ email: 'ann@example.org', which: 'both' });
    await ipost({ email: 'bob@example.org', which: 'beta' });
    check('interest: the list is not readable without the operator key', (await fetch(relay.base + '/interest')).status === 401);
    // AIG-1235: sealed to the board's key; the relay's disk never holds a plain email, the file name is a keyed hash.
    const disk = diskText(relay.data);
    check('interest: no plain email on the relay disk after sign-ups', !/ann@example\.org|bob@example\.org/i.test(disk), disk.slice(0, 300));
    const files = fs.readdirSync(path.join(relay.data, 'interest'));
    check('interest: files are sealed { v: 2, sealed, at }, named by a keyed hash (not sha256 of the email), with a .key', files.includes('.key') && !files.includes(sha('ann@example.org'))
      && files.filter(f => f.endsWith('.json')).every(f => { const o = JSON.parse(fs.readFileSync(path.join(relay.data, 'interest', f), 'utf8')); return o.v === 2 && o.sealed && o.sealed.ct && !('email' in o); }), files);
    const il = await s.ok('GET', '/api/interest');
    check('interest: one entry per email (a repeat replaces it, any case), opened by the board, newest first', il.items.length === 2 && il.items.find(x => x.email === 'ann@example.org').which === 'both' && il.items[0].email === 'bob@example.org' && !il.error, il);
    check('AIG-1282: interest is deleted on the relay once the board has it', items(relay.data, 'interest').length === 0, items(relay.data, 'interest'));
    check('interest: still listed on the board after that', (await s.ok('GET', '/api/interest')).items.length === 2);
    await page.reload(); await page.waitForSelector('#intList .int-row');
    check('Setup shows the interest list under the licences, with Copy all emails', (await page.locator('#intList .int-row').count()) === 2 && /bob@example\.org/.test(await page.textContent('#intList')) && await page.locator('#intCopy').count() === 1);
    await page.click('#intList .int-row:has-text("ann@example.org") .int-del');
    await until(async () => (await page.locator('#intList .int-row').count()) === 1);
    check('Replied: delete takes a sign-up off the board', (await s.ok('GET', '/api/interest')).items.map(x => x.email).join() === 'bob@example.org');
    await s.ok('DELETE', '/api/interest/' + encodeURIComponent('bob@example.org'));

    // 30 days: anything the board never collected is deleted on the relay.
    await ipost({ email: 'late@example.org', which: 'alpha' });
    const lateF = path.join(relay.data, 'interest', items(relay.data, 'interest')[0]), old = new Date(Date.now() - 31 * 864e5);
    fs.utimesSync(lateF, old, old);
    const lt = await s.ok('GET', '/api/interest');
    check('AIG-1282: an item left on the relay for 30 days is deleted, never collected', !fs.existsSync(lateF) && lt.items.length === 0, lt);

    // No RELAY_OWNER_XPUB: both forms are refused (503), nothing written; old plain items are still collected by the board, then deleted.
    const pausedData = path.join(tmp('relay-paused'), 'data');
    plainFile(pausedData, { email: 'old@example.org', which: 'beta', at: '2026-01-01T00:00:00.000Z' });
    const paused = await startRelay({ RELAY_STATS_KEY: key, RELAY_DATA: pausedData }); extra.push(paused);
    const pr = await fetch(paused.base + '/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'new@example.org', which: 'alpha' }) });
    check('interest: no RELAY_OWNER_XPUB -> 503 sign-ups are paused, nothing stored', pr.status === 503 && /paused/.test((await pr.json()).error) && !/new@example\.org/.test(diskText(pausedData)));
    const pa = await fetch(paused.base + '/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(good) });
    check('apply: no RELAY_OWNER_XPUB -> 503, nothing stored, no /owner.pub', pa.status === 503 && !/Acme/.test(diskText(pausedData)) && (await fetch(paused.base + '/owner.pub')).status === 404);
    await s.ok('POST', '/api/dms/settings', { relay: paused.base });
    const pl = await s.ok('GET', '/api/interest');
    check('interest: old plain items are collected and then deleted on the relay', pl.items.length === 1 && pl.items[0].email === 'old@example.org' && !/old@example\.org/.test(diskText(pausedData)), pl);
    await s.ok('DELETE', '/api/interest/' + encodeURIComponent('old@example.org'));
    paused.stop();

    // Migration on start: old plain files are sealed, renamed to the keyed hash, the plain ones deleted (applications too).
    const migData = path.join(tmp('relay-mig'), 'data');
    plainFile(migData, { email: 'cat@example.org', which: 'alpha', at: '2026-02-01T00:00:00.000Z' });
    plainFile(migData, { email: 'dan@example.org', which: 'both', at: '2026-03-01T00:00:00.000Z' });
    fs.mkdirSync(path.join(migData, 'apply'), { recursive: true });
    fs.writeFileSync(path.join(migData, 'apply', '1760000000000-0123456789abcdef.json'), JSON.stringify({ ...good, company: 'Old Firm', email: 'old@firm.example', at: '2026-01-02T00:00:00.000Z' }));
    const mig = await startRelay({ RELAY_STATS_KEY: key, RELAY_OWNER_XPUB: xKey, RELAY_DATA: migData }); extra.push(mig);
    const mfiles = fs.readdirSync(path.join(migData, 'interest'));
    check('interest: migration leaves no plain email on disk and drops the sha256-named files', !/cat@example\.org|dan@example\.org/.test(diskText(migData)) && !mfiles.includes(sha('cat@example.org')) && mfiles.filter(f => f.endsWith('.json')).length === 2, mfiles);
    check('apply: an old plain application is sealed in place on start', !/Old Firm|old@firm/.test(diskText(migData)) && items(migData, 'apply').length === 1);
    await s.ok('POST', '/api/dms/settings', { relay: mig.base });
    const ml = await s.ok('GET', '/api/interest');
    check('interest: the board opens the migrated list', ml.items.length === 2 && ml.items[0].email === 'dan@example.org' && ml.items[1].which === 'alpha', ml);
    check('apply: the board opens the migrated application under its old id', (await s.ok('GET', '/api/licences')).items.some(a => a.id === '1760000000000-0123456789abcdef' && a.company === 'Old Firm'));
    await fetch(mig.base + '/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cat@example.org', which: 'beta' }) });
    const ml2 = await s.ok('GET', '/api/interest');
    check('interest: a repeat after migration still replaces the old entry', ml2.items.length === 2 && ml2.items.find(x => x.email === 'cat@example.org').which === 'beta', ml2);
    await page.reload(); await page.waitForSelector('#intList .int-row');
    check('Setup shows the opened list', (await page.locator('#intList .int-row').count()) === 2 && /cat@example\.org/.test(await page.textContent('#intList')));
    noErrors(page);
    await page.close();

    // AIG-1282: the website forms seal in the browser (WebCrypto X25519) to /owner.pub; the board opens them as before.
    const formPage = async (file, opts = {}) => {
      const p = await ctx.newPage(), sent = [], errs = [];
      p.on('pageerror', e => errs.push(e.message));
      if (opts.noX25519) await p.addInitScript(() => { const g = crypto.subtle.generateKey.bind(crypto.subtle); crypto.subtle.generateKey = (a, ...r) => (a && a.name === 'X25519') ? Promise.reject(new Error('not here')) : g(a, ...r); });
      await p.route(SITE + '/**', async route => {
        const rq = route.request();
        if (rq.method() === 'POST') sent.push(rq.postData());
        const r = await route.fetch({ url: rq.url().replace(SITE, mig.base) });
        await route.fulfill({ response: r });
      });
      await p.goto(pathToFileURL(path.join(ROOT, 'site', file)).href);
      p.sent = sent; p.errs = errs; return p;
    };
    const lp = await formPage('licence.html');
    await lp.fill('input[name=company]', 'Browser Bees'); await lp.fill('textarea[name=what]', 'Sealed honey'); await lp.fill('textarea[name=how]', 'Kind to bees');
    await lp.fill('input[name=email]', 'web@bees.example');
    await lp.click('button[type=submit]');
    await lp.waitForSelector('.form-msg.ok, .form-msg.bad');
    const lbody = lp.sent[0] || '';
    check('licence form: thanks shown, and only a sealed envelope left the browser', /Thanks/.test(await lp.textContent('.form-msg')) && /"sealed"/.test(lbody) && !/Browser Bees|web@bees/.test(lbody), lbody.slice(0, 200));
    check('licence form: no plain text on the relay disk', !/Browser Bees|web@bees/.test(diskText(migData)));
    const keep = await lp.$eval('.form-keep', e => ({ text: e.textContent, href: e.querySelector('a').getAttribute('href') }));
    check('AIG-1283: under the form, the data promise with a link to What we keep', /reply to you, then delete it/.test(keep.text) && /No trackers, no cookies/.test(keep.text) && keep.href === 'privacy.html', keep);
    { await lp.setViewportSize({ width: 1400, height: 900 }); const g = await lp.$eval('.form-keep', e => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) }));
      check('the data promise sits on one line on a computer (AIG-1319)', g.h < g.lh * 1.5, g); }
    check('licence form: no page errors', lp.errs.length === 0, lp.errs);
    const ip = await formPage('interest.html');
    await ip.fill('input[name=email]', 'eve@example.org'); await ip.check('input[value=beta]');
    await ip.click('button[type=submit]');
    await ip.waitForSelector('.form-msg.ok, .form-msg.bad');
    check('interest form: sealed in the browser, nothing plain sent or stored', /"sealed"/.test(ip.sent[0] || '') && !/eve@example/.test(ip.sent[0] || '') && !/eve@example/.test(diskText(migData)) && await ip.$('.form-keep a[href="privacy.html"]'));
    const fb = await formPage('interest.html', { noX25519: true });
    await fb.fill('input[name=email]', 'fay@example.org');
    await fb.click('button[type=submit]');
    await fb.waitForSelector('.form-msg.ok, .form-msg.bad');
    check('interest form without X25519: sent plain over https, the relay seals it at once (nothing plain on disk)', /"email":"fay@example.org"/.test(fb.sent[0] || '') && /You're on the list/.test(await fb.textContent('.form-msg')) && !/fay@example/.test(diskText(migData)), fb.sent);
    const bl = await s.ok('GET', '/api/licences'), bi = await s.ok('GET', '/api/interest');
    check('the board opens browser-sealed items like the others, then the relay deletes them', bl.items.some(a => a.company === 'Browser Bees' && a.email === 'web@bees.example') && bi.items.find(x => x.email === 'eve@example.org').which === 'beta' && bi.items.some(x => x.email === 'fay@example.org')
      && items(migData, 'apply').length === 0 && items(migData, 'interest').length === 0, { bl: bl.items.length, bi: bi.items });
    for (const p of [lp, ip, fb]) await p.close();

    // AIG-1283: What we keep, linked from the teaser footer; same look as the status page (phone width, dark mode, language button).
    check('the teaser footer links to What we keep', /<footer>[^]*href="privacy.html"[^]*<\/footer>/.test(fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8')));
    const pp = await ctx.newPage(), perrs = []; pp.on('pageerror', e => perrs.push(e.message));
    await pp.setViewportSize({ width: 390, height: 800 }); await pp.emulateMedia({ colorScheme: 'dark' });
    await pp.goto(pathToFileURL(path.join(ROOT, 'site', 'privacy.html')).href); await sleep(300);
    const txt = await pp.textContent('main');
    check('What we keep: only what you send, sealed, deleted from the server, kept until replied, no trackers or cookies or analytics', /only what you send us/i.test(txt) && /can't read it/.test(txt) && /deleted from the server/.test(txt) && /until we've replied/.test(txt) && /No trackers, no cookies, no analytics/.test(txt), txt);
    check('What we keep: no sideways scroll at phone width, dark mode, a language button', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.body).backgroundColor === 'rgb(18, 21, 27)') && (await pp.$$('#lang-slot *')).length > 0);
    check('What we keep: no page errors', perrs.length === 0, perrs);
    await pp.close();
  } finally { relay.stop(); for (const r of extra) r.stop(); }
}, true);
