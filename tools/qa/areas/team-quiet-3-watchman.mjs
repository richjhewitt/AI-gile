// QA areas: watchman, nightpace, keepgoing, limit, limitread, stuckonly (split from team-quiet.mjs, AIG-297).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

// AIG-1001: wait until the stand-in team runs have really ended (a fixed 4.5 s was flaky on a busy PC)
async function runsEnd(s, slugs) {
  await sleep(1000);
  for (let i = 0; i < 80; i++) {
    const ps = await s.ok('GET', '/api/projects');
    if (!slugs.some(x => { const p = ps.find(q => q.slug === x); return p && p.presence && p.presence.running; })) return;
    await sleep(250);
  }
}

def('watchman', '🌙 night watchman: restarts a cut-off team, flags a card stuck after 3 tries, wakes idle teams, morning summary (AIG-199)', async (s, ctx) => {
  await mkProject(s, 'Cut', 'CUT', { path: tmp('cut') });
  await mkProject(s, 'Nap', 'NAP', { path: tmp('nap') });
  await mkProject(s, 'Skip', 'SKP', { path: tmp('skip') });
  const mid = await mkCard(s, 'cut', 'Half done', { status: 'doing' });
  await mkCard(s, 'nap', 'Waiting work', { status: 'todo' });
  await mkCard(s, 'skip', 'Not watched', { status: 'todo' });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['cut', 'nap'] });
  await runsEnd(s, ['cut', 'nap']);   // going quiet wakes the teams; wait until those runs end
  await s.ok('POST', '/api/watchman/round');
  let c = await getCard(s, 'cut', mid.id);
  check('a team that stopped mid-card is started again, with a note', /Picked back up/.test(c.comments.at(-1).text));
  let st = await s.ok('GET', '/api/watchman');
  check('an idle team with work is woken; an unwatched one is left alone', st.summary.find(x => x.project === 'nap').woke === 1 && !st.summary.find(x => x.project === 'skip'));
  await runsEnd(s, ['cut', 'nap']);   // the stand-in agent ends; the team is asleep again
  await s.ok('POST', '/api/watchman/round'); await runsEnd(s, ['cut', 'nap']); await s.ok('POST', '/api/watchman/round');
  c = await getCard(s, 'cut', mid.id);
  check('third time on the same card: stuck, and in your pile', /Stuck/.test(c.comments.at(-1).text) && c.needsYou === true, c.comments.at(-1).text);
  const back = await s.ok('POST', '/api/quiet', { on: false });
  const cut = back.summary.find(x => x.project === 'cut');
  check('back from quiet: a summary per project', cut && cut.stuck.includes(mid.id) && cut.restarted.includes(mid.id) && !(await s.ok('GET', '/api/watchman')), back.summary);

  // AIG-1440: stale CLI presence must not survive folder-only heartbeats.
  await mkProject(s, 'Stale', 'STL', { path: tmp('stale') });
  await mkProject(s, 'Fresh', 'FRS', { path: tmp('fresh') });
  await mkCard(s, 'stale', 'Resume abandoned work', { status: 'todo' });
  await mkCard(s, 'fresh', 'Live lead owns this work', { status: 'doing' });
  const cli = slug => s.cli(['comment', slug, slug === 'stale' ? 'STL-1' : 'FRS-1', '- Still working', '--as', 'Lead'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  cli('stale'); cli('fresh');
  await s.ok('POST', '/api/quiet', { on: true, watch: ['stale', 'fresh'] });
  await sleep(1200);
  cli('fresh');
  await s.ok('POST', '/api/limits', { cwd: (await s.ok('GET', '/api/projects/stale')).path, rate_limits: { five_hour: { used_percentage: 1 } } });
  await s.ok('POST', '/api/watchman/round');
  const dead = await s.ok('GET', '/api/projects/stale'), live = await s.ok('GET', '/api/projects/fresh');
  check('stale session starts the team and explains why in the project log', dead.presence.running && dead.log.some(e => /Lead session expired/.test(e.text)));
  check('fresh Lead CLI writes prevent a competing team or restart note', !live.presence.running && !(await getCard(s, 'fresh', 'FRS-1')).comments.some(e => /Picked back up|Stuck/.test(e.text)));
  const page = await openPage(ctx, '#/p/stale');
  await page.waitForSelector('#teamTop .pres');
  const shots = 'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots';
  fs.mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: path.join(shots, 'AIG-1440.png'), fullPage: true });
  noErrors(page);
  await s.ok('POST', '/api/quiet', { on: false });
}, true, { AIGILE_ACTIVE_MS: '1000' });

// AIG-1446/1447/1448: the night watch keeps the push level's pace on its own timer (no round called by the test), a team whose
// run just ended is not "online" for 5 more minutes, a team it can't wake says why (glance and top bar), failures are logged.
def('nightpace', '🌙 night watch pace: the timer wakes a finished team at the push level pace, the glance shows the real last check and why a team is not woken (AIG-1446)', async (s, ctx) => {
  await s.ok('POST', '/api/scrummaster/push', { level: 5 });
  await mkProject(s, 'Pace', 'PAC', { path: tmp('pace') });
  await mkProject(s, 'Held', 'HLD', { path: tmp('held') });
  await mkProject(s, 'Nofolder', 'NOF');
  await mkProject(s, 'Gone', 'GON', { path: path.join(tmp('gone'), 'moved-away') });   // a folder that is not there (moved or deleted)
  await mkCard(s, 'pace', 'Work to do', { status: 'todo' });
  await mkCard(s, 'held', 'Lead has it', { status: 'todo' });
  await mkCard(s, 'nofolder', 'No folder yet', { status: 'todo' });
  await mkCard(s, 'gone', 'Folder went away', { status: 'todo' });
  await mkProject(s, 'Off', 'OFF', { path: tmp('off') });
  await mkCard(s, 'off', 'AI is off here', { status: 'todo' });
  await s.ok('PATCH', '/api/projects/off', { aiOff: true });   // startTeam refuses: the refusal must be kept, not swallowed
  s.cli(['comment', 'held', 'HLD-1', '- On it', '--as', 'Lead'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });   // a real VS Code lead
  await s.ok('GET', '/api/projects/pace/updates');   // the team was heard (as a run's own calls are), before its run ends
  await s.ok('POST', '/api/projects/pace/wake', { sprint: true }); await runsEnd(s, ['pace']);   // ...and then that run ended
  const logf = path.join(s.data, 'logs', 'pace.log'), starts = () => { try { return (fs.readFileSync(logf, 'utf8').match(/ started/g) || []).length; } catch { return 0; } };
  await s.ok('POST', '/api/quiet', { on: true, watch: ['pace', 'held', 'nofolder', 'gone', 'off'] });
  await runsEnd(s, ['pace']);
  const n = starts(), t0 = Date.now();
  let again = false; for (let i = 0; i < 40 && !again; i++) { await sleep(250); again = starts() > n; }
  check('a team whose run ended is woken again by the timer, not 5 minutes later (it no longer counts as online)', again, fs.readFileSync(logf, 'utf8'));
  await sleep(1500);
  const w = await s.ok('GET', '/api/watchman');
  check('the pace follows the push level: Crack the whip is every 2 min', w.everyMin === 2, w.everyMin);
  check('every look counts as a check: lastCheck is seconds old though no round was asked for', w.lastCheck && Date.now() - Date.parse(w.lastCheck) < 5000 && Date.parse(w.lastCheck) >= t0, w.lastCheck);
  check('the last thing it did is kept', w.last && w.last.kind === 'woke' && w.last.project === 'pace', w.last);
  check('a team with its lead in a session says why it is not woken', w.why.held && w.why.held.why === 'lead', w.why);
  check('a project with no folder says so', w.why.nofolder && w.why.nofolder.why === 'folder', w.why);
  check('a watched project whose folder is missing says so (it was skipped without a word)', w.why.gone && w.why.gone.why === 'foldermissing', w.why);
  check('a wake that was refused keeps its reason, not swallowed', w.why.off && w.why.off.why === 'error' && /AI is off/.test(w.why.off.msg || ''), w.why);
  check('and the refusal is in the watchman log', /wake off/.test(fs.readFileSync(path.join(s.data, 'logs', '_watchman.log'), 'utf8')));
  await sleep(2100);   // the project payload's night view is read at most every 2 s
  const nf = await s.ok('GET', '/api/projects/nofolder');
  check('the project payload says it is watched tonight, and why it is not running', nf.night && nf.night.watched && nf.night.why.why === 'folder', nf.night);
  // A team that runs and moves nothing three times has chosen to wait: woken at the steady pace instead, and the glance says so.
  let waits = false; for (let i = 0; i < 80 && !waits; i++) { await sleep(250); waits = ((await s.ok('GET', '/api/watchman')).why.pace || {}).why === 'waits'; }
  check('a team that ran and moved nothing three times is shown as choosing to wait, with its next try', waits, (await s.ok('GET', '/api/watchman')).why.pace);
  const g = await openPage(ctx, '#/pop-night');
  await g.waitForSelector('#ngWhen');
  const gt = await g.textContent('.ng');
  check('the glance shows the real last check and the pace', /Checked .* every 2 min/.test(await g.textContent('#ngWhen')), await g.textContent('#ngWhen'));
  check('the glance says what it last did', /Last: (woke|poked) Pace/.test(gt), gt);
  check('the glance says why each team is not running', /its lead is at work in a session/.test(gt) && /no folder connected/.test(gt) && /its folder is missing/.test(gt) && /could not start: AI is off/.test(gt), gt);
  const shots = 'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots';
  fs.mkdirSync(shots, { recursive: true });
  await g.screenshot({ path: path.join(shots, 'AIG-1446-glance.png') });
  noErrors(g);
  const b = await openPage(ctx, '#/p/nofolder');
  await b.waitForFunction(() => !!document.querySelector('#teamTop .pres-night'), null, { timeout: 15000 });
  check('a watched project asleep says on its top bar why the night watch is not waking it', /no folder connected/.test(await b.textContent('#teamTop')), await b.textContent('#teamTop'));
  await b.setViewportSize({ width: 390, height: 800 }); await sleep(300);
  check('the top bar fits a phone', await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await b.screenshot({ path: path.join(shots, 'AIG-1446-topbar-390.png') });
  noErrors(b);
  // Setup's switch is the "watch every project" default; while quiet it also says the night watch is on now.
  await s.ok('POST', '/api/setup', { prefs: { smRole: true, watchAll: false } });
  const sm = await s.ok('GET', '/api/scrummaster');
  check('the Scrum Master status says the night watch is on now even with the watch-every-project switch off', sm.nightNow && sm.nightNow.n === 5 && sm.night === false, sm);
  const d = await openPage(ctx, '#/');
  await d.waitForSelector('#dmRail [data-dms]'); await d.click('#dmRail [data-dms]'); await d.click('#dmPanel [data-dm="_watchman"]');
  await d.waitForSelector('#smNightNow', { timeout: 8000 });
  const bar = await d.textContent('#smBar');
  check('Setup never says "Night watch: off" while it is on: it says on now, and the switch is named for what it does', /Night watch on now: 5 projects, checked every 2 min/.test(bar) && /watches every project: off/.test(bar) && !/Night watch: off/.test(bar), bar);
  await d.screenshot({ path: path.join(shots, 'AIG-1446-smbar.png') });
  noErrors(d);
  await s.ok('POST', '/api/quiet', { on: false });
}, true, { AIGILE_WATCH_TICK_MS: '1000', AIGILE_QUICK_GAP_MS: '1' });

def('keepgoing','🌙 keeps every team on task: the every-minute look picks up a card left in progress, and a session idle in its wait gets one nudge that ends the wait (AIG-277)', async s => {
  await mkProject(s, 'Half', 'HLF', { path: tmp('half') });
  await mkProject(s, 'Idle', 'IDL', { path: tmp('idle') });
  const mid = await mkCard(s, 'half', 'Half done', { status: 'doing' });
  const todo = await mkCard(s, 'idle', 'Buildable', { status: 'todo' });
  const stuck = await mkCard(s, 'idle', 'Blocked but urgent', { status: 'todo', priority: 'urgent' });
  await s.ok('PATCH', `/api/projects/idle/cards/${stuck.id}`, { blocked: true });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['half', 'idle'] });
  await runsEnd(s, ["half", "idle"]);   // going quiet wakes both teams; wait until those runs end
  await s.ok('GET', '/api/projects/idle/updates?wait=1');   // the Idle session now sits in 'aigile wait'
  await sleep(50);
  await s.ok('POST', '/api/watchman/quick');
  check('the every-minute look picks up a card left in progress', /Picked back up/.test((await getCard(s, 'half', mid.id)).comments.at(-1)?.text || ''));
  check('an idle session with work it can do gets a keep-going nudge', /Keep going/.test((await getCard(s, 'idle', todo.id)).comments.at(-1)?.text || ''));
  check('the nudge never lands on a blocked card, however urgent', !(await getCard(s, 'idle', stuck.id)).comments.some(m => /Keep going/.test(m.text)));
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
  await runsEnd(s, ["out"]);   // going quiet wakes the team; wait until that run ends
  const logf = path.join(s.data, 'logs', 'out.log'), runs = () => (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length;
  const ampm = d => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'am' : 'pm'}`;
  const cutOff = (startAgo, resetIn) => fs.appendFileSync(logf, `=== ${new Date(Date.now() - startAgo).toISOString()} started ===\nYou've hit your session limit · resets ${ampm(new Date(Date.now() + resetIn))} (Europe/London)\n=== exited ended ===\n`);
  // Cut off by a limit that has reset since: carried on, not counted as a try.
  cutOff(3 * 3600e3, -2 * 3600e3);
  let n = runs(); await s.ok('POST', '/api/watchman/quick'); await sleep(300);
  check('after the reset the team carries on', runs() === n + 1, fs.readFileSync(logf, 'utf8'));
  check('a limit cut-off is not counted as a try', !(await getCard(s, 'out', mid.id)).comments.some(m => /Picked back up|Stuck/.test(m.text)));
  await runsEnd(s, ["out"]);
  // Out of usage now: nobody is woken until the reset, and one message says when.
  cutOff(60e3, 2 * 3600e3);
  n = runs(); await s.ok('POST', '/api/watchman/round'); await s.ok('POST', '/api/watchman/round'); await sleep(300);
  check('while out of usage nobody is woken', runs() === n);
  const th = await s.ok('GET', '/api/chats/_watchman');
  check('one message says when teams start again', th.messages.filter(m => /usage limit/.test(m.text)).length === 1, th.messages);
  // Morning: the chat stays, with what got done, until cleared.
  await s.ok('PATCH', `/api/projects/out/cards/${mid.id}`, { status: 'done' });   // the team finished the card in the night (AIG-1051: the summary lists only projects where something got done)
  await s.ok('POST', '/api/quiet', { on: false });
  const w = (await s.ok('GET', '/api/chats')).find(c => c.slug === '_watchman');
  check('awake again: the night\'s chat is still listed, with something new', w && w.unread >= 1, w);
  const lm = (await s.ok('GET', '/api/chats/_watchman')).messages;
  check('its last message says what got done', /The night[\s\S]*Out/.test(lm.at(-1).text), lm.slice(-2));
  await s.ok('POST', '/api/chats/_watchman', { text: 'clear chat' });
  check('clearing it empties it; it stays listed so you can write to it by day (AIG-359)', (await s.ok('GET', '/api/chats/_watchman')).messages.length === 0 && (await s.ok('GET', '/api/chats')).some(c => c.slug === '_watchman'));
}, false);

def('limitread', '⏳ a usage reading at 100% holds every wake until its reset, before any run fails on it (AIG-265)', async s => {
  await mkProject(s, 'Full', 'FUL', { path: tmp('full') });
  await mkCard(s, 'full', 'Work', { status: 'todo' });
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 100, resets_at: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 86400 } } });
  await s.ok('POST', '/api/quiet', { on: true, watch: ['full'] });
  await runsEnd(s, ["full"]);   // going quiet itself may start one run; then the watchman takes over
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
  for (let i = 0; i < 3; i++) { await runsEnd(s, ["jam"]); await s.ok('POST', '/api/watchman/round'); }
  check('third try: stuck', /Stuck/.test((await getCard(s, 'jam', mid.id)).comments.at(-1).text));
  await mkCard(s, 'jam', 'Other work', { status: 'todo' });
  await runsEnd(s, ["jam"]);
  const logf = path.join(s.data, 'logs', 'jam.log'), n = (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length;
  await s.ok('POST', '/api/watchman/round'); await sleep(300);
  check('the team is still woken for its other work', (fs.readFileSync(logf, 'utf8').match(/started/g) || []).length === n + 1);
  await s.ok('POST', '/api/quiet', { on: false });
}, false);
