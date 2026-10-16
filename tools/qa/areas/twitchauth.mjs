// QA area: twitchauth (AIG-1346). 💜 Sign in with Twitch (OAuth device code) and the channel picker. No real Twitch: a fake
// id.twitch.tv + api.twitch.tv runs inside this QA process (AIGILE_TWITCH_STUB; POST /api/twitch/stub-base points the board at it),
// the activate page is answered by the browser route, and the IRC link is off under the stub.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { check, def, tmp, freePort, openPage, noErrors, sleep } from '../lib.mjs';

const SECDIR = tmp('twauthsec');
const CLIENT = 'abcdefghijklmnopqrstuvwxyz0123';
const listen = (srv, port) => new Promise(r => srv.listen(port, '127.0.0.1', r));

function fakeTwitch() {
  const seen = { calls: [] }, mode = { pending: 2, device: 'ok', refresh: 'ok', n: 0, mod: ['modded_one'], follows: ['followed_a', 'modded_one', 'followed_b'] };
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      const out = (j, st) => { res.writeHead(st || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
      const u = new URL(req.url, 'http://x');
      if (u.pathname.startsWith('/helix/')) {
        const auth = String(req.headers.authorization || ''), what = u.pathname.slice(7);
        seen.calls.push({ what, auth, clientId: req.headers['client-id'], user: u.searchParams.get('user_id') });
        if (!/^Bearer AT-\d+$/.test(auth) || req.headers['client-id'] !== CLIENT) return out({ status: 401, message: 'Invalid OAuth token' }, 401);
        if (what === 'users') return out({ data: [{ id: '4242', login: 'smizflark', display_name: 'SmizFlark' }] });
        if (u.searchParams.get('user_id') !== '4242') return out({ status: 400, message: 'bad user' }, 400);
        if (what === 'moderation/channels') return out({ data: mode.mod.map(n => ({ broadcaster_id: '1', broadcaster_login: n, broadcaster_name: n })), pagination: {} });
        if (what === 'channels/followed') return out({ data: mode.follows.map(n => ({ broadcaster_id: '2', broadcaster_login: n, broadcaster_name: n })), total: mode.follows.length, pagination: {} });
        return out({ status: 404, message: 'no' }, 404);
      }
      const f = Object.fromEntries(new URLSearchParams(body)), what = u.pathname.split('/').pop();
      seen.calls.push({ what, ...f });
      if (f.client_id !== CLIENT) return out({ status: 400, message: 'invalid client' }, 400);
      if (what === 'device') return out({ device_code: 'DEV-1', user_code: 'WDJB-MJHT', verification_uri: 'https://www.twitch.tv/activate?public=true&device-code=WDJBMJHT', expires_in: 1800, interval: 1 });
      if (f.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
        if (mode.pending-- > 0) return out({ status: 400, message: 'authorization_pending' }, 400);
        if (mode.device === 'deny') return out({ status: 400, message: 'authorization_declined' }, 400);
        return out({ access_token: 'AT-' + (++mode.n), refresh_token: 'RT-' + mode.n, expires_in: 1, scope: f.scopes.split(' '), token_type: 'bearer' });
      }
      if (f.grant_type === 'refresh_token') {
        if (mode.refresh === 'gone') return out({ status: 400, message: 'Invalid refresh token' }, 400);
        return out({ access_token: 'AT-' + (++mode.n), refresh_token: 'RT-' + mode.n, expires_in: 1 });   // runs out at once: every use refreshes
      }
      out({ status: 400, message: 'unsupported' }, 400);
    });
  });
  return { srv, seen, mode };
}

def('twitchauth', '💜 Sign in with Twitch: device code (waiting, approved, denied), tokens kept encrypted and refreshed, no Client ID explains the one step, channel picker (own, moderated, followed, recent; search; any name), switch keeps the sign-in (AIG-1346)', async (s, ctx) => {
  const tw = fakeTwitch(), port = await freePort(); await listen(tw.srv, port);
  try {
    const fakeBase = 'http://127.0.0.1:' + port;
    await s.ok('POST', '/api/twitch/stub-base', { id: fakeBase, api: fakeBase });
    const opened = [];
    await ctx.route('https://www.twitch.tv/**', r => { opened.push(r.request().url()); return r.fulfill({ contentType: 'text/html', body: '<title>activate</title>activate' }); });
    const { token } = await s.ok('GET', '/api/secrets/token');
    const settings = () => fs.readFileSync(path.join(s.dir, 'aigile.local.json'), 'utf8');
    const kept = () => { try { return fs.readFileSync(path.join(SECDIR, 'secrets', 'kept.json'), 'utf8'); } catch { return ''; } };

    // No Client ID: the server refuses with the one step, and the page button explains it
    const r0 = await s.api('POST', '/api/twitch/auth/start', { token });
    check('no Client ID: sign-in start says the one step (dev.twitch.tv/console, Client type Public)', r0.status === 400 && /dev\.twitch\.tv\/console/.test(r0.body.error) && /Public/.test(r0.body.error), r0);
    const su = await openPage(ctx, '#/setup'); await su.evaluate(() => { window.__twAuthPollMs = 150; });
    await su.waitForSelector('#twAuth'); await su.click('#twAuth');
    await su.waitForSelector('#twAuthNoId');
    check('no Client ID: the button shows the how-to (Register Your Application, Chat Bot, Public, Client ID)', /Register Your Application/.test(await su.textContent('#twAuthNoId')) && /Chat Bot/.test(await su.textContent('#twAuthNoId')) && /Client ID/.test(await su.textContent('#twAuthNoId')));
    check('the sign-in screen says why each permission is asked', /moderate/.test(await su.textContent('#twScopes')) && /follow/.test(await su.textContent('#twScopes')));
    check('a bad Client ID is refused', (await s.api('POST', '/api/twitch/config', { clientId: 'no!', token })).status === 400);
    check('starting needs the secrets page token', (await s.api('POST', '/api/twitch/auth/start', {})).status === 403);

    // Save the Client ID in Setup, then sign in: waiting (pending twice), then approved
    await su.fill('#twClientId', CLIENT); await su.click('#twClientSave');
    for (let i = 0; i < 50 && (await s.ok('GET', '/api/twitch/config')).clientId !== CLIENT; i++) await sleep(100);
    check('Setup saved the Client ID (plain setting, it is public)', (await s.ok('GET', '/api/twitch/config')).clientId === CLIENT);
    const popP = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await su.click('#twAuth');
    await su.waitForSelector('#twAuthUserCode');
    const code = await su.textContent('#twAuthUserCode'), st1 = await s.ok('GET', '/api/twitch/auth/status');
    check('waiting: the code and Twitch\'s activate link show while Twitch says authorization_pending', code === 'WDJB-MJHT' && st1.state === 'waiting' && /twitch\.tv\/activate/.test(await su.getAttribute('#twAuthLink', 'href')), { code, st1 });
    const pop = await popP; if (pop) await pop.close();
    check('the activate page was opened for you', opened.some(u => /twitch\.tv\/activate/.test(u)), opened);
    await su.waitForSelector('#twAuthOn', { timeout: 10000 });
    check('approved: signed in as the Helix login', /smizflark/.test(await su.textContent('#twAuthOn')));
    const dev = tw.seen.calls.find(c => c.what === 'device');
    check('device code asked with the client id and only the scopes used', dev && dev.client_id === CLIENT && dev.scopes === 'chat:read chat:edit user:read:moderated_channels user:read:follows', dev);
    check('the board polled while pending, then took the token', tw.seen.calls.filter(c => c.grant_type === 'urn:ietf:params:oauth:grant-type:device_code').length >= 3);
    const c1 = await s.ok('GET', '/api/twitch/config');
    check('config: canReply via twitch, and no token anywhere on the page side', c1.canReply && c1.via === 'twitch' && c1.signedIn && !/AT-|RT-/.test(JSON.stringify(c1) + JSON.stringify(await s.ok('GET', '/api/twitch/auth/status'))), c1);
    check('the tokens are kept encrypted in the secret store, never in the settings file', /"twitch:oauth": "aes:/.test(kept()) && !/AT-|RT-/.test(kept()) && !/AT-|RT-/.test(settings()), settings());

    // Credential changes use the same owner and secrets gate as sign-out (AIG-1401).
    const before = settings(), stored = kept();
    for (const [route, body] of [['config', { clientId: CLIENT + 'x', token }], ['token', { login: '', token: '', secretsToken: token }]]) {
      const r = await fetch(s.base + '/api/twitch/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'background', 'X-Aigile-As': 'Cody' }, body: JSON.stringify(body) });
      check(`agent cannot change Twitch ${route} even with page token`, r.status === 403 && settings() === before && kept() === stored);
    }
    check('changing Client ID requires page token', (await s.api('POST', '/api/twitch/config', { clientId: CLIENT + 'x' })).status === 403 && settings() === before);
    check('owner can change Client ID with page token', (await s.api('POST', '/api/twitch/config', { clientId: CLIENT + 'x', token })).status === 200 && !(await s.ok('GET', '/api/twitch/config')).signedIn && !/twitch:oauth/.test(kept()));
    await s.ok('POST', '/api/twitch/config', { clientId: CLIENT, token });
    tw.mode.pending = 0;
    await su.reload(); await su.evaluate(() => { window.__twAuthPollMs = 150; }); await su.waitForSelector('#twAuth');
    await su.click('#twAuth'); await su.waitForSelector('#twAuthOn', { timeout: 10000 });
    fs.mkdirSync('C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots', { recursive: true });
    await su.locator('#twitchBox').scrollIntoViewIfNeeded();
    await su.screenshot({ path: 'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots/AIG-1401.png' });

    // The picker: own, moderated, followed, recent; a name only in its first group
    await s.ok('POST', '/api/twitch/config', { channel: 'recent_one' });
    const g = await s.ok('GET', '/api/twitch/channels?fresh=1');
    check('channel groups: own, moderated, followed (no repeats), recent', g.own.join() === 'smizflark' && g.mod.join() === 'modded_one' && g.follows.join() === 'followed_a,followed_b' && g.recent.join() === 'recent_one', g);
    check('Helix asked for your moderated and followed channels with your user id', ['moderation/channels', 'channels/followed'].every(w => tw.seen.calls.some(c => c.what === w && c.user === '4242')));
    check('a refresh happened: the 1 s access token was swapped with the refresh token', tw.seen.calls.some(c => c.grant_type === 'refresh_token' && c.refresh_token === 'RT-1') && !/RT-|AT-/.test(kept()));
    await su.reload(); await su.waitForSelector('#twSList [data-twgrp="mod"]', { timeout: 10000 });
    const heads = await su.locator('#twSList .tw-grp').allTextContents();
    check('Setup lists the groups in order with headings', heads.join('|') === 'Your channel|Channels you moderate|Channels you follow|Recent', heads);
    await su.fill('#twChannel', 'follow');
    const shown = await su.locator('#twSList .tw-ch').allTextContents();
    check('typing filters the list (and offers the typed name)', shown.join() === 'Join #follow,#followed_a,#followed_b', shown);
    await su.fill('#twChannel', 'brand_new_chan');
    check('any other name still joins (offered at the top)', /brand_new_chan/.test(await su.textContent('#twSList .tw-ch')));
    await su.click('#twSave'); await su.waitForFunction(() => /Saved/.test(document.getElementById('twState').textContent));
    let c2 = await s.ok('GET', '/api/twitch/config');
    check('joined a typed channel, still signed in', c2.channel === 'brand_new_chan' && c2.signedIn, c2);
    await su.waitForSelector('#twSList [data-twch="modded_one"]'); await su.click('#twSList [data-twch="modded_one"]');
    await su.waitForFunction(() => /Saved/.test(document.getElementById('twState').textContent));
    c2 = await s.ok('GET', '/api/twitch/config');
    check('a click in the list joins that channel', c2.channel === 'modded_one' && c2.recent[0] === 'modded_one' && c2.recent[1] === 'brand_new_chan', c2);

    // Recent: last 10, newest first, no repeats
    for (let i = 0; i < 12; i++) await s.ok('POST', '/api/twitch/config', { channel: 'chan_' + i });
    await s.ok('POST', '/api/twitch/config', { channel: 'chan_5' });
    const rc = (await s.ok('GET', '/api/twitch/config')).recent;
    check('recent keeps the last 10, newest first, no repeats', rc.length === 10 && rc[0] === 'chan_5' && rc[1] === 'chan_11' && new Set(rc).size === 10 && !rc.includes('chan_0'), rc);

    // Switch from the chat window: the ⇄ picker under the head, and the pop-out
    await s.ok('POST', '/api/twitch/stub-message', { name: 'Alice', content: 'hello chan_5' });
    const pg = await openPage(ctx, '#/');
    await pg.click('#dmRail [data-dms]'); await pg.waitForSelector('[data-dmfilter="twitch"]'); await pg.click('[data-dmfilter="twitch"]');
    await pg.waitForSelector('#dmPanel .dm-row'); await pg.click('#dmPanel .dm-row'); await pg.waitForSelector('#twSwitch');
    await pg.click('#twSwitch'); await pg.waitForSelector('#twHList [data-twch="followed_a"]', { timeout: 10000 });
    await pg.click('#twHList [data-twch="followed_a"]');
    await pg.waitForFunction(() => /#followed_a/.test(document.getElementById('twHeadName').textContent));
    const c3 = await s.ok('GET', '/api/twitch/config');
    check('the chat window joins the picked channel and stays signed in (reply box still there)', c3.channel === 'followed_a' && c3.signedIn && await pg.locator('#twText').count() === 1 && (await s.ok('GET', '/api/twitch/messages')).length === 0, c3);
    await pg.fill('#twText', 'hi followers'); await pg.press('#twText', 'Enter');
    await pg.waitForFunction(() => /hi followers/.test(document.getElementById('dmList').textContent), null, { timeout: 10000 });
    const sent = await s.ok('GET', '/api/twitch/stub-sent');
    check('replying in the new channel goes as you, via the Twitch sign-in', sent.at(-1).channel === 'followed_a' && sent.at(-1).login === 'smizflark' && sent.at(-1).via === 'twitch', sent);
    const tp = await openPage(ctx, '#/'); await tp.goto(s.base + '/#/pop-twitch'); await tp.reload(); await tp.waitForSelector('#twPop #twSwitch');
    await tp.click('#twSwitch'); await tp.fill('#twHQ', 'chan_11'); await tp.press('#twHQ', 'Enter');
    await tp.waitForFunction(() => /#chan_11/.test(document.title), null, { timeout: 10000 });
    check('the pop-out switches channel too', (await s.ok('GET', '/api/twitch/config')).channel === 'chan_11');
    noErrors(tp); await tp.close();

    // Phone width + dark: nothing sticks out of the Twitch box
    await su.setViewportSize({ width: 390, height: 800 }); await su.emulateMedia({ colorScheme: 'dark' });
    await su.reload(); await su.waitForSelector('#twSList .tw-ch');
    const over = await su.evaluate(() => { const b = document.getElementById('twitchBox'); return b.scrollWidth - b.clientWidth; });
    check('phone width, dark: the Twitch box fits', over <= 1, over);

    // Refresh token gone: signed out with a clear message
    tw.mode.refresh = 'gone';
    const r1 = await s.api('POST', '/api/twitch/send', { text: 'x' });
    check('a run-out refresh token: send says sign in again, and the sign-in is dropped', r1.status === 400 && /run out/.test(r1.body.error) && !(await s.ok('GET', '/api/twitch/config')).signedIn && !/twitch:oauth/.test(kept()), r1);
    tw.mode.refresh = 'ok';

    // Denied
    tw.mode.pending = 1; tw.mode.device = 'deny';
    await su.setViewportSize({ width: 1280, height: 800 }); await su.emulateMedia({ colorScheme: 'light' });
    await su.reload(); await su.evaluate(() => { window.__twAuthPollMs = 150; }); await su.waitForSelector('#twAuth');
    const pop2 = ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null);
    await su.click('#twAuth'); (await pop2)?.close();
    await su.waitForSelector('#twAuthErr', { timeout: 10000 });
    check('denied on Twitch: the page says you said no, nothing kept', /said no/.test(await su.textContent('#twAuthErr')) && !(await s.ok('GET', '/api/twitch/config')).signedIn && !/twitch:oauth/.test(kept()));

    // Sign in again, then Sign out deletes the tokens
    tw.mode.pending = 0; tw.mode.device = 'ok';
    await su.click('#twAuth'); await su.waitForSelector('#twAuthOn', { timeout: 10000 });
    await su.click('#twAuthOut'); await su.waitForSelector('#twAuth');
    check('Sign out deletes the tokens and the login', !/twitch:oauth/.test(kept()) && !/authLogin/.test(settings()) && !(await s.ok('GET', '/api/twitch/config')).canReply);
    check('the Twitch code never logs a token', !/console\./.test(fs.readFileSync(new URL('../../../lib/twitch.js', import.meta.url), 'utf8')));
    noErrors(su); noErrors(pg); await su.close(); await pg.close();
  } finally { tw.srv.close(); }
}, true, { AIGILE_TWITCH_STUB: '1', AIGILE_SECRETS_DIR: SECDIR });
