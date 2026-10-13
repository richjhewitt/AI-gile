// QA area: today (AIG-595/596/597): a weight per project for the day (🔥 high, normal, 🐢 low, 💤 rest), the reset next morning and
// "Keep yesterday's", order for the Scrum Master and the night watchman, 💤 only waking for the owner's comments, the day's token
// split by weight and the slow-down of a project past its share. The page: the 🎯 Today link, the badge on the project cards.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('today', '🎯 Today: weights per project, reset each morning, order, 💤 rest only wakes for the owner, token split by weight and slow-down (AIG-595/596/597)', async (s, ctx) => {
  for (const [n, k] of [['Aa', 'AAA'], ['Bb', 'BBB'], ['Cc', 'CCC'], ['Dd', 'DDD'], ['Ee', 'EEE']]) await mkProject(s, n, k, { path: tmp('today-' + n) });
  const today = () => s.ok('GET', '/api/today');
  const row = (d, slug) => d.projects.find(p => p.slug === slug);
  let d = await today();
  check('every project starts as normal', d.projects.length === 5 && d.projects.every(p => p.weight === 'normal'), d.projects.map(p => p.weight));
  check('without a choice the split is even (all at one level)', d.projects.every(p => p.share === 20), d.projects.map(p => p.share));

  // The weights, and the order the Scrum Master and the night watchman use.
  await s.ok('POST', '/api/today', { slug: 'dd', weight: 'low' });
  await s.ok('POST', '/api/today', { slug: 'bb', weight: 'high' });
  await s.ok('POST', '/api/today', { slug: 'aa', weight: 'high' });
  await s.ok('POST', '/api/today', { slug: 'ee', weight: 'rest' });
  d = await today();
  check('the weights are saved', row(d, 'aa').weight === 'high' && row(d, 'dd').weight === 'low' && row(d, 'ee').weight === 'rest' && row(d, 'cc').weight === 'normal');
  check('🔥 projects come first, 💤 last', d.order.slice(0, 2).sort().join() === 'aa,bb' && d.order[2] === 'cc' && d.order[3] === 'dd' && d.order[4] === 'ee', d.order);
  check('a bad weight is refused', (await s.api('POST', '/api/today', { slug: 'aa', weight: 'turbo' })).status === 400);
  // 50 / 30 / 20 shared out among the projects at each level; rest gets nothing.
  check('the split is 50 / 30 / 20 by level, shared among the projects there', row(d, 'aa').share === 25 && row(d, 'bb').share === 25 && row(d, 'cc').share === 30 && row(d, 'dd').share === 20 && row(d, 'ee').share === 0, d.projects.map(p => p.share));
  check('and adds up to 100', Math.round(d.projects.reduce((n, p) => n + p.share, 0)) === 100);

  // Next morning: everything is normal again; "Keep yesterday's" brings the weights back.
  fs.writeFileSync(path.join(s.data, 'today.stub'), new Date(Date.now() + 864e5).toISOString().slice(0, 10));
  d = await today();
  check('next day: weights reset to normal', d.projects.every(p => p.weight === 'normal') && d.yesterday === 4, d.projects.map(p => p.weight));
  d = await s.ok('POST', '/api/today/keep');
  check("Keep yesterday's brings them back", row(d, 'aa').weight === 'high' && row(d, 'dd').weight === 'low' && row(d, 'ee').weight === 'rest');
  fs.rmSync(path.join(s.data, 'today.stub'), { force: true });
  d = await today();
  check('and the day after that again starts clean', d.projects.every(p => p.weight === 'normal'));

  // 💤 rest wakes only for the owner's own comments; ⭐ crucial cards run whatever the weight.
  await s.ok('POST', '/api/today', { slug: 'ee', weight: 'rest' });
  const cardE = await mkCard(s, 'ee', 'something', { status: 'todo' });
  d = await today();
  check('a resting project is marked as resting', row(d, 'ee').resting === true);
  await s.ok('PATCH', `/api/projects/ee/cards/${cardE.id}`, { crucial: true });
  check('a ⭐ crucial card takes it out of rest', row(await today(), 'ee').resting === false);
  await s.ok('PATCH', `/api/projects/ee/cards/${cardE.id}`, { crucial: false });
  fs.rmSync(s.wakeOut, { force: true });
  await say(s, 'ee', cardE.id, 'Owner', 'please carry on');
  for (let i = 0; i < 30 && !fs.existsSync(s.wakeOut); i++) await sleep(200);
  check('the owner commenting still wakes a resting project', fs.existsSync(s.wakeOut));
  for (let i = 0; i < 40 && (await s.ok('GET', '/api/projects/ee')).presence.running; i++) await sleep(250);

  // The day's tokens: a project past its share slows down like the usage saver.
  const lf = path.join(s.dir, 'aigile.local.json'), loc = JSON.parse(fs.readFileSync(lf, 'utf8'));
  fs.writeFileSync(lf, JSON.stringify({ ...loc, budget: { ...(loc.budget || {}), day: 1000000 } }));
  await s.ok('POST', '/api/today', { slug: 'ee', weight: 'normal' });
  await s.ok('POST', '/api/today', { slug: 'aa', weight: 'high' });   // aa 50, bb/cc/dd/ee 30 shared by four = 7.5 each... 80 total -> scaled
  fs.mkdirSync(path.join(s.data, 'logs'), { recursive: true });
  const nowMs = Date.now();
  fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), [
    { slug: 'aa', start: nowMs - 6e4, end: nowMs - 3e4, fresh: 100000, cw: 0, out: 100000, cache: 0 },   // 600000 units
    { slug: 'cc', start: nowMs - 6e4, end: nowMs - 3e4, fresh: 10000, cw: 0, out: 10000, cache: 0 },    // 60000 units
  ].map(r => JSON.stringify(r)).join('\n') + '\n');
  d = await today();
  const aa = row(d, 'aa'), cc = row(d, 'cc');
  check('the limit and each use are shown', d.limit === 1000000 && aa.used === 600000 && cc.used === 60000, [d.limit, aa.used, cc.used]);
  check('🔥 gets 50/80 of the day, normal shares 30/80 among four', aa.share === 62.5 && cc.share === 9.4 && aa.allowed === 625000, [aa.share, cc.share, aa.allowed]);
  check('a project within its share is not slowed', aa.over === false && cc.over === false);
  fs.appendFileSync(path.join(s.data, 'logs', '_runs.jsonl'), JSON.stringify({ slug: 'cc', start: nowMs - 6e4, end: nowMs - 2e4, fresh: 100000, cw: 0, out: 20000, cache: 0 }) + '\n');   // cc now 260000 > 94000
  d = await today();
  check('past its share a project is marked over', row(d, 'cc').over === true && row(d, 'aa').over === false);
  await mkCard(s, 'cc', 'task', { status: 'todo' });
  const cardC = (await s.ok('GET', '/api/projects/cc')).cards[0];
  fs.rmSync(s.wakeOut, { force: true });
  await say(s, 'cc', cardC.id, 'Owner', 'go on then');
  await sleep(2000);
  check('a project past its share does not start a run', !fs.existsSync(s.wakeOut));
  await s.ok('PATCH', `/api/projects/cc/cards/${cardC.id}`, { crucial: true });
  check('but a ⭐ crucial card still runs', row(await today(), 'cc').over === false);

  // The page.
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('a.proj');
  check('the project cards show a badge for the weight (🔥 on Aa)', /🔥/.test(await page.textContent('a.proj[href="#/p/aa"] h2')));
  check('the home page links to 🎯 Today', !!(await page.$('a[href="#/today"]')));
  await page.click('a[href="#/today"]');
  await page.waitForSelector('.today-row');
  await page.click('.today-row[data-slug="bb"] [data-w="low"]');
  await page.waitForFunction(() => document.querySelector('.today-row[data-slug="bb"] [data-w="low"].on'), null, { timeout: 5000 }).catch(() => {});
  check('a click on a weight button sets it', row(await today(), 'bb').weight === 'low');
  check('the page names each share and use', /50|62/.test(await page.textContent('.today-row[data-slug="aa"]')));
  const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 800 }); await phone.goto(page.url());
  await phone.waitForSelector('.today-row');
  check('phone width: no sideways scroll', await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await phone.close();
  await page.goto(page.url().replace('#/today', '#/usage'));
  await page.waitForSelector('.today-usage', { timeout: 8000 }).catch(() => {});
  check('the usage page shows each project\'s share and use', (await page.$$('.today-usage .today-bar')).length === 5);
  // AIG-607: exact shares replace the weight split, add up to 100, stay across days; at its share a project pauses, ⭐ crucial still runs.
  const bad1 = await s.api('POST', '/api/today/shares', { pct: { aa: 60, bb: 30 } });
  check('shares that do not add up to 100 are refused, with the total', bad1.status === 400 && /90/.test(JSON.stringify(bad1.body)), bad1);
  check('and nothing was saved', (await today()).mode !== 'pct');
  d = await s.ok('POST', '/api/today/shares', { pct: { aa: 50, bb: 50 } });
  check('exact shares are saved and used instead of the weights', d.mode === 'pct' && row(d, 'aa').share === 50 && row(d, 'bb').share === 50 && row(d, 'cc').share === 0 && row(d, 'aa').allowed === 500000, d.projects.map(p => p.share));
  fs.writeFileSync(path.join(s.data, 'today.stub'), new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10));
  d = await today();
  check('they do not reset with the day (the weights do)', d.mode === 'pct' && row(d, 'aa').share === 50 && d.projects.every(p => p.weight === 'normal'));
  fs.rmSync(path.join(s.data, 'today.stub'), { force: true });
  d = await s.ok('POST', '/api/today/shares', { equal: true });
  check('split equally gives every project the same', d.mode === 'equal' && d.projects.every(p => p.share === 20), d.projects.map(p => p.share));
  d = await s.ok('POST', '/api/today/shares', { pct: { aa: 50, bb: 50 } });
  const cardA = await mkCard(s, 'aa', 'share work', { status: 'todo' });
  check('aa used 600000 of its 500000: paused until the next window; bb is fine', row(d, 'aa').over === true && row(d, 'bb').over === false, [row(d, 'aa').used, row(d, 'aa').allowed]);
  fs.rmSync(s.wakeOut, { force: true });
  await say(s, 'aa', cardA.id, 'Owner', 'please continue');
  await sleep(2000);
  check('a project at its share starts no run', !fs.existsSync(s.wakeOut));
  await s.ok('PATCH', `/api/projects/aa/cards/${cardA.id}`, { crucial: true });
  fs.rmSync(s.wakeOut, { force: true });
  await say(s, 'aa', cardA.id, 'Owner', 'this one matters');
  for (let i = 0; i < 30 && !fs.existsSync(s.wakeOut); i++) await sleep(200);
  check('but with a ⭐ crucial card it still runs', fs.existsSync(s.wakeOut));
  for (let i = 0; i < 40 && (await s.ok('GET', '/api/projects/aa')).presence.running; i++) await sleep(250);
  // The page: the running total, and Save only at 100.
  await page.goto(page.url().replace('#/usage', '#/today'));
  await page.waitForSelector('.today-pct');
  await page.check('#todayEqual'); await page.uncheck('#todayEqual');
  await page.fill('.today-pct[data-slug="aa"]', '70'); await page.fill('.today-pct[data-slug="bb"]', '20');
  check('the page shows the running total and will not save 90', /90/.test(await page.textContent('#todayTotal')) && await page.isDisabled('#todaySaveShares'));
  await page.fill('.today-pct[data-slug="bb"]', '30');
  check('at 100 Save is on', /100/.test(await page.textContent('#todayTotal')) && !(await page.isDisabled('#todaySaveShares')));
  await page.click('#todaySaveShares');
  await page.waitForFunction(() => document.querySelector('.today-pct[data-slug="aa"]')?.value === '70', null, { timeout: 5000 }).catch(() => {});
  check('Save keeps them', row(await today(), 'aa').share === 70);
  await s.ok('POST', '/api/today/shares', {});
  check('and they can go back to the weights', (await today()).mode === 'weights');

  // AIG-608: AI off for one project: nothing starts, even for the owner's comments; back on works.
  const cardB = await mkCard(s, 'bb', 'by hand', { status: 'todo' });
  await s.ok('PATCH', '/api/projects/bb', { aiOff: true });
  check('the project shows AI off', row(await today(), 'bb').aiOff === true && (await s.ok('GET', '/api/projects')).find(p => p.slug === 'bb').aiOff === true);
  fs.rmSync(s.wakeOut, { force: true });
  await say(s, 'bb', cardB.id, 'Owner', 'hello team');
  await sleep(2000);
  check('the owner\'s comment wakes nobody (dispatcher and team)', !fs.existsSync(s.wakeOut));
  const w = await s.api('POST', '/api/projects/bb/wake', {});
  check('even the Wake button is refused', w.status === 409 && /AI is off/.test(JSON.stringify(w.body)), w);
  await s.ok('PATCH', `/api/projects/bb/cards/${cardB.id}`, { status: 'doing' });
  check('the board still works by hand', (await getCard(s, 'bb', cardB.id)).status === 'doing');
  await page.reload(); await page.waitForSelector('.today-row[data-slug="bb"]');
  check('Today shows it as a pressed AI off button', (await page.getAttribute('.today-row[data-slug="bb"] [data-aioff]', 'aria-pressed')) === 'true');
  await page.click('.today-row[data-slug="bb"] [data-aioff]');
  await page.waitForFunction(() => document.querySelector('.today-row[data-slug="bb"] [data-aioff]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 5000 }).catch(() => {});
  check('and the row button switches it back on', row(await today(), 'bb').aiOff === false);
  fs.rmSync(s.wakeOut, { force: true });
  await say(s, 'bb', cardB.id, 'Owner', 'are you there now?');
  for (let i = 0; i < 30 && !fs.existsSync(s.wakeOut); i++) await sleep(200);
  check('back on, the owner\'s comment wakes the team again', fs.existsSync(s.wakeOut));
  noErrors(page);

  // AIG-829/830: the morning picker, then the unpicked projects hidden until Show all. A fixed stub date keeps it date-proof.
  const stub = path.join(s.data, 'today.stub');
  fs.writeFileSync(stub, '2031-05-05');
  check('the picker is off by default', (await today()).askPick === false);
  await s.ok('POST', '/api/setup', { prefs: { todayPick: true } });
  check('the setup switch is saved with the other owner settings', (await s.ok('GET', '/api/setup')).prefs.todayPick === true && JSON.parse(fs.readFileSync(lf, 'utf8')).today.pick === true);
  d = await today();
  check('on: the first open of the day asks, and nothing is hidden yet', d.askPick === true && d.left.length === 0);
  await s.ok('POST', '/api/today', { slug: 'aa', weight: 'high' });
  await s.ok('POST', '/api/today', { slug: 'bb', weight: 'low' });
  d = await s.ok('POST', '/api/today/pick', { slugs: ['aa', 'bb'] });
  check('ticked = normal or the higher weight kept; unticked = rest', row(d, 'aa').weight === 'high' && row(d, 'bb').weight === 'normal' && ['cc', 'dd', 'ee'].every(x => row(d, x).weight === 'rest'), d.projects.map(p => p.weight));
  check('it is asked once, and the rest are left out for the day', d.askPick === false && d.left.sort().join() === 'cc,dd,ee', d.left);
  check('the background weights stay as set (rest guard still reads them)', row(d, 'dd').resting === true && d.order[d.order.length - 1] !== 'aa');
  check('a bad list is refused', (await s.api('POST', '/api/today/pick', { slugs: 'aa' })).status === 400);
  fs.writeFileSync(stub, '2031-05-06');
  d = await today();
  check('next morning: asks again, weights and hidden list reset', d.askPick === true && d.left.length === 0 && d.projects.every(p => p.weight === 'normal'));
  const skip = await s.ok('POST', '/api/today/pick', { skip: true });
  check('Not today: asked no more that day, nothing hidden or changed', skip.askPick === false && skip.left.length === 0 && skip.projects.every(p => p.weight === 'normal'));
  fs.writeFileSync(stub, '2031-05-07');
  const pg = await openPage(ctx, '#/');
  await pg.waitForSelector('#dialog .overlay', { timeout: 10000 });
  check('the dialog lists every project, ticked', (await pg.$$('#todayPickList input:checked')).length === 5);
  await pg.setViewportSize({ width: 390, height: 800 });
  check('phone width: the dialog does not scroll sideways', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  for (const x of ['cc', 'dd', 'ee']) await pg.uncheck(`#todayPickList input[value="${x}"]`);
  await pg.click('#todayPickGo');
  await pg.waitForFunction(() => !document.querySelector('#dialog .overlay') && document.querySelectorAll('a.proj').length === 2, null, { timeout: 8000 }).catch(() => {});
  check('only the picked projects show on home', (await pg.$$('a.proj')).length === 2 && !!(await pg.$('a.proj[href="#/p/aa"]')));
  check('a Show all line says how many are hidden', /3/.test(await pg.textContent('.today-hidden')));
  await pg.waitForFunction(() => document.querySelectorAll('#dmRail [data-slug]').length > 0 && !document.querySelector('#dmRail [data-slug="cc"]'), null, { timeout: 8000 }).catch(() => {});
  check('the side rail hides them too', (await pg.$$('#dmRail [data-slug="cc"]')).length === 0 && (await pg.$$('#dmRail [data-slug="aa"]')).length === 1);
  await pg.click('.today-hidden a');
  await pg.waitForFunction(() => document.querySelectorAll('a.proj').length === 5, null, { timeout: 8000 }).catch(() => {});
  check('Show all brings them all back', (await pg.$$('a.proj')).length === 5 && (await pg.$$('.today-hidden')).length === 0);
  await pg.reload(); await pg.waitForSelector('a.proj');
  check('and stays so for the rest of the day (this browser)', (await pg.$$('a.proj')).length === 5);
  fs.writeFileSync(stub, '2031-05-08');
  await s.ok('POST', '/api/today/pick', { slugs: ['aa'] });
  await pg.reload(); await pg.waitForSelector('a.proj');
  await pg.waitForFunction(() => document.querySelectorAll('a.proj').length === 1, null, { timeout: 8000 }).catch(() => {});
  check('the flag is only for its own date: the next day hides again', (await pg.$$('a.proj')).length === 1);
  noErrors(pg);
  fs.rmSync(stub, { force: true });
  await s.ok('POST', '/api/setup', { prefs: { todayPick: false } });
  check('switched off, the setting is gone from the file', JSON.parse(fs.readFileSync(lf, 'utf8')).today === undefined);
  // AIG-829/830 fix: a board already open picks up the switch being turned on, no reload needed
  await s.ok('POST', '/api/setup', { prefs: { todayPick: true } });
  check('turned on while the board is open: the picker appears without a reload', await pg.waitForSelector('#dialog .overlay', { timeout: 20000 }).then(() => true, () => false));
  await pg.click('#dialog .actions button >> nth=0');
  await s.ok('POST', '/api/setup', { prefs: { todayPick: false } });
}, true);
