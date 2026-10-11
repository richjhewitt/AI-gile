// QA areas: look, logos, theme, popout, owner, setup, i18n.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('look', 'each project has a colour and emoji: inbox badge and stripe, tabs, home, 🎨 Look dialog', async (s, ctx) => {
  await mkProject(s, 'Tunio', 'TUN'); await mkProject(s, 'LocoRadio', 'LOC');
  const a = await mkCard(s, 'tunio', 'Music q'), b = await mkCard(s, 'locoradio', 'Radio q');
  s.cli(['ask', 'tunio', a.id, 'Go?', '--as', 'Lead']); s.cli(['ask', 'locoradio', b.id, 'Go?', '--as', 'Lead']);
  const sum = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('summary has an automatic colour and emoji', /^#[0-9a-f]{6}$/i.test(sum.color) && sum.emoji === '🎵', sum);
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
  check('chat shows the lead and the project look', (await page.textContent('#ibChats button[data-chat="tunio"]')).includes('Lead') && (await page.textContent('#ibChats')).includes('🎵'));
  check('badge shows emoji and name', (await page.textContent(`.ib-item[data-id="${a.id}"] .ib-proj`)).includes('🎵 Tunio'));
  check('item has the project stripe', (await page.getAttribute(`.ib-item[data-id="${a.id}"]`, 'style')).includes(sum.color));
  check('project tab shows the emoji', (await page.textContent('#ibTabs')).includes('📻 LocoRadio'));
  await page.goto(BASE + '/#/');
  await page.waitForSelector('a.proj');
  check('home card shows the emoji', (await page.textContent('a.proj[href="#/p/tunio"] h2')).includes('🎵'));
  // Waiting on you folds away, closed by default, and stays open through the 1s redraw (AIG-105).
  check('Waiting on you starts closed', !(await page.$eval('details.inbox', d => d.open)));
  await page.click('details.inbox summary');
  await sleep(1500);
  check('stays open after redraws', await page.$eval('details.inbox', d => d.open));
  await page.goto(BASE + '/#/p/tunio');
  await page.click('button:has-text("Look")');
  await page.fill('#look-emoji', '🎸');
  await page.$eval('#look-color', el => { el.value = '#123456'; });
  await page.click('#dialog button:has-text("Save")');
  await sleep(500);
  let t = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Look saves emoji and colour', t.emoji === '🎸' && t.color === '#123456', t);
  check('bad colour refused', (await s.api('PATCH', '/api/projects/tunio', { color: 'red' })).status === 400);
  await s.ok('PATCH', '/api/projects/tunio', { color: '', emoji: '' });
  t = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Automatic brings the picks back', t.emoji === '🎵' && t.color === sum.color, t);
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
  check('home card shows the picture, not the emoji', !(await page.textContent('a.proj[href="#/p/tunio"] h2')).includes('🎵'));
  // Through the Look dialog: pick a file, then Remove.
  await page.goto(BASE + '/#/p/tunio');
  await page.click('button:has-text("Look")');
  const before = await page.getAttribute('#look-logo img.pic', 'src');
  await page.setInputFiles('#look-logo-file', file);
  await page.waitForFunction(old => document.querySelector('#look-logo img.pic')?.getAttribute('src') !== old, before);
  const afterPick = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('the picked png is stored', (await fetch(s.base + afterPick.logo)).headers.get('content-type') === 'image/png');
  await page.click('#look-logo button:has-text("Remove")');
  await page.waitForSelector('#look-logo img.pic', { state: 'detached' });
  const gone = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Remove goes back to the emoji', gone.logo === '' && gone.emoji === '🎵' && (await fetch(s.base + '/api/projects/tunio/logo')).status === 404, gone);
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
  check('favicon is the emoji again', (await page.getAttribute('#favicon', 'href')) === fav0 && (await page.textContent('#brand')).includes('🗂️'));
  check('app logo gone', (await fetch(s.base + '/api/app-logo')).status === 404 && (await s.ok('GET', '/api/meta')).appLogo === '');
  noErrors(page);
}, true);

def('theme', 'theme: follows the system, or System / Light / Dark picked in the header and remembered (AIG-143)', async (s, ctx) => {
  const page = await openPage(ctx, '#/');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForSelector('#themeBtn');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await bg();
  check('starts on System', !(await page.evaluate(() => document.documentElement.dataset.theme)));
  await page.click('#themeBtn');   // -> Light
  await page.click('#themeBtn');   // -> Dark
  check('Dark picked overrides a light system', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await bg()) !== light);
  await page.reload(); await page.waitForSelector('#themeBtn');
  check('the pick is remembered', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.click('#themeBtn');   // -> System
  check('back to System follows the system', !(await page.evaluate(() => document.documentElement.dataset.theme)) && (await bg()) === light);
  noErrors(page);
}, true);

def('popout', '⧉ Pop out opens a card on its own in a new window (AIG-122)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Follow these steps', { status: 'verify', testSteps: '1. Do the thing\n2. See the result' });
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('button:has-text("Pop out")');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('button:has-text("Pop out")')]);
  await pop.waitForSelector('.panel h2');
  check('pop-out shows the card', (await pop.textContent('.panel h2')) === 'Follow these steps' && /\/pop\/alpha\//.test(pop.url()), pop.url());
  check('no header or board behind it', !(await pop.isVisible('header')) && (await pop.locator('.board').count()) === 0);
  check('pop-out has no Pop out button of its own', (await pop.locator('button:has-text("Pop out")').count()) === 0);
  check('main window goes back to the board', await page.waitForFunction(() => location.hash === '#/p/alpha').then(() => true).catch(() => false));
  await pop.click('.verdict button:has-text("Accept")');
  await sleep(500);
  check('accepting in the pop-out works', (await getCard(s, 'alpha', c.id)).status === 'done');
  noErrors(page);
}, true);

def('owner', 'the board works for any owner name, not just Rich (AIG-103)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  check('meta tells the page the owner', (await s.ok('GET', '/api/meta')).owner === 'Sam');
  const c = await mkCard(s, 'alpha', 'Question');
  s.cli(['ask', 'alpha', c.id, 'Go?', '--as', 'Lead']);
  const inbox = s.cli(['inbox']);
  check('CLI speaks of the owner', /asked Sam|Sam/.test(s.cli(['help']).out) && !/\bRich\b/.test(s.cli(['help']).out));
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  check('reply box says Sam', /Reply as Sam/.test(await page.getAttribute('#r-text', 'placeholder')));
  await page.click('.reply button:has-text("Go")');
  await sleep(500);
  const card = await getCard(s, 'alpha', c.id);
  check('owner reply is from Sam and counts as the owner', card.comments.at(-1).author === 'Sam' && card.status === 'team' && !card.needsYou, card);
  const up = s.cli(['updates', 'alpha']);
  check('team sees Sam in updates', /new from Sam/.test(up.out) && /Sam \(/.test(up.out), up.out);
  s.cli(['task', 'alpha', c.id, 'log in', '--as', 'Lead']);
  check('tasks go to Sam', (await getCard(s, 'alpha', c.id)).assignee === 'Sam' && (await s.ok('GET', '/api/inbox')).some(x => x.id === c.id));
  noErrors(page);
}, true, { AIGILE_OWNER: 'Sam' });

def('setup', 'a new install opens Setup; saving writes the local settings file (AIG-91)', async (s, ctx) => {
  const file = process.env.QA_SETUP_FILE;
  check('new install needs setup', (await s.ok('GET', '/api/meta')).setupNeeded === true);
  const page = await openPage(ctx, '#/');
  await page.waitForFunction(() => location.hash === '#/setup', null, { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#setupForm');
  check('board opens Setup first', page.url().endsWith('#/setup'));
  check('name is required', (await s.api('POST', '/api/setup', { owner: '' })).status === 400);
  await page.fill('input[data-key="owner"]', 'Sam');
  await page.fill('input[data-key="agent.command"]', 'C:/tools/agent.exe');
  await page.fill('input[data-key="agent.notesFile"]', 'NOTES.local.md');
  await page.fill('input[data-key="agent.settingsFile"]', '.agent/settings.local.json');
  await page.click('#setupForm button[type=submit]');
  await page.waitForSelector('#setup-done:has-text("ready")');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('saved to the local settings file', saved.owner === 'Sam' && saved.agent.command === 'C:/tools/agent.exe' && saved.agent.settingsFile === '.agent/settings.local.json', saved);
  const m = await s.ok('GET', '/api/meta');
  check('setup done and the name is used at once', m.setupNeeded === false && m.owner === 'Sam', m);
  noErrors(page);
}, true, { AIGILE_OWNER: '', AIGILE_LOCAL: (process.env.QA_SETUP_FILE = path.join(tmp('setup'), 'aigile.local.json')) });

def('i18n', 'languages: every language file has the same keys, the picker switches the file (stubbed copy), no raw keys or {{dev:}} markers on screen (AIG-124)', async (s, ctx) => {
  const langDir = path.join(ROOT, 'public', 'lang');
  const read = f => JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8'));
  const en = read('en.json'), keysOf = o => Object.keys(o).sort().join('\n');
  check('English has strings', Object.keys(en).length > 100, Object.keys(en).length);
  check('nl.json has exactly the English keys', keysOf(read('nl.json')) === keysOf(en));
  check('nl-BE.json has exactly the English keys', keysOf(read('nl-BE.json')) === keysOf(en));
  check('dev words are marked in English', Object.values(en).some(v => /\{\{dev:\w+\}\}/.test(v)));

  // Seed something on every page: a question, a test with steps, a stand-up answer.
  await mkProject(s, 'Alpha', 'ALP'); await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const q = await mkCard(s, 'alpha', 'Export format');
  s.cli(['ask', 'alpha', q.id, 'M3U or JSON? Assuming M3U', '--as', 'Lead']);
  await mkCard(s, 'alpha', 'Build the thing', { status: 'verify', testSteps: '1. Open it\n2. Click the button' });
  await mkCard(s, 'alpha', 'Raise me', { type: 'bug', priority: 'high' });

  // A stubbed nl.json: one string changed, one key missing (so it must fall back to English).
  const nl = { ...read('nl.json'), 'home.newproject': '+ NIEUW PROJECT' }; delete nl['home.find'];
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
  await page.route('**/lang/nl.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(nl) }));
  await page.goto(BASE + '/#/');
  await page.waitForSelector('#app .toolbar');
  check('starts in English', (await page.evaluate(() => document.documentElement.lang)) === 'en' && (await page.textContent('#app .toolbar .primary')).includes('New project'));
  check('no language picker in the top bar', (await page.locator('header select').count()) === 0);
  const stray = () => page.evaluate(() => {
    const re = /\b(?:card|inbox|home|board|dlg|setup|usage|standup|dms|pres|cols?|verdict|filter|views|lanes|fy|ago|live|theme|update|poke|night|quiet|crumb|attach|format|happening|ask|look|perm|docs|assignee|role|cv|lang|leave|projects|common)\.[a-z][\w.]*|\{\{dev:/;
    const texts = [document.body.innerText, ...[...document.querySelectorAll('[title],[placeholder],[aria-label]')].map(e => [e.title, e.placeholder, e.getAttribute('aria-label')].join(' '))];
    return texts.map(t => (t.match(re) || [])[0]).filter(Boolean);
  });
  // No raw key and no dev marker on the main pages (English).
  for (const hash of ['#/', '#/p/alpha', '#/p/alpha/ALP-2', '#/inbox', '#/usage', '#/setup', '#/standups']) {
    await page.goto(BASE + '/' + hash); await page.reload(); await page.waitForSelector('#app > *', { timeout: 8000 }); await sleep(400);
    check('no raw keys or markers on ' + hash, (await stray()).length === 0, await stray());
  }
  await page.goto(BASE + '/#/p/alpha'); await page.reload(); await page.waitForSelector('.board');
  await page.click('button:has-text("Raise bug")'); await page.waitForSelector('.dialog');
  check('no raw keys in the bug dialog', (await stray()).length === 0, await stray());
  await page.keyboard.press('Escape');

  // Switching to Dutch loads nl.json (the stub), sets <html lang>, and falls back to English for the missing key.
  await page.goto(BASE + '/#/setup'); await page.waitForSelector('#setupForm');
  check('Setup has the picker with three languages', (await page.locator('.setup .lang-pick option').allTextContents()).join('|') === 'English|Nederlands|Vlaams');
  await page.selectOption('.setup .lang-pick', 'nl');
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8000 });
  await page.goto(BASE + '/#/'); await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8000 });
  await page.waitForSelector('#app .toolbar');
  check('html lang is nl', (await page.evaluate(() => document.documentElement.lang)) === 'nl');
  check('a string comes from nl.json', (await page.textContent('#app .toolbar .primary')).trim() === '+ NIEUW PROJECT', await page.textContent('#app .toolbar .primary'));
  check('a missing key falls back to English', (await page.textContent('#app .toolbar')).includes('Find my projects'));
  check('the choice is remembered', (await page.evaluate(() => localStorage.getItem('aigile.lang'))) === 'nl');
  check('no 🌐 EN button until the switch is on', await page.locator('#enBtn').isHidden());
  await page.goto(BASE + '/#/setup'); await page.waitForSelector('#setupForm');
  await page.check('#enSwitch');
  await page.waitForSelector('#enBtn:not([hidden])');
  await page.click('#enBtn');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 8000 });
  check('🌐 EN shows the board in English, and the button offers the way back', /NL/.test(await page.textContent('#enBtn')) && (await page.evaluate(() => localStorage.getItem('aigile.lang'))) === 'nl');
  await page.waitForSelector('#setupForm');
  check('Setup still shows your own language', (await page.inputValue('.setup .lang-pick')) === 'nl');
  await page.click('#enBtn');
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8000 });
  await page.waitForSelector('#setupForm');
  await page.selectOption('.setup .lang-pick', 'en');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 8000 });
  await page.waitForSelector('#setupForm');
  check('back to English', (await page.evaluate(() => localStorage.getItem('aigile.lang'))) === 'en');
  noErrors(page);
}, true);

def('usagecheck', '🔄 Check usage now: starts the agent hidden, waits for a reading, auto switch (AIG-151)', async (s, ctx) => {
  check('status says auto is off at first', (await s.ok('GET', '/api/usage/check')).auto === false);
  const page = await openPage(ctx, '#/usage');
  await page.waitForSelector('#uzCheck');
  await page.click('#uzCheck');
  await page.waitForFunction(() => /Last reading/.test(document.querySelector('.uz-check').textContent), null, { timeout: 30000 }).catch(() => {});
  check('the button gets a fresh reading from the stand-in agent', /Last reading/.test(await page.textContent('.uz-check')) && (await s.ok('GET', '/api/limits')).latest.h5.pct === 42, await page.textContent('.uz-check'));
  check('a second check within 2 minutes is refused', (await s.api('POST', '/api/usage/check')).status === 400);
  await page.check('.uz-check input[type=checkbox]');
  await sleep(300);
  check('the auto switch is saved', (await s.ok('GET', '/api/usage/check')).auto === true);
  noErrors(page);
}, true, (() => {
  // A stand-in agent: posts a usage reading to this QA server, like Claude's status line would.
  const dir = tmp('usagecheck'), script = path.join(dir, 'post.js'), bat = path.join(dir, 'agent.bat');
  fs.writeFileSync(script, `fetch('http://127.0.0.1:' + process.env.AIGILE_PORT + '/api/limits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate_limits: { five_hour: { used_percentage: 42, resets_at: 1 }, seven_day: { used_percentage: 7, resets_at: 2 } } }) }).catch(() => {}).then(() => setTimeout(() => {}, 30000));`);
  fs.writeFileSync(bat, `@echo off\r\nnode "${script}"\r\n`);
  return { AIGILE_AGENT_COMMAND: bat, AIGILE_NO_USAGE_AUTO: '1' };
})());

def('popreopen', '⧉ a pop-out closed by replying opens again when the team replies (AIG-183)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Server steps', { status: 'team' });
  s.cli(['ask', 'alpha', c.id, 'Step 1: run the setup. Done?', '--as', 'Lead']);
  const main = await openPage(ctx, '#/p/alpha');
  const popP = ctx.waitForEvent('page');
  await main.evaluate(id => window.open('#/pop/alpha/' + id, 'aigile-alpha-' + id, 'width=560,height=780'), c.id);   // opened by the page, like ⧉ Pop out
  const pop = await popP;
  await pop.waitForSelector('#r-text');
  await pop.fill('#r-text', 'Done step 1');
  const closed = pop.waitForEvent('close', { timeout: 5000 }).then(() => true).catch(() => false);
  await pop.click('.reply .actions .primary');
  check('replying closes the pop-out', await closed);
  check('the card is remembered', /alpha\/ALP-/.test(await main.evaluate(() => localStorage.getItem('aigile.reopen') || '')));
  const opened = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  s.cli(['comment', 'alpha', c.id, 'Thanks. Step 2: restart it', '--as', 'Lead']);
  const again = await opened;
  check('the team replying opens it again', !!again && (await again.evaluate(() => location.hash)) === '#/pop/alpha/' + c.id, again && await again.evaluate(() => location.hash));
  check('and it is forgotten after reopening', !/ALP-/.test(await main.evaluate(() => localStorage.getItem('aigile.reopen') || '')));
  noErrors(main);
}, true);

def('glossary', '📖 dev words explained: searchable glossary page, and tooltips when the switch is on (AIG-102)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Refactor the inbox', { status: 'backlog' });
  const page = await openPage(ctx, '#/glossary');
  await page.waitForSelector('.gloss-item');
  check('the glossary lists the words', (await page.locator('.gloss-item').count()) >= 15 && /Commit/.test(await page.textContent('.gloss-list')));
  await page.fill('#glossQ', 'branch');
  check('search narrows it down', (await page.locator('.gloss-item:not([hidden])').count()) >= 1 && (await page.locator('.gloss-item:not([hidden])').count()) < 5);
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  check('no tooltips while the switch is off', (await page.locator('abbr.devw').count()) === 0);
  await page.goto(BASE + '/#/setup'); await page.waitForSelector('#explainWords');
  await page.check('#explainWords');
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  await page.waitForSelector('abbr.devw', { timeout: 5000 }).catch(() => {});
  const tip = await page.getAttribute('abbr.devw', 'title').catch(() => '');
  check('with the switch on, dev words get a plain explanation', !!tip && tip.length > 20, tip);
  check('typing boxes are left alone', (await page.locator('input abbr, textarea abbr').count()) === 0);
  noErrors(page);
}, true);
