// AI-gile DM relay (AIG-112): passes sealed messages between boards. Standalone: Node only, no packages,
// and nothing from the rest of AI-gile, so this one file can be copied to a server.
//   node relay.js     (RELAY_PORT default 4500, RELAY_HOST default 0.0.0.0, RELAY_DATA default ./data next to this file)
//
// What it sees: envelopes addressed to random mailbox ids, already encrypted and signed by the sending board,
// and each mailbox owner's public signing key (to check that only the owner collects). No names, no text, no
// other keys. It never logs requests.
//   POST /m/:box           drop a sealed envelope in a mailbox (anyone; the mailbox must have been claimed)
//   GET  /m/:box           the owner collects pending envelopes (signed request; the first one claims the mailbox)
//   POST /m/:box/ack       the owner deletes what it collected: { rids } (signed)
//   GET  /health
// Signed requests carry x-relay-key (Ed25519 public key, base64url), x-relay-ts (ms), x-relay-nonce and x-relay-sig:
// an Ed25519 signature over "aigile-relay-v1\n<METHOD>\n<path>\n<ts>\n<nonce>\n<sha256 hex of the body>".
// Envelopes are deleted once collected, or after 7 days.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.RELAY_PORT) || 4500;
const HOST = process.env.RELAY_HOST || '0.0.0.0';
const DATA = path.resolve(process.env.RELAY_DATA || path.join(__dirname, 'data'));
const MAX_BODY = 12 * 1024 * 1024;                       // one envelope (attachments later)
const KEEP_MS = 7 * 24 * 3600e3;                          // uncollected envelopes are deleted after 7 days
const SKEW_MS = 2 * 60e3;                                 // a signed request is only good for 2 minutes
const RATE = Number(process.env.RELAY_RATE) || 300;       // requests per minute per IP
const BOX_MAX = 500, BOX_BYTES = 100 * 1024 * 1024;       // per mailbox
const TOTAL_BYTES = Number(process.env.RELAY_MAX_BYTES) || 2 * 1024 ** 3;
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.RELAY_TRUST_PROXY || '');   // behind a reverse proxy: use X-Forwarded-For

const isBox = s => /^[A-Za-z0-9_-]{16,64}$/.test(s);
const isRid = s => /^\d{13}-[0-9a-f]{16}$/.test(s);
const sha256 = d => crypto.createHash('sha256').update(d).digest('hex');
const fail = (msg, code) => Object.assign(new Error(msg), { code });
const boxDir = box => path.join(DATA, box);

fs.mkdirSync(DATA, { recursive: true });

/* ---------- storage ---------- */
// DATA/<box>/owner.json: { key } (the owner's public signing key); DATA/<box>/<ms>-<hex>.json: one envelope.
const envFiles = box => { try { return fs.readdirSync(boxDir(box)).filter(f => isRid(f.slice(0, -5)) && f.endsWith('.json')).sort(); } catch { return []; } };
const ownerOf = box => { try { return JSON.parse(fs.readFileSync(path.join(boxDir(box), 'owner.json'), 'utf8')).key; } catch { return null; } };
const sizeOf = f => { try { return fs.statSync(f).size; } catch { return 0; } };
let used = 0;   // bytes held across all mailboxes
function sweep() {
  used = 0;
  const old = Date.now() - KEEP_MS;
  for (const box of fs.readdirSync(DATA).filter(isBox)) for (const f of envFiles(box)) {
    const file = path.join(boxDir(box), f);
    if (Number(f.split('-')[0]) < old) { try { fs.unlinkSync(file); } catch {} } else used += sizeOf(file);
  }
}

/* ---------- rate limit and replay protection ---------- */
const hits = new Map();   // ip -> { start, n }
function limited(ip) {
  const t = Date.now(), h = hits.get(ip);
  if (!h || t - h.start > 60e3) { hits.set(ip, { start: t, n: 1 }); return false; }
  return ++h.n > RATE;
}
const nonces = new Map();   // key + nonce -> time seen
setInterval(() => {
  const t = Date.now();
  for (const [ip, h] of hits) if (t - h.start > 60e3) hits.delete(ip);
  for (const [n, at] of nonces) if (t - at > 2 * SKEW_MS) nonces.delete(n);
}, 30e3).unref();

// A request from the mailbox owner: valid signature, fresh timestamp, unused nonce. The first signed request claims an unclaimed mailbox.
function owner(req, box, pathname, body) {
  const h = n => String(req.headers[n] || '');
  const key = h('x-relay-key'), ts = h('x-relay-ts'), nonce = h('x-relay-nonce'), sig = h('x-relay-sig');
  if (!/^[A-Za-z0-9_-]{43}$/.test(key) || !/^\d{13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^[A-Za-z0-9_-]{86}$/.test(sig)) throw fail('sign the request', 401);
  if (Math.abs(Date.now() - Number(ts)) > SKEW_MS) throw fail('the request is too old (or the clock is wrong)', 401);
  let pub;
  try { pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key }, format: 'jwk' }); } catch { throw fail('bad key', 401); }
  const msg = ['aigile-relay-v1', req.method, pathname, ts, nonce, sha256(body)].join('\n');
  if (!crypto.verify(null, Buffer.from(msg), pub, Buffer.from(sig, 'base64url'))) throw fail('bad signature', 401);
  if (nonces.has(key + nonce)) throw fail('that request was already used', 401);
  nonces.set(key + nonce, Date.now());
  const known = ownerOf(box);
  if (known && known !== key) throw fail('not your mailbox', 403);
  if (!known) {
    fs.mkdirSync(boxDir(box), { recursive: true });
    fs.writeFileSync(path.join(boxDir(box), 'owner.json'), JSON.stringify({ key }));
  }
}

/* ---------- http ---------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let n = 0;
    req.on('data', d => {
      n += d.length;
      if (n > MAX_BODY) { reject(fail('too big (12 MB at most)', 413)); req.pause(); return; }
      parts.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function handle(req, res) {
  const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
  if (limited(ip)) throw fail('slow down', 429);
  const { pathname } = new URL(req.url, 'http://relay');
  if (req.method === 'GET' && pathname === '/health') return send(res, 200, { ok: true });
  const m = pathname.match(/^\/m\/([^/]+)(\/ack)?$/);
  if (!m || !isBox(m[1])) throw fail('not found', 404);
  const box = m[1], ack = !!m[2];
  if (req.headers['content-length'] && Number(req.headers['content-length']) > MAX_BODY) throw fail('too big (12 MB at most)', 413);
  const body = req.method === 'POST' ? await readBody(req) : '';

  // Drop an envelope: only checks the outside (it is addressed to this mailbox); the inside is sealed.
  if (req.method === 'POST' && !ack) {
    let env;
    try { env = JSON.parse(body); } catch { throw fail('send an envelope as JSON', 400); }
    if (!env || typeof env !== 'object' || Array.isArray(env) || env.to !== box || typeof env.ct !== 'string' || typeof env.sig !== 'string') throw fail('not an envelope for this mailbox', 400);
    if (!ownerOf(box)) throw fail('no such mailbox (yet)', 404);
    const files = envFiles(box);
    const bytes = files.reduce((a, f) => a + sizeOf(path.join(boxDir(box), f)), 0);
    if (files.length >= BOX_MAX || bytes + body.length > BOX_BYTES || used + body.length > TOTAL_BYTES) throw fail('mailbox full', 507);
    const rid = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(path.join(boxDir(box), rid + '.json'), body);
    used += Buffer.byteLength(body);
    return send(res, 201, { ok: true });
  }
  // Collect: the owner gets what is waiting (up to 100 envelopes / 24 MB per call).
  if (req.method === 'GET' && !ack) {
    owner(req, box, pathname, '');
    const envelopes = [];
    let bytes = 0;
    for (const f of envFiles(box).slice(0, 100)) {
      let text; try { text = fs.readFileSync(path.join(boxDir(box), f), 'utf8'); } catch { continue; }
      if (envelopes.length && bytes + text.length > 24 * 1024 * 1024) break;
      bytes += text.length;
      try { envelopes.push({ rid: f.slice(0, -5), env: JSON.parse(text) }); } catch {}
    }
    return send(res, 200, { envelopes });
  }
  // Ack: delete what was collected.
  if (req.method === 'POST' && ack) {
    owner(req, box, pathname, body);
    let rids;
    try { rids = JSON.parse(body).rids; } catch {}
    if (!Array.isArray(rids)) throw fail('send { rids }', 400);
    let deleted = 0;
    for (const rid of rids.slice(0, 1000)) {
      if (!isRid(String(rid))) continue;
      const f = path.join(boxDir(box), rid + '.json'), n = sizeOf(f);
      try { fs.unlinkSync(f); deleted++; used -= n; } catch {}
    }
    return send(res, 200, { deleted });
  }
  throw fail('not found', 404);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    const known = typeof e.code === 'number';   // our own errors; anything else is not described (no paths leak)
    if (e.code === 413) res.setHeader('Connection', 'close');
    send(res, known ? e.code : 500, { error: known ? e.message : 'relay error' });
  });
});
server.requestTimeout = 60e3;
sweep();
setInterval(sweep, 3600e3).unref();
server.listen(PORT, HOST, () => console.log(`AI-gile relay on ${HOST}:${PORT}, data in ${DATA}`));
