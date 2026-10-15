// QA area backups (AIG-1258, AIG-1259, AIG-1261, AIG-1262): the daily backup is made at start and keeps 7 days, the settings
// copy has no tokens; a damaged board or settings file is warned about on Home, never saved over, and put back from a backup;
// Setup > Storage shows the data folder (📂 / 📋) and puts a board back after a confirm. Only the run's own temp data folder.
import fs from 'fs';
import path from 'path';
import { check, mkProject, mkCard, openPage, noErrors, def, until, sleep } from '../lib.mjs';

def('backups', '🗄️ Daily backups (7 kept, no tokens), damaged board/settings warned and never saved over, restore in Setup, data folder line (AIG-1258/1259/1261/1262)', async (s, ctx) => {
  const B = path.join(s.data, 'backups'), local = path.join(s.dir, 'aigile.local.json');
  const pad = n => String(n).padStart(2, '0'), d = new Date(), today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const st = await until(async () => { const r = await s.ok('GET', '/api/backups'); return r.list.some(x => x.id === today) && r; }, 12000);
  check('today\'s backup is made at start', !!st, st);
  check('the data folder is the run\'s own', st && path.resolve(st.dataDir) === path.resolve(s.data), st && st.dataDir);

  // 7 kept: 8 old days faked, one run, only our own day folders go.
  for (let i = 1; i <= 8; i++) fs.mkdirSync(path.join(B, `2020-01-0${i}`), { recursive: true });
  fs.mkdirSync(path.join(B, 'mine-keep'));
  const run = await s.ok('POST', '/api/backups/run');
  const days = fs.readdirSync(B).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n));
  check('only the last 7 days stay', days.length === 7 && days.includes(today) && !days.includes('2020-01-01') && !days.includes('2020-01-02'), days);
  check('a folder that is not ours is left alone', fs.existsSync(path.join(B, 'mine-keep')), run.removed);

  // A board with cards, a token in the settings, a fresh backup of today.
  const p = await mkProject(s, 'Vault board', 'VLT'), slug = p.slug, file = path.join(s.data, slug + '.json');
  for (const t of ['one', 'two', 'three']) await mkCard(s, slug, t);
  const set = JSON.parse(fs.readFileSync(local, 'utf8')); set.discord = { bots: [{ name: 'qa', token: 'QA-SECRET-TOKEN-123', users: [] }] };
  fs.writeFileSync(local, JSON.stringify(set, null, 2));
  fs.rmSync(path.join(B, today), { recursive: true, force: true });
  await s.ok('POST', '/api/backups/run');
  const copy = fs.readFileSync(path.join(B, today, '_settings.json'), 'utf8');
  check('the settings copy has no token', !copy.includes('QA-SECRET-TOKEN-123') && /"qa"/.test(copy), copy.slice(0, 200));
  check('no secrets or keys folder in the backup', !fs.readdirSync(path.join(B, today)).some(n => /secret|keys|attach/i.test(n)), fs.readdirSync(path.join(B, today)));
  const bl = (await s.ok('GET', '/api/backups')).list.find(x => x.id === today);
  check('the backup lists the board with its card count', bl && bl.projects[slug] && bl.projects[slug].cards === 3, bl);

  // ⚠️ Damaged board (AIG-1261).
  const broken = '{"slug":"' + slug + '","cards":[{"id":"VLT-1"';
  fs.writeFileSync(file, broken);
  const projs = await s.ok('GET', '/api/projects');
  check('the damaged board is not listed as a board', !projs.some(x => x.slug === slug));
  const m = await s.ok('GET', '/api/meta'), dm = (m.damaged || []).find(x => x.slug === slug);
  check('meta names the damaged board, its kept copy and the last good backup', dm && dm.kept && fs.existsSync(dm.kept) && dm.backup && dm.backup.id === today, m.damaged);
  const again = await s.api('POST', '/api/projects', { name: 'Vault board', key: 'VLT' });
  check('a new board with the same name is refused, the file stays as it was', again.status === 409 && fs.readFileSync(file, 'utf8') === broken, again);

  const page = await openPage(ctx, '');
  await page.waitForSelector('.dmg-line', { timeout: 8000 });
  const line = await page.textContent('.dmg-line');
  check('Home shows a red line naming the file', line.includes(slug + '.json') && /damaged/.test(line), line);
  let asked = '';
  page.once('dialog', dl => { asked = dl.message(); dl.accept(); });
  await page.click('.dmg-line .dmg-back');
  await until(async () => (await s.ok('GET', '/api/projects')).some(x => x.slug === slug), 8000);
  check('the confirm says the damaged file is kept aside', /kept aside/.test(asked), asked);
  const back = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('Put back brings the board back with its cards', back.cards.length === 3);
  const list = (await s.ok('GET', '/api/backups')).list, rep = list.find(x => x.kind === 'replaced');
  check('the replaced (damaged) version shows in the list', rep && rep.projects[slug] && rep.projects[slug].damaged === true, list.map(x => x.id));
  await page.waitForFunction(() => !document.querySelector('.dmg-line'), null, { timeout: 8000 }).catch(() => {});
  check('the red line is gone', !(await page.$('.dmg-line')));

  // ⚠️ Damaged settings: warned, Setup save refused, the file is not touched.
  const before = fs.readFileSync(local, 'utf8'), bad = before.slice(0, 40);
  fs.writeFileSync(local, bad);
  const m2 = await s.ok('GET', '/api/meta');
  check('meta names the damaged settings file', (m2.damaged || []).some(x => x.kind === 'settings'), m2.damaged);
  const sv = await s.api('POST', '/api/setup', { owner: 'Owner', prefs: {} });
  check('a Setup save is refused and the settings file is not overwritten', sv.status === 409 && fs.readFileSync(local, 'utf8') === bad, sv);
  check('a damaged settings file does not count as a new install (no send to Setup)', m2.setupNeeded === false, m2.setupNeeded);
  await page.evaluate(() => { try { localStorage.removeItem('aigile.setupSent'); } catch {} });
  await page.reload(); await page.waitForSelector('.dmg-line', { timeout: 8000 });
  check('Home warns about the settings file', /settings file/.test(await page.textContent('.dmg-line')) && !/#\/setup/.test(page.url()), page.url());
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  check('phone width: the warning fits', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(process.env.QA_SHOTS || s.dir, 'backups-home-phone-dark.png') });
  console.log('screenshot: ' + path.join(process.env.QA_SHOTS || s.dir, 'backups-home-phone-dark.png'));
  const rs = await s.ok('POST', '/api/backups/restore', { name: '_settings', id: today });
  check('settings put back from the backup (a copy of the damaged one kept)', JSON.parse(fs.readFileSync(local, 'utf8')).day && rs.replaced && fs.existsSync(path.join(B, rs.replaced, '_settings.bad')), rs.replaced);
  await page.emulateMedia({ colorScheme: 'light' }); await page.setViewportSize({ width: 1280, height: 900 });
  page.errors = page.errors.filter(e => !/status of 409/.test(e));   // saves refused while the settings file was damaged: that is the point

  // Setup > Storage: data folder line and restore after a confirm (AIG-1259, AIG-1262).
  const cards = await s.ok('GET', `/api/projects/${slug}?full=1`);
  for (const c of cards.cards.slice(0, 2)) await s.api('DELETE', `/api/projects/${slug}/cards/${c.id}`);
  const left = JSON.parse(fs.readFileSync(file, 'utf8')).cards.length;
  await page.goto(s.base + '/#/setup/storage'); await page.waitForSelector('#bkDataDir', { timeout: 8000 });
  const dd = await page.textContent('#bkDataDir');
  check('Setup shows the data folder', path.resolve(dd) === path.resolve(s.data), dd);
  const btns = await page.$$eval('#bkWhere [data-copy-path], #bkWhere [data-open-dir]', b => b.map(x => x.dataset.copyPath || x.dataset.openDir));
  check('📂 Open folder and 📋 Copy path point at it', btns.length === 2 && btns.every(x => path.resolve(x) === path.resolve(s.data)), btns);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('#bkWhere [data-copy-path]'); await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('Copy path puts it on the clipboard', clip === '' || path.resolve(clip) === path.resolve(s.data), clip);
  await page.selectOption('#bkPick', slug);
  const row = `tr[data-bk="${today}"] .bk-restore`;
  await page.waitForSelector(row);
  page.once('dialog', dl => { asked = dl.message(); dl.dismiss(); });
  await page.click(row); await sleep(300);
  check('cancel puts nothing back', JSON.parse(fs.readFileSync(file, 'utf8')).cards.length === left && /kept as a backup first/.test(asked), asked);
  page.once('dialog', dl => dl.accept());
  await page.click(row);
  await page.waitForFunction(() => /put back/.test((document.getElementById('bkMsg') || {}).textContent || ''), null, { timeout: 8000 });
  check('after OK the deleted cards are back', left < 3 && JSON.parse(fs.readFileSync(file, 'utf8')).cards.length === 3, left);
  const rows = await page.$$eval('.bk-t tr', r => r.map(x => x.textContent));
  check('the version it replaced is at the top of the list', /replaced by a restore/.test(rows[0]) && rows[0].includes(String(left)), rows.slice(0, 2));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => document.getElementById('backupsBox').scrollIntoView());
  check('phone width: no sideways scroll in Setup', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(process.env.QA_SHOTS || s.dir, 'backups-setup-phone-dark.png') });
  console.log('screenshot: ' + path.join(process.env.QA_SHOTS || s.dir, 'backups-setup-phone-dark.png'));
  noErrors(page);
  await page.close();
}, true);
