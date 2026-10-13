// QA area: risks (AIG-863): the per-project risk register. API (GET/POST/PATCH), CLI (add, list, set), the brief's overdue line,
// happened -> a 🔥 incident card, old projects untouched, and the Risks page (list order, overdue mark, phone width, dark mode).
import { check, mkProject, mkCard, getCard, def, openPage, noErrors, until } from '../lib.mjs';

def('risks', '⚠️ risk register: API, CLI add/list/set, brief overdue line, happened files an incident card, Risks page (AIG-863)', async (s, ctx) => {
  await mkProject(s, 'Rego', 'REG');
  const card = await mkCard(s, 'rego', 'Risky migration', { status: 'todo' });
  const empty = await s.ok('GET', '/api/projects/rego/risks');
  check('a project with no register lists nothing', empty.risks.length === 0 && empty.overdue === 0, empty);
  check('an unknown project is a 404', (await s.api('GET', '/api/projects/nope/risks')).status === 404);

  check('a risk needs its text', (await s.api('POST', '/api/projects/rego/risks', { likelihood: 2 })).status === 400);
  check('likelihood must be 1 to 3', (await s.api('POST', '/api/projects/rego/risks', { risk: 'x', likelihood: 4 })).status === 400);
  check('review must be a date', (await s.api('POST', '/api/projects/rego/risks', { risk: 'x', review: 'soon' })).status === 400);
  const low = await s.ok('POST', '/api/projects/rego/risks', { risk: 'Typo in footer', likelihood: 1, impact: 1, category: 'content' });
  check('add: id, score, default status', low.id === 'R-1' && low.score === 1 && low.status === 'open', low);
  const big = await s.ok('POST', '/api/projects/rego/risks', { risk: 'Data loss on migrate', card: card.id, likelihood: 2, impact: 3, owner: 'Lead', mitigation: 'Backup first', warning: 'Row counts differ', review: '2020-01-01' });
  check('score is likelihood x impact', big.score === 6 && big.overdue === true, big);
  const list = await s.ok('GET', '/api/projects/rego/risks');
  check('listed highest score first, overdue counted', list.risks[0].id === big.id && list.risks[1].id === low.id && list.overdue === 1, list);

  const upd = await s.ok('PATCH', '/api/projects/rego/risks/' + low.id, { impact: 3, status: 'watching', review: '2999-01-01' });
  check('PATCH changes fields and the score', upd.score === 3 && upd.status === 'watching' && upd.review === '2999-01-01', upd);
  check('PATCH a bad status is refused', (await s.api('PATCH', '/api/projects/rego/risks/' + low.id, { status: 'dead' })).status === 400);
  check('PATCH an unknown risk is a 404', (await s.api('PATCH', '/api/projects/rego/risks/R-99', { status: 'closed' })).status === 404);

  // CLI
  const add = s.cli(['risk', 'rego', 'add', 'Vendor API changes', '--card', card.id, '--likelihood', '3', '--impact', '2', '--mitigation', 'pin the version', '--warning', 'deprecation mail', '--review', '2999-12-31', '--as', 'Lead']);
  check('CLI add', add.code === 0 && /R-3 added \(score 6\)/.test(add.out), add);
  const ls = s.cli(['risk', 'rego']);
  check('CLI list: highest score first, overdue marked', ls.code === 0 && ls.out.indexOf('R-2') < ls.out.indexOf('R-1') && /R-2 .*OVERDUE/.test(ls.out), ls);
  const old = s.cli(['risk', 'rego', card.id, 'risky', '--as', 'Lead']);
  check('the old risk <proj> <id> risky still sets the card label', old.code === 0 && (await getCard(s, 'rego', card.id)).risk === 'risky', old);
  const br = s.cli(['brief', 'rego']).out;
  check('brief flags overdue reviews', /Risks: 1 overdue for review/.test(br), br.split('\n').filter(l => /Risks/.test(l)));
  const closed = s.cli(['risk', 'rego', 'set', 'R-2', '--status', 'closed']);
  check('CLI set status', closed.code === 0 && /R-2 \[closed\]/.test(closed.out), closed);
  check('a closed risk is no longer overdue; brief has no line', !/Risks: \d+ overdue/.test(s.cli(['brief', 'rego']).out));
  check('help mentions the register', /risk <proj> add/.test(s.cli(['help']).out));

  // happened -> incident
  const hap = s.cli(['risk', 'rego', 'set', 'R-3', '--status', 'happened']);
  check('CLI set happened names the incident card', hap.code === 0 && /-> REG-\d+/.test(hap.out), hap);
  const inc = (await s.ok('GET', '/api/projects/rego')).cards.find(c => c.title === '🔥 Incident: Vendor API changes');
  check('a 🔥 incident card (bug, high) was made', !!inc && inc.type === 'bug' && inc.priority === 'high' && inc.riskId === 'R-3', inc);
  await s.ok('PATCH', '/api/projects/rego/risks/R-3', { status: 'happened', mitigation: 'again' });
  check('setting happened twice makes only one card', (await s.ok('GET', '/api/projects/rego')).cards.filter(c => /Incident: Vendor/.test(c.title)).length === 1);
  const direct = await s.ok('POST', '/api/projects/rego/risks', { risk: 'Already burning', status: 'happened' });
  check('a risk added as happened files its card too', !!direct.incident, direct);

  // Page
  await s.ok('POST', '/api/projects/rego/risks', { risk: 'Old and overdue', likelihood: 1, impact: 1, review: '2020-02-02' });
  const page = await openPage(ctx, '#/risks/rego');
  check('the page lists the risks', !!(await until(() => page.$('.rk-row'), 8000)));
  const rows = await page.$$eval('.rk-row', els => els.map(e => ({ s: e.querySelector('.rk-score').textContent, od: e.classList.contains('rk-overdue'), t: e.querySelector('b').textContent })));
  check('highest score first', rows.every((r, i) => i === 0 || Number(rows[i - 1].s) >= Number(r.s)), rows);
  check('overdue review is marked', rows.some(r => r.od && /Old and overdue/.test(r.t)), rows);
  await page.selectOption('.rk-row:last-child select', 'closed');
  check('changing the status on the page saves it', !!(await until(async () => (await s.ok('GET', '/api/projects/rego/risks')).risks.some(r => r.status === 'closed' && r.risk === rows[rows.length - 1].t), 8000)));
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(200);
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload(); await page.waitForSelector('.rk-row');
  const bg = await page.$eval('.rk-row', e => getComputedStyle(e).backgroundColor);
  check('dark mode: rows are dark', bg.match(/\d+/g).slice(0, 3).every(n => Number(n) < 90), bg);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => { location.hash = '#/p/rego'; });
  check('the board has a Risks button', !!(await until(() => page.$('button[onclick*="#/risks/rego"]'), 8000)));
  await page.click('button[onclick*="#/risks/rego"]');
  check('and it goes to the risks page', !!(await until(() => page.$('.rk-page'), 8000)));
  noErrors(page);
  await page.close();
}, true);
