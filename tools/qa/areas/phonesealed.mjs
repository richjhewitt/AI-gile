// QA area: phonesealed (AII-18), the sealed phone link v1 of docs/SEALED.md: the published test vectors (shared with the
// Android app), then real sealed calls through POST /api/phone/sealed: meta says sealed, chats and a reply work as the device,
// and tamper, replay, an old timestamp, a denied path, an unknown or removed device, a Bearer header are all refused.
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { PORT, ROOT, check, mkProject, mkCard, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

// The vectors, exactly as in docs/SEALED.md and the app's copy (base64url, no padding).
const V = {
  K: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8', d: 'a1b2c3d4e5f6', n: 'AAECAwQFBgcICQoL',
  req: '{"t":1700000000000,"m":"GET","p":"/api/chats","b":null}', res: '{"s":200,"b":{"ok":true}}',
  S: 'b8A3-7OMQrGQV8qPfAkIm40ylw_x7R7MS7xdpHM0ups',
  reqC: 'C-rMPhBge0WYfeqf1OqyeWA2CmLnmtGeNQtNEWbw8REEkdGFukqxDT2RcAu8Ik1K7ChJ1XsR44LY5CDa2EY7npuTGoY_kxQ',
  resC: 'C-rLPhBjfEWEb7iN3qGgJjskHDT4zY7BD6Bp_BG4--LDx5YkHkk7gEs',
};
// An independent sealer (plain node crypto), so the board is checked against the spec, not against itself.
const hkdf = (K, d) => Buffer.from(crypto.hkdfSync('sha256', Buffer.from(K, 'base64url'), 'aigile-seal-v1', 'phone ' + d, 32)).toString('base64url');
function sealIt(S, d, dir, text, n = crypto.randomBytes(12)) {
  const g = crypto.createCipheriv('aes-256-gcm', Buffer.from(S, 'base64url'), n); g.setAAD(Buffer.from(`aigile-seal-v1|${dir}|${d}`));
  return { n: n.toString('base64url'), c: Buffer.concat([g.update(text, 'utf8'), g.final(), g.getAuthTag()]).toString('base64url') };
}
function openIt(S, d, dir, env) {
  const c = Buffer.from(env.c, 'base64url'), g = crypto.createDecipheriv('aes-256-gcm', Buffer.from(S, 'base64url'), Buffer.from(env.n, 'base64url'));
  g.setAAD(Buffer.from(`aigile-seal-v1|${dir}|${d}`)); g.setAuthTag(c.subarray(c.length - 16));
  return JSON.parse(Buffer.concat([g.update(c.subarray(0, c.length - 16)), g.final()]).toString('utf8'));
}
const HOST = 'mypc.tail1234.ts.net';
const raw = (method, p, headers = {}, body) => new Promise(res => {
  const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: { 'Content-Type': 'application/json', ...headers } }, x => {
    let s = ''; x.on('data', d => { s += d; }); x.on('end', () => { let j = null; try { j = JSON.parse(s); } catch {} res({ status: x.statusCode, body: j }); });
  });
  r.on('error', () => res({ status: 0 })); r.end(body ? JSON.stringify(body) : undefined);
});

def('phonesealed', 'sealed phone link v1 (AII-18): the docs/SEALED.md vectors, sealed calls as the device, tamper/replay/old timestamp/denied path/unknown, removed or Bearer refused', async s => {
  // 1. The vectors, by plain node crypto and by the board's own lib/phone-seal.js.
  check('vector: S', hkdf(V.K, V.d) === V.S, hkdf(V.K, V.d));
  const n0 = Buffer.from(V.n, 'base64url');
  check('vector: n is bytes 0x00..0x0b', n0.equals(Buffer.from([...Array(12).keys()])));
  check('vector: request c', sealIt(V.S, V.d, 'req', V.req, n0).c === V.reqC);
  check('vector: response c', sealIt(V.S, V.d, 'res', V.res, n0).c === V.resC);
  const P = require(ROOT + '/lib/phone.js'), PS = require(ROOT + '/lib/phone-seal.js');
  check('board: sealKey gives S', P.sealKey(V.K, V.d) === V.S);
  check('board: response vector', PS.encrypt(V.S, V.d, 'res', V.res, n0).c === V.resC);
  const op = PS.open({ id: V.d, seal: V.S }, { n: V.n, c: V.reqC }, 1700000000000 + 1000);
  check('board: opens the request vector', op.m === 'GET' && op.p === '/api/chats', op);
  let why = ''; try { PS.open({ id: V.d, seal: V.S }, { n: V.n, c: V.reqC }, 1700000000000 + 2000); } catch (e) { why = e.message; }
  check('board: the same vector twice is a replay', /replayed nonce/.test(why), why);

  // 2. A real app pairing and sealed calls.
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Hello from the lead');
  const app = await s.ok('POST', '/api/phone/app', { host: HOST });
  const m = app.qr.match(/^aigile:\/\/pair\?url=https:\/\/([a-z0-9.-]+)&id=([a-f0-9]+)&key=([A-Za-z0-9_-]+)$/);
  check('QR is aigile://pair?url=&id=&key=', !!m && m[1] === HOST && m[2] === app.id, app.qr);
  const [, , d, K] = m, S = hkdf(K, d);
  const H = { Host: HOST, 'X-Aigile-Device': d };
  const call = async (inner, opt = {}) => {
    const env = opt.env || sealIt(opt.S || S, opt.d || d, 'req', JSON.stringify({ t: opt.t || Date.now(), m: inner.m, p: inner.p, b: inner.b == null ? null : inner.b }));
    const r = await raw('POST', '/api/phone/sealed', { ...H, ...(opt.h || {}) }, env);
    return { ...r, env, open: r.status === 200 ? openIt(S, d, 'res', r.body) : null };
  };
  const meta = await call({ m: 'GET', p: '/api/meta' });
  check('sealed GET /api/meta: 200 with "sealed": 1', meta.status === 200 && meta.open.s === 200 && meta.open.b.sealed === 1, meta.body);
  check('the response is sealed (no plain text in it)', !JSON.stringify(meta.body).includes('statuses'));
  const chats = await call({ m: 'GET', p: '/api/chats' });
  check('sealed GET /api/chats', chats.open && chats.open.s === 200 && Array.isArray(chats.open.b));
  const q = await call({ m: 'GET', p: '/api/chats/alpha' });
  check('sealed GET /api/chats/:slug', q.open && q.open.s === 200);
  const rep = await call({ m: 'POST', p: '/api/projects/alpha/cards/ALP-1/comments', b: { author: 'Owner', text: 'sealed hello' } });
  check('sealed POST a reply', rep.open && rep.open.s === 200, rep.open);
  check('the reply is on the card', (await s.ok('GET', '/api/projects/alpha')).cards[0].comments.some(c => c.text === 'sealed hello'));
  const nf = await call({ m: 'GET', p: '/api/nope' });
  check('an unknown inner path: sealed 404', nf.open && nf.open.s === 404);

  // 3. Refusals: 403 with {"error":"sealed: ..."}.
  const sealedNo = (r, re) => r.status === 403 && re.test((r.body && r.body.error) || '');
  const t1 = await call({ m: 'GET', p: '/api/chats' }); const bad = { ...t1.env, c: t1.env.c.slice(0, -2) + (t1.env.c.endsWith('AA') ? 'BA' : 'AA') };
  check('tampered ciphertext: 403', sealedNo(await call(null, { env: bad }), /^sealed: bad tag/));
  check('replay of a used call: 403', sealedNo(await call(null, { env: t1.env }), /^sealed: replayed nonce/));
  check('timestamp 121 s old: 403', sealedNo(await call({ m: 'GET', p: '/api/chats' }, { t: Date.now() - 121e3 }), /^sealed: old or future/));
  check('timestamp 121 s ahead: 403', sealedNo(await call({ m: 'GET', p: '/api/chats' }, { t: Date.now() + 121e3 }), /^sealed: old or future/));
  check('timestamp 100 s old: still fine', (await call({ m: 'GET', p: '/api/chats' }, { t: Date.now() - 100e3 })).status === 200);
  check('path outside /api/: 403', sealedNo(await call({ m: 'GET', p: '/index.html' }), /^sealed: path/));
  check('terminal (deny list): 403', sealedNo(await call({ m: 'GET', p: '/api/terminal/token' }), /^sealed: not from a phone/));
  check('secrets (deny list): 403', sealedNo(await call({ m: 'GET', p: '/api/secrets/token' }), /^sealed: not from a phone/));
  check('sealed inside sealed (deny list): 403', sealedNo(await call({ m: 'POST', p: '/api/phone/sealed', b: {} }), /^sealed: not from a phone/));
  check('a team run command: 403', sealedNo(await call({ m: 'PATCH', p: '/api/projects/alpha', b: { runCmd: 'calc' } }), /^sealed: not from a phone/));
  check('another device id: 403', sealedNo(await call({ m: 'GET', p: '/api/chats' }, { h: { 'X-Aigile-Device': 'ffffffffffff' } }), /^sealed: unknown device/));
  check('a wrong seal key: 403', sealedNo(await call({ m: 'GET', p: '/api/chats' }, { S: hkdf('B'.repeat(43), d) }), /^sealed: bad tag/));
  check('another host name: 403', (await call({ m: 'GET', p: '/api/chats' }, { h: { Host: 'other.tail1234.ts.net' } })).status === 403);
  check('with an Authorization header: 403', (await call({ m: 'GET', p: '/api/chats' }, { h: { Authorization: 'Bearer ' + K } })).status === 403);
  check('another site\'s Origin: 403', (await call({ m: 'GET', p: '/api/chats' }, { h: { Origin: 'https://evil.example' } })).status === 403);
  check('on localhost there is no sealed route', (await raw('POST', '/api/phone/sealed', { 'X-Aigile-Device': d }, { n: 'x', c: 'y' })).status === 404);
  check('Bearer still works for pictures', (await raw('GET', '/api/avatars', { Host: HOST, Authorization: 'Bearer ' + K })).status === 200);
  await s.ok('DELETE', '/api/phone/devices/' + d);
  check('a removed device: 403', sealedNo(await call({ m: 'GET', p: '/api/chats' }), /^sealed: unknown device/));
}, false, { AIGILE_NO_TAILSCALE: '1' });
