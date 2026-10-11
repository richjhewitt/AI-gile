// QA areas: presence, quiet, quietinbox, poke.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

def('presence', 'asleep -> online; Wake/comment start a background run (log, one at a time, restart, log dialog)', async (s, ctx) => {
  const folder = tmp('proj');
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  fs.mkdirSync(folder + '-b');
  await mkProject(s, 'Beta', 'BET', { path: folder + '-b' });
  check('asleep at first (api)', (await s.ok('GET', '/api/projects/alpha')).presence.online === false);
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#teamTop .pres');
  check('page says asleep', /asleep/.test(await page.textContent('#teamTop')), await page.textContent('#teamTop'));
  await s.ok('GET', '/api/projects/alpha/updates');
  check('online after an updates call (api)', (await s.ok('GET', '/api/projects/alpha')).presence.online === true);
  await page.waitForFunction(() => /in a window/.test(document.getElementById('teamTop').textContent), null, { timeout: 4000 }).catch(() => {});
  check('page says working in a window', /Working in a window/.test(await page.textContent('#teamTop')), await page.textContent('#teamTop'));
  // AIG-107: a CLI call from VS Code marks the team as at work there, and blocks a background run on top.
  const vs = s.cli(['show', 'alpha', 'ALP-1'], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });
  check('CLI from VS Code reports where', (await s.ok('GET', '/api/projects/alpha')).presence.where === 'vscode', vs);
  await page.waitForFunction(() => /VS Code/.test(document.getElementById('teamTop').textContent), null, { timeout: 4000 }).catch(() => {});
  check('page says working in VS Code', /Working in VS Code/.test(await page.textContent('#teamTop')), await page.textContent('#teamTop'));
  const hf = await s.ok('POST', '/api/limits', { cwd: folder + '-b', rate_limits: { five_hour: { used_percentage: 1 } } });
  check('status line report marks the folder online', hf.ok && (await s.ok('GET', '/api/projects/beta')).presence.online === true);

  // A team already online in a terminal is not started in the background.
  const ca = await mkCard(s, 'alpha', 'terminal card');
  await say(s, 'alpha', ca.id, 'Rich', 'hello');
  await sleep(600);
  check('online (terminal) team gets no background run', !(await s.ok('GET', '/api/projects/alpha')).presence.running && !fs.existsSync(path.join(s.data, 'logs', 'alpha.log')));

  // Wake from the page.
  fs.mkdirSync(folder + '-c');
  await mkProject(s, 'Gamma', 'GAM', { path: folder + '-c' });
  await page.goto(BASE + '/#/p/gamma');
  await page.waitForSelector('#teamTop button.primary');
  await page.click('#teamTop button.primary');
  let out = '';
  for (let i = 0; i < 60 && !out.includes('Rich commented'); i++) { await sleep(250); try { out = fs.readFileSync(s.wakeOut, 'utf8'); } catch {} }
  const norm = x => x.replace(/\\/g, '/').toLowerCase();
  check('stub got the prompt and --continue', /Rich commented on the AI-gile board/.test(out) && /project gamma/.test(out) && /"-p" /.test(out) && /--continue/.test(out), out);
  check('stub ran with the folder as cwd', norm(out.split(/\r?\n/)[0]).replace(/\/$/, '') === norm(folder + '-c'), out.split(/\r?\n/)[0]);
  await page.waitForFunction(() => /background/.test(document.getElementById('teamTop').textContent), null, { timeout: 4000 }).catch(() => {});
  const top = await page.textContent('#teamTop');
  check('page shows working in the background with Restart and Log', /Working in the background/.test(top) && /Restart/.test(top) && /Log/.test(top), top);
  const g = await s.ok('GET', '/api/projects/gamma');
  check('presence has running and startedAt', g.presence.running === true && g.presence.online === true && !!g.presence.startedAt);
  const logPath = path.join(s.data, 'logs', 'gamma.log');
  check('log file has the started header', /=== .* started ===/.test(fs.readFileSync(logPath, 'utf8')));
  await page.click('#teamTop button:has-text("Log")');
  await page.waitForSelector('#dialog pre', { timeout: 4000 }).catch(() => {});
  check('Log dialog opens with the log', /started/.test((await page.textContent('#dialog pre').catch(() => '')) || ''));
  await page.click('#dialog button:has-text("Close")');
  const al = await s.ok('GET', '/api/projects/gamma/agentlog');
  check('agentlog route returns text', typeof al.text === 'string' && /started/.test(al.text), al);

  // Restart kills the run and starts a fresh one.
  const rs = await s.ok('POST', '/api/projects/gamma/restart');
  check('restart answers ok', rs.ok === true);
  let log = '';
  for (let i = 0; i < 40; i++) { await sleep(250); log = fs.readFileSync(logPath, 'utf8'); if ((log.match(/started ===/g) || []).length >= 2) break; }
  check('restart ended the old run and started a new one', (log.match(/started ===/g) || []).length === 2 && /=== exited /.test(log), log);
  check('new run is running', (await s.ok('GET', '/api/projects/gamma')).presence.running === true);
  // The run finishes by itself and the log shows its exit.
  for (let i = 0; i < 40 && (await s.ok('GET', '/api/projects/gamma')).presence.running; i++) await sleep(250);
  log = fs.readFileSync(logPath, 'utf8');
  check('run exits on its own and is logged', (await s.ok('GET', '/api/projects/gamma')).presence.running === false && (log.match(/=== exited/g) || []).length === 2, log);

  // A Rich comment starts a run; more during it give exactly one more run, never two at once.
  fs.mkdirSync(folder + '-e');
  await mkProject(s, 'Epsilon', 'EPS', { path: folder + '-e' });
  const ce = await mkCard(s, 'epsilon', 'work');
  await say(s, 'epsilon', ce.id, 'Rich', 'one');
  await sleep(500);
  check('Rich comment starts a run', (await s.ok('GET', '/api/projects/epsilon')).presence.running === true);
  await say(s, 'epsilon', ce.id, 'Rich', 'two');
  await s.ok('POST', `/api/projects/epsilon/cards/${ce.id}/poke`);
  const elog = path.join(s.data, 'logs', 'epsilon.log');
  check('only one run while it is going', (fs.readFileSync(elog, 'utf8').match(/started ===/g) || []).length === 1);
  let el = '';
  for (let i = 0; i < 80; i++) { await sleep(250); el = fs.readFileSync(elog, 'utf8'); if ((el.match(/exited/g) || []).length >= 2 && !(await s.ok('GET', '/api/projects/epsilon')).presence.running) break; }
  check('queued triggers give exactly one more run', (el.match(/started ===/g) || []).length === 2 && (el.match(/exited/g) || []).length === 2, el);

  await mkProject(s, 'Delta', 'DEL');
  check('wake without folder is refused', (await s.api('POST', '/api/projects/delta/wake')).status === 400);
  const dc = await mkCard(s, 'delta', 'x');
  check('Rich comment without a folder still succeeds', (await s.api('POST', `/api/projects/delta/cards/${dc.id}/comments`, { author: 'Rich', text: 'hi' })).status === 200);
  noErrors(page);
}, true);

def('quiet', 'Going quiet messages teams with work, wakes sleeping ones, night theme on/off', async (s, ctx) => {
  const folder = tmp('quiet');
  await mkProject(s, 'Busy', 'BSY', { path: folder });
  await s.ok('POST', '/api/projects/busy/cards', { title: 'work', status: 'todo' });
  await mkProject(s, 'Idle', 'IDL');
  const page = await openPage(ctx, '#/');
  page.on('dialog', d => d.accept());
  await page.click('text=🌙 Going quiet');
  await page.waitForSelector('#dialog [data-watch]');
  check('it asks which projects the night watchman watches, all ticked (AIG-199)', (await page.locator('#dialog [data-watch]').count()) === 2 && (await page.locator('#dialog [data-watch]:checked').count()) === 2);
  await page.click('#dialog .primary');
  await page.waitForSelector('html[data-night]', { timeout: 4000 }).catch(() => {});
  check('the watchman watches what was ticked', (await s.ok('GET', '/api/watchman')).watch.length === 2);
  await page.waitForSelector('#dialog .qd', { timeout: 5000 }).catch(() => {});
  check('a goodnight dialog says who was told, not a plain alert (AIG-208)', /Busy/.test(await page.textContent('#dialog .qd')));
  await page.click('#dialog .qd .primary');
  check('night theme on', await page.$('html[data-night]') !== null);
  const busy = await s.ok('GET', '/api/projects/busy'), idle = await s.ok('GET', '/api/projects/idle');
  const msg = busy.cards.find(c => c.title === '📣 Going quiet');
  check('team with work gets the card in For the team', msg && msg.status === 'team' && msg.createdBy === 'Rich');
  check('project with no work is left alone', !idle.cards.length);
  check('message reaches the team via updates', (await s.ok('GET', '/api/projects/busy/updates')).cards.some(c => c.title === '📣 Going quiet'));
  let out = '';
  for (let i = 0; i < 40 && !out.includes('project busy'); i++) { await sleep(250); try { out = fs.readFileSync(s.wakeOut, 'utf8'); } catch {} }
  check('sleeping team was woken', /project busy/.test(out), out);
  check('meta reports quiet', !!(await s.ok('GET', '/api/meta')).quiet);
  await page.click('text=☀️ I\'m back');
  await page.waitForTimeout(300);
  check('night theme off', await page.$('html[data-night]') === null && !(await s.ok('GET', '/api/meta')).quiet);
  noErrors(page);
}, true);

def('quietinbox', 'going quiet hides tests and tasks and caps questions at 3; I\'m back restores them', async (s, ctx) => {
  await mkProject(s, 'Qi', 'QIX');
  for (let i = 1; i <= 5; i++) {
    await mkCard(s, 'qi', 'Ask ' + i, { status: 'doing', assignee: 'Forge' });
    await say(s, 'qi', 'QIX-' + i, 'Forge', 'question ' + i, { needsYou: true });
    await sleep(15);
  }
  await mkCard(s, 'qi', 'Qi task', { status: 'doing', assignee: 'Pixel' });
  await s.ok('PATCH', '/api/projects/qi/cards/QIX-6', { assignee: 'Rich' });
  await say(s, 'qi', 'QIX-6', 'Pixel', 'do this');
  await mkCard(s, 'qi', 'Qi test', { status: 'verify', testSteps: 'try it' });
  const page = await openPage(ctx, '#/inbox');
  page.on('dialog', d => d.accept());
  await page.waitForSelector('.ib-item');
  check('awake: 5 questions, task and test show', (await page.locator('.ib-item.q').count()) === 5 && (await page.locator('.ib-item.k').count()) === 1 && (await page.locator('.ib-item.t').count()) === 1);
  await s.ok('POST', '/api/quiet', { on: true });
  await page.waitForSelector('html[data-night]', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(500);
  check('quiet: 3 newest questions, no task or test', (await page.locator('.ib-item.q').count()) === 3 && (await page.locator('.ib-item.k, .ib-item.t').count()) === 0);
  check('quiet: newest question is shown, oldest is not', (await page.locator('.ib-item[data-id="QIX-5"]').count()) === 1 && (await page.locator('.ib-item[data-id="QIX-1"]').count()) === 0);
  check('quiet: more waiting line', /2 more waiting for the morning/.test(await page.textContent('#ibMore')));
  const top = await page.textContent('#inboxTop .ib-btn');
  check('quiet: top bar hides tasks and tests', /3 questions/.test(top) && !/to do|to test/.test(top), top);
  await page.click('text=☀️ I\'m back');
  await page.waitForTimeout(500);
  check('back: everything shows again', (await page.locator('.ib-item.q').count()) === 5 && (await page.locator('.ib-item.k').count()) === 1 && (await page.locator('.ib-item.t').count()) === 1 && await page.isHidden('#ibMore'));
  noErrors(page);
}, true);

def('poke', 'asleep teams with work and stuck teams show as needing a poke', async (s, ctx) => {
  await mkProject(s, 'Sleepy', 'SLP', { path: tmp('sleepy') });
  await s.ok('POST', '/api/projects/sleepy/cards', { title: 'work', status: 'todo' });
  await mkProject(s, 'Empty', 'EMP');
  const ps = await s.ok('GET', '/api/projects');
  check('asleep with work needs a poke', ps.find(p => p.slug === 'sleepy').attention?.kind === 'asleep');
  check('no work, no poke', ps.find(p => p.slug === 'empty').attention === null);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#pokeTop .pokebadge', { timeout: 7000 }).catch(() => {});
  check('top-bar badge shows', /1 team needs a poke/.test(await page.textContent('#pokeTop')), await page.textContent('#pokeTop'));
  check('home tile says why, with a Wake button', /Needs a poke/.test(await page.textContent('.proj.needs-poke')) && !!(await page.$('.proj.needs-poke button.primary')));
  await page.click('#pokeTop .pokebadge');
  await new Promise(r => setTimeout(r, 1500));
  check('tapping the badge wakes the asleep team', /started/.test((await s.ok('GET', '/api/projects/sleepy/agentlog')).text));
  await s.ok('GET', '/api/projects/sleepy/updates');
  check('online clears it', (await s.ok('GET', '/api/projects/sleepy')).cards && (await s.ok('GET', '/api/projects')).find(p => p.slug === 'sleepy').attention === null);
  const { attention } = require('../../../lib/store.js');
  const old = new Date(Date.now() - 11 * 60e3).toISOString(), fresh = new Date().toISOString();
  const proj = at => ({ cards: [{ status: 'team', createdBy: '', created: old, updated: old, comments: [{ author: 'Rich', text: 'x', at }] }] });
  check('online, comment unanswered 10+ min = stuck', attention(proj(old), { online: true })?.kind === 'stuck');
  check('online, fresh comment = fine', attention(proj(fresh), { online: true }) === null);
  noErrors(page);
}, true);

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
