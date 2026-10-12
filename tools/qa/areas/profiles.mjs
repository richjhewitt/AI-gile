// QA area: profiles (AIG-415): how agents work with the owner. Steps at a time (AIG-416): the setting, the brief line,
// the Setup select, the quiz question and a task's checklist shown a few at a time. The scale table and the brief
// compiler, lib/profiles.js (AIG-417).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, BASE, check, sleep, until, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('profiles', '👤 agent profiles: steps at a time (setting, default 1 or 3, brief line, Setup, quiz, task checklist a few at a time) (AIG-416); scale table, profile file and brief compiler (AIG-417)', async (s, ctx) => {
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
  noErrors(page);
}, true);
