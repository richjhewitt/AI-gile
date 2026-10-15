// QA area: stats (AIG-726/727): GET /api/projects/:slug/stats numbers on a seeded project (done, made, comments, git commits and lines,
// busiest day, longest streak, first card, weekly chart, records) and the 📈 Stats page (tiles, chart, Wrapped box, phone width, dark mode).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { check, tmp, mkProject, mkCard, say, def, openPage, noErrors, until } from '../lib.mjs';

const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d; };

def('stats', '📈 project stats: API numbers on a seeded project, git commits and lines, streak, busiest day, records, the Stats page and Wrapped box (AIG-726/727)', async (s, ctx) => {
  const dir = tmp('stats');
  const git = (...a) => execFileSync('git', ['-c', 'user.email=qa@example.com', '-c', 'user.name=QA', ...a], { cwd: dir, windowsHide: true, stdio: 'pipe' });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n'); git('add', '.'); git('commit', '-q', '-m', 'first');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'a\nb\nc\nd\n'); git('add', '.'); git('commit', '-q', '-m', 'second');
  await mkProject(s, 'Statty', 'STA', { path: dir });
  const empty = await mkProject(s, 'Nofolder', 'NOF');
  const c = [];
  for (let i = 0; i < 5; i++) c.push(await mkCard(s, 'statty', 'Done card ' + i, { status: 'todo' }));
  const todo = await mkCard(s, 'statty', 'Still open', { status: 'todo' });
  await say(s, 'statty', c[0].id, 'Owner', 'one'); await say(s, 'statty', c[0].id, 'Owner', 'two'); await say(s, 'statty', c[0].id, 'Owner', 'three');
  await say(s, 'statty', c[1].id, 'Owner', 'solo');
  // Back-date the cards by editing the project file: done on D-5, D-3 (two), D-2, D-1 -> streak of 3, busiest D-3; first card D-10.
  const file = path.join(s.data, 'statty.json'), p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const when = [5, 3, 3, 2, 1];
  p.cards.filter(x => /^Done card/.test(x.title)).forEach((x, i) => { x.status = 'done'; x.updated = ago(when[i]).toISOString(); x.created = ago(when[i] + (i === 0 ? 5 : 0)).toISOString(); });
  fs.writeFileSync(file, JSON.stringify(p));
  // The server may save a copy it read just before the edit above (dispatcher log): write again until it sees the 5 done cards.
  await until(async () => (await s.ok('GET', '/api/projects/statty')).cards.filter(c => c.status === 'done').length === 5 || (fs.writeFileSync(file, JSON.stringify(p)), false), 5000);

  const d = await s.ok('GET', '/api/projects/statty/stats');
  check('cards done and made', d.done === 5 && d.made === 6, [d.done, d.made]);
  check('comments', d.comments === 4, d.comments);
  check('commits and lines changed from git', d.git && d.git.commits === 2 && d.git.lines === 7 && d.git.added === 7 && d.git.removed === 0, d.git);
  check('busiest day', d.busiestDay && d.busiestDay.day === dayStr(ago(3)) && d.busiestDay.done === 2, d.busiestDay);
  check('longest streak of days with something done', d.longestStreak === 3, d.longestStreak);
  check('first card date', d.firstCard === dayStr(ago(10)), d.firstCard);
  check('twelve weeks in the chart, adding up to the done cards', d.weeks.length === 12 && d.weeks.reduce((n, w) => n + w.done, 0) === 5, d.weeks);
  check('records: most comments on one card, biggest day', d.records.mostComments.id === c[0].id && d.records.mostComments.comments === 3 && d.records.biggestDay.done === 2, d.records);
  const e = await s.ok('GET', '/api/projects/nofolder/stats');
  check('a project without a folder has no git numbers and no crash', e.git === null && e.done === 0 && e.longestStreak === 0 && e.busiestDay === null, e);
  check('an unknown project is a 404', (await s.api('GET', '/api/projects/nope/stats')).status === 404);

  const page = await openPage(ctx, '#/stats/statty');
  check('the page shows the tiles', !!(await until(() => page.$('.st-tile'), 8000)));
  const tiles = await page.$$eval('.st-tile', els => Object.fromEntries(els.map(e => [e.querySelector('.st-k').textContent, e.querySelector('.st-v').textContent])));
  check('page: cards done, made, comments, commits, lines', tiles['Cards done'] === '5' && tiles['Cards made'] === '6' && tiles['Comments'] === '4' && tiles['Commits'] === '2' && tiles['Lines changed'] === '7', tiles);
  check('page: streak shown', /^3 days/.test(tiles['Longest streak']), tiles);
  check('page: chart has 12 bars', (await page.$$('svg.st-chart rect.st-bar')).length === 12);
  const wrapped = await page.textContent('#stWrapText');
  check('Wrapped text has the numbers', /5 cards done, 6 made/.test(wrapped) && /4 comments/.test(wrapped) && /2 commits, 7 lines/.test(wrapped), wrapped);
  check('Copy as text button is there', !!(await page.$('#stCopy')));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(200);
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload(); await page.waitForSelector('.st-tile');
  const bg = await page.$eval('.st-tile', e => getComputedStyle(e).backgroundColor);
  check('dark mode: tiles are dark', bg.match(/\d+/g).slice(0, 3).every(n => Number(n) < 90), bg);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => { location.hash = '#/p/statty'; });
  check('the board has a Stats button that opens the page', !!(await until(() => page.$('button[onclick*="#/stats/statty"]'), 8000)));
  await page.click('button[onclick*="#/stats/statty"]');
  check('and it goes to the stats page', !!(await until(() => page.$('.st-page'), 8000)));
  noErrors(page);
  await page.close();
  void todo; void empty;
}, true);
