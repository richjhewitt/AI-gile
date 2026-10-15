// QA area: relay (AIG-1218): the relay's call passes. One LiveKit server runs with the relay (RELAY_LIVEKIT_*), so no board holds
// LiveKit keys: POST /call/token answers only a request signed by the mailbox's owner key, and only for a room worked out from that
// mailbox (a DM: both mailboxes; a Meeting Room: own mailbox + slug). Not configured = 404; passes per key are limited.
import crypto from 'node:crypto';
import { startRelay, check, def } from '../lib.mjs';

const LK_SECRET = 'qa-relay-livekit-secret-Q1', LK_KEY = 'APIqaRelayLK', LK_URL = 'wss://call.example.test';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const dmRoom = (a, b) => 'aigile-dm-' + sha('aigile-call-v1|' + [a, b].sort().join('|')).slice(0, 32);
const meetRoom = (box, slug) => 'aigile-meet-' + sha('aigile-meet-v1|' + box + '|' + slug).slice(0, 32);
const box = () => crypto.randomBytes(18).toString('base64url');
const claims = tok => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));
const signedWith = (tok, secret) => { const [h, p, sig] = tok.split('.'); return JSON.parse(Buffer.from(h, 'base64url')).alg === 'HS256' && crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url') === sig; };
// A request signed like a board's (lib/dm.js relayCall); key null = unsigned. nonce can be reused to test replays.
async function call(relay, method, p, key, body, nonce = crypto.randomBytes(12).toString('base64url')) {
  const data = body === undefined ? '' : JSON.stringify(body), ts = String(Date.now());
  const headers = data ? { 'Content-Type': 'application/json' } : {};
  if (key) Object.assign(headers, { 'x-relay-key': key.publicKey.export({ format: 'jwk' }).x, 'x-relay-ts': ts, 'x-relay-nonce': nonce,
    'x-relay-sig': crypto.sign(null, Buffer.from(['aigile-relay-v1', method, p, ts, nonce, sha(data)].join('\n')), key.privateKey).toString('base64url') });
  const r = await fetch(relay.base + p, { method, headers, body: data || undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

def('relay', '📞 relay call passes: GET /call and POST /call/token are 404 without RELAY_LIVEKIT_*, signed by the mailbox owner ok (HS256 LiveKit pass, 2 h, join/publish/subscribe/screen share), unsigned 401, wrong room / another board\'s mailbox 403, replay 401, rate limit 429 (AIG-1218)', async () => {
  const off = await startRelay(), on = await startRelay({ RELAY_LIVEKIT_URL: LK_URL, RELAY_LIVEKIT_KEY: LK_KEY, RELAY_LIVEKIT_SECRET: LK_SECRET, RELAY_CALL_RATE: '8' });
  try {
    const me = crypto.generateKeyPairSync('ed25519'), other = crypto.generateKeyPairSync('ed25519');
    const mine = box(), friend = box(), dm = dmRoom(mine, friend);
    // not configured
    check('not configured: GET /call is 404', (await fetch(off.base + '/call')).status === 404);
    const nc = await call(off, 'POST', '/call/token', me, { room: dm, name: 'Al', mailbox: mine, peer: friend });
    check('not configured: a signed token request is 404 too', nc.status === 404, nc);
    // configured
    const g = await fetch(on.base + '/call');
    check('configured: GET /call says so, with the call server address (never the key or secret)', g.status === 200 && JSON.stringify(await g.json()) === JSON.stringify({ ok: true, url: LK_URL }));
    const un = await call(on, 'POST', '/call/token', null, { room: dm, name: 'Al', mailbox: mine, peer: friend });
    check('unsigned: 401', un.status === 401, un);
    const ok = await call(on, 'POST', '/call/token', me, { room: dm, name: 'Al', mailbox: mine, peer: friend });
    const c = ok.status === 200 && claims(ok.body.token), t = Date.now() / 1000;
    check('signed by the mailbox owner, the DM room: 200 with url, token and room', ok.status === 200 && ok.body.url === LK_URL && ok.body.room === dm, ok);
    check('the pass is HS256 signed with the LiveKit secret, iss = key, sub = my mailbox, my name', c && signedWith(ok.body.token, LK_SECRET) && c.iss === LK_KEY && c.sub === mine && c.name === 'Al', c);
    check('the pass is for that one room, 2 hours, join + publish + subscribe + screen share', c && c.video.room === dm && c.video.roomJoin === true && c.video.canPublish === true && c.video.canSubscribe === true && c.video.canPublishSources.includes('screen_share') && Math.abs(c.exp - t - 7200) < 30 && c.nbf <= t, c);
    check('the answer never carries the secret', !JSON.stringify(ok.body).includes(LK_SECRET));
    const fr = await call(on, 'POST', '/call/token', other, { room: dm, name: 'Bea', mailbox: friend, peer: mine });
    check('the friend\'s board (its own key and mailbox) gets a pass for the same DM room', fr.status === 200 && fr.body.room === dm && claims(fr.body.token).sub === friend, fr);
    const wr = await call(on, 'POST', '/call/token', me, { room: dmRoom(friend, box()), name: 'Al', mailbox: mine, peer: friend });
    check('wrong room (someone else\'s DM): 403', wr.status === 403, wr);
    const pick = await call(on, 'POST', '/call/token', me, { room: 'any-room-i-like', name: 'Al', mailbox: mine, peer: friend });
    check('a room the board picks itself: 403', pick.status === 403, pick);
    const steal = await call(on, 'POST', '/call/token', other, { room: dm, name: 'X', mailbox: mine, peer: friend });
    check('another board\'s mailbox (signed by a different key): 403', steal.status === 403, steal);
    const mt = await call(on, 'POST', '/call/token', me, { room: meetRoom(mine, 'pix'), name: 'Al', mailbox: mine, slug: 'pix' });
    check('a Meeting Room: own mailbox + slug: 200', mt.status === 200 && mt.body.room === meetRoom(mine, 'pix') && claims(mt.body.token).video.room === meetRoom(mine, 'pix'), mt);
    const mo = await call(on, 'POST', '/call/token', other, { room: meetRoom(mine, 'pix'), name: 'X', mailbox: friend, slug: 'pix' });
    check('another board\'s Meeting Room: 403', mo.status === 403, mo);
    const n = crypto.randomBytes(12).toString('base64url');
    await call(on, 'POST', '/call/token', me, { room: dm, name: 'Al', mailbox: mine, peer: friend }, n);
    const rp = await call(on, 'POST', '/call/token', me, { room: dm, name: 'Al', mailbox: mine, peer: friend }, n);
    check('a replayed request: 401', rp.status === 401, rp);
    let last = 0;
    for (let i = 0; i < 10 && last !== 429; i++) last = (await call(on, 'POST', '/call/token', me, { room: dm, name: 'Al', mailbox: mine, peer: friend })).status;
    check('too many passes for one key: 429 (RELAY_CALL_RATE)', last === 429, last);
    check('another key is not held back by that', (await call(on, 'POST', '/call/token', other, { room: dm, name: 'Bea', mailbox: friend, peer: mine })).status === 200);
  } finally { off.stop(); on.stop(); }
});
