// QA area: phonepair (AIG-868), your phone over your own Tailscale network: Setup's Phone box makes a QR code and a one-time
// link; the phone host (a fake Host header, as tailscale serve sends it) is let in only with the paired device cookie.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, check, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

const HOST = 'mypc.tail1234.ts.net', ORIGIN = 'https://' + HOST;
// Raw request so Host, Origin and Cookie can be set freely.
const raw = (method, p, headers = {}, body) => new Promise(res => {
  const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers } }, x => {
    let s = ''; x.on('data', d => { s += d; }); x.on('end', () => { let j = null; try { j = JSON.parse(s); } catch {} res({ status: x.statusCode, body: j, cookie: x.headers['set-cookie'] }); });
  });
  r.on('error', () => res({ status: 0 })); r.end(body ? JSON.stringify(body) : undefined);
});

def('phonepair', 'phone over Tailscale: Setup pairs a phone (QR + one-time link), the phone host needs the device cookie and its own Origin, a phone may not reach terminal/secrets/setup, Remove revokes, localhost unchanged', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Hello from the lead');

  // Before any pairing the phone host is just a wrong host.
  check('unknown host refused', (await raw('GET', '/api/chats', { Host: HOST })).status === 403);

  // Setup's Phone box, like a user.
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#phPair');
  check('the box says no phones yet', /No phones paired yet/.test(await page.textContent('#phBody')));
  check('the box shows the tailscale serve command', /tailscale serve --bg \d+/.test(await page.textContent('#phBody')));
  await page.fill('#phHost', 'not a host');
  await page.click('#phPair');
  await page.waitForFunction(() => document.querySelector('#phErr').textContent.length > 0);
  check('a bad host is refused', /ts\.net/.test(await page.textContent('#phErr')));
  page.errors = page.errors.filter(e => !/status of 400/.test(e));   // that refusal is the 400 the console logs
  await page.fill('#phHost', 'https://' + HOST.toUpperCase() + '/');
  await page.fill('#phName', 'Pixel');
  await page.click('#phPair');
  await page.waitForSelector('#phLink');
  const url = await page.textContent('#phLink');
  const code = (url.match(/#\/pair\/([A-Za-z0-9_-]+)$/) || [])[1];
  check('the link is https://<host>/#/pair/<code>', url.startsWith(ORIGIN + '/#/pair/') && !!code, url);
  check('a QR code is drawn', !!(await page.$('#phBody svg.phone-qr path')));
  check('the host is saved', (await s.ok('GET', '/api/phone')).hosts[0] === HOST);

  // Pairing on the phone host.
  check('no cookie: 403 on the phone host', (await raw('GET', '/api/chats', { Host: HOST })).status === 403);
  check('pairing from another site refused', (await raw('POST', '/api/phone/pair', { Host: HOST, Origin: 'https://evil.example' }, { code })).status === 403);
  check('pairing on localhost refused', (await raw('POST', '/api/phone/pair', { Origin: 'http://127.0.0.1:' + PORT }, { code })).status === 403);
  check('a wrong code refused', (await raw('POST', '/api/phone/pair', { Host: HOST, Origin: ORIGIN }, { code: 'x'.repeat(24) })).status === 403);
  const pr = await raw('POST', '/api/phone/pair', { Host: HOST, Origin: ORIGIN }, { code });
  const set = String((pr.cookie || [])[0] || '');
  check('the code buys a device cookie', pr.status === 200 && /^aigile_phone=[A-Za-z0-9_-]{40,}/.test(set), pr);
  check('the cookie is HttpOnly, Secure, SameSite=Strict', /HttpOnly/.test(set) && /Secure/.test(set) && /SameSite=Strict/.test(set), set);
  check('the code works only once', (await raw('POST', '/api/phone/pair', { Host: HOST, Origin: ORIGIN }, { code })).status === 403);
  const cookie = set.split(';')[0], key = cookie.split('=')[1];
  const local = await s.ok('GET', '/api/phone');
  check('the phone is listed with its name', local.devices.length === 1 && local.devices[0].name === 'Pixel' && local.devices[0].host === HOST, local);
  const file = JSON.parse(fs.readFileSync(path.join(s.dir, 'aigile.local.json'), 'utf8'));
  check('only a hash of the key is saved', !JSON.stringify(file).includes(key) && /^[a-f0-9]{64}$/.test(file.phone.devices[0].hash));

  // With the cookie.
  const ph = { Host: HOST, Cookie: cookie };
  const chats = await raw('GET', '/api/chats', ph);
  check('with the cookie: /api/chats works', chats.status === 200 && Array.isArray(chats.body), chats.status);
  check('with the cookie (Host with :443): works', (await raw('GET', '/api/projects', { ...ph, Host: HOST + ':443' })).status === 200);
  const reply = await raw('POST', '/api/projects/alpha/cards/ALP-1/comments', { ...ph, Origin: ORIGIN }, { author: 'Owner', text: 'answered from my phone' });
  check('with the cookie: a POST reply works', reply.status === 200, reply);
  const card = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.id === 'ALP-1');
  check('the reply is on the card', card.comments.some(c => c.text === 'answered from my phone'));
  check('wrong Origin: 403', (await raw('POST', '/api/projects/alpha/cards/ALP-1/comments', { ...ph, Origin: 'https://evil.example' }, { author: 'Owner', text: 'evil' })).status === 403);
  check('http Origin of the phone host: 403', (await raw('POST', '/api/projects/alpha/cards/ALP-1/comments', { ...ph, Origin: 'http://' + HOST }, { author: 'Owner', text: 'evil' })).status === 403);
  check('POST with no Origin: 403', (await raw('POST', '/api/projects/alpha/cards/ALP-1/comments', ph, { author: 'Owner', text: 'evil' })).status === 403);
  check('GET with a wrong Origin: 403', (await raw('GET', '/api/chats', { ...ph, Origin: 'https://evil.example' })).status === 403);
  check('a made-up cookie: 403', (await raw('GET', '/api/chats', { Host: HOST, Cookie: 'aigile_phone=' + 'A'.repeat(43) })).status === 403);
  check('the cookie on another host name: 403', (await raw('GET', '/api/chats', { Host: 'other.tail1234.ts.net', Cookie: cookie })).status === 403);
  // What a phone may not do.
  check('phone: no terminal', (await raw('GET', '/api/terminal/token', ph)).status === 403);
  check('phone: no secrets', (await raw('GET', '/api/secrets/token', ph)).status === 403);
  check('phone: no pairing more phones', (await raw('POST', '/api/phone/start', { ...ph, Origin: ORIGIN }, { host: HOST })).status === 403);
  check('phone: no Setup changes', (await raw('POST', '/api/setup', { ...ph, Origin: ORIGIN }, { prefs: { runCmd: 'calc' } })).status === 403);
  check('phone: no team run command', (await raw('PATCH', '/api/projects/alpha', { ...ph, Origin: ORIGIN }, { runIn: 'other', runCmd: 'calc' })).status === 403);
  check('phone: Setup can still be read', (await raw('GET', '/api/setup', ph)).status === 200);

  // localhost unchanged.
  check('localhost still works without a cookie', (await raw('GET', '/api/chats', { Host: 'localhost:' + PORT })).status === 200);
  check('localhost still refuses another Origin', (await raw('POST', '/api/projects/alpha/cards', { Origin: 'https://evil.example' }, { title: 'x' })).status === 403);
  check('localhost refuses the phone Origin', (await raw('POST', '/api/projects/alpha/cards', { Origin: ORIGIN }, { title: 'x' })).status === 403);
  check('another host still refused', (await raw('GET', '/api/chats', { Host: 'evil.example' })).status === 403);

  // The phone's browser, as tailscale serve would carry it: https://<host> proxied to the board with that Host.
  const phoneCtx = await ctx.browser().newContext({ viewport: { width: 412, height: 860 }, serviceWorkers: 'block' });
  const proxy = async route => {
    const rq = route.request(), u = new URL(rq.url()), h = { ...rq.headers(), host: HOST };
    const body = rq.postDataBuffer();
    const r = await new Promise(res => {
      const x = http.request({ host: '127.0.0.1', port: PORT, method: rq.method(), path: u.pathname + u.search, headers: h }, y => { const b = []; y.on('data', d => b.push(d)); y.on('end', () => res({ status: y.statusCode, headers: y.headers, body: Buffer.concat(b) })); });
      x.on('error', () => res({ status: 502, headers: {}, body: Buffer.from('') })); x.end(body || undefined);
    });
    const headers = Object.fromEntries(Object.entries(r.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : String(v)]));
    await route.fulfill({ status: r.status, headers, body: r.body });
  };
  await phoneCtx.route(ORIGIN + '/**', proxy);
  const stranger = await phoneCtx.newPage();
  await stranger.goto(ORIGIN + '/');
  await stranger.waitForSelector('.phone-stop');
  check('phone page, not paired: says so instead of retrying', /not paired/.test(await stranger.textContent('.phone-stop')));
  await stranger.close();
  const link2 = await s.ok('POST', '/api/phone/start', { host: HOST, name: 'Browser phone' });
  const pp = await phoneCtx.newPage();
  const perr = []; pp.on('pageerror', e => perr.push(e.message));
  await pp.goto(link2.url);
  await pp.waitForSelector('#app .proj, #app h2', { timeout: 10000 });
  check('phone page: the pairing link opens the board', !(await pp.$('.phone-stop')), await pp.textContent('#app'));
  check('phone page: the code left the address bar', !/pair/.test(pp.url()), pp.url());
  check('phone page: the board shows the project', /Alpha/.test(await pp.textContent('body')));
  await pp.goto(ORIGIN + '/#/p/alpha/ALP-1');
  await pp.waitForSelector('#modal .panel');
  check('phone page: the card and its reply open', /answered from my phone/.test(await pp.textContent('#modal')));
  check('phone page: no page errors', perr.length === 0, perr);
  check('two phones listed', (await s.ok('GET', '/api/phone')).devices.length === 2);
  await phoneCtx.close();

  // Remove revokes.
  await page.reload();
  await page.waitForSelector('.ph-rm');
  check('Setup lists the phone with last seen', /Pixel/.test(await page.textContent('#phBody')) && /last seen/.test(await page.textContent('#phBody')));
  await page.click('.ph-rm');   // Pixel, the first one
  await page.waitForFunction(() => document.querySelectorAll('.ph-rm').length === 1);
  check('Remove: the other phone still works', (await s.ok('GET', '/api/phone')).devices.map(d => d.name).join() === 'Browser phone');
  await page.click('.ph-rm');
  await page.waitForFunction(() => !document.querySelector('.ph-rm'));
  check('Remove: the list is empty', (await s.ok('GET', '/api/phone')).devices.length === 0);
  check('Remove: the cookie no longer works', (await raw('GET', '/api/chats', ph)).status === 403);

  // Pair the app (AIG-907): a device key at once, in a QR code aigile://pair?url=https://<host>&key=<key>; the app sends it as Bearer, with no Origin.
  await page.click('#phApp');
  await page.waitForSelector('#phAppQr');
  const qrText = await page.textContent('#phAppQr');
  const am = qrText.match(/^aigile:\/\/pair\?url=https:\/\/([a-z0-9.-]+)&key=([A-Za-z0-9_-]{40,})$/);
  check('Pair the app: QR text aigile://pair?url=https://<host>&key=<key>', !!am && am[1] === HOST, qrText);
  check('Pair the app: a QR code is drawn', !!(await page.$('#phBody .phone-link svg.phone-qr path')));
  check('Pair the app: listed as Android app with Remove', /Android app/.test(await page.textContent('#phBody')) && (await page.$$('.ph-rm')).length === 1);
  const appKey = am ? am[2] : '', file2 = fs.readFileSync(path.join(s.dir, 'aigile.local.json'), 'utf8');
  check('Pair the app: only the hash is saved', appKey && !file2.includes(appKey));
  const ba = { Host: HOST, Authorization: 'Bearer ' + appKey };
  for (const p of ['/api/meta', '/api/chats', '/api/chats/alpha', '/api/dms/contacts', '/api/avatars'])
    check('Bearer: GET ' + p + ' works', (await raw('GET', p, ba)).status === 200);
  const wm = await raw('GET', '/api/chats/_watchman', ba), dmm = await raw('GET', '/api/dms/contacts/nobody/messages', ba);
  check('Bearer: GET /api/chats/_watchman and a contact\'s messages reach their routes', wm.status !== 403 && dmm.status !== 403, [wm.status, dmm.status]);
  const quick = await raw('POST', '/api/projects/alpha/cards', ba, { title: '💬 from the app', description: 'from the app', type: 'task', status: 'team', createdBy: 'Owner', quick: true });
  check('Bearer: POST a quick card with no Origin works', quick.status === 200, quick);
  check('Bearer: POST a comment with no Origin works', (await raw('POST', '/api/projects/alpha/cards/ALP-1/comments', ba, { author: 'Owner', text: 'from the app' })).status === 200);
  const smp = await raw('POST', '/api/chats/_watchman', ba, { text: 'hello from the app' });
  check('Bearer: POST /api/chats/_watchman reaches its route', smp.status !== 403 && smp.status !== 415, smp);
  check('Bearer with another site\'s Origin: 403', (await raw('POST', '/api/projects/alpha/cards/ALP-1/comments', { ...ba, Origin: 'https://evil.example' }, { author: 'Owner', text: 'evil' })).status === 403);
  check('Bearer: a wrong key is 403', (await raw('GET', '/api/chats', { Host: HOST, Authorization: 'Bearer ' + 'B'.repeat(43) })).status === 403);
  check('Bearer: a wrong key is 403 on POST with no Origin', (await raw('POST', '/api/projects/alpha/cards', { Host: HOST, Authorization: 'Bearer ' + 'B'.repeat(43) }, { title: 'evil' })).status === 403);
  check('Bearer: not on another host name', (await raw('GET', '/api/chats', { ...ba, Host: 'other.tail1234.ts.net' })).status === 403);
  check('Bearer: no terminal', (await raw('GET', '/api/terminal/token', ba)).status === 403);
  check('Bearer: no secrets', (await raw('GET', '/api/secrets/token', ba)).status === 403);
  check('Bearer: no pairing more phones', (await raw('POST', '/api/phone/app', ba, { host: HOST })).status === 403);
  check('Bearer on localhost is not needed and changes nothing', (await raw('GET', '/api/chats', { Authorization: 'Bearer x' })).status === 200);
  await page.click('.ph-rm');
  await page.waitForFunction(() => !document.querySelector('.ph-rm'));
  check('Bearer: a removed app key is 403', (await raw('GET', '/api/chats', ba)).status === 403);
  noErrors(page);
}, true, { AIGILE_NO_TAILSCALE: '1' });
