// Project pictures and the app logo (AIG-175): one image per key in data/logos/<key>.<ext>.
// The key is a project slug, or "_app" for the board's own logo. Max 1 MB; png, jpg, svg, ico, webp.
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');

const MAX = 1024 * 1024;
const EXT = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'];
const MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/svg+xml': '.svg', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'image/webp': '.webp' };
const dir = path.join(DATA, 'logos');
const withDir = () => { fs.mkdirSync(dir, { recursive: true }); return dir; };

// The stored file for a key, or null.
function logoFile(key) {
  let names; try { names = fs.readdirSync(dir); } catch { return null; }
  const n = names.find(f => EXT.includes(path.extname(f).toLowerCase()) && f.slice(0, -path.extname(f).length) === key);
  return n ? path.join(dir, n) : null;
}
function removeLogo(key) {
  for (const ext of EXT) { try { fs.unlinkSync(path.join(dir, key + ext)); } catch {} }
}
// Upload { name, type, data: base64 } or a typed local path { path }. Returns the stored extension.
function saveLogo(key, b) {
  b = b || {};
  let buf, ext;
  if (b.path) {
    const p = String(b.path).trim().replace(/^["']|["']$/g, '');
    if (/[%"$`]/.test(p)) throw bad('that path has characters I will not follow (% " $ `)');
    if (!path.isAbsolute(p)) throw bad('give the full path of the image, e.g. C:/Projects/my-app/logo.png');
    ext = path.extname(p).toLowerCase();
    if (!EXT.includes(ext)) throw bad('the picture must be a png, jpg, svg, ico or webp file');
    let st; try { st = fs.statSync(p); } catch { throw bad('no such file: ' + p); }
    if (!st.isFile()) throw bad('that is not a file');
    if (st.size > MAX) throw bad('the picture can be up to 1 MB');
    buf = fs.readFileSync(p);
  } else {
    buf = Buffer.from(String(b.data || ''), 'base64');
    ext = path.extname(String(b.name || '')).toLowerCase() || MIME[String(b.type || '')] || '';
    if (!EXT.includes(ext)) throw bad('the picture must be a png, jpg, svg, ico or webp file');
  }
  if (!buf.length) throw bad('the file is empty');
  if (buf.length > MAX) throw bad('the picture can be up to 1 MB');
  withDir(); removeLogo(key);
  fs.writeFileSync(path.join(dir, key + ext), buf);
  return ext;
}
// The URL the page loads; the number changes with the file so a new picture is not shown from cache.
const urlFor = (key, base) => { const f = logoFile(key); return f ? base + '?v=' + Math.round(fs.statSync(f).mtimeMs) : ''; };

module.exports = { saveLogo, removeLogo, logoFile, urlFor, MAX };
