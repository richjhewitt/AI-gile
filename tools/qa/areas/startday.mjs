// QA area: startday (AIG-797): 🌅 Start my day. One check-in dialog, offered once each morning when Setup has it on and openable from
// home: tasks for you, tests waiting, life admin due today (reminders, life cards, meds times), the unread mail count when a mailbox is
// set up, a jump button for each, "Done for now", and the 🎯 Today picker as step 1 instead of a second dialog. Date-proof (today.stub),
// No AI mode on, phone width and dark mode.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('startday', '🌅 Start my day: one morning check-in (tasks, tests, life admin, mail count), jump buttons, Done for now, Today picker as step 1, once a day, No AI, phone + dark (AIG-797)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  const stub = path.join(s.data, 'today.stub');
  fs.writeFileSync(stub, '2031-06-01');
  const lf = path.join(s.dir, 'aigile.local.json');

  // Server: the switch and the once-a-day memory
  let d = await s.ok('GET', '/api/daystart');
  check('off by default: never asks', d.on === false && d.ask === false);
  await s.ok('POST', '/api/setup', { prefs: { dayStart: true } });
  check('the setup switch is saved with the other prefs', (await s.ok('GET', '/api/setup')).prefs.dayStart === true);
  d = await s.ok('GET', '/api/daystart');
  check('on: the first open of the day asks', d.on === true && d.ask === true && d.day === '2031-06-01');
  d = await s.ok('POST', '/api/daystart/seen');
  check('seen: asked no more that day', d.ask === false && (await s.ok('GET', '/api/daystart')).ask === false);
  fs.writeFileSync(stub, '2031-06-02');
  check('next morning: asks again', (await s.ok('GET', '/api/daystart')).ask === true);

  // Something in each box
  await mkCard(s, 'alpha', 'Fill in the form', { assignee: 'Owner', status: 'todo' });
  await mkCard(s, 'alpha', 'Hoover', { lifeType: 'housework' });
  await mkCard(s, 'beta', 'Check the login', { status: 'verify', assignee: 'Lead' });
  await s.ok('POST', '/api/lifeadmin/reminders', { text: 'Ring the plumber', due: new Date(Date.now() - 600e3).toISOString() });
  await s.ok('POST', '/api/lifeadmin/reminders', { text: 'Not this week', due: new Date(Date.now() + 40 * 864e5).toISOString() });
  check('only today\'s or overdue reminders are due', (await s.ok('GET', '/api/daystart')).lifeDue.map(x => x.text).join() === 'Ring the plumber');
  await s.ok('POST', '/api/setup', { prefs: { todayPick: true } });
  check('the picker is waiting', (await s.ok('GET', '/api/today')).askPick === true);

  // The page opens it by itself, with the picker as step 1 (no second dialog)
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#mdBody', { timeout: 15000 });
  await sleep(4500);   // the picker's own poll runs every 3 s: it must stay quiet
  check('it opens by itself', await page.locator('#dialog .overlay').count() === 1);
  check('step 1 is the Today picker inside it, ticked', await page.locator('#md-pick #todayPickList input:checked').count() === 2);
  check('tasks: one waiting for you', /1 task/.test(await page.textContent('#md-tasks')), await page.textContent('#md-tasks'));
  check('tests: one waiting', /1 test/.test(await page.textContent('#md-tests')), await page.textContent('#md-tests'));
  const life = await page.textContent('#md-life');
  check('life admin lists the due reminder and the life task', /Ring the plumber/.test(life) && !/Not this week/.test(life) && /1 life task/.test(life), life);
  check('no mailbox: no mail section', await page.locator('#md-mail').count() === 0);
  check('plain buttons to jump to each, and Done for now', await page.locator('#md-tasks [data-go], #md-tests [data-go], #md-life [data-go]').count() === 3 && /Done for now/.test(await page.textContent('#mdDone')));
  // Step 1 answered inside the same dialog
  await page.uncheck('#todayPickList input[value="beta"]');
  await page.click('#todayPickGo');
  await page.waitForFunction(() => !document.querySelector('#md-pick') && document.querySelector('#mdBody'), null, { timeout: 8000 });
  const t1 = await s.ok('GET', '/api/today');
  check('the picker was answered from the dialog: Beta rests, no second dialog', t1.askPick === false && t1.projects.find(p => p.slug === 'beta').weight === 'rest' && await page.locator('#dialog .overlay').count() === 1);
  await page.click('#mdDone');
  check('Done for now closes it', await page.locator('#dialog .overlay').count() === 0);
  await page.reload(); await page.waitForSelector('#app > *'); await sleep(4500);
  check('and it is not offered again the same day', await page.locator('#mdBody').count() === 0);

  // Open from home any time, jump buttons
  await page.click('button[onclick="MyDay.open()"]');
  await page.waitForSelector('#md-life');
  await page.click('#md-life [data-go]');
  check('Open life admin closes it and goes there', await page.evaluate(() => location.hash) === '#/life' && await page.locator('#dialog .overlay').count() === 0);
  await page.goto(page.url().split('#')[0] + '#/'); await page.waitForSelector('a.proj');
  await page.click('button[onclick="MyDay.open()"]');
  await page.waitForSelector('#md-tasks [data-go]');
  await page.click('#md-tasks [data-go]');
  check('Open inbox goes to the inbox', await page.evaluate(() => location.hash) === '#/inbox');

  // Mail count only, once a mailbox exists (stubbed answers, no mail content is read)
  await ctx.route('**/api/mail/config', r => r.fulfill({ json: { boxes: [{ id: 'mb1', name: 'Home' }] } }));
  await ctx.route('**/api/mail/inbox?*', r => r.fulfill({ json: { box: { id: 'mb1' }, items: [{ unread: true }, { unread: false }, { unread: true }, { unread: true }], cached: true } }));
  await page.goto(page.url().split('#')[0] + '#/'); await page.waitForSelector('a.proj');
  await page.click('button[onclick="MyDay.open()"]');
  await page.waitForSelector('#md-mail');
  check('mail section shows just the unread count', /3 unread mails/.test(await page.textContent('#md-mail')) && await page.locator('#md-mail [data-go]').count() === 1, await page.textContent('#md-mail'));
  // Meds times from self-care
  await page.evaluate(() => { localStorage.setItem('aigile.selfcare', JSON.stringify({ on: true, items: {}, custom: [], quiet: { on: false, from: '22:00', to: '07:00' }, meds: { on: true, times: ['08:00', '20:00'] } })); });
  await page.reload(); await page.waitForSelector('a.proj');
  await page.click('button[onclick="MyDay.open()"]');
  await page.waitForSelector('#md-life');
  check('meds times with no tick yet are listed under life admin', /Meds at 08:00/.test(await page.textContent('#md-life')) && /Meds at 20:00/.test(await page.textContent('#md-life')), await page.textContent('#md-life'));

  // Phone width and dark mode
  await page.setViewportSize({ width: 390, height: 800 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await sleep(300);
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('phone width: the dialog fits and Done for now is on screen', await page.evaluate(() => { const r = document.querySelector('#dialog .dialog').getBoundingClientRect(), b = document.getElementById('mdDone').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && b.right <= window.innerWidth + 1 && b.left >= 0; }));
  const lum = c => { const m = c.match(/\d+/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const col = await page.evaluate(() => { const e = document.querySelector('#md-tasks .md-what'); let b = e; while (b && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(b).backgroundColor)) b = b.parentElement; return { fg: getComputedStyle(e).color, bg: getComputedStyle(b || document.body).backgroundColor }; });
  check('dark mode: light text on a dark dialog', lum(col.fg) > 140 && lum(col.bg) < 110, col);
  check('no AI call and no card change: the owner\'s cards are as they were', (await s.ok('GET', '/api/projects/alpha')).cards.length === 2);
  noErrors(page);
  await page.keyboard.press('Escape');
  fs.rmSync(stub, { force: true });
  await s.ok('POST', '/api/setup', { prefs: { dayStart: false, todayPick: false } });
  check('switched off, the setting is gone from the file', !('dayStart' in JSON.parse(fs.readFileSync(lf, 'utf8'))));
}, true);
