// Small copies of pictures (AIG-1101). The page shrinks an image in the browser (canvas) before upload and sends the
// thumbnail beside the original; nothing here decodes images, so there is no native dependency. A picture without one is
// served as the original. The page asks for the small copy with ?thumb=1.
const fs = require('fs');
const path = require('path');

const MAX = 300 * 1024;
const TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const isPng = b => b.length > 8 && b.readUInt32BE(0) === 0x89504e47;
const isJpg = b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isWebp = b => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
// { thumb: base64, thumbType } from an upload body -> { buf, ext }, or null when absent or not a small png/jpeg/webp.
function parse(b) {
  const ext = TYPES[String(b && b.thumbType || '')];
  if (!ext || !b.thumb) return null;
  const buf = Buffer.from(String(b.thumb), 'base64');
  if (!buf.length || buf.length > MAX) return null;
  if (!(ext === '.png' ? isPng(buf) : ext === '.jpg' ? isJpg(buf) : isWebp(buf))) return null;
  return { buf, ext };
}
// The thumbnail of dir/name (stored as dir/thumbs/<stem>.<ext>), or null.
function find(dir, stem) {
  for (const ext of Object.values(TYPES)) { const f = path.join(dir, 'thumbs', stem + ext); if (fs.existsSync(f)) return f; }
  return null;
}
function remove(dir, stem) { for (const ext of Object.values(TYPES)) { try { fs.unlinkSync(path.join(dir, 'thumbs', stem + ext)); } catch {} } }
function save(dir, stem, t) {
  remove(dir, stem); if (!t) return;
  fs.mkdirSync(path.join(dir, 'thumbs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'thumbs', stem + t.ext), t.buf);
}
module.exports = { parse, find, save, remove };
