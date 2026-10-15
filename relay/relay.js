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
// Envelopes are deleted as soon as the owner acks them, else after 7 days (big ones, over 1 MB: after 48 hours).
// Nothing else is kept: no copies, no logs, no temp files (an envelope is one file, written in place and unlinked on ack/expiry).
//   Public boards (AIG-602..605): a board publishes a clean snapshot of a project that its owner made Public.
//   POST   /b/:name          publish the snapshot (signed; the first key to publish claims the name, only that key can update it)
//   DELETE /b/:name          the owner makes it private again: the snapshot is deleted at once (signed)
//   GET    /b/:name          a read-only page anyone can open (one self-contained HTML file, no external scripts)
//   GET    /b/:name.json     the snapshot and the number of viewers; 404 once private
//   GET    /b/:name/live     server-sent events: each new snapshot, and the viewer count
//   One snapshot per name (up to 256 KB), kept in DATA/pub/<name>/. It holds what the board chose to publish (card ids, titles,
//   types, priorities, assignees, team names), nothing else. Viewers need no login.
//   Public feedback (AIG-968, AIG-970): POST /f/:name is a visitor's report, only while the board switched it on (5 per hour per address);
//   POST /f/:name/config { on }, GET /f/:name/pull, POST /f/:name/ack { ids } are signed; GET /f/:name/form.js is the button and form
//   Business licence applications (AIG-601):
//   POST /apply            { company, website, what, how, email }: one file in DATA/apply/ (5 per hour per address, 8 KB at most)
//   GET  /apply            the applications, only if RELAY_STATS_KEY is set and the request is signed by it (the operator's board)
//   POST /interest         { email, which: alpha|beta|both }: register interest from the website (AIG-754); one file per email
//                          in DATA/interest/ (a repeat replaces it), 5 per hour per address; GET /interest signed like GET /apply
//   POST /bug              { title, text, build, channel }: a Live tester's bug report (10 per hour per address, 8 KB at most)
//   GET  /bug, POST /bug/ack { ids }: the operator's board collects reports and deletes them (signed by RELAY_STATS_KEY)
//   GET  /health           { ok } for anyone; signed by RELAY_STATS_KEY it adds cpu, mem, disk, storage, uptime (AIG-660)
//   GET  /stats            { envelopes, bytes }: only if RELAY_STATS_KEY (the operator's public signing key) is set, and signed by it
//   Call passes (AIG-1218): one LiveKit server run with this relay (RELAY_LIVEKIT_URL, RELAY_LIVEKIT_KEY, RELAY_LIVEKIT_SECRET), so no
//   board holds LiveKit keys. Without all three both routes are 404.
//   GET  /call             { ok, url }: calls work through this relay
//   POST /call/token       { room, name, mailbox, peer | slug } signed by the mailbox's owner key: { url, token, room }, a 2-hour pass
//                          for that one room, worked out here as the board does (a DM: both mailboxes; a Meeting Room: own mailbox + slug)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.RELAY_PORT) || 4500;
const HOST = process.env.RELAY_HOST || '0.0.0.0';
const DATA = path.resolve(process.env.RELAY_DATA || path.join(__dirname, 'data'));
const MAX_BODY = 12 * 1024 * 1024;                       // one envelope (attachments later)
const KEEP_MS = (Number(process.env.RELAY_KEEP_HOURS) || 7 * 24) * 3600e3;          // unacked envelopes are deleted after 7 days
const BIG_BYTES = Number(process.env.RELAY_BIG_BYTES) || 1024 * 1024;               // an envelope over this size ...
const BIG_KEEP_MS = (Number(process.env.RELAY_BIG_KEEP_HOURS) || 48) * 3600e3;      // ... is deleted after 48 hours
const STATS_KEY = process.env.RELAY_STATS_KEY || '';
const SKEW_MS = 2 * 60e3;                                 // a signed request is only good for 2 minutes
const RATE = Number(process.env.RELAY_RATE) || 300;       // requests per minute per IP
const BOX_MAX = 500, BOX_BYTES = Number(process.env.RELAY_BOX_BYTES) || 50 * 1024 * 1024;      // per mailbox
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
// An envelope's age is in its name. Expired ones (7 days; big ones 48 hours) are deleted whenever a mailbox is looked at.
const expired = (f, size) => Date.now() - Number(f.split('-')[0]) > (size > BIG_BYTES ? BIG_KEEP_MS : KEEP_MS);
const envFiles = box => {
  let names; try { names = fs.readdirSync(boxDir(box)).filter(f => isRid(f.slice(0, -5)) && f.endsWith('.json')).sort(); } catch { return []; }
  return names.filter(f => {
    const file = path.join(boxDir(box), f), n = sizeOf(file);
    if (!expired(f, n)) return true;
    try { fs.unlinkSync(file); used -= n; count--; } catch {}
    return false;
  });
};
const ownerIn = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8')).key; } catch { return null; } };
const ownerOf = box => ownerIn(boxDir(box));
const sizeOf = f => { try { return fs.statSync(f).size; } catch { return 0; } };
var used = 0, count = 0;   // bytes and envelopes held across all mailboxes
function sweep() {
  used = 0; count = 0;
  for (const box of fs.readdirSync(DATA).filter(isBox)) for (const f of envFiles(box)) { used += sizeOf(path.join(boxDir(box), f)); count++; }
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
function owner(req, box, pathname, body, onlyKey) {
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
  if (onlyKey) { if (key !== onlyKey) throw fail('not allowed', 403); return; }   // the operator's /stats
  const pubSlot = box && typeof box === 'object', dir = pubSlot ? box.dir : boxDir(box), known = ownerIn(dir);   // a public name passes { dir }
  if (known && known !== key) throw fail(pubSlot ? 'that name belongs to another board' : 'not your mailbox', 403);
  if (!known) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ key }));
  }
}

/* ---------- call passes (AIG-1218) ---------- */
// The board never gets a pass for a room it is not in: the room is worked out from the signed mailbox (and the friend's, or the
// project slug) exactly as lib/calls.js does, and any other room is refused. Passes per board key: RELAY_CALL_RATE an hour.
const LK = { url: process.env.RELAY_LIVEKIT_URL || '', key: process.env.RELAY_LIVEKIT_KEY || '', secret: process.env.RELAY_LIVEKIT_SECRET || '' };
const LK_TTL_S = 2 * 3600;
const CALL_RATE = Number(process.env.RELAY_CALL_RATE) || 60;
const callHits = new Map();   // board key -> pass times in the last hour
const dmRoom = (a, b) => 'aigile-dm-' + sha256('aigile-call-v1|' + [a, b].sort().join('|')).slice(0, 32);
const meetRoom = (box, slug) => 'aigile-meet-' + sha256('aigile-meet-v1|' + box + '|' + slug).slice(0, 32);
// A LiveKit access token: HS256, iss = API key, sub = the board's mailbox; join, publish (mic, camera, screen), subscribe, data.
function lkToken(identity, name, room) {
  const t = Math.floor(Date.now() / 1000), b = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const body = b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ iss: LK.key, sub: identity, name, nbf: t - 10, exp: t + LK_TTL_S,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: ['microphone', 'camera', 'screen_share'] } });
  return body + '.' + crypto.createHmac('sha256', LK.secret).update(body).digest('base64url');
}
async function calls(req, res, pathname) {
  if (!(LK.url && LK.key && LK.secret)) throw fail('calls are not set up on this relay', 404);
  if (req.method === 'GET' && pathname === '/call') return send(res, 200, { ok: true, url: LK.url });
  if (req.method !== 'POST' || pathname !== '/call/token') throw fail('not found', 404);
  const body = await readBody(req, 4096);
  let o; try { o = JSON.parse(body); } catch { throw fail('send JSON', 400); }
  if (!o || typeof o !== 'object' || !isBox(String(o.mailbox || ''))) throw fail('send { room, name, mailbox, peer | slug }', 400);
  owner(req, o.mailbox, pathname, body);   // 401 unsigned / bad signature, 403 another board's mailbox
  const key = String(req.headers['x-relay-key']), t = Date.now(), seen = (callHits.get(key) || []).filter(x => t - x < 3600e3);
  if (seen.length >= CALL_RATE) throw fail('too many call passes: try again later', 429);
  seen.push(t); callHits.set(key, seen);
  let want;
  if (o.peer != null) { if (!isBox(String(o.peer)) || o.peer === o.mailbox) throw fail('bad peer', 400); want = dmRoom(o.mailbox, o.peer); }
  else if (o.slug != null) { if (!/^[a-z0-9-]{1,80}$/.test(String(o.slug))) throw fail('bad slug', 400); want = meetRoom(o.mailbox, o.slug); }
  else throw fail('send { room, name, mailbox, peer | slug }', 400);
  if (o.room !== want) throw fail('not your call', 403);
  return send(res, 200, { url: LK.url, token: lkToken(o.mailbox, str(o.name, 60), want), room: want });
}
setInterval(() => { const t = Date.now(); for (const [k, l] of callHits) if (!l.some(x => t - x < 3600e3)) callHits.delete(k); }, 600e3).unref();

/* ---------- public status page (AIG-1050) ---------- */
// The operator's board posts { services: [{ name, offers, state, line, at }] }, signed by RELAY_STATS_KEY like /apply and /bug (never
// "the first key claims it": a stranger could claim a fresh relay); anyone reads /status.json (CORS *, cached 30 s) (AIG-1119).
const STATUS_DIR = path.join(DATA, 'statuspage');
let statusCache = { at: 0, text: '{"services":[]}' };
async function statusPage(req, res, pathname) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end(); }
  if (req.method === 'GET' && pathname === '/status.json') {
    if (Date.now() - statusCache.at > 30e3) { let text = '{"services":[]}'; try { text = fs.readFileSync(path.join(STATUS_DIR, 'status.json'), 'utf8'); } catch {} statusCache = { at: Date.now(), text }; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=30', 'X-Content-Type-Options': 'nosniff' });
    return res.end(statusCache.text);
  }
  if (req.method === 'POST' && pathname === '/status') {
    if (!STATS_KEY) throw fail('not found', 404);
    const body = await readBody(req, 64 * 1024);
    owner(req, null, pathname, body, STATS_KEY);
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    let o; try { o = JSON.parse(body); } catch { throw fail('send JSON', 400); }
    const services = (Array.isArray(o && o.services) ? o.services : []).slice(0, 50).filter(x => x && typeof x === 'object').map(x => ({
      name: str(x.name, 80), offers: str(x.offers, 200), state: ['green', 'amber', 'red'].includes(x.state) ? x.state : 'green', line: str(x.line, 200), at: str(x.at, 40) }));
    const text = JSON.stringify({ services }), file = path.join(STATUS_DIR, 'status.json');
    fs.writeFileSync(file + '.tmp', text); fs.renameSync(file + '.tmp', file);
    statusCache = { at: 0, text };
    return send(res, 201, { ok: true });
  }
  throw fail('not found', 404);
}

/* ---------- health (AIG-660) ---------- */
// The numbers the operator's board watches to warn before this server needs a bigger plan. Node built-ins only.
function dirBytes(dir, budget = { n: 200000 }) {
  let total = 0;
  let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of list) {
    if (budget.n-- <= 0) break;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) total += dirBytes(f, budget); else if (e.isFile()) total += sizeOf(f);
  }
  return total;
}
async function health() {
  const cpus = os.cpus().length || 1, load = os.loadavg()[0];
  let disk = null, diskFree = null;
  try { const st = await fs.promises.statfs(DATA); const tot = st.blocks * st.bsize; diskFree = st.bavail * st.bsize; disk = tot ? Math.round((1 - st.bavail / st.blocks) * 1000) / 10 : null; } catch {}
  const mem = Math.round((1 - os.freemem() / os.totalmem()) * 1000) / 10;
  return { ok: true, cpu: Math.round(load / cpus * 1000) / 10, load: Math.round(load * 100) / 100, cpus, mem, disk, diskFree, storage: dirBytes(DATA), uptime: Math.round(os.uptime()), relayUptime: Math.round(process.uptime()) };
}

/* ---------- http ---------- */
function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let n = 0;
    req.on('data', d => {
      n += d.length;
      if (n > limit) { reject(fail('too big (' + (limit >= 1048576 ? Math.round(limit / 1048576) + ' MB' : Math.round(limit / 1024) + ' KB') + ' at most)', 413)); req.pause(); return; }
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
  if (req.method === 'GET' && pathname === '/health') {
    if (!STATS_KEY || !req.headers['x-relay-key']) return send(res, 200, { ok: true });
    owner(req, null, pathname, '', STATS_KEY);
    return send(res, 200, await health());
  }
  if (req.method === 'GET' && pathname === '/stats' && STATS_KEY) { owner(req, null, pathname, '', STATS_KEY); sweep(); return send(res, 200, { envelopes: count, bytes: used }); }
  if (pathname === '/status' || pathname === '/status.json') return statusPage(req, res, pathname);   // 🟢 public status page (AIG-1050)
  if (pathname === '/call' || pathname === '/call/token') return calls(req, res, pathname);   // 📞 call passes (AIG-1218)
  if (pathname.startsWith('/b/')) return board(req, res, pathname, ip);
  if (pathname.startsWith('/f/')) return feedback(req, res, pathname, ip);   // public feedback (AIG-968)
  if (pathname === '/apply') return apply(req, res, pathname, ip);
  if (pathname === '/interest') return interest(req, res, pathname, ip);   // 📝 alpha / beta interest (AIG-754)
  if (pathname === '/bug' || pathname === '/bug/ack') return bugs(req, res, pathname, ip);   // 🐞 Live testers (AIG-561)
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
    used += Buffer.byteLength(body); count++;
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
      try { fs.unlinkSync(f); deleted++; used -= n; count--; } catch {}
    }
    return send(res, 200, { deleted });
  }
  throw fail('not found', 404);
}

/* ---------- public boards (AIG-602..605) ---------- */
const PUB = path.join(DATA, 'pub');
const SNAP_MAX = 256 * 1024;                              // one snapshot
const NAME_MAX = 5000;                                    // names claimed on this relay
const isName = s => /^[a-z0-9][a-z0-9-]{2,39}$/.test(s);
const pubDir = name => path.join(PUB, name);
const viewers = new Map();                                // name -> Set of open /live responses
const perIp = new Map();                                  // ip -> open /live count
const lastPub = new Map();                                // name -> last publish time (one every 2 s at most)
let live = 0;
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
// The relay trusts the board only for who it is, never for the shape of the snapshot: it keeps a short list of fields.
function cleanSnap(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send a snapshot as JSON', 400);
  const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, n).filter(x => x && typeof x === 'object');
  return {
    v: 1, title: str(o.title, 80), at: new Date().toISOString(), titlesHidden: o.titlesHidden === true || undefined,
    columns: list(o.columns, 12).map(c => ({ id: str(c.id, 30), label: str(c.label, 40) })),
    cards: list(o.cards, 3000).map(c => ({ id: str(c.id, 20), title: o.titlesHidden === true ? '' : str(c.title, 200), len: Math.max(0, Math.min(8, Math.round(Number(c.len) || 0))) || undefined, type: str(c.type, 12), priority: str(c.priority, 12), status: str(c.status, 30), assignee: str(c.assignee, 60) })),
    team: list(o.team, 50).map(m => ({ name: str(m.name, 60), role: str(m.role, 60), avatar: /^https:\/\/[^\s"'<>]{1,300}$/.test(String(m.avatar || '')) ? String(m.avatar) : '' })),
  };
}
const readSnap = name => { try { return JSON.parse(fs.readFileSync(path.join(pubDir(name), 'snap.json'), 'utf8')); } catch { return null; } };
const watching = name => (viewers.get(name) || new Set()).size;
function push(name, event, data) {
  for (const r of viewers.get(name) || []) { try { r.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch {} }
}
setInterval(() => { for (const set of viewers.values()) for (const r of set) { try { r.write(': \n\n'); } catch {} } }, 25e3).unref();

async function board(req, res, pathname, ip) {
  const m = pathname.match(/^\/b\/([a-z0-9-]+)(\.json|\/live)?$/);
  if (!m || !isName(m[1])) throw fail('not found', 404);
  const name = m[1], kind = m[2] || '';
  if (req.method === 'GET' && !kind) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    return res.end(PAGE.replace('__NAME__', name));
  }
  if (req.method === 'GET' && kind === '.json') {
    const s = readSnap(name);
    if (!s) throw fail('This board is private now', 404);
    return send(res, 200, { ...s, name, viewers: watching(name) });
  }
  if (req.method === 'GET' && kind === '/live') {
    if (live >= 2000 || (perIp.get(ip) || 0) >= 20) throw fail('too many viewers', 429);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    if (!viewers.has(name)) viewers.set(name, new Set());
    viewers.get(name).add(res); live++; perIp.set(ip, (perIp.get(ip) || 0) + 1);
    const s = readSnap(name);
    res.write('retry: 3000\n\n');
    res.write(s ? 'event: snapshot\ndata: ' + JSON.stringify({ ...s, name, viewers: watching(name) }) + '\n\n' : 'event: private\ndata: {}\n\n');
    push(name, 'viewers', { viewers: watching(name) });
    req.on('close', () => {
      const set = viewers.get(name); if (set) { set.delete(res); if (!set.size) viewers.delete(name); }
      live--; perIp.set(ip, Math.max(0, (perIp.get(ip) || 1) - 1));
      push(name, 'viewers', { viewers: watching(name) });
    });
    return;
  }
  if (kind) throw fail('not found', 404);
  // Publish and make private: signed by the board; the first key claims the name.
  if (req.method === 'POST' || req.method === 'DELETE') {
    if (req.headers['content-length'] && Number(req.headers['content-length']) > SNAP_MAX) throw fail('too big (256 KB at most)', 413);
    const body = req.method === 'POST' ? await readBody(req, SNAP_MAX) : '';
    if (!fs.existsSync(pubDir(name)) && fs.existsSync(PUB) && fs.readdirSync(PUB).length >= NAME_MAX) throw fail('this relay has no names left', 507);
    owner(req, { dir: pubDir(name) }, pathname, body);
    if (req.method === 'DELETE') {
      try { fs.unlinkSync(path.join(pubDir(name), 'snap.json')); } catch {}
      push(name, 'private', {});
      return send(res, 200, { ok: true, viewers: watching(name) });
    }
    if (Date.now() - (lastPub.get(name) || 0) < 1500) throw fail('slow down', 429);
    lastPub.set(name, Date.now());
    let o; try { o = JSON.parse(body); } catch { throw fail('send a snapshot as JSON', 400); }
    const snap = cleanSnap(o), text = JSON.stringify(snap);
    const file = path.join(pubDir(name), 'snap.json');
    fs.writeFileSync(file + '.tmp', text); fs.renameSync(file + '.tmp', file);
    push(name, 'snapshot', { ...snap, name, viewers: watching(name) });
    return send(res, 201, { ok: true, viewers: watching(name) });
  }
  throw fail('not found', 404);
}
// The read-only page: no external scripts or styles; text only goes in with textContent; a picture only from an https address.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Board</title><style>
:root{--bg:#f4f5f7;--card:#fff;--text:#1d2430;--muted:#667085;--line:#d9dde4;--accent:#3b82f6}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--card:#1f242c;--text:#e6e9ee;--muted:#98a2b3;--line:#323946;--accent:#60a5fa}}
*{box-sizing:border-box}body{margin:0;font:15px system-ui,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}.muted{color:var(--muted);font-size:13px}.team{display:flex;gap:6px;flex-wrap:wrap}.who{display:inline-flex;gap:5px;align-items:center;font-size:12px;border:1px solid var(--line);border-radius:99px;padding:2px 8px;background:var(--card)}
.who img{width:18px;height:18px;border-radius:50%}main{display:flex;gap:12px;padding:14px;overflow-x:auto;align-items:flex-start}
.col{flex:0 0 240px;background:color-mix(in srgb,var(--card) 60%,transparent);border:1px solid var(--line);border-radius:10px;padding:8px;min-height:80px}
.col h2{font-size:13px;margin:2px 4px 8px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.c{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:14px}
.c.bug{border-left-color:#ef4444}.c.feature{border-left-color:var(--accent)}.c.task{border-left-color:#8b5cf6}
.c .id{font-size:11px;color:var(--muted)}.c .bar{height:10px;border-radius:5px;background:var(--line);margin:6px 0 2px}.c .m{font-size:12px;color:var(--muted);margin-top:4px}.c.new{animation:pop .9s ease}
@keyframes pop{0%{box-shadow:0 0 0 3px var(--accent)}100%{box-shadow:0 0 0 0 transparent}}
#msg{padding:40px 16px;text-align:center;font-size:18px}[hidden]{display:none!important}
@media (max-width:600px){.col{flex-basis:80vw}}
</style></head><body>
<header><h1 id="t">Board</h1><span class="muted" id="v"></span><span class="team" id="team"></span></header>
<div id="msg" hidden></div><main id="cols"></main>
<script>
(function(){
var name="__NAME__",$=function(i){return document.getElementById(i)},pos={},first=true,es;
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function gone(){$("cols").textContent="";$("team").textContent="";$("t").textContent="Board";$("v").textContent="";$("msg").hidden=false;$("msg").textContent="This board is private now."}
function draw(s){
  $("msg").hidden=true;$("t").textContent=s.title||name;document.title=(s.title||name)+" (live)";
  $("v").textContent=s.viewers!=null?(s.viewers+(s.viewers===1?" viewer":" viewers")):"";
  var tm=$("team");tm.textContent="";(s.team||[]).forEach(function(m){var w=el("span","who");if(m.avatar){var i=el("img");i.src=m.avatar;i.alt="";i.referrerPolicy="no-referrer";i.onerror=function(){i.remove()};w.appendChild(i)}w.appendChild(el("span",null,m.name+(m.role?" · "+m.role:"")));tm.appendChild(w)});
  var before={};document.querySelectorAll(".c").forEach(function(c){before[c.dataset.id]=c.getBoundingClientRect()});
  var main=$("cols");main.textContent="";var now={};
  (s.columns||[]).forEach(function(col){
    var d=el("section","col");d.appendChild(el("h2",null,col.label));
    (s.cards||[]).filter(function(c){return c.status===col.id}).forEach(function(c){
      var e=el("div","c "+c.type);e.dataset.id=c.id;e.dataset.col=col.id;e.appendChild(el("div","id",c.id));if(c.title)e.appendChild(el("div",null,c.title));else{var bar=el("div","bar");bar.style.width=Math.max(15,(c.len||3)*12)+"%";e.appendChild(bar)}
      var m=[c.priority!=="normal"?c.priority:"",c.assignee].filter(Boolean).join(" · ");if(m)e.appendChild(el("div","m",m));
      d.appendChild(e);now[c.id]=col.id});
    main.appendChild(d)});
  document.querySelectorAll(".c").forEach(function(c){
    var b=before[c.dataset.id],r=c.getBoundingClientRect();
    if(!first&&!b){c.classList.add("new")}
    else if(b&&(Math.abs(b.left-r.left)>2||Math.abs(b.top-r.top)>2)){
      c.style.transition="none";c.style.transform="translate("+(b.left-r.left)+"px,"+(b.top-r.top)+"px)";c.style.position="relative";c.style.zIndex=2;c.classList.add("new");
      requestAnimationFrame(function(){requestAnimationFrame(function(){c.style.transition="transform .6s ease";c.style.transform="none"})})}});
  first=false;pos=now}
function start(){
  es=new EventSource("/b/"+name+"/live");
  es.addEventListener("snapshot",function(e){draw(JSON.parse(e.data))});
  es.addEventListener("viewers",function(e){var n=JSON.parse(e.data).viewers;$("v").textContent=n+(n===1?" viewer":" viewers")});
  es.addEventListener("private",gone);
}
fetch("/b/"+name+".json").then(function(r){if(!r.ok){gone();return null}return r.json()}).then(function(s){if(s){draw(s)}start()}).catch(start);
})();
</script></body></html>`;

/* ---------- public feedback (AIG-968, AIG-970) ---------- */
// Visitors to a project's own website report a problem: POST /f/<name> (JSON or form). Only while the board switched feedback on for that
// public name (POST /f/<name>/config, signed by the name's key). Reports wait in DATA/pub/<name>/fb/ (the last 200) until the board pulls
// them (GET /f/<name>/pull, signed) and acks them (POST /f/<name>/ack { ids }, signed). GET /f/<name>/form.js is the button and form.
const FB_RATE = Number(process.env.RELAY_FEEDBACK_RATE) || 5;       // reports per hour per address
const FB_KEEP = 200, FB_PULL = 20, FB_TEXT = 2000, FB_SHOT = 300 * 1024;
const fbHits = new Map();                                            // ip -> times in the last hour
const FB_ID = /^\d{13}-[0-9a-f]{16}$/;
const fbDir = name => path.join(pubDir(name), 'fb');
const fbOn = name => { try { return JSON.parse(fs.readFileSync(path.join(pubDir(name), 'feedback.json'), 'utf8')).on === true; } catch { return false; } };
const fbText = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n);
const fbFiles = name => { try { return fs.readdirSync(fbDir(name)).filter(f => f.endsWith('.json') && FB_ID.test(f.slice(0, -5))).sort(); } catch { return []; } };
setInterval(() => { const t = Date.now(); for (const [ip, l] of fbHits) { const k = l.filter(x => t - x < 3600e3); if (k.length) fbHits.set(ip, k); else fbHits.delete(ip); } }, 600e3).unref();

async function feedback(req, res, pathname, ip) {
  res.setHeader('Access-Control-Allow-Origin', '*');   // the form lives on the project's own website
  const m = pathname.match(/^\/f\/([a-z0-9-]+)(\/config|\/pull|\/ack|\/form\.js)?$/);
  if (!m || !isName(m[1])) throw fail('not found', 404);
  const name = m[1], kind = m[2] || '';
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end(); }
  if (req.method === 'GET' && kind === '/form.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return res.end(FORM_JS.replace('__NAME__', name));
  }
  // The board: switch it on or off, collect, ack. All signed by the key that owns the public name.
  if (kind === '/config' || kind === '/pull' || kind === '/ack') {
    const post = kind !== '/pull';
    if (req.method !== (post ? 'POST' : 'GET')) throw fail('not found', 404);
    const body = post ? await readBody(req, 64 * 1024) : '';
    if (!ownerIn(pubDir(name))) throw fail('publish the board first', 404);   // never claims a name
    owner(req, { dir: pubDir(name) }, pathname, body);
    if (kind === '/config') {
      let o; try { o = JSON.parse(body); } catch { throw fail('send { on } as JSON', 400); }
      fs.writeFileSync(path.join(pubDir(name), 'feedback.json'), JSON.stringify({ on: !!(o && o.on) }));
      return send(res, 200, { ok: true, on: !!(o && o.on) });
    }
    if (kind === '/pull') {
      const reports = [];
      for (const f of fbFiles(name).slice(0, FB_PULL)) { try { reports.push({ id: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(fbDir(name), f), 'utf8')) }); } catch {} }
      return send(res, 200, { reports });
    }
    let ids; try { ids = JSON.parse(body).ids; } catch {}
    if (!Array.isArray(ids)) throw fail('send { ids }', 400);
    let deleted = 0;
    for (const id of ids.slice(0, 500)) if (FB_ID.test(String(id))) { try { fs.unlinkSync(path.join(fbDir(name), id + '.json')); deleted++; } catch {} }
    return send(res, 200, { deleted });
  }
  if (kind || req.method !== 'POST') throw fail('not found', 404);
  // A visitor's report.
  if (!fbOn(name)) throw fail('this site is not taking reports', 404);
  const body = await readBody(req, 460 * 1024);
  let o;
  if (/json/i.test(String(req.headers['content-type'] || ''))) { try { o = JSON.parse(body); } catch { throw fail('send the report as JSON', 400); } }
  else o = Object.fromEntries(new URLSearchParams(body));
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send the report as JSON', 400);
  const now = Date.now(), recent = (fbHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= FB_RATE) throw fail('too many reports from here: try again later', 429);
  recent.push(now); fbHits.set(ip, recent);
  if (String(o.website == null ? '' : o.website) !== '') return send(res, 200, { ok: true });   // the hidden field: a bot filled it; look done, keep nothing
  const r = { lang: fbText(o.lang, 12).replace(/[^A-Za-z0-9_-]/g, ''), page: fbText(o.page, 200).replace(/\n/g, ' '), says: fbText(o.says, FB_TEXT), should: fbText(o.should, FB_TEXT) };
  if (!r.says) throw fail('say what went wrong', 400);
  if (o.screenshot) {
    const sm = String(o.screenshot).match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!sm) throw fail('the screenshot must be a png or jpeg picture', 400);
    const buf = Buffer.from(sm[2], 'base64');
    if (buf.length > FB_SHOT) throw fail('the screenshot is too big (300 KB at most)', 413);
    const magic = sm[1] === 'png' ? buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    if (!magic) throw fail('the screenshot is not a real ' + sm[1] + ' picture', 400);
    r.screenshot = 'data:image/' + sm[1] + ';base64,' + sm[2];
  }
  fs.mkdirSync(fbDir(name), { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(path.join(fbDir(name), id + '.json'), JSON.stringify({ ...r, at: new Date().toISOString() }), { mode: 0o600 });
  const have = fbFiles(name);
  for (const f of have.slice(0, Math.max(0, have.length - FB_KEEP))) { try { fs.unlinkSync(path.join(fbDir(name), f)); } catch {} }   // the oldest go
  return send(res, 201, { ok: true });
}
// The script a website adds: <script src="https://relay/f/<name>/form.js" defer></script>. No cookies, no other requests than the one POST.
const FORM_JS = String.raw`(function(){
var NAME="__NAME__",SRC=(document.currentScript&&document.currentScript.src)||"",BASE=SRC?new URL(SRC).origin:"";
var T={en:{btn:"Report a problem",lang:"Language",says:"What went wrong?",should:"What should have happened?",shot:"Screenshot (optional, png or jpeg, 300 KB at most)",send:"Send",cancel:"Cancel",thanks:"Thank you! Your report was sent.",err:"Sorry, it could not be sent. Please try again later.",big:"That picture is too big or not a png or jpeg."},
nl:{btn:"Meld een probleem",lang:"Taal",says:"Wat ging er mis?",should:"Wat had er moeten gebeuren?",shot:"Schermafbeelding (optioneel, png of jpeg, max 300 KB)",send:"Versturen",cancel:"Annuleren",thanks:"Bedankt! Je melding is verstuurd.",err:"Sorry, het versturen is mislukt. Probeer het later opnieuw.",big:"Die afbeelding is te groot of geen png of jpeg."},
de:{btn:"Problem melden",lang:"Sprache",says:"Was ist schiefgelaufen?",should:"Was hätte passieren sollen?",shot:"Screenshot (optional, png oder jpeg, höchstens 300 KB)",send:"Senden",cancel:"Abbrechen",thanks:"Danke! Ihre Meldung wurde gesendet.",err:"Leider konnte nichts gesendet werden. Bitte später erneut versuchen.",big:"Das Bild ist zu groß oder kein png oder jpeg."},
fr:{btn:"Signaler un problème",lang:"Langue",says:"Qu'est-ce qui n'a pas marché ?",should:"Que devrait-il se passer ?",shot:"Capture d'écran (facultatif, png ou jpeg, 300 Ko max)",send:"Envoyer",cancel:"Annuler",thanks:"Merci ! Votre signalement a été envoyé.",err:"Désolé, l'envoi a échoué. Réessayez plus tard.",big:"Cette image est trop grande ou n'est pas un png ou jpeg."},
es:{btn:"Informar de un problema",lang:"Idioma",says:"¿Qué salió mal?",should:"¿Qué debería haber pasado?",shot:"Captura de pantalla (opcional, png o jpeg, máx. 300 KB)",send:"Enviar",cancel:"Cancelar",thanks:"¡Gracias! Tu informe fue enviado.",err:"Lo siento, no se pudo enviar. Inténtalo más tarde.",big:"Esa imagen es demasiado grande o no es png ni jpeg."}};
var htmlLang=(document.documentElement.getAttribute("lang")||"en").trim();
var L=T[htmlLang.slice(0,2).toLowerCase()]||T.en;
function el(tag,css,text){var e=document.createElement(tag);if(css)e.style.cssText=css;if(text!=null)e.textContent=text;return e}
var btn=el("button","position:fixed;right:16px;bottom:16px;z-index:2147483000;padding:8px 14px;border:0;border-radius:18px;background:#2563eb;color:#fff;font:14px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)",L.btn);
btn.type="button";
var box=el("form","position:fixed;right:16px;bottom:16px;z-index:2147483001;width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:14px;border-radius:10px;background:#fff;color:#111;font:14px system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.35);display:none");
box.noValidate=true;
function field(label,node){var w=el("label","display:block;margin:0 0 10px",null);w.appendChild(el("span","display:block;margin:0 0 3px;font-weight:600",label));node.style.cssText="width:100%;box-sizing:border-box;font:inherit;padding:5px;border:1px solid #999;border-radius:4px";w.appendChild(node);box.appendChild(w);return node}
var lang=field(L.lang,el("input"));lang.maxLength=12;lang.value=htmlLang.slice(0,12);
var says=field(L.says,el("textarea"));says.rows=3;says.maxLength=2000;
var should=field(L.should,el("textarea"));should.rows=3;should.maxLength=2000;
var shot=field(L.shot,el("input"));shot.type="file";shot.accept="image/png,image/jpeg";
var trap=el("input","position:absolute;left:-9999px;width:1px;height:1px;opacity:0");trap.type="text";trap.name="website";trap.tabIndex=-1;trap.autocomplete="off";trap.setAttribute("aria-hidden","true");box.appendChild(trap);
var msg=el("div","margin:0 0 10px;min-height:1em");msg.setAttribute("role","status");box.appendChild(msg);
var row=el("div","display:flex;gap:8px;justify-content:flex-end");
var send=el("button","padding:6px 14px;border:0;border-radius:4px;background:#2563eb;color:#fff;cursor:pointer",L.send);send.type="submit";
var cancel=el("button","padding:6px 14px;border:1px solid #999;border-radius:4px;background:#fff;color:#111;cursor:pointer",L.cancel);cancel.type="button";
row.appendChild(cancel);row.appendChild(send);box.appendChild(row);
function show(on){box.style.display=on?"block":"none";btn.style.display=on?"none":"block";if(on)says.focus()}
btn.onclick=function(){msg.textContent="";show(true)};
cancel.onclick=function(){show(false)};
function post(shotData){
  var body={lang:lang.value,page:location.pathname,says:says.value,should:should.value,website:trap.value};
  if(shotData)body.screenshot=shotData;
  send.disabled=true;
  fetch(BASE+"/f/"+NAME,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"omit",referrerPolicy:"no-referrer"})
  .then(function(r){if(!r.ok)throw 0;msg.textContent=L.thanks;says.value=should.value=shot.value="";send.disabled=false;setTimeout(function(){show(false)},2500)})
  .catch(function(){msg.textContent=L.err;send.disabled=false});
}
box.onsubmit=function(ev){
  ev.preventDefault();if(!says.value.trim())return;
  var f=shot.files&&shot.files[0];
  if(!f)return post("");
  if(f.size>307200||!/^image\/(png|jpeg)$/.test(f.type)){msg.textContent=L.big;return}
  var fr=new FileReader();fr.onload=function(){post(String(fr.result))};fr.onerror=function(){msg.textContent=L.err};fr.readAsDataURL(f)
};
function add(){document.body.appendChild(btn);document.body.appendChild(box)}
if(document.body)add();else document.addEventListener("DOMContentLoaded",add);
})();
`;

/* ---------- business licence applications (AIG-601) ---------- */
const APPLY = path.join(DATA, 'apply');
const applyHits = new Map();   // ip -> times in the last hour
async function apply(req, res, pathname, ip) {
  res.setHeader('Access-Control-Allow-Origin', '*');   // the licence form lives on the website, not on the relay
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end(); }
  if (req.method === 'GET') {
    if (!STATS_KEY) throw fail('not found', 404);
    owner(req, null, pathname, '', STATS_KEY);
    let names = []; try { names = fs.readdirSync(APPLY).filter(f => /^\d{13}-[0-9a-f]{16}\.json$/.test(f)).sort(); } catch {}
    const items = [];
    for (const n of names.slice(-500)) { try { items.push({ id: n.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(APPLY, n), 'utf8')) }); } catch {} }
    return send(res, 200, { applications: items });
  }
  if (req.method !== 'POST') throw fail('not found', 404);
  const now = Date.now(), recent = (applyHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 5) throw fail('too many applications from here: try again later', 429);
  const body = await readBody(req, 8 * 1024);
  let o; try { o = JSON.parse(body); } catch { throw fail('send the application as JSON', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send the application as JSON', 400);
  const a = { company: str(o.company, 120), website: str(o.website, 200), what: str(o.what, 1000), how: str(o.how, 1000), email: str(o.email, 160) };
  if (!a.company || !a.what || !a.how) throw fail('company, what you do and how it helps the world are needed', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) throw fail('a valid email is needed', 400);
  let have = 0; try { have = fs.readdirSync(APPLY).length; } catch {}
  if (have >= 2000) throw fail('the list is full', 507);
  fs.mkdirSync(APPLY, { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(path.join(APPLY, id + '.json'), JSON.stringify({ ...a, at: new Date().toISOString() }), { mode: 0o600 });
  recent.push(now); applyHits.set(ip, recent);
  return send(res, 201, { ok: true });
}

// 📝 Interest in the alpha and beta (AIG-754): the website form posts an email and which test. One file per email (named by
// its hash, so a second sign-up replaces the first and the list holds no duplicates). Read only by the operator's board.
const INTEREST = path.join(DATA, 'interest');
const interestHits = new Map();   // ip -> times in the last hour
async function interest(req, res, pathname, ip) {
  res.setHeader('Access-Control-Allow-Origin', '*');   // the form lives on the website, not on the relay
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end(); }
  if (req.method === 'GET') {
    if (!STATS_KEY) throw fail('not found', 404);
    owner(req, null, pathname, '', STATS_KEY);
    let names = []; try { names = fs.readdirSync(INTEREST).filter(f => /^[0-9a-f]{32}\.json$/.test(f)); } catch {}
    const items = [];
    for (const n of names) { try { items.push(JSON.parse(fs.readFileSync(path.join(INTEREST, n), 'utf8'))); } catch {} }
    return send(res, 200, { interest: items.sort((a, b) => String(a.at).localeCompare(String(b.at))) });
  }
  if (req.method !== 'POST') throw fail('not found', 404);
  const now = Date.now(), recent = (interestHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 5) throw fail('too many sign-ups from here: try again later', 429);
  const body = await readBody(req, 2 * 1024);
  let o; try { o = JSON.parse(body); } catch { throw fail('send it as JSON', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send it as JSON', 400);
  const email = str(o.email, 160).trim().toLowerCase(), which = str(o.which, 10);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('a valid email is needed', 400);
  if (!['alpha', 'beta', 'both'].includes(which)) throw fail('pick alpha, beta or both', 400);
  const name = crypto.createHash('sha256').update(email).digest('hex').slice(0, 32) + '.json';
  let have = 0; try { have = fs.readdirSync(INTEREST).length; } catch {}
  if (have >= 5000 && !fs.existsSync(path.join(INTEREST, name))) throw fail('the list is full', 507);
  fs.mkdirSync(INTEREST, { recursive: true });
  fs.writeFileSync(path.join(INTEREST, name), JSON.stringify({ email, which, at: new Date().toISOString() }), { mode: 0o600 });
  recent.push(now); interestHits.set(ip, recent);
  return send(res, 201, { ok: true });
}

// 🐞 Bug reports from Live testers (AIG-561): a tester's board posts one; the operator's board collects them (signed with
// RELAY_STATS_KEY, like /apply), files each as a card on its own board and acks it, which deletes it here.
const BUGS = path.join(DATA, 'bugs');
const bugHits = new Map();   // ip -> times in the last hour
const BUG_ID = /^\d{13}-[0-9a-f]{16}$/;
async function bugs(req, res, pathname, ip) {
  if (req.method === 'GET' || pathname === '/bug/ack') {
    if (!STATS_KEY) throw fail('not found', 404);
    const body = req.method === 'POST' ? await readBody(req, 64 * 1024) : '';
    owner(req, null, pathname, body, STATS_KEY);
    if (req.method === 'POST') {
      let ids = []; try { ids = JSON.parse(body).ids || []; } catch {}
      for (const id of [].concat(ids).slice(0, 500)) if (BUG_ID.test(String(id))) fs.rmSync(path.join(BUGS, id + '.json'), { force: true });
      return send(res, 200, { ok: true });
    }
    let names = []; try { names = fs.readdirSync(BUGS).filter(f => BUG_ID.test(f.slice(0, -5)) && f.endsWith('.json')).sort(); } catch {}
    const items = [];
    for (const n of names.slice(0, 200)) { try { items.push({ id: n.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(BUGS, n), 'utf8')) }); } catch {} }
    return send(res, 200, { bugs: items });
  }
  if (req.method !== 'POST' || pathname !== '/bug') throw fail('not found', 404);
  const now = Date.now(), recent = (bugHits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 10) throw fail('too many reports from here: try again later', 429);
  const body = await readBody(req, 8 * 1024);
  let o; try { o = JSON.parse(body); } catch { throw fail('send the report as JSON', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw fail('send the report as JSON', 400);
  const b = { title: str(o.title, 140), text: String(o.text == null ? '' : o.text).slice(0, 4000), build: str(o.build, 40), channel: str(o.channel, 20) };
  if (!b.title && !b.text) throw fail('a title or some text is needed', 400);
  let have = 0; try { have = fs.readdirSync(BUGS).length; } catch {}
  if (have >= 5000) throw fail('the list is full', 507);
  fs.mkdirSync(BUGS, { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(path.join(BUGS, id + '.json'), JSON.stringify({ ...b, at: new Date().toISOString() }), { mode: 0o600 });
  recent.push(now); bugHits.set(ip, recent);
  return send(res, 201, { ok: true });
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
