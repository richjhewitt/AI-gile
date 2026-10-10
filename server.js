// AI-gile: tiny local board for Rich + the AI dev teams.
// Zero dependencies. Data lives in data/<slug>.json (one file per project).
// Run: node server.js   ->   http://localhost:4321
// This file is the http plumbing and the wiring; the logic lives in lib/ (see docs/CODEMAP.md).
const http = require('http');
const fs = require('fs');
const path = require('path');

const { PORT, HOST, DATA, PUBLIC, bad } = require('./lib/store');
const makeRoutes = require('./lib/routes');

fs.mkdirSync(DATA, { recursive: true });

/* ---------- dev build id ---------- */
// Development flag: open pages show a "new version, refresh" prompt after each build.
// A build = a server restart or a change to the page, so the id is start time + page mtime.
const DEV = /^(1|true|yes)$/i.test(process.env.AIGILE_DEV || '');
const STARTED = Date.now();
const pageFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pageFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const build = () => STARTED + '-' + Math.max(...pageFiles(PUBLIC).map(f => fs.statSync(f).mtimeMs));

const routes = makeRoutes(() => ({ dev: DEV, build: build() }));

/* ---------- http plumbing ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!s) return resolve({});
      try { resolve(JSON.parse(s)); } catch { reject(bad('body must be JSON')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) {
      for (const [method, re, fn] of routes) {
        const m = pathname.match(re);
        if (m && method === req.method) {
          const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
          return send(res, 200, fn(m.slice(1), body, url.searchParams));
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

server.listen(PORT, HOST, () => console.log(`AI-gile running at http://localhost:${PORT}`));
