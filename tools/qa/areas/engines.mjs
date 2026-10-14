// QA area: engines (AIG-704/705): Claude or Codex per agent; a Codex lead's background run calls `codex exec` (a stub stands in).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { check, sleep, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

const require = createRequire(import.meta.url);
const dir = tmp('engines'), stub = path.join(dir, 'codex-stub' + require('../../../lib/platform').stubExt()), out = path.join(dir, 'codex-out.txt');

def('engines', 'engines: Engine pick per agent in the Team dialog, a Codex lead runs `codex exec` (stub), not installed = a board comment, old roster entries stay Claude (AIG-704/705)', async (s, ctx) => {
  const proj = tmp('engproj');
  await mkProject(s, 'Eng', 'ENG', { path: proj });
  const c = await mkCard(s, 'eng', 'a card', { status: 'doing' });
  const settle = async () => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/eng')).presence.running; i++) await sleep(250); };
  const claudeRuns = () => { try { return fs.readFileSync(s.wakeOut, 'utf8'); } catch { return ''; } };
  const log = () => { try { return fs.readFileSync(path.join(s.data, 'logs', 'eng.log'), 'utf8'); } catch { return ''; } };
  // 1. old roster entries (no engine saved) are Claude
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', role: 'Lead', model: 'opus' });
  await s.ok('POST', '/api/projects/eng/team', { name: 'Dev', role: 'Backend' });
  const team0 = (await s.ok('GET', '/api/projects/eng')).team;
  check('a roster entry saved without an engine has none stored', team0.every(m => m.engine === undefined));
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && !claudeRuns(); i++) await sleep(250);
  await settle();
  check('an old entry runs Claude (the agent program got -p)', /-p /.test(claudeRuns().replace(/"/g, '')), claudeRuns());
  check('the log does not say codex', !/\(codex\)/.test(log()), log());
  // 2. pick Codex in the Team dialog
  const page = await openPage(ctx, '#/p/eng');
  await page.evaluate(() => teamDialog());
  await page.waitForSelector('.eng-row');
  check('the dialog lists both agents, Claude picked', (await page.locator('.eng-row').count()) === 2 && (await page.locator('.eng-row select').first().inputValue()) === 'claude');
  await page.locator('.eng-row[data-agent="Lead"] select').selectOption('codex');
  await page.waitForSelector('.eng-row[data-agent="Lead"] .eng-model');
  await page.fill('.eng-row[data-agent="Lead"] .eng-model', 'gpt-test');
  await page.press('.eng-row[data-agent="Lead"] .eng-model', 'Tab');
  await page.waitForFunction(() => (state.project.team.find(m => m.name === 'Lead') || {}).codexModel === 'gpt-test');
  const team1 = (await s.ok('GET', '/api/projects/eng')).team, lead = team1.find(m => m.name === 'Lead'), dev = team1.find(m => m.name === 'Dev');
  check('Codex and its model are stored on the lead', lead.engine === 'codex' && lead.codexModel === 'gpt-test', lead);
  check('the other agent is untouched', dev.engine === undefined);
  noErrors(page);
  check('a bad engine is refused', (await s.api('POST', '/api/projects/eng/team', { name: 'Dev', engine: 'bogus' })).status === 400);
  // 3. Codex is not installed (the stub file does not exist yet): a comment, no run, no Claude
  const before = claudeRuns();
  const r = await s.ok('POST', '/api/projects/eng/wake');
  await sleep(500);
  const card = await (await s.ok('GET', '/api/projects/eng')).cards.find(x => x.id === c.id);
  check('not installed: the wake says so and nothing runs', r.engineMissing === 'codex' && !(await s.ok('GET', '/api/projects/eng')).presence.running, r);
  check('not installed: a comment on the card', card.comments.some(m => /Codex isn't installed on this PC/.test(m.text)), card.comments.map(m => m.text));
  check('not installed: Claude was not used instead', claudeRuns() === before);
  // 4. installed (the stub appears): the exact command line
  fs.writeFileSync(out, '');
  require('../../../lib/platform').writeStub(fs, stub, 'log', out);
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && !/exec/.test(fs.readFileSync(out, 'utf8')); i++) await sleep(250);
  const got = fs.readFileSync(out, 'utf8').replace(/\r/g, '').replace(/"/g, '');
  await settle();
  check('codex exec --json without the sandbox (AIG-402) and the model', / ?exec --json --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -m gpt-test You are running/.test(got), got);
  check('the prompt points at the same rules as Claude (AIG-402)', /WAYS-OF-WORKING\.md/.test(got) && /CLAUDE\.local\.md/.test(got) && /AI attribution/.test(got), got);
  check('it runs in the project folder', got.split('\n')[0].trim().toLowerCase().replace(/\\/g, '/') === proj.toLowerCase().replace(/\\/g, '/'), got.split('\n')[0]);
  check('the prompt says never push and runs the board brief', /Never run git push/.test(got) && /board brief for project eng/.test(got), got);
  check('Claude was not started for it', claudeRuns() === before);
  check('the log says codex', /started \(codex\)/.test(log()), log());
  // 5. no model: no -m
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', codexModel: '' });
  fs.writeFileSync(out, '');
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && !/exec/.test(fs.readFileSync(out, 'utf8')); i++) await sleep(250);
  const got2 = fs.readFileSync(out, 'utf8').replace(/"/g, '');
  check('an empty model leaves out -m', !/ -m /.test(got2) && /exec --json/.test(got2), got2);
  await settle();
  // 5b. Gemini (AIG-761/762): gemini --yolo --output-format stream-json -m <model> -p <prompt>, the AGENTS.md preamble
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', engine: 'gemini', geminiModel: 'gem-test' });
  const lead2 = (await s.ok('GET', '/api/projects/eng')).team.find(m => m.name === 'Lead');
  check('Gemini and its model are stored on the lead', lead2.engine === 'gemini' && lead2.geminiModel === 'gem-test', lead2);
  fs.writeFileSync(out, '');
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && !/yolo/.test(fs.readFileSync(out, 'utf8')); i++) await sleep(250);
  const got3 = fs.readFileSync(out, 'utf8').replace(/\r/g, '').replace(/"/g, '');
  check('gemini --yolo with stream-json, the model and -p', /--yolo --output-format stream-json -m gem-test -p You are running through Gemini CLI/.test(got3), got3);
  check('the Gemini prompt names AGENTS.md, never push and the board brief', /AGENTS\.md/.test(got3) && /Never run git push/.test(got3) && /board brief for project eng/.test(got3), got3);
  check('the log says gemini', /started \(gemini\)/.test(log()), log());
  await settle();
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', geminiModel: '' });
  fs.writeFileSync(out, '');
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && !/yolo/.test(fs.readFileSync(out, 'utf8')); i++) await sleep(250);
  check('Gemini with no model leaves out -m', !/ -m /.test(fs.readFileSync(out, 'utf8')));
  await settle();
  const G = require('../../../lib/engines').ENGINES.gemini;
  check('read(): init, assistant text, tool use, plain text, unknown ignored',
    G.read('{"type":"init"}')[0].includes('gemini') && G.read('{"type":"message","role":"assistant","content":"hi"}')[0].includes('hi') && G.read('{"type":"message","role":"user","content":"x"}').length === 0
    && G.read('{"type":"tool_use","tool_name":"run_shell_command","parameters":{"command":"ls"}}')[0].includes('ls') && G.read('plain words')[0] === 'plain words' && G.read('{"type":"zzz"}').length === 0);
  // 5c. ready-made model per role (AIG-1007): a Codex / Gemini agent with a role and no model gets the table's one
  const RM = require('../../../lib/engines').ROLE_MODELS, id = /^[a-z0-9.-]+$/;
  check('the table has all 8 roles with a Codex and a Gemini id', Object.keys(RM).length === 8 && Object.values(RM).every(v => id.test(v.codex) && id.test(v.gemini)), RM);
  await s.ok('POST', '/api/projects/eng/team', { name: 'Fe', role: 'Frontend', engine: 'codex' });
  await s.ok('POST', '/api/projects/eng/team', { name: 'Doc', role: 'Docs', engine: 'gemini' });
  await s.ok('POST', '/api/projects/eng/team', { name: 'Own', role: 'Backend', engine: 'codex', codexModel: 'mine' });
  const tm5 = (await s.ok('GET', '/api/projects/eng')).team, by = n => tm5.find(m => m.name === n);
  check('a Codex Frontend gets the Frontend Codex model', by('Fe').codexModel === RM['Frontend (Sonnet)'].codex, by('Fe'));
  check('a Gemini Docs agent gets the Docs Gemini model', by('Doc').geminiModel === RM['Docs (Haiku)'].gemini, by('Doc'));
  check('a model the owner typed is kept', by('Own').codexModel === 'mine');
  check('GET /api/profiles sends the table', JSON.stringify((await s.ok('GET', '/api/profiles')).roleModels) === JSON.stringify(RM));
  await page.evaluate(() => { state.profiles = null; return loadProfiles(); });
  await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="mtbox">' + mainTeamHtml('mtq', '', false) + '</div>'); });
  check('Claude shows no extra model', (await page.locator('#mtq .mt-model').count()) === 0);
  await page.locator('#mtq-eng').selectOption('codex');
  check('Codex shows a model next to each of the 8 roles', (await page.locator('#mtq .mt-model').count()) === 8 && (await page.locator('#mtq .mt-ticks label').first().innerText()).includes(RM['Lead (Opus)'].codex));
  await page.locator('#mtq-eng').selectOption('gemini');
  check('Gemini shows its models', (await page.locator('#mtq .mt-ticks label').last().innerText()).includes(RM['Tester (Sonnet)'].gemini));
  // 6. back to Claude
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', engine: 'claude' });
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && claudeRuns() === before; i++) await sleep(250);
  check('Claude again runs the Claude program', claudeRuns() !== before);
  await settle();
}, true, { AIGILE_ENGINE_STUB: stub });
