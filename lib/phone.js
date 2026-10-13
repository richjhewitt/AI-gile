// 📱 Your phone over your own network (AIG-868): the board's pages on the owner's phone through `tailscale serve`.
// The PC proxies https://<pc>.<tailnet>.ts.net to this board, so those requests come from 127.0.0.1 with Host = that name.
// server.js guard() lets a saved phone host in ONLY with a device cookie paired here (or the one pairing call with a
// one-time code), with Origin https://<that host>. aigile.local.json keeps the hosts and a sha256 of each device key, never the key.
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { LOCAL_FILE, localSettings, bad } = require('./store');

const CODE_MS = 10 * 60e3;        // a pairing code lasts 10 minutes, once
const COOKIE = 'aigile_phone';
const YEAR_S = 365 * 24 * 3600;
const codes = new Map();          // sha256(code) -> { host, name, exp }
const seen = new Map();           // device id -> last seen ms (written to the file at most once a minute)
let flushedAt = 0;

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const read = () => { const p = localSettings().phone || {}; return { hosts: Array.isArray(p.hosts) ? p.hosts : [], devices: Array.isArray(p.devices) ? p.devices : [] }; };
function write(ph) { const s = localSettings(); s.phone = ph; fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2) + '\n'); }

// A host name like mypc.tail1234.ts.net: lowercase, letters, digits, dots and dashes, at least one dot, never this computer's own names.
function cleanHost(h) {
  const x = String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:443$/, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x) || x.length > 200 || /^(localhost|127\.|0\.0\.0\.0)/.test(x)) throw bad('type the phone address host, like mypc.tail1234.ts.net');
  return x;
}
// The saved phone host a request's Host header names (port 443 or none), or null.
function hostOf(header) {
  const h = String(header || '').toLowerCase().replace(/:443$/, '');
  return read().hosts.includes(h) ? h : null;
}
function cookieOf(req) {
  const m = String((req.headers && req.headers.cookie) || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]{20,200})'));
  return m ? m[1] : '';
}
// The Android app (AIG-907) sends its key as Authorization: Bearer <key>; any Authorization header means only that is looked at.
function bearerOf(req) {
  const a = (req.headers && req.headers.authorization); if (a === undefined) return null;
  const m = String(a).match(/^Bearer ([A-Za-z0-9_-]{20,200})$/);
  return m ? m[1] : '';
}
// The paired device for this request on that host, or null. via: 'bearer' (the app) or 'cookie' (the phone browser).
function deviceFor(req, host) {
  const b = bearerOf(req), via = b === null ? 'cookie' : 'bearer';
  const key = b === null ? cookieOf(req) : b; if (!key) return null;
  const h = sha(key), d = read().devices.find(x => x.hash === h && x.host === host);
  if (!d) return null;
  seen.set(d.id, Date.now());
  if (Date.now() - flushedAt > 60e3) { flushedAt = Date.now(); try { const ph = read(); for (const x of ph.devices) if (seen.has(x.id)) x.seen = new Date(seen.get(x.id)).toISOString(); write(ph); } catch {} }
  return { id: d.id, name: d.name, host, via };
}

// What a paired phone may not do (it is the owner, but on a phone that could be lost): no terminal, no secrets,
// no file editor, no pairing or Setup changes, no new command for a team to run.
const DENY = [/^\/api\/phone(\/|$)/, /^\/api\/terminal(\/|$)/, /^\/api\/secrets(\/|$)/, /^\/api\/editor(\/|$)/, /\/secret-ask$/];
function denied(req, pathname) {
  if (DENY.some(re => re.test(pathname))) throw bad('not from a phone: use the board on your computer', 403);
  if (req.method !== 'GET' && pathname === '/api/setup') throw bad('not from a phone: use the board on your computer', 403);
}
function deniedBody(body) {
  if (body && typeof body === 'object' && ('runCmd' in body || 'runIn' in body)) throw bad('not from a phone: use the board on your computer', 403);
}

/* ---------- Setup (this computer only) ---------- */
const shown = () => { const ph = read(); return { hosts: ph.hosts, devices: ph.devices.map(d => ({ id: d.id, name: d.name, host: d.host, at: d.at, seen: (seen.has(d.id) ? new Date(seen.get(d.id)).toISOString() : d.seen) || null })) }; };
function start(b) {
  const host = cleanHost(b.host), name = String(b.name || '').trim().slice(0, 40) || 'Phone';
  const ph = read(); if (!ph.hosts.includes(host)) { ph.hosts.push(host); write(ph); }
  for (const [k, v] of codes) if (v.exp < Date.now()) codes.delete(k);
  const code = crypto.randomBytes(18).toString('base64url'), exp = Date.now() + CODE_MS;
  codes.set(sha(code), { host, name, exp });
  return { url: `https://${host}/#/pair/${code}`, exp: new Date(exp).toISOString(), host };
}
// Pair the app (AIG-907): a device key made here at once, shown once in a QR code the app scans; only its hash is kept.
function startApp(b) {
  const host = cleanHost(b.host);
  const ph = read(); if (!ph.hosts.includes(host)) ph.hosts.push(host);
  const key = crypto.randomBytes(32).toString('base64url'), id = crypto.randomBytes(6).toString('hex');
  ph.devices.push({ id, name: 'Android app', host, hash: sha(key), at: new Date().toISOString(), app: true }); write(ph);
  return { qr: `aigile://pair?url=https://${host}&key=${key}`, host, id };
}
function remove(id) {
  const ph = read(), n = ph.devices.length;
  ph.devices = ph.devices.filter(d => d.id !== id);
  if (ph.devices.length === n) throw bad('no such phone', 404);
  write(ph); seen.delete(id);
  return shown();
}
// The PC's own Tailscale name, if Tailscale is installed (read-only `tailscale status --json`), else ''.
let tsCache = null;
function tailscale() {
  if (process.env.AIGILE_NO_TAILSCALE) return Promise.resolve({ host: '' });   // QA
  if (tsCache && Date.now() - tsCache.at < 60e3) return Promise.resolve({ host: tsCache.host });
  return new Promise(res => {
    execFile('tailscale', ['status', '--json'], { timeout: 4000, windowsHide: true, maxBuffer: 4e6 }, (err, out) => {
      let host = ''; try { host = String(JSON.parse(out).Self.DNSName || '').replace(/\.$/, '').toLowerCase(); } catch {}
      if (host) try { host = cleanHost(host); } catch { host = ''; }
      tsCache = { at: Date.now(), host }; res({ host });
    });
  });
}

/* ---------- the phone's side ---------- */
// The one call a phone makes without a cookie: trade the one-time code for a device key in an HttpOnly cookie.
function pair(b, host) {
  const k = sha(String(b.code || '')), c = codes.get(k);
  if (!c || c.exp < Date.now() || c.host !== host) { codes.delete(k); throw bad('this pairing link is used or out of date: make a new one in Setup on your computer', 403); }
  codes.delete(k);
  const key = crypto.randomBytes(32).toString('base64url'), id = crypto.randomBytes(6).toString('hex');
  const ph = read(); ph.devices.push({ id, name: c.name, host, hash: sha(key), at: new Date().toISOString() }); write(ph);
  return { ok: true, name: c.name, __cookie: `${COOKIE}=${key}; Path=/; Max-Age=${YEAR_S}; HttpOnly; Secure; SameSite=Strict` };
}

module.exports = { hostOf, deviceFor, denied, deniedBody, shown, start, startApp, remove, pair, tailscale, cleanHost, COOKIE };
