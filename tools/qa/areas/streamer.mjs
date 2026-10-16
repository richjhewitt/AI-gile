// QA area: streamer (AIG-590..592): the 🎥 switch hides private projects (sidebar, home, direct link, inbox), DMs and friends; masks
// IPs, emails, keys, passwords and server names as •••• in card text and comments; Copy still gets the real text; it turns itself
// on and off with OBS / Streamlabs (a stub file stands in for the process list) unless Setup says not to.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { BASE, check, tmp, until, sleep, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

const STUB = path.join(tmp('stream'), 'obs-running.txt');
const OBS_PORT = 45455;   // the fake OBS below listens here (AIGILE_OBS_STUB)
const KEY = 'sk-test1234567890abcdefXYZ';
const IP = '192.168.1.50', MAIL = 'dave@example.com';

def('streamer', '🎥 streamer mode: private projects, DMs and friends hidden; IPs, emails, keys, passwords, server names masked; Copy keeps the real text; turns itself on with OBS (AIG-590..592)', async (s, ctx) => {
  await mkProject(s, 'Open Board', 'OPN');
  await mkProject(s, 'Secret Board', 'SEC');
  await s.ok('PATCH', '/api/projects/secret-board', { private: true });
  check('a project can be private (flag in its summary)', (await s.ok('GET', '/api/projects')).find(p => p.slug === 'secret-board').private === true);
  const card = await mkCard(s, 'open-board', 'Check the server');
  await say(s, 'open-board', card.id, 'Forge', `ssh to ${IP} and mail ${MAIL} with ${KEY}, password: hunter2pw. Version 1.2.3 is fine.\n\n\`\`\`\nexport API=${KEY}\n\`\`\``);
  await mkCard(s, 'secret-board', 'Private plan');
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'Prodbox', kind: 'ssh', value: 'root@10.9.8.7' }] } });

  const page = await openPage(ctx, '#/');  await page.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); }; });
  await page.waitForSelector('.proj');
  await page.waitForSelector('#dmRail [data-slug="secret-board"]', { timeout: 8000 }).catch(() => {});   // the rail paints a moment after home
  check('before streaming both projects show on home and in the sidebar', (await page.locator('a.proj').count()) === 2 && (await page.locator('#dmRail [data-slug="secret-board"]').count()) === 1, { home: await page.locator('a.proj').count(), rail: await page.locator('#dmRail [data-slug="secret-board"]').count() });

  // The masking function on examples (conservative: ordinary text stays)
  const M = await page.evaluate(() => ['IP 10.0.0.1 here', 'to a@b.co now', 'sk-abcdefghijklmnopqrstuv', 'ghp_abcdefghijklmnopqrstuvwx', 'password=hunter2pw', 'token: abc12345', 'Bearer abcdefghijklmnopqrstuv', 'version 1.2.3.', 'build 999.1.1.1', 'a password is needed', 'the token budget', 'README.md and 2026-10-12', 'eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4'].map(x => Streamer.mask(x)));
  check('masks IP, email, sk- key, ghp_ token, password=, token:, Bearer, JWT', M[0] === 'IP •••• here' && M[1] === 'to •••• now' && M[2] === '••••' && M[3] === '••••' && M[4] === 'password=••••' && M[5] === 'token: ••••' && M[6] === 'Bearer ••••' && M[12] === '••••', M);
  check('leaves ordinary text alone (versions, bad IPs, dates, words)', M[7] === 'version 1.2.3.' && M[8] === 'build 999.1.1.1' && M[9] === 'a password is needed' && M[10] === 'the token budget' && M[11] === 'README.md and 2026-10-12', M);

  // Switch on
  await page.click('#streamBtn');
  await page.waitForSelector('html[data-streamer]');
  await until(async () => (await page.locator('a.proj').count()) === 1);
  check('home: the private project is gone', (await page.locator('a.proj').count()) === 1 && !(await page.locator('main, #app').first().textContent()).includes('Secret Board'));
  await until(async () => (await page.locator('#dmRail [data-slug="secret-board"]').count()) === 0);
  check('sidebar: the private project is gone, the open one stays', (await page.locator('#dmRail [data-slug="secret-board"]').count()) === 0 && (await page.locator('#dmRail [data-slug="open-board"]').count()) === 1);
  check('the DMs button and panel are hidden', !(await page.locator('.dm-railbtn[data-dms]').isVisible()) && !(await page.locator('#dmPanel').isVisible()));
  check('the switch shows it is on', (await page.getAttribute('#streamBtn', 'aria-pressed')) === 'true');
  await page.goto(`${BASE}/#/p/secret-board`);
  await until(async () => (await page.evaluate(() => location.hash)) === '#/');
  check('a link straight to the private project goes home', (await page.evaluate(() => location.hash)) === '#/');
  const inbox = await page.evaluate(async () => JSON.stringify(await api('GET', '/api/inbox')));
  check('the inbox never lists the private project', !inbox.includes('secret-board'));

  // Masking in card text / comments, Copy keeps the real text
  await page.goto(`${BASE}/#/p/open-board/${card.id}`);
  await page.waitForSelector('.panel .codebox');
  await until(async () => /••••/.test(await page.locator('.panel').textContent()));
  const body = await page.locator('.panel').textContent();
  check('the comment shows •••• for the IP, email, key and password', body.includes('••••') && !body.includes(IP) && !body.includes(MAIL) && !body.includes(KEY) && !body.includes('hunter2pw'), body.slice(0, 400));
  check('ordinary text in the same comment is untouched', body.includes('Version 1.2.3 is fine'));
  check('the code block is masked too', !(await page.locator('.panel .codebox pre').textContent()).includes(KEY));
  await page.click('.panel .codebox button.copy');
  await until(async () => (await page.evaluate(() => window.__copied.length)) > 0);
  check('Copy still puts the real text on the clipboard', (await page.evaluate(() => window.__copied[0])).includes('export API=' + KEY), await page.evaluate(() => window.__copied));
  // Setup > My servers: the server name and address are covered
  await page.goto(`${BASE}/#/setup`);
  await page.waitForSelector('#serversBox');
  await sleep(600);
  const srvInputs = await page.$$eval('#serversBox input[data-srv]', is => is.map(i => i.value));
  check('Setup > My servers keeps the real value in the box (for editing)', srvInputs.includes('Prodbox') && (srvInputs.includes('root@10.9.8.7') || (srvInputs.includes('root') && srvInputs.includes('10.9.8.7'))), srvInputs);
  check('and covers them on screen', await page.evaluate(() => [...document.querySelectorAll('#serversBox input[data-srv="name"], #serversBox input[data-srv="value"], #serversBox input[data-srv="host"], #serversBox input[data-srv="user"]')].every(i => getComputedStyle(i).webkitTextSecurity === 'disc')));
  check('Setup > friends and DM boxes are hidden', !(await page.locator('#dmsFriendsBox').isVisible()));

  // Phone width
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone: the switch is still reachable', await page.evaluate(() => { const b = document.getElementById('streamBtn'); return !!b && b.offsetParent !== null || getComputedStyle(b).display !== 'none'; }));
  await page.setViewportSize({ width: 1280, height: 800 });

  // Off again
  await page.click('#streamBtn');
  await until(async () => !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))));
  await page.goto(`${BASE}/#/p/open-board/${card.id}`); await page.reload();
  await page.waitForSelector('.panel .codebox');
  check('switched off: the real text is back', (await page.locator('.panel').textContent()).includes(IP));
  await page.goto(`${BASE}/#/`); await page.reload(); await page.waitForSelector('a.proj');
  check('switched off: the private project is back', (await page.locator('a.proj').count()) === 2);

  // The stream window (AIG-631): Setup > 🎥 Open stream window opens a second window that is always in streamer mode
  await page.goto(`${BASE}/#/setup`); await page.reload(); await page.waitForSelector('#streamWin');
  const [win] = await Promise.all([ctx.waitForEvent('page'), page.click('#streamWin')]);
  await win.waitForSelector('html[data-streamer]');
  check('the stream window is at /?stream=1 and in streamer mode', win.url().includes('stream=1') && (await win.evaluate(() => Streamer.on())));
  await win.goto(`${BASE}/?stream=1#/`); await win.waitForSelector('a.proj');
  await until(async () => (await win.locator('a.proj').count()) === 1);
  check('the stream window shows only the open project', (await win.locator('a.proj').count()) === 1 && !(await win.locator('#app, main').first().textContent()).includes('Secret Board'));
  check('the stream window cannot be switched off', (await win.evaluate(() => { Streamer.toggle(); return Streamer.on(); })) === true);
  check('the normal window is not in streamer mode', !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))) && (await page.evaluate(() => Streamer.on())) === false);
  await win.close();
  await page.goto(`${BASE}/#/`); await page.waitForSelector('a.proj');

  // Personal projects (AIG-637): ticked in Look, never shown while streaming
  await mkProject(s, 'Life Board', 'LIF');
  await mkCard(s, 'life-board', 'Dentist');
  await page.goto(`${BASE}/#/p/life-board`); await page.waitForSelector('#tbDots'); await page.click('#tbDots');
  await page.click('button:has-text("Look")'); await page.waitForSelector('#look-personal');
  await page.check('#look-private'); await page.check('#look-personal');
  check('ticking 🏡 Personal unticks Private', !(await page.isChecked('#look-private')));
  await page.click('.actions .primary');
  await until(async () => (await s.ok('GET', '/api/projects')).find(p => p.slug === 'life-board').personal === true);
  const lb = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'life-board');
  check('the project is now Personal (and not Private)', lb.personal === true && !lb.private && !lb.public, lb);
  const sb = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'secret-board');
  check('an old private project is still Private, not Personal', sb.private === true && !sb.personal);
  await sleep(1500);
  await page.goto(`${BASE}/#/`); await page.waitForSelector('a.proj');
  check('home shows 🏡 on the Personal project', (await page.locator('a.proj:has-text("Life Board") .lock').textContent().catch(() => '')).includes('🏡') || (await page.locator('.lock:has-text("🏡")').count()) > 0);
  const win2 = await ctx.newPage(); await win2.goto(`${BASE}/?stream=1#/`); await win2.waitForSelector('a.proj');
  await until(async () => (await win2.locator('a.proj').count()) === 1);
  check('streamer mode never shows the Personal project', !(await win2.locator('main, #app').first().textContent()).includes('Life Board') && !(await win2.evaluate(async () => JSON.stringify(await api('GET', '/api/projects')))).includes('life-board'));
  await win2.goto(`${BASE}/?stream=1#/p/life-board`);
  await until(async () => (await win2.evaluate(() => location.hash)) === '#/');
  check('a link straight to the Personal project goes home', true);
  await win2.close();

  // The Setup tick list of what streamer mode hides (AIG-638)
  await page.goto(`${BASE}/#/setup`); await page.reload(); await page.waitForSelector('#streamHide');
  const ticks = await page.$$eval('#streamHide input[data-hide]', is => is.map(i => [i.dataset.hide, i.checked, i.disabled]));
  check('Setup lists six things, all ticked (today), Personal ticked and locked', ticks.length === 6 && ticks.every(x => x[1]) && ticks.find(x => x[0] === 'personal')[2] === true && ticks.filter(x => x[2]).length === 1, ticks);
  await page.click('#streamHide input[data-hide="private"]');
  await page.click('#streamHide input[data-hide="secrets"]');
  await page.click('#streamHide input[data-hide="dms"]');
  await until(async () => { const h = (await s.ok('GET', '/api/streamer')).hide; return h.private === false && h.secrets === false && h.dms === false; });
  const hh = (await s.ok('GET', '/api/streamer')).hide;
  check('the ticks are saved on the board (personal always true, the rest as unticked)', hh.personal === true && hh.private === false && hh.secrets === false && hh.dms === false && hh.friends === true && hh.life === true, hh);
  const win3 = await ctx.newPage(); await win3.goto(`${BASE}/?stream=1#/`); await win3.waitForSelector('a.proj');
  await until(async () => (await win3.locator('a.proj').count()) === 2);
  const home3 = await win3.locator('main, #app').first().textContent();
  check('with Private unticked the private project shows, the Personal one still does not', home3.includes('Secret Board') && !home3.includes('Life Board'));
  check('with DMs unticked the DM button is back', !!(await until(() => win3.locator('.dm-railbtn[data-dms]').isVisible())));   // drawn a moment after the projects (AIG-920)
  await win3.goto(`${BASE}/?stream=1#/p/open-board/${card.id}`); await win3.waitForSelector('.panel .codebox');
  check('with Secrets unticked the comment shows the real text', (await win3.locator('.panel').textContent()).includes(IP));
  await win3.close();
  for (const k of ['private', 'secrets', 'dms']) await page.click(`#streamHide input[data-hide="${k}"]`);
  await until(async () => { const h = (await s.ok('GET', '/api/streamer')).hide; return h.private && h.secrets && h.dms; });
  check('ticking them again puts today\'s behaviour back', true);
  await page.goto(`${BASE}/#/`); await page.waitForSelector('a.proj');

  // Auto (AIG-592): a stub file stands in for OBS in the process list
  check('the board reports nothing running at first', (await s.ok('GET', '/api/streamer')).running === false && (await s.ok('GET', '/api/streamer')).auto === true);
  fs.writeFileSync(STUB, 'obs64.exe');
  await until(async () => (await s.ok('GET', '/api/streamer')).running === true, 5000);
  check('the board sees the program (checked on a timer)', (await s.ok('GET', '/api/streamer')).program === 'obs64.exe');
  await page.waitForSelector('html[data-streamer]', { timeout: 15000 });
  await page.waitForSelector('#streamNote');
  check('it turned on by itself with a small notice naming the program', /obs64\.exe/.test(await page.textContent('#streamNote')));
  await until(async () => (await page.locator('a.proj').count()) === 1, 8000);
  check('and the private project went away', (await page.locator('a.proj').count()) === 1);
  fs.unlinkSync(STUB);
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-streamer'), null, { timeout: 15000 });
  check('when the program stops it turns itself off again', true);

  // The Setup off switch for the auto part
  await page.goto(`${BASE}/#/setup`); await page.waitForSelector('#streamAuto');
  check('Setup has the auto switch, on by default', await page.isChecked('#streamAuto'));
  await page.click('#streamAuto');
  await until(async () => (await s.ok('GET', '/api/streamer')).auto === false);
  fs.writeFileSync(STUB, 'obs64.exe');
  await until(async () => (await s.ok('GET', '/api/streamer')).running === true, 5000);
  await sleep(7000);
  check('with the auto switch off, a running program does not turn it on', !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))));
  fs.unlinkSync(STUB);
  await until(async () => (await s.ok('GET', '/api/streamer')).running === false, 5000);

  // Alt+Shift+S, for Discord streams the board can't see (AIG-640)
  check('Setup names the Alt+Shift+S shortcut', (await page.textContent('#streamKey')).includes('Alt+Shift+S'));
  await page.keyboard.press('Alt+Shift+S');
  check('Alt+Shift+S turns streamer mode on', await page.evaluate(() => document.documentElement.hasAttribute('data-streamer') && /on|aan/.test(document.getElementById('streamNote').textContent)));
  await page.keyboard.press('Alt+Shift+S');
  check('and off again', !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))));

  // OBS link (AIG-643..645): a fake obs-websocket v5 server runs inside this QA process (AIGILE_OBS_STUB is its port)
  await s.ok('POST', '/api/streamer', { auto: true });
  const PW = 'hunter-obs-pw';
  const bad = await fetch(`${BASE}/api/streamer/obs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'connect', port: 99999 }) });
  check('connect rejects a port out of range', bad.status === 400, bad.status);
  const noObs = await fetch(`${BASE}/api/streamer/obs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
  check('Go live without a connection says no (409)', noObs.status === 409, noObs.status);
  let st = await s.ok('POST', '/api/streamer/obs', { action: 'connect', port: OBS_PORT, password: PW });
  check('OBS not running: plain reason "notrunning"', st.obs.state === 'error' && st.obs.reason === 'notrunning', st.obs);
  fs.writeFileSync(STUB, 'obs64.exe'); await sleep(900);
  st = await s.ok('GET', '/api/streamer');
  check('OBS process running but no WebSocket server: reason "serveroff"', st.obs.reason === 'serveroff', st.obs);
  fs.unlinkSync(STUB);
  const fake = await fakeObs(OBS_PORT, PW);
  try {
    await until(async () => (await s.ok('GET', '/api/streamer')).obs.state === 'connected', 8000);
    st = await s.ok('GET', '/api/streamer');
    check('connect ok: reconnects by itself once OBS is there; Identify auth accepted', st.obs.state === 'connected' && st.obs.port === OBS_PORT && st.obs.hasPassword === true, st.obs);
    check('the password is never sent back to the page', !JSON.stringify(st).includes(PW));
    st = await s.ok('POST', '/api/streamer/obs', { action: 'connect', port: OBS_PORT, password: 'wrong-one' });
    check('wrong password: plain reason "badpassword"', st.obs.state === 'error' && st.obs.reason === 'badpassword', st.obs);
    st = await s.ok('POST', '/api/streamer/obs', { action: 'connect', port: OBS_PORT });
    check('connecting again without a password keeps the saved one (still wrong here)', st.obs.reason === 'badpassword' && st.obs.hasPassword === true, st.obs);
    st = await s.ok('POST', '/api/streamer/obs', { action: 'connect', port: OBS_PORT, password: PW });
    check('right password again: Connected', st.obs.state === 'connected', st.obs);
    check('old streamer.conf settings survive saving the OBS link', st.auto === true && st.hide.personal === true && st.hide.private === true);
    st = await s.ok('POST', '/api/streamer', { auto: true });
    check('saving other streamer settings keeps the OBS link', st.obs.saved === true && st.obs.hasPassword === true);

    // Setup shows it
    await page.goto(`${BASE}/#/setup`); await page.reload(); await page.waitForSelector('#obsConnect');
    await until(async () => (await page.textContent('#obsState')).trim().length > 0);
    check('Setup > Streamer: Connect to OBS with the port, a password box and the status Connected', (await page.inputValue('#obsPort')) === String(OBS_PORT) && (await page.getAttribute('#obsPass', 'type')) === 'password' && /Connected|Verbonden/.test(await page.textContent('#obsState')), await page.textContent('#obsState'));
    check('the password box does not hold the saved password', (await page.inputValue('#obsPass')) === '');

    // Go live
    await page.goto(`${BASE}/#/`); await page.reload(); await page.waitForSelector('a.proj');
    await page.waitForSelector('#liveBtn:not([hidden])', { timeout: 10000 });
    check('Go live button shows next to the Streamer button, streamer mode still off', /Go live|Live gaan/.test(await page.textContent('#liveBtn')) && !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))));
    await page.setViewportSize({ width: 390, height: 844 });
    check('phone: the Go live button is not hidden by CSS', await page.evaluate(() => getComputedStyle(document.getElementById('liveBtn')).display !== 'none'));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('#liveBtn');
    await page.waitForSelector('html[data-streamer]');
    await until(async () => fake.log.includes('StartStream'), 5000);
    check('Go live turns streamer mode on and sends StartStream', fake.log.includes('StartStream') && (await page.getAttribute('#streamBtn', 'aria-pressed')) === 'true', fake.log);
    await until(async () => /Stop/.test(await page.textContent('#liveBtn')), 8000);
    st = await s.ok('GET', '/api/streamer');
    check('the board now says streaming, through OBS', st.running === true && st.via === 'obs' && st.program === 'OBS', st);
    await page.click('#liveBtn');
    await until(async () => fake.log.includes('StopStream'), 5000);
    check('Stop sends StopStream', fake.log.includes('StopStream'));
    await until(async () => /Go live|Live gaan/.test(await page.textContent('#liveBtn')), 8000);
    await page.click('#streamBtn'); await until(async () => !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))));

    // Auto follows the real stream, not "OBS is open"
    fs.writeFileSync(STUB, 'obs64.exe'); await sleep(900);
    st = await s.ok('GET', '/api/streamer');
    check('connected: OBS being open is not "streaming"', st.running === false && st.via === 'obs', st);
    await sleep(6000);
    check('connected: streamer mode stays off while OBS is only open', !(await page.evaluate(() => document.documentElement.hasAttribute('data-streamer'))));
    fake.setStreaming(true);
    await page.waitForSelector('html[data-streamer]', { timeout: 15000 });
    await page.waitForSelector('#streamNote');
    check('a stream started in OBS itself turns streamer mode on by itself', /OBS/.test(await page.textContent('#streamNote')));
    fake.setStreaming(false);
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-streamer'), null, { timeout: 15000 });
    check('and the stream ending turns it off again', true);
    fs.unlinkSync(STUB);
  } finally { fake.close(); }
  // OBS goes away: back to the process check
  await until(async () => (await s.ok('GET', '/api/streamer')).via === 'process', 8000);
  check('OBS closed: the process check is back in charge', (await s.ok('GET', '/api/streamer')).obs.state !== 'connected');
  await page.waitForSelector('#liveBtn[hidden]', { state: 'attached', timeout: 10000 });
  check('and the Go live button hides', true);
  noErrors(page);
}, true, { AIGILE_STREAM_STUB: STUB, AIGILE_STREAM_MS: '300', AIGILE_OBS_STUB: String(OBS_PORT), AIGILE_OBS_RETRY_MS: '300' });

// A tiny fake OBS (obs-websocket v5): Hello -> Identify with auth -> Identified; answers requests; pushes StreamStateChanged.
async function fakeObs(port, password) {
  const salt = 'c2FsdHktc2FsdA==', challenge = 'Y2hhbGxlbmdl', log = [], socks = new Set();
  let streaming = false;
  const sha = s => crypto.createHash('sha256').update(s).digest('base64');
  const frame = (op, buf) => buf.length < 126 ? Buffer.concat([Buffer.from([op, buf.length]), buf]) : Buffer.concat([Buffer.from([op, 126, buf.length >> 8, buf.length & 255]), buf]);
  const send = (sk, o) => { if (!sk.destroyed) sk.write(frame(0x81, Buffer.from(JSON.stringify(o)))); };
  const event = () => { for (const sk of socks) if (sk.ok) send(sk, { op: 5, d: { eventType: 'StreamStateChanged', eventIntent: 64, eventData: { outputActive: streaming, outputState: streaming ? 'OBS_WEBSOCKET_OUTPUT_STARTED' : 'OBS_WEBSOCKET_OUTPUT_STOPPED' } } }); };
  const server = http.createServer((q, r) => r.end());
  server.on('upgrade', (req, sk) => {
    sk.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
    socks.add(sk); sk.on('close', () => socks.delete(sk)); sk.on('error', () => {});
    send(sk, { op: 0, d: { obsWebSocketVersion: '5.0.0', rpcVersion: 1, authentication: { challenge, salt } } });
    let buf = Buffer.alloc(0);
    sk.on('data', d => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (buf.length < 2) return;
        let len = buf[1] & 127, at = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); at = 4; }
        if (buf.length < at + 4 + len) return;
        const mask = buf.subarray(at, at + 4), data = Buffer.from(buf.subarray(at + 4, at + 4 + len)).map((b, i) => b ^ mask[i % 4]), opc = buf[0] & 15;
        buf = buf.subarray(at + 4 + len);
        if (opc === 8) { sk.end(); return; }
        if (opc !== 1) continue;
        const m = JSON.parse(data.toString()), x = m.d || {};
        if (m.op === 1) {
          if (x.authentication !== sha(sha(password + salt) + challenge)) { sk.write(frame(0x88, Buffer.from([4009 >> 8, 4009 & 255]))); sk.end(); return; }
          sk.ok = true; send(sk, { op: 2, d: { negotiatedRpcVersion: 1 } });
        } else if (m.op === 6) {
          log.push(x.requestType);
          if (x.requestType === 'StartStream') streaming = true;
          if (x.requestType === 'StopStream') streaming = false;
          send(sk, { op: 7, d: { requestType: x.requestType, requestId: x.requestId, requestStatus: { result: true, code: 100 }, responseData: x.requestType === 'GetStreamStatus' ? { outputActive: streaming } : {} } });
          if (x.requestType === 'StartStream' || x.requestType === 'StopStream') event();
        }
      }
    });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { log, setStreaming(v) { streaming = v; event(); }, close() { for (const sk of socks) sk.destroy(); server.close(); } };
}
