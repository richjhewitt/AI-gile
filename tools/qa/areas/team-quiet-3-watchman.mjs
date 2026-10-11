// QA areas: watchman, keepgoing, limit, limitread, stuckonly (split from team-quiet.mjs, AIG-297).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

def('watchman', '🌙 night watchman: restarts a cut-off team, flags a card stuck after 3 tries, wakes idle teams, morning summary (AIG-199)', async (s, ctx) => {
  await mkProject(s, 'Cut', 'CUT', { path: tmp('cut') });
  await mkProject(s, 'Nap', 'NAP', { path: tmp('nap') });
  await mkProject(s, 'Skip', 'SKP', { path: tmp('skip') });
  const mid = await mkCard(s, 'cut', 'Half done', { status: 'doing' });
  await mkCard(s, 'nap', 'Waiting work', { status: 'todo' });
  await mkCard(s, 'skip', 'Not watched', { status: 'todo' });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['cut', 'nap'] });
  await sleep(4500);   // going quiet wakes the teams; wait until those runs end
  await s.ok('POST', '/api/watchman/round');
  let c = await getCard(s, 'cut', mid.id);
  check('a team that stopped mid-card is started again, with a note', /Picked back up/.test(c.comments.at(-1).text));
  let st = await s.ok('GET', '/api/watchman');
  check('an idle team with work is woken; an unwatched one is left alone', st.summary.find(x => x.project === 'nap').woke === 1 && !st.summary.find(x => x.project === 'skip'));
  await sleep(4500);   // the stand-in agent ends; the team is asleep again
  await s.ok('POST', '/api/watchman/round'); await sleep(4500); await s.ok('POST', '/api/watchman/round');
  c = await getCard(s, 'cut', mid.id);
  check('third time on the same card: stuck, and in your pile', /Stuck/.test(c.comments.at(-1).text) && c.needsYou === true, c.comments.at(-1).text);
  const back = await s.ok('POST', '/api/quiet', { on: false });
  const cut = back.summary.find(x => x.project === 'cut');
  check('back from quiet: a summary per project', cut && cut.stuck.includes(mid.id) && cut.restarted.includes(mid.id) && !(await s.ok('GET', '/api/watchman')), back.summary);
}, false);

def('keepgoing', '🌙 keeps every team on task: the every-minute look picks up a card left in progress, and a session idle in its wait gets one nudge that ends the wait (AIG-277)', async s => {
  await mkProject(s, 'Half', 'HLF', { path: tmp('half') });
  await mkProject(s, 'Idle', 'IDL', { path: tmp('idle') });
  const mid = await mkCard(s, 'half', 'Half done', { status: 'doing' });
  const todo = await mkCard(s, 'idle', 'Buildable', { status: 'todo' });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['half', 'idle'] });
  await sleep(4500);   // going quiet wakes both teams; wait until those runs end
  await s.ok('GET', '/api/projects/idle/updates?wait=1');   // the Idle session now sits in 'aigile wait'
  await sleep(50);
  await s.ok('POST', '/api/watchman/quick');
  check('the every-minute look picks up a card left in progress', /Picked back up/.test((await getCard(s, 'half', mid.id)).comments.at(-1)?.text || ''));
  check('an idle session with work it can do gets a keep-going nudge', /Keep going/.test((await getCard(s, 'idle', todo.id)).comments.at(-1)?.text || ''));
  const u = await s.ok('GET', '/api/projects/idle/updates?wait=1');
  check('the nudge ends its wait', u.cards.some(c => c.id === todo.id), u);
  await s.ok('POST', '/api/watchman/quick');
  check('one nudge, not one a minute', (await getCard(s, 'idle', todo.id)).comments.filter(m => /Keep going/.test(m.text)).length === 1);
  await s.ok('POST', '/api/quiet', { on: false });
}, false, { AIGILE_IDLE_MS: '1' });

def('limit', '🌙 usage limit: no restarts counted while out, carry on after the reset; a stuck card stops only itself; the night\'s chat stays in the morning (AIG-283)', async s => {
  await mkProject(s, 'Out', 'OUT', { path: tmp('out') });
  const mid = await mkCard(s, 'out', 'Half done', { status: 'doing' });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['out'] });
  await sleep(4500);   // going quiet wakes the team; wait until that run ends
  const logf = path.join(s.data, 'logs', 'out.log'), runs = () => (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length;
  const ampm = d => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'am' : 'pm'}`;
  const cutOff = (startAgo, resetIn) => fs.appendFileSync(logf, `=== ${new Date(Date.now() - startAgo).toISOString()} started ===\nYou've hit your session limit · resets ${ampm(new Date(Date.now() + resetIn))} (Europe/London)\n=== exited ended ===\n`);
  // Cut off by a limit that has reset since: carried on, not counted as a try.
  cutOff(3 * 3600e3, -2 * 3600e3);
  let n = runs(); await s.ok('POST', '/api/watchman/quick'); await sleep(300);
  check('after the reset the team carries on', runs() === n + 1, fs.readFileSync(logf, 'utf8'));
  check('a limit cut-off is not counted as a try', !(await getCard(s, 'out', mid.id)).comments.some(m => /Picked back up|Stuck/.test(m.text)));
  await sleep(4500);
  // Out of usage now: nobody is woken until the reset, and one message says when.
  cutOff(60e3, 2 * 3600e3);
  n = runs(); await s.ok('POST', '/api/watchman/round'); await s.ok('POST', '/api/watchman/round'); await sleep(300);
  check('while out of usage nobody is woken', runs() === n);
  const th = await s.ok('GET', '/api/chats/_watchman');
  check('one message says when teams start again', th.messages.filter(m => /usage limit/.test(m.text)).length === 1, th.messages);
  // Morning: the chat stays, with what got done, until cleared.
  await s.ok('POST', '/api/quiet', { on: false });
  const w = (await s.ok('GET', '/api/chats')).find(c => c.slug === '_watchman');
  check('awake again: the night\'s chat is still listed, with something new', w && w.unread >= 1, w);
  check('its last message says what got done', /The night[\s\S]*Out/.test((await s.ok('GET', '/api/chats/_watchman')).messages.at(-1).text));
  await s.ok('POST', '/api/chats/_watchman', { text: 'clear chat' });
  check('clearing it removes it', !(await s.ok('GET', '/api/chats')).some(c => c.slug === '_watchman'));
}, false);

def('limitread', '⏳ a usage reading at 100% holds every wake until its reset, before any run fails on it (AIG-265)', async s => {
  await mkProject(s, 'Full', 'FUL', { path: tmp('full') });
  await mkCard(s, 'full', 'Work', { status: 'todo' });
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 100, resets_at: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 86400 } } });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['full'] });
  await sleep(4500);   // going quiet itself may start one run; then the watchman takes over
  const logf = path.join(s.data, 'logs', 'full.log'), runs = () => { try { return (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  const n = runs();
  await s.ok('POST', '/api/watchman/round'); await sleep(300);
  check('at 100% the team is not woken', runs() === n);
  check('one message says when teams start again', (await s.ok('GET', '/api/chats/_watchman')).messages.some(m => /usage limit/.test(m.text)));
  await s.ok('POST', '/api/quiet', { on: false });
}, false);

def('stuckonly', '🌙 a card flagged stuck stops only itself: the team is still woken for its other work (AIG-283)', async s => {
  await mkProject(s, 'Jam', 'JAM', { path: tmp('jam') });
  const mid = await mkCard(s, 'jam', 'Keeps failing', { status: 'doing' });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['jam'] });
  for (let i = 0; i < 3; i++) { await sleep(4500); await s.ok('POST', '/api/watchman/round'); }
  check('third try: stuck', /Stuck/.test((await getCard(s, 'jam', mid.id)).comments.at(-1).text));
  await mkCard(s, 'jam', 'Other work', { status: 'todo' });
  await sleep(4500);
  const logf = path.join(s.data, 'logs', 'jam.log'), n = (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length;
  await s.ok('POST', '/api/watchman/round'); await sleep(300);
  check('the team is still woken for its other work', (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length === n + 1);
  await s.ok('POST', '/api/quiet', { on: false });
}, false);
