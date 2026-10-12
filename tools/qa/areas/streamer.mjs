// QA area: streamer (AIG-590..592): the 🎥 switch hides private projects (sidebar, home, direct link, inbox), DMs and friends; masks
// IPs, emails, keys, passwords and server names as •••• in card text and comments; Copy still gets the real text; it turns itself
// on and off with OBS / Streamlabs (a stub file stands in for the process list) unless Setup says not to.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, tmp, until, sleep, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

const STUB = path.join(tmp('stream'), 'obs-running.txt');
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

  const page = await openPage(ctx, '#/');
  await page.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); }; });
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
  check('Setup > My servers keeps the real value in the box (for editing)', srvInputs.includes('Prodbox') && srvInputs.includes('root@10.9.8.7'), srvInputs);
  check('and covers them on screen', await page.evaluate(() => [...document.querySelectorAll('#serversBox input[data-srv]')].every(i => getComputedStyle(i).webkitTextSecurity === 'disc')));
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
  noErrors(page);
}, true, { AIGILE_STREAM_STUB: STUB, AIGILE_STREAM_MS: '300' });
