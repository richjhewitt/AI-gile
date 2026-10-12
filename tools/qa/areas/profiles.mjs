// QA area: profiles (AIG-415): how agents work with the owner. Steps at a time (AIG-416): the setting, the brief line,
// the Setup select, the quiz question and a task's checklist shown a few at a time. The scale table and the brief
// compiler, lib/profiles.js (AIG-417). Today's settings read and written as the owner scales (AIG-418).
// The built-in role templates in profiles/ (AIG-419). Team templates and Add team on a project (AIG-420).
// aigile profile, your own copies in profiles.local and each project's numbers (AIG-421).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, BASE, check, sleep, until, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('profiles', '👤 agent profiles: steps at a time (setting, default 1 or 3, brief line, Setup, quiz, task checklist a few at a time) (AIG-416); scale table, profile file and brief compiler (AIG-417); old settings as scales (AIG-418); built-in role templates (AIG-419); team templates and Add team (AIG-420); aigile profile, your copies, per-project numbers (AIG-421)', async (s, ctx) => {
  const file = path.join(s.dir, 'aigile.local.json');
  const local = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const prefs = async () => (await s.ok('GET', '/api/setup')).prefs;
  await mkProject(s, 'Alpha', 'ALP');
  const brief = () => s.cli(['brief', 'alpha']).out;
  const byHand = /by hand \(server commands/;
  const P = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'profiles.js'));

  // 0. The scale table and the profile file (AIG-417), no server.
  check('every scale has a ways step and a default in range', Object.values(P.SCALES).every(x => x.ways >= 1 && x.ways <= x.max && x.def >= 1 && x.def <= x.max));
  check('steps: new installs 3, the ways of working 1', P.SCALES.steps.def === 3 && P.SCALES.steps.ways === 1);
  const text = '---\nid: frontend-mid\nname: Frontend\nlevel: mid\nmodel: sonnet\nalone: 2\ntests: 9\nwords: lots\nshoes: 3\n---\n## How I work\n- Page side only\n- Phone width and dark mode\n';
  const fe = P.parse(text, 'frontend-mid');
  check('parse reads the labels and the scales', fe.id === 'frontend-mid' && fe.name === 'Frontend' && fe.model === 'sonnet' && fe.scales.alone === 2, fe);
  check('a value out of range, not a number or not a scale is ignored', !('tests' in fe.scales) && !('words' in fe.scales) && !('shoes' in fe.scales), fe.scales);
  check('parse reads the How I work bullets', fe.how.join('|') === 'Page side only|Phone width and dark mode', fe.how);
  const again = P.parse(P.format(fe));
  check('format and parse round-trip', JSON.stringify(again) === JSON.stringify(fe), P.format(fe));
  const m = P.merge(fe, { scales: { tests: 4 } }, { scales: { alone: 1 } });
  check('later layers win, a layer lists only what differs', m.scales.alone === 1 && m.scales.tests === 4 && m.name === 'Frontend' && m.how.length === 2, m);
  check('a role compiles its scales off the ways step, then How I work', P.roleLines(m).join('|') === 'Ask the lead (or the owner) about every choice.|Before handing over: run the full QA area and the edge cases.|- Page side only|- Phone width and dark mode', P.roleLines(m));
  const long = P.roleLines({ scales: {}, how: Array.from({ length: 9 }, (_, i) => String(i).repeat(150)) });
  check('How I work is capped at 6 bullets and 600 characters', long.length === 4 && long.join('').length <= 600 + 8, long.length);
  check('the default owner costs no lines', P.ownerLines({ steps: 1, go: '' }, 'Owner').length === 0);
  check('the go lines are as before', P.ownerLines({ steps: 1, go: 'ask' }, 'Owner')[0] === "Owner's rule: ask before every build, however small. Propose and wait for go." && P.ownerLines({ steps: 1, go: 'small' }, 'Owner')[0] === "Owner's rule: small things (a fix or tweak, under an hour) you may build without asking; log them as a decision. Bigger work: propose and wait for go.");
  check('the helpers line is as before', P.ownerLines({ steps: 1, helpersOpus: 1, helpersSonnet: '', helpersHaiku: 0 }, 'Owner')[0] === "Owner's rule: use at most Opus 1, Haiku 0 helpers at once.");
  check('the roles line is as before', P.rolesLine(['Lead (plans)', 'Frontend', 'Tester (AI)'], 'Owner') === "Owner's rule: You may delegate to: Frontend." && P.rolesLine(['Lead'], 'Owner') === "Owner's rule: You may delegate to: nobody (do it yourself)." && P.rolesLine(undefined, 'Owner') === '');

  // 0b. The built-in role templates (AIG-419): 16 roles at the levels offered, plus Quick fix and the AI tester.
  const T = P.templates(), ids = Object.keys(T), PR = path.join(ROOT, 'profiles');
  const groups = [...new Set(ids.map(P.groupOf))];
  check('16 roles plus Quick fix and Tester, 35 templates', groups.length === 18 && ids.length === 35 && groups.includes('quickfix') && groups.includes('tester'), groups);
  check('each file is named by its id: <role>-<level>', ids.every(id => T[id].id === id && id === P.groupOf(id) + '-' + T[id].level), ids.filter(id => T[id].id !== id));
  check('the level picks the model and alone', ids.every(id => T[id].model === P.LEVELS[T[id].level].model) && T['frontend-junior'].scales.alone === 1 && T['frontend-senior'].scales.alone === 3, T['frontend-junior']);
  check('a role that changes alone keeps its own', T['lead-principal'].scales.alone === 4 && T['devops-senior'].scales.alone === 1 && T['security-principal'].scales.alone === 1);
  check('every template has a name and 1 to 6 How I work bullets', ids.every(id => T[id].name && T[id].how.length >= 1 && T[id].how.length <= 6));
  check('levels offered as in the design', ['lead-principal', 'frontend-junior', 'backend-senior', 'qa-junior', 'security-principal', 'reviewer-senior', 'i18n-mid'].every(id => T[id]) && !T['lead-junior'] && !T['security-junior'] && !T['qa-senior']);
  check('the scales each role changes are in its file', T['qa-mid'].scales.tests === 5 && T['devops-mid'].scales.steps === 1 && T['ux-researcher-mid'].scales.words === 1 && T['pm-senior'].scales.tidy === 3);
  check('every template compiles to at most 8 lines', ids.every(id => P.roleLines(T[id]).length <= 8));
  check('every file parses with no warnings and round-trips', ids.every(id => { const f = fs.readFileSync(path.join(PR, 'roles', id + '.md'), 'utf8'); return P.format(P.parse(f)) === f.replace(/\r/g, ''); }));
  const own = P.parse(fs.readFileSync(path.join(PR, 'owner.md'), 'utf8'));
  check('owner.md holds the ways step of every owner scale', Object.keys(P.SCALES).filter(k => P.SCALES[k].who === 'owner').every(k => own.scales[k] === P.SCALES[k].ways), own.scales);

  // 1. Steps: a new install starts at 3 and keeps it once named; an install named before the setting keeps 1.
  check('a new install starts at 3 steps', (await prefs()).steps === 3, await prefs());
  check('the brief says a small stage at a time', /one small stage at a time/.test(brief()) && /overrides the one-step rule/.test(brief()), brief());
  await s.ok('POST', '/api/setup', { owner: 'Owner' });
  check('naming a new install saves its 3', local().scales && local().scales.steps === 3, local());
  const named = local(); delete named.scales; fs.writeFileSync(file, JSON.stringify(named, null, 2));
  check('an install named before the setting keeps 1 (its ways of working say one step)', (await prefs()).steps === 1);
  check('steps 1 costs no brief line', !byHand.test(brief()), brief());

  for (const [n, re] of [[2, /two or three steps/], [4, /numbered list/], [5, /everything at once/]]) {
    await s.ok('POST', '/api/setup', { prefs: { steps: n } });
    check(`steps ${n} is saved and briefed`, (await prefs()).steps === n && local().scales.steps === n && re.test(brief()), brief());
  }
  for (const bad of [0, 6, 2.5, 'lots', '']) check(`steps ${JSON.stringify(bad)} is refused`, (await s.api('POST', '/api/setup', { prefs: { steps: bad } })).status === 400);
  check('a refused value changes nothing', (await prefs()).steps === 5);
  check('the other settings are left alone', local().owner === 'Owner');
  await s.ok('POST', '/api/setup', { prefs: { go: 'ask', helpersOpus: 1 } });
  check('the brief carries go, steps and helpers in that order', /rule: ask before every build[^\n]*\n[^\n]*everything at once[^\n]*\n[^\n]*at most Opus 1 helpers/.test(brief()), brief());
  await s.ok('POST', '/api/setup', { prefs: { go: '', helpersOpus: '' } });

  // 1b. Today's settings read and written as the owner scales (AIG-418); the old keys still work.
  const sc = async () => (await prefs()).scales;
  const set = p => s.ok('POST', '/api/setup', { prefs: p });
  const all = await sc();
  check('prefs carry every owner scale', ['steps', 'chat', 'go', 'words', 'tidy', 'thrift', 'push'].every(k => k in all), all);
  await set({ chatty: true, go: 'small', tidyCards: true, explain: false, plan: 'careful', smPush: 4 });
  let v = await sc();
  check('old keys read as scales: chatty 3, go small 3, tidy 3, dev words 4, careful = thrift 4, push 4', v.chat === 3 && v.go === 3 && v.tidy === 3 && v.words === 4 && v.thrift === 4 && v.push === 4, v);
  await set({ chatty: false, go: 'ask', tidyCards: false, explain: true });
  v = await sc();
  check('and the other way: chat 2, go 1, tidy 1, plain words 1', v.chat === 2 && v.go === 1 && v.tidy === 1 && v.words === 1, v);
  await set({ scales: { chat: 5, go: 4, tidy: 2, words: 5, thrift: 5, push: 2, steps: 2 } });
  let p = await prefs(); v = p.scales;
  check('scales are written', v.chat === 5 && v.go === 4 && v.tidy === 2 && v.words === 5 && v.thrift === 5 && v.push === 2 && v.steps === 2, v);
  check('and the old keys follow: chatty on, go small, tidy cards on, plan fly, smPush 2', p.chatty === true && p.go === 'small' && p.tidyCards === true && p.plan === 'fly' && p.smPush === 2, p);
  check('the brief says go 4 and words 5', /build whole cards without asking/.test(brief()) && /full technical depth/.test(brief()), brief());
  await set({ chatty: true, go: 'small' });
  check('an old key that says the same keeps the step', (await sc()).chat === 5 && (await sc()).go === 4);
  await set({ chatty: false });
  check('an old key that changes moves the step', (await sc()).chat === 2 && (await prefs()).chatty === false);
  await set({ scales: { go: 2 } });
  check('go 2 clears the old go rule', (await prefs()).go === '' && local().lead.go === undefined);
  for (const bad of [{ alone: 2 }, { chat: 6 }, { tidy: 4 }, { go: 'x' }, { steps: 0 }]) check(`scales ${JSON.stringify(bad)} is refused`, (await s.api('POST', '/api/setup', { prefs: { scales: bad } })).status === 400);
  check('scales as a list is refused', (await s.api('POST', '/api/setup', { prefs: { scales: [3] } })).status === 400);
  const hand = local(); hand.scales.tidy = 2; hand.lead.tidyCards = false; fs.writeFileSync(file, JSON.stringify(hand, null, 2));
  check('a switch changed by hand in the file wins over a stale step', (await sc()).tidy === 1);
  await set({ scales: { words: 2, go: 2, steps: 5 } });
  check('words 2 and go 2 cost no brief line', !/technical depth|without asking/.test(brief()), brief());

  // 1c. Team templates and ➕ Add team (AIG-420): old role names still read, other roles kept by id.
  const lib = await s.ok('GET', '/api/profiles');
  check('the page gets 35 roles and 7 teams', lib.roles.length === 35 && lib.teams.length === 7, [lib.roles.length, lib.teams.length]);
  check('every team lists only roles that exist, each with when to use it', lib.teams.every(tm => tm.roles.length >= 3 && tm.when && tm.roles.every(id => lib.roles.some(r => r.id === id))), lib.teams);
  check('a role carries its label', lib.roles.find(r => r.id === 'ux-researcher-senior').label === 'UX researcher, senior (Sonnet)' && lib.roles.find(r => r.id === 'frontend-mid').label === 'Frontend (Sonnet)');
  await mkProject(s, 'Web', 'WEB');
  const roles = async sl => (await s.ok('GET', '/api/projects/' + sl)).roles;
  let r = await s.ok('POST', '/api/projects/web/apply-team', { team: 'webapp' });
  check('add: the team goes on, the same role at another level is swapped out, the rest kept', r.added.join() === 'reviewer-senior' && r.replaced.join() === 'reviewer-principal' && (await roles('web')).join() === 'Lead (Opus),Frontend (Sonnet),Backend (Sonnet),QA (Haiku),Quick fix (Haiku),Docs (Haiku),Tester (Sonnet),reviewer-senior', r);
  const wb = () => s.cli(['brief', 'web']).out;
  check('the brief names the new role and drops the swapped one', /delegate to: [^\n]*Code reviewer, senior \(Sonnet\)/.test(wb()) && !/Reviewer \(Opus\)/.test(wb()), wb());
  r = await s.ok('POST', '/api/projects/web/apply-team', { team: 'ux' });
  check('a second team adds to the first', ['ux-researcher-senior', 'uxui-mid', 'accessibility-mid'].every(id => r.roles.includes(id)) && r.roles.includes('Frontend (Sonnet)') && r.replaced.length === 0, r);
  r = await s.ok('POST', '/api/projects/web/apply-team', { team: 'security', mode: 'replace' });
  check('replace: only the team, Lead stays on', r.roles.join() === 'Lead (Opus),security-principal,reviewer-senior,devops-mid' && r.replaced.includes('ux-researcher-senior'), r);
  check('an unknown team is refused', (await s.api('POST', '/api/projects/web/apply-team', { team: 'pirates' })).status === 404);
  check('an unknown mode is refused', (await s.api('POST', '/api/projects/web/apply-team', { team: 'ux', mode: 'merge' })).status === 400);
  await s.ok('PATCH', '/api/projects/web', { roles: ['frontend-mid', 'data-senior', 'nobody-mid', 'Docs (Haiku)'] });
  check('roles by id or old name; an id of today\'s 8 is kept by its old name; unknown dropped; Lead on', (await roles('web')).join() === 'Lead (Opus),Frontend (Sonnet),Docs (Haiku),data-senior', await roles('web'));
  await s.ok('PATCH', '/api/projects/web', { roles: Object.keys(P.OLD_ROLES).map(k => P.OLD_ROLES[k]) });
  check('today\'s 8 by id is all on, stored as nothing', (await roles('web')) === undefined);
  await s.ok('POST', '/api/setup', { prefs: { newRoles: ['QA (Haiku)', 'mobile-senior'] } });
  check('new projects may start with role templates too', (await prefs()).newRoles.join() === 'Lead (Opus),QA (Haiku),mobile-senior', (await prefs()).newRoles);
  check('an unknown role for new projects is refused', (await s.api('POST', '/api/setup', { prefs: { newRoles: ['nobody-mid'] } })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { newRoles: '' } });

  // 1d. aigile profile (AIG-421): a role's lines for a helper, your own copies for all projects, this project's numbers.
  const prof = (...a) => s.cli(['profile', 'web', ...a]);
  check('the brief says how to brief helpers', /Brief helpers with: aigile profile web <role>/.test(wb()), wb());
  check('no role lists the roles on the project', /frontend-mid  Frontend \(Sonnet\)/.test(prof().out) && /tester-mid/.test(prof().out), prof().out);
  let fe2 = prof('frontend').out;
  check('a role by name prints its lines: who, the owner\'s steps, How I work', /^Your role: Frontend \(mid, Sonnet\) on Web\./.test(fe2) && /When Owner does something by hand, give everything at once/.test(fe2) && /- Builds the page side only/.test(fe2) && fe2.split('\n').length <= 9, fe2);
  check('by old name too', /^Your role: Code reviewer \(principal, Opus\)/.test(prof('Reviewer (Opus)').out), prof('Reviewer (Opus)').out);
  check('an unknown role says so', prof('pirate').code !== 0 && /no role like/.test(prof('pirate').err), prof('pirate'));
  const webP = async () => (await s.ok('GET', '/api/projects/web')).profiles;
  fe2 = prof('frontend', '--set', 'tests=5').out;
  check('--set: this project\'s numbers, briefed', (await webP())['frontend-mid'].tests === 5 && /full QA, an AI tester pass/.test(fe2), fe2);
  check('another project keeps the template', !/full QA/.test(s.cli(['profile', 'alpha', 'frontend']).out));
  for (const bad of ['go=3', 'tests=9', 'tests=lots', 'chat=3']) check(`--set ${bad} is refused for a role`, prof('frontend', '--set', bad).code !== 0);
  const ownF = path.join(s.dir, 'profiles.local', 'roles', 'frontend-mid.md');
  fe2 = prof('frontend', '--set', 'tests=1', '--all').out;
  check('--all: your copy in profiles.local, only what differs', fs.existsSync(ownF) && /tests: 1/.test(fs.readFileSync(ownF, 'utf8')) && !/name:/.test(fs.readFileSync(ownF, 'utf8')), fs.existsSync(ownF) && fs.readFileSync(ownF, 'utf8'));
  check('--all shows your copy; this project\'s number still wins over it', /on any project\./.test(fe2) && /smoke check/.test(fe2) && /full QA/.test(prof('frontend').out) &&/smoke check/.test(s.cli(['profile', 'alpha', 'frontend']).out), fe2);
  check('the list marks your copy and this project\'s numbers', /frontend-mid  Frontend \(Sonnet\)  \(your copy\)  \(this project: tests 5\)/.test(prof().out), prof().out);
  prof('frontend', '--reset');
  check('--reset clears this project\'s numbers, your copy shows', (await webP()) === undefined && /smoke check/.test(prof('frontend').out), await webP());
  prof('frontend', '--reset', '--all');
  check('--reset --all: back to the template', !fs.existsSync(ownF) && !/smoke check|full QA/.test(prof('frontend').out));
  let own2 = await s.ok('PUT', '/api/profiles/roles/frontend-mid', { scales: { tests: 3 }, how: ['Builds the page side only; asks Backend for new API routes', 'Checks it at phone width and in dark mode before handing over', 'Every string goes through the language files', 'Keeps to the card; a senior or the lead checks the work'] });
  check('a copy that says the same as the template is no copy', own2.copy === null && !fs.existsSync(ownF), own2);
  own2 = await s.ok('PUT', '/api/profiles/roles/frontend-mid', { how: ['Only the CSS'], model: 'opus' });
  check('your own How I work and model', /- Only the CSS/.test(prof('frontend').out) && /Opus\)/.test(prof('frontend').out) && !/Builds the page/.test(prof('frontend').out), prof('frontend').out);
  check('a bad model or role is refused', (await s.api('PUT', '/api/profiles/roles/frontend-mid', { model: 'gpt' })).status === 400 && (await s.api('PUT', '/api/profiles/roles/pirate-mid', {})).status === 404);
  await s.ok('DELETE', '/api/profiles/roles/frontend-mid');
  prof('owner', '--set', 'words=5');
  check('owner --set: this project\'s own numbers, in its brief only', /full technical depth/.test(wb()) && !/full technical depth/.test(brief()), wb());
  check('a helper writes to the owner in this project\'s words', /When you write for Owner \(test steps, task cards, comments\): full technical depth/.test(prof('frontend').out), prof('frontend').out);
  for (const bad of ['alone=2', 'steps=9', 'chat=3']) check(`owner --set ${bad} is refused`, prof('owner', '--set', bad).code !== 0);
  check('owner --all is for Setup', prof('owner', '--set', 'words=1', '--all').code !== 0);
  prof('owner', '--reset');
  check('owner --reset: Setup\'s words again', !/full technical depth/.test(wb()) && (await webP()) === undefined, wb());

  // 2. Setup: the select and the quiz question.
  await s.ok('POST', '/api/setup', { prefs: { steps: 1, wizardSeen: true, helpLevel: '2' } });
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#pf-steps');
  check('Setup shows 5 steps, 1 picked', (await page.$$eval('#pf-steps option', os => os.length)) === 5 && (await page.inputValue('#pf-steps')) === '1');
  await page.selectOption('#pf-steps', '4');
  await until(async () => (await prefs()).steps === 4);
  check('choosing 4 in Setup saves it', (await prefs()).steps === 4);
  await page.click('button[onclick="leadQuiz()"]');
  await page.waitForSelector('input[name="quiz-steps"]');
  check('the quiz asks about steps, 3 answers', (await page.locator('input[name="quiz-steps"]').count()) === 3);
  await page.check('input[name="quiz-steps"][value="one"]');
  await page.click('#dialog button.primary');
  await until(async () => (await prefs()).steps === 1);
  check('the quiz answer "one step" saves 1', (await prefs()).steps === 1);

  // 3. A task for the owner shows its checklist a few at a time; a team card shows it all.
  const task = await mkCard(s, 'alpha', 'Set up the server', { assignee: 'Owner', status: 'todo' });
  const team = await mkCard(s, 'alpha', 'Build the page', { status: 'doing' });
  for (const c of [task, team]) s.cli(['check', 'alpha', c.id, 'Log in,Copy the file,Restart it,Open the page', '--as', 'Forge']);
  const shown = () => page.$$eval('#chk-box li label', ls => ls.map(l => l.textContent.trim()).join('|'));
  await page.goto(`${BASE}/#/p/alpha/${task.id}`);
  await page.waitForSelector('#chk-box');
  await sleep(300);
  check('steps 1: only the first step shows', (await shown()) === 'Log in' && /3/.test(await page.textContent('#chk-more')), await shown());
  await page.click('#chk-box input[data-chk-i="0"]');
  await until(async () => (await getCard(s, 'alpha', task.id)).checklist[0].done);
  await page.waitForFunction(() => document.querySelectorAll('#chk-box li').length === 2);
  check('ticking it shows the next one', /Log in\|Copy the file/.test(await shown()), await shown());
  await page.click('#chk-more button');
  await page.waitForFunction(() => document.querySelectorAll('#chk-box li').length === 4);
  check('Show all shows every step', !(await page.isVisible('#chk-more')));
  await s.ok('POST', '/api/setup', { prefs: { steps: 5 } });
  await page.goto(`${BASE}/#/p/alpha/${team.id}`);
  await page.waitForSelector('#chk-box li');
  check('a team card shows the whole list', (await page.locator('#chk-box li').count()) === 4 && !(await page.isVisible('#chk-more')));
  await page.reload(); await page.goto(`${BASE}/#/p/alpha/${task.id}`);
  await page.waitForSelector('#chk-box li');
  check('steps 5: the task shows every step too', (await page.locator('#chk-box li').count()) === 4);

  // 4. ➕ Add team in 🎨 Look (AIG-420): the team's roles show as ticked rows at once, with what was added and swapped.
  await s.ok('POST', '/api/setup', { prefs: { plan: 'nospare' } });   // no helper limits, so the count line is the roles on
  await page.goto(`${BASE}/#/p/web`); await page.reload();
  await page.click('button:has-text("Look")');
  await page.waitForSelector('#look-team');
  check('Look offers the 7 teams', (await page.$$eval('#look-team option', os => os.length)) === 8);
  await page.selectOption('#look-team', 'webapp');
  await page.click('#look-roles button:has-text("Add team")');
  await page.waitForSelector('#look-roles input[data-role="reviewer-senior"]');
  const row = await page.textContent('#look-roles label:has(input[data-role="reviewer-senior"])');
  check('the new role is a ticked row with its name, level and model', /Code reviewer, senior \(Sonnet\)/.test(row) && (await page.isChecked('#look-roles input[data-role="reviewer-senior"]')), row);
  check('Reviewer (Opus) is swapped out', !(await page.isChecked('#look-roles input[data-role="Reviewer (Opus)"]')));
  const msg = await page.textContent('#look-team-msg');
  check('it says what was added and swapped out', /Added: Code reviewer, senior \(Sonnet\)\. Swapped out: Code reviewer, principal \(Opus\)/.test(msg), msg);
  check('the count line counts it', /Opus 1, Sonnet 4, Haiku 3/.test(await page.textContent('#look-rolecount')) && /up to 8 agents/.test(await page.textContent('#look-rolecount')), await page.textContent('#look-rolecount'));
  await page.click('#look-roles input[data-role="Docs (Haiku)"]');
  await page.click('#dialog button:has-text("Save")');
  await until(async () => !((await roles('web')) || []).includes('Docs (Haiku)'));
  check('Save keeps the team and the ticks', (await roles('web')).join() === 'Lead (Opus),Frontend (Sonnet),Backend (Sonnet),QA (Haiku),Quick fix (Haiku),Tester (Sonnet),reviewer-senior', await roles('web'));
  noErrors(page);
}, true);
