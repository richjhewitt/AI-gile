// QA area: apply (AIG-601): a firm applies at the relay (POST /apply); only the operator's key (RELAY_STATS_KEY) can read the list; Setup >
// Business licences shows it with Approve (a licence letter to copy) and Decline.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { startRelay, until, check, openPage, noErrors, def, tmp } from '../lib.mjs';

// AIG-1235: every file under dir, read as text (any plain email anywhere on the relay's disk shows up here).
const diskText = dir => { let t = ''; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else t += fs.readFileSync(f, 'utf8') + '\n'; } }; try { walk(dir); } catch {} return t; };
const sha = e => crypto.createHash('sha256').update(e).digest('hex').slice(0, 32) + '.json';   // the old (AIG-754) file name
const plainFile = (dir, o) => { fs.mkdirSync(path.join(dir, 'interest'), { recursive: true }); fs.writeFileSync(path.join(dir, 'interest', sha(o.email)), JSON.stringify(o)); };

def('apply', '📜 business licence applications: POST /apply at the relay, signed list for the operator, Setup > Business licences with Approve (letter) and Decline (AIG-601)', async (s, ctx) => {
  const { key, xKey } = await s.ok('GET', '/api/licences');
  check('interest: the board offers its X25519 key for RELAY_OWNER_XPUB', /^[A-Za-z0-9_-]{43}$/.test(xKey || ''), xKey);
  const relay = await startRelay({ RELAY_STATS_KEY: key, RELAY_OWNER_XPUB: xKey });
  const extra = [];
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    const post = (o, h = {}) => fetch(relay.base + '/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(o) });
    const good = { company: 'Acme Bees', website: 'https://acme.example', what: 'We keep bees', how: 'Pollination for the whole valley', email: 'hello@acme.example' };
    check('a half-filled application is refused', (await post({ company: 'X' })).status === 400);
    check('a bad email is refused', (await post({ ...good, email: 'nope' })).status === 400);
    const ok = await post(good);
    check('an application is accepted, with open CORS for the website form', ok.status === 201 && ok.headers.get('access-control-allow-origin') === '*');
    check('the list is not readable without the operator key', (await fetch(relay.base + '/apply')).status === 401);
    await post({ ...good, company: 'Zed Ltd', email: 'zed@zed.example' });

    const page = await openPage(ctx, '#/setup');
    await page.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); }; });
    await page.waitForSelector('#licencesBox .lic-row');
    check('Setup lists both applications, newest first', (await page.locator('.lic-row').count()) === 2 && /Zed Ltd/.test(await page.locator('.lic-row').first().textContent()));
    check('the company and what it does are shown, escaped', /Acme Bees/.test(await page.textContent('#licencesBox')) && /We keep bees/.test(await page.textContent('#licencesBox')));
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
    check('the decisions are kept', /approved/.test(await page.locator('.lic-row:has-text("Acme Bees")').textContent()) && /declined/.test(await page.locator('.lic-row:has-text("Zed Ltd")').textContent()));

    // 📝 Alpha / beta interest (AIG-754): POST /interest from the website, signed list on the board, under the licences.
    const ipost = o => fetch(relay.base + '/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
    check('interest: a bad email or a bad pick is refused', (await ipost({ email: 'nope', which: 'alpha' })).status === 400 && (await ipost({ email: 'a@b.example', which: 'gamma' })).status === 400);
    const i1 = await ipost({ email: 'Ann@Example.org', which: 'alpha' });
    check('interest: accepted with open CORS for the website form', i1.status === 201 && i1.headers.get('access-control-allow-origin') === '*');
    await ipost({ email: 'ann@example.org', which: 'both' });
    await ipost({ email: 'bob@example.org', which: 'beta' });
    check('interest: the list is not readable without the operator key', (await fetch(relay.base + '/interest')).status === 401);
    const il = await s.ok('GET', '/api/interest');
    check('interest: one entry per email (a repeat replaces it, any case), read by the board', il.items.length === 2 && il.items.find(x => x.email === 'ann@example.org').which === 'both', il);
    await page.reload(); await page.waitForSelector('#intList .int-row');
    check('Setup shows the interest list under the licences, with Copy all emails', (await page.locator('#intList .int-row').count()) === 2 && /bob@example\.org/.test(await page.textContent('#intList')) && await page.locator('#intCopy').count() === 1);
    // AIG-1235: sealed to the board's key; the relay's disk never holds a plain email, the file name is a keyed hash.
    const disk = diskText(relay.data);
    check('interest: no plain email on the relay disk after sign-ups', !/ann@example\.org|bob@example\.org/i.test(disk), disk.slice(0, 300));
    const files = fs.readdirSync(path.join(relay.data, 'interest'));
    check('interest: files are sealed { v: 2, sealed, at }, named by a keyed hash (not sha256 of the email), with a .key', files.includes('.key') && !files.includes(sha('ann@example.org'))
      && files.filter(f => f.endsWith('.json')).every(f => { const o = JSON.parse(fs.readFileSync(path.join(relay.data, 'interest', f), 'utf8')); return o.v === 2 && o.sealed && o.sealed.ct && !('email' in o); }), files);
    const opened = await s.ok('GET', '/api/interest');
    check('interest: the board opens the sealed list (newest first)', opened.items.length === 2 && opened.items[0].email === 'bob@example.org' && !opened.error, opened);

    // No RELAY_OWNER_XPUB: sign-ups are refused (503), nothing written; old plain items are still listed for the board.
    const pausedData = path.join(tmp('relay-paused'), 'data');
    plainFile(pausedData, { email: 'old@example.org', which: 'beta', at: '2026-01-01T00:00:00.000Z' });
    const paused = await startRelay({ RELAY_STATS_KEY: key, RELAY_DATA: pausedData }); extra.push(paused);
    const pr = await fetch(paused.base + '/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'new@example.org', which: 'alpha' }) });
    check('interest: no RELAY_OWNER_XPUB -> 503 sign-ups are paused, nothing stored', pr.status === 503 && /paused/.test((await pr.json()).error) && !/new@example\.org/.test(diskText(pausedData)));
    await s.ok('POST', '/api/dms/settings', { relay: paused.base });
    const pl = await s.ok('GET', '/api/interest');
    check('interest: old plain items are still shown', pl.items.length === 1 && pl.items[0].email === 'old@example.org', pl);
    paused.stop();

    // Migration on start: old plain files are sealed, renamed to the keyed hash, the plain ones deleted.
    const migData = path.join(tmp('relay-mig'), 'data');
    plainFile(migData, { email: 'cat@example.org', which: 'alpha', at: '2026-02-01T00:00:00.000Z' });
    plainFile(migData, { email: 'dan@example.org', which: 'both', at: '2026-03-01T00:00:00.000Z' });
    const mig = await startRelay({ RELAY_STATS_KEY: key, RELAY_OWNER_XPUB: xKey, RELAY_DATA: migData }); extra.push(mig);
    const mfiles = fs.readdirSync(path.join(migData, 'interest'));
    check('interest: migration leaves no plain email on disk and drops the sha256-named files', !/cat@example\.org|dan@example\.org/.test(diskText(migData)) && !mfiles.includes(sha('cat@example.org')) && mfiles.filter(f => f.endsWith('.json')).length === 2, mfiles);
    await s.ok('POST', '/api/dms/settings', { relay: mig.base });
    const ml = await s.ok('GET', '/api/interest');
    check('interest: the board opens the migrated list', ml.items.length === 2 && ml.items[0].email === 'dan@example.org' && ml.items[1].which === 'alpha', ml);
    await fetch(mig.base + '/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cat@example.org', which: 'beta' }) });
    const ml2 = await s.ok('GET', '/api/interest');
    check('interest: a repeat after migration still replaces the old entry', ml2.items.length === 2 && ml2.items.find(x => x.email === 'cat@example.org').which === 'beta', ml2);
    await page.reload(); await page.waitForSelector('#intList .int-row');
    check('Setup shows the opened list', (await page.locator('#intList .int-row').count()) === 2 && /cat@example\.org/.test(await page.textContent('#intList')));
    noErrors(page);
  } finally { relay.stop(); for (const r of extra) r.stop(); }
}, true);
