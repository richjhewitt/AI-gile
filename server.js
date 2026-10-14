// AI-gile: tiny local board for the owner + the AI dev teams.
// Zero dependencies (node-pty is optional, for the built-in terminal: lib/terminal.js). Data lives in data/<slug>.json (one file per project).
// Run: node server.js   ->   http://localhost:4321
// This file is the http plumbing and the wiring; the logic lives in lib/ (see docs/CODEMAP.md).
const http = require('http');
const fs = require('fs');
const path = require('path');
// Read-only git calls (status, log, diff) never take index.lock, so a board stopped mid-call (QA, restarts) can't leave a stale
// lock in a project folder that blocks the next commit there (AIG-965). Children (git, agents) inherit it; required locks stay.
process.env.GIT_OPTIONAL_LOCKS = '0';

const { PORT, HOST, DATA, PUBLIC, bad, localSettings } = require('./lib/store');
const makeRoutes = require('./lib/routes');
const { heard } = require('./lib/presence');
const phone = require('./lib/phone');
const seal = require('./lib/phone-seal');

fs.mkdirSync(DATA, { recursive: true });

/* ---------- dev build id ---------- */
// Development flag: open pages show a "new version, refresh" prompt after each build.
// A build = a server restart or a change to the page, so the id is start time + page mtime.
// On for whoever builds AI-gile ("dev": true in aigile.local.json, or AIGILE_DEV=1), off for friends (AIG-253).
const DEV = /^(1|true|yes)$/i.test(process.env.AIGILE_DEV || '') || localSettings().dev === true;
const STARTED = Date.now();
// Scan asynchronously away from requests. Keep the last complete scan during an update.
async function newest(dir, jsOnly = false) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const times = await Promise.all(entries.filter(e => e.isDirectory() || !jsOnly || e.name.endsWith('.js')).map(async e => {
    const file = path.join(dir, e.name);
    try { return e.isDirectory() ? await newest(file, jsOnly) : (await fs.promises.stat(file)).mtimeMs; }
    catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  }));
  return Math.max(0, ...times);
}
let buildId = STARTED + '-0', serverStale = false, scanningBuild = false, scannedAt = 0;
// Outside dev (AIG-1090) nothing scans on a timer: the first ask after 10 s of quiet starts a scan, so an update (git merge) still shows within a poll or two.
const lazyScan = () => { if (!DEV && Date.now() - scannedAt > 10000) refreshBuild(); };
const build = () => { lazyScan(); return buildId; };

// Server code newer than this running server (AIG-206): the page offers 🔄 Restart the board instead of failing on new routes.
const stale = () => { lazyScan(); return serverStale; };
async function refreshBuild() {
  if (scanningBuild) return;
  scanningBuild = true; scannedAt = Date.now();
  try {
    const [pageTime, libTime, serverStat] = await Promise.all([newest(PUBLIC), newest(path.join(__dirname, 'lib'), true), fs.promises.stat(__filename)]);
    buildId = STARTED + '-' + pageTime;
    serverStale = Math.max(libTime, serverStat.mtimeMs) > STARTED;
  } catch { /* files can disappear mid-update; retry without losing the last good metadata */ }
  finally { scanningBuild = false; }
}
const metadataReady = refreshBuild();
if (DEV) setInterval(refreshBuild, 2000).unref();   // only the people building AI-gile need every save noticed within 2 s (AIG-1090)

const routes = makeRoutes(() => ({ dev: DEV, build: build(), stale: stale() }));

/* ---------- http plumbing ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// Only this computer's own board, CLI and hooks may use the API (AIG-90). The server already listens on
// 127.0.0.1, but a website open in the same browser could still send requests to it:
// - Host must be localhost/127.0.0.1 (stops DNS rebinding: a site pointing its own name at this port)
// - changes must come from the board's own page if a browser sends them (Origin), and as JSON, which a
//   plain cross-site form or beacon can't send without a preflight that this server never allows.
const LOCAL = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
// 📱 A phone over the owner's own network (AIG-868, lib/phone.js): a Host saved in Setup is let in only with a paired
// device cookie (or the pairing call itself), and only from https://<that host>. tailscale serve connects from 127.0.0.1,
// so the remote address proves nothing here: req.aigilePhone marks these requests for the checks that rely on it.
function guardPhone(req, pathname) {
  const host = phone.hostOf(req.headers.host);
  if (!host) throw bad('wrong host', 403);
  // The Android app (AIG-907) sends Authorization: Bearer <device key> and no Origin. A web page on another site can't
  // send that header here: it needs a CORS preflight (OPTIONS), and this server never answers one with Access-Control-*.
  const pairing = req.method === 'POST' && pathname === '/api/phone/pair';
  // A sealed call (AII-18, docs/SEALED.md): no key in the request at all; lib/phone-seal.js checks the device and the seal.
  if (req.method === 'POST' && pathname === '/api/phone/sealed') {
    if (req.headers.authorization || !req.headers['x-aigile-device']) throw bad('sealed: send X-Aigile-Device and no Authorization', 403);
    if (req.headers.origin && req.headers.origin.toLowerCase() !== 'https://' + host) throw bad('requests from other sites are not allowed', 403);
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw bad('send JSON (Content-Type: application/json)', 415);
    req.aigileSealed = host;
    return;
  }
  const d = pairing ? null : phone.deviceFor(req, host);
  const origin = req.headers.origin;
  if (origin ? origin.toLowerCase() !== 'https://' + host : req.method !== 'GET' && !(d && d.via === 'bearer')) throw bad('requests from other sites are not allowed', 403);
  if (pairing) req.aigilePair = host;
  else {
    if (!d) throw bad('this phone is not paired: pair it from Setup on your computer', 403);
    req.aigilePhone = d;
    phone.denied(req, pathname);
  }
  if (req.method !== 'GET' && !/^application\/json\b/i.test(req.headers['content-type'] || '')) throw bad('send JSON (Content-Type: application/json)', 415);
}
// The opened sealed request runs through the same routes, as that device, with the same deny list (AII-18).
// Its answer is sealed back: { s: status, b: JSON body, or { ct, data: base64 } for a file or picture }.
async function runSealed(req, body) {
  const d = phone.sealedDevice(req.headers['x-aigile-device'], req.aigileSealed);
  if (!d) throw bad('sealed: unknown device', 403);
  const r = seal.open(d, body);
  const iu = new URL(r.p, 'http://x');
  let ip; try { ip = decodeURIComponent(iu.pathname); } catch { throw bad('sealed: bad path', 403); }
  const inner = { method: r.m, headers: { host: req.headers.host, 'content-type': 'application/json' }, socket: req.socket, aigilePhone: d };
  const ib = ['POST', 'PATCH', 'PUT'].includes(r.m) && r.b && typeof r.b === 'object' ? r.b : {};
  try { phone.denied(inner, ip); phone.deniedBody(ib); } catch { throw bad('sealed: not from a phone', 403); }
  let s = 200, b = null;
  try {
    const hit = routes.find(([m, re]) => m === r.m && re.test(ip));
    if (!hit) throw bad('no such endpoint: ' + r.m + ' ' + ip, 404);
    const out = await hit[2](ip.match(hit[1]).slice(1), ib, iu.searchParams, inner);
    if (out && out.__cookie) delete out.__cookie;
    if (out && out.__sse) throw bad('a live stream is not sealed', 400);
    if (out && out.__svg) b = { ct: 'image/svg+xml', data: Buffer.from(out.__svg).toString('base64') };
    else if (out && out.__file) b = { ct: out.download ? 'application/octet-stream' : ATTACH_MIME[path.extname(out.__file).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(out.__file).toString('base64') };
    else b = out === undefined ? null : JSON.parse(JSON.stringify(out));
  } catch (e) { s = e.code >= 400 && e.code < 600 ? e.code : 500; b = { error: e.message }; }
  return seal.close(d, s, b);
}
function guard(req, pathname) {
  if (!LOCAL.has(String(req.headers.host || '').toLowerCase())) return guardPhone(req, pathname);
  if (req.method === 'GET') return;
  const origin = req.headers.origin;
  if (origin && !LOCAL.has(origin.replace(/^http:\/\//, '').toLowerCase())) throw bad('requests from other sites are not allowed', 403);
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw bad('send JSON (Content-Type: application/json)', 415);
}

// Attachments show inline only for these types; anything else downloads.
const ATTACH_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8' };

// A half-merged page file (AIG-517): a .js/.css/.json under public/ with a git conflict marker line is never served;
// the page gets 503 + Retry-After and tries again a moment later. Only text files are read, once per change (mtime + size).
const marked = new Map();   // file -> [mtimeMs, size, has a marker]
function conflicted(file, st) {
  if (!/\.(js|css|json)$/i.test(file)) return false;
  const c = marked.get(file);
  if (c && c[0] === st.mtimeMs && c[1] === st.size) return c[2];
  let m = false; try { m = /^(<<<<<<<|>>>>>>>) /m.test(fs.readFileSync(file, 'utf8')); } catch {}
  marked.set(file, [st.mtimeMs, st.size, m]);
  return m;
}

function send(res, code, body) {
  if (res.destroyed) return;
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));   // compact (AIG-920): pretty-printing added 20% to every poll
}

function readBody(req, max = 1e6) {
  return new Promise((resolve, reject) => {
    let chunks = [], size = 0, finished = false;
    const fail = error => { if (finished) return; finished = true; chunks = []; reject(error); };
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > max) { fail(bad('body too large', 413)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('error', fail);
    req.on('aborted', () => fail(bad('request aborted', 400)));
    req.on('close', () => { if (!req.complete) fail(bad('request aborted', 400)); });
    req.on('end', () => {
      if (finished) return;
      const text = Buffer.concat(chunks).toString('utf8');
      chunks = []; finished = true;
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); } catch { reject(bad('body must be JSON')); }
    });
  });
}

// Stream errors arrive after the route's try/catch. Handle them without killing the board.
function streamFile(file, res, headers) {
  const stream = fs.createReadStream(file);
  stream.on('error', error => {
    if (res.destroyed) return;
    if (res.headersSent) return res.destroy();
    send(res, error.code === 'ENOENT' ? 404 : 500, { error: 'Could not read file' });
  });
  res.on('close', () => stream.destroy());
  stream.once('open', () => { if (res.destroyed) return stream.destroy(); res.writeHead(200, headers); stream.pipe(res); });
  return stream;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }   // a bad %-code no longer stops the board (AIG-150)
  try {
    // The pairing page (AIG-1008): only on a saved phone host, GET only, the same page for every code (it never reads or spends one).
    if (req.method === 'GET' && /^\/_pair\/[A-Za-z0-9_-]{10,100}$/.test(pathname) && phone.hostOf(req.headers.host)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'" });
      return res.end(phone.pairPage());
    }
    if (pathname.startsWith('/api/')) {
      guard(req, pathname);
      // Any CLI or hook call from a session you opened counts as that team being at work (AIG-107).
      const where = req.headers['x-aigile-where'], pm = pathname.match(/^\/api\/projects\/([^/]+)/);
      if (pm && (where === 'vscode' || where === 'terminal')) heard(pm[1], where);
      if (req.aigileSealed) return send(res, 200, await runSealed(req, await readBody(req, 15e6)));   // AII-18
      for (const [method, re, fn] of routes) {
        const m = pathname.match(re);
        if (m && method === req.method) {
          // Attachment uploads are base64 files up to 10 MB, so they get a bigger body limit; opening a project file (AIG-446) up to 20 MB of them.
          const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req, pathname === '/api/projects/import' ? 40e6 : (pathname.endsWith('/attachments') || /^\/api\/dms\/contacts\/[^/]+\/messages$/.test(pathname)) ? 15e6 : /\/((app-)?logo|me-picture)$/.test(pathname) ? 2e6 : 1e6) : {};
          if (req.aigilePhone) phone.deniedBody(body);   // a phone sets no command for a team to run (AIG-868)
          const out = await fn(m.slice(1), body, url.searchParams, req);   // DM routes talk to the relay, so they may be async; req: who is asking (share.ownerOnly)
          // A route can answer with a file instead of JSON: { __file: absolute path }.
          if (out && out.__cookie) { res.setHeader('Set-Cookie', out.__cookie); delete out.__cookie; }   // the phone's device key (AIG-868)
          if (out && out.__sse) return out.__sse(res, req);   // a live stream (the terminal, AIG-471): the route writes it
          if (out && out.__html) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }); return res.end(out.__html); }   // a small page for a browser landing here (the Google sign-in callback, AIG-910)
          if (out && out.__svg) { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" }); return res.end(out.__svg); }
          if (out && out.__file) {
            // download: a friend's attachment (AIG-306), always saved, never shown or run by the browser.
            if (out.download) return streamFile(out.__file, res, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${String(out.download).replace(/[^\w.\- ]/g, '_')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" });
            // Pictures and files are cached by the browser (AIG-1090): an ETag from size + mtime, 304 on If-None-Match; attachment ids never change.
            const st = await fs.promises.stat(out.__file).catch(() => null);
            const etag = st ? `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"` : '';
            const immutable = /^\/api\/projects\/[^/]+\/attachments\/[^/]+$/.test(pathname);
            const cache = { 'Cache-Control': immutable ? 'private, max-age=31536000, immutable' : 'private, max-age=86400', ...(etag ? { ETag: etag } : {}) };
            if (etag && (req.headers['if-none-match'] || '').split(',').some(x => x.trim().replace(/^W\//, '') === etag)) { res.writeHead(304, { ...cache, 'X-Content-Type-Options': 'nosniff' }); return res.end(); }
            return streamFile(out.__file, res, { 'Content-Type': ATTACH_MIME[path.extname(out.__file).toLowerCase()] || 'application/octet-stream', ...cache, 'X-Content-Type-Options': 'nosniff', ...(out.__file.toLowerCase().endsWith('.svg') ? { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}) });
          }
          return send(res, 200, out);
        }
      }
      throw bad('no such endpoint: ' + req.method + ' ' + pathname, 404);
    }
    // Static files from public/ (single-page app: unknown paths get index.html)
    let file = path.normalize(path.join(PUBLIC, pathname));
    if (!file.startsWith(PUBLIC)) throw bad('nope', 403);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    if (conflicted(file, fs.statSync(file))) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '2', 'Cache-Control': 'no-store' }); return res.end('mid-update: try again in a moment'); }
    streamFile(file, res, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
  } catch (e) {
    send(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message });
  }
});

// The port goes in a file next to the data (AIG-252), so the teams' commands find a board that isn't on 4321.
metadataReady.finally(() => server.listen(PORT, HOST, () => { console.log(`AI-gile running at http://localhost:${PORT}`); try { fs.writeFileSync(path.join(DATA, 'board.port'), String(PORT)); } catch {} require('./lib/phonetunnel').start(PORT); }));   // 🔌 the phone tunnel, only when Setup saved one (AIG-1008)
// Private DMs: collect this board's relay mailbox every few seconds while DMs are on (lib/dm.js).
require('./lib/dm').startDms();
require('./lib/timed').start();   // timed cards come back (AIG-385)
require('./lib/major').start();   // 🚨 a status line every 30 min while a major incident is open (AIG-1049)
require('./lib/join').applyInvite().catch(() => {});   // a friend's first start: invite.json from the zip (AIG-347)
if (!process.env.AIGILE_NO_USAGE_AUTO) require('./lib/usagecheck').startAuto();
require('./lib/watchman').startWatchman(() => stale());   // 🌙 only does anything while you are going quiet (AIG-199)
require('./lib/scrummaster').startScrumMaster();   // 🧭 day rounds, only when it is in the team (AIG-359)
require('./lib/discord').start();   // 💬 only does anything once a bot is set up (AIG-481)
require('./lib/twitch').start();   // 🟣 only does anything once a Twitch channel is set (AIG-628)
require('./lib/feedback').start();   // 💬 pulls website visitors' reports for public boards with feedback on (AIG-969)
require('./lib/bugreports').start();   // 🐞 files Live testers' reports, only with feedback.project set (AIG-561)
require('./lib/serverhealth').start();   // 🩺 warns when Smizflark Server 2.0 needs upgrading (AIG-660)
require('./lib/uptime').start();   // 🟢 uptime checks of service projects open incidents (AIG-1047)
require('./lib/budget').startNightWatch();   // a run past its team's nightly token budget is stopped (AIG-522)
require('./lib/streamer').start();   // 🎥 streamer mode turns itself on when OBS or Streamlabs runs (AIG-592)
require('./lib/discord-presence').start();   // 🎮 Discord shows "Using AI-gile" as your activity, if switched on (AIG-642)
require('./lib/notokens').start();   // ⛔ No Token Mode turns itself on at the usage limit (AIG-338)
