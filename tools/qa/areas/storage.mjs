// QA area storage (AIG-718): Setup > 💾 Storage lists sizes by kind and a total; the tidy-up removes the attachment of a
// done card older than 30 days after a confirm, and leaves a recent done card's and an open card's attachments. Runs on its
// own data copy (startServer makes a temp data folder). Phone width and dark mode, one screenshot.
import fs from 'fs';
import path from 'path';
import { check, startServer, freePort, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('storage', '💾 Storage in Setup: sizes by kind + total, tidy-up of old done cards\' attachments after a confirm, others stay (AIG-718)', async (s, ctx) => {
  const up = (slug, name, text) => s.ok('POST', `/api/projects/${slug}/attachments`, { name, type: 'text/plain', data: Buffer.from(text).toString('base64') });
  const proj = await mkProject(s, 'Store', 'STO'), slug = proj.slug;
  const old = await mkCard(s, slug, 'Old done'), fresh = await mkCard(s, slug, 'Fresh done'), open = await mkCard(s, slug, 'Open');
  const aOld = await up(slug, 'old.txt', 'x'.repeat(5000)), aFresh = await up(slug, 'fresh.txt', 'y'.repeat(3000)), aOpen = await up(slug, 'open.txt', 'z'.repeat(2000));
  for (const [c, a] of [[old, aOld], [fresh, aFresh], [open, aOpen]]) await s.ok('POST', `/api/projects/${slug}/cards/${c.id}/comments`, { author: 'Owner', text: 'file', attachments: [a] });
  for (const c of [old, fresh]) await s.ok('PATCH', `/api/projects/${slug}/cards/${c.id}`, { status: 'done' });
  // age the old card on disk (the server reads the file on every call)
  const file = path.join(s.data, slug + '.json'), j = JSON.parse(fs.readFileSync(file, 'utf8'));
  j.cards.find(c => c.id === old.id).updated = new Date(Date.now() - 45 * 86400000).toISOString();
  fs.writeFileSync(file, JSON.stringify(j));
  fs.mkdirSync(path.join(s.data, 'logs'), { recursive: true }); fs.writeFileSync(path.join(s.data, 'logs', 'a.log'), 'l'.repeat(1000));

  const u = await s.ok('GET', '/api/storage');
  const k = n => u.kinds.find(x => x.kind === n);
  check('attachments counted (3 files, 10000 bytes)', k('attachments').files === 3 && k('attachments').bytes === 10000, u.kinds);
  check('logs counted and the total adds up', k('logs').bytes === 1000 && u.total === u.kinds.reduce((n, x) => n + x.bytes, 0) && u.biggest.length > 0, u);
  check('tidy offers only the old done card\'s file', u.tidy.files === 1 && u.tidy.bytes === 5000, u.tidy);

  const page = await openPage(ctx, '#/setup/storage');
  await page.waitForSelector('#sec-storage .stor-t');
  const txt = await page.textContent('#storageBox');
  check('section lists each kind, the total, the biggest flag and the tidy line', /Attachments/.test(txt) && /Logs/.test(txt) && /Total/.test(txt) && /biggest/.test(txt) && /1 files/.test(txt), txt);
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.click('#storTidy');
  await page.waitForTimeout(300);
  check('the confirm names the count', /Delete 1 attachment/.test(asked), asked);
  check('cancel deletes nothing', (await s.ok('GET', '/api/storage')).tidy.files === 1 && fs.existsSync(aOld.path));
  await page.screenshot({ path: path.join(s.dir, 'storage-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => document.getElementById('sec-storage').scrollIntoView());
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(s.dir, 'storage-phone-dark.png') });
  console.log('screenshot: ' + path.join(s.dir, 'storage-phone-dark.png'));
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await page.click('#storTidy');
  await page.waitForSelector('#storNone', { timeout: 8000 });
  check('after OK the old file is gone, the others stay', !fs.existsSync(aOld.path) && fs.existsSync(aFresh.path) && fs.existsSync(aOpen.path));
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('the reference on the old card is removed, the others kept', !JSON.stringify(after.cards.find(c => c.id === old.id)).includes(aOld.id) && JSON.stringify(after.cards.find(c => c.id === open.id)).includes(aOpen.id));
  check('the page says nothing left to tidy and the total shrank', (await s.ok('GET', '/api/storage')).tidy.files === 0);
  noErrors(page);
  await page.close();
}, true);
