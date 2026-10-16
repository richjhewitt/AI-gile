// QA areas: inbox, foryou, fynext, queue, servertask, blocked, usage.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, sleep, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('inbox', 'top-bar counts, project tabs, inline answer, task Done', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Alpha question', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', 'ALP-1', 'Forge', 'which colour?', { needsYou: true });
  await mkCard(s, 'alpha', 'Alpha task', { status: 'doing', assignee: 'Pixel' });
  await s.ok('PATCH', '/api/projects/alpha/cards/ALP-2', { assignee: 'Owner' });
  await say(s, 'alpha', 'ALP-2', 'Pixel', 'please add the key');
  await mkCard(s, 'alpha', 'Alpha test', { status: 'verify', testSteps: 'try it' });
  await mkCard(s, 'beta', 'Beta question', { status: 'doing' });
  await say(s, 'beta', 'BET-1', 'Forge', 'beta ask?', { needsYou: true });
  const page = await openPage(ctx, '#/p/beta');
  await page.waitForSelector('#inboxTop .ib-btn');
  const top = await page.textContent('#inboxTop .ib-btn');
  check('top bar shows 2 questions', /2 questions/.test(top), top);
  check('top bar shows 1 to do', /1 to do/.test(top), top);
  check('top bar shows 1 to test', /1 to test/.test(top), top);
  await page.click('#inboxTop .ib-btn');
  await page.waitForSelector('#ibTabs button');
  const order = () => page.$$eval('#ibTabs button', els => els.map(e => e.dataset.tab));
  check('opened from beta: beta first, All last', JSON.stringify(await order()) === JSON.stringify(['beta', 'alpha', 'all']), await order());
  check('beta tab selected', (await page.getAttribute('#ibTabs .on', 'data-tab')) === 'beta');
  await page.waitForTimeout(2500);
  check('tabs stay put after polling', JSON.stringify(await order()) === JSON.stringify(['beta', 'alpha', 'all']) && (await page.getAttribute('#ibTabs .on', 'data-tab')) === 'beta');
  await page.click('#ibTabs button[data-tab=alpha]');
  check('alpha tab shows its three items', (await page.locator('.ib-item').count()) === 3);

  const q = page.locator('.ib-item.q[data-id="ALP-1"] textarea');
  await q.fill('blue please');
  await page.waitForTimeout(2300);
  check('answer text survives polling', (await q.inputValue()) === 'blue please');
  await q.press('Enter');
  await page.waitForSelector('.ib-item.q[data-id="ALP-1"]', { state: 'detached' });
  const c1 = await getCard(s, 'alpha', 'ALP-1');
  check('inline answer sent to the team', c1.comments.at(-1).text === 'blue please' && c1.status === 'team' && !c1.needsYou, [c1.status, c1.needsYou]);

  // AIG-867: Snooze on a task puts it off, never done, team not told; it comes back when the snooze ends.
  const k0 = await getCard(s, 'alpha', 'ALP-2'), n0 = k0.comments.length;
  const laters = await page.$$eval('.ib-item button[data-act=wait]', bs => bs.map(b => b.textContent.trim()));   // AIG-1137: one name everywhere
  check('question and task both say Later (1 h)', laters.length >= 2 && laters.every(x => x === '⏳ Later (1 h)'), laters);
  await page.click('.ib-item.k[data-id="ALP-2"] button[data-act=wait]');
  await page.waitForSelector('.ib-item.k[data-id="ALP-2"]', { state: 'detached' });
  const ks = await getCard(s, 'alpha', 'ALP-2');
  check('task Snooze hides it for about an hour, not done, nothing sent', ks.status === k0.status && ks.assignee === k0.assignee && ks.comments.length === n0 && Math.abs(new Date(ks.snoozedUntil) - Date.now() - 3600e3) < 60e3, ks);
  await s.ok('DELETE', '/api/projects/alpha/cards/ALP-2/snooze');
  await page.waitForSelector('.ib-item.k[data-id="ALP-2"]', { timeout: 8000 });
  check('snoozed task is back when the snooze ends', true);

  await page.click('.ib-item.k[data-id="ALP-2"] button[data-act=taskdone]');
  await page.waitForSelector('.ib-item.k[data-id="ALP-2"]', { state: 'detached' });
  const c2 = await getCard(s, 'alpha', 'ALP-2');
  check('task Done tells the team', c2.status === 'team' && c2.assignee === 'Pixel' && /Done/.test(c2.comments.at(-1).text), [c2.status, c2.assignee]);

  // AIG-1136: Send back is a button that opens a one-line reason box; Send greys out until something is typed.
  const row = '.ib-item.t[data-id="ALP-3"]';
  check('Send back is a button, reason box hidden', (await page.locator(row + ' button[data-act=sbopen]').count()) === 1 && await page.locator(row + ' .ib-sb').isHidden());
  await page.click(row + ' button[data-act=sbopen]');
  check('Send back opens the box, Send is greyed out', await page.locator(row + ' .ib-sb textarea').isVisible() && await page.locator(row + ' button[data-act=sbsend]').isDisabled());
  check('with the box open there is one Send back, not two (AIG-1373)', await page.locator(row + ' button[data-act=sbopen]').isHidden() && (await page.locator(row + ' button:visible', { hasText: 'Send back' }).count()) === 1);
  await page.fill(row + ' .ib-sb textarea', 'wrong colour');
  check('typing a reason enables Send', await page.locator(row + ' button[data-act=sbsend]').isEnabled());
  await page.click(row + ' button[data-act=sbcancel]');
  check('Cancel closes the box and nothing is sent', await page.locator(row + ' .ib-sb').isHidden() && (await getCard(s, 'alpha', 'ALP-3')).status === 'verify');
  check('after Cancel the Send back button is back', await page.locator(row + ' button[data-act=sbopen]').isVisible());
  await page.click(row + ' button[data-act=sbopen]');
  await page.fill(row + ' .ib-sb textarea', 'wrong colour');
  await page.click(row + ' button[data-act=sbsend]');
  await page.waitForSelector(row, { state: 'detached' });
  const sb = await getCard(s, 'alpha', 'ALP-3');
  check('Send back from the row returns it to the team with the reason', sb.status !== 'verify' && sb.comments.at(-1).text.includes('wrong colour'), [sb.status, sb.comments.at(-1)]);
  await s.ok('PATCH', '/api/projects/alpha/cards/ALP-3', { status: 'verify' });
  await page.waitForSelector(row, { timeout: 8000 });
  await page.click('.ib-item.t[data-id="ALP-3"] button[data-act=accept]');
  await page.waitForSelector('.ib-item.t[data-id="ALP-3"]', { state: 'detached' });
  check('Accept from the inbox', (await getCard(s, 'alpha', 'ALP-3')).status === 'done');
  await page.waitForTimeout(1500);
  const top2 = await page.textContent('#inboxTop .ib-btn');
  check('top bar counts update', /1 question\b/.test(top2) && !/to do/.test(top2) && !/to test/.test(top2), top2);
  noErrors(page);
}, true);

def('foryou', 'For you column: tests, questions, tasks and blocks together; chips pick what comes first (AIG-106)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const t = await mkCard(s, 'alpha', 'A test', { status: 'verify', testSteps: 's' });
  const q = await mkCard(s, 'alpha', 'A question', { status: 'doing' });
  const k = await mkCard(s, 'alpha', 'A task', { status: 'todo' });
  const other = await mkCard(s, 'alpha', 'Not mine', { status: 'todo' });
  s.cli(['ask', 'alpha', q.id, 'Go?', '--as', 'Lead']); s.cli(['task', 'alpha', k.id, 'log in', '--as', 'Lead']);
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');
  const ids = async () => page.$$eval('.column.foryou .card', els => els.map(e => e.dataset.id));
  check('all three kinds in For you', (await ids()).length === 3 && !(await ids()).includes(other.id), await ids());
  check('they are not repeated in their own columns', (await page.locator(`.column[data-status="doing"] .card[data-id="${q.id}"]`).count()) === 0);
  check('questions first by default', (await ids())[0] === q.id);
  await page.click('.fy-chip[data-first="t"]');
  await page.waitForFunction(id => document.querySelector('.column.foryou .card')?.dataset.id === id, t.id, { timeout: 3000 }).catch(() => {});
  check('Tests chip puts the test first', (await ids())[0] === t.id, await ids());
  await page.reload(); await page.waitForSelector('.column.foryou .card');
  check('the pick is remembered', (await ids())[0] === t.id && await page.isVisible('.fy-chip.on[data-first="t"]'));
  await page.click('.fy-chip[data-first="k"]'); await page.click('.fyf-x'); await page.waitForSelector('.fyf', { state: 'detached' });   // a chip now opens the fold window (AIG-738); close it
  await page.waitForFunction(id => document.querySelector('.column.foryou .card')?.dataset.id === id, k.id, { timeout: 3000 }).catch(() => {});
  check('Tasks chip puts the task first', (await ids())[0] === k.id, await ids());
  noErrors(page);
}, true);

def('fynext', 'For you: focus on that column only; dealing with a card opens the next one (AIG-141)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Test one', { status: 'verify', testSteps: 'do it' });
  await sleep(20);
  const b = await mkCard(s, 'alpha', 'Test two', { status: 'verify', testSteps: 'do it' });
  await mkCard(s, 'alpha', 'Other work', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('.column.foryou .fy-head');
  await page.waitForFunction(() => document.querySelectorAll('.board .column').length === 1);
  check('focus shows only For you', (await page.locator('.board .column').count()) === 1);
  const fy = await page.evaluate(() => { const c = document.querySelector('.column.foryou').getBoundingClientRect(), b = document.querySelector('.board').getBoundingClientRect(); return { w: c.width, mid: Math.abs((c.left + c.right) / 2 - (b.left + b.right) / 2) }; });
  check('the focused column is wide and central', fy.w > 500 && fy.mid < 20, JSON.stringify(fy));
  await page.click('.column.foryou .fy-head');
  await page.waitForFunction(() => document.querySelectorAll('.board .column').length > 1);
  check('click again shows all', (await page.locator('.board .column').count()) > 1);
  await page.goto(BASE + '/#/p/alpha/' + a.id);
  await page.click('.verdict button:has-text("Accept")');
  await page.waitForFunction(id => location.hash.endsWith('/' + id), b.id, { timeout: 4000 }).catch(() => {});
  check('accepting opens the next test', page.url().endsWith('/' + b.id), page.url());
  await page.click('.verdict button:has-text("Accept")');
  await page.waitForFunction(() => location.hash === '#/p/alpha', null, { timeout: 4000 }).catch(() => {});
  check('last one closes back to the board', page.url().endsWith('#/p/alpha'), page.url());
  noErrors(page);
}, true);

def('queue', 'your queue: holds up, your priority, kind, time; sorted, filtered, Next up (AIG-159..162)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Pick a colour'), b = await mkCard(s, 'alpha', 'Restart the server'), c = await mkCard(s, 'alpha', 'Read the plan');
  s.cli(['ask', 'alpha', a.id, 'Blue or green?', '--as', 'Lead', '--mins', '1']);
  s.cli(['task', 'alpha', b.id, 'run it on the server', '--as', 'Lead', '--kind', 'server', '--holds', 'ALP-7,ALP-8,ALP-9', '--mins', '5']);
  s.cli(['ask', 'alpha', c.id, 'Read this?', '--as', 'Lead', '--kind', 'read', '--prio', 'whenever']);
  check('bad kind refused', s.cli(['ask', 'alpha', a.id, 'x', '--as', 'Lead', '--kind', 'nope']).code !== 0);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibNext a');
  check('Next up is what holds most up', (await page.textContent('#ibNext')).includes('Restart the server'), await page.textContent('#ibNext'));
  check('chips show holds and time', (await page.textContent(`.ib-item[data-id="${b.id}"]`)).includes('holds up 3') && (await page.textContent(`.ib-item[data-id="${b.id}"]`)).includes('5 min'));
  check('total time shows', (await page.textContent('#ibKinds')).includes('6 min in all'));
  await page.click('#ibKinds [data-kind="server"]');
  await sleep(300);
  check('kind filter shows only server jobs', (await page.locator(`.ib-item[data-id="${b.id}"]`).count()) === 1 && (await page.locator('.ib-item.k, .ib-item.t').count()) === 1);
  await page.click('#ibKinds [data-kind=""]');
  await page.hover('#ibNext .q-chips'); await sleep(300);   // an unset priority chip only shows on hover (AIG-939)
  await page.click(`#ibNext [data-prio]`);   // none -> now on the Next up item
  await sleep(600);
  check('clicking 🔥 sets your priority', (await getCard(s, 'alpha', b.id)).ownerPrio === 'now');
  // AIG-1293: the project pill opens that board, by click and by keyboard
  const pill = `.ib-item[data-id="${a.id}"] .ib-proj`;
  check('the project pill is a link you can Tab to', (await page.getAttribute(pill, 'role')) === 'link' && (await page.getAttribute(pill, 'tabindex')) === '0');
  await page.click(pill); await sleep(500);
  check('clicking the project pill opens that board (AIG-1293)', await page.evaluate(() => location.hash) === '#/p/alpha', await page.evaluate(() => location.hash));
  await page.goto(page.url().split('#')[0] + '#/inbox'); await page.waitForSelector(pill);
  await page.focus(pill); await page.keyboard.press('Enter'); await sleep(500);
  check('Enter on the focused pill opens the board too', await page.evaluate(() => location.hash) === '#/p/alpha');
  noErrors(page);
}, true);

def('blocked', 'a blocked card shows in the inbox with the reason; his answer clears it', async (s, ctx) => {
  await mkProject(s, 'Gamma', 'GAM');
  await mkCard(s, 'gamma', 'Stuck card', { status: 'doing', assignee: 'Forge' });
  await say(s, 'gamma', 'GAM-1', 'Forge', 'Blocked: need the API key');
  await s.ok('PATCH', '/api/projects/gamma/cards/GAM-1', { blocked: true });
  check('blocked card is in the inbox (api)', (await s.ok('GET', '/api/inbox')).some(c => c.id === 'GAM-1'));
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-item.blk', { timeout: 7000 }).catch(() => {});
  const t = await page.textContent('.ib-item.blk').catch(() => '');
  check('inbox shows it as Blocked with the reason', /Blocked/.test(t) && /need the API key/.test(t), t);
  await say(s, 'gamma', 'GAM-1', 'Owner', 'key is in the vault');
  check('Owner answering clears the block', (await s.ok('GET', '/api/projects/gamma')).cards[0].blocked === false);
  check('and it leaves the inbox', !(await s.ok('GET', '/api/inbox')).some(c => c.id === 'GAM-1'));
  noErrors(page);
}, true);

def('usage', '#/usage renders with and without limits.log', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/usage');
  await page.waitForTimeout(800);
  // AIG-356: the nav glance. No reading: a grey dash and no bars.
  check('glance: no reading shows a dash, no bars', (await page.locator('#ugBars .ug-dash').count()) === 1 && (await page.locator('#ugBars .ug-bar').count()) === 0 && /–/.test(await page.textContent('#ugBars')));
  const t1 = await page.textContent('#app');
  check('usage page renders (no limits.log)', /usage/i.test(t1) && t1.trim().length > 40, t1.slice(0, 120));
  check('limits.log absent', !fs.existsSync(path.join(s.data, 'limits.log')));
  noErrors(page);
  const soon = Math.floor(Date.now() / 1000) + 3600;
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 12, resets_at: soon }, seven_day: { used_percentage: 30, resets_at: soon + 86400 } } });
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 20, resets_at: soon }, seven_day: { used_percentage: 33, resets_at: soon + 86400 } } });
  check('limits.log written', fs.existsSync(path.join(s.data, 'limits.log')));
  check('bad limits payload is 400', (await s.api('POST', '/api/limits', { rate_limits: {} })).status === 400);
  const lim = await s.ok('GET', '/api/limits?days=30');
  check('limits api returns history', lim.history.length === 2 && lim.latest.h5.pct === 20);
  const page2 = await openPage(ctx, '#/usage');
  await page2.waitForSelector('svg', { timeout: 5000 }).catch(() => {});
  await page2.waitForTimeout(500);
  const t2 = await page2.textContent('#app');
  check('usage page renders with limits.log', /20\s*%/.test(t2) || (await page2.locator('svg').count()) > 0, t2.slice(0, 160));
  noErrors(page2);
  // AIG-356: 20% used -> 80% left (green), 33% used -> 67% left (green); the tooltip says so.
  const glance = async () => { await page2.evaluate(() => UsageGlance.poll()); await page2.waitForTimeout(400); return { bars: await page2.locator('#ugBars .ug-bar').evaluateAll(es => es.map(e => e.className.replace('ug-bar ', ''))), title: await page2.getAttribute('#usageNav', 'title'), dot: await page2.locator('#ugBars .ug-dot').count(), dash: await page2.locator('#ugBars .ug-dash').count() }; };
  let g = await glance();
  check('glance: two green bars, tooltip with % left and age', g.bars.join() === 'g,g' && /5h: 80% left · week: 67% left · last reading/.test(g.title) && g.dot === 0, g);
  const lat = await s.ok('GET', '/api/limits/latest');
  check('latest api: newest reading, not over budget', lat.latest.h5.pct === 20 && lat.over === false);
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 65, resets_at: soon }, seven_day: { used_percentage: 85, resets_at: soon + 86400 } } });
  g = await glance();
  check('glance: amber 5h and red week colours', g.bars.join() === 'a,r' && g.dot === 0, g);
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 95, resets_at: soon }, seven_day: { used_percentage: 85, resets_at: soon + 86400 } } });
  g = await glance();
  check('glance: over the budget shows a red dot', g.bars.join() === 'r,r' && g.dot === 1 && /budget/.test(g.title), g);
  // AIG-431: Compact / Full toggle. Compact = two monospace lines with bars from the latest reading; the choice is remembered.
  await page2.click('.uz-viewtog button:nth-child(1)');
  await page2.waitForSelector('.uz-compact', { timeout: 5000 });
  const cl = (await page2.textContent('.uz-compact')).split('\n');
  check('compact: two lines with bars (95% and 85% used)', cl.length === 2 && /^5h window: +95% \[XXXXXXXX\] resets in /.test(cl[0]) && /^7d window: +85% \[XXXXXXX\.\] resets in /.test(cl[1]), cl);
  check('compact: last reading line', /last reading \d+ min ago/.test(await page2.textContent('#app')));
  await page2.reload();
  await page2.waitForSelector('.uz-compact', { timeout: 5000 });
  check('compact choice is remembered after a reload', (await page2.locator('.uz-compact').count()) === 1 && (await page2.locator('.uz-hero').count()) === 0);
  await page2.click('.uz-viewtog button:nth-child(2)');
  await page2.waitForSelector('.uz-hero', { timeout: 5000 });
  check('full view is back: no compact box', (await page2.locator('.uz-compact').count()) === 0);
  noErrors(page2);
  await page2.goto(BASE + '/#/');
  await page2.waitForSelector('.proj');
  noErrors(page2);
}, true);

def('inboxonly', 'top bar chips: "to do" shows only your to-dos, "to test" only tests; Show everything (AIG-187)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Try it'), b = await mkCard(s, 'alpha', 'Add the key');
  s.cli(['test', 'alpha', a.id, 'click it', '--as', 'Lead']);
  s.cli(['task', 'alpha', b.id, 'paste the key', '--as', 'Lead']);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('.ib-btn .ib-badge[data-only="k"]');
  await page.click('.ib-btn .ib-badge[data-only="k"]');
  await page.waitForSelector('#ibK:not([hidden])');
  check('"to do" shows only your to-dos', await page.locator('#ibT').isHidden() && /to-dos/.test(await page.textContent('#ibOnly')));
  await page.click('[data-onlyclear]');
  await page.waitForSelector('#ibT:not([hidden])');
  check('Show everything brings the rest back', await page.locator('#ibK').isVisible() && await page.locator('#ibOnly').isHidden());
  await page.click('.ib-btn .ib-badge[data-only="t"]');
  await page.waitForSelector('#ibK[hidden]', { state: 'attached' });
  check('"to test" shows only tests', await page.locator('#ibT').isVisible());
  // AIG-288: on a project's tab with no questions, the "questions" chip still shows the questions (it opens All).
  await mkProject(s, 'Beta', 'BET');
  const q = await mkCard(s, 'beta', 'Which colour?');
  s.cli(['ask', 'beta', q.id, 'Red or blue?', '--as', 'Lead']);
  await page.waitForSelector('[data-tab="alpha"]'); await page.click('[data-tab="alpha"]');
  await page.waitForSelector('.ib-btn .ib-badge[data-only="q"]'); await page.click('.ib-btn .ib-badge[data-only="q"]');
  await page.waitForSelector('#ibQ:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('"questions" from another project\'s tab shows the questions (AIG-288)', await page.locator('#ibQ').isVisible() && /Red or blue/.test(await page.textContent('#ibQ')));
  // AIG-293: clicked from a project's board, "to do" still shows the to-dos of every project.
  await page.goto(BASE + '/#/p/beta'); await page.waitForSelector('.ib-btn .ib-badge[data-only="k"]');
  await page.click('.ib-btn .ib-badge[data-only="k"]');
  await page.waitForSelector('#ibK:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('"to do" clicked on another project\'s board shows the to-dos (AIG-293)', await page.locator('#ibK').isVisible() && /Add the key/.test(await page.textContent('#ibK')));
  noErrors(page);
}, true);

def('aiflick', '🤖 AI passed view: one test at a time with the evidence, accept or send back, next slides in (AIG-192)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const ids = [];
  for (const n of ['One', 'Two', 'Three']) { const c = await mkCard(s, 'alpha', 'Test ' + n); s.cli(['test', 'alpha', c.id, 'click ' + n, '--as', 'Lead']); ids.push(c.id); }
  s.cli(['checked', 'alpha', ids[0], 'pass', 'Saw one working', '--as', 'Tester']);
  s.cli(['checked', 'alpha', ids[1], 'pass', 'Saw two working', '--as', 'Tester']);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('[data-flick]');
  check('the 🤖 AI passed button counts only passed tests', /\(2\)/.test(await page.textContent('[data-flick]')));
  await page.click('[data-flick]');
  await page.waitForSelector('#ibAi:not([hidden]) .ai-ev');
  check('it shows one test with what the tester saw', /1 of 2/.test(await page.textContent('#ibAi .fl-head')) && /Saw one working/.test(await page.textContent('#ibAi')) && await page.locator('#ibT').isHidden());
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /2 of 2/.test(document.querySelector('#ibAi .fl-head').textContent), null, { timeout: 3000 }).catch(() => {});
  check('→ flicks to the next one', /Saw two working/.test(await page.textContent('#ibAi')));
  await page.click('#ibAi [data-fl="back"]');
  check('send back needs a reason', /./.test(await page.textContent('#flErr')));
  await page.fill('#flText', 'Button is the wrong colour');
  await page.click('#ibAi [data-fl="back"]');
  await page.waitForFunction(() => /1 of 1/.test(document.querySelector('#ibAi .fl-head')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  check('sent back goes to the team; the other slides in', (await getCard(s, 'alpha', ids[1])).status === 'team' && /Saw one working/.test(await page.textContent('#ibAi')));
  await page.click('#ibAi [data-fl="accept"]');
  await page.waitForFunction(() => document.getElementById('ibAi').hidden, null, { timeout: 5000 }).catch(() => {});
  check('accepting the last one closes the view, back to the inbox', (await getCard(s, 'alpha', ids[0])).status === 'done' && await page.locator('#ibAi').isHidden() && await page.locator('#ibT').isVisible());
  noErrors(page);
}, true);

def('aiownlist', 'Setup switch: AI-passed tests leave the tests list and wait under 🤖 AI passed, with their own Accept all (AIG-781)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Passed one'), b = await mkCard(s, 'alpha', 'Plain one');
  s.cli(['test', 'alpha', a.id, 'click a', '--as', 'Lead']); s.cli(['test', 'alpha', b.id, 'click b', '--as', 'Lead']);
  s.cli(['checked', 'alpha', a.id, 'pass', 'Saw it working', '--as', 'Tester']);
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#aiOwnList');
  check('the switch is in Setup, off by default', !(await page.isChecked('#aiOwnList')));
  await page.check('#aiOwnList');
  await page.evaluate(() => { location.hash = '#/inbox'; });
  await page.waitForSelector('#ibAiBar [data-aiall]');
  const tests = await page.textContent('#ibT');
  check('the passed test left the tests list; the other stays', !tests.includes(a.id) && tests.includes(b.id), tests);
  await page.click('#ibAiBar [data-aiall]');
  await page.waitForFunction(() => !document.querySelector('#ibAiBar [data-flick]'), null, { timeout: 5000 }).catch(() => {});
  check('its Accept all accepts the passed one only', (await getCard(s, 'alpha', a.id)).status === 'done' && (await getCard(s, 'alpha', b.id)).status === 'verify');
  noErrors(page);
}, true);

def('readyforgo', '🚦 Ready for go: a plan asking "Go?" (or --kind plan) gets its own kind in the inbox and the For you column (AIG-828)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Build the thing'), b = await mkCard(s, 'alpha', 'Pick a colour'), c = await mkCard(s, 'alpha', 'Other plan');
  s.cli(['ask', 'alpha', a.id, 'Plan: two cards. Go?', '--as', 'Lead']);
  s.cli(['ask', 'alpha', b.id, 'Blue or green?', '--as', 'Lead']);
  check('--kind plan is accepted', s.cli(['ask', 'alpha', c.id, 'Ready when you are', '--as', 'Lead', '--kind', 'plan']).code === 0);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibKinds [data-kind="plan"]');
  await page.click('#ibKinds [data-kind="plan"]');
  await sleep(300);
  const ids = await page.$$eval('.ib-item', els => els.filter(e => e.offsetParent).map(e => e.dataset.id));
  check('the plan filter shows the two plans only', ids.includes(a.id) && ids.includes(c.id) && !ids.includes(b.id), ids);
  await page.evaluate(() => { location.hash = '#/p/alpha'; });
  await page.waitForSelector('[data-first="p"]');
  check('the For you column has a 🚦 chip counting 2', /2/.test(await page.textContent('[data-first="p"]')), await page.textContent('[data-first="p"]'));
  noErrors(page);
}, true);

def('poplist', '⧉ pop an inbox list out into its own window: only that list, no top bar (AIG-104)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Try it'), b = await mkCard(s, 'alpha', 'Add the key');
  s.cli(['test', 'alpha', a.id, 'click it', '--as', 'Lead']);
  s.cli(['task', 'alpha', b.id, 'paste the key', '--as', 'Lead']);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibT [data-poplist="t"]');
  const popP = ctx.waitForEvent('page');
  await page.click('#ibT [data-poplist="t"]');
  const pop = await popP;
  await pop.waitForLoadState();
  await pop.waitForSelector('#ibT .ib-item', { timeout: 8000 });
  check('the window opens on that list', (await pop.evaluate(() => location.hash)) === '#/pop-inbox/t');
  check('only tests show; no top bar or rail', await pop.locator('#ibK').isHidden() && await pop.locator('header').isHidden() && await pop.locator('#dmRail').isHidden());
  check('its buttons work as usual', (await pop.locator('#ibT .ib-item button[data-act="accept"]').count()) === 1);
  noErrors(page);
}, true);

def('popone', '⤢ pop one inbox item out into its own window; a task item shows the task, not a later comment (AIG-367)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const b = await mkCard(s, 'alpha', 'Add the record');
  s.cli(['task', 'alpha', b.id, 'step 1: add a DNS A record', '--as', 'Lead']);
  await sleep(20);
  await say(s, 'alpha', b.id, 'Herald', 'technical handover note');
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibK .ib-item .ib-popone');
  const txt = await page.textContent('#ibK .ib-item .ib-question');
  check('the task item shows the task text, not the later comment', /DNS A record/.test(txt) && !/handover/.test(txt), txt);
  check('who set it is Lead', /Lead/.test(await page.textContent('#ibK .ib-item .ib-who')));
  const popP = ctx.waitForEvent('page');
  await page.click('#ibK .ib-item .ib-popone');
  const pop = await popP;
  await pop.waitForLoadState();
  check('the window opens on that card', (await pop.evaluate(() => location.hash)) === '#/pop/alpha/' + b.id, await pop.evaluate(() => location.hash));
  const q = await mkCard(s, 'alpha', 'Which colour');
  s.cli(['ask', 'alpha', q.id, 'which colour?', '--as', 'Forge']);
  await sleep(20);
  await say(s, 'alpha', q.id, 'Herald', 'also FYI something else');
  await page.waitForSelector('#ibQ .ib-item .ib-popone');
  const qt = await page.textContent('#ibQ .ib-item .ib-question');
  check('a question item shows the question, not a later comment', /which colour/.test(qt) && !/FYI/.test(qt), qt);
  noErrors(page);
}, true);

def('servertask', 'a task can be marked 🖥️ Server: CLI flag, grouped first in For you and the inbox, owner toggle (AIG-320)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Plain task'), b = await mkCard(s, 'alpha', 'Deploy it'), c = await mkCard(s, 'alpha', 'Forgot to mark');
  s.cli(['task', 'alpha', a.id, 'log in', '--as', 'Lead']);
  await sleep(20);
  const r = s.cli(['task', 'alpha', b.id, 'run the migration', '--server', '--as', 'Lead']);
  check('task --server works', r.code === 0, r);
  s.cli(['task', 'alpha', c.id, 'restart it', '--as', 'Lead']);
  check('server flag is stored only when asked', (await getCard(s, 'alpha', b.id)).server === true && !(await getCard(s, 'alpha', a.id)).server);
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');
  const ids = async () => page.$$eval('.column.foryou .card', els => els.map(e => e.dataset.id));
  check('For you has a Server chip with its count', /Server 1/.test(await page.textContent('.fy-chip[data-first="s"]')), await page.textContent('.fy-chips'));
  await page.click('.fy-chip[data-first="k"]'); await page.click('.fyf-x'); await page.waitForSelector('.fyf', { state: 'detached' });   // a chip now opens the fold window (AIG-738); close it
  await page.waitForFunction(id => document.querySelector('.column.foryou .card')?.dataset.id === id, b.id, { timeout: 3000 }).catch(() => {});
  check('server tasks lead the Tasks', (await ids())[0] === b.id, await ids());
  check('server task shows its 🖥️ mark', (await page.textContent(`.column.foryou .card[data-id="${b.id}"]`)).includes('🖥️'));
  // the owner marks the forgotten one
  await page.click(`.column.foryou .card[data-id="${c.id}"] [data-server]`);
  await page.waitForFunction(() => document.querySelectorAll('.column.foryou .card [data-server][data-on="1"]').length === 2, null, { timeout: 4000 }).catch(() => {});
  check('toggle marks a task as server', (await getCard(s, 'alpha', c.id)).server === true);
  await page.click(`.column.foryou .card[data-id="${c.id}"] [data-server]`);
  await page.waitForFunction(() => document.querySelectorAll('.column.foryou .card [data-server][data-on="1"]').length === 1, null, { timeout: 4000 }).catch(() => {});
  check('toggle unmarks it again', !(await getCard(s, 'alpha', c.id)).server);
  const ip = await openPage(ctx, '#/inbox');
  await ip.waitForSelector('#ibK .ib-item');
  const order = await ip.$$eval('#ibK .ib-item', els => els.map(e => e.dataset.id));
  check('inbox lists server tasks first', order[0] === b.id && order.length === 3, order);
  check('inbox has a Server chip with its count', /Server\s*1/.test(await ip.textContent('#ibKinds')), await ip.textContent('#ibKinds'));
  noErrors(page); noErrors(ip);
}, true);

def('outsidetask', 'a task can be marked 🤝 Outside help: CLI flag, own group after Server, owner toggle (AIG-380)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Plain task'), b = await mkCard(s, 'alpha', 'Ask the vendor'), c = await mkCard(s, 'alpha', 'Deploy it');
  s.cli(['task', 'alpha', a.id, 'log in', '--as', 'Lead']);
  await sleep(20);
  const r = s.cli(['task', 'alpha', b.id, 'wait for the vendor', '--outside', '--as', 'Lead']);
  check('task --outside works', r.code === 0, r);
  s.cli(['task', 'alpha', c.id, 'run it', '--server', '--as', 'Lead']);
  check('outside flag is stored only when asked', (await getCard(s, 'alpha', b.id)).outside === true && !(await getCard(s, 'alpha', a.id)).outside);
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');
  const ids = async () => page.$$eval('.column.foryou .card', els => els.map(e => e.dataset.id));
  check('For you has an Outside help chip with its count', /Outside help 1/.test(await page.textContent('.fy-chip[data-first="o"]')), await page.textContent('.fy-chips'));
  await page.click('.fy-chip[data-first="k"]'); await page.click('.fyf-x'); await page.waitForSelector('.fyf', { state: 'detached' });   // a chip now opens the fold window (AIG-738); close it
  await page.waitForFunction(id => document.querySelector('.column.foryou .card')?.dataset.id === id, c.id, { timeout: 3000 }).catch(() => {});
  check('order is Server, Outside help, other tasks', (await ids()).join() === [c.id, b.id, a.id].join(), await ids());
  await page.click(`.column.foryou .card[data-id="${a.id}"] [data-outside]`);
  await page.waitForFunction(() => document.querySelectorAll('.column.foryou .card [data-outside][data-on="1"]').length === 2, null, { timeout: 4000 }).catch(() => {});
  check('toggle marks a task as outside', (await getCard(s, 'alpha', a.id)).outside === true);
  await page.click(`.column.foryou .card[data-id="${a.id}"] [data-outside]`);
  await page.waitForFunction(() => document.querySelectorAll('.column.foryou .card [data-outside][data-on="1"]').length === 1, null, { timeout: 4000 }).catch(() => {});
  check('toggle unmarks it again', !(await getCard(s, 'alpha', a.id)).outside);
  const ip = await openPage(ctx, '#/inbox');
  await ip.waitForSelector('#ibK .ib-item');
  const order = await ip.$$eval('#ibK .ib-item', els => els.map(e => e.dataset.id));
  check('inbox lists Server, then Outside help, then the rest', order.join() === [c.id, b.id, a.id].join(), order);
  check('inbox has an Outside help chip with its count', /Outside help\s*1/.test(await ip.textContent('#ibKinds')), await ip.textContent('#ibKinds'));
  noErrors(page); noErrors(ip);
}, true);

def('inboxlive', 'a new team message shows in an inbox item while its reply box holds a draft (AIG-314)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Alpha question', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', 'ALP-1', 'Forge', 'which colour?', { needsYou: true });
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-item textarea');
  await page.fill('.ib-item textarea', 'half a reply');
  await page.focus('.ib-item textarea');
  await say(s, 'alpha', 'ALP-1', 'Forge', 'actually, which size?', { needsYou: true });
  const live = await page.waitForFunction(() => document.querySelector('.ib-item .ib-question')?.textContent.includes('which size'), null, { timeout: 2500 }).then(() => true, () => false);
  check('the newer question shows within 2s', live);
  check('the draft is kept and focused', (await page.inputValue('.ib-item textarea')) === 'half a reply' && await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA'));
  noErrors(page);
}, true);
