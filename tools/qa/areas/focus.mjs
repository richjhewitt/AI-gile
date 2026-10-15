// QA area: focus (AIG-395). 🎯 Focus mode: one task fills the window, teams carry on the night way, only a lead's showstopper gets through.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('focus', '🎯 focus mode: needs-focus flag, the calm full-window screen, teams carry on quietly, showstoppers from leads only, Done + while-you-were-busy (AIG-395)', async (s, ctx) => {
  await mkProject(s, 'Home', 'HOM', { path: tmp('home') });
  await mkProject(s, 'Work', 'WRK', { path: tmp('work') });
  const task = await mkCard(s, 'home', 'Clean the kitchen', { status: 'todo', assignee: 'Rich', description: 'Counters first, then the floor', focus: true });
  const other = await mkCard(s, 'work', 'Some team card', { status: 'todo' });
  check('a card can carry the needs-focus flag', (await getCard(s, 'home', task.id)).focus === true && !(await getCard(s, 'work', other.id)).focus);

  /* ---------- the server side ---------- */
  check('not in focus: nothing is reported', !(await s.ok('GET', '/api/meta')).focus && !(await s.ok('GET', '/api/focus')).project);
  check('showstopper outside focus is refused', (await s.api('POST', '/api/focus/showstopper', { project: 'work', id: other.id, why: 'x', author: 'Lead' })).status === 409);
  const st = await s.ok('POST', '/api/focus/start', { project: 'home', id: task.id });
  check('start: the task, its notes and a running timer', st.title === 'Clean the kitchen' && st.notes === 'Counters first, then the floor' && st.paused === false);
  check('a second start is refused', (await s.api('POST', '/api/focus/start', { project: 'home', id: task.id })).status === 409);
  check('every window sees it (meta carries it)', (await s.ok('GET', '/api/meta')).focus?.id === task.id);
  check('teams carry on the night way: the watchman is on, no going-quiet card, the board is not "quiet"', !!(await s.ok('GET', '/api/watchman')) && !(await s.ok('GET', '/api/meta')).quiet
    && !(await s.ok('GET', '/api/projects/work')).cards.some(c => /Going quiet/.test(c.title)));
  check('focus state survives in a file (so a restart or a pop-out agrees)', fs.existsSync(path.join(s.data, 'focus.conf')));
  // 🚨 showstoppers
  const bad = await s.api('POST', '/api/focus/showstopper', { project: 'work', id: other.id, why: 'prod is down', author: 'Frontend (Sonnet)' });
  check('a team member cannot mark a showstopper', bad.status === 403);
  const cli = s.cli(['showstopper', 'work', other.id, 'prod is down', '--as', 'Lead']);
  check('a lead can, with the CLI', cli.code === 0 && /showstopper/.test(cli.out), cli);
  check('it is on the card for the owner, and the screen gets one line', (await getCard(s, 'work', other.id)).needsYou === true && (await s.ok('GET', '/api/focus')).stops[0].why === 'prod is down');
  check('the same card twice is refused', (await s.api('POST', '/api/focus/showstopper', { project: 'work', id: other.id, why: 'again', author: 'Lead' })).status === 429);
  const c2 = await mkCard(s, 'work', 'Second'), c3 = await mkCard(s, 'work', 'Third'), c4 = await mkCard(s, 'work', 'Fourth');
  await s.ok('POST', '/api/focus/showstopper', { project: 'work', id: c2.id, why: 'two', author: '🧭 Lead Scrum Master' });
  await s.ok('POST', '/api/focus/showstopper', { project: 'work', id: c3.id, why: 'three', author: 'Lead' });
  check('rate limit: at most 3 an hour', (await s.api('POST', '/api/focus/showstopper', { project: 'work', id: c4.id, why: 'four', author: 'Lead' })).status === 429);
  // pause
  const pa = await s.ok('POST', '/api/focus/pause'); await sleep(1100);
  check('pause stops the timer', pa.paused && (await s.ok('GET', '/api/focus')).elapsedMs === pa.elapsedMs);
  check('resume carries on', (await s.ok('POST', '/api/focus/resume')).paused === false);
  // something handed over meanwhile
  const h = await mkCard(s, 'work', 'Handed over', { status: 'doing' });
  await s.ok('PATCH', `/api/projects/work/cards/${h.id}`, { status: 'verify' });
  const done = await s.ok('POST', '/api/focus/done');
  check('Done: the card is done, with a note', (await getCard(s, 'home', task.id)).status === 'done' && /Done in/.test((await getCard(s, 'home', task.id)).comments.at(-1).text));
  check('while you were busy: counts of hand-overs, questions and showstoppers', done.handedOver === 1 && done.questions === 3 && done.showstoppers === 3, done);
  check('focus is over, the watchman is off again, the summary is given once', !(await s.ok('GET', '/api/meta')).focus && !(await s.ok('GET', '/api/watchman')) && (await s.ok('GET', '/api/focus/summary')).title === task.title && !(await s.ok('GET', '/api/focus/summary')).title);

  /* ---------- the previous mode comes back ---------- */
  await s.ok('POST', '/api/quiet', { on: true, watch: ['work'] });
  const t2 = await mkCard(s, 'home', 'Second task', { status: 'todo', focus: true });
  await s.ok('POST', '/api/focus/start', { project: 'home', id: t2.id });
  await s.ok('POST', '/api/focus/pause');
  await s.ok('POST', '/api/focus/leave');
  check('already quiet before: still quiet after (and the card is not done when you leave)', !!(await s.ok('GET', '/api/meta')).quiet && !!(await s.ok('GET', '/api/watchman')) && (await getCard(s, 'home', t2.id)).status === 'todo');
  await s.ok('POST', '/api/quiet', { on: false });

  /* ---------- the page ---------- */
  const t3 = await mkCard(s, 'home', 'Page task', { status: 'todo', focus: true, description: 'Do it calmly' });
  const page = await openPage(ctx, '#/p/home/' + t3.id);
  await page.waitForSelector('.panel');
  check('the card shows ▶ Start focus', await page.locator('button:has-text("Start focus")').count() === 1);
  await page.click('button:has-text("Start focus")');
  await page.waitForSelector('.fx-done');
  const vis = await page.evaluate(() => [...document.body.children].filter(e => e.tagName !== 'SCRIPT' && getComputedStyle(e).display !== 'none').map(e => e.id));
  check('the window is just the task: nothing else visible', vis.length === 1 && vis[0] === 'focusScreen', vis);
  check('title, notes, timer, a big Done and a small Pause', /Page task/.test(await page.textContent('.fx-title')) && /Do it calmly/.test(await page.textContent('.fx-notes')) && /just started|min/.test(await page.textContent('#fxTime'))
    && (await page.locator('.fx-done').boundingBox()).width > 400 && (await page.locator('.fx-small button').count()) === 1);
  await page.reload(); await page.waitForSelector('.fx-done', { timeout: 8000 });
  check('survives a refresh', /Page task/.test(await page.textContent('.fx-title')));
  await s.ok('POST', '/api/focus/showstopper', { project: 'home', id: t3.id, why: 'Water is leaking', author: 'Lead' });
  await page.waitForSelector('.fx-stop', { timeout: 8000 });
  check('a showstopper shows as one small line on top', (await page.locator('.fx-stop').count()) === 1 && /Water is leaking/.test(await page.textContent('.fx-stop')));
  const glance = await openPage(ctx, '#/pop-night');
  await glance.waitForSelector('.ng');
  check('the night glance still works on a second screen', await glance.locator('.ng-list li').count() >= 1 && await glance.evaluate(() => !document.documentElement.hasAttribute('data-focus')));
  await glance.close();
  await page.click('.fx-small button');   // pause
  await page.waitForSelector('.fx-small button:has-text("Resume")');
  check('paused: Resume and a way out', await page.locator('.fx-small button').count() === 2);
  await page.click('.fx-small button:has-text("Resume")');
  await page.waitForSelector('.fx-small button:has-text("Pause")');
  await page.click('.fx-done');
  await page.waitForSelector('#dialog h3', { timeout: 8000 });
  check('Done: the screen goes, the two-line summary shows', await page.locator('.fx-done').count() === 0 && /While you were busy/.test(await page.textContent('#dialog')) && (await page.locator('#dialog p').count()) === 2);
  check('the card is done', (await getCard(s, 'home', t3.id)).status === 'done');
  noErrors(page);
}, true);
