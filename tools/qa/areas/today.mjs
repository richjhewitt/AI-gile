// QA area: today (AIG-595/596/597): a weight per project for the day (🔥 high, normal, 🐢 low, 💤 rest), the reset next morning and
// "Keep yesterday's", order for the Scrum Master and the night watchman, 💤 only waking for the owner's comments, the day's token
// split by weight and the slow-down of a project past its share. The page: the 🎯 Today link, the badge on the project cards.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

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
  noErrors(page);
}, true);
