// QA area: lifeadmin (AIG-798): life admin without tokens. Plain reminders (one-off or repeating) and simple lists, each item with
// Tick / Snooze / Delete, kept in data/lifeadmin.conf. Nothing here makes a card, wakes an agent or calls an AI; it runs in No AI
// mode. Date-proof: every date is made from "now". Old or broken saved data never breaks the page.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('lifeadmin', '🏡 life admin without tokens: reminders (once or repeating), lists, tick / snooze / delete, no card and no wake, broken file safe, No AI, phone + dark (AIG-798)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  const file = path.join(s.data, 'lifeadmin.conf');
  const api = () => s.ok('GET', '/api/lifeadmin');
  const hour = 3600e3, wakeBefore = fs.existsSync(s.wakeOut);

  // Old or broken saved data
  fs.writeFileSync(file, '{not json');
  let v = await api();
  check('a broken file reads as empty, not an error', v.reminders.length === 0 && v.lists.length === 0);
  fs.writeFileSync(file, JSON.stringify({ reminders: 'x', lists: [null] }));
  check('a wrong shape reads as empty too', (await s.api('GET', '/api/lifeadmin')).status === 200);
  fs.rmSync(file, { force: true });

  // One-off reminder
  const r1 = await s.ok('POST', '/api/lifeadmin/reminders', { text: 'Call the dentist', due: new Date(Date.now() + 2 * hour).toISOString() });
  check('a reminder is saved with an id and no repeat', /^r\d+$/.test(r1.id) && r1.repeat === '' && r1.done === false);
  check('empty text and a bad repeat or date are refused', (await s.api('POST', '/api/lifeadmin/reminders', { text: ' ' })).status === 400
    && (await s.api('POST', '/api/lifeadmin/reminders', { text: 'x', repeat: 'hourly' })).status === 400
    && (await s.api('POST', '/api/lifeadmin/reminders', { text: 'x', due: 'whenever' })).status === 400);
  const t1 = await s.ok('POST', `/api/lifeadmin/${r1.id}/tick`);
  check('tick marks it done, tick again puts it back', t1.done === true && (await s.ok('POST', `/api/lifeadmin/${r1.id}/tick`)).done === false);
  const sn = await s.ok('POST', `/api/lifeadmin/${r1.id}/snooze`, { mins: 60 });
  check('snooze 60 minutes sets the time', Math.abs(Date.parse(sn.snoozedUntil) - (Date.now() + hour)) < 5000, sn.snoozedUntil);
  const tm = await s.ok('POST', `/api/lifeadmin/${r1.id}/snooze`, { tomorrow: true }), td = new Date(tm.snoozedUntil);
  check('tomorrow is 09:00 the next day (local)', td.getHours() === 9 && td.getMinutes() === 0 && td > new Date(Date.now() + 1 * hour), tm.snoozedUntil);
  check('a bad snooze is refused', (await s.api('POST', `/api/lifeadmin/${r1.id}/snooze`, { mins: 0 })).status === 400);
  check('a snoozed reminder is not counted as due today', (await api()).dueToday === 0);

  // Repeating
  const past = new Date(Date.now() - 2 * 864e5 - hour).toISOString();
  const r2 = await s.ok('POST', '/api/lifeadmin/reminders', { text: 'Take the bins out', due: past, repeat: 'daily' });
  check('an old repeating reminder is overdue and due today', (await api()).reminders.find(x => x.id === r2.id).overdue === true && (await api()).dueToday === 1);
  const t2 = await s.ok('POST', `/api/lifeadmin/${r2.id}/tick`);
  check('ticking a daily reminder moves it on past now, not done', t2.done === false && Date.parse(t2.due) > Date.now() && Date.parse(t2.due) - Date.now() <= 864e5 && !!t2.lastDone, t2);
  const r3 = await s.ok('POST', '/api/lifeadmin/reminders', { text: 'Pay rent', due: past, repeat: 'monthly' });
  const t3 = await s.ok('POST', `/api/lifeadmin/${r3.id}/tick`);
  check('monthly moves forward by months', Date.parse(t3.due) > Date.now() && Date.parse(t3.due) - Date.now() <= 32 * 864e5, t3.due);
  const r4 = await s.ok('POST', '/api/lifeadmin/reminders', { text: 'Weekly shop', due: past, repeat: 'weekly' });
  check('weekly moves forward by a week at most', Date.parse((await s.ok('POST', `/api/lifeadmin/${r4.id}/tick`)).due) - Date.now() <= 7 * 864e5);

  // Lists
  const l1 = await s.ok('POST', '/api/lifeadmin/lists', { name: 'Shopping' });
  check('a list is saved', /^l\d+$/.test(l1.id) && l1.items.length === 0 && (await s.api('POST', '/api/lifeadmin/lists', { name: '' })).status === 400);
  const i1 = await s.ok('POST', `/api/lifeadmin/${l1.id}/items`, { text: 'Milk' });
  const i2 = await s.ok('POST', `/api/lifeadmin/${l1.id}/items`, { text: 'Bread' });
  check('items go on the list; a missing list is a 404', (await api()).lists[0].items.length === 2 && (await s.api('POST', '/api/lifeadmin/l999/items', { text: 'x' })).status === 404);
  check('an item can be ticked, snoozed and deleted', (await s.ok('POST', `/api/lifeadmin/${i1.id}/tick`)).done === true
    && !!(await s.ok('POST', `/api/lifeadmin/${i2.id}/snooze`, { tomorrow: true })).snoozedUntil
    && (await s.ok('DELETE', `/api/lifeadmin/${i1.id}`)).ok && (await api()).lists[0].items.length === 1);
  check('a list cannot be ticked or snoozed, only deleted', (await s.api('POST', `/api/lifeadmin/${l1.id}/tick`)).status === 400);
  check('unknown ids are a 404', (await s.api('DELETE', '/api/lifeadmin/r999')).status === 404);

  // Never a card, never a wake, never AI
  check('no card was made and no agent woken', (await s.ok('GET', '/api/projects/alpha')).cards.length === 0 && fs.existsSync(s.wakeOut) === wakeBefore);
  check('the data is a plain file, not a project (.conf)', fs.existsSync(file) && !(await s.ok('GET', '/api/projects')).some(p => /life/i.test(p.slug)));

  // The page
  await s.ok('DELETE', `/api/lifeadmin/${r2.id}`); await s.ok('DELETE', `/api/lifeadmin/${r3.id}`); await s.ok('DELETE', `/api/lifeadmin/${r4.id}`); await s.ok('DELETE', `/api/lifeadmin/${l1.id}`); await s.ok('DELETE', `/api/lifeadmin/${r1.id}`);
  const page = await openPage(ctx, '#/');
  check('home has a Life admin link', await page.locator('a.navlink[href="#/life"]').count() === 1);
  await page.click('a.navlink[href="#/life"]');
  await page.waitForSelector('#laText');
  check('empty page says so', await page.locator('#laReminders .muted').count() === 1);
  await page.fill('#laText', 'Book <b>MOT</b>');
  await page.selectOption('#laRepeat', 'weekly');
  await page.click('.la-remform button[type=submit]');
  await page.waitForSelector('#laReminders .la-row');
  check('a reminder added in the page shows, escaped, with its repeat', (await page.textContent('#laReminders .la-row')).includes('Book <b>MOT</b>') && /Every week/.test(await page.textContent('#laReminders .la-row')) && await page.locator('#laReminders b b').count() === 0);
  await page.fill('#laText', '');
  await page.click('.la-remform button[type=submit]');
  check('an empty reminder shows the friendly line', /Type what to remind/.test(await page.textContent('#laErr')));
  await page.fill('#laListName', 'To pack'); await page.click('#laListName ~ button');
  await page.waitForSelector('.la-list');
  await page.fill('.la-list input[id^=laItem]', 'Passport'); await page.click('.la-list .la-add button');
  await page.waitForSelector('.la-list .la-row');
  await page.fill('.la-list input[id^=laItem]', 'Charger'); await page.click('.la-list .la-add button');
  await page.waitForFunction(() => document.querySelectorAll('.la-list .la-row').length === 2);
  await page.click('.la-list .la-row >> nth=0 >> [data-la=tick]');
  await page.waitForSelector('.la-list .la-row.done');
  check('ticking an item strikes it through', await page.locator('.la-list .la-row.done').count() === 1);
  await page.click('.la-list .la-row >> nth=1 >> [data-la=tomorrow]');
  await page.waitForSelector('.la-list .la-row.asleep');
  check('snoozing an item greys it with the time', /snoozed until/.test(await page.textContent('.la-list .la-row.asleep')));
  await page.click('#laReminders .la-row >> [data-la=snooze]');
  await page.waitForSelector('#laReminders .la-row.asleep');
  check('snoozing a reminder shows when it is back', /snoozed until/.test(await page.textContent('#laReminders .la-row')));
  await page.reload(); await page.waitForSelector('.la-list');
  check('everything survives a reload', await page.locator('.la-list .la-row').count() === 2 && await page.locator('#laReminders .la-row').count() === 1);

  // phone width and dark mode
  await page.setViewportSize({ width: 390, height: 800 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await sleep(300);
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('phone width: the buttons are all on screen', await page.evaluate(() => [...document.querySelectorAll('.la-row .la-btns button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; })));
  const lum = c => { const m = c.match(/\d+/g).map(Number); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const col = await page.evaluate(() => { const e = document.querySelector('.la-row .la-text'); let b = e; while (b && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(b).backgroundColor)) b = b.parentElement; return { fg: getComputedStyle(e).color, bg: getComputedStyle(b || document.body).backgroundColor }; });
  check('dark mode: light text on a dark background', lum(col.fg) > 140 && lum(col.bg) < 110, col);
  await page.click('#laReminders .la-row [data-la=delete]');
  await page.waitForFunction(() => document.querySelectorAll('#laReminders .la-row').length === 0);
  check('delete removes the reminder', (await api()).reminders.length === 0);
  check('still no card and no wake after all that', (await s.ok('GET', '/api/projects/alpha')).cards.length === 0 && fs.existsSync(s.wakeOut) === wakeBefore);
  noErrors(page);
  await s.ok('POST', '/api/setup', { prefs: { noAi: false } }).catch(() => {});
}, true);
