// Pure helpers for the desktop app's window (AIG-1272, AIG-1273, AIG-1274); no Electron in here, so node can test them.

// AIG-1272: saved window bounds, made safe. Never smaller than a usable size, never bigger than the screen it lands on,
// and if too little of it would show on any connected screen (a monitor was unplugged) it drops the position (the app centres it).
const MIN_W = 600, MIN_H = 400;
function clampBounds(saved, workAreas) {
  if (!saved || !workAreas || !workAreas.length) return null;
  const n = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null);
  let w = n(saved.width), h = n(saved.height); if (w == null || h == null) return null;
  const x = n(saved.x), y = n(saved.y);
  w = Math.max(MIN_W, w); h = Math.max(MIN_H, h);
  const overlap = (len, lo, hi, at) => Math.max(0, Math.min(at + len, hi) - Math.max(at, lo));
  if (x != null && y != null) {
    let best = null, bestArea = 0;
    for (const d of workAreas) {
      const a = overlap(w, d.x, d.x + d.width, x) * overlap(h, d.y, d.y + d.height, y);
      if (a > bestArea) { bestArea = a; best = d; }
    }
    // the title bar has to be reachable: at least 100 px across and 40 px down on a screen
    const ox = best ? overlap(w, best.x, best.x + best.width, x) : 0, oy = best ? overlap(h, best.y, best.y + best.height, y) : 0;
    if (best && ox >= 100 && oy >= 40 && y >= best.y - 10) {
      w = Math.min(w, best.width); h = Math.min(h, best.height);
      return { x: Math.min(Math.max(x, best.x - (w - 100)), best.x + best.width - 100), y: Math.min(Math.max(y, best.y), best.y + best.height - 40), width: w, height: h };
    }
  }
  const p = workAreas[0];
  return { width: Math.min(w, p.width), height: Math.min(h, p.height) };
}

// AIG-1273: the window's colour before the page paints, from the saved theme pick (or the system's) so dark mode never flashes white.
function pickBackground(theme, systemDark) {
  if (theme === 'black') return '#000000';
  if (theme === 'dark') return '#12151b';
  if (theme === 'light') return '#f6f7f9';
  return systemDark ? '#12151b' : '#f6f7f9';
}
const THEMES = ['system', 'light', 'dark', 'black'];

// AIG-1274: the count for the taskbar: a whole number, 0 to 999, anything else is none.
function badgeCount(n) { n = Math.floor(Number(n)); return isFinite(n) && n > 0 ? Math.min(n, 999) : 0; }
const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111', '+': '000010111010000' };
// A 32x32 BGRA bitmap for the Windows overlay icon: a red disc with the count in white ("99+" past 99).
function badgeBitmap(n) {
  n = badgeCount(n); if (!n) return null;
  const S = 32, buf = Buffer.alloc(S * S * 4), put = (x, y, r, g, b) => { const i = (y * S + x) * 4; buf[i] = b; buf[i + 1] = g; buf[i + 2] = r; buf[i + 3] = 255; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x - 15.5) ** 2 + (y - 15.5) ** 2 <= 15.5 ** 2) put(x, y, 0xd9, 0x2d, 0x20);
  const text = n > 99 ? '99+' : String(n), sc = text.length === 1 ? 4 : text.length === 2 ? 3 : 2;   // pixel size of each font dot
  const gap = sc, width = text.length * 3 * sc + (text.length - 1) * gap, h = 5 * sc;
  let ox = Math.round((S - width) / 2); const oy = Math.round((S - h) / 2);
  for (const ch of text) {
    const g = FONT[ch];
    for (let i = 0; i < 15; i++) if (g[i] === '1') { const gx = ox + (i % 3) * sc, gy = oy + Math.floor(i / 3) * sc; for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) put(gx + dx, gy + dy, 255, 255, 255); }
    ox += 3 * sc + gap;
  }
  return { buffer: buf, width: S, height: S };
}
module.exports = { clampBounds, pickBackground, THEMES, badgeCount, badgeBitmap, MIN_W, MIN_H };
