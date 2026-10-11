// QA areas: runin (split from team-quiet.mjs, AIG-297).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

// Where a team runs (AIG-153): background stays as it was; a terminal, VS Code or your own command opens a window
// instead (AIGILE_NO_WINDOWS: only logged here), once per 15 minutes for comments and always for ▶ Wake.
const runinLocal = path.join(tmp('runinset'), 'local.json'); fs.writeFileSync(runinLocal, '{ "owner": "Rich" }');
def('runin', 'where a team runs: background, terminal, VS Code or your own command, per project and in Setup', async (s) => {
  const folder = tmp('runin'), log = () => { try { return fs.readFileSync(path.join(s.data, 'logs', 'run.log'), 'utf8'); } catch { return ''; } };
  await mkProject(s, 'Run', 'RUN', { path: folder });
  check('Setup default is background', (await s.ok('GET', '/api/setup')).prefs.runIn === 'background');
  check('a bad choice is refused', (await s.api('PATCH', '/api/projects/run', { runIn: 'nope' })).status === 400);
  await s.ok('PATCH', '/api/projects/run', { runIn: 'terminal' });
  const w = await s.ok('POST', '/api/projects/run/wake');
  check('Wake opens a terminal window', w.opened === 'terminal' && !w.running && /opened \(terminal\)/.test(log()), w);
  const ps = fs.readFileSync(path.join(s.data, 'logs', 'run.window.ps1'), 'utf8');
  check('the window runs the agent with the prompt and --continue', /--continue 'Rich commented on the AI-gile board/.test(ps) && ps.includes(folder), ps);
  const c = await mkCard(s, 'run', 'hi'); await say(s, 'run', c.id, 'Rich', 'hello');
  check('a comment soon after does not open another', log().match(/opened/g).length === 1, log());
  const pr = (await s.ok('GET', '/api/projects/run')).presence;
  check('presence says it was opened, not running', pr.opened && pr.opened.where === 'terminal' && !pr.running, pr);
  await s.ok('PATCH', '/api/projects/run', { runIn: 'vscode' });
  check('VS Code opens the folder', (await s.ok('POST', '/api/projects/run/wake')).opened === 'vscode' && log().includes(`code "${folder}"`), log());
  await s.ok('PATCH', '/api/projects/run', { runIn: 'other' });
  check('Other without a command says so', (await s.api('POST', '/api/projects/run/wake')).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { runIn: 'other', runCmd: 'myeditor --dir "{folder}"' } });
  check('Other fills in {folder}', (await s.ok('POST', '/api/projects/run/wake')).opened === 'other' && log().includes(`myeditor --dir "${folder}"`), log());
  await s.ok('PATCH', '/api/projects/run', { runIn: '' });
  check('empty uses the Setup default', (await s.ok('POST', '/api/projects/run/wake')).opened === 'other');
  await s.ok('POST', '/api/setup', { prefs: { runIn: 'background' } });
  check('background still runs hidden', (await s.ok('POST', '/api/projects/run/wake')).running === true);
}, false, { AIGILE_NO_WINDOWS: '1', AIGILE_LOCAL: runinLocal });
