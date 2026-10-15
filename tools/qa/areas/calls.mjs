// QA area: calls (AIG-1162): 📞 voice/video/screen share in a friend's DM over the owner's LiveKit. Setup keeps the API secret
// encrypted (never sent back); the token route is the owner's, for a friend in their DMs only, refuses when not set up, and
// signs a correct HS256 LiveKit token for a room the server works out (the same on both boards). Starting a call seals a guest
// token to the friend, whose board (no LiveKit of its own) joins with it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { freePort, startRelay, until, check, tmp, startServer, openPage, noErrors, def } from '../lib.mjs';

const SECDIR = tmp('callsec');
const SECRET = 'qa-livekit-secret-Zx81', KEY = 'APIqaKey123', URL = 'wss://livekit.example.test';
const claims = tok => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));
const signedWith = (tok, secret) => { const [h, p, sig] = tok.split('.'); return JSON.parse(Buffer.from(h, 'base64url')).alg === 'HS256' && crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url') === sig; };
// AIG-1171: a fake guest token (any secret: B cannot check A's signature, it checks the claims).
const fakeTok = (c, alg = 'HS256') => { const b = x => Buffer.from(JSON.stringify(x)).toString('base64url'), body = b({ alg, typ: 'JWT' }) + '.' + b(c); return body + '.' + crypto.createHmac('sha256', 'x').update(body).digest('base64url'); };
// AIG-1171: a stand-in for livekit-client in the page, so the call panel's joining, leaving and tiles can be checked without a LiveKit.
// window.lkHold: connect() waits until the test calls lkLog.rooms[i].ok(); window.lkRoomName: the room name the "server" answers with.
function stubLivekit() {
  const log = window.lkLog = { attach: 0, detach: 0, mic: 0, connects: [], disconnects: 0, rooms: [] };
  class Track { constructor(kind, source) { this.kind = kind; this.source = source; this.els = []; }
    attach() { log.attach++; const v = document.createElement(this.kind === 'audio' ? 'audio' : 'video'); this.els.push(v); return v; }
    detach(el) { const out = el ? this.els.filter(x => x === el) : this.els.slice(); this.els = this.els.filter(x => !out.includes(x)); log.detach += out.length; return out; } }
  class P { constructor(id) { this.identity = id; this.name = id; this.pubs = new Map(); this.isMicrophoneEnabled = false; this.isCameraEnabled = false; this.isScreenShareEnabled = false; this.isSpeaking = false; }
    getTrackPublication(s) { return this.pubs.get(s); }
    async setMicrophoneEnabled(v) { log.mic++; this.isMicrophoneEnabled = v; } async setCameraEnabled(v) { this.isCameraEnabled = v; } async setScreenShareEnabled(v) { this.isScreenShareEnabled = v; } }
  class Room { constructor() { this.h = {}; this.localParticipant = new P('me'); this.remoteParticipants = new Map(); this.name = ''; this.gone = false; log.rooms.push(this); }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }
    emit(e, ...a) { (this.h[e] || []).forEach(f => f(...a)); }
    connect(url, token) { log.connects.push(token); return new Promise(ok => { this.ok = () => { this.name = window.lkRoomName || 'r1'; ok(); }; if (!window.lkHold) this.ok(); }); }
    async disconnect() { log.disconnects++; this.gone = true; } }
  const E = ['TrackSubscribed', 'TrackUnsubscribed', 'ParticipantConnected', 'ParticipantDisconnected', 'ActiveSpeakersChanged', 'TrackMuted', 'TrackUnmuted', 'LocalTrackPublished', 'LocalTrackUnpublished', 'Disconnected'];
  window.LivekitClient = { Room, RoomEvent: Object.fromEntries(E.map(e => [e, e])), Track: { Source: { Camera: 'camera', ScreenShare: 'screen_share', Microphone: 'microphone' } }, Track_: Track, P };
}
const roomFor = (m1, m2) => 'aigile-dm-' + crypto.createHash('sha256').update('aigile-call-v1|' + [m1, m2].sort().join('|')).digest('hex').slice(0, 32);

def('calls', '📞 calls in a DM (LiveKit): secret kept encrypted, token route refuses non-participants / teams / not set up, token claims and room correct, the friend joins with the guest token (AIG-1162)', async (s, ctx) => {
  const relay = await startRelay({ RELAY_RATE: '100000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const a = s;
  const as = (method, url, headers, body) => fetch(a.base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) }).then(r => r.status);
  try {
    const st0 = await a.ok('GET', '/api/calls');
    check('calls start not set up, and the page is never told a secret', st0.set === false && st0.secret === false && Object.keys(st0).sort().join() === 'key,secret,set,url', st0);
    check('a token with DMs off is refused', (await a.api('POST', '/api/calls/dm/0123456789ab/token', {})).status === 409);

    // pair A and B through the relay
    const onA = await a.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const onB = await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await a.ok('POST', '/api/dms/invites', { name: 'Bea' });
    const ca = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Al' });
    const cb = await until(async () => (await a.ok('GET', '/api/dms/contacts'))[0]);
    check('A and B are friends', !!cb && cb.mailbox === onB.mailbox && ca.mailbox === onA.mailbox);

    // the page says how when calls are not set up
    const page = await openPage(ctx, '#/');
    await page.evaluate(id => Dms.show('dm:' + id), cb.id);
    await page.waitForSelector('#dmCallBtn');
    await page.click('#dmCallBtn');
    await page.waitForSelector('#callNote');
    check('📞 not set up: plain English pointing at Setup → Calls', /not set up/.test(await page.locator('#callNote').innerText()) && await page.locator('#callNoteGo').count() === 1);

    // refused: not set up, not a contact, a team, a background run
    const notset = await a.api('POST', `/api/calls/dm/${cb.id}/token`, {});
    check('not set up: the token route refuses (409) and says so', notset.status === 409 && /not set up/.test(notset.body.error || ''), notset);
    check('not set up: the state says so', JSON.stringify(await a.ok('GET', `/api/calls/dm/${cb.id}`)) === JSON.stringify({ set: false, invite: false }));
    check('saving without the secrets page token is refused', (await a.api('POST', '/api/calls', { url: URL, key: KEY, secret: SECRET })).status === 403);
    const tok = (await a.ok('GET', '/api/secrets/token')).token;
    check('a bad address is refused', (await a.api('POST', '/api/calls', { url: 'javascript:alert(1)', key: KEY, secret: SECRET, token: tok })).status === 400);
    check('no secret at all is refused', (await a.api('POST', '/api/calls', { url: URL, key: KEY, token: tok })).status === 400);
    const st1 = await a.ok('POST', '/api/calls', { url: URL, key: KEY, secret: SECRET, token: tok });
    check('saved: ready, address and key shown, secret only as "there is one"', st1.set === true && st1.url === URL && st1.key === KEY && st1.secret === true && !JSON.stringify(st1).includes(SECRET), st1);
    const leaks = [path.join(a.dir, 'aigile.local.json'), path.join(SECDIR, 'secrets', 'kept.json')].filter(f => fs.readFileSync(f, 'utf8').includes(SECRET));
    check('the secret is not in plain text in the settings file or the secrets store', leaks.length === 0, leaks);
    check('the secret store has it (encrypted)', /livekit:secret/.test(fs.readFileSync(path.join(SECDIR, 'secrets', 'kept.json'), 'utf8')));
    check('the GET never carries the secret', !JSON.stringify(await a.ok('GET', '/api/calls')).includes(SECRET));

    check('a contact that is not mine: 404', (await a.api('POST', '/api/calls/dm/0123456789ab/token', {})).status === 404);
    check('a malformed id: no such route (404)', (await a.api('POST', '/api/calls/dm/..%2Fx/token', {})).status === 404);
    check('a background run is refused (403)', await as('POST', `/api/calls/dm/${cb.id}/token`, { 'X-Aigile-Where': 'background' }, {}) === 403);
    check('a team (not the owner) is refused (403)', await as('POST', `/api/calls/dm/${cb.id}/token`, { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Lead' }, {}) === 403);
    check('a team cannot read the call settings either', await as('GET', '/api/calls', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Lead' }) === 403);
    check('a team cannot save them', await as('POST', '/api/calls', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Lead' }, { url: URL, key: KEY, secret: 'x', token: tok }) === 403);

    // the token
    const t1 = await a.ok('POST', `/api/calls/dm/${cb.id}/token`, { room: 'someone-elses-room' });
    const c1 = claims(t1.token), room = roomFor(onA.mailbox, onB.mailbox);
    check('the token is HS256, signed with the API secret', signedWith(t1.token, SECRET));
    check('claims: iss = API key, sub = my mailbox, my name', c1.iss === KEY && c1.sub === onA.mailbox && c1.name === 'Owner', c1);
    check('claims: the room is the DM\'s own (server-side, the page cannot pick one)', t1.room === room && c1.video.room === room && t1.url === URL, [t1.room, c1.video]);
    check('claims: join, publish, subscribe', c1.video.roomJoin === true && c1.video.canPublish === true && c1.video.canSubscribe === true);
    check('claims: valid now, for 2 hours', c1.nbf <= Date.now() / 1000 && Math.abs(c1.exp - Date.now() / 1000 - 7200) < 30, c1);
    check('the answer carries no secret', !JSON.stringify(t1).includes(SECRET));
    const mine = await a.ok('GET', `/api/dms/contacts/${cb.id}/messages`);
    check('my chat shows I started a call (no token in it)', mine.some(m => m.kind === 'call' && m.dir === 'out') && !JSON.stringify(mine).includes(t1.token.split('.')[2]));

    // the friend's board: no LiveKit, joins with the guest token it was sent
    const sb = await until(async () => { const x = await b.ok('GET', `/api/calls/dm/${ca.id}`); return x.invite ? x : null; });
    check('B got the call invite (B has no LiveKit)', sb && sb.set === false && sb.invite === true, sb);
    const t2 = await b.ok('POST', `/api/calls/dm/${ca.id}/token`, {});
    const c2 = claims(t2.token);
    check('B\'s token is A\'s guest token: same room, B\'s identity, signed by A\'s secret', t2.theirs === true && t2.room === room && c2.video.room === room && c2.sub === onB.mailbox && c2.iss === KEY && signedWith(t2.token, SECRET), c2);
    // AIG-1171: B keeps a guest token only when its own claims are for this DM's room, for B, and live (not the envelope's word)
    const invFile = path.join(b.data, 'calls', 'invites.json'), invOk = fs.readFileSync(invFile, 'utf8');
    const nowS = Math.floor(Date.now() / 1000), good = { iss: KEY, sub: onB.mailbox, nbf: nowS - 10, exp: nowS + 3600, video: { room, roomJoin: true } };
    const forged = { 'another room': { ...good, video: { room: 'aigile-dm-0123456789abcdef0123456789abcdef', roomJoin: true } }, 'someone else (A\'s identity)': { ...good, sub: onA.mailbox },
      'expired': { ...good, exp: nowS - 5 }, 'living for days': { ...good, exp: nowS + 5 * 86400 }, 'not yet valid': { ...good, nbf: nowS + 3600 }, 'no join grant': { ...good, video: { room } } };
    const kept = async tokn => { const all = JSON.parse(invOk); all[ca.id].token = tokn; fs.writeFileSync(invFile, JSON.stringify(all)); const st = await b.ok('GET', `/api/calls/dm/${ca.id}`); const tk = await b.api('POST', `/api/calls/dm/${ca.id}/token`, {}); return st.invite || tk.body.token === tokn; };
    const took = []; for (const [k, c] of Object.entries(forged)) if (await kept(fakeTok(c))) took.push(k);
    if (await kept(fakeTok(good, 'none'))) took.push('alg none');
    check('a guest token for another room / another person / expired / too long / not yet valid / no join / alg none is never used', took.length === 0, took);
    check('a guest token with the right claims is used (the check is on the claims, not the signature)', await kept(fakeTok(good)));
    fs.writeFileSync(invFile, invOk);
    check('B\'s chat shows the call line', (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.kind === 'call' && m.dir === 'in'));

    // blocked: no token
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { blocked: true });
    check('a blocked friend: refused (409)', (await a.api('POST', `/api/calls/dm/${cb.id}/token`, {})).status === 409);
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { blocked: false });

    // Setup shows the section, set up
    const setup = await openPage(ctx, '#/setup/calls');
    await setup.waitForSelector('#callSetState');
    check('Setup → Calls shows Ready and the address, the secret box empty', /Ready/.test(await setup.locator('#callSetState').innerText()) && await setup.locator('#callSetUrl').inputValue() === URL && await setup.locator('#callSetSecret').inputValue() === '');
    // AIG-1171: the page checks the joined room is the one the board named, before the mic goes on
    const pg = await openPage(ctx, '#/');
    await pg.evaluate(stubLivekit);
    await pg.evaluate(() => { window.lkRoomName = 'someone-elses-room'; Call.join({ title: 'Bea', getToken: async () => ({ url: 'wss://x', token: 'a.b.c', room: 'r1' }) }); });
    await pg.waitForSelector('#callNote');
    const wr = await pg.evaluate(() => ({ note: document.getElementById('callNote').textContent, mic: lkLog.mic, gone: lkLog.rooms[0].gone, active: Call.active() }));
    check('a token that lands in another room: left at once, mic never on, says so', /different call/.test(wr.note) && wr.mic === 0 && wr.gone && !wr.active, wr);
    await pg.evaluate(() => { Call.close(); window.lkRoomName = 'r1'; });
    // AIG-1171: Leave while still connecting: the join stops there, the room is left and the mic never goes on
    await pg.evaluate(() => { window.lkHold = true; window.lkTk = { url: 'wss://x', token: 'a.b.c', room: 'r1' }; Call.join({ title: 'Bea', getToken: async () => lkTk }); });
    await pg.waitForFunction(() => lkLog.rooms.length === 2 && document.getElementById('callLeave'));
    await pg.click('#callLeave');
    await pg.evaluate(async () => { lkLog.rooms[1].ok(); await new Promise(r => setTimeout(r, 200)); });
    const lv = await pg.evaluate(() => ({ mic: lkLog.mic, gone: lkLog.rooms[1].gone, active: Call.active(), shown: !document.getElementById('callPanel').hidden }));
    check('Leave while connecting: left, mic never on, no panel', lv.mic === 0 && lv.gone && !lv.active && !lv.shown, lv);
    await pg.evaluate(async () => { window.lkHold = false; Call.join({ title: 'Bea', getToken: async () => lkTk }); });
    await pg.waitForFunction(() => Call.active() && lkLog.mic === 1);
    check('and a new call joins straight after (not stuck busy)', await pg.evaluate(() => lkLog.rooms.length === 3 && !lkLog.rooms[2].gone));
    noErrors(page); noErrors(setup); noErrors(pg);
    const cleared = await a.ok('POST', '/api/calls', { clear: true, token: tok });
    check('Remove clears it all', cleared.set === false && cleared.secret === false && !cleared.url);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_SECRETS_DIR: SECDIR, AIGILE_DM_POLL_MS: '300' });
