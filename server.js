// AI-gile: tiny local board for the owner + the AI dev teams.
// Zero dependencies (node-pty is optional, for the built-in terminal: lib/terminal.js). Data lives in data/<slug>.json (one file per project).
// Run: node server.js   ->   http://localhost:4321
// This file is the http plumbing and the wiring; the logic lives in lib/ (see docs/CODEMAP.md).
const http = require('http');
const fs = require('fs');
const path = require('path');

const { PORT, HOST, DATA, PUBLIC, bad, localSettings } = require('./lib/store');
const makeRoutes = require('./lib/routes');
const { heard } = require('./lib/presence');

fs.mkdirSync(DATA, { recursive: true });

/* ---------- dev build id ---------- */
// Development flag: open pages show a "new version, refresh" prompt after each build.
// A build = a server restart or a change to the page, so the id is start time + page mtime.
// On for whoever builds AI-gile ("dev": true in aigile.local.json, or AIGILE_DEV=1), off for friends (AIG-253).
const DEV = /^(1|true|yes)$/i.test(process.env.AIGILE_DEV || '') || localSettings().dev === true;
const STARTED = Date.now();
const pageFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pageFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const build = () => STARTED + '-' + Math.max(...pageFiles(PUBLIC).map(f => fs.statSync(f).mtimeMs));

// Server code newer than this running server (AIG-206): the page offers 🔄 Restart the board instead of failing on new routes.
const libFiles = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? libFiles(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
const serverFiles = () => [path.join(__dirname, 'server.js'), ...libFiles(path.join(__dirname, 'lib'))];
const stale = () => { try { return Math.max(...serverFiles().map(f => fs.statSync(f).mtimeMs)) > STARTED; } catch { return false; } };

const routes = makeRoutes(() => ({ dev: DEV, build: build(), stale: stale() }));

/* ---------- http plumbing ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// Only this computer's own board, CLI and hooks may use the API (AIG-90). The server already listens on
// 127.0.0.1, but a website open in the same browser could still send requests to it:
// - Host must be localhost/127.0.0.1 (stops DNS rebinding: a site pointing its own name at this port)
// - changes must come from the board's own page if a browser sends them (Origin), and as JSON, which a
//   plain cross-site form or beacon can't send without a preflight that this server never allows.
const LOCAL = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
function guard(req) {
  if (!LOCAL.has(String(req.headers.host || '').toLowerCase())) throw bad('wrong host', 403);
  if (req.method === 'GET') return;
  const origin = req.headers.origin;
  if (origin && !LOCAL.has(origin.replace(/^http:\/\//, '').toLowerCase())) throw bad('requests from other sites are not allowed', 403);
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw bad('send JSON (Content-Type: application/json)', 415);
}

// Attachments show inline only for these types; anything else downloads.
const ATTACH_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8' };

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req, max = 1e6) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > max) req.destroy(); });
    req.on('end', () => {
      if (!s) return resolve({});
      try { resolve(JSON.parse(s)); } catch { reject(bad('body must be JSON')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }   // a bad %-code no longer stops the board (AIG-150)
  try {
    if (pathname.startsWith('/api/')) {
      guard(req);
      // Any CLI or hook call from a session you opened counts as that team being at work (AIG-107).
      const where = req.headers['x-aigile-where'], pm = pathname.match(/^\/api\/projects\/([^/]+)/);
      if (pm && (where === 'vscode' || where === 'terminal')) heard(pm[1], where);
      for (const [method, re, fn] of routes) {
        const m = pathname.match(re);
        if (m && method === req.method) {
          // Attachment uploads are base64 files up to 10 MB, so they get a bigger body limit.
          const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req, (pathname.endsWith('/attachments') || /^\/api\/dms\/contacts\/[^/]+\/messages$/.test(pathname)) ? 15e6 : /\/((app-)?logo|me-picture)$/.test(pathname) ? 2e6 : 1e6) : {};
          const out = await fn(m.slice(1), body, url.searchParams, req);   // DM routes talk to the relay, so they may be async; req: who is asking (share.ownerOnly)
          // A route can answer with a file instead of JSON: { __file: absolute path }.
          if (out && out.__sse) return out.__sse(res, req);   // a live stream (the terminal, AIG-471): the route writes it
          if (out && out.__svg) { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" }); return res.end(out.__svg); }
          if (out && out.__file) {
            // download: a friend's attachment (AIG-306), always saved, never shown or run by the browser.
            if (out.download) { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${String(out.download).replace(/[^\w.\- ]/g, '_')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" }); return fs.createReadStream(out.__file).pipe(res); }
            res.writeHead(200, { 'Content-Type': ATTACH_MIME[path.extname(out.__file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(out.__file.toLowerCase().endsWith('.svg') ? { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}) });   // an svg opened on its own runs no script (AIG-175)
            return fs.createReadStream(out.__file).pipe(res);
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
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message });
  }
});

// The port goes in a file next to the data (AIG-252), so the teams' commands find a board that isn't on 4321.
server.listen(PORT, HOST, () => { console.log(`AI-gile running at http://localhost:${PORT}`); try { fs.writeFileSync(path.join(DATA, 'board.port'), String(PORT)); } catch {} });
// Private DMs: collect this board's relay mailbox every few seconds while DMs are on (lib/dm.js).
require('./lib/dm').startDms();
require('./lib/timed').start();   // timed cards come back (AIG-385)
require('./lib/join').applyInvite().catch(() => {});   // a friend's first start: invite.json from the zip (AIG-347)
if (!process.env.AIGILE_NO_USAGE_AUTO) require('./lib/usagecheck').startAuto();
require('./lib/watchman').startWatchman(() => stale());   // 🌙 only does anything while you are going quiet (AIG-199)
require('./lib/scrummaster').startScrumMaster();   // 🧭 day rounds, only when it is in the team (AIG-359)
require('./lib/discord').start();   // 💬 only does anything once a bot is set up (AIG-481)
require('./lib/notokens').start();   // ⛔ No Token Mode turns itself on at the usage limit (AIG-338)
