// QA area: phonetunnel (AIG-1008), the board reachable on a public name through an ssh -R tunnel to the owner's own server.
// A stub ssh (AIGILE_SSH_STUB, a node script that logs its argv and stays alive) stands in, so nothing really connects anywhere.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, check, sleep, tmp, mkProject, openPage, noErrors, def } from '../lib.mjs';

const dir = tmp('phonetunnel'), log = path.join(dir, 'ssh.log'), stub = path.join(dir, 'ssh-stub.js');
const HOST = 'test.aigile.lol', ORIGIN = 'https://' + HOST;
// Logs { argv }, then stays alive like `ssh -N` until the board closes its stdin (or two minutes pass).
fs.writeFileSync(stub, `require('fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2) }) + '\\n');
process.stdin.resume(); process.stdin.on('end', () => process.exit(0)); setTimeout(() => process.exit(0), 120000);`);
const runs = () => { try { return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };
const raw = (method, p, headers = {}, body) => new Promise(res => {
  const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers } }, x => {
    let s = ''; x.on('data', d => { s += d; }); x.on('end', () => { let j = null; try { j = JSON.parse(s); } catch {} res({ status: x.statusCode, body: j, text: s, headers: x.headers, cookie: x.headers['set-cookie'] }); });
  });
  r.on('error', () => res({ status: 0 })); r.end(body ? JSON.stringify(body) : undefined);
});

def('phonetunnel', 'phone tunnel: Setup > Phone > Over my server saves phone.tunnel, the board keeps ssh -R (stub) running with BatchMode/ExitOnForwardFailure on 127.0.0.1, status in /api/phone, /_pair/<code> is a plain page that spends nothing, pairing through it works, the tunnel host stays guarded (AIG-1008)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const post = (b) => s.api('POST', '/api/phone/tunnel', b);

  // Config: refused without an ssh server, then saved and loaded back.
  check('no ssh server saved: refused', (await post({ server: 'Smizflark', host: HOST })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'Smizflark', kind: 'ssh', value: 'rich@92.113.144.194', port: 2222, key: 'C:/keys/id_smiz' }] } });
  check('an unknown server name is refused', (await post({ server: 'Nope', host: HOST })).status === 400);
  check('a bad host is refused', (await post({ server: 'Smizflark', host: 'not a host' })).status === 400);
  check('this computer\'s own name is refused as the host', (await post({ server: 'Smizflark', host: 'localhost' })).status === 400);
  check('a bad port is refused', (await post({ server: 'Smizflark', host: HOST, port: 80 })).status === 400);
  check('nothing ran for the refusals', runs().length === 0);
  const before = await s.ok('GET', '/api/phone');
  check('before saving: no tunnel, the ssh server is offered', before.tunnel === null && before.sshServers.join() === 'Smizflark', before);

  const saved = await s.ok('POST', '/api/phone/tunnel', { server: 'smizflark', host: ' HTTPS://' + HOST.toUpperCase() + '/', port: '' });
  check('saved: server name as stored, host cleaned, default port 14321', saved.tunnel && saved.tunnel.server === 'Smizflark' && saved.tunnel.host === HOST && saved.tunnel.port === 14321, saved.tunnel);
  check('the tunnel host is a phone host', saved.hosts.includes(HOST));
  const file = JSON.parse(fs.readFileSync(path.join(s.dir, 'aigile.local.json'), 'utf8'));
  check('phone.tunnel is in aigile.local.json', JSON.stringify(file.phone.tunnel) === JSON.stringify({ server: 'Smizflark', host: HOST, port: 14321 }), file.phone);

  // The ssh command line.
  for (let i = 0; i < 40 && !runs().length; i++) await sleep(100);
  const argv = (runs()[0] || {}).argv || [];
  const has = (...a) => argv.join('\u0000').includes(a.join('\u0000'));
  check('ssh -N, BatchMode, ExitOnForwardFailure, ServerAliveInterval 30', argv[0] === '-N' && has('-o', 'BatchMode=yes') && has('-o', 'ExitOnForwardFailure=yes') && has('-o', 'ServerAliveInterval=30'), argv);
  check('the forward binds 127.0.0.1 on both sides: -R 127.0.0.1:14321:127.0.0.1:<board port>', has('-R', `127.0.0.1:14321:127.0.0.1:${PORT}`), argv);
  check('the saved port, key file and address are used, after --', has('-p', '2222') && has('-i', 'C:/keys/id_smiz') && argv.at(-2) === '--' && argv.at(-1) === 'rich@92.113.144.194', argv);
  check('exactly one ssh was started', runs().length === 1);

  // Status.
  let st = null;
  for (let i = 0; i < 40; i++) { st = (await s.ok('GET', '/api/phone')).tunnel; if (st && st.state === 'up') break; await sleep(100); }
  check('status: up, with its server, host and port', st && st.state === 'up' && st.server === 'Smizflark' && st.host === HOST && st.port === 14321 && st.error === '', st);

  // The pairing page.
  const link = await s.ok('POST', '/api/phone/start', { host: HOST, name: 'Pixel' });
  const code = (link.url.match(/\/_pair\/([A-Za-z0-9_-]+)$/) || [])[1];
  check('the pair link on the tunnel host is https://<host>/_pair/<code>', link.url.startsWith(ORIGIN + '/_pair/') && !!code, link.url);
  const other = await s.ok('POST', '/api/phone/start', { host: 'mypc.tail1234.ts.net', name: 'Other' });
  check('another phone host keeps the #/pair link', /^https:\/\/mypc\.tail1234\.ts\.net\/#\/pair\//.test(other.url), other.url);
  const pg = await raw('GET', '/_pair/' + code, { Host: HOST });
  check('GET /_pair/<code>: an HTML page with the Pair this phone button', pg.status === 200 && /text\/html/.test(pg.headers['content-type']) && /Pair this phone/.test(pg.text) && /<button/.test(pg.text), pg.status);
  check('the page is self-contained: no external request, no code inside', !/(src|href|action)=|https?:\/\/|@import|url\(/.test(pg.text) && !pg.text.includes(code));
  check('the page has a tight CSP and is not cached', /default-src 'none'/.test(pg.headers['content-security-policy']) && /no-store/.test(pg.headers['cache-control']));
  await raw('GET', '/_pair/' + code, { Host: HOST });
  check('GET /_pair on localhost is not the pairing page', !/Pair this phone/.test((await raw('GET', '/_pair/' + code, { Host: 'localhost:' + PORT })).text));
  check('GET /_pair on an unknown host is not served', !/Pair this phone/.test((await raw('GET', '/_pair/' + code, { Host: 'evil.example' })).text));

  // Guarded like any phone host.
  check('no cookie on the tunnel host: API refused', (await raw('GET', '/api/chats', { Host: HOST })).status === 403);
  check('no cookie: Setup and the tunnel route refused', (await raw('POST', '/api/phone/tunnel', { Host: HOST, Origin: ORIGIN }, { server: '' })).status === 403);
  check('pairing from another site refused', (await raw('POST', '/api/phone/pair', { Host: HOST, Origin: 'https://evil.example' }, { code })).status === 403);
  const pr = await raw('POST', '/api/phone/pair', { Host: HOST, Origin: ORIGIN }, { code });
  const set = String((pr.cookie || [])[0] || ''), cookie = set.split(';')[0];
  check('the page\'s POST buys the cookie (the earlier GETs did not spend the code)', pr.status === 200 && /^aigile_phone=[A-Za-z0-9_-]{40,}.*HttpOnly.*Secure.*SameSite=Strict/.test(set), pr);
  check('the code works only once', (await raw('POST', '/api/phone/pair', { Host: HOST, Origin: ORIGIN }, { code })).status === 403);
  check('the page itself still opens for a used code (it spends nothing)', (await raw('GET', '/_pair/' + code, { Host: HOST })).status === 200);
  const ph = { Host: HOST, Cookie: cookie };
  check('with the cookie: the API works', (await raw('GET', '/api/chats', ph)).status === 200);
  check('with the cookie: no terminal, secrets, phone routes or Setup changes', (await raw('GET', '/api/terminal/token', ph)).status === 403 && (await raw('GET', '/api/secrets/token', ph)).status === 403
    && (await raw('GET', '/api/phone', ph)).status === 403 && (await raw('POST', '/api/phone/tunnel', { ...ph, Origin: ORIGIN }, { server: '' })).status === 403 && (await raw('POST', '/api/setup', { ...ph, Origin: ORIGIN }, { prefs: { runCmd: 'calc' } })).status === 403);
  check('the cookie on another host: refused', (await raw('GET', '/api/chats', { Host: 'other.example', Cookie: cookie })).status === 403);
  const after = await s.ok('GET', '/api/phone');
  check('pairing kept the tunnel setting and listed the phone', after.tunnel && after.tunnel.host === HOST && after.devices.some(d => d.name === 'Pixel' && d.host === HOST), after);

  // The Setup box.
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#phTun');
  check('Setup: Over my server shows the server, host and Tunnel up', (await page.inputValue('#phTunSrv')) === 'Smizflark' && (await page.inputValue('#phTunHost')) === HOST && /Tunnel up/.test(await page.textContent('#phTunState')), await page.textContent('#phTun'));
  await page.fill('#phTunPort', '14400');
  await page.click('#phTunSave');
  await page.waitForFunction(() => document.querySelector('#phTunPort') && document.querySelector('#phTunPort').value === '14400');
  for (let i = 0; i < 40 && runs().length < 2; i++) await sleep(100);
  check('Save: the tunnel restarts on the new port', runs().length === 2 && runs()[1].argv.join(' ').includes(`-R 127.0.0.1:14400:127.0.0.1:${PORT}`), runs().map(r => r.argv));
  await page.click('#phTunOff');
  await page.waitForFunction(() => !document.querySelector('#phTunOff'));
  const off = await s.ok('GET', '/api/phone');
  check('Turn off: no tunnel, the host and its phone stay', off.tunnel === null && off.hosts.includes(HOST) && off.devices.some(d => d.host === HOST));
  check('Turn off: removed from aigile.local.json', !('tunnel' in JSON.parse(fs.readFileSync(path.join(s.dir, 'aigile.local.json'), 'utf8')).phone));
  noErrors(page);
}, true, { AIGILE_NO_TAILSCALE: '1', AIGILE_SSH_STUB: stub, AIGILE_TUNNEL_UP_MS: '300' });
