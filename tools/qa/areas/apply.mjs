// QA area: apply (AIG-601): a firm applies at the relay (POST /apply); only the operator's key (RELAY_STATS_KEY) can read the list; Setup >
// Business licences shows it with Approve (a licence letter to copy) and Decline.
import { startRelay, until, check, openPage, noErrors, def } from '../lib.mjs';

def('apply', '📜 business licence applications: POST /apply at the relay, signed list for the operator, Setup > Business licences with Approve (letter) and Decline (AIG-601)', async (s, ctx) => {
  const key = (await s.ok('GET', '/api/licences')).key;
  const relay = await startRelay({ RELAY_STATS_KEY: key });
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
    noErrors(page);
  } finally { relay.stop(); }
}, true);
