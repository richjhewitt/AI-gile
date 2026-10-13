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
  check('a bad engine is refused', (await s.api('POST', '/api/projects/eng/team', { name: 'Dev', engine: 'gemini' })).status === 400);
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
  check('codex exec --json with the sandbox, approvals never and the model', / ?exec --json --sandbox workspace-write -c approval_policy=never -c sandbox_workspace_write\.network_access=true --skip-git-repo-check -m gpt-test You are running/.test(got), got);
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
  // 6. back to Claude
  await s.ok('POST', '/api/projects/eng/team', { name: 'Lead', engine: 'claude' });
  await s.ok('POST', '/api/projects/eng/wake');
  for (let i = 0; i < 40 && claudeRuns() === before; i++) await sleep(250);
  check('Claude again runs the Claude program', claudeRuns() !== before);
  await settle();
}, true, { AIGILE_ENGINE_STUB: stub });
