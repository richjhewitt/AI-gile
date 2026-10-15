// QA area: experts (AIG-577..579): premade expert teams in the 👥 Team dialog. Pick a template, move the size slider, the rough
// usage estimate changes (plain default with no run history, the board's own runs when there are some), apply: the roster is
// filled (Lead first) and the starter cards land in the backlog. Phone width and dark mode.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, until, mkProject, openPage, noErrors, def, tbClick } from '../lib.mjs';

def('experts', '🧰 premade expert teams: templates, size slider, rough usage estimate (default, then from run history), apply fills roster and backlog (AIG-577..579)', async (s, ctx) => {
  const list = await s.ok('GET', '/api/expert-teams');
  check('8 templates: general dev plus seven experts', list.teams.length === 8 && ['ux', 'security', 'perf', 'a11y', 'launch', 'docs', 'data', 'dev'].every(id => list.teams.some(t => t.id === id)), list.teams.map(t => t.id));
  check('each has roles with a model and a job, 3-5 starter cards, 2-3 done bullets, Lead first', list.teams.every(t => t.roles.length === 6 && t.roles[0].role === 'lead-principal' && t.roles.every(r => ['haiku', 'sonnet', 'opus'].includes(r.model) && r.job)
    && t.cards.length >= 3 && t.cards.length <= 5 && t.done.length >= 2 && t.done.length <= 3 && t.purpose));
  check('no run history: a plain default, flagged rough', list.history.runs === 0 && list.history.rough && list.history.perSonnetHour > 0);

  await mkProject(s, 'Expo', 'EXP');
  const page = await openPage(ctx, '#/p/expo');
  await page.goto(`${BASE}/#/p/expo`); await page.reload();
  await tbClick(page, 'Look');
  await page.waitForSelector('#look-roles button');
  await page.click('#look-roles button');
  await page.waitForSelector('#xt-pick');
  check('the picker lists the 8 teams', (await page.$$eval('#xt-pick option', os => os.length)) === 9);
  check('nothing is shown until one is picked', !(await page.$('#xt-size')));
  await page.selectOption('#xt-pick', 'security');
  await page.waitForSelector('#xt-size');
  check('the slider runs 1 to 6', (await page.getAttribute('#xt-size', 'min')) === '1' && (await page.getAttribute('#xt-size', 'max')) === '6');
  const est = () => page.textContent('#xt-est');
  await page.$eval('#xt-size', el => { el.value = 1; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const e1 = await est();
  check('the estimate says rough and that there is no history', /rough/i.test(e1) && /No run history/.test(e1), e1);
  await page.$eval('#xt-size', el => { el.value = 6; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const e6 = await est();
  check('a bigger team shows a bigger estimate', e1 !== e6 && (await page.textContent('#xt-n')) === '6', [e1, e6]);
  await page.$eval('#xt-size', el => { el.value = 3; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('3 agents: the first 3 roles are lit, the rest greyed', (await page.$$eval('#xt-roles li[data-on="1"]', l => l.length)) === 3 && (await page.$$eval('#xt-roles li[data-on="0"]', l => l.length)) === 3);

  // Phone width and dark mode: the box fits and can be read.
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone width: no sideways scroll in the dialog', await page.evaluate(() => { const d = document.querySelector('dialog') || document.body; return d.scrollWidth <= d.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1; }));
  check('phone width: the Apply button is a big tap target', (await page.locator('#xt-apply').boundingBox()).height >= 32);
  await page.emulateMedia({ colorScheme: 'dark' });
  check('dark mode: the estimate is visible with readable text', await page.evaluate(() => { const e = document.getElementById('xt-est'), c = getComputedStyle(e).color; return e.offsetHeight > 10 && c !== getComputedStyle(e).backgroundColor; }));
  await page.setViewportSize({ width: 1280, height: 800 }); await page.emulateMedia({ colorScheme: 'light' });

  await page.click('#xt-apply');
  await page.waitForFunction(() => /starter cards added/.test(document.getElementById('xt-msg').textContent));
  const p = await s.ok('GET', '/api/projects/expo');
  const ids = (await s.ok('GET', '/api/projects/expo/profiles')).roles.map(r => r.id);
  check('the roster is the first 3 roles, Lead first', ids.join() === 'lead-principal,security-principal,security-senior', ids);
  const mine = p.cards.filter(c => c.from === 'expert team');
  check('the starter cards are in the backlog', mine.length === 5 && mine.every(c => c.status === 'backlog') && mine[0].title === 'Map every place user input enters the app', mine.map(c => c.title));
  check('the first card carries "Done looks like"', /Done looks like/.test(mine[0].description));
  await page.waitForSelector('.tm-row[data-role-id="security-principal"]');
  check('the roster rows show it in the dialog', (await page.locator('.tm-row').count()) === 3);

  // Run history: the estimate is now based on the board's own runs.
  fs.mkdirSync(path.join(s.data, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), JSON.stringify({ slug: 'expo', start: Date.now() - 2 * 3600e3, end: Date.now() - 3600e3, in: 400000, out: 100000, cache: 0, models: ['sonnet'] }) + '\n');
  const h = (await s.ok('GET', '/api/expert-teams')).history;
  check('history baseline is read from the runs (500k tokens in 1 Sonnet hour)', h.runs === 1 && h.perSonnetHour === 500000 && h.rough, h);
  await page.reload(); await tbClick(page, 'Look'); await page.click('#look-roles button');
  await page.selectOption('#xt-pick', 'dev');
  await page.waitForSelector('#xt-est');
  const eh = await est();
  check('the estimate says it is from this board\'s runs, still rough', /Based on 1 recent run/.test(eh) && /rough/i.test(eh) && !/No run history/.test(eh), eh);
  await page.$eval('#xt-size', el => { el.value = 1; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('Lead alone (Opus, weight 3): 1.5M tokens an hour', /about 1\.5M tokens an hour/.test(await est()), await est());
  await page.$eval('#xt-size', el => { el.value = 2; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('Lead + a Sonnet builder: 2M an hour, 12M a sprint', /about 2M tokens an hour, or 12M/.test(await est()), await est());
  check('bad requests are refused', (await s.api('POST', '/api/projects/expo/expert-team', { team: 'nope', size: 2 })).status === 404);
  noErrors(page);
}, true);
