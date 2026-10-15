// QA area: thumbs (AIG-1101). Uploading a picture saves a small copy beside it (made in the page); the preview <img> uses it,
// the link opens the original; ?thumb=1 serves it with the same cache headers; a file without a copy still shows.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { check, until, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

// A w x h noisy png (so it is big enough that a small copy is clearly smaller).
function png(w, h) {
  const crc = b => { let c; const t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const b = Buffer.concat([Buffer.from(ty), d]), o = Buffer.alloc(4), c = Buffer.alloc(4); o.writeUInt32BE(d.length); c.writeUInt32BE(crc(b)); return Buffer.concat([o, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); let x = 12345; for (let i = 0; i < raw.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; raw[i] = i % (w * 3 + 1) === 0 ? 0 : (x >>> 3) & 255; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

def('thumbs', 'Pictures get a small copy on upload (attachments 320 px, logos 128 px); previews use it, links open the original; old files still show (AIG-1101)', async (s, ctx) => {
  const proj = await mkProject(s, 'Thumb Test', 'THM'); const slug = proj.slug || (proj.project && proj.project.slug);
  const card = await mkCard(s, slug, 'Pictures');
  const big = png(900, 600);

  // the page makes and sends the small copy
  const page = await openPage(ctx, '#/p/' + slug + '/' + card.id);
  await page.waitForSelector('.ctab', { timeout: 15000 });
  await page.click('.ctab[data-ctab=reply]');
  await page.waitForSelector('.reply input[type=file]', { state: 'attached' });
  await page.setInputFiles('.reply input[type=file]', { name: 'shot.png', mimeType: 'image/png', buffer: big });
  await page.fill('#r-text', 'a big screenshot');
  await page.click('.reply button.primary');
  const dir = path.join(s.data, 'attachments', slug);
  const att = await until(async () => { const c = (await s.ok('GET', `/api/projects/${slug}`)).cards.find(x => x.id === card.id); const m = (c.comments || []).find(x => x.attachments && x.attachments.length); return m && m.attachments[0]; }, 12000);
  check('the comment has the attachment', !!att, att);
  check('the attachment is flagged as having a thumbnail', att && att.thumb === true, att);
  const tf = fs.existsSync(path.join(dir, 'thumbs')) ? fs.readdirSync(path.join(dir, 'thumbs')).filter(f => f.startsWith(att.id)) : [];
  check('a thumbnail file was saved next to the original', tf.length === 1, tf);
  check('the thumbnail is much smaller than the original', tf.length === 1 && fs.statSync(path.join(dir, 'thumbs', tf[0])).size < big.length / 2);
  const u = `/api/projects/${slug}/attachments/${encodeURIComponent(att.id)}`;
  const o = await fetch(s.base + u), th = await fetch(s.base + u + '?thumb=1');
  check('the original is served whole', o.status === 200 && (await o.arrayBuffer()).byteLength === big.length);
  check('?thumb=1 serves the small copy', th.status === 200 && /image\/(webp|png|jpeg)/.test(th.headers.get('content-type')) && (await th.arrayBuffer()).byteLength === fs.statSync(path.join(dir, 'thumbs', tf[0])).size);
  check('the thumbnail is cached like the original', /immutable/.test(th.headers.get('cache-control') || '') && !!th.headers.get('etag'), th.headers.get('cache-control'));
  await page.close();
  const pg = await openPage(ctx, '#/p/' + slug + '/' + card.id);
  await pg.click('.ctab[data-ctab=reply]');
  await pg.waitForSelector('.att-shown a > img');
  check('the preview <img> points at the thumbnail', /\?thumb=1$/.test(await pg.getAttribute('.att-shown a > img', 'src')));
  check('the link opens the original', (await pg.getAttribute('.att-shown a', 'href')) === u);
  noErrors(pg); await pg.close();

  // an old file (no thumbnail) still shows from the original
  const old = await s.ok('POST', `/api/projects/${slug}/attachments`, { name: 'old.png', type: 'image/png', data: big.toString('base64') });
  check('an upload without a thumbnail has no flag', !old.thumb, old);
  const oc = await fetch(s.base + `/api/projects/${slug}/attachments/${encodeURIComponent(old.id)}?thumb=1`);
  check('?thumb=1 on a file without one falls back to the original', oc.status === 200 && (await oc.arrayBuffer()).byteLength === big.length);
  await s.ok('POST', `/api/projects/${slug}/cards/${card.id}/comments`, { author: 'Owner', text: 'old one', attachments: [{ id: old.id, type: 'image/png' }] });
  const p2 = await openPage(ctx, '#/p/' + slug + '/' + card.id);
  await p2.click('.ctab[data-ctab=reply]');
  const sel = '.att-shown a[href$="' + encodeURIComponent(old.id) + '"] > img';
  await p2.waitForSelector(sel);
  check('its preview uses the original', !/thumb=1/.test(await p2.getAttribute(sel, 'src')));
  await p2.locator(sel).scrollIntoViewIfNeeded();
  check('its image loads', await p2.waitForFunction(q => { const i = document.querySelector(q); return i && i.complete && i.naturalWidth > 0; }, sel, { timeout: 8000 }).then(() => true, () => false));
  await p2.close();

  // bad thumbnails are ignored, not trusted
  const bad = await s.ok('POST', `/api/projects/${slug}/attachments`, { name: 'x.png', type: 'image/png', data: big.toString('base64'), thumb: Buffer.from('not an image').toString('base64'), thumbType: 'image/png' });
  check('a thumbnail that is not an image is dropped', !bad.thumb, bad);

  // logos: a project picture with a small copy
  const small = png(128, 80), mid = png(500, 300);
  await s.ok('POST', `/api/projects/${slug}/logo`, { name: 'l.png', type: 'image/png', data: mid.toString('base64'), thumb: small.toString('base64'), thumbType: 'image/png' });
  const lp = (await s.ok('GET', `/api/projects/${slug}`)).logo;
  check('the project logo URL asks for the thumbnail', /thumb=1/.test(lp || ''), lp);
  const lt = await fetch(s.base + lp), lo = await fetch(s.base + lp.replace('&thumb=1', ''));
  check('the logo thumbnail is the small copy', (await lt.arrayBuffer()).byteLength === small.length);
  check('the logo original is still whole', (await lo.arrayBuffer()).byteLength === mid.length);
  check('a logo thumbnail is cached', /max-age/.test(lt.headers.get('cache-control') || ''));
  await s.ok('POST', `/api/projects/${slug}/logo`, { name: 'l2.png', type: 'image/png', data: small.toString('base64') });
  const lp2 = (await s.ok('GET', `/api/projects/${slug}`)).logo;
  check('a replaced logo without a thumbnail loses the old copy', !/thumb=1/.test(lp2 || ''), lp2);
}, true);
