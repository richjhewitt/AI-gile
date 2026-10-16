// QA area: one lead per project (AIG-447): no background run on top of a lead working in a session.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, say, def } from '../lib.mjs';

def('onelead', 'one lead per project: a session in VS Code or aigile wait blocks the background run; second-lead switch; --resume not --continue (AIG-447)', async s => {
  const log = slug => { try { return fs.readFileSync(path.join(s.data, 'logs', slug + '.log'), 'utf8'); } catch { return ''; } };
  const starts = slug => (log(slug).match(/ started/g) || []).length;
  const settle = async slug => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/' + slug)).presence.running; i++) await sleep(250); };
  // AIG-998: the Scrum Master can run in the project's folder. A usage reading alone is not a lead heartbeat.
  const sharedFolder = tmp('shared-role');
  await mkProject(s, 'Shared role', 'SHR', { path: sharedFolder });
  const sharedCard = await mkCard(s, 'shared-role', 'work after a Scrum Master reading');
  await s.ok('POST', '/api/limits', { cwd: sharedFolder, rate_limits: { five_hour: { used_percentage: 1 } } });
  check('folder usage still marks the project online', (await s.ok('GET', '/api/projects/shared-role')).presence.online);
  const sharedWake = await s.ok('POST', '/api/projects/shared-role/wake', { sprint: true });
  for (let i = 0; i < 40 && !starts('shared-role'); i++) await sleep(250);
  check('a folder usage reading does not block a team run', sharedWake.running === true && starts('shared-role') === 1, JSON.stringify(sharedWake) + log('shared-role'));
  await settle('shared-role');
  await mkProject(s, 'One', 'ONE', { path: tmp('one') });
  const c = await mkCard(s, 'one', 'a card');
  // 1. a session used the board a moment ago: the owner's comment does not start a run
  s.cli(['show', 'one', 'ONE-1'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  await say(s, 'one', c.id, 'Owner', 'hello');
  await sleep(1200);
  check('a comment while a session is active starts no run', starts('one') === 0 && !(await s.ok('GET', '/api/projects/one')).presence.running, log('one'));
  check('the log says why', /lead active in a session: not starting a background run/.test(log('one')), log('one'));
  // 2. the session goes quiet for long (AIGILE_ACTIVE_MS is 1.5s here): the next comment starts the run
  await sleep(1800);
  await say(s, 'one', c.id, 'Owner', 'anyone there?');
  for (let i = 0; i < 40 && !starts('one'); i++) await sleep(250);
  await settle('one');
  check('after the session went quiet, a comment starts a run', starts('one') === 1, log('one'));
  const out1 = fs.readFileSync(s.wakeOut, 'utf8');
  check('the run starts its own conversation under an id, never --continue', /--session-id/.test(out1) && !/--continue/.test(out1), out1);
  const sid = (await s.ok('GET', '/api/projects/one')).runSession;
  check('the board remembers the id it started', /^[0-9a-f-]{36}$/.test(sid || ''), sid);
  // 3. the next run resumes only that id
  await sleep(300);
  await say(s, 'one', c.id, 'Owner', 'and again');
  for (let i = 0; i < 40 && starts('one') < 2; i++) await sleep(250);
  await settle('one');
  const out2 = fs.readFileSync(s.wakeOut, 'utf8');
  check('the next run uses --resume with that id', starts('one') === 2 && out2.includes('--resume') && out2.includes(sid) && !/--continue/.test(out2), out2);
  // 4. sitting in aigile wait counts as active, however long ago the last command was
  await sleep(1800);
  await s.ok('GET', '/api/projects/one/updates?wait=1');
  await say(s, 'one', c.id, 'Owner', 'while you wait');
  await sleep(1200);
  check('a session sitting in wait blocks a run', starts('one') === 2 && /not starting a background run/.test(log('one')), log('one'));
  // 5. the second-lead switch allows it
  await s.ok('PATCH', '/api/projects/one', { secondLead: true });
  check('the switch is saved', (await s.ok('GET', '/api/projects/one')).secondLead === true);
  await say(s, 'one', c.id, 'Owner', 'lots of work now');
  for (let i = 0; i < 40 && starts('one') < 3; i++) await sleep(250);
  await settle('one');
  check('with a second lead allowed, the run starts', starts('one') === 3, log('one'));
  await s.ok('PATCH', '/api/projects/one', { secondLead: false });
  check('the switch goes off again', !(await s.ok('GET', '/api/projects/one')).secondLead);
  // 6. the wake button is the owner's own say-so
  await s.ok('GET', '/api/projects/one/updates?wait=1');
  const w = await s.ok('POST', '/api/projects/one/wake');
  check('the owner\'s own Wake still starts a run', w.running === true, w);
  await settle('one');
  // 7. the night watchman and the Lead Scrum Master are automatic: they respect a live session too (force no longer overrides)
  await mkProject(s, 'Night', 'NGT', { path: tmp('night') });
  await mkCard(s, 'night', 'Waiting work', { status: 'todo' });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['night'] });
  await sleep(800); await settle('night'); await sleep(2000); await settle('night');   // going quiet wakes it (a go-round-again may follow); let both runs end and the quiet window pass
  const before = starts('night');
  s.cli(['show', 'night', 'NGT-1'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  await sleep(700);   // heard 'minutes' ago: offline for presence (ONLINE 0.6s) yet still a live session (ACTIVE 1.5s)
  await s.ok('POST', '/api/watchman/round');
  await sleep(500);
  check('a watchman round starts no run on a lead in a session, and says why (AIG-1446)', starts('night') === before && ((await s.ok('GET', '/api/watchman')).why.night || {}).why === 'lead', before + ' ' + starts('night') + ' ' + log('night'));
  await sleep(2500);
  await s.ok('POST', '/api/watchman/round');
  for (let i = 0; i < 40 && starts('night') === before; i++) await sleep(250);
  check('once the session is quiet, the watchman wakes it', starts('night') === before + 1, log('night'));
  await settle('night');
  // 8. the heartbeat hook keeps a busy session counted
  const ping = s.cli(['ping', 'night'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  check('ping is a known command and marks the session live', !/unknown/i.test(String(ping)) && (await s.ok('GET', '/api/projects/night')).presence.where === 'vscode', ping);
  // 9. a wake with nothing new starts no run (AIG-465): the news is read, then an agent's `aigile wake` (not the owner's click) and a stale nudge find nothing
  await mkProject(s, 'Calm', 'CLM', { path: tmp('calm') });
  const cc = await mkCard(s, 'calm', 'read already', { status: 'todo' });
  await say(s, 'calm', cc.id, 'Owner', 'old news');
  await sleep(1800);
  await settle('calm');
  await s.ok('GET', '/api/projects/calm/updates?mark=1');
  const calm0 = starts('calm');
  const nothing = s.cli(['updates', 'calm', '--peek'], { AIGILE_BACKGROUND: '1' }).out;
  check('updates has nothing new from the owner', !/new from/.test(nothing), nothing);
  const w2 = await s.ok('POST', '/api/projects/calm/wake', { sprint: false });   // as the page: the owner's own click still goes ahead
  await settle('calm');
  check('the owner\'s Wake click still starts a run with nothing new', w2.running === true && starts('calm') === calm0 + 1, log('calm'));
  const calm1 = starts('calm');
  await sleep(1800);
  s.cli(['wake', 'calm'], { AIGILE_BACKGROUND: '1' });
  await sleep(800);
  check('an agent\'s wake with nothing new starts no run', starts('calm') === calm1 && /nothing new for the team/.test(log('calm')), log('calm'));
  await say(s, 'calm', cc.id, 'Owner', 'fresh news'); await sleep(2000); await settle('calm');
  check('a wake with news does start one', starts('calm') > calm1, log('calm'));
  // 10. a wait that returns with news keeps the lead active for a grace period (AIG-523); ordinary calls count, background and role calls don't
  await mkProject(s, 'Grace', 'GRC', { path: tmp('grace') });
  const gc = await mkCard(s, 'grace', 'g card');
  await sleep(1800);
  await s.ok('GET', '/api/projects/grace/updates?wait=1');
  await say(s, 'grace', gc.id, 'Owner', 'wake up');
  await s.ok('GET', '/api/projects/grace/updates?wait=0');   // the wait returned with news
  await sleep(900);   // past ONLINE (0.6s), inside the grace
  await say(s, 'grace', gc.id, 'Owner', 'one more');
  await sleep(1200);
  check('after a wait returned with news, a comment starts no run', starts('grace') === 0 && /not starting a background run/.test(log('grace')), log('grace'));
  await mkProject(s, 'Bg', 'BGR', { path: tmp('bg') });
  const bc = await mkCard(s, 'bg', 'bg card');
  s.cli(['show', 'bg', 'BGR-1'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '1' });
  s.cli(['show', 'bg', 'BGR-1'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '', AIGILE_ROLE: 'tester' });
  check('background and role calls do not make a lead', (await s.ok('GET', '/api/projects/bg')).presence.where !== 'vscode');
  s.cli(['show', 'bg', 'BGR-1'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  check('an ordinary call from a session makes the lead active', (await s.ok('GET', '/api/projects/bg')).presence.where === 'vscode');
}, false, { AIGILE_GRACE_MS: '2500', AIGILE_ACTIVE_MS: '1500', AIGILE_ONLINE_MS: '600', AIGILE_IDLE_MS: '1' });
