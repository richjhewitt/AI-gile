// QA area: noai (AIG-581..583). No AI, ever: the page hides every AI part, the server refuses AI runs, people join the roster and get cards, the wording reads right.
import { check, tmp, freePort, startServer, ROOT, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
  check('the box offers only the friendly way out, no off switch', await page.locator('#noAiBox button').count() === 1 && await page.locator('#noAiGiveIn').count() === 1 && await page.locator('#noAiBox input').count() === 0);
  for (const [sel, name] of [['#ntBtn', 'No Token Mode'], ['#usageNav', 'Usage'], ['#pokeTop', 'pokes'], ['#teamTop', 'team presence'], ['#leadPrefs', 'Setup lead boxes'], ['#runInPrefs', 'Setup run-in box']]) check(`hidden: ${name}`, !(await vis(page, sel)));
  check('the ntBtn has no glow class', !(await page.evaluate(() => document.getElementById('ntBtn').classList.contains('back'))));
  check('Top bar settings no longer list the AI buttons', await page.locator('#tbList .tb-row').count() > 0 && await page.locator('#tbList .tb-row:is([data-tb="ntBtn"],[data-tb="usageNav"],[data-tb="pokeTop"],[data-tb="nightTop"],[data-tb="teamTop"])').count() === 0);

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
  await page.waitForFunction(() => state.route.view === 'project' && state.route.slug === 'alpha');   // teamDialog needs the project route to have landed (AIG-956)
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
  // AIG-821: nothing lands in "For the team", the assign list is people, no dispatcher lines
  const n1 = await mkCard(s, 'alpha', 'Asked for the team', { status: 'team', createdBy: 'Owner' });
  check('821: a new card meant for the team goes to To do', (await getCard(s, 'alpha', n1.id)).status === 'todo', (await getCard(s, 'alpha', n1.id)).status);
  const n2 = await mkCard(s, 'alpha', 'Comment stays', { status: 'doing' });
  await s.ok('POST', '/api/projects/alpha/cards/' + n2.id + '/comments', { author: 'Owner', text: 'a note to myself' });
  check('821: a comment leaves the card where it is', (await getCard(s, 'alpha', n2.id)).status === 'doing');
  const n3 = await mkCard(s, 'alpha', 'Sent back', { status: 'verify', testSteps: '- look' });
  await s.ok('POST', '/api/projects/alpha/cards/' + n3.id + '/verdict', { text: 'not right' });
  check('821: Send back goes to To do', (await getCard(s, 'alpha', n3.id)).status === 'todo', (await getCard(s, 'alpha', n3.id)).status);
  await new Promise(r => setTimeout(r, 1500));
  check('821: no Dispatcher lines in the log', !((await s.ok('GET', '/api/projects/alpha')).log || []).some(l => l.author === 'Dispatcher'));
  await page.evaluate(() => newCard());
  await page.waitForSelector('#f-assignee');
  const opts = await page.$$eval('#f-assignee option', os => os.map(o => o.value));
  check('821: Assign to lists the team people and the owner, no AI roles', opts.includes('Sam') && opts.includes('Owner') && !opts.includes('Frontend') && !opts.includes('Backend'), opts.join(','));
  await page.evaluate(() => closeDialog());


  // Wording on an empty board
  await mkProject(s, 'Empty', 'EMP', { path: tmp('empty') });
  await page.goto(page.url().split('#')[0] + '#/p/empty'); await page.waitForSelector('#emptyHint');
  const hint = await page.textContent('#emptyHint');
  check('empty board says add a card (AIG-1416: what you want done), not wake the team / history', /first card|what you want done/i.test(hint) && !/wake|history|reads this folder/i.test(hint), hint);
  const si = await page.evaluate(() => t('tour.welcome.text'));
  check('the guide says team, not AI teams', /your team/.test(si) && !/AI teams/.test(si), si);
  check('Raise bug and New card still show', await vis(page, '#bugBtn') && await vis(page, '[onclick="newCard()"]'));
  check('Ask the team (AI) is hidden', !(await vis(page, '[onclick^="askTeamDialog"]')));

  // AIG-821: what makes no sense with no AI team is hidden
  for (const [sel, name] of [['#glanceBtn', 'ScrumGlance'], ['#assumeNav', 'Assumptions'], ['#streamBtn', 'Streamer'], ['[onclick^="openNews"]', 'Team news'], ['[onclick^="callStandup"]', 'Stand-up'], ['.column[data-status="review"]', 'Team checking (empty)'], ['.column[data-status="team"]', 'For the team (empty)'], ['.fy-chip[data-first="t"]', 'Tests chip (empty)'], ['.fy-chip[data-first="p"]', 'Ready for go chip (empty)'], ['.fy-chip[data-first="o"]', 'Outside help chip (empty)']]) check(`821: ${name} is hidden`, !(await vis(page, sel)));
  check('821: the board still has To do and For you', await vis(page, '.column[data-status="todo"]') && await vis(page, '.column[data-status="verify"]'));
  await page.goto(page.url().split('#')[0] + '#/'); await page.waitForSelector('#app > *');
  check('821: home has no Refactor, Going quiet or Stand-up all', !(await vis(page, '[onclick^="refactorOffer"]')) && !(await vis(page, '[onclick^="goQuiet"]')) && !(await vis(page, '[onclick^="callStandup"]')));
  const c821 = await mkCard(s, 'alpha', 'Panel check', { status: 'todo' });
  await page.goto(page.url().split('#')[0] + `#/p/alpha/${c821.id}`); await page.waitForSelector('[data-ctab="details"]'); await page.click('[data-ctab="details"]');
  await page.waitForSelector('#packCopy', { state: 'attached' });
  check('821: card panel has no Copy for another AI, Paste the reply, No QA yet, Edit file', !(await vis(page, '#packCopy')) && !(await vis(page, '#packPaste')) && !(await vis(page, '.qa-gate.none')) && !(await vis(page, '[onclick^="Editor.open"]')));
  await page.evaluate(() => { location.hash = '#/glossary'; });
  await page.waitForSelector('.gloss-item');
  check('821: glossary has no agent word', !(await page.locator('.gloss-list dt').allInnerTexts()).includes('Agent'));
  await page.evaluate(() => introOpen()); await page.waitForSelector('#introSlide');
  const slides = await page.evaluate(() => INTRO.slides.map(x => x.h));
  check('821: intro skips the team plan and going quiet slides, no numbers', slides.length === 6 && !slides.some(h => /^\d+\./.test(h) || /[🧭🌙]/u.test(h)), slides);
  await page.evaluate(() => closeDialog());
  await mkProject(s, 'Life', 'LIF'); await s.ok('PATCH', '/api/projects/life', { lifeBoard: true });
  await page.goto(page.url().split('#')[0] + '#/p/life'); await page.waitForSelector('#emptyHint');
  check('821: a life project does not say Connect', !/connect/i.test(await page.textContent('.toolbar')) && !/connect/i.test(await page.textContent('#emptyHint')));
  fs.mkdirSync(path.join(process.env.TEMP || '.', 'medic-calm'), { recursive: true });
  await page.screenshot({ path: path.join(process.env.TEMP || '.', 'medic-calm', 'noai-board.png') });

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

  // 😅 OK, I give in: try AI (AIG-618). AI comes back and the wizard opens on the team step.
  await w.reload(); await w.waitForSelector('#noAiGiveIn');
  await w.click('#noAiGiveIn');
  await w.waitForSelector('#wa-body');
  check('give in: AI is back on the server and the page', (await s.ok('GET', '/api/meta')).noAi === false && await w.evaluate(() => !document.body.classList.contains('noai') && !NoAi.on));
  check('give in: it lands on the wizard\'s team step', await w.evaluate(() => WA.screen === 'roles'));
  check('give in: the AI parts are back (No Token Mode button)', await vis(w, '#ntBtn'));
  await w.evaluate(() => closeDialog());
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  noErrors(w);

  // The No-AI edition (AIG-617): AI files left out, the marker keeps it on for good, give in only explains.
  const out = path.join(tmp('noaibuild'), 'aigile-noai');
  const b = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-noai.mjs'), '--out', out], { encoding: 'utf8' });
  check('the build script runs', b.status === 0, b.stderr || b.stdout);
  const has = f => fs.existsSync(path.join(out, f)), read = f => has(f) ? fs.readFileSync(path.join(out, f), 'utf8') : '';
  check('the NOAI marker is there', has('NOAI'));
  check('AI-only files are absent', !has('profiles/expert-teams.json') && !has('docs/TESTER.md') && !has('docs/SCRUM-MASTER.md') && !has('statusline.js'));
  check('AI-only modules are only stand-ins', ['tester', 'scrummaster', 'watchman', 'usagecheck', 'ask', 'usage', 'limits', 'expertteams'].every(m => /not part of this download/.test(read(`lib/${m}.js`)) && read(`lib/${m}.js`).length < 600));
  check('the board code is still there', has('server.js') && has('lib/store.js') && has('lib/share.js') && has('public/index.html') && has('docs/starter/SOLO-CODER.md'));
  const nb = await startServer({}, await freePort(), out);
  try {
    const meta = await nb.ok('GET', '/api/meta');
    check('the build starts, with No AI on for good', meta.noAi === true && meta.noAiBuild === true);
    await nb.ok('POST', '/api/projects', { name: 'Solo', key: 'SOL' });
    await nb.ok('POST', '/api/projects/solo/team', { name: 'Sam', kind: 'person', role: 'Developer' });
    const card = await nb.ok('POST', '/api/projects/solo/cards', { title: 'First job', assignee: 'Sam' });
    check('board, people and cards work in the build', (await nb.ok('GET', '/api/projects/solo')).cards.some(c => c.id === card.id && c.assignee === 'Sam'));
    const su = await nb.ok('POST', '/api/standup', { projects: ['solo'] });
    check('stand-ups work in the build', su.called.length === 1);
    check('give in over the API is refused (403)', (await nb.api('POST', '/api/noai/off')).status === 403);
    await nb.api('POST', '/api/setup', { prefs: { noAi: false } });
    check('turning it off through Setup does not work either', (await nb.ok('GET', '/api/meta')).noAi === true);
    check('an AI run is refused', (await nb.api('POST', '/api/projects/solo/wake', {})).status === 409);
    check('the AI endpoints do not crash the server', (await nb.api('GET', '/api/tester')).status < 500 && (await nb.ok('GET', '/api/meta')).noAi === true);
    const bp = await ctx.newPage(); bp.errors = []; bp.on('pageerror', e => bp.errors.push(String(e)));
    await bp.goto(nb.base + '/#/setup'); await bp.waitForSelector('#noAiGiveIn');
    check('the build\'s box says to get the full download', /full one/i.test(await bp.textContent('#noAiBox')));
    await bp.click('#noAiGiveIn'); await bp.waitForSelector('#noAiDl');
    check('give in shows where to get the full download and that data carries over', /ai-gile\.lol/.test(await bp.getAttribute('#noAiDl', 'href')) && /data folder/.test(await bp.textContent('.dialog')));
    check('and nothing was turned on', (await nb.ok('GET', '/api/meta')).noAi === true && await bp.evaluate(() => document.body.classList.contains('noai')));
    check('no page errors in the build', bp.errors.length === 0, bp.errors);
  } finally { nb.stop(); }
}, true);

