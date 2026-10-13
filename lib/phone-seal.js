// Sealed phone link v1 (AII-18, docs/SEALED.md): every call from the Android app sealed end to end with AES-256-GCM, so the
// proxy in between sees nothing and the device key never travels after pairing. Pure crypto and the replay guard here;
// server.js runs the opened request through the same route handlers, as that device, with the same deny list.
const crypto = require('crypto');
const { bad } = require('./store');

const SKEW_MS = 120e3, NONCE_MS = 10 * 60e3;
const seenNonces = new Map();   // device id -> Map(nonce -> ms)
const aad = (dir, id) => Buffer.from('aigile-seal-v1|' + dir + '|' + id, 'utf8');
const no = why => bad('sealed: ' + why, 403);

function encrypt(S, id, dir, obj, nonce = crypto.randomBytes(12)) {
  const g = crypto.createCipheriv('aes-256-gcm', Buffer.from(S, 'base64url'), nonce);
  g.setAAD(aad(dir, id));
  const c = Buffer.concat([g.update(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8'), g.final(), g.getAuthTag()]);
  return { n: nonce.toString('base64url'), c: c.toString('base64url') };
}
function decrypt(S, id, dir, body) {
  const n = Buffer.from(String((body && body.n) || ''), 'base64url'), c = Buffer.from(String((body && body.c) || ''), 'base64url');
  if (n.length !== 12 || c.length < 17) throw no('bad envelope');
  try {
    const g = crypto.createDecipheriv('aes-256-gcm', Buffer.from(S, 'base64url'), n);
    g.setAAD(aad(dir, id)); g.setAuthTag(c.subarray(c.length - 16));
    return { text: Buffer.concat([g.update(c.subarray(0, c.length - 16)), g.final()]).toString('utf8'), nonce: n.toString('base64url') };
  } catch { throw no('bad tag'); }
}
// The app's request, checked: tag, time window, a nonce not seen in the last 10 minutes, a path under /api/.
function open(device, body, now = Date.now()) {
  const { text, nonce } = decrypt(device.seal, device.id, 'req', body);
  let r; try { r = JSON.parse(text); } catch { throw no('bad request'); }
  if (!r || typeof r !== 'object' || typeof r.t !== 'number' || Math.abs(now - r.t) > SKEW_MS) throw no('old or future timestamp');
  let seen = seenNonces.get(device.id); if (!seen) seenNonces.set(device.id, seen = new Map());
  for (const [k, at] of seen) if (now - at > NONCE_MS) seen.delete(k);
  if (seen.has(nonce)) throw no('replayed nonce');
  seen.set(nonce, now);
  const m = String(r.m || '').toUpperCase(), p = String(r.p || '');
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(m)) throw no('bad method');
  if (!p.startsWith('/api/')) throw no('path must start with /api/');
  return { m, p, b: r.b == null ? {} : r.b };
}
const close = (device, s, b) => encrypt(device.seal, device.id, 'res', { s, b });

module.exports = { encrypt, decrypt, open, close, SKEW_MS, NONCE_MS };
