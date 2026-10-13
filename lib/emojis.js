// Custom emojis (AIG-648): your own picture + :name:, kept on this PC only in data/emojis/<name>.<ext> with an index.json.
// The page shrinks the picture to 64x64 first; the server still refuses anything over 32 KB or that is not a real image.
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');

const MAX = 32 * 1024;
const dir = () => path.join(DATA, 'emojis');
const indexFile = () => path.join(dir(), 'index.json');

function readIndex() {
  try { const j = JSON.parse(fs.readFileSync(indexFile(), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; }
}
function writeIndex(ix) {
  fs.mkdirSync(dir(), { recursive: true });
  const tmp = indexFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ix, null, 2));
  fs.renameSync(tmp, indexFile());
}
// The real type from the first bytes, so a renamed text file is not stored as a picture.
function sniff(b) {
  if (b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (b.length > 6 && /^GIF8[79]a$/.test(b.slice(0, 6).toString('latin1'))) return '.gif';
  if (b.length > 12 && b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  return '';
}
const list = () => Object.entries(readIndex()).map(([name, e]) => ({ name, ext: e.ext, url: `/api/emojis/${name}?v=${e.at}` })).sort((a, b) => a.name.localeCompare(b.name));

// { name, data: base64 }
function add(b) {
  b = b || {};
  const name = String(b.name || '').trim().replace(/^:|:$/g, '');
  if (!/^[a-z0-9_]{1,32}$/.test(name)) throw bad('the name can use lowercase letters, digits and _ (up to 32)');
  const ix = readIndex();
  if (ix[name]) throw bad(`:${name}: is already one of yours`, 409);
  const buf = Buffer.from(String(b.data || ''), 'base64');
  if (!buf.length) throw bad('the file is empty');
  if (buf.length > MAX) throw bad('the picture is still over 32 KB after shrinking; try a simpler one');
  const ext = sniff(buf);
  if (!ext) throw bad('the picture must be a png, gif, webp or jpg file');
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), name + ext), buf);
  ix[name] = { ext, at: Date.now() };
  writeIndex(ix);
  return list();
}
function remove(name) {
  const ix = readIndex(), e = ix[name];
  if (!e) throw bad('no such emoji', 404);
  try { fs.unlinkSync(path.join(dir(), name + e.ext)); } catch {}
  delete ix[name];
  writeIndex(ix);
  return list();
}
function fileOf(name) {
  const e = /^[a-z0-9_]{1,32}$/.test(name) && readIndex()[name];
  return e ? path.join(dir(), name + e.ext) : null;
}
module.exports = { list, add, remove, fileOf, MAX };
