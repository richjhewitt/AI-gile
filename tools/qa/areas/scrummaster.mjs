// QA area: scrummaster (AIG-359): the 🧭 Lead Scrum Master by day: its chat answers a daytime message (Opus, in its own
// folder), sorts a 💡 decide-later idea into the right project by rules, wakes a team asleep with To do, keeps to the daily
// AI-run cap and No Token Mode, the role in the team (no launching) with its 🌙 night watch switch (AIG-476), and the hang watchdog restarts a silent run.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def, ROOT } from '../lib.mjs';

// The stub agent: in the Lead Scrum Master's folder it notes the model and answers with watchsay; in a "hang" project it
// sits silent; anything else is noted and ends at once.
const dir = tmp('scrum'), calls = path.join(dir, 'calls.txt'), stub = path.join(dir, 'sm-stub.bat'), local = path.join(dir, 'local.json');
fs.writeFileSync(path.join(dir, 'sm-stub.js'), `const fs = require('fs'), a = process.argv.slice(2), m = a[a.indexOf('--model') + 1] || '-', cwd = process.cwd();
fs.appendFileSync(${JSON.stringify(calls)}, m + ' ' + cwd + '\\n'); fs.appendFileSync(${JSON.stringify(calls + '.p')}, a[a.indexOf('-p') + 1] + '\\n');
fs.appendFileSync(${JSON.stringify(calls + '.a')}, cwd.replace(/.*[\\\\/]/, '') + ' ' + a.filter((x, i) => /^--(session-id|resume)$/.test(x) || /^--(session-id|resume)$/.test(a[i - 1] || '')).join(' ') + '\\n');
if (/scrummaster/i.test(cwd)) { console.log('{"type":"system"}'); require('child_process').spawnSync(process.execPath, [${JSON.stringify(path.join(ROOT, 'aigile.js'))}, 'watchsay', 'Stub reply from ' + m], { stdio: 'inherit' }); }
else if (/hang/i.test(cwd)) setTimeout(() => {}, 25000);`);
fs.writeFileSync(stub, `@echo off\r\nnode "${path.join(dir, 'sm-stub.js')}" %*\r\nexit /b 0\r\n`);
fs.writeFileSync(local, JSON.stringify({ owner: 'Owner', agent: { command: 'x', notesFile: 'CLAUDE.local.md', settingsFile: '.claude/settings.local.json' }, scrumMaster: { aiRunsPerDay: 3, digestAt: '23:59' } }));
const callList = () => { try { return fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean); } catch { return []; } };

def('scrummaster', '🧭 Lead Scrum Master: answers by day (Opus), sorts decide-later ideas by rules, wakes teams with To do, daily AI-run cap, No Token Mode, team role + night watch switch, hang watchdog (AIG-359)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('alpha') });
  await mkProject(s, 'Beta', 'BET', { path: tmp('beta') });
  await mkProject(s, 'Gamma', 'GAM', { path: tmp('gamma') });
  const chat = async () => (await s.ok('GET', '/api/chats/_watchman')).messages;
  let chats = await s.ok('GET', '/api/chats');
  check('awake: its chat is listed under its new name', chats.some(c => c.slug === '_watchman' && c.lead === '🧭 Lead Scrum Master'), chats.map(c => c.lead));

  // A daytime message gets a reply (relay used to refuse unless quiet), from an Opus run in its own folder.
  const r = await s.ok('POST', '/api/chats/_watchman', { text: 'How are things today?' });
  check('a daytime message starts it', r.working === true, r);
  check('the stub answers in its chat', !!(await until(async () => (await chat()).some(m => m.text === 'Stub reply from opus'), 15000)), await chat());
  check('the run is on Opus, in data/scrummaster', callList().some(l => /^opus .*scrummaster/i.test(l)), callList());
  check('its folder has the brief as CLAUDE.md', /MAY NOT write code/.test(fs.readFileSync(path.join(s.data, 'scrummaster', 'CLAUDE.md'), 'utf8')));
  await until(async () => !(await s.ok('GET', '/api/chats/_watchman')).busy, 10000);

  // Attaching in its chat (AIG-474): attach, paste and drop add the file; the sent message shows it and the agent's prompt has its path.
  const ap = await openPage(ctx, '#/');
  await ap.waitForSelector('#dmRail [data-dms]'); await ap.click('#dmRail [data-dms]'); await ap.click('#dmPanel [data-dm="_watchman"]');
  await ap.waitForSelector('#dmPanel .dm-compose .att');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await ap.setInputFiles('#dmPanel .att input[type=file]', { name: 'shot.png', mimeType: 'image/png', buffer: png });
  await ap.waitForSelector('#dmPanel .att-chip');
  await ap.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'dropped.txt', { type: 'text/plain' })); document.getElementById('dmText').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await ap.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['y'], 'image.png', { type: 'image/png' })); document.getElementById('dmText').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await ap.waitForFunction(() => document.querySelectorAll('#dmPanel .att-chip').length === 3);
  check('attach, drop and paste each add a file to the chat', true);
  await ap.fill('#dmText', 'See my screenshot');
  await ap.press('#dmText', 'Enter');
  await ap.waitForSelector('#dmList .dm-msg.mine .att-shown img');
  const sent = (await chat()).find(m => m.text === 'See my screenshot');
  check('the sent message keeps all three files and shows the picture', sent && sent.attachments.length === 3 && await ap.locator('#dmList .dm-msg.mine .att-shown a').count() === 3, sent);
  check('the saved image can be fetched', (await fetch(`${s.base}/api/projects/_watchman/attachments/${encodeURIComponent(sent.attachments[0].id)}`)).ok);
  const prompts = () => { try { return fs.readFileSync(calls + '.p', 'utf8'); } catch { return ''; } };
  check('the agent prompt carries the saved file paths', !!(await until(async () => sent.attachments.every(a => prompts().includes(a.path)), 10000)), prompts());
  await until(async () => !(await s.ok('GET', '/api/chats/_watchman')).busy, 10000);

  // 💡 The idea box can send to the 🧭 Lead Scrum Master, top of the list (AIG-388): it lands in its chat and starts a run.
  const ip = await openPage(ctx, '#/');
  await ip.click('#ideaBtn'); await ip.waitForSelector('#idea-text');
  check('the idea box offers the Lead Scrum Master first', (await ip.evaluate(() => document.querySelector('#idea-to option').value)) === '_sm');
  await ip.selectOption('#idea-to', '_sm');
  await ip.fill('#idea-text', 'Create a new project for my recipes');
  await ip.press('#idea-text', 'Control+Enter');
  await ip.waitForSelector('#idea-text', { state: 'detached' });
  check('the idea is in its chat', (await chat()).some(m => m.mine && m.text === '💡 Idea: Create a new project for my recipes'));
  check('and it handles it (a run answers)', !!(await until(async () => (await chat()).filter(m => /Stub reply/.test(m.text)).length >= 2, 15000)));
  check('no card was made by the box itself', !(await s.ok('GET', '/api/projects/alpha')).cards.some(c => /recipes/.test(c.title)));
  check('its brief says it makes projects and spaces itself (AIG-706)', /You can create projects and spaces: .*new-project "Name" --folder/.test(fs.readFileSync(path.join(s.data, 'scrummaster', 'CLAUDE.md'), 'utf8')));
  s.cli(['watchsay', 'Where should the folder for Recipes go?', '--options', 'C:/Projects/recipes,I will pick']);
  const q = (await chat()).at(-1);
  check('watchsay --options gives quick-answer buttons', q.pick && q.pick.length === 2 && q.pick[0].text === 'C:/Projects/recipes', q);
  noErrors(ip); await ip.close();
  await until(async () => !(await s.ok('GET', '/api/chats/_watchman')).busy, 10000);

  // 💡 A decide-later idea that names a project goes to that project's For the team, by rules (no AI).
  const idea = await mkCard(s, 'alpha', '💬 Beta could use a dark mode', { description: 'Beta could use a dark mode', type: 'task', status: 'backlog', createdBy: 'Ideas', quick: true, needsYou: true });
  const vague = await mkCard(s, 'alpha', '💬 something vague to think about', { type: 'task', status: 'backlog', createdBy: 'Ideas', quick: true, needsYou: true });
  await mkCard(s, 'alpha', 'Real work', { status: 'todo' });
  const before = callList().length;
  check('a round does nothing while it is not in the team', !(await s.ok('POST', '/api/scrummaster/round')).on);
  const role = on => s.ok('POST', '/api/setup', { prefs: { smRole: on } });
  check('not in the team by default, and the old launch route is gone', (await s.ok('GET', '/api/scrummaster')).on === false && (await s.api('POST', '/api/scrummaster/launch', {})).status === 404);
  await role(true);
  check('putting it in the team turns it on, with no launch step', (await s.ok('GET', '/api/scrummaster')).on === true);
  await s.ok('POST', '/api/scrummaster/round');
  const beta = (await s.ok('GET', '/api/projects/beta')).cards, alpha = (await s.ok('GET', '/api/projects/alpha')).cards;
  const moved = beta.find(c => c.title === idea.title);
  check('the idea is in Beta\'s For the team, signed by it', moved && moved.status === 'team' && moved.createdBy === '🧭 Lead Scrum Master' && !moved.needsYou, beta);
  check('and gone from Alpha', !alpha.some(c => c.id === idea.id));
  check('the unclear one stays in your inbox', alpha.some(c => c.id === vague.id && c.status === 'backlog' && c.needsYou));
  check('the status lists what it sorted, by rules', (await s.ok('GET', '/api/scrummaster')).sorted.some(x => x.card === idea.id && x.to === 'beta' && x.how === 'rules'));
  check('Alpha, asleep with To do, is woken', !!(await until(() => callList().slice(before).some(l => /alpha/i.test(l)), 8000)), callList());
  check('the rules spent no Opus or Sonnet run', !callList().slice(before).some(l => /^(opus|sonnet) /.test(l)), callList());

  // The daily cap (3 here, one used by the idea) stops routine runs only; the owner's own messages always get through (AIG-647).
  await s.ok('POST', '/api/chats/_watchman', { text: 'Second one' });
  await until(async () => (await chat()).filter(m => /Stub reply/.test(m.text)).length >= 3, 15000);
  await until(async () => !(await s.ok('GET', '/api/chats/_watchman')).busy, 10000);
  const n = callList().filter(l => /scrummaster/i.test(l)).length;
  await s.ok('POST', '/api/chats/_watchman', { text: 'Third one' });
  check('over the cap an owner message still gets its run (AIG-647)', !!(await until(() => callList().filter(l => /scrummaster/i.test(l)).length === n + 1, 8000)), callList());
  await until(async () => !(await s.ok('GET', '/api/chats/_watchman')).busy, 10000);
  check('and says nothing about being used up, the owner run not counted against the cap', !(await chat()).some(m => /AI runs are used up|AI-runs van vandaag zijn op/.test(m.text)) && (await s.ok('GET', '/api/scrummaster')).runsToday <= 3, await chat());

  // ⛔ No Token Mode: messages are refused, a round wakes nobody.
  await s.ok('POST', '/api/notokens', { on: true });
  const nb = callList().length, held = await s.api('POST', '/api/chats/_watchman', { text: 'hello?' });
  check('No Token Mode answers a message by rule, with no AI run (AIG-551)', held.status === 200 && !!(await until(async () => (await chat()).some(m => m.auto && m.mine === false), 4000)) && callList().length === nb, await chat());
  await mkCard(s, 'beta', 'More work', { status: 'todo' });
  const b2 = callList().length;
  await s.ok('POST', '/api/scrummaster/round'); await sleep(1500);
  check('No Token Mode: the round starts nothing', callList().length === b2, callList().slice(b2));
  await s.ok('POST', '/api/notokens', { on: false });
  await role(false);

  // 🧭 On the page (AIG-476): not in the team it says so with a link; in the team it is on, with a 🌙 night watch switch.
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]'); await page.click('#dmPanel [data-dm="_watchman"]');
  await page.waitForSelector('#smAdd');
  check('the chat head shows its name', /Lead Scrum Master/.test(await page.textContent('#dmPanel .dm-head')));
  check('not in the team: it says so, with a link to Setup and no Launch button', /not in your team/.test(await page.textContent('#smBar')) && (await page.getAttribute('#smAdd', 'href')) === '#/setup' && await page.locator('#smLaunch').count() === 0);
  await role(true);
  await page.reload(); await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]'); await page.click('#dmPanel [data-dm="_watchman"]');
  await page.waitForSelector('#smNight', { timeout: 8000 });
  check('in the team: no Launch button, and a night watch switch showing its state', await page.locator('#smLaunch').count() === 0 && /Night watch: on/.test(await page.textContent('#smNight')), await page.textContent('#smBar'));
  await page.click('#smNight');
  await page.waitForFunction(() => /Night watch: off/.test((document.getElementById('smNight') || {}).textContent || ''), null, { timeout: 8000 });
  check('the switch changes the one night watch setting (Setup: Watchman ticks every project)', (await s.ok('GET', '/api/setup')).prefs.watchAll === false && (await s.ok('GET', '/api/scrummaster')).night === false);
  await s.ok('POST', '/api/setup', { prefs: { watchAll: true } });
  await page.reload(); await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]'); await page.click('#dmPanel [data-dm="_watchman"]');
  await page.waitForFunction(() => /Night watch: on/.test((document.getElementById('smNight') || {}).textContent || ''), null, { timeout: 8000 });
  check('a change made in Setup shows on the switch', true);
  // 🎚️ The diligence scale (AIG-441) in the chat header: "On: checking every N min (Steady)", changed with the select.
  check('the header says it is on, every 10 min, Steady', /On: checking every 10 min \(.*Steady\)/.test(await page.textContent('#smBar')), await page.textContent('#smBar'));
  await page.selectOption('#smPush', '5');
  await page.waitForFunction(() => /every 2 min/.test((document.getElementById('smBar') || {}).textContent || ''), null, { timeout: 8000 });
  check('level 5 is saved: every 2 min, Crack the whip', (await s.ok('GET', '/api/scrummaster')).push === 5 && /Crack the whip/.test(await page.textContent('#smBar')));
  await page.selectOption('#smPush', '3');
  await page.waitForFunction(() => /every 10 min/.test((document.getElementById('smBar') || {}).textContent || ''), null, { timeout: 8000 });
  await role(false);
  // AIG-457: a small, same-each-time prompt on one shared session (--session-id, then --resume; fresh after an hour idle).
  const conf = path.join(s.data, 'scrummaster.conf'), smConf = fn => { const j = JSON.parse(fs.readFileSync(conf, 'utf8')); fn(j); fs.writeFileSync(conf, JSON.stringify(j)); };
  const smLines = f => { try { return fs.readFileSync(calls + f, 'utf8').split('\n').filter(l => /^scrummaster /i.test(l)); } catch { return []; } };
  const idle = async () => { await until(async () => !(await s.ok('GET', '/api/chats/_watchman')).busy, 10000); await sleep(300); };
  const ask = async text => { const n = smLines('.a').length; await s.ok('POST', '/api/chats/_watchman', { text }); await until(() => smLines('.a').length > n, 10000); await idle(); return smLines('.a').at(-1); };
  await role(true); smConf(j => { j.runs = 0; delete j.session; });
  const mdPath = path.join(s.data, 'scrummaster', 'CLAUDE.md'), md0 = fs.statSync(mdPath).mtimeMs;
  const a1 = await ask('Plan A');
  check('a first run starts a session under an id it chooses', /^scrummaster --session-id [0-9a-f-]{36}$/i.test(a1), a1);
  const p1 = fs.readFileSync(calls + '.p', 'utf8').split('\n').filter(Boolean).at(-1);
  check('its prompt is only the owner\'s words and what changed, not the role', /Owner wrote: .?Plan A/.test(p1) && !/MAY NOT/.test(p1), p1);
  const a2 = await ask('Plan B');
  check('the next run resumes that same session', a2 === a1.replace('--session-id', '--resume'), [a1, a2]);
  const p2 = fs.readFileSync(calls + '.p', 'utf8').split('\n').filter(Boolean).at(-1);
  check('and its prompt is just the new words (no chat replay)', /^Owner wrote: .?Plan B.?$/.test(p2), p2);
  check('the role file was not rewritten', fs.statSync(mdPath).mtimeMs === md0);
  smConf(j => { j.session.at = new Date(Date.now() - 2 * 3600e3).toISOString(); });
  const a3 = await ask('Plan C');
  check('after an hour idle it starts a fresh session', /--session-id/.test(a3) && a3.split(' ')[2] !== a1.split(' ')[2], [a1, a3]);

  // AIG-456: with a window session around (smwait), messages sent while it is busy are queued for its next wait, and no
  // hidden second run starts; once it has been gone a while, a background run takes over and the window isn't handed it twice.
  const t0 = new Date().toISOString();
  await s.ok('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(t0));
  const runs0 = smLines('.a').length;
  const rq = await s.ok('POST', '/api/chats/_watchman', { text: 'Sent while you were busy' });
  await sleep(1500);
  check('a window session is around: the message waits for it, no second run starts', rq.waiting === true && smLines('.a').length === runs0, rq);
  await sleep(1100);   // an smwait started after the message (a later "since") is still handed it
  const w1 = await s.ok('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(new Date().toISOString()));
  check('its next smwait is handed the queued message', w1.messages.length === 1 && w1.messages[0].text === 'Sent while you were busy', w1);
  check('and only once', (await s.ok('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(new Date().toISOString()))).messages.length === 0);
  smConf(j => { j.runs = 0; j.heardAt = new Date(Date.now() - 30 * 60e3).toISOString(); });
  const rb = await s.ok('POST', '/api/chats/_watchman', { text: 'Window is gone' });
  await until(() => smLines('.a').length > runs0, 10000); await idle();
  check('the window gone for a while: one background run takes it', rb.working === true && smLines('.a').length === runs0 + 1, [rb, runs0, smLines('.a')]);
  check('and a later smwait is not handed it again', (await s.ok('GET', '/api/scrummaster/wait?since=' + encodeURIComponent(new Date().toISOString()))).messages.length === 0);
  smConf(j => { j.runs = 3; j.heardAt = new Date(Date.now() - 30 * 60e3).toISOString(); });
  await role(false);

  check('taking it out of the team turns it off', !(await s.ok('GET', '/api/scrummaster')).on);
  noErrors(page);

  // The scale changes the interval and the thresholds; on runs day and night, off stops (AIG-441).
  const st0 = await s.ok('GET', '/api/scrummaster');
  check('the step table is in the status: 30/20/10/5/2 min, caps 4/6/8/12/16', [1, 2, 3, 4, 5].every((n, i) => st0.scale[n].everyMin === [30, 20, 10, 5, 2][i] && st0.scale[n].cap === [4, 6, 8, 12, 16][i]), st0.scale);
  check('and stuck 1 day / 8 h / 3 h / 1 h / 30 min, reminders never / never / 4 h / 2 h / 1 h', [1, 2, 3, 4, 5].every((n, i) => st0.scale[n].stuckMin === [1440, 480, 180, 60, 30][i] && st0.scale[n].remindMin === [0, 0, 240, 120, 60][i]), st0.scale);
  for (const [lv, ev] of [[1, 30], [2, 20], [3, 10], [4, 5], [5, 2]]) check(`level ${lv} checks every ${ev} min`, (await s.ok('POST', '/api/scrummaster/push', { level: lv })).everyMin === ev);
  check('a level outside 1..5 is refused', (await s.api('POST', '/api/scrummaster/push', { level: 9 })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { smPush: 2 } });
  check('Setup saves the same scale', (await s.ok('GET', '/api/scrummaster')).push === 2 && (await s.ok('GET', '/api/setup')).prefs.smPush === 2);
  const age = (slug, fn) => { const f = path.join(s.data, slug + '.json'), j = JSON.parse(fs.readFileSync(f, 'utf8')); fn(j); fs.writeFileSync(f, JSON.stringify(j, null, 1)); };
  const hoursAgo = h => new Date(Date.now() - h * 3600e3).toISOString();
  const sa = await mkCard(s, 'gamma', 'Stuck five hours', { status: 'doing' }), sb = await mkCard(s, 'gamma', 'Stuck two hours', { status: 'doing' }), sc = await mkCard(s, 'gamma', 'Stuck forty minutes', { status: 'doing' });
  age('gamma', j => { for (const [c, h] of [[sa, 5], [sb, 2], [sc, 40 / 60]]) j.cards.find(x => x.id === c.id).updated = hoursAgo(h); });
  const flagged = async () => (await s.ok('GET', '/api/scrummaster')).flagged;
  await s.ok('POST', '/api/setup', { prefs: { smPush: 1 } });
  check('off: a round does nothing (as today)', (await s.ok('POST', '/api/scrummaster/round')).on === false && await flagged() === 0);
  await role(true);
  await sleep(2500);   // its own first round
  const base = await flagged();
  check('on at level 1: nothing is stuck for a day', await flagged() === base, base);
  await s.ok('POST', '/api/scrummaster/push', { level: 2 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 2: still nothing under 8 h', await flagged() === base);
  await s.ok('POST', '/api/scrummaster/push', { level: 3 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 3 pokes the 5 h card only', await flagged() === base + 1, await flagged());
  check('AIG-567: the stale card gets one free "any update?" (automated), the others none', (await getCard(s, 'gamma', sa.id)).comments.filter(m => m.poke && m.auto && /any update/.test(m.text)).length === 1 && !(await getCard(s, 'gamma', sb.id)).comments.some(m => m.poke));
  await s.ok('POST', '/api/scrummaster/push', { level: 4 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 4 adds the 2 h card', await flagged() === base + 2, await flagged());
  await s.ok('POST', '/api/scrummaster/push', { level: 5 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 5 adds the 40 min card', await flagged() === base + 3, await flagged());
  check('the AI runs stayed inside the daily cap (3)', (await s.ok('GET', '/api/scrummaster')).runsToday <= 3);

  // The home screen shows the Lead Scrum Master like a team's presence (AIG-463): idle when on and between runs, off when stopped.
  await until(async () => !(await s.ok('GET', '/api/scrummaster')).running, 20000);
  const home = await openPage(ctx, '#/');
  await home.waitForSelector('.smline');
  check('home: on and between runs it shows idle with when it last ran', /Lead Scrum Master/.test(await home.textContent('.smline')) && /Idle/.test(await home.textContent('.smline')) && /last ran/.test(await home.textContent('.smline')), await home.textContent('.smline'));

  // Reminders: one bump of a question waiting longer than the scale says, never again.
  const qa = await mkCard(s, 'alpha', 'Which colour?', { status: 'verify' });
  await say(s, 'alpha', qa.id, 'Lead', 'Which colour do you want?', { needsYou: true, mark: 'ask' });
  const qb = await mkCard(s, 'alpha', 'Which font?', { status: 'verify' });
  await say(s, 'alpha', qb.id, 'Lead', 'Which font do you want?', { needsYou: true, mark: 'ask' });
  age('alpha', j => { for (const [c, h] of [[qa, 5], [qb, 3]]) j.cards.find(x => x.id === c.id).comments.forEach(m => { if (m.mark === 'ask') m.at = hoursAgo(h); }); });
  const bumps = async c => (await getCard(s, 'alpha', c.id)).bumps || 0;
  await s.ok('POST', '/api/scrummaster/push', { level: 2 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 2 never reminds', await bumps(qa) === 0);
  await s.ok('POST', '/api/scrummaster/push', { level: 3 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 3 bumps the question waiting 5 h, not the one at 3 h', await bumps(qa) === 1 && await bumps(qb) === 0, [await bumps(qa), await bumps(qb)]);
  await s.ok('POST', '/api/scrummaster/round'); await s.ok('POST', '/api/scrummaster/round');
  check('and never repeats', await bumps(qa) === 1);
  await s.ok('POST', '/api/scrummaster/push', { level: 4 }); await s.ok('POST', '/api/scrummaster/round');
  check('level 4 (2 h) bumps the other one, once', await bumps(qb) === 1 && await bumps(qa) === 1);

  // Level 5 no longer DMs a periodic status line (AIG-689); ScrumGlance shows the numbers.
  const lines = async () => (await chat()).filter(m => /^🏇 /.test(m.text)).length;
  await s.ok('POST', '/api/scrummaster/push', { level: 5 });
  await s.ok('POST', '/api/scrummaster/round'); await s.ok('POST', '/api/scrummaster/round');
  check('level 5 sends no status line in the chat any more', await lines() === 0, await chat());

  // ⛔ No Token Mode: a card newly stuck is noted but no AI run starts.
  await s.ok('POST', '/api/notokens', { on: true });
  const sd = await mkCard(s, 'gamma', 'Stuck under No Token', { status: 'doing' });
  age('gamma', j => { j.cards.find(x => x.id === sd.id).updated = hoursAgo(9); });
  const c0 = callList().length;
  await s.ok('POST', '/api/scrummaster/round'); await sleep(1200);
  check('No Token Mode: the stuck card starts no AI run', callList().length === c0, callList().slice(c0));
  await s.ok('POST', '/api/notokens', { on: false });

  // Off stops it again.
  await role(false);
  const se = await mkCard(s, 'gamma', 'Stuck after off', { status: 'doing' });
  age('gamma', j => { j.cards.find(x => x.id === se.id).updated = hoursAgo(9); });
  const fl = await flagged();
  await s.ok('POST', '/api/scrummaster/round');
  check('off stops the rounds', await flagged() === fl && (await s.ok('GET', '/api/scrummaster')).on === false);
  await home.reload(); await home.waitForSelector('.smline');
  check('home: stopped it shows off', /Off/.test(await home.textContent('.smline')), await home.textContent('.smline'));
  await s.ok('POST', '/api/setup', { prefs: { smPush: 3 } });

  // Hang watchdog: a verbose background run that writes nothing is stopped and started again, with a note on its card.
  await mkProject(s, 'Hang', 'HNG', { path: tmp('hang') });
  await s.ok('PATCH', '/api/projects/hang', { verbose: true });
  const hc = await mkCard(s, 'hang', 'Long job', { status: 'doing' });
  await s.ok('POST', '/api/projects/hang/wake');
  const hlog = () => { try { return fs.readFileSync(path.join(s.data, 'logs', 'hang.log'), 'utf8'); } catch { return ''; } };
  check('a silent run is caught', !!(await until(() => /=== hung: no new log lines/.test(hlog()), 25000)), hlog());
  check('and started again', !!(await until(() => (hlog().match(/=== \S+ started/g) || []).length >= 2, 5000)), hlog());
  const card = (await s.ok('GET', '/api/projects/hang')).cards.find(c => c.id === hc.id);
  check('with a note on the card in progress', card.comments.some(m => m.author === '🧭 Lead Scrum Master' && /Restarted/.test(m.text)), card.comments);
  await s.ok('POST', '/api/notokens', { on: true });   // stop the stub runs
}, true, { AIGILE_AGENT_COMMAND: stub, AIGILE_LOCAL: local, AIGILE_NO_WINDOWS: '1', AIGILE_HANG_MS: '4000', AIGILE_NO_USAGE_AUTO: '1' });
