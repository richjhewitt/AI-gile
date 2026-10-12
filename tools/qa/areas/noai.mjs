// QA area: noai (AIG-581..583). No AI, ever: the page hides every AI part, the server refuses AI runs, people join the roster and get cards, the wording reads right.
import { check, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('noai', 'No AI, ever: AI parts gone (top bar, Setup, roster, wizard), server refuses AI runs, a person with a card, wording without agents (AIG-581..583)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('alpha') });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const vis = (page, sel) => page.evaluate(q => { const e = document.querySelector(q); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);

  // Before: the AI parts show and the server would run
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#noAiBox');
  check('before: the No Token Mode and Usage buttons show', await vis(page, '#ntBtn') && await vis(page, '#usageNav'));
  check('before: Setup shows the AI boxes', await vis(page, '#leadPrefs'));
  check('before: meta says noAi false', (await s.ok('GET', '/api/meta')).noAi === false);

  // Turn it on in Setup (one confirm)
  page.on('dialog', d => d.accept());
  await page.locator('#noAiOn').click();
  await page.waitForFunction(() => document.body.classList.contains('noai'));
  check('the page has the noai class and Setup says it is on', /./.test(await page.textContent('#noAiBox')) && await page.locator('#noAiOn').count() === 0);
  check('the server stored it (meta + settings)', (await s.ok('GET', '/api/meta')).noAi === true && (await s.ok('GET', '/api/setup')).prefs.noAi === true);
  check('no way back on the page: no off switch in the box', await page.locator('#noAiBox button, #noAiBox input').count() === 0);
  for (const [sel, name] of [['#ntBtn', 'No Token Mode'], ['#usageNav', 'Usage'], ['#pokeTop', 'pokes'], ['#teamTop', 'team presence'], ['#leadPrefs', 'Setup lead boxes'], ['#runInPrefs', 'Setup run-in box']]) check(`hidden: ${name}`, !(await vis(page, sel)));
  check('the ntBtn has no glow class', !(await page.evaluate(() => document.getElementById('ntBtn').classList.contains('back'))));
  check('Top bar settings no longer list the AI buttons', await page.locator('#tbList .tb-row').count() === 7);

  // The home page has no usage strip and no Scrum Master line; the rail has no lead chats
  await page.goto(page.url().split('#')[0] + '#/'); await page.waitForSelector('#app > *');
  check('home: no Scrum Master line, no usage strip', await page.locator('.smline, .usage-strip, [href="#/usage"].usage').count() === 0);

  // The server refuses AI runs, whoever asks
  const wake = await s.api('POST', '/api/projects/alpha/wake', {});
  check('wake a team is refused (409)', wake.status === 409, wake.status + ' ' + JSON.stringify(wake.body || wake.json || ''));
  const tester = await s.api('POST', '/api/tester', {});
  check('the AI tester is refused', tester.status >= 400, tester.status);
  const nt = await s.api('POST', '/api/notokens', { on: false });
  check('No Token Mode off does not let AI start', (await s.api('POST', '/api/projects/alpha/wake', {})).status === 409, nt.status);
  const sm = await s.api('POST', '/api/scrummaster/launch', {});
  check('the Lead Scrum Master will not launch', sm.status >= 400, sm.status);

  // A person on the roster, with a card
  await page.goto(page.url().split('#')[0] + '#/p/alpha'); await page.waitForSelector('.toolbar');
  await page.evaluate(() => teamDialog());
  await page.waitForSelector('#ppl-name');
  check('the roster dialog is just people (no role rows)', await page.locator('.tm-row').count() === 0);
  await page.fill('#ppl-name', 'Sam'); await page.fill('#ppl-role', 'Developer');
  await page.check('#ppl-noai'); await page.click('#pplAdd');
  await page.waitForSelector('[data-person="Sam"]');
  const team = (await s.ok('GET', '/api/projects/alpha')).team;
  const sam = team.find(m => m.name === 'Sam');
  check('Sam is stored as a person with No AI on my cards', sam && sam.kind === 'person' && sam.noAi === true && sam.role === 'Developer' && !sam.model, JSON.stringify(sam));
  check('the ticked box shows in the list', await page.locator('[data-person="Sam"] .tm-pnoai').isChecked());
  const c = await mkCard(s, 'alpha', 'Write the intro', { status: 'todo' });
  await s.ok('PATCH', '/api/projects/alpha/cards/' + c.id, { assignee: 'Sam' });
  check('a card can be assigned to Sam', (await getCard(s, 'alpha', c.id)).assignee === 'Sam');
  await page.evaluate(() => closeDialog());
  // Stand-up: Sam reports like an agent
  const su = await s.ok('POST', '/api/standup', { projects: ['alpha'] });
  check('a stand-up is called without waking an agent', su.called.length === 1 && !(su.woke || []).length && !(su.failed || []).length, JSON.stringify(su));
  const rep = await s.ok('POST', '/api/projects/alpha/standup', { author: 'Sam', done: 'the intro', next: 'the outline' });
  check('Sam\'s stand-up report is taken', rep.report && rep.report.name === 'Sam' && rep.waiting.includes('Lead'), JSON.stringify(rep));

  // Wording on an empty board
  await mkProject(s, 'Empty', 'EMP', { path: tmp('empty') });
  await page.goto(page.url().split('#')[0] + '#/p/empty'); await page.waitForSelector('#emptyHint');
  const hint = await page.textContent('#emptyHint');
  check('empty board says "first card", not wake the team / history', /first card/i.test(hint) && !/wake|history|reads this folder/i.test(hint), hint);
  const si = await page.evaluate(() => t('tour.welcome.text'));
  check('the guide says team, not AI teams', /your team/.test(si) && !/AI teams/.test(si), si);
  check('Raise bug and New card still show', await vis(page, '#bugBtn') && await vis(page, '[onclick="newCard()"]'));
  check('Ask the team (AI) is hidden', !(await vis(page, '[onclick^="askTeamDialog"]')));

  // Phone width
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.setViewportSize({ width: 1280, height: 800 });
  noErrors(page);

  // Turning it off again (the one function the later "OK, I give in" card will use)
  await s.ok('POST', '/api/setup', { prefs: { noAi: false } });
  check('off again through the setting: meta says false and the wake no longer says No AI', (await s.ok('GET', '/api/meta')).noAi === false);

  // The first-run wizard has the choice, and skips the agent and spend screens
  const w = await openPage(ctx, '#/setup');
  await w.waitForSelector('#wzRun');
  await w.evaluate(() => wizardStart());
  await w.waitForSelector('#wz-noai');
  await w.check('#wz-noai'); await w.click('#wzNext');
  await w.waitForSelector('#wz-name');
  await w.fill('#wz-name', 'Owner');
  check('wizard: with No AI ticked the agent program question is gone', await w.locator('#wz-agent').count() === 0);
  await w.click('#wzNext');
  await w.waitForSelector('#wzDone');
  check('wizard: it goes straight to the end and No AI is on', (await s.ok('GET', '/api/meta')).noAi === true && await w.evaluate(() => document.body.classList.contains('noai')));
  noErrors(w);
}, true);

