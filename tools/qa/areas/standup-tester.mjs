// QA areas: standup, aitester.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('standup', '📣 Stand-ups: call one or all (wakes teams), teams answer with the CLI, the report page shows blockers first and updates live, the morning prompt shows once a day (AIG-133..136)', async (s, ctx) => {
  const folder = tmp('standup');
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  await mkProject(s, 'Beta', 'BET'); await mkProject(s, 'Delta', 'DEL');
  const cardsOf = async slug => (await s.ok('GET', '/api/projects/' + slug)).cards.filter(c => c.standup);

  // ---- 133: call one ----
  const page = await openPage(ctx, '#/p/alpha');
  page.on('dialog', d => d.accept());
  await page.click('button:has-text("📣 Stand-up")');
  await page.waitForFunction(() => location.hash === '#/standups/alpha');
  const a = await cardsOf('alpha');
  check('one project: stand-up card in For the team, marked', a.length === 1 && a[0].status === 'team' && a[0].title === '📣 Stand-up' && !!a[0].standup.at && a[0].createdBy === 'Owner', a);
  check('other projects left alone', !(await cardsOf('beta')).length && !(await cardsOf('delta')).length);
  let out = '';
  for (let i = 0; i < 40 && !out.includes('project alpha'); i++) { await sleep(250); try { out = fs.readFileSync(s.wakeOut, 'utf8'); } catch {} }
  check('sleeping team was woken', /project alpha/.test(out), out);
  // The roster comes after the wake: a team showing as working counts as awake and is not started again.
  for (const [n, st] of [['Forge', 'working'], ['Pixel', 'idle'], ['Old', 'retired']]) s.cli(['team', 'alpha', n, '--status', st]);
  const again = await s.ok('POST', '/api/standup', { projects: ['alpha'] });
  check('calling again does not add a second card', again.already.length === 1 && again.called.length === 0 && (await cardsOf('alpha')).length === 1, again);
  check('unknown project refused', (await s.api('POST', '/api/standup', { projects: ['nope'] })).status === 404);

  // ---- 133: call all ----
  await page.goto(BASE + '/#/');
  await page.click('button:has-text("Stand-up all")');
  await page.waitForFunction(() => location.hash === '#/standups');
  check('all: every project has one stand-up card', (await cardsOf('alpha')).length === 1 && (await cardsOf('beta')).length === 1 && (await cardsOf('delta')).length === 1);
  const upd = await s.ok('GET', '/api/projects/beta/updates');
  check('the team hears about it through updates', upd.cards.some(c => c.title === '📣 Stand-up'));

  // ---- 134: the CLI report ----
  const id = a[0].id;
  const rep = (who, extra) => s.cli(['standup', 'alpha', '--done', 'Built the thing', '--next', 'Test the thing', ...extra, '--as', who]);
  const r1 = rep('Forge', ['--blockers', `Need the API key from Owner (${id})`]);
  check('Forge answers; Pixel still to answer', r1.code === 0 && /Still to answer: Pixel/.test(r1.out) && !/Old/.test(r1.out), r1);
  const r2 = rep('Pixel', ['--blockers', 'none']);
  check('everyone answered (retired member not needed)', r2.code === 0 && /Everyone has answered/.test(r2.out), r2);
  const card = await getCard(s, 'alpha', id);
  check('reports stored on the card, with a comment each', card.standup.reports.length === 2 && card.standup.reports[1].blockers === 'none' && card.comments.length === 2, card.standup);
  rep('Pixel', ['--blockers', 'none']);
  check('answering twice replaces, not adds', (await getCard(s, 'alpha', id)).standup.reports.length === 2);
  check('blockers are optional (default none)', s.cli(['standup', 'alpha', '--done', 'x', '--next', 'y', '--as', 'Pixel']).code === 0 && (await getCard(s, 'alpha', id)).standup.reports.find(r => r.name === 'Pixel').blockers === 'none');
  rep('Pixel', ['--needs', 'Owner to test the export (AIG-9)', '--blockers', 'none (other work goes on)']);   // AIG-191
  check('--needs is stored apart from blockers', (await getCard(s, 'alpha', id)).standup.reports.find(r => r.name === 'Pixel').needs === 'Owner to test the export (AIG-9)');
  check('--as is required', s.cli(['standup', 'alpha', '--done', 'x', '--next', 'y']).code === 1);
  check('--done is required', s.cli(['standup', 'alpha', '--next', 'y', '--as', 'Forge']).code === 1);
  s.cli(['standup', 'beta', '--done', 'Shipped it', '--next', 'Rest', '--as', 'Solo']);
  check('help lists the command', /standup <proj>/.test(s.cli(['help']).out));

  // ---- 135: the report page ----
  const rp = await openPage(ctx, '#/standups');
  await rp.waitForSelector('.su-proj');
  const html = await rp.innerHTML('.su');
  check('blockers box comes first, in red, with a link to the card', html.indexOf('su-blockers') < html.indexOf('su-proj') && (await rp.textContent('.su-blockers')).includes('Need the API key') && (await rp.getAttribute('.su-blockers a', 'href')) === `#/p/alpha/${id}`);
  check('only real blockers are listed (not "none")', (await rp.locator('.su-blockers li').count()) === 1);
  check('needs-you answers are listed apart, in amber (AIG-191)', (await rp.textContent('.su-needs')).includes('Owner to test the export'));
  const alphaTxt = await rp.textContent('.su-proj:has-text("Alpha")');
  check('per person: done, next, blockers', ['Forge', 'Pixel', 'Built the thing', 'Test the thing', 'Need the API key'].every(t => alphaTxt.includes(t)) && /2 of 2 answered/.test(alphaTxt) && !alphaTxt.includes('Old'), alphaTxt);
  check('blocker text is red', (await rp.locator('.su-red').count()) === 1);
  check('delta shows nobody yet', /0 of 0 answered/.test(await rp.textContent('.su-proj:has-text("Delta")')));
  s.cli(['team', 'beta', 'Late', '--status', 'working']);
  await rp.waitForSelector('.su-person.waiting:has-text("Late")', { timeout: 4000 });
  s.cli(['standup', 'beta', '--done', 'Live update works', '--next', 'n', '--as', 'Late']);
  await rp.waitForSelector('.su-proj:has-text("Live update works")', { timeout: 4000 });
  check('page refreshes live with the poll', true);
  const bp = await openPage(ctx, '#/p/alpha');
  check('board links to the report once answers exist', (await bp.locator('a:has-text("Stand-up report")').count()) === 1);
  await s.ok('POST', '/api/projects', { name: 'Fresh', key: 'FRS' });
  check('answering with no open stand-up is refused', (await s.api('POST', '/api/projects/fresh/standup', { author: 'X', done: 'a' })).status === 404 && s.cli(['standup', 'fresh', '--done', 'a', '--next', 'b', '--as', 'X']).code === 1);
  const fp = await openPage(ctx, '#/p/fresh');
  check('no report link before any answers', (await fp.locator('a:has-text("Stand-up report")').count()) === 0);
  noErrors(page); noErrors(rp); noErrors(bp);
  // Close them: the pages share localStorage, and their own start-up timers would otherwise eat the prompt below.
  for (const pg of [page, rp, bp, fp]) await pg.close();

  // ---- 136: the morning prompt ----
  openPage.morning = true;
  try {
    const mp = await openPage(ctx, '#/');
    const reset = async v => { await mp.evaluate(v => { if (v) localStorage.setItem('aigile.standupAsked', v); else localStorage.removeItem('aigile.standupAsked'); }, v); await mp.reload(); await mp.waitForSelector('#app > *'); };
    await reset(null);
    await mp.waitForSelector('#suPrompt', { timeout: 5000 });
    const t = await mp.textContent('#suPrompt');
    check('first open of the day shows the prompt', ['Call stand-ups?', 'All projects', 'Pick…', 'Not today'].every(x => t.includes(x)), t);
    check('it is a pill, not a dialog', (await mp.locator('#dialog > *').count()) === 0);
    await mp.click('#suPrompt button:has-text("Not today")');
    check('Not today hides it', (await mp.locator('#suPrompt').count()) === 0);
    await mp.reload(); await mp.waitForSelector('#app > *'); await sleep(2500);
    check('not shown again the same day', (await mp.locator('#suPrompt').count()) === 0);
    await reset('2000-01-01');
    await mp.waitForSelector('#suPrompt', { timeout: 5000 });
    check('shown again on a new day', true);
    await mp.click('#suPrompt button:has-text("Pick")');
    await mp.waitForSelector('#dialog .su-pick');
    check('Pick lists the projects', (await mp.locator('.su-pick input').count()) === 4);
    await mp.click('#dialog button[type=submit]');
    check('nothing ticked: asks to tick one', /Tick at least one/.test(await mp.textContent('#su-err')));
    const before = (await cardsOf('fresh')).length;
    await mp.check('.su-pick input[value=fresh]');
    await mp.click('#dialog button[type=submit]');
    await mp.waitForFunction(() => location.hash === '#/standups/fresh');
    check('Pick calls only the ticked project', (await cardsOf('fresh')).length === before + 1);
    await reset('2000-01-01');
    await mp.waitForSelector('#suPrompt', { timeout: 5000 });
    await s.ok('PATCH', `/api/projects/fresh/cards/${(await cardsOf('fresh'))[0].id}`, { status: 'done' });
    await mp.click('#suPrompt button:has-text("All projects")');
    await mp.waitForFunction(() => location.hash === '#/standups');
    check('All projects calls every project without asking', (await cardsOf('fresh')).length === 2 && (await cardsOf('alpha')).length === 1);
    // Not over typing: a focused field holds it back until the field is left.
    const tp = await openPage(ctx, '#/p/alpha');
    await tp.evaluate(() => localStorage.removeItem('aigile.standupAsked'));
    await tp.reload(); await tp.waitForSelector('#f-q'); await tp.focus('#f-q');
    await sleep(2500);
    check('not shown while a field has focus', (await tp.locator('#suPrompt').count()) === 0);
    await tp.evaluate(() => document.activeElement.blur());
    await tp.waitForSelector('#suPrompt', { timeout: 6000 });
    check('shown once the field is left', true);
    noErrors(mp); noErrors(tp);
    await mp.close(); await tp.close();
  } finally { openPage.morning = false; }
}, true);

def('aitester', 'AI tester: lists unchecked tests, posts pass/fail/skip with evidence, Accept all AI-passed (AIG-163)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Dark mode'), b = await mkCard(s, 'alpha', 'Export'), c = await mkCard(s, 'alpha', 'Login');
  for (const x of [a, b, c]) s.cli(['test', 'alpha', x.id, '- Click **Theme**: it goes dark', '--as', 'Lead']);
  const list = s.cli(['tests', 'alpha']);
  check('tests lists the unchecked tests with their steps', list.code === 0 && list.out.includes(a.id) && /Click Theme: it goes dark/.test(list.out), list.out);
  const shot = path.join(tmp('aitester'), 'shot.png');
  fs.writeFileSync(shot, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const pass = s.cli(['checked', 'alpha', a.id, 'pass', 'Clicked Theme, the page went dark', '--shot', shot, '--as', 'Tester']);
  check('checked pass keeps it for you with the evidence', pass.code === 0 && (await getCard(s, 'alpha', a.id)).aiCheck.result === 'pass' && (await getCard(s, 'alpha', a.id)).status === 'verify', pass);
  s.cli(['checked', 'alpha', b.id, 'fail', 'No Export button on the page', '--as', 'Tester']);
  check('checked fail sends it back to the team', (await getCard(s, 'alpha', b.id)).status === 'team');
  s.cli(['checked', 'alpha', c.id, 'skip', 'Needs your login', '--as', 'Tester']);
  check('tests leaves out what was checked', !s.cli(['tests', 'alpha']).out.includes(a.id));
  check('checking a card that is not waiting on you is refused', s.cli(['checked', 'alpha', b.id, 'pass', 'x', '--as', 'Tester']).code !== 0);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ai-ev.pass');
  check('the inbox shows the evidence and its screenshot', /went dark/.test(await page.textContent('.ai-ev.pass')) && (await page.locator('.ai-ev.pass img').count()) === 1);
  check('the passed test is first in the list, with its 🤖 chip (AIG-196)', /Passed/.test(await page.textContent('#ibT .ib-item .pill.ai.pass')) && (await page.getAttribute('#ibT .ib-item', 'data-id')) === a.id);
  check('Accept all AI-passed counts only the passed ones', /\(1\)/.test(await page.textContent('#ibAiAll')));
  await page.click('#ibAiAll');
  await page.waitForFunction(() => document.getElementById('ibAiAll').hidden, null, { timeout: 5000 }).catch(() => {});
  check('Accept all accepts them', (await getCard(s, 'alpha', a.id)).status === 'done' && (await getCard(s, 'alpha', c.id)).status === 'verify');
  s.cli(['test', 'alpha', c.id, 'new steps', '--as', 'Lead']);
  check('handing over again clears the old check', !(await getCard(s, 'alpha', c.id)).aiCheck);
  noErrors(page);
  // ---- AIG-300: the For you column header has a 🤖 button, and AI-passed tests sort to the top ----
  const d = await mkCard(s, 'alpha', 'Zoom'), e = await mkCard(s, 'alpha', 'Print'), f = await mkCard(s, 'alpha', 'Share');
  for (const x of [d, e, f]) s.cli(['test', 'alpha', x.id, '- Click **Go**: it works', '--as', 'Lead']);
  s.cli(['checked', 'alpha', f.id, 'pass', 'Worked', '--as', 'Tester']);
  const bp = await openPage(ctx, '#/p/alpha');
  await bp.waitForSelector('.column.foryou .card');
  const firstId = await bp.evaluate(() => document.querySelector('.column.foryou .card').dataset.id || document.querySelector('.column.foryou .card').textContent);
  check('AI-passed test is first in the For you column, with its 🤖 chip', String(firstId).includes(f.id) && (await bp.locator('.column.foryou .card').first().locator('.pill.ai.pass').count()) === 1, firstId);
  const rb = bp.locator('.column.foryou [id^="fyTester-"]');
  check('🤖 button shows the count of tests waiting (3 unchecked)', (await rb.count()) === 1 && /3/.test(await rb.textContent()) && /3/.test(await rb.getAttribute('title')), await rb.textContent());
  // ---- AIG-454: the tester runs in its own folder under data/, not AI-gile's, and leaves the owner's news unseen ----
  await s.ok('GET', '/api/projects/alpha/updates?mark=1');   // the team has looked: teamSeenAt = now
  const marked = (await s.ok('GET', '/api/projects/alpha')).teamSeenAt;
  const news = await mkCard(s, 'alpha', 'Owner news after the mark', { createdBy: 'Owner' });   // unseen owner news
  fs.rmSync(s.wakeOut, { force: true });
  await rb.click();
  await bp.waitForFunction(() => /AI tester started/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
  check('clicking it starts the AI tester', /AI tester started/.test(await bp.innerText('body')));
  noErrors(bp);
  let where = '';
  for (let i = 0; i < 40 && !where; i++) { await sleep(250); try { where = fs.readFileSync(s.wakeOut, 'utf8').split(/\r?\n/)[0].trim(); } catch {} }
  const real = p => { try { return fs.realpathSync(p).toLowerCase(); } catch { return path.resolve(p).toLowerCase(); } };
  check('the tester runs in data/tester, not the AI-gile folder', !!where && real(where) === real(path.join(s.data, 'tester')) && real(where) !== real(REPO), where);
  check('the tester folder has only its brief, no hooks or settings', fs.existsSync(path.join(s.data, 'tester', 'CLAUDE.md')) && !fs.existsSync(path.join(s.data, 'tester', '.claude')));
  const after = (await s.ok('GET', '/api/projects/alpha')).teamSeenAt;
  check("a tester run leaves the project's teamSeenAt unchanged", !!marked && after === marked, { marked, after });
  check("the owner's news is still unseen after a tester run", (await s.ok('GET', '/api/projects/alpha/updates')).cards.some(c => c.id === news.id), 'news card');
}, true);
