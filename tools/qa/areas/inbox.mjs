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

  await page.click('.ib-item.k[data-id="ALP-2"] button[data-act=taskdone]');
  await page.waitForSelector('.ib-item.k[data-id="ALP-2"]', { state: 'detached' });
  const c2 = await getCard(s, 'alpha', 'ALP-2');
  check('task Done tells the team', c2.status === 'team' && c2.assignee === 'Pixel' && /Done/.test(c2.comments.at(-1).text), [c2.status, c2.assignee]);

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
  await page.click('.fy-chip[data-first="k"]');
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
  await page.click(`#ibNext [data-prio]`);   // none -> now on the Next up item
  await sleep(600);
  check('clicking 🔥 sets your priority', (await getCard(s, 'alpha', b.id)).ownerPrio === 'now');
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
  await page.click('.fy-chip[data-first="k"]');
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
