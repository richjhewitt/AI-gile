// QA areas: i18n, usagecheck, popreopen (split from look-setup.mjs, AIG-297).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

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
  await page.waitForFunction(() => document.documentElement.lang === 'en' && /NL/.test(document.getElementById('enBtn')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});   // the button repaints just after the language loads
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
