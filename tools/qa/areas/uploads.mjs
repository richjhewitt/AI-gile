// QA area: uploads (AIG-1165). Resumable uploads in 1 MB pieces with a progress bar and Cancel (lib/uploads.js, public/js/attach.js):
// a missing piece is sent again and the file finishes; the size, the piece count and each piece are capped; Cancel drops the
// pieces; an upload is its starter's only; a project's files are refused to another project's team, a DM's to any team.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, mkProject, mkCard, getCard, openPage, def } from '../lib.mjs';

const MB = 1024 * 1024;
const bytes = n => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 7 + (i >> 11)) & 255; return b; };
const piece = (buf, n) => ({ data: buf.subarray(n * MB, Math.min(buf.length, (n + 1) * MB)).toString('base64') });
const as = (s, method, url, who, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'terminal', 'X-Aigile-As': who }, body: body === undefined ? undefined : JSON.stringify(body) });
const openUploads = s => { try { return fs.readdirSync(path.join(s.data, 'uploads')); } catch { return []; } };

def('uploads', 'resumable uploads: resume after a missing piece, caps, cancel, not for outsiders', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Forge', role: 'Lead' });
  await s.ok('POST', '/api/projects/beta/team', { name: 'Stranger', role: 'Lead' });
  const U = '/api/projects/alpha/uploads', file = bytes(2.5 * MB);

  // Resume after a missing piece: 0 and 2 arrive, done says 1 is missing, status lists what arrived, 1 is sent, done joins them.
  const st = await s.ok('POST', U, { name: '../../evil name?.bin', type: 'application/octet-stream', size: file.length });
  check('an upload starts with a board-picked id and 3 pieces', /^[0-9a-f]{32}$/.test(st.id) && st.chunks === 3 && st.chunk === MB && st.received.length === 0, st);
  await s.ok('POST', `${U}/${st.id}/0`, piece(file, 0));
  await s.ok('POST', `${U}/${st.id}/2`, piece(file, 2));
  const early = await s.api('POST', `${U}/${st.id}/done`, {});
  check('done with a piece missing is refused and names it', early.status === 409 && /pieces missing: 1$/.test(early.body.error || ''), early);
  const mid = await s.ok('GET', `${U}/${st.id}`);
  check('status says which pieces arrived (resume)', JSON.stringify(mid.received) === '[0,2]', mid);
  await s.ok('POST', `${U}/${st.id}/1`, piece(file, 1));
  const a = await s.ok('POST', `${U}/${st.id}/done`, {});
  check('the resumed file is an attachment of the right size', a.size === file.length && /^[a-z0-9]+-[\w.\- ]+$/i.test(a.id), a);
  check('its name is made safe and it sits in the project folder', !/[\\/?]/.test(a.name) && path.resolve(a.path).startsWith(path.resolve(s.data, 'attachments', 'alpha')), a);
  const got = Buffer.from(await (await fetch(s.base + '/api/projects/alpha/attachments/' + encodeURIComponent(a.id))).arrayBuffer());
  check('the joined file is byte for byte the original', got.equals(file), got.length);
  check('a finished upload leaves no pieces behind', !openUploads(s).includes(st.id), openUploads(s));

  // Caps: the whole file, each piece (too long, wrong size, out of range), and how many are open at once.
  check('a file over 10 MB is refused', (await s.api('POST', U, { name: 'big.bin', size: 10 * MB + 1 })).status === 413);
  check('an empty file is refused', (await s.api('POST', U, { name: 'e.bin', size: 0 })).status === 400);
  const c = await s.ok('POST', U, { name: 'c.bin', size: MB + 10 });
  check('a piece over 1 MB is refused', (await s.api('POST', `${U}/${c.id}/0`, { data: bytes(MB + 3).toString('base64') })).status === 413);
  check('a piece of the wrong size is refused', (await s.api('POST', `${U}/${c.id}/1`, { data: bytes(9).toString('base64') })).status === 400);
  check('a piece past the end is refused', (await s.api('POST', `${U}/${c.id}/2`, piece(bytes(10), 0))).status === 400);
  check('a made-up upload id is unknown', (await s.api('GET', `${U}/${'0'.repeat(32)}`)).status === 404);

  // Cancel cleans up: the folder goes and the id is gone.
  await s.ok('POST', `${U}/${c.id}/0`, piece(bytes(MB + 10), 0));
  check('pieces sit in data/uploads/<id> while it runs', fs.existsSync(path.join(s.data, 'uploads', c.id, '0.part')));
  await s.ok('DELETE', `${U}/${c.id}`);
  check('cancel removes the pieces', !fs.existsSync(path.join(s.data, 'uploads', c.id)));
  check('a cancelled upload is unknown', (await s.api('GET', `${U}/${c.id}`)).status === 404);

  // Outsiders: an upload is its starter's; a project's files are not for another project's team; a DM's are the owner's.
  const o = await s.ok('POST', U, { name: 'o.bin', size: 5 });
  check('someone else cannot see an upload', (await as(s, 'GET', `${U}/${o.id}`, 'Forge')).status === 404);
  check('someone else cannot add a piece to it', (await as(s, 'POST', `${U}/${o.id}/0`, 'Forge', piece(bytes(5), 0))).status === 404);
  check('someone else cannot cancel it', (await as(s, 'DELETE', `${U}/${o.id}`, 'Forge')).status === 404 && fs.existsSync(path.join(s.data, 'uploads', o.id)));
  await s.ok('DELETE', `${U}/${o.id}`);
  const fileUrl = '/api/projects/alpha/attachments/' + encodeURIComponent(a.id);
  check('another project\'s team is refused the file', (await as(s, 'GET', fileUrl, 'Stranger')).status === 403);
  check('the thumbnail is refused to them too', (await as(s, 'GET', fileUrl + '?thumb=1', 'Stranger')).status === 403);
  check('this project\'s team gets the file', (await as(s, 'GET', fileUrl, 'Forge')).status === 200);
  check('the owner\'s terminal gets the file', (await as(s, 'GET', fileUrl, 'Owner')).status === 200);
  check('a team is refused a DM\'s file', (await as(s, 'GET', '/api/dms/contacts/abc/files/x-a.png', 'Forge')).status === 403);
  check('a team cannot start a DM upload', (await as(s, 'POST', '/api/dms/contacts/abc/uploads', 'Forge', { name: 'x', size: 5 })).status === 403);
  check('no project, no uploads', (await s.api('POST', '/api/projects/nope/uploads', { name: 'x', size: 5 })).status === 404);

  // At most 20 open at once.
  const many = []; for (let i = 0; i < 20; i++) many.push((await s.api('POST', U, { name: i + '.bin', size: 5 })));
  check('20 uploads can be open', many.every(r => r.status === 200), many.map(r => r.status));
  check('the 21st is refused until one finishes or is cancelled', (await s.api('POST', U, { name: 'x.bin', size: 5 })).status === 429);
  for (const r of many) await s.ok('DELETE', `${U}/${r.body.id}`);

  // Page: a 2.5 MB file in a card reply goes in pieces; Cancel drops it; a piece that keeps failing stops it, Send again resumes.
  const card = await mkCard(s, 'alpha', 'Big file');
  const page = await openPage(ctx, '#/p/alpha/' + card.id);
  await page.click('[data-ctab="reply"]');
  await page.waitForSelector('#r-text');
  const big = bytes(2.5 * MB), input = '.reply input[type=file]';
  // Cancel: piece 0 is held up, Cancel is clicked while the bar shows.
  let hold = true;
  await page.route('**/api/projects/alpha/uploads/*/0', async r => { while (hold) await sleep(50); try { await r.continue(); } catch {} });
  await page.setInputFiles(input, { name: 'cancel-me.bin', mimeType: 'application/octet-stream', buffer: big });
  await page.click('.reply button:has-text("Send reply")');
  await page.waitForSelector('.reply .att-prog progress');
  await page.waitForFunction(() => /cancel-me\.bin/.test((document.querySelector('.reply .att-pct') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  check('the progress bar shows the file name', /cancel-me\.bin/.test(await page.textContent('.reply .att-pct')));
  await page.click('.reply .att-cancel');
  await page.waitForFunction(() => /Upload cancelled/.test(document.getElementById('r-err').textContent), null, { timeout: 4000 }).catch(() => {});
  check('Cancel stops it and says so', /Upload cancelled/.test(await page.textContent('#r-err')));
  check('Cancel cleans up on the board', !!(await until(async () => openUploads(s).length === 0, 4000)), openUploads(s));
  check('the bar goes once cancelled', (await page.locator('.reply .att-prog').count()) === 0);
  check('nothing was sent', !((await getCard(s, 'alpha', card.id)).comments || []).some(m => m.attachments));
  hold = false; await page.unroute('**/api/projects/alpha/uploads/*/0');
  await page.click('.reply [data-att-del="0"]');

  // Resume: piece 1 fails (3 tries), then Send again sends only what is missing.
  let fail = 3; const sent = [];
  page.on('request', r => { const m = r.method() === 'POST' && r.url().match(/\/uploads\/[0-9a-f]{32}\/(\d+)$/); if (m) sent.push(+m[1]); });
  await page.route('**/api/projects/alpha/uploads/*/1', r => fail-- > 0 ? r.abort() : r.continue());
  await page.setInputFiles(input, { name: 'resume.bin', mimeType: 'application/octet-stream', buffer: big });
  await page.click('.reply button:has-text("Send reply")');
  await until(async () => sent.filter(n => n === 1).length >= 3 && !/Upload cancelled/.test(await page.textContent('#r-err')) && (await page.textContent('#r-err')).trim() !== '', 8000);
  check('a piece that keeps failing stops the upload with an error', sent.filter(n => n === 1).length === 3 && !/Upload cancelled/.test(await page.textContent('#r-err')) && openUploads(s).length === 1, [await page.textContent('#r-err'), openUploads(s)]);
  sent.length = 0;
  await page.click('.reply button:has-text("Send reply")');
  const done = await until(async () => ((await getCard(s, 'alpha', card.id)).comments || []).find(m => m.attachments), 8000);
  check('Send again resumes: piece 0 is not sent again', !!done && !sent.includes(0) && sent.includes(1) && sent.includes(2), sent);
  check('the resumed file arrives whole', !!done && done.attachments[0].name === 'resume.bin' && done.attachments[0].size === big.length && fs.readFileSync(done.attachments[0].path).equals(big), done && done.attachments);
  check('no pieces are left on the board', openUploads(s).length === 0, openUploads(s));
  check('no page errors (but the pieces the test failed on purpose)', page.errors.filter(e => !/ERR_FAILED/.test(e)).length === 0, page.errors);
}, true);

def('uploadexpire', 'an unfinished resumable upload expires and its pieces go', async s => {
  await mkProject(s, 'Alpha', 'ALP');
  const U = '/api/projects/alpha/uploads';
  const u = await s.ok('POST', U, { name: 'x.bin', size: 5 });
  await s.ok('POST', `${U}/${u.id}/0`, piece(bytes(5), 0));
  check('pieces are kept while it is fresh', fs.existsSync(path.join(s.data, 'uploads', u.id, '0.part')));
  await sleep(1200);
  check('an expired upload is unknown', (await s.api('GET', `${U}/${u.id}`)).status === 404);
  check('and its folder is gone', !fs.existsSync(path.join(s.data, 'uploads', u.id)));
  const v = await s.ok('POST', U, { name: 'y.bin', size: 5 });
  await sleep(1200);
  await s.ok('POST', U, { name: 'z.bin', size: 5 });
  check('starting another upload sweeps out expired ones', !fs.existsSync(path.join(s.data, 'uploads', v.id)));
}, false, { AIGILE_UPLOAD_TTL_MS: '800' });
