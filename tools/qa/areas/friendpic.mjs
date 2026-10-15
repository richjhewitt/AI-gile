// QA area: friendpic (AIG-883). Your picture for a friend or a pending invite: set on an invite, follows the friend
// when they join, shows in the DM list, the DM and card comments; yours beats theirs, Remove brings theirs back;
// only the owner may use it; phone width and dark.
import fs from 'node:fs';
import path from 'node:path';
import { freePort, startRelay, until, check, startServer, openPage, noErrors, mkProject, mkCard, say, def } from '../lib.mjs';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG = Buffer.from(PNG_B64, 'base64');
const asWho = (s, where, as, method, url, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body && JSON.stringify(body) }).then(r => r.status);

def('friendpic', 'Friends: pick a picture for a friend or a pending invite; shows in the DM list, DMs and comments; yours beats theirs, Remove brings theirs back; owner only (AIG-883)', async (s, ctx) => {
  const relay = await startRelay();
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base, on: true });
    await b.ok('POST', '/api/dms/settings', { relay: relay.base, on: true });
    const up = { name: 'p.png', type: 'image/png', data: PNG_B64 };

    // a pending invite
    const inv = await s.ok('POST', '/api/dms/invites', { name: 'Beatrix' });
    check('an invite has an id', /^[0-9a-f]{12}$/.test(inv.id), inv.id);
    const set = await s.api('POST', '/api/friend-pics/' + inv.id, up);
    check('a picture can be set on a pending invite', set.status === 200 && set.body.mine === true && /friend-pics/.test(set.body.pic), JSON.stringify(set));
    const got = await fetch(s.base + '/api/friend-pics/' + inv.id);
    check('the picture is served', got.status === 200 && /image\/png/.test(got.headers.get('content-type')) && (await got.arrayBuffer()).byteLength === PNG.length);
    check('an unknown id is a 404', (await s.api('POST', '/api/friend-pics/aaaaaaaaaaaa', up)).status === 404);
    check('a text file is refused', (await s.api('POST', '/api/friend-pics/' + inv.id, { name: 'a.txt', type: 'text/plain', data: 'aGk=' })).status === 400);

    // owner only
    check('a team call is 403 (set)', await asWho(s, 'background', 'Beatrix', 'POST', '/api/friend-pics/' + inv.id, up) === 403);
    check('a team call is 403 (read)', await asWho(s, 'background', 'Dev', 'GET', '/api/friend-pics/' + inv.id) === 403);
    check('a team call is 403 (remove)', await asWho(s, 'cli', 'Dev', 'DELETE', '/api/friend-pics/' + inv.id) === 403);
    check('the owner on the CLI is let in', await asWho(s, 'cli', 'Owner', 'GET', '/api/friend-pics/' + inv.id) === 200);

    // the friend joins: the picture follows
    await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });
    await until(async () => (await s.ok('GET', '/api/dms/contacts')).length === 1);
    const c = (await s.ok('GET', '/api/dms/contacts'))[0];
    check('the friend joins under the invite id and keeps the picture', c.id === inv.id && c.mine === true && /friend-pics/.test(c.pic), JSON.stringify(c));
    check('the picture only lives in data/logos on this board', fs.readdirSync(path.join(s.data, 'logos')).some(f => f.startsWith('_fr-' + c.id)));

    // theirs loses; Remove brings it back
    fs.writeFileSync(path.join(s.data, 'logos', '_frt-' + c.id + '.png'), PNG);
    const c2 = (await s.ok('GET', '/api/dms/contacts'))[0];
    check('their own picture loses to yours', c2.mine === true && !/theirs/.test(c2.pic), c2.pic);
    const rm = await s.ok('DELETE', '/api/friend-pics/' + c.id);
    check('Remove brings theirs back', rm.mine === false && /\/theirs/.test(rm.pic), JSON.stringify(rm));
    check('theirs is served', (await fetch(s.base + '/api/friend-pics/' + c.id + '/theirs')).status === 200);
    await s.ok('POST', '/api/friend-pics/' + c.id, up);

    // where it shows: the comments, the DM list, the DM
    await b.ok('POST', '/api/dms/contacts/' + (await b.ok('GET', '/api/dms/contacts'))[0].id + '/messages', { text: 'hello from Alberto' });
    await until(async () => (await s.ok('GET', `/api/dms/contacts/${c.id}/messages`)).some(m => m.dir === 'in'));
    await s.ok('PATCH', '/api/dms/contacts/' + c.id, { name: 'Alberto' });
    const proj = await mkProject(s, 'Pic Test', 'PIC'); const slug = proj.slug || (proj.project && proj.project.slug);
    const card = await mkCard(s, slug, 'Friend comment');
    await say(s, slug, card.id, 'Alberto', 'a friend says hi');

    const page = await openPage(ctx, '#/p/' + slug + '/' + card.id);
    await page.waitForSelector('#dmRail [data-dms]');
    await page.waitForSelector(".comment .who img.face", { timeout: 8000 });
    check('the comment from the friend shows your picture', /friend-pics/.test(await page.getAttribute('.comment .who img.face', 'src')));
    await page.click('#dmRail [data-dms]');
    await page.waitForSelector('#dmPanel [data-dm="dm:' + c.id + '"] .dm-av img.pic');
    check('the DM list shows it', true);
    await page.click('#dmPanel [data-dm="dm:' + c.id + '"]');
    await page.waitForSelector('#dmPanel .dm-head .dm-av img.pic');
    await page.waitForSelector('#dmPanel .dm-meta img.face');
    check('the DM header and the messages show it', /friend-pics/.test(await page.getAttribute('#dmPanel .dm-meta img.face', 'src')));
    await page.close();

    // Setup: the buttons
    const pg = await openPage(ctx, '#/setup');
    await pg.waitForSelector('#dmfBody .dmf-c .fp');
    check('the friend row has Picture and Remove', await pg.locator('.dmf-c .fp [data-fp-do="pick"]').count() === 1 && await pg.locator('.dmf-c .fp [data-fp-do="remove"]').count() === 1);
    await pg.click('.dmf-c [data-fp-do="remove"]');
    await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0].mine === false);
    await pg.waitForFunction(() => !document.querySelector('.dmf-c [data-fp-do="remove"]'));
    check('Remove in Setup removes yours (theirs shows again)', /theirs/.test(await pg.getAttribute('.dmf-c img.face', 'src')));
    await pg.click('.dmf-c [data-fp-do="pick"]');
    await pg.setInputFiles('.dmf-c [data-fp-file]', { name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0].mine === true);
    check('Picture uploads a file', true);
    await pg.waitForSelector('.dmf-c [data-fp-do="remove"]');
    await pg.click('.dmf-c [data-fp-do="remove"]'); await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0].mine === false);
    await pg.waitForSelector('.dmf-c [data-fp-do="pick"]');
    await pg.click('.dmf-c [data-fp-do="pick"]');
    await pg.evaluate(b64 => {   // paste an image
      const dt = new DataTransfer(); dt.items.add(new File([Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))], 'x.png', { type: 'image/png' }));
      document.querySelector('.dmf-c [data-fp-paste]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PNG_B64);
    await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0].mine === true);
    check('pasting an image sets it', true);
    await pg.fill('#dmfInvName', 'Zoe'); await pg.click('#dmfInvite'); await pg.waitForSelector('#dmfMade ~ .actions .fp [data-fp-do="pick"]');
    check('a just-made invite has a Picture button', true);

    // phone width and dark
    const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
    await ph.addInitScript(() => { try { localStorage.setItem('aigile.theme', 'dark'); localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    const pp = await openPage(ph, '#/setup');
    await pp.waitForSelector('#dmfBody .dmf-c .fp');
    await pp.click('.dmf-c [data-fp-do="pick"]');
    const fit = await pp.evaluate(() => ({ w: document.documentElement.scrollWidth, iw: window.innerWidth, edit: document.querySelector('.fp-edit').getBoundingClientRect().right, bg: getComputedStyle(document.body).backgroundColor }));
    check('phone width: nothing sticks out', fit.w <= fit.iw && fit.edit <= fit.iw, JSON.stringify(fit));
    check('dark: the page is dark', fit.bg !== 'rgb(255, 255, 255)', fit.bg);
    noErrors(pp); await ph.close();
    check('no page errors', pg.errors.length === 0, pg.errors);
  } finally { b.stop(); relay.stop(); }
}, true);
