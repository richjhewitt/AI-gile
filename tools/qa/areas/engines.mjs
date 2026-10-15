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
  require('../../../lib/platform').writeStub(fs, stub, 'logenv', out);
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
  check('a Codex run gets no Gemini key or home (AIG-1015)', !/GEMINI/.test(got), got);
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
  // 5a. no Gemini API key (AIG-1015): no run, one plain comment, nothing else started
  const gk0 = await s.ok('GET', '/api/gemini-key');
  check('GET /api/gemini-key says not set', gk0.set === false && Object.keys(gk0).join() === 'set', gk0);
  fs.writeFileSync(out, '');
  const rk = await s.ok('POST', '/api/projects/eng/wake');
  await sleep(500);
  const cardK = (await s.ok('GET', '/api/projects/eng')).cards.find(x => x.id === c.id);
  check('no key: the wake says gemini is missing and nothing runs', rk.engineMissing === 'gemini' && !(await s.ok('GET', '/api/projects/eng')).presence.running && fs.readFileSync(out, 'utf8') === '', rk);
  check('no key: a comment says to set the Gemini API key', cardK.comments.some(m => /Gemini needs an API key: Setup → Gemini API key/.test(m.text)), cardK.comments.map(m => m.text));
  check('saving a key without the page token is refused', (await s.api('POST', '/api/gemini-key', { key: 'x' })).status === 403);
  const tok = (await s.ok('GET', '/api/secrets/token')).token, SECRET = 'AIzaQA-secret-key-123';
  const gk1 = await s.ok('POST', '/api/gemini-key', { key: SECRET, token: tok });
  check('saved: set is true and the answer never holds the key', gk1.set === true && !JSON.stringify(gk1).includes(SECRET), gk1);
  const gk2 = await s.ok('GET', '/api/gemini-key');
  check('GET returns only {set:true}', JSON.stringify(gk2) === '{"set":true}', gk2);
  const gHtml = await page.evaluate(async () => { GKEY.set = null; await geminiKeyLoad(); return geminiKeyHtml(); });
  check('Setup box: masked input, Saved, AI Studio link, no key in the page', /type="password"/.test(gHtml) && />Saved</.test(gHtml) && gHtml.includes('https://aistudio.google.com/apikey') && !gHtml.includes(SECRET), gHtml);
  fs.writeFileSync(out, '');
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && !/yolo/.test(fs.readFileSync(out, 'utf8')); i++) await sleep(250);
  const got3 = fs.readFileSync(out, 'utf8').replace(/\r/g, '').replace(/"/g, '');
  check('gemini --yolo with stream-json, the model and -p', /--yolo --output-format stream-json -m gem-test -p You are running through Gemini CLI/.test(got3), got3);
  check('the Gemini prompt names AGENTS.md, never push and the board brief', /AGENTS\.md/.test(got3) && /Never run git push/.test(got3) && /board brief for project eng/.test(got3), got3);
  check('the log says gemini', /started \(gemini\)/.test(log()), log());
  const homeDir = path.join(s.data, 'gemini-home');
  check('a Gemini run gets GEMINI_CLI_HOME and GEMINI_API_KEY', got3.includes('GEMINI_API_KEY=' + SECRET) && got3.replace(/\\/g, '/').toLowerCase().includes('gemini_cli_home=' + homeDir.replace(/\\/g, '/').toLowerCase()), got3);
  check('the board-owned home picks the API key', JSON.parse(fs.readFileSync(path.join(homeDir, '.gemini', 'settings.json'), 'utf8')).security.auth.selectedType === 'gemini-api-key');
  check('the key is not in the log or the project answer', !log().includes(SECRET) && !JSON.stringify(await s.ok('GET', '/api/projects/eng')).includes(SECRET));
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
  // 5b2. GitHub Copilot (AIG-971) and Cursor (AIG-973): their documented flags, the model only when set, the rules in the prompt
  const wakeGot = async pat => {
    await settle(); fs.writeFileSync(out, '');
    await s.ok('POST', '/api/projects/eng/wake');
    for (let i = 0; i < 40 && !pat.test(fs.readFileSync(out, 'utf8')); i++) await sleep(250);
    const g = fs.readFileSync(out, 'utf8').replace(/\r/g, '').replace(/"/g, ''); await settle(); return g;
  };
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', engine: 'copilot', copilotModel: 'cop-test' });
  check('Copilot and its model are stored on the lead', (await s.ok('GET', '/api/projects/eng')).team.find(m => m.name === 'Lead').copilotModel === 'cop-test');
  const got4 = await wakeGot(/allow-all/);
  check('copilot --allow-all --no-ask-user, JSON output, --model and -p', /--allow-all --no-ask-user --output-format=json --model=cop-test -p You are running through GitHub Copilot CLI/.test(got4), got4);
  check('the Copilot prompt names AGENTS.md, never push and the board brief', /AGENTS\.md/.test(got4) && /Never run git push/.test(got4) && /board brief for project eng/.test(got4), got4);
  check('the log says copilot', /started \(copilot\)/.test(log()), log());
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', copilotModel: '' });
  check('Copilot with no model leaves out --model', !/--model/.test(await wakeGot(/allow-all/)));
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', engine: 'cursor', cursorModel: 'cur-test' });
  const got5 = await wakeGot(/--force/);
  check('cursor --print --force --trust, stream-json, --model, then the prompt', /--print --force --trust --output-format stream-json --model cur-test You are running through Cursor CLI/.test(got5), got5);
  check('the Cursor prompt names AGENTS.md, never push and the board brief', /AGENTS\.md/.test(got5) && /Never run git push/.test(got5) && /board brief for project eng/.test(got5), got5);
  check('the log says cursor', /started \(cursor\)/.test(log()), log());
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', cursorModel: '' });
  check('Cursor with no model leaves out --model', !/--model/.test(await wakeGot(/--force/)));
  const EN = require('../../../lib/engines'), CP = EN.ENGINES.copilot, CU = EN.ENGINES.cursor;
  check('read(): Copilot text, plain text, unknown ignored', CP.read('{"type":"assistant.message","data":{"content":"hi"}}')[0].includes('hi') && CP.read('plain words')[0] === 'plain words' && CP.read('{"type":"zzz"}').length === 0);
  check('read(): Cursor init, assistant, tool call, error result, unknown ignored', CU.read('{"type":"system","subtype":"init"}')[0].includes('cursor')
    && CU.read('{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hello"}]}}')[0].includes('hello')
    && CU.read('{"type":"tool_call","subtype":"started","tool_call":{"readToolCall":{"args":{"path":"a.txt"}}}}')[0].includes('a.txt')
    && CU.read('{"type":"result","subtype":"success","is_error":false,"result":"x"}').length === 0 && CU.read('{"type":"result","subtype":"error","is_error":true,"result":"bad"}')[0].includes('bad') && CU.read('{"type":"zzz"}').length === 0);
  check('Copilot and Cursor have no ready-made model yet (not confirmed in their docs): the engine default', EN.roleModel('copilot', 'Frontend') === '' && EN.roleModel('cursor', 'Lead') === '');
  await page.evaluate(() => teamDialog()); await page.waitForSelector('.eng-row');
  check('the Team dialog offers Copilot and Cursor', (await page.locator('.eng-row[data-agent="Lead"] select option').allInnerTexts()).join('|').includes('Copilot') && (await page.locator('.eng-row[data-agent="Lead"] select option').count()) === 5);
  await page.locator('.eng-row[data-agent="Lead"] select').selectOption('cursor');
  await page.waitForFunction(() => (state.project.team.find(m => m.name === 'Lead') || {}).engine === 'cursor');
  check('picking Cursor shows a model box', (await page.locator('.eng-row[data-agent="Lead"] .eng-model').count()) === 1);
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', engine: 'gemini' });
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
