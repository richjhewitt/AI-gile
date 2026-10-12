// App icon colours (AIG-400): the main colour and the waiting diamond. One shape list (the board in bars, 256 x 256)
// is drawn two ways: as svg (the page's favicon) and as png (the desktop app's window icon, no image library: the
// shapes are rasterised here and packed with zlib). Saved to data/appicon/ when the colours are set in Setup.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DATA, bad } = require('./store');

const DEFAULTS = { main: '#3b6cf6', waiting: '#a855f7' };
const dir = path.join(DATA, 'appicon');
const HEX = /^#[0-9a-f]{6}$/i;
const lum = c => (0.299 * parseInt(c.slice(1, 3), 16) + 0.587 * parseInt(c.slice(3, 5), 16) + 0.114 * parseInt(c.slice(5, 7), 16)) / 255;

// Validates what the page sends: { main, waiting } hex colours, or null / {} to go back to the defaults.
function check(v) {
  if (!v || !Object.keys(v).length) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw bad('iconColors must be { main, waiting }');
  const out = {};
  for (const k of ['main', 'waiting']) {
    const c = String(v[k] || DEFAULTS[k]).trim().toLowerCase();
    if (!HEX.test(c)) throw bad(`iconColors.${k} must be a colour like #3b6cf6`);
    out[k] = c;
  }
  return out;
}
const colours = c => ({ ...DEFAULTS, ...(c || {}) });

// Shapes in a 256 box: the tile (rounded square), the three bars, and for the waiting icon the tile shrinks to
// leave room for the diamond in the top right corner (same layout as the old icon-waiting.png).
function shapes(c, waiting) {
  const { main, waiting: dia } = colours(c), bars = lum(main) > 0.75 ? '#1f2937' : '#ffffff';
  const k = waiting ? 0.863 : 1, ox = 0, oy = waiting ? 35 : 0;
  const X = v => ox + v * k, Y = v => oy + v * k;
  const out = [{ t: 'rr', x: X(0), y: Y(0), w: 256 * k, h: 256 * k, r: 32 * k, c: main }];
  for (const [x, y, w, h] of [[44, 60, 49, 137], [104, 60, 49, 101], [164, 60, 49, 65]]) out.push({ t: 'rr', x: X(x), y: Y(y), w: w * k, h: h * k, r: 3, c: bars });
  if (waiting) out.push({ t: 'dia', x: 212, y: 45, r: 44, c: dia });
  return out;
}
function svg(c, waiting) {
  const f = s => +s.toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${shapes(c, waiting).map(s => s.t === 'rr'
    ? `<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}" rx="${f(s.r)}" fill="${s.c}"/>`
    : `<path d="M${s.x} ${s.y - s.r}L${s.x + s.r} ${s.y}L${s.x} ${s.y + s.r}L${s.x - s.r} ${s.y}Z" fill="${s.c}"/>`).join('')}</svg>`;
}

const inside = (s, x, y) => {
  if (s.t === 'dia') return Math.abs(x - s.x) + Math.abs(y - s.y) <= s.r;
  if (x < s.x || y < s.y || x > s.x + s.w || y > s.y + s.h) return false;
  const dx = Math.max(s.x + s.r - x, x - (s.x + s.w - s.r), 0), dy = Math.max(s.y + s.r - y, y - (s.y + s.h - s.r), 0);
  return dx * dx + dy * dy <= s.r * s.r;
};
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
// 256 x 256 RGBA png, 3 x 3 samples per pixel for soft edges.
function png(c, waiting) {
  const list = shapes(c, waiting).reverse(), N = 256, S = 3, raw = Buffer.alloc(N * (N * 4 + 1));   // reversed: the top shape is tested first
  const rgb = list.map(s => [1, 3, 5].map(i => parseInt(s.c.slice(i, i + 2), 16)));
  for (let y = 0; y < N; y++) {
    raw[y * (N * 4 + 1)] = 0;
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const k = list.findIndex(s => inside(s, x + (i + 0.5) / S, y + (j + 0.5) / S));
        if (k >= 0) { r += rgb[k][0]; g += rgb[k][1]; b += rgb[k][2]; n++; }
      }
      const o = y * (N * 4 + 1) + 1 + x * 4;
      if (n) { raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n); raw[o + 3] = Math.round(255 * n / (S * S)); }
    }
  }
  const head = Buffer.alloc(13); head.writeUInt32BE(N, 0); head.writeUInt32BE(N, 4); head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Writes (or, for no colours, removes) the files the page and the desktop app read.
function write(c) {
  if (!c) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} return; }
  fs.mkdirSync(dir, { recursive: true });
  for (const w of [false, true]) {
    const n = w ? 'icon-waiting' : 'icon';
    fs.writeFileSync(path.join(dir, n + '.svg'), svg(c, w));
    fs.writeFileSync(path.join(dir, n + '.png'), png(c, w));
  }
}
const file = waiting => { const f = path.join(dir, waiting ? 'icon-waiting.svg' : 'icon.svg'); return fs.existsSync(f) ? f : null; };

module.exports = { DEFAULTS, check, colours, write, file, svg, png };
