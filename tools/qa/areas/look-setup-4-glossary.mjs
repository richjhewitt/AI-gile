// QA areas: glossary, tour, trial, restartpill, pretend, restartqueue (split from look-setup.mjs, AIG-297).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def, until } from '../lib.mjs';

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

def('tour', '🎓 guided tour: three levels, a spotlight per stop, Next / Back / Skip (AIG-95)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('button:has-text("🎓")');
  await page.click('button:has-text("🎓")');
  await page.waitForSelector('.tour-lvl');
  check('three levels to pick from', (await page.locator('.tour-lvl').count()) === 3);
  await page.click('.tour-lvl >> nth=0');   // new to this
  await page.waitForSelector('.tour-bubble');
  check('it starts with a welcome and says how many stops', /Welcome/.test(await page.textContent('.tour-bubble')) && /Stop 1 of 8/.test(await page.textContent('.tour-step')));
  check('new to this also switches the dev words on', (await page.evaluate(() => localStorage.getItem('aigile.explain'))) === '1');
  await page.click('.tour-bubble .primary');
  check('the next stop puts a spotlight on the left rail', /Your projects/.test(await page.textContent('.tour-bubble')) && await page.locator('.tour-spot').isVisible());
  await page.click('.tour-bubble .primary'); await page.click('.tour-bubble .primary');
  await page.waitForFunction(() => /For you/.test(document.querySelector('.tour-bubble h3')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
  check('a board stop opens a board on its own', /#\/p\/alpha/.test(page.url()) && /For you/.test(await page.textContent('.tour-bubble h3')));
  await page.click('.tour-skip');
  check('Skip ends it', (await page.locator('#tourLayer').count()) === 0);
  noErrors(page);
}, true);

def('trial', '🧪 try it as a new user: a fresh empty board with made-up projects on its own port (AIG-201..203)', async (s, ctx) => {
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#trialBtn');
  const popP = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await page.click('#trialBtn');
  const pop = await popP;
  check('the button opens the fresh board in a new window', !!pop && /localhost:4400/.test(pop.url()), pop && pop.url());
  const meta = await (await fetch('http://127.0.0.1:4400/api/meta')).json();
  check('it is a first run: Setup needed, no projects', meta.setupNeeded === true && (await (await fetch('http://127.0.0.1:4400/api/projects')).json()).length === 0, meta);
  const found = await (await fetch('http://127.0.0.1:4400/api/discover', { headers: { 'Content-Type': 'application/json' } })).json().catch(() => null);
  check('Find my projects finds the three made-up projects, nothing real', Array.isArray(found) && found.length === 3 && found.some(f => f.name === 'Pancake Shop'), found && found.map ? found.map(f => f.name) : found);
  check('the real board is untouched', (await s.ok('GET', '/api/projects')).length === 0);
  await s.api('DELETE', '/api/trial');
  await sleep(500);
  check('stopping it frees the port', await fetch('http://127.0.0.1:4400/api/meta').then(() => false).catch(() => true));
  noErrors(page);
}, true);

def('restartpill', '🔄 new server code shows a Restart the board pill; it asks the server to restart (AIG-206)', async (s, ctx) => {
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#upRestart', { state: 'attached' });
  check('no pill while the server is up to date', (await page.locator('#upRestart button').count()) === 0);
  const f = path.join(ROOT, 'lib', 'store.js'), t = new Date();
  fs.utimesSync(f, t, t);   // server code changed after the server started
  check('meta says the server is stale', await until(async () => (await s.ok('GET', '/api/meta')).stale === true, 16000));   // outside dev the server rescans on an ask after 10 s of quiet (AIG-1090)
  await page.waitForSelector('#upRestart button', { timeout: 10000 });
  // AIG-295: one pill only, and in the desktop app it is clickable, not part of the draggable title bar.
  check('the pill has one place on the page', (await page.locator('#upRestart').count()) === 1);
  // AIG-346: it says Restart the app, and no Refresh pill shows next to it (the restart reloads the page anyway).
  check('the pill says Restart the app', /Restart the app/.test(await page.textContent('#upRestart')));
  check('no Refresh pill beside it', (await page.locator('#upRefresh button').count()) === 0);
  const region = await page.evaluate(() => { document.body.classList.add('desktop'); const st = getComputedStyle(document.querySelector('#upRestart button')); const r = st.webkitAppRegion || st.getPropertyValue('-webkit-app-region'); document.body.classList.remove('desktop'); return r; });
  check('in the app the pill is clickable (no-drag)', region === 'no-drag', region);
  page.once('dialog', d => d.accept());
  await page.click('#upRestart button');
  await sleep(400);
  check('clicking it asks for a restart (switched off in tests)', /Restarting/.test(await page.textContent('#upRestart')));
  noErrors(page);
}, true, { AIGILE_NO_RESTART: '1' });

def('pretend', '🧪 the trial\'s pretend team: fills a new project, answers an idea with a plan, hands work over after Go (AIG-205)', async (s) => {
  const T = 'http://127.0.0.1:4400', H = { 'Content-Type': 'application/json' };
  const tj = async (m, u, b) => (await fetch(T + u, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined })).json();
  const until = async (fn, ms = 20000) => { for (let t = Date.now(); Date.now() - t < ms; await sleep(400)) { const v = await fn(); if (v) return v; } return null; };
  const trial = await s.ok('POST', '/api/trial');
  await tj('POST', '/api/projects', { name: 'Pancake Shop', key: 'PAN', path: path.join(trial.projects, 'Pancake Shop') });
  await tj('POST', '/api/projects/pancake-shop/wake');
  const seeded = await until(async () => { const p = await tj('GET', '/api/projects/pancake-shop'); return (p.team || []).some(m => m.name === 'Lead (pretend)') && p.cards.some(c => c.status === 'verify') && p; });
  check('a new project gets a pretend lead and cards in every column, one to test', !!seeded && seeded.cards.length >= 5);
  const who = (await tj('GET', '/api/meta')).owner;   // a fresh trial board has the default owner name, not the real owner's
  const idea = await tj('POST', '/api/projects/pancake-shop/cards', { title: '💬 Gift cards', description: 'Gift cards', status: 'team', type: 'task', quick: true, createdBy: who });
  const planned = await until(async () => { const c = (await tj('GET', '/api/projects/pancake-shop')).cards.find(x => x.id === idea.id); return c && c.comments.some(m => /GO\?/.test(m.text)) && c; });
  check('an idea gets two cards and a plan with GO?', !!planned && planned.needsYou === true);
  const before = seeded.cards.filter(c => c.status === 'verify').length;
  await tj('POST', `/api/projects/pancake-shop/cards/${idea.id}/comments`, { author: who, text: 'GO' });
  const built = await until(async () => { const p = await tj('GET', '/api/projects/pancake-shop'); return p.cards.filter(c => c.status === 'verify').length > before && p; });
  check('after Go, the first card lands in For you with test steps', !!built && built.cards.some(c => c.status === 'verify' && /Gift cards/.test(c.title) && c.testSteps));
  // AIG-488: with the owner's language on nl, a fresh trial has Dutch projects and a Dutch pretend team
  await s.ok('POST', '/api/setup', { prefs: { lang: 'nl' } });
  const nlTrial = await s.ok('POST', '/api/trial');
  const names = fs.readdirSync(nlTrial.projects).sort();
  check('the made-up projects are named in Dutch', names.join() === 'Bandwebsite,Pannenkoekenwinkel,Tuinplanner' && /Een webwinkel voor pannenkoekenmix/.test(fs.readFileSync(path.join(nlTrial.projects, 'Pannenkoekenwinkel', 'README.md'), 'utf8')), names);
  await tj('POST', '/api/projects', { name: 'Pannenkoekenwinkel', key: 'PAN', path: path.join(nlTrial.projects, 'Pannenkoekenwinkel') });
  await tj('POST', '/api/projects/pannenkoekenwinkel/wake');
  const nlSeed = await until(async () => { const p = await tj('GET', '/api/projects/pannenkoekenwinkel'); return (p.team || []).some(m => m.name === 'Lead (pretend)') && p.cards.some(c => c.status === 'verify') && p; });
  check('and the pretend team makes Dutch cards', !!nlSeed && nlSeed.cards.some(c => c.title === 'Donkere modus') && nlSeed.cards.some(c => c.title === 'Een contactpagina' && /Open de pagina \*\*Contact\*\*/.test(c.testSteps)), nlSeed && nlSeed.cards.map(c => c.title));
  await s.ok('POST', '/api/setup', { prefs: { lang: 'en' } });
  await s.api('DELETE', '/api/trial');
}, false);

def('restartqueue', '🔄 restart while a team is busy: it restarts straight away (AIG-214)', async (s) => {
  await mkProject(s, 'Busy', 'BSY', { path: tmp('busy') });
  await s.ok('POST', '/api/projects/busy/wake');
  const r = await s.ok('POST', '/api/restart');
  check('it restarts straight away, even with a busy team (no queue)', r.ok === true && !r.queued && !r.waitingFor, r);
}, false, { AIGILE_NO_RESTART: '1' });
