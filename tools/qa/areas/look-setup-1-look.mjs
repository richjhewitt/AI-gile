import { proof, contrastTokens, contrastInboxTints, TINT_CASES, SHOTS } from '../a11y-proof.mjs';
// QA areas: look, logos, theme (split from look-setup.mjs, AIG-297).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def, tbClick } from '../lib.mjs';

def('look', 'each project has a colour and emoji: inbox badge and stripe, tabs, home, 🎨 Look dialog', async (s, ctx) => {
  await mkProject(s, 'Tunio', 'TUN'); await mkProject(s, 'LocoRadio', 'LOC');   // Tunio has no keyword emoji since AIG-245: its spare one (🔭) comes from its slug
  const a = await mkCard(s, 'tunio', 'Music q'), b = await mkCard(s, 'locoradio', 'Radio q');
  s.cli(['ask', 'tunio', a.id, 'Go?', '--as', 'Lead']); s.cli(['ask', 'locoradio', b.id, 'Go?', '--as', 'Lead']);
  const sum = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('summary has an automatic colour and emoji', /^#[0-9a-f]{6}$/i.test(sum.color) && sum.emoji === '🔭', sum);
  // AIG-1460: aigile look sets them from the CLI (U+ form for shells that mangle emoji), and empty goes back to automatic
  const lk = s.cli(['look', 'locoradio', '--emoji', 'U+1F4EE', '--color', '#0d9488']);
  const lr = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'locoradio');
  check('aigile look sets the emoji and colour (AIG-1460)', lk.code === 0 && lr.emoji === '📮' && lr.color === '#0d9488', lk);
  check('aigile look refuses a bad colour', s.cli(['look', 'locoradio', '--color', 'teal']).code !== 0);
  s.cli(['look', 'locoradio', '--emoji', '', '--color', '']);
  const la = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'locoradio');
  check('aigile look with empty values goes back to automatic', la.emoji !== '📮' && la.color !== '#0d9488', la);
  const ib = await s.ok('GET', '/api/inbox');
  check('inbox items carry the look', ib.every(c => c.projectColor && c.projectEmoji));
  const page = await openPage(ctx, '#/inbox');
  // Messages (AIG-87): one chat per project, newest first; picking a chat shows its questions.
  await page.waitForSelector('#ibChats button[data-chat]');
  const chats = await page.$$eval('#ibChats button[data-chat]', els => els.map(e => e.dataset.chat));
  check('a chat per project, newest message first', JSON.stringify(chats) === JSON.stringify(['locoradio', 'tunio']), chats);
  check('newest chat open: only its question shows', (await page.locator(`.ib-item[data-id="${b.id}"]`).count()) === 1 && (await page.locator(`.ib-item[data-id="${a.id}"]`).count()) === 0);
  await page.click('#ibChats button[data-chat="tunio"]');
  await page.waitForSelector(`.ib-item[data-id="${a.id}"]`);
  check('chat shows the lead and the project look', (await page.textContent('#ibChats button[data-chat="tunio"]')).includes('Lead') && (await page.textContent('#ibChats')).includes('🔭'));
  check('badge shows emoji and name', (await page.textContent(`.ib-item[data-id="${a.id}"] .ib-proj`)).includes('🔭 Tunio'));
  check('item has the project stripe', (await page.getAttribute(`.ib-item[data-id="${a.id}"]`, 'style')).includes(sum.color));
  check('project tab shows the emoji', (await page.textContent('#ibTabs')).includes('📻 LocoRadio'));
  await page.goto(BASE + '/#/');
  await page.waitForSelector('a.proj');
  check('home card shows the emoji', (await page.textContent('a.proj[href="#/p/tunio"] h2')).includes('🔭'));
  // Waiting on you folds away, closed by default, and stays open through the 1s redraw (AIG-105).
  check('Waiting on you starts closed', !(await page.$eval('details.inbox', d => d.open)));
  await page.click('details.inbox summary');
  await sleep(1500);
  check('stays open after redraws', await page.$eval('details.inbox', d => d.open));
  await page.goto(BASE + '/#/p/tunio');
  await tbClick(page, 'Look');
  await page.fill('#look-emoji', '🎸');
  check('Look has the public feedback tick and group (AIG-969)', (await page.locator('#look-fb').count()) === 1 && (await page.locator('#look-fbgroup').count()) === 1);
  await page.$eval('#look-color', el => { el.value = '#123456'; });
  await page.click('#dialog button:has-text("Save")');
  await sleep(500);
  let t = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Look saves emoji and colour', t.emoji === '🎸' && t.color === '#123456', t);
  check('bad colour refused', (await s.api('PATCH', '/api/projects/tunio', { color: 'red' })).status === 400);
  await s.ok('PATCH', '/api/projects/tunio', { color: '', emoji: '' });
  t = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Automatic brings the picks back', t.emoji === '🔭' && t.color === sum.color, t);
  noErrors(page);
}, true);

def('logos', 'a project picture and an app logo replace the emoji / 🗂️: upload, typed path, served, shown, removed (AIG-175)', async (s, ctx) => {
  await mkProject(s, 'Tunio', 'TUN');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const dir = tmp('logos'), file = path.join(dir, 'logo.png');
  fs.writeFileSync(file, png);
  const up = await s.ok('POST', '/api/projects/tunio/logo', { name: 'logo.png', type: 'image/png', data: png.toString('base64') });
  check('upload returns the logo url', /^\/api\/projects\/tunio\/logo\?v=\d+$/.test(up.logo), up);
  const sum = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('summary carries the logo', sum.logo === up.logo, sum.logo);
  const img = await fetch(s.base + up.logo);
  check('image is served with its type', img.status === 200 && img.headers.get('content-type') === 'image/png' && (await img.arrayBuffer()).byteLength === png.length);
  // Refused: other types, a big file, shell characters, a missing file, a relative path.
  check('wrong type refused', (await s.api('POST', '/api/projects/tunio/logo', { name: 'x.exe', data: 'AAAA' })).status === 400);
  check('over 1 MB refused', (await s.api('POST', '/api/projects/tunio/logo', { name: 'big.png', data: Buffer.alloc(1100000).toString('base64') })).status === 400);
  for (const bad of ['C:/x/$HOME/a.png', 'C:/x/%TEMP%/a.png', file + '`', 'logo.png', path.join(dir, 'nope.png')])
    check('path refused: ' + bad.slice(-18), (await s.api('POST', '/api/projects/tunio/logo', { path: bad })).status === 400);
  fs.writeFileSync(path.join(dir, 'big.png'), Buffer.alloc(1100000));
  check('big file on disk refused', (await s.api('POST', '/api/projects/tunio/logo', { path: path.join(dir, 'big.png') })).status === 400);
  check('logo of an unknown project refused', (await s.api('POST', '/api/projects/nope/logo', { name: 'a.png', data: 'AAAA' })).status === 404);
  const svg = path.join(dir, 'mark.svg'); fs.writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
  const viaPath = await s.ok('POST', '/api/projects/tunio/logo', { path: svg.split(path.sep).join('/') });
  const sv = await fetch(s.base + viaPath.logo);
  check('typed path is copied in and served as svg', sv.headers.get('content-type') === 'image/svg+xml' && /sandbox/.test(sv.headers.get('content-security-policy') || ''));
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('a.proj[href="#/p/tunio"] h2 img.pic');
  check('home card shows the picture, not the emoji', !(await page.textContent('a.proj[href="#/p/tunio"] h2')).includes('🔭'));
  // Through the Look dialog: pick a file, then Remove.
  await page.goto(BASE + '/#/p/tunio');
  await tbClick(page, 'Look');
  const before = await page.getAttribute('#look-logo img.pic', 'src');
  await page.setInputFiles('#look-logo-file', file);
  await page.waitForFunction(old => document.querySelector('#look-logo img.pic')?.getAttribute('src') !== old, before);
  const afterPick = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('the picked png is stored', (await fetch(s.base + afterPick.logo)).headers.get('content-type') === 'image/png');
  await page.click('#look-logo button:has-text("Remove")');
  await page.waitForSelector('#look-logo img.pic', { state: 'detached' });
  const gone = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Remove goes back to the emoji', gone.logo === '' && gone.emoji === '🔭' && (await fetch(s.base + '/api/projects/tunio/logo')).status === 404, gone);
  check('removing again is harmless', (await s.api('DELETE', '/api/projects/tunio/logo')).status === 200);
  // App logo: tab icon and header.
  const fav0 = await page.getAttribute('#favicon', 'href');
  await page.click('#dialog button:has-text("Cancel")');
  await page.goto(BASE + '/#/setup');
  await page.waitForSelector('#app-logo-file');
  await page.setInputFiles('#app-logo-file', file);
  await page.waitForSelector('#app-logo img.brand-logo');
  check('favicon points at the app logo', (await page.getAttribute('#favicon', 'href')).startsWith('/api/app-logo'));
  check('header shows the picture', (await page.$$('#brand img.brand-logo')).length === 1);
  check('app logo is served', (await fetch(s.base + '/api/app-logo')).headers.get('content-type') === 'image/png');
  check('meta carries it', (await s.ok('GET', '/api/meta')).appLogo.startsWith('/api/app-logo'));
  await page.click('#app-logo button:has-text("Remove")');
  await page.waitForSelector('#app-logo img.brand-logo', { state: 'detached' });
  check('favicon is the emoji again', (await page.getAttribute('#favicon', 'href')) === fav0 && (await page.getAttribute('#brand img', 'src')) === 'icons/icon-192.png');
  check('app logo gone', (await fetch(s.base + '/api/app-logo')).status === 404 && (await s.ok('GET', '/api/meta')).appLogo === '');
  // Icon colours (AIG-400): bad colours refused; a preset recolours the tab icon; Reset goes back to the emoji.
  check('default icon colours: no custom icon', (await s.ok('GET', '/api/meta')).appIcon === null && (await fetch(s.base + '/api/app-icon.svg')).status === 404);
  check('a bad icon colour is refused', (await s.api('POST', '/api/setup', { prefs: { iconColors: { main: 'red' } } })).status === 400);
  await page.waitForSelector('#icon-main .icon-sw');
  await page.click('#icon-main .icon-sw[data-c="#16a34a"]');
  await page.waitForFunction(() => (document.getElementById('favicon').getAttribute('href') || '').startsWith('/api/app-icon.svg'));
  const favSvg = await (await fetch(s.base + (await page.getAttribute('#favicon', 'href')))).text();
  check('favicon is the mark in the picked main colour', favSvg.includes('#16a34a') && !favSvg.includes('#3b6cf6'), favSvg.slice(0, 120));
  check('saved in the prefs and meta', (await s.ok('GET', '/api/setup')).prefs.iconColors.main === '#16a34a' && (await s.ok('GET', '/api/meta')).appIcon.main === '#16a34a');
  await page.click('#icon-waiting .icon-sw[data-c="#f59e0b"]');
  await page.waitForFunction(() => document.querySelector('#icon-waiting .icon-sw[data-c="#f59e0b"]').style.borderColor !== 'transparent');
  const waitSvg = await (await fetch(s.base + '/api/app-icon.svg?waiting=1')).text();
  check('waiting icon has the diamond in the picked colour', waitSvg.includes('#f59e0b') && waitSvg.includes('#16a34a'), waitSvg.slice(0, 160));
  await page.click('#iconReset');
  await page.waitForFunction(h => document.getElementById('favicon').getAttribute('href') === h, fav0);
  check('Reset: emoji favicon, no custom icon', (await s.ok('GET', '/api/meta')).appIcon === null && (await fetch(s.base + '/api/app-icon.svg')).status === 404);
  noErrors(page);
}, true);

def('theme', 'theme: follows the system, or System / Light / Dark picked in the header and remembered (AIG-143)', async (s, ctx) => {
  const page = await openPage(ctx, '#/');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForSelector('#themeBtn');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await bg();
  const themeContrast = await contrastTokens(page, ['light', 'dark', 'black']);
  check('theme text tokens meet 4.5:1 (AIG-1433)', !themeContrast.length, themeContrast);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; $('app').insertAdjacentHTML('afterbegin', '<p class=stale>In flight: Alpha &rarr; ALP-1 <span class=muted>(33m ago)</span></p>'); });
  check('stale flight lines keep full opacity (AIG-1433)', await page.locator('.stale').first().evaluate(e => getComputedStyle(e).opacity === '1'));
  await proof(page, 'AIG-1433');
  const nightContrast = await contrastTokens(page, ['night']);
  check('night text tokens meet 4.5:1 (AIG-1430)', !nightContrast.length, nightContrast);
  await proof(page, 'AIG-1430');
  // AIG-1430: text on the Inbox item tints (a real question and a real to-test item, fixtures for the rest), every theme, Night on a light system too.
  await mkProject(s, 'Alpha', 'ALP');
  const q = await mkCard(s, 'alpha', 'A question for the owner'), tt = await mkCard(s, 'alpha', 'A feature to test');
  s.cli(['ask', 'alpha', q.id, 'Go?', '--as', 'Lead']); s.cli(['test', 'alpha', tt.id, '1. look', '--as', 'Lead']);
  const ib = await openPage(ctx, '#/inbox');
  await ib.waitForSelector('.ib-item.q');
  const tintFails = await contrastInboxTints(ib, TINT_CASES, SHOTS && SHOTS + '/AIG-1430-inbox-night-light.png');
  check('Inbox item text meets 4.5:1 on its tint in every theme, Night on a light system included (AIG-1430)', !tintFails.length, tintFails);
  noErrors(ib); await ib.close();
  await page.evaluate(() => { delete document.documentElement.dataset.theme; document.documentElement.removeAttribute('data-night'); });
  for (const theme of ['light', 'dark', 'black']) {
    await page.evaluate(theme => {
      document.documentElement.dataset.theme = theme;
      openDialog('<h2>Edges</h2><div class="panel">Card</div>');
    }, theme);
    check(theme + ' sheets have edges and dimmed backdrop', await page.evaluate(() => {
      const d = getComputedStyle(document.querySelector('.dialog')), p = getComputedStyle(document.querySelector('.panel'));
      return d.borderTopWidth === '1px' && p.borderTopWidth === '1px' && d.borderTopColor !== d.backgroundColor && getComputedStyle(document.querySelector('.overlay')).backgroundColor === 'rgba(0, 0, 0, 0.6)';
    }));
    await page.setViewportSize({ width: 390, height: 844 });
    check(theme + ' dialog fits phone', await page.locator('.dialog').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => closeDialog());
  }
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await page.evaluate(() => openDialog('<h2>Window tools</h2><button onclick="closeDialog()">' + t('common.close') + '</button>', '', 'deleted'));
  check('one shared Close and Pop out in dialog header', await page.locator('.dialog .window-tools .window-close').count() === 1 && await page.locator('.dialog .window-tools .dlg-pop').count() === 1 && await page.locator('.dialog button[onclick="closeDialog()"]').count() === 1);
  await page.evaluate(() => closeDialog());
  check('starts on System', !(await page.evaluate(() => document.documentElement.dataset.theme)));
  await page.click('#themeBtn');   // -> Light
  await page.click('#themeBtn');   // -> Dark
  check('Dark picked overrides a light system', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await bg()) !== light);
  await page.reload(); await page.waitForSelector('#themeBtn');
  check('the pick is remembered', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.click('#themeBtn');   // -> Black (AIG-916)
  await page.click('#themeBtn');   // -> System
  check('back to System follows the system', !(await page.evaluate(() => document.documentElement.dataset.theme)) && (await bg()) === light);
  noErrors(page);
}, true);
