// AIG-1272/1273/1274: the desktop app's pure window helpers (no Electron needed).
const assert = require('assert'), { clampBounds, pickBackground, badgeCount, badgeBitmap } = require('../../desktop/winstate.js');
const one = [{ x: 0, y: 0, width: 1920, height: 1040 }], two = [one[0], { x: 1920, y: 0, width: 1280, height: 1000 }];
assert.deepStrictEqual(clampBounds({ x: 100, y: 80, width: 1000, height: 700 }, one), { x: 100, y: 80, width: 1000, height: 700 });
assert.deepStrictEqual(clampBounds({ x: 2000, y: 50, width: 1000, height: 700 }, two), { x: 2000, y: 50, width: 1000, height: 700 });
// second screen unplugged: position dropped, size kept
assert.deepStrictEqual(clampBounds({ x: 2000, y: 50, width: 1000, height: 700 }, one), { width: 1000, height: 700 });
assert.deepStrictEqual(clampBounds({ x: 100, y: 5000, width: 1000, height: 700 }, one), { width: 1000, height: 700 });
// too big and too small
assert.deepStrictEqual(clampBounds({ x: 0, y: 0, width: 5000, height: 4000 }, one), { x: 0, y: 0, width: 1920, height: 1040 });
assert.deepStrictEqual(clampBounds({ x: 10, y: 10, width: 50, height: 50 }, one), { x: 10, y: 10, width: 600, height: 400 });
// mostly off the left edge but the title bar is still reachable
assert.strictEqual(clampBounds({ x: -900, y: 10, width: 1000, height: 700 }, one).x, -900);
assert.deepStrictEqual(clampBounds({ x: -950, y: 10, width: 1000, height: 700 }, one), { width: 1000, height: 700 });
// rubbish in, nothing out
for (const bad of [null, {}, { width: 'a', height: 5 }, { x: NaN, y: 1, width: 800, height: NaN }]) assert.strictEqual(clampBounds(bad, one), null);
assert.strictEqual(clampBounds({ width: 800, height: 600 }, []), null);
assert.deepStrictEqual(clampBounds({ width: 800, height: 600 }, one), { width: 800, height: 600 });
assert.strictEqual(pickBackground('dark', false), '#12151b'); assert.strictEqual(pickBackground('black', false), '#000000');
assert.strictEqual(pickBackground('light', true), '#f6f7f9'); assert.strictEqual(pickBackground('system', true), '#12151b');
assert.strictEqual(pickBackground(undefined, false), '#f6f7f9');
// AIG-1353: quiet = night colours whatever the theme; the night glance window is always its own near-black
assert.strictEqual(pickBackground('black', false, true), '#0d0906'); assert.strictEqual(pickBackground('light', false, true), '#0d0906');
assert.strictEqual(pickBackground('light', false, false, 'http://localhost:4321/#/pop-night'), '#0b0605');
assert.strictEqual(pickBackground('dark', false, true, 'http://localhost:4321/#/pop/AIG-1'), '#0d0906');
assert.deepStrictEqual([0, -3, 'x', NaN, 4.7, 5000, '12'].map(badgeCount), [0, 0, 0, 0, 4, 999, 12]);
assert.strictEqual(badgeBitmap(0), null);
for (const n of [1, 7, 42, 100]) { const b = badgeBitmap(n); assert.strictEqual(b.buffer.length, 32 * 32 * 4); assert(b.buffer.some((v, i) => i % 4 === 3 && v === 255)); }
assert.notDeepStrictEqual(badgeBitmap(1).buffer, badgeBitmap(2).buffer);
console.log('winstate: passed');
