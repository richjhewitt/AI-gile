// Keep page assets in index.html's order, with one request per kind on a cold phone.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..', 'public');
let cached;
module.exports = function pageBundle(req, res, bundle) {
  const index = path.join(root, 'index.html'), html = fs.readFileSync(index, 'utf8');
  const scripts = [...html.matchAll(/<script src="(js\/[^"?]+\.js)"><\/script>/g)];
  const styles = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+\.css)">/g)];
  const files = [index, ...scripts.map(m => path.join(root, m[1])), ...styles.map(m => path.join(root, m[1]))];
  const tag = files.map(f => { const s = fs.statSync(f); return s.size + ':' + s.mtimeMs; }).join('|');
  if (!cached || cached.tag !== tag) {
    const parts = files.slice(1).map(f => fs.readFileSync(f, 'utf8'));
    if ([html, ...parts].some(s => /^(<<<<<<<|>>>>>>>) /m.test(s))) {
      res.writeHead(503, { 'Retry-After': '2', 'Cache-Control': 'no-store' }); res.end('mid-update: try again in a moment'); return;
    }
    const js = parts.slice(0, scripts.length).join('\n;\n'), css = parts.slice(scripts.length).join('\n');
    const page = html.replace(/<script src="js\/[^"?]+\.js"><\/script>/g, (m, offset) => offset === scripts[0].index ? '<script src="/js/board-bundle.js"></script>' : '')
      .replace(/<link rel="stylesheet" href="css\/[^"?]+\.css">/g, (m, offset) => offset === styles[0].index ? '<link rel="stylesheet" href="/css/board-bundle.css">' : '');
    cached = { tag, js: Buffer.from(js), css: Buffer.from(css), page: Buffer.from(page), gzip: zlib.gzipSync(js), cssGzip: zlib.gzipSync(css), pageGzip: zlib.gzipSync(page), etag: '"' + require('crypto').createHash('sha256').update(tag).digest('hex').slice(0, 24) + '"' };
  }
  const head = { 'Content-Type': (bundle === 'css' ? 'text/css' : bundle ? 'application/javascript' : 'text/html') + '; charset=utf-8', 'Cache-Control': 'no-cache', ETag: cached.etag, Vary: 'Accept-Encoding' };
  if (String(req.headers['if-none-match'] || '').split(',').some(t => t.trim().replace(/^W\//, '') === cached.etag)) { res.writeHead(304, head); res.end(); return; }
  const gzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
  res.writeHead(200, { ...head, ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(bundle === 'css' ? (gzip ? cached.cssGzip : cached.css) : bundle ? (gzip ? cached.gzip : cached.js) : (gzip ? cached.pageGzip : cached.page));
};
