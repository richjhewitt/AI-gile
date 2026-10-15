// QA area: speed (AIG-1193). Page files go out gzipped with an ETag (a repeat load answers 304), and an idle page downloads little per tick.
import zlib from 'node:zlib';
import http from 'node:http';
import { def, check, sleep, mkProject, mkCard, openPage, BASE } from '../lib.mjs';

def('pagespeed', 'page files are gzipped with an ETag and answer 304; an idle board page polls under 40 KB in 6 s (AIG-1193)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  for (let i = 0; i < 30; i++) await mkCard(s, 'alpha', 'Card ' + i, { description: 'text '.repeat(40) });
  const getRaw = (url, headers) => new Promise((res, rej) => http.get(url, { headers }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(c) })); }).on('error', rej));   // node's fetch would unpack the gzip for us
  const raw = await getRaw(BASE + '/js/core.js', { 'Accept-Encoding': 'identity' }), rawLen = raw.body.length;
  const gz = await getRaw(BASE + '/js/core.js', { 'Accept-Encoding': 'gzip' }), gzBuf = gz.body;
  check('a script is sent gzipped, much smaller than the file', gz.headers['content-encoding'] === 'gzip' && gzBuf.length < rawLen / 2, [gz.headers['content-encoding'], gzBuf.length, rawLen]);
  check('the gzip body unpacks to the same bytes', zlib.gunzipSync(gzBuf).equals(raw.body));
  const etag = gz.headers.etag;
  check('it carries an ETag and is revalidated, not stored blind', !!etag && /no-cache/.test(gz.headers['cache-control'] || ''), [etag, gz.headers['cache-control']]);
  const again = await fetch(BASE + '/js/core.js', { headers: { 'If-None-Match': etag, 'Accept-Encoding': 'gzip' } });
  check('a repeat request with the ETag answers 304 and no body', again.status === 304 && (await again.arrayBuffer()).byteLength === 0, again.status);
  const sw = await fetch(BASE + '/sw.js');
  check('the service worker file stays no-store', /no-store/.test(sw.headers.get('cache-control') || ''));

  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.card');
  let bytes = 0;
  page.on('response', async r => { try { if (r.url().includes('/api/')) bytes += (await r.body()).length; } catch {} });
  await sleep(2500); bytes = 0; await sleep(6000);
  check('an idle project page downloads under 40 KB in 6 s', bytes < 40000, bytes);
  await page.close();
}, true);
