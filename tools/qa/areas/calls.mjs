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
const SECRET2 = 'qa-livekit-secret-Bb22', KEY2 = 'APIqaKeyB', URL2 = 'wss://livekit-b.example.test';   // B's own (AIG-1171)
const RL_SECRET = 'qa-relay-lk-secret-R9', RL_KEY = 'APIqaRelay', RL_URL = 'wss://call.example.test';   // the relay's (AIG-1218)
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
    async setMicrophoneEnabled(v) { log.mic++; if (window.lkMicErr) throw Object.assign(new Error(window.lkMicErr === 'NotFoundError' ? 'Requested device not found' : 'Permission denied'), { name: window.lkMicErr }); this.isMicrophoneEnabled = v; } async setCameraEnabled(v) { this.isCameraEnabled = v; } async setScreenShareEnabled(v) { this.isScreenShareEnabled = v; } }
  class Room { constructor() { this.h = {}; this.localParticipant = new P('me'); this.remoteParticipants = new Map(); this.name = ''; this.gone = false; log.rooms.push(this); }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }
    emit(e, ...a) { (this.h[e] || []).forEach(f => f(...a)); }
    connect(url, token) { log.connects.push(token); return new Promise(ok => { this.ok = () => { this.name = window.lkRoomName || 'r1'; ok(); }; if (!window.lkHold) this.ok(); }); }
    async disconnect() { log.disconnects++; this.gone = true; }
    static async getLocalDevices(k) { return k === 'audiooutput' ? [{ deviceId: 'spk1', label: 'Speakers' }] : [{ deviceId: k + '1', label: 'Default ' + k }, { deviceId: k + '2', label: 'Headset ' + k }]; }
    getActiveDevice(k) { return (log.dev || {})[k] || k + '1'; }
    async switchActiveDevice(k, id) { (log.dev = log.dev || {})[k] = id; } }
  const E = ['AudioPlaybackStatusChanged', 'TrackSubscribed', 'TrackUnsubscribed', 'ParticipantConnected', 'ParticipantDisconnected', 'ActiveSpeakersChanged', 'TrackMuted', 'TrackUnmuted', 'LocalTrackPublished', 'LocalTrackUnpublished', 'Disconnected', 'Reconnecting', 'Reconnected'];
  window.LivekitClient = { Room, RoomEvent: Object.fromEntries(E.map(e => [e, e])), Track: { Source: { Camera: 'camera', ScreenShare: 'screen_share', Microphone: 'microphone' } }, Track_: Track, P };
}
const roomFor = (m1, m2) => 'aigile-dm-' + crypto.createHash('sha256').update('aigile-call-v1|' + [m1, m2].sort().join('|')).digest('hex').slice(0, 32);

def('calls', '📞 calls in a DM (LiveKit): secret kept encrypted, token route refuses non-participants / teams / not set up, token claims and room correct, the friend joins with the guest token (AIG-1162)', async (s, ctx) => {
  // AIG-1218: the relay runs the call server (a stand-in key and secret): calls work with no setup, own server is the Advanced choice
  const relay = await startRelay({ RELAY_RATE: '100000', RELAY_LIVEKIT_URL: RL_URL, RELAY_LIVEKIT_KEY: RL_KEY, RELAY_LIVEKIT_SECRET: RL_SECRET });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300', AIGILE_SECRETS_DIR: tmp('callsecb') }, await freePort());
  const a = s;
  const as = (method, url, headers, body) => fetch(a.base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) }).then(r => r.status);
  try {
    const st0 = await a.ok('GET', '/api/calls');
    check('calls start not set up (no relay yet), and the page is never told a secret', st0.set === false && st0.own === false && st0.relay === false && st0.secret === false && Object.keys(st0).sort().join() === 'key,own,relay,secret,set,url', st0);
    check('a token with DMs off is refused', (await a.api('POST', '/api/calls/dm/0123456789ab/token', {})).status === 409);

    // pair A and B through the relay
    const onA = await a.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const onB = await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await a.ok('POST', '/api/dms/invites', { name: 'Bea' });
    const ca = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Al' });
    const cb = await until(async () => (await a.ok('GET', '/api/dms/contacts'))[0]);
    check('A and B are friends', !!cb && cb.mailbox === onB.mailbox && ca.mailbox === onA.mailbox);

    // AIG-1218: out of the box, through the relay: nobody set anything up
    const room = roomFor(onA.mailbox, onB.mailbox);
    const st1r = await a.ok('GET', '/api/calls');
    check('with the relay\'s call server: calls work, no own server', st1r.set === true && st1r.relay === true && st1r.own === false, st1r);
    check('the DM state says calls work', JSON.stringify(await a.ok('GET', `/api/calls/dm/${cb.id}`)) === JSON.stringify({ set: true, invite: false, theirs: false }));
    const page = await openPage(ctx, '#/');
    await page.evaluate(stubLivekit);
    await page.evaluate(r => { window.lkRoomName = r; }, room);
    await page.evaluate(id => Dms.show('dm:' + id), cb.id);
    await page.waitForSelector('#dmCallBtn');
    await page.click('#dmCallBtn');
    await page.waitForFunction(() => Call.active() && lkLog.connects.length === 1);
    const pr = claims(await page.evaluate(() => lkLog.connects[0]));
    check('📞 joins at once with the relay\'s pass: the DM room, me, signed by the relay\'s key', pr.iss === RL_KEY && pr.sub === onA.mailbox && pr.video.room === room && pr.video.canPublish === true && pr.video.canPublishSources.includes('screen_share'), pr);
    await page.evaluate(() => Call.leave());
    const tr1 = await a.ok('POST', `/api/calls/dm/${cb.id}/token`, { room: 'someone-elses-room' });
    check('relay pass: HS256 signed with the relay\'s LiveKit secret (the board holds none), its URL, the DM room, 2 hours', signedWith(tr1.token, RL_SECRET) && tr1.url === RL_URL && tr1.room === room && tr1.theirs === false && Math.abs(claims(tr1.token).exp - Date.now() / 1000 - 7200) < 30, tr1);
    check('B sees the call line (no pass in it: B asks the relay)', !!await until(async () => (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => m.kind === 'call' && m.dir === 'in')));
    const sbr = await b.ok('GET', `/api/calls/dm/${ca.id}`);
    check('B (no setup) can call too, no invite needed', sbr.set === true && sbr.invite === false && sbr.theirs === false, sbr);
    const tr2 = await b.ok('POST', `/api/calls/dm/${ca.id}/token`, { ring: false });
    const cr2 = claims(tr2.token);
    check('B gets its own relay pass for the same DM room, as B', signedWith(tr2.token, RL_SECRET) && tr2.room === room && cr2.video.room === room && cr2.sub === onB.mailbox && tr2.url === RL_URL, cr2);
    check('no LiveKit secret is ever in either board\'s settings', ![a.dir, b.dir].some(d => fs.readFileSync(path.join(d, 'aigile.local.json'), 'utf8').includes(RL_SECRET)));

    // refused: not a contact, a team, a background run
    check('saving without the secrets page token is refused', (await a.api('POST', '/api/calls', { url: URL, key: KEY, secret: SECRET })).status === 403);
    const tok = (await a.ok('GET', '/api/secrets/token')).token;
    check('a bad address is refused', (await a.api('POST', '/api/calls', { url: 'javascript:alert(1)', key: KEY, secret: SECRET, token: tok })).status === 400);
    check('no secret at all is refused', (await a.api('POST', '/api/calls', { url: URL, key: KEY, token: tok })).status === 400);
    const st1 = await a.ok('POST', '/api/calls', { url: URL, key: KEY, secret: SECRET, token: tok });
    check('saved: own server on, address and key shown', st1.own === true, st1);
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
    const c1 = claims(t1.token);
    check('the token is HS256, signed with the API secret', signedWith(t1.token, SECRET));
    check('claims: iss = API key, sub = my mailbox, my name', c1.iss === KEY && c1.sub === onA.mailbox && c1.name === 'Owner', c1);
    check('claims: the room is the DM\'s own (server-side, the page cannot pick one)', t1.room === room && c1.video.room === room && t1.url === URL, [t1.room, c1.video]);
    check('claims: join, publish, subscribe', c1.video.roomJoin === true && c1.video.canPublish === true && c1.video.canSubscribe === true);
    check('claims: valid now, for 2 hours', c1.nbf <= Date.now() / 1000 && Math.abs(c1.exp - Date.now() / 1000 - 7200) < 30, c1);
    check('the answer carries no secret', !JSON.stringify(t1).includes(SECRET));
    const mine = await a.ok('GET', `/api/dms/contacts/${cb.id}/messages`);
    check('my chat shows I started a call (no token in it)', mine.some(m => m.kind === 'call' && m.dir === 'out') && !JSON.stringify(mine).includes(t1.token.split('.')[2]));

    // the friend's board: no LiveKit of its own, joins A's own server with the guest token it was sent (not the relay's)
    const sb = await until(async () => { const x = await b.ok('GET', `/api/calls/dm/${ca.id}`); return x.invite ? x : null; });
    check('B got the call invite (B has no LiveKit of its own: the invite wins over the relay)', sb && sb.invite === true && sb.theirs === true, sb);
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

    // AIG-1171: both press Call at once, each with their own LiveKit: the lower mailbox's server is where they meet
    await b.ok('POST', '/api/calls', { url: URL2, key: KEY2, secret: SECRET2, token: (await b.ok('GET', '/api/secrets/token')).token });
    fs.rmSync(invFile);   // as if B pressed Call before A's ring arrived
    const tb = await b.ok('POST', `/api/calls/dm/${ca.id}/token`, {});
    check('B (own LiveKit, no invite yet) joins its own server and rings A', tb.theirs === false && tb.url === URL2 && tb.room === room, tb);
    fs.writeFileSync(invFile, invOk);   // ...and A's ring arrives at B too
    await until(async () => (await a.ok('GET', `/api/calls/dm/${cb.id}`)).invite);
    const aWins = onA.mailbox < onB.mailbox, win = aWins ? [a, cb.id, URL] : [b, ca.id, URL2], lose = aWins ? [b, ca.id] : [a, cb.id];
    const sw = await win[0].ok('GET', `/api/calls/dm/${win[1]}`), sl = await lose[0].ok('GET', `/api/calls/dm/${lose[1]}`);
    check('the tie-break: the winner stays, the other is told to move to the winner\'s call', sw.invite && sw.theirs === false && sl.invite && sl.theirs === true, { aWins, sw, sl });
    const kw = await win[0].ok('POST', `/api/calls/dm/${win[1]}/token`, { ring: false }), kl = await lose[0].ok('POST', `/api/calls/dm/${lose[1]}/token`, { ring: false });
    check('both now get a token for the same server and room (the winner\'s)', kw.theirs === false && kl.theirs === true && kw.url === win[2] && kl.url === win[2] && kw.room === kl.room, { kw: kw.url, kl: kl.url });
    await b.ok('POST', '/api/calls', { clear: true, token: (await b.ok('GET', '/api/secrets/token')).token });

    // Setup shows the section, set up
    const setup = await openPage(ctx, '#/setup/calls');
    await setup.waitForSelector('#callSetState');
    check('Setup → Calls: works out of the box, and Advanced (own server) is open while one is set', /out of the box/.test(await setup.locator('#callSetState').innerText()) && await setup.locator('#callSetAdv').evaluate(d => d.open));
    check('Setup → Calls shows Ready and the address, the secret box empty', /Ready/.test(await setup.locator('#callOwnState').innerText()) && await setup.locator('#callSetUrl').inputValue() === URL && await setup.locator('#callSetSecret').inputValue() === '');
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
    // AIG-1171: alone on my own server, the page asks the board and moves to the friend's call when theirs wins; not when someone is with me
    await pg.evaluate(async () => { await Call.leave(); window.lkSwaps = 0; let n = 0; Call.join({ title: 'Bea', getToken: async () => ({ url: 'wss://x', token: 'sw' + (++n), room: 'r1', theirs: n > 1 }), swap: async () => (++lkSwaps, true) }); });
    await pg.waitForFunction(() => lkLog.connects.includes('sw2') && Call.active(), null, { timeout: 15000 });
    const swp = await pg.evaluate(() => ({ old: lkLog.rooms[lkLog.connects.indexOf('sw1')].gone, now: Call.room === lkLog.rooms[lkLog.connects.indexOf('sw2')] }));
    check('alone on my server and the board says theirs wins: left mine, joined theirs', swp.old && swp.now, swp);
    await pg.evaluate(async () => { await Call.leave(); window.lkSwaps = 0; Call.join({ title: 'Bea', getToken: async () => ({ url: 'wss://x', token: 'sw3', room: 'r1' }), swap: async () => (++lkSwaps, true) }); });
    await pg.waitForFunction(() => Call.active());
    await pg.evaluate(async () => { Call.room.remoteParticipants.set('bea', new LivekitClient.P('bea')); await new Promise(r => setTimeout(r, 4000)); });
    check('with someone in my call already: no move, not even asked', await pg.evaluate(() => lkSwaps === 0 && Call.room === lkLog.rooms[lkLog.rooms.length - 1]));
    // AIG-1171: repainting the tiles reuses each video (attached once); a track that goes away is detached and its video removed
    await pg.evaluate(async () => {
      const r = Call.room, bea = r.remoteParticipants.get('bea'), tr = window.lkCam = new LivekitClient.Track_('video', 'camera');
      bea.pubs.set('camera', { track: tr, isMuted: false, source: 'camera' }); lkLog.attach = 0; lkLog.detach = 0;
      for (let i = 0; i < 5; i++) r.emit('ActiveSpeakersChanged');
      await Call.mic(); await Call.mic(); r.emit('LocalTrackPublished');   // whole-panel repaints too
    });
    const v1 = await pg.evaluate(() => ({ attach: lkLog.attach, held: lkCam.els.length, shown: document.querySelectorAll('#callTiles video').length, same: document.querySelector('#callTiles video') === lkCam.els[0] }));
    check('many repaints: the camera is attached once and its one video reused', v1.attach === 1 && v1.held === 1 && v1.shown === 1 && v1.same, v1);
    await pg.evaluate(() => { Call.room.remoteParticipants.get('bea').pubs.delete('camera'); Call.room.emit('TrackMuted'); });
    const v2 = await pg.evaluate(() => ({ detach: lkLog.detach, held: lkCam.els.length, shown: document.querySelectorAll('#callTiles video').length, av: !!document.querySelector('#callTiles [data-who="bea"] .call-av') }));
    check('the camera goes: detached, its video gone, the name tile back', v2.detach === 1 && v2.held === 0 && v2.shown === 0 && v2.av, v2);
    // AIG-1240..1246: calls panel polish
    const pn = await pg.evaluate(async () => {
      const r = Call.room, out = {}, $ = id => document.getElementById(id), wait = ms => new Promise(x => setTimeout(x, ms));
      out.aria = $('callPanel').getAttribute('aria-label'); out.live = !!document.querySelector('#callPanel [aria-live]');
      out.timer = /^\d+:\d\d$/.test($('callTime').textContent);
      out.muteGone = !document.querySelector('#callTiles [data-who="me"] .call-mute'); await Call.mic();
      out.muteMine = !!document.querySelector('#callTiles [data-who="me"] .call-mute'); await Call.mic();
      out.muteGone = out.muteGone && !document.querySelector('#callTiles [data-who="me"] .call-mute');
      r.emit('Reconnecting'); out.recon = $('callState').textContent; r.emit('Reconnected'); out.back = $('callState').textContent;
      // AIG-1300: the quiet thanks line at the bottom of the open panel, not announced, hidden in the pill
      const cr = $('callCredit'); out.credit = !!cr && cr.textContent === 'riding ChilledChat' && (cr.querySelector('a') || {}).href === 'https://chat.chilleddvs.com/' && $('callPanel').lastElementChild === cr && !cr.closest('[aria-live]') && !cr.hasAttribute('role');
      $('callMini').click(); out.creditMini = getComputedStyle(cr).display === 'none'; $('callMini').click();
      $('callMini').click(); out.mini = $('callPanel').classList.contains('mini'); out.tilesHidden = getComputedStyle($('callTiles')).display === 'none'; out.pill = ['callMic', 'callLeave'].every(i => getComputedStyle($(i)).display !== 'none');
      $('callMini').click(); out.open = !$('callPanel').classList.contains('mini');
      $('callDevBtn').click(); await wait(100);
      out.sels = document.querySelectorAll('#callDevs select').length; const sel = document.querySelector('#callDevs select[data-kind="audioinput"]'); sel.value = 'audioinput2'; sel.dispatchEvent(new Event('change')); await wait(50); out.picked = lkLog.dev.audioinput;
      document.documentElement.dir = 'rtl'; out.rtlLeft = parseFloat(getComputedStyle($('callPanel')).left) < 40; document.documentElement.dir = 'ltr';
      r.emit('Disconnected', 3); out.ended = $('callNote') && $('callNote').textContent; out.active = Call.active();
      Call.close(); window.lkMicErr = 'NotAllowedError'; Call.join({ title: 'Bea', getToken: async () => ({ url: 'wss://x', token: 'mb', room: 'r1' }) });
      await wait(400); out.blocked = $('callErr').textContent; out.stillIn = Call.active(); window.lkMicErr = 'NotFoundError';
      await Call.mic(); out.none = $('callErr').textContent; window.lkMicErr = '';
      return out;
    });
    check('call panel: named for screen readers, announces people, timer shows', /Bea/.test(pn.aria) && pn.live && pn.timer, pn);
    check('a muted mic is marked on its tile, and the mark goes when unmuted', pn.muteMine && pn.muteGone, pn);
    check('Reconnecting shows and goes away again', /Reconnecting/.test(pn.recon) && /in the call/.test(pn.back), pn);
    check('shrink: a pill with mute and Leave, no tiles; click opens it again', pn.mini && pn.tilesHidden && pn.pill && pn.open, pn);
    check('devices: mic, camera and speaker listed, switching mid-call works', pn.sels === 3 && pn.picked === 'audioinput2', pn);
    check('right-to-left: the panel sits on the start side', pn.rtlLeft, pn);
    check('the call ending on its own says so with a reason (not a silent close)', /closed/.test(pn.ended || '') && !pn.active, pn);
    check('mic blocked / missing: plain words, still in the call', /blocked the microphone/.test(pn.blocked) && pn.stillIn && /No microphone found/.test(pn.none), pn);
    check('an open call ends with a quiet "riding ChilledChat" credit linking to chat.chilleddvs.com, not announced, hidden in the pill (AIG-1300, AIG-1312)', pn.credit && pn.creditMini, pn);
    {
      const vp = pg.viewportSize(); await pg.setViewportSize({ width: 390, height: 844 }); await pg.emulateMedia({ colorScheme: 'dark' });
      const cf = await pg.evaluate(() => { const c = document.getElementById('callCredit'), r = c.getBoundingClientRect(), s = getComputedStyle(c); return { shown: r.height > 0, inside: r.left >= 0 && r.right <= innerWidth, oneLine: r.height < 30, color: s.color, bg: getComputedStyle(document.getElementById('callPanel')).backgroundColor }; });
      check('the thanks line fits at 390px in dark mode, on one line, readable (AIG-1300)', cf.shown && cf.inside && cf.oneLine && cf.color !== cf.bg, cf);
      await pg.emulateMedia({ colorScheme: 'light' }); if (vp) await pg.setViewportSize(vp);
    }
    // AIG-1239: the browser blocked sound: a Tap to hear button shows in the panel, and a tap starts it
    await pg.evaluate(() => { const r = Call.room; r.canPlaybackAudio = false; r.startAudio = async () => { r.canPlaybackAudio = true; r.emit('AudioPlaybackStatusChanged'); }; r.emit('AudioPlaybackStatusChanged'); });
    check('sound blocked: a Tap to hear button shows', await pg.locator('#callTap').count() === 1);
    await pg.click('#callTap');
    await pg.waitForFunction(() => !document.getElementById('callTap'));
    check('tapped: sound allowed, the button is gone', await pg.evaluate(() => Call.room.canPlaybackAudio === true));
    await pg.evaluate(() => Call.leave());
    // AIG-1237: the friend's call line has a Join button (only while fresh); it joins the call
    await b.ok('POST', `/api/calls/dm/${ca.id}/token`, {});
    await pg.evaluate(id => Dms.show('dm:' + id), cb.id);
    await pg.waitForSelector('.dm-msg.dm-call:not(.mine) .dm-joinbtn');
    check('a fresh incoming call line has a Join button', true);
    await pg.evaluate(r => { window.lkLog.connects.length = 0; window.lkRoomName = r; }, room);
    await pg.click('.dm-msg.dm-call:not(.mine) .dm-joinbtn');
    await pg.waitForFunction(() => Call.active());
    check('Join joins the call', await pg.evaluate(() => lkLog.connects.length === 1));
    check('an old call (an hour ago) is not joinable', await pg.evaluate(() => Call.fresh(new Date().toISOString()) && !Call.fresh(new Date(Date.now() - 3600e3).toISOString())));
    await pg.evaluate(() => Call.leave());
    // AIG-1238: a call that just arrived rings and notifies (the inbox alert rules); an old one, or the same one twice, does not
    const ring = await pg.evaluate(() => {
      let notes = 0, beeps = 0, click = null; window.Notification = function (title) { notes++; this.title = title; this.close = () => {}; click = this; };
      IB.alertsOn = () => true; IB.beep = () => { beeps++; };
      const one = { id: 'zz', name: 'Zed', lastDir: 'in', lastKind: 'call', lastIn: new Date().toISOString() };
      Call.ring([one]); const first = { notes, beeps, title: click && click.title }; Call.ring([one]);
      Call.ring([{ ...one, id: 'old', lastIn: new Date(Date.now() - 3600e3).toISOString() }]);
      Call.ring([{ ...one, id: 'txt', lastKind: '' }]);
      return { first, notes, beeps };
    });
    check('a call that just arrived: one notification and a beep, named', ring.first.notes === 1 && ring.first.beeps === 1 && /Zed/.test(ring.first.title), ring);
    check('the same call twice, an hour-old one and a plain message do not ring', ring.notes === 1, ring);
    await pg.evaluate(() => Call.leave());
    noErrors(page); noErrors(setup); noErrors(pg);
    const cleared = await a.ok('POST', '/api/calls', { clear: true, token: tok });
    check('Remove clears it all (calls still work, through the relay)', cleared.own === false && cleared.secret === false && !cleared.url && cleared.set === true, cleared);
    fs.rmSync(path.join(a.data, 'calls', 'invites.json'), { force: true });   // B's ring from the tie-break above (B's own server)
    const after = await a.ok('POST', `/api/calls/dm/${cb.id}/token`, { ring: false });
    check('after Remove the pass comes from the relay again', signedWith(after.token, RL_SECRET) && after.url === RL_URL, after.url);
    const fold = await openPage(ctx, '#/setup/calls');
    await fold.waitForSelector('#callSetState');
    check('Setup → Calls with no own server: out of the box, Advanced folded', /out of the box/.test(await fold.locator('#callSetState').innerText()) && !(await fold.locator('#callSetAdv').evaluate(d => d.open)));
    noErrors(fold);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_SECRETS_DIR: SECDIR, AIGILE_DM_POLL_MS: '300' });
