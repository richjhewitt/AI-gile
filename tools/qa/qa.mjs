// AI-gile QA: starts its own server on a temp data folder and checks the API, the CLI and the page.
//   node tools/qa/qa.mjs [area ...]     (no args = all areas; --list shows them; QA_PORT changes the port)
// The page areas need playwright: `cd tools/qa && npm i`, or it falls back to the shared install below.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.QA_PORT) || 4390;
const BASE = `http://127.0.0.1:${PORT}`;
// Machine-specific paths come from env (or a local install via npm i in tools/qa); none live in the repo.
const CHROME = process.env.QA_CHROME || undefined;   // undefined = playwright's own bundled browser
const PW_FALLBACK = process.env.QA_PLAYWRIGHT;   // path to a playwright package, if not installed here
const require = createRequire(import.meta.url);
const loadPw = () => { try { return require('playwright'); } catch (e) { if (PW_FALLBACK) return require(PW_FALLBACK); throw new Error('playwright not found: run npm i in tools/qa, or set QA_PLAYWRIGHT'); } };

let failures = 0, area = '';
const check = (name, ok, extra) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${area}: ${name}${!ok && extra !== undefined ? '  -> ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`);
  if (!ok) failures++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-qa-' + p + '-'));

/* ---------- server and helpers ---------- */
async function startServer(extraEnv = {}) {
  const dir = tmp('run'), data = path.join(dir, 'data'), usageDir = path.join(dir, 'usage');
  fs.mkdirSync(usageDir);
  const out = path.join(dir, 'wake-out.txt');
  const stub = path.join(dir, 'agent-stub.bat');
  fs.writeFileSync(stub, `@echo off\r\ncd > "${out}"\r\necho %* >> "${out}"\r\nping -n 4 127.0.0.1 >nul\r\nexit\r\n`);
  const env = { ...process.env, AIGILE_PORT: String(PORT), AIGILE_DATA: data, AIGILE_AGENT_COMMAND: stub, AIGILE_USAGE_DIR: usageDir, ...extraEnv };
  delete env.AIGILE_DEV; delete env.AIGILE_ALLOW_DONE; delete env.AIGILE_AS;
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: 'ignore', cwd: ROOT });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/meta')).ok) break; } catch {}
    await sleep(100);
  }
  const api = async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  };
  const ok = async (method, url, body) => { const r = await api(method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.body)}`); return r.body; };
  const cli = (args, extraEnv = {}) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'aigile.js'), ...args], { env: { ...env, AIGILE_URL: BASE, ...extraEnv }, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
  };
  const stop = () => { try { proc.kill(); } catch {} };
  return { dir, data, usageDir, wakeOut: out, api, ok, cli, stop, proc };
}

// Seed helpers (through the API).
const mkProject = (s, name, key, extra = {}) => s.ok('POST', '/api/projects', { name, key, ...extra });
const mkCard = (s, slug, title, extra = {}) => s.ok('POST', `/api/projects/${slug}/cards`, { title, ...extra });
const getCard = async (s, slug, id) => (await s.ok('GET', `/api/projects/${slug}`)).cards.find(c => c.id === id);
const say = (s, slug, id, author, text, extra = {}) => s.ok('POST', `/api/projects/${slug}/cards/${id}/comments`, { author, text, ...extra });

// A browser page that records page errors.
async function openPage(ctx, hash) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  await page.goto(BASE + '/' + (hash || ''));
  await page.waitForSelector('#app > *', { timeout: 8000 });
  return page;
}
const noErrors = page => check('no page errors', page.errors.length === 0, page.errors);

/* ---------- areas ---------- */
const areas = {};
const def = (name, doc, fn, needsBrowser = false, env = {}) => { areas[name] = { doc, fn, needsBrowser, env }; };

def('api', 'projects/cards CRUD, comment/verdict/taskdone/poke, updates feed, inbox', async s => {
  const p = await mkProject(s, 'Alpha', 'ALP');
  check('project created with slug and key', p.slug === 'alpha' && p.key === 'ALP', p);
  check('duplicate project is 409', (await s.api('POST', '/api/projects', { name: 'Alpha' })).status === 409);
  check('project list has it', (await s.ok('GET', '/api/projects')).some(x => x.slug === 'alpha'));
  await s.ok('PATCH', '/api/projects/alpha', { description: 'desc' });
  check('project patched', (await s.ok('GET', '/api/projects/alpha')).description === 'desc');
  check('unknown project is 404', (await s.api('GET', '/api/projects/nope')).status === 404);

  const c1 = await mkCard(s, 'alpha', 'First', { status: 'doing', assignee: 'Forge' });
  check('card id uses the key', c1.id === 'ALP-1', c1.id);
  check('card needs a title', (await s.api('POST', '/api/projects/alpha/cards', {})).status === 400);
  check('bad status rejected', (await s.api('PATCH', '/api/projects/alpha/cards/ALP-1', { status: 'zzz' })).status === 400);
  const up = await s.ok('PATCH', '/api/projects/alpha/cards/ALP-1', { priority: 'high', sprint: 'S1' });
  check('card patched', up.priority === 'high' && up.sprint === 'S1');

  const cm = await say(s, 'alpha', 'ALP-1', 'Rich', 'hello team');
  check('Rich comment moves card to team', cm.status === 'team' && cm.prevStatus === 'doing', [cm.status, cm.prevStatus]);
  const bot = await say(s, 'alpha', 'ALP-1', 'Forge', 'a question', { needsYou: true });
  check('team question flags needsYou', bot.needsYou === true);

  const c2 = await mkCard(s, 'alpha', 'Second', { status: 'doing', assignee: 'Forge' });
  await s.ok('PATCH', `/api/projects/alpha/cards/${c2.id}`, { status: 'verify', testSteps: 'click it' });
  const acc = await s.ok('POST', `/api/projects/alpha/cards/${c2.id}/verdict`, { accept: true });
  check('verdict accept -> done', acc.status === 'done' && acc.comments.at(-1).verdict === 'accept');
  const c3 = await mkCard(s, 'alpha', 'Third', { status: 'verify' });
  check('sendback needs text', (await s.api('POST', `/api/projects/alpha/cards/${c3.id}/verdict`, { accept: false })).status === 400);
  const sb = await s.ok('POST', `/api/projects/alpha/cards/${c3.id}/verdict`, { accept: false, text: 'broken' });
  check('sendback -> team', sb.status === 'team' && sb.prevStatus === 'verify');

  const c4 = await mkCard(s, 'alpha', 'Task card', { status: 'doing', assignee: 'Pixel' });
  await s.ok('PATCH', `/api/projects/alpha/cards/${c4.id}`, { assignee: 'Rich' });
  let inbox = await s.ok('GET', '/api/inbox');
  check('inbox has the question', inbox.some(c => c.id === 'ALP-1'));
  check('inbox has the task', inbox.some(c => c.id === c4.id));
  const c5 = await mkCard(s, 'alpha', 'To test', { status: 'verify', testSteps: 's' });
  inbox = await s.ok('GET', '/api/inbox');
  check('inbox has verify', inbox.some(c => c.id === c5.id));
  check('inbox carries project info', inbox[0].project === 'alpha' && inbox[0].projectName === 'Alpha');
  const sn = await s.ok('POST', `/api/projects/alpha/cards/${c5.id}/snooze`);
  check('snooze sets snoozedUntil about an hour ahead', sn.snoozedUntil && Math.abs(new Date(sn.snoozedUntil) - Date.now() - 3600e3) < 60e3, sn.snoozedUntil);
  inbox = await s.ok('GET', '/api/inbox');
  check('snoozed card is left out of the inbox', !inbox.some(c => c.id === c5.id));
  await s.ok('DELETE', `/api/projects/alpha/cards/${c5.id}/snooze`);
  inbox = await s.ok('GET', '/api/inbox');
  check('bring back clears it and the card is in the inbox again', inbox.some(c => c.id === c5.id) && !(await getCard(s, 'alpha', c5.id)).snoozedUntil);
  await s.ok('POST', `/api/projects/alpha/cards/${c5.id}/snooze`);
  await s.ok('POST', `/api/projects/alpha/cards/${c5.id}/verdict`, { accept: false, text: 'nope' });
  check('a verdict clears the snooze', !(await getCard(s, 'alpha', c5.id)).snoozedUntil);
  check('snooze outside verify is rejected', (await s.api('POST', `/api/projects/alpha/cards/${c5.id}/snooze`)).status === 400);
  await s.ok('PATCH', `/api/projects/alpha/cards/${c5.id}`, { status: 'verify' });
  const td = await s.ok('POST', `/api/projects/alpha/cards/${c4.id}/taskdone`, { text: 'did it' });
  check('taskdone hands back and goes to team', td.status === 'team' && td.assignee === 'Pixel' && /Done: did it/.test(td.comments.at(-1).text), [td.status, td.assignee]);
  const c6 = await mkCard(s, 'alpha', 'Stuck', { status: 'doing' });
  const pk = await s.ok('POST', `/api/projects/alpha/cards/${c6.id}/poke`);
  check('poke keeps status, adds poke comment', pk.status === 'doing' && pk.comments.at(-1).poke === true);

  // updates feed
  const peek = await s.ok('GET', '/api/projects/alpha/updates');
  check('updates lists Rich items', peek.cards.some(c => c.id === 'ALP-1') && peek.cards.some(c => c.id === c6.id && c.items[0].kind === 'poke'));
  check('accept alone is not news', !peek.cards.some(c => c.id === c2.id));
  check('peek does not mark', (await s.ok('GET', '/api/projects/alpha/updates')).cards.length === peek.cards.length);
  await s.ok('GET', '/api/projects/alpha/updates?mark=1');
  const after = await s.ok('GET', '/api/projects/alpha/updates');
  check('after mark nothing new', after.cards.length === 0, after.cards.length);
  check('forTeam still lists team cards', after.forTeam.some(c => c.id === 'ALP-1'));

  const del = await s.ok('DELETE', '/api/projects/alpha/cards/ALP-1');
  check('card deleted', del.deleted === 'ALP-1' && !(await getCard(s, 'alpha', 'ALP-1')));
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Forge', role: 'dev' });
  await s.ok('POST', '/api/projects/alpha/log', { author: 'Forge', text: 'did a thing', kind: 'decision' });
  const full = await s.ok('GET', '/api/projects/alpha');
  check('team and log stored', full.team[0].name === 'Forge' && full.log[0].kind === 'decision');
  check('meta lists statuses', (await s.ok('GET', '/api/meta')).statuses.length === 7);
  check('unknown endpoint is 404', (await s.api('GET', '/api/nope')).status === 404);
});

def('cli', 'next/test/task/brief, hooks, move done, onboard', async s => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = (...args) => s.cli(args);
  // next order: team > doing > bug in todo > rest of todo
  const n1 = await mkCard(s, 'alpha', 'Plain todo', { status: 'todo' });
  const b1 = await mkCard(s, 'alpha', 'Bug todo', { status: 'todo', type: 'bug' });
  const d1 = await mkCard(s, 'alpha', 'In progress', { status: 'doing' });
  const t1 = await mkCard(s, 'alpha', 'Rich said', { status: 'doing' });
  await say(s, 'alpha', t1.id, 'Rich', 'please look');
  const nx = a('next', 'alpha');
  const pos = id => nx.out.indexOf(id + ' ');
  check('next exits 0', nx.code === 0, nx.err);
  check('next order team, doing, bug, rest', pos(t1.id) > 0 && pos(t1.id) < pos(d1.id) && pos(d1.id) < pos(b1.id) && pos(b1.id) < pos(n1.id), nx.out);
  check('next marks the first with >>', /^ {2}>> ALP-4/m.test(nx.out), nx.out);

  const t = a('test', 'alpha', d1.id, 'steps to follow', '--as', 'Forge');
  check('test hands to Rich', t.code === 0 && /handed to Rich/.test(t.out), t);
  const cd = await getCard(s, 'alpha', d1.id);
  check('test sets verify + steps', cd.status === 'verify' && cd.testSteps === 'steps to follow');
  const k = a('task', 'alpha', n1.id, 'add the key', '--as', 'Forge');
  check('task goes to Rich', k.code === 0 && /task for Rich on ALP-1/.test(k.out), k);
  check('task card is assigned to Rich', (await getCard(s, 'alpha', n1.id)).assignee === 'Rich');
  const inb = a('inbox');
  check('cli inbox lists verify and task', inb.out.includes(d1.id) && inb.out.includes(n1.id), inb.out);
  const br = a('brief', 'alpha');
  check('brief has the digest', br.code === 0 && /^Alpha \(alpha\):/.test(br.out) && /Waiting on Rich/.test(br.out) && /For the team/.test(br.out), br.out);
  check('list/show work', a('list', 'alpha').out.includes('Bug todo') && a('show', 'alpha', b1.id).out.includes('Conversation (0)'));
  check('add via cli', /^added ALP-5/.test(a('add', 'alpha', 'cli card', '--type', 'bug', '--desc', 'd').out));
  check('edit via cli', /^updated/.test(a('edit', 'alpha', 'ALP-5', '--title', 'renamed').out));
  check('comment via cli', /commented on ALP-5/.test(a('comment', 'alpha', 'ALP-5', 'hi', '--as', 'Forge').out));
  check('ask via cli', /asked Rich/.test(a('ask', 'alpha', 'ALP-5', 'why?', '--as', 'Forge').out) && (await getCard(s, 'alpha', 'ALP-5')).needsYou === true);
  check('block/unblock', /^blocked/.test(a('block', 'alpha', 'ALP-5', '--as', 'Forge').out) && /^unblocked/.test(a('unblock', 'alpha', 'ALP-5').out));
  check('missing --as is an error', a('comment', 'alpha', 'ALP-5', 'x').code === 1);

  // hooks: fresh project so nothing is new
  await mkProject(s, 'Beta', 'BET');
  const bc = await mkCard(s, 'beta', 'B card', { status: 'doing' });
  const silent = a('updates', 'beta', '--hook');
  check('updates --hook is silent with nothing new', silent.code === 0 && silent.out === '' && silent.err === '', silent);
  const quiet = a('updates', 'beta');
  check('plain updates says nothing new', quiet.out === 'Nothing new from Rich.', quiet.out);
  await say(s, 'beta', bc.id, 'Rich', 'news!');
  const sh = a('updates', 'beta', '--stop-hook');
  let j = null; try { j = JSON.parse(sh.out); } catch {}
  check('--stop-hook prints block JSON', j && j.decision === 'block' && /news!/.test(j.reason), sh.out);
  check('--stop-hook silent once seen', a('updates', 'beta', '--stop-hook').out === '');
  await say(s, 'beta', bc.id, 'Rich', 'again');
  const hk = a('updates', 'beta', '--hook');
  check('--hook speaks when there is news', /AI-gile board \(beta\)/.test(hk.out) && /again/.test(hk.out), hk.out);

  // move done
  const m1 = await mkCard(s, 'beta', 'to close', { status: 'todo' });
  const refused = a('move', 'beta', m1.id, 'done');
  check('move done refused outside team', refused.code === 1 && /only Rich/.test(refused.err), refused);
  check('card was not moved', (await getCard(s, 'beta', m1.id)).status === 'todo');
  await say(s, 'beta', m1.id, 'Rich', 'fyi');
  const okd = a('move', 'beta', m1.id, 'done');
  check('move done allowed from team', okd.code === 0 && /moved/.test(okd.out), okd);
  check('card is done', (await getCard(s, 'beta', m1.id)).status === 'done');
  check('new-project via cli', /^created gamma/.test(a('new-project', 'Gamma', '--key', 'GAM').out));
  check('team via cli', /^team: Zed/.test(a('team', 'beta', 'Zed', '--role', 'qa').out));
  check('log via cli', /logged decision/.test(a('log', 'beta', 'chose x', '--decision', '--as', 'Forge').out));

  // onboard
  const local = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'aigile.local.json'), 'utf8')).agent || {}; } catch { return {}; } })();
  if (!local.notesFile || !local.settingsFile) { check('aigile.local.json has agent.notesFile/settingsFile (needed for onboard)', false); return; }
  const dir = path.join(tmp('onb'), 'proj');
  const o1 = a('onboard', 'beta', dir, '--create');
  check('onboard runs', o1.code === 0 && /connected beta/.test(o1.out), o1);
  const notes = path.join(dir, local.notesFile), sfile = path.join(dir, local.settingsFile);
  const count = () => (fs.readFileSync(notes, 'utf8').match(/<!-- AI-gile:start -->/g) || []).length;
  check('notes block written once', count() === 1);
  fs.mkdirSync(path.dirname(sfile), { recursive: true });
  fs.writeFileSync(sfile, JSON.stringify({ keep: 1, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } }));
  const o2 = a('onboard', 'beta', dir);
  check('onboard again runs', o2.code === 0, o2);
  check('notes block not duplicated', count() === 1);
  const st = JSON.parse(fs.readFileSync(sfile, 'utf8'));
  check('settings merged, own keys kept', st.keep === 1 && JSON.stringify(st.hooks.Stop).includes('echo mine'));
  check('hooks added once each', ['SessionStart', 'UserPromptSubmit', 'Stop'].every(ev => st.hooks[ev].filter(h => JSON.stringify(h).includes('aigile.js')).length === 1), st.hooks);
  check('team permissions added once, git push asks', st.permissions.allow.filter(x => x === 'Bash').length === 1 && st.permissions.ask.includes('Bash(git push:*)'), st.permissions);
  check('new folder got a git repo', fs.existsSync(path.join(dir, '.git')));
  check('project linked to folder', (await s.ok('GET', '/api/projects/beta')).path === dir.replace(/\\/g, '/'));
});

def('board', 'columns, drag between columns, + New default, Raise bug', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Draggable', { status: 'todo' });
  await mkCard(s, 'alpha', 'Other', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column');
  const heads = await page.$$eval('.column h3 > span:first-child', els => els.map(e => e.textContent));
  check('seven columns in order', JSON.stringify(heads) === JSON.stringify(['Backlog', 'To do', 'In progress', 'Team checking', 'For you', 'For the team', 'Done']), heads);
  check('cards render in their column', (await page.locator('.column[data-status=todo] .card').count()) === 1 && (await page.locator('.column[data-status=doing] .card').count()) === 1);
  await page.dragAndDrop('.card[data-id="ALP-1"]', '.column[data-status="review"]');
  await page.waitForTimeout(600);
  check('drag moves the card (server)', (await getCard(s, 'alpha', 'ALP-1')).status === 'review');
  const sv = await mkCard(s, 'alpha', 'Snoozed one', { status: 'verify' });
  await s.ok('POST', `/api/projects/alpha/cards/${sv.id}/snooze`);
  await page.waitForTimeout(1500);
  check('snoozed card shows back-at label and Bring back', /back at \d/.test(await page.textContent(`.card[data-id="${sv.id}"]`)) && (await page.locator(`.card[data-id="${sv.id}"] button:has-text("Bring back")`).count()) === 1);
  await page.click(`.card[data-id="${sv.id}"] button:has-text("Bring back")`);
  await page.waitForTimeout(1500);
  check('Bring back clears the label', !(await getCard(s, 'alpha', sv.id)).snoozedUntil && !/back at/.test(await page.textContent(`.card[data-id="${sv.id}"]`)));
  check('drag moves the card (page)', (await page.locator('.column[data-status=review] .card[data-id="ALP-1"]').count()) === 1);

  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #f-title');
  check('+ New defaults to For the team', (await page.inputValue('#f-status')) === 'team');
  await page.fill('#f-title', 'From the dialog');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await page.waitForTimeout(300);
  const made = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'From the dialog');
  check('created card is for the team, by Rich', made && made.status === 'team' && made.createdBy === 'Rich', made);
  check('new card shows in the team column', (await page.locator('.column[data-status=team] .card', { hasText: 'From the dialog' }).count()) === 1);

  await page.click('button.bug');
  await page.waitForSelector('#dialog #f-title');
  check('Raise bug presets', (await page.inputValue('#f-type')) === 'bug' && (await page.inputValue('#f-priority')) === 'high' && (await page.inputValue('#f-status')) === 'team');
  await page.fill('#f-title', 'It broke');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await page.waitForTimeout(300);
  const bug = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'It broke');
  check('bug raised', bug && bug.type === 'bug' && bug.priority === 'high' && bug.status === 'team', bug);

  await page.click('.column[data-status=backlog] .colbtn');
  await page.waitForSelector('#dialog #f-status');
  check('column + picks that column', (await page.inputValue('#f-status')) === 'backlog');
  await page.click('#dialog button[type=button]');
  await page.goto(BASE + '/#/');
  await page.waitForSelector('.proj');
  check('home lists the project', (await page.locator('.proj').count()) === 1);
  noErrors(page);
}, true);

def('card', 'tabs, reply survives polling, Enter sends, Accept, Wait and see, formatting', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const desc = 'Intro with **bold words** here\n\n- first point\n- second point\n\n```\nnpm run thing\n```\n';
  await mkCard(s, 'alpha', 'Verify me', { status: 'verify', testSteps: 'Step one', description: desc });
  await mkCard(s, 'alpha', 'Chatty', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', 'ALP-2', 'Forge', 'working on it');
  await mkCard(s, 'alpha', 'Verify two', { status: 'verify', testSteps: 'Step two' });
  await mkCard(s, 'alpha', 'Verify three', { status: 'verify', testSteps: 'Step three' });
  const page = await openPage(ctx, '#/p/alpha/ALP-1');
  await page.waitForSelector('#modal .panel');
  const tabs = await page.$$eval('#modal .ctab', els => els.map(e => e.dataset.ctab));
  check('verify card has Reply/Details/Test tabs', JSON.stringify(tabs) === JSON.stringify(['reply', 'details', 'test']), tabs);
  check('verify card opens on Test', (await page.getAttribute('#modal .ctab.on', 'data-ctab')) === 'test');
  await page.click('.ctab[data-ctab=details]');
  check('Details pane shown', await page.isVisible('.cpane[data-pane=details]') && !(await page.isVisible('.cpane[data-pane=test]')));
  check('bullet list renders', (await page.locator('.cpane[data-pane=details] ul.bl li').count()) === 2);
  check('bold renders', (await page.locator('.cpane[data-pane=details] .desc b').first().textContent()) === 'bold words');
  check('code box with Copy renders', (await page.locator('.cpane[data-pane=details] .codebox pre code').textContent()) === 'npm run thing' && (await page.locator('.codebox button.copy').count()) === 1);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('.codebox button.copy');
  await page.waitForTimeout(200);
  check('Copy button confirms', /Copied/.test(await page.textContent('.codebox button.copy')));
  await page.click('.ctab[data-ctab=reply]');
  await page.fill('#r-text', 'my unsent draft');
  await page.waitForTimeout(2500);
  check('reply text survives 2.5s of polling', (await page.inputValue('#r-text')) === 'my unsent draft');
  check('still the same tab after polling', (await page.getAttribute('#modal .ctab.on', 'data-ctab')) === 'reply');

  // Wait and see (verify card ALP-1): panel closes, card stays in verify
  const before = (await getCard(s, 'alpha', 'ALP-1')).updated;
  await page.click('.ctab[data-ctab=test]');
  await page.click('button[onclick="waitAndSee()"]');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  const w = await getCard(s, 'alpha', 'ALP-1');
  check('Wait and see closes panel, keeps verify, moves to back', w.status === 'verify' && w.updated >= before && !page.url().endsWith('ALP-1'), [w.status, page.url()]);

  // Enter sends (ALP-2)
  await page.goto(BASE + '/#/p/alpha/ALP-2');
  await page.waitForSelector('#r-text');
  await page.fill('#r-text', 'thanks, carry on');
  await page.press('#r-text', 'Enter');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  const c2 = await getCard(s, 'alpha', 'ALP-2');
  check('Enter sends and closes the panel', c2.comments.at(-1).text === 'thanks, carry on' && c2.comments.at(-1).author === 'Rich' && c2.status === 'team', [c2.status, c2.comments.at(-1)]);

  // Accept (ALP-3)
  await page.goto(BASE + '/#/p/alpha/ALP-3');
  await page.waitForSelector('#modal .panel');
  await page.click('button.good');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  check('Accept marks done and leaves the card', (await getCard(s, 'alpha', 'ALP-3')).status === 'done');

  // Send back needs a reason (ALP-4)
  await page.goto(BASE + '/#/p/alpha/ALP-4');
  await page.waitForSelector('#modal .panel');
  await page.click('button.warn');
  check('Send back without a reason shows an error', /Say what is wrong/.test(await page.textContent('#v-err')));
  await page.fill('#v-text', 'nope');
  await page.click('button.warn');
  await sleep(700);   // the panel closes, or opens the next For you card (AIG-141)
  check('Send back moves to team', (await getCard(s, 'alpha', 'ALP-4')).status === 'team');

  // Edit
  await page.goto(BASE + '/#/p/alpha/ALP-2');
  await page.waitForSelector('#modal .panel');
  await page.click('button[onclick="editCard()"]');
  await page.fill('#f-title', 'Chatty renamed');
  await page.click('form button[type=submit]');
  await page.waitForTimeout(500);
  check('edit saves the title', (await getCard(s, 'alpha', 'ALP-2')).title === 'Chatty renamed');
  noErrors(page);
}, true);

def('filters', 'search survives polling, type filter, clear', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Zebra feature', { status: 'todo' });
  await mkCard(s, 'alpha', 'Zebra bug', { status: 'todo', type: 'bug' });
  await mkCard(s, 'alpha', 'Plain thing', { status: 'doing', assignee: 'Forge' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#f-q');
  const cards = () => page.locator('.board .card').count();
  check('all cards shown at first', (await cards()) === 3);
  await page.fill('#f-q', 'zebra');
  check('search narrows the board', (await cards()) === 2);
  await page.waitForTimeout(2500);
  check('search text survives polling', (await page.inputValue('#f-q')) === 'zebra' && (await cards()) === 2);
  check('count line shown', /Showing\s*2\s*of 3/.test(await page.textContent('#f-count')), await page.textContent('#f-count'));
  await page.selectOption('select[data-f=type]', 'bug');
  check('type filter narrows further', (await cards()) === 1 && (await page.locator('.board .card', { hasText: 'Zebra bug' }).count()) === 1);
  await page.click('#f-count a');
  check('clear resets everything', (await cards()) === 3 && (await page.inputValue('#f-q')) === '' && (await page.inputValue('select[data-f=type]')) === '');
  await page.selectOption('select[data-f=who]', 'Forge');
  check('assignee filter', (await cards()) === 1);
  noErrors(page);
}, true);

def('inbox', 'top-bar counts, project tabs, inline answer, task Done', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Alpha question', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', 'ALP-1', 'Forge', 'which colour?', { needsYou: true });
  await mkCard(s, 'alpha', 'Alpha task', { status: 'doing', assignee: 'Pixel' });
  await s.ok('PATCH', '/api/projects/alpha/cards/ALP-2', { assignee: 'Rich' });
  await say(s, 'alpha', 'ALP-2', 'Pixel', 'please add the key');
  await mkCard(s, 'alpha', 'Alpha test', { status: 'verify', testSteps: 'try it' });
  await mkCard(s, 'beta', 'Beta question', { status: 'doing' });
  await say(s, 'beta', 'BET-1', 'Forge', 'beta ask?', { needsYou: true });
  const page = await openPage(ctx, '#/p/beta');
  await page.waitForSelector('#inboxTop .ib-btn');
  const top = await page.textContent('#inboxTop .ib-btn');
  check('top bar shows 2 questions', /2 questions/.test(top), top);
  check('top bar shows 1 to do', /1 to do/.test(top), top);
  check('top bar shows 1 to test', /1 to test/.test(top), top);
  await page.click('#inboxTop .ib-btn');
  await page.waitForSelector('#ibTabs button');
  const order = () => page.$$eval('#ibTabs button', els => els.map(e => e.dataset.tab));
  check('opened from beta: beta first, All last', JSON.stringify(await order()) === JSON.stringify(['beta', 'alpha', 'all']), await order());
  check('beta tab selected', (await page.getAttribute('#ibTabs .on', 'data-tab')) === 'beta');
  await page.waitForTimeout(2500);
  check('tabs stay put after polling', JSON.stringify(await order()) === JSON.stringify(['beta', 'alpha', 'all']) && (await page.getAttribute('#ibTabs .on', 'data-tab')) === 'beta');
  await page.click('#ibTabs button[data-tab=alpha]');
  check('alpha tab shows its three items', (await page.locator('.ib-item').count()) === 3);

  const q = page.locator('.ib-item.q[data-id="ALP-1"] textarea');
  await q.fill('blue please');
  await page.waitForTimeout(2300);
  check('answer text survives polling', (await q.inputValue()) === 'blue please');
  await q.press('Enter');
  await page.waitForSelector('.ib-item.q[data-id="ALP-1"]', { state: 'detached' });
  const c1 = await getCard(s, 'alpha', 'ALP-1');
  check('inline answer sent to the team', c1.comments.at(-1).text === 'blue please' && c1.status === 'team' && !c1.needsYou, [c1.status, c1.needsYou]);

  await page.click('.ib-item.k[data-id="ALP-2"] button[data-act=taskdone]');
  await page.waitForSelector('.ib-item.k[data-id="ALP-2"]', { state: 'detached' });
  const c2 = await getCard(s, 'alpha', 'ALP-2');
  check('task Done tells the team', c2.status === 'team' && c2.assignee === 'Pixel' && /Done/.test(c2.comments.at(-1).text), [c2.status, c2.assignee]);

  await page.click('.ib-item.t[data-id="ALP-3"] button[data-act=accept]');
  await page.waitForSelector('.ib-item.t[data-id="ALP-3"]', { state: 'detached' });
  check('Accept from the inbox', (await getCard(s, 'alpha', 'ALP-3')).status === 'done');
  await page.waitForTimeout(1500);
  const top2 = await page.textContent('#inboxTop .ib-btn');
  check('top bar counts update', /1 question\b/.test(top2) && !/to do/.test(top2) && !/to test/.test(top2), top2);
  noErrors(page);
}, true);

def('usage', '#/usage renders with and without limits.log', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/usage');
  await page.waitForTimeout(800);
  const t1 = await page.textContent('#app');
  check('usage page renders (no limits.log)', /usage/i.test(t1) && t1.trim().length > 40, t1.slice(0, 120));
  check('limits.log absent', !fs.existsSync(path.join(s.data, 'limits.log')));
  noErrors(page);
  const soon = Math.floor(Date.now() / 1000) + 3600;
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 12, resets_at: soon }, seven_day: { used_percentage: 30, resets_at: soon + 86400 } } });
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 20, resets_at: soon }, seven_day: { used_percentage: 33, resets_at: soon + 86400 } } });
  check('limits.log written', fs.existsSync(path.join(s.data, 'limits.log')));
  check('bad limits payload is 400', (await s.api('POST', '/api/limits', { rate_limits: {} })).status === 400);
  const lim = await s.ok('GET', '/api/limits?days=30');
  check('limits api returns history', lim.history.length === 2 && lim.latest.h5.pct === 20);
  const page2 = await openPage(ctx, '#/usage');
  await page2.waitForSelector('svg', { timeout: 5000 }).catch(() => {});
  await page2.waitForTimeout(500);
  const t2 = await page2.textContent('#app');
  check('usage page renders with limits.log', /20\s*%/.test(t2) || (await page2.locator('svg').count()) > 0, t2.slice(0, 160));
  noErrors(page2);
  await page2.goto(BASE + '/#/');
  await page2.waitForSelector('.proj');
  noErrors(page2);
}, true);

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
  await page.waitForSelector('html[data-night]', { timeout: 4000 }).catch(() => {});
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
  check('home tile says why, with a Wake button', /Needs a poke/.test(await page.textContent('.proj.poke')) && !!(await page.$('.proj.poke button.primary')));
  await page.click('#pokeTop .pokebadge');
  await new Promise(r => setTimeout(r, 1500));
  check('tapping the badge wakes the asleep team', /started/.test((await s.ok('GET', '/api/projects/sleepy/agentlog')).text));
  await s.ok('GET', '/api/projects/sleepy/updates');
  check('online clears it', (await s.ok('GET', '/api/projects/sleepy')).cards && (await s.ok('GET', '/api/projects')).find(p => p.slug === 'sleepy').attention === null);
  const { attention } = require('../../lib/store.js');
  const old = new Date(Date.now() - 11 * 60e3).toISOString(), fresh = new Date().toISOString();
  const proj = at => ({ cards: [{ status: 'team', createdBy: '', created: old, updated: old, comments: [{ author: 'Rich', text: 'x', at }] }] });
  check('online, comment unanswered 10+ min = stuck', attention(proj(old), { online: true })?.kind === 'stuck');
  check('online, fresh comment = fine', attention(proj(fresh), { online: true }) === null);
  noErrors(page);
}, true);

def('blocked', 'a blocked card shows in the inbox with the reason; his answer clears it', async (s, ctx) => {
  await mkProject(s, 'Gamma', 'GAM');
  await mkCard(s, 'gamma', 'Stuck card', { status: 'doing', assignee: 'Forge' });
  await say(s, 'gamma', 'GAM-1', 'Forge', 'Blocked: need the API key');
  await s.ok('PATCH', '/api/projects/gamma/cards/GAM-1', { blocked: true });
  check('blocked card is in the inbox (api)', (await s.ok('GET', '/api/inbox')).some(c => c.id === 'GAM-1'));
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-item.blk', { timeout: 7000 }).catch(() => {});
  const t = await page.textContent('.ib-item.blk').catch(() => '');
  check('inbox shows it as Blocked with the reason', /Blocked/.test(t) && /need the API key/.test(t), t);
  await say(s, 'gamma', 'GAM-1', 'Rich', 'key is in the vault');
  check('Rich answering clears the block', (await s.ok('GET', '/api/projects/gamma')).cards[0].blocked === false);
  check('and it leaves the inbox', !(await s.ok('GET', '/api/inbox')).some(c => c.id === 'GAM-1'));
  noErrors(page);
}, true);

def('docs', 'Docs dialog lists .md files and opens one', async (s, ctx) => {
  const folder = tmp('docs');
  fs.mkdirSync(path.join(folder, 'docs'));
  fs.writeFileSync(path.join(folder, 'README.md'), '# Hello docs\n\nSome **bold** text.\n\n- a\n- b\n');
  fs.writeFileSync(path.join(folder, 'docs', 'guide.md'), '# Guide\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
  fs.writeFileSync(path.join(folder, 'notes.txt'), 'not markdown');
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  check('docs api lists md files', JSON.stringify(await s.ok('GET', '/api/projects/alpha/docs')) === JSON.stringify(['README.md', 'docs/guide.md']));
  check('docs api refuses other files', (await s.api('GET', '/api/projects/alpha/docs/notes.txt')).status === 404);
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button[onclick="openDocs()"]');
  await page.waitForSelector('.doclist button');
  const names = await page.$$eval('.doclist button', els => els.map(e => e.textContent));
  check('dialog lists the files', JSON.stringify(names) === JSON.stringify(['README.md', 'docs/guide.md']), names);
  await page.click('.doclist button:first-child');
  await page.waitForSelector('.md h1');
  check('opens a doc, rendered', (await page.textContent('.md h1')) === 'Hello docs' && (await page.locator('.md li').count()) === 2 && (await page.textContent('.md b')) === 'bold');
  await page.click('#dialog button:has-text("Docs")');
  await page.waitForSelector('.doclist button');
  await page.click('.doclist button:nth-child(2)');
  await page.waitForSelector('.md table');
  check('table renders', (await page.locator('.md td').count()) === 2);
  await page.keyboard.press('Escape');
  check('Escape closes the dialog', (await page.locator('#dialog .dialog').count()) === 0);
  noErrors(page);
}, true);

def('mdlinks', 'Any .md path in card text opens in the board', async (s, ctx) => {
  const root = tmp('mdlinks'), folder = path.join(root, 'Proj Folder');
  fs.mkdirSync(path.join(folder, 'protocol'), { recursive: true });
  fs.mkdirSync(path.join(folder, 'docs', 'addons'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'protocol', 'X.md'), '# Protocol X\n');
  fs.writeFileSync(path.join(folder, 'docs', 'addons', 'deep.md'), '# Deep one\n');
  fs.writeFileSync(path.join(folder, 'notes.txt'), 'plain');
  fs.writeFileSync(path.join(root, 'outside.md'), '# Outside\n');
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  const get = q => s.api('GET', '/api/projects/alpha/file?path=' + encodeURIComponent(q));
  const abs = path.join(folder, 'docs', 'addons', 'deep.md');
  const ok = async (label, q, name) => { const r = await get(q); check('route: ' + label, r.status === 200 && r.body.name === name && r.body.text.startsWith('#'), r.status + ' ' + JSON.stringify(r.body)); };
  await ok('relative', 'protocol/X.md', 'protocol/X.md');
  await ok('deeper', 'docs/addons/deep.md', 'docs/addons/deep.md');
  await ok('absolute', abs, 'docs/addons/deep.md');
  await ok('backslashes', 'docs\\addons\\deep.md', 'docs/addons/deep.md');
  await ok('absolute with backslashes', abs.replace(/\//g, '\\'), 'docs/addons/deep.md');
  await ok('project folder prefix', 'Proj Folder/protocol/X.md', 'protocol/X.md');
  await ok('half of a spaced folder name (AIG-85)', 'Folder\\protocol\\X.md', 'protocol/X.md');
  check('route: ../ escape refused', [400, 404].includes((await get('../outside.md')).status));
  check('route: absolute outside refused', [400, 404].includes((await get(path.join(root, 'outside.md'))).status));
  check('route: non-.md refused', (await get('notes.txt')).status === 400);
  check('route: missing is 404', (await get('protocol/none.md')).status === 404);
  // A card can mention another project's file (AIG-85): found there, and the name says where.
  const other = path.join(tmp('mdlinks2'), 'Migration to dual OS setup');
  fs.mkdirSync(path.join(other, 'audit'), { recursive: true });
  fs.writeFileSync(path.join(other, 'audit', 'INVENTORY.md'), '# Inventory\n');
  await mkProject(s, 'Migration', 'MIG', { path: other });
  const cross = await get('setup\\audit\\INVENTORY.md');
  check('route: file from another project', cross.status === 200 && cross.body.name === 'Migration: audit/INVENTORY.md' && cross.body.project === 'migration', cross.body);
  const c = await mkCard(s, 'alpha', 'Links', { description: 'See protocol/X.md for the rules.\n\n```\n' + abs + '\n```\n\nAlso `' + abs + '`' });
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('.desc a[data-p="protocol/X.md"]');
  await page.click('.desc a[data-p="protocol/X.md"]');
  await page.waitForSelector('.md h1');
  check('bare path opens the file', (await page.textContent('.md h1')) === 'Protocol X' && (await page.textContent('#dialog .doctitle')) === 'protocol/X.md');
  await page.keyboard.press('Escape');
  await page.click('.codebox button.open');
  await page.waitForSelector('.md h1');
  check('code block Open button opens the file', (await page.textContent('.md h1')) === 'Deep one');
  await page.keyboard.press('Escape');
  await page.click('code a[data-p]');
  await page.waitForSelector('.md h1');
  check('inline code path opens the file', (await page.textContent('.md h1')) === 'Deep one');
  await page.keyboard.press('Escape');
  noErrors(page);
}, true);

def('newproject', 'New project suggests a folder, sets it up and wakes the team fresh', async (s, ctx) => {
  const folder = path.join(tmp('newproj'), 'Fresh One');
  const page = await openPage(ctx, '#/');
  await page.click('button:has-text("+ New project")');
  await page.fill('#p-name', 'Fresh One');
  check('folder suggested from the name', /[\\/]Fresh One$/.test(await page.inputValue('#p-path')), await page.inputValue('#p-path'));
  await page.fill('#p-path', folder);
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#p-done li', { timeout: 5000 }).catch(() => {});
  const done = await page.textContent('#p-done').catch(() => '');
  check('dialog lists every step', ['Created the project', 'Created the folder', 'permissions', 'git repo', 'Woke the team'].every(x => done.includes(x)), done);
  const local = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'aigile.local.json'), 'utf8')).agent || {}; } catch { return {}; } })();
  const st = JSON.parse(fs.readFileSync(path.join(folder, local.settingsFile), 'utf8'));
  check('settings have hooks and permissions', !!st.hooks.Stop && st.permissions.allow.includes('Bash') && st.permissions.ask.includes('Bash(git push:*)'), st);
  check('folder has a git repo', fs.existsSync(path.join(folder, '.git')));
  let out = '';
  for (let i = 0; i < 40 && !out.includes('new project'); i++) { await sleep(250); try { out = fs.readFileSync(s.wakeOut, 'utf8'); } catch {} }
  check('team woken fresh (no --continue)', /new project \(fresh-one\)/.test(out) && !/--continue/.test(out), out);
  await page.click('#p-acts button');
  await page.waitForFunction(() => location.hash === '#/p/fresh-one');
  check('Open project goes to the board', true);
  noErrors(page);
}, true);

def('perms', '🔐 Permissions: ticks follow the rules, save keeps hooks, new folders get the defaults', async (s, ctx) => {
  const local = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'aigile.local.json'), 'utf8')).agent || {}; } catch { return {}; } })();
  const folder = path.join(tmp('perms'), 'proj');
  await mkProject(s, 'Alpha', 'ALP');
  check('no folder: refused', (await s.api('GET', '/api/projects/alpha/permissions')).status === 400);
  await s.ok('POST', '/api/projects/alpha/connect', { path: folder, create: true });
  const sfile = path.join(folder, local.settingsFile);
  const r = await s.ok('GET', '/api/projects/alpha/permissions');
  const ways = r.presets.ways.rules.allow[0];
  check('new folder gets run, edit, push-asks and ways', ['Bash', 'Edit', ways].every(x => r.allow.includes(x)) && r.ask.includes('Bash(git push:*)') && !r.allow.includes('WebFetch'), r);
  check('ways rule is an absolute read of the AI-gile folder', /^Read\(\/\/[a-z]\/.*AI-gile\/\*\*\)$/.test(ways), ways);
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("Permissions")');
  await page.waitForSelector('#perm-ticks input');
  const ticked = async k => page.isChecked(`#perm-ticks input[data-k="${k}"]`);
  check('ticks match the file', (await ticked('run')) && (await ticked('ways')) && !(await ticked('web')));
  await page.check('#perm-ticks input[data-k="web"]');
  check('ticking adds the rules', (await page.inputValue('#perm-allow')).includes('WebFetch'));
  await page.uncheck('#perm-ticks input[data-k="run"]');
  check('unticking removes them', !(await page.inputValue('#perm-allow')).split('\n').includes('Bash'));
  await page.fill('#perm-deny', 'Bash(rm -rf:*)');
  await page.click('#dialog button:has-text("Save")');
  await page.waitForSelector('#perm-done:has-text("Saved")');
  const st = JSON.parse(fs.readFileSync(sfile, 'utf8'));
  check('saved to the file', st.permissions.allow.includes('WebFetch') && !st.permissions.allow.includes('Bash') && st.permissions.deny[0] === 'Bash(rm -rf:*)', st.permissions);
  check('hooks kept', !!st.hooks && !!st.hooks.Stop);
  await page.fill('#perm-deny', '');
  await page.click('#dialog button:has-text("Save")');
  await sleep(300);
  check('empty list removed from the file', !('deny' in JSON.parse(fs.readFileSync(sfile, 'utf8')).permissions));
  noErrors(page);
}, true);

def('gobutton', '👍 Go answers a question in one tap, in the inbox and on the card', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const q1 = await mkCard(s, 'alpha', 'First question'), q2 = await mkCard(s, 'alpha', 'Second question'), b = await mkCard(s, 'alpha', 'Stuck');
  for (const c of [q1, q2]) s.cli(['ask', 'alpha', c.id, 'Go?', '--as', 'Lead']);
  s.cli(['block', 'alpha', b.id, 'no key', '--as', 'Lead']);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${q1.id}"] button[data-act="go"]`);
  check('title counts everything waiting (desktop badge)', (await page.title()) === '(3) AI-gile', await page.title());
  check('blocked card has no Go', (await page.locator(`.ib-item[data-id="${b.id}"] button[data-act="go"]`).count()) === 0);
  await page.click(`.ib-item[data-id="${q1.id}"] button[data-act="go"]`);
  await page.waitForSelector(`.ib-item[data-id="${q1.id}"]`, { state: 'detached', timeout: 4000 }).catch(() => {});
  let c = await getCard(s, 'alpha', q1.id);
  check('inbox Go sends GO and clears the question', c.comments.at(-1).author === 'Rich' && c.comments.at(-1).text === 'GO' && !c.needsYou && c.status === 'team', c);
  await page.goto(BASE + '/#/p/alpha/' + q2.id);
  await page.click('.reply button:has-text("Go")');
  await sleep(500);
  c = await getCard(s, 'alpha', q2.id);
  check('card Go sends GO', c.comments.at(-1).text === 'GO' && !c.needsYou, c);
  await page.goto(BASE + '/#/p/alpha/' + q1.id);
  await page.waitForSelector('.reply');
  check('no Go once answered', (await page.locator('.reply button:has-text("Go")').count()) === 0);
  noErrors(page);
}, true);

def('attach', 'paste or attach files in replies; thumbnails; teams get the paths', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmgACZgYAAAKfEC/tW5j8QAAAAASUVORK5CYII=';
  const c1 = await mkCard(s, 'alpha', 'Paste here'), c2 = await mkCard(s, 'alpha', 'Inbox one');
  check('empty upload refused', (await s.api('POST', '/api/projects/alpha/attachments', { name: 'x.png', data: '' })).status === 400);
  check('unknown attachment is 404', (await s.api('GET', '/api/projects/alpha/attachments/zz-none.png')).status === 404);
  check('path escape refused', [400, 404].includes((await fetch(BASE + '/api/projects/alpha/attachments/..%2F..%2Falpha.json')).status));

  // Card: paste a screenshot, send with no text.
  const page = await openPage(ctx, '#/p/alpha/' + c1.id);
  await page.click('[data-ctab="reply"]');
  await page.waitForSelector('#r-text');
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    const ta = document.getElementById('r-text'); ta.focus();
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.waitForSelector('.reply .att-chip');
  check('pasted screenshot shows as a chip', /screenshot-.*\.png/.test(await page.textContent('.reply .att-chip')));
  await sleep(1500);
  check('chip survives the poll', (await page.locator('.reply .att-chip').count()) === 1);
  await page.click('.reply button:has-text("Send reply")');
  await sleep(600);
  let c = await getCard(s, 'alpha', c1.id);
  const att = (c.comments.at(-1).attachments || [])[0] || {};
  check('comment has the attachment with a full path', /screenshot-.*\.png$/.test(att.name || '') && fs.existsSync(att.path || '-') && att.size > 0, c.comments.at(-1));
  const r = await fetch(BASE + '/api/projects/alpha/attachments/' + encodeURIComponent(att.id));
  check('file served as an image', r.ok && r.headers.get('content-type') === 'image/png');
  await page.goto(BASE + '/#/p/alpha/' + c1.id);
  await page.waitForSelector('.att-shown img');
  await page.waitForFunction(() => document.querySelector('.att-shown img').naturalWidth > 0, null, { timeout: 4000 }).catch(() => {});
  check('thumbnail shows in the comment', await page.evaluate(() => document.querySelector('.att-shown img').naturalWidth > 0));
  const sh = s.cli(['show', 'alpha', c1.id]);
  check('show prints the path', sh.out.includes('📎 ' + att.name + ': ' + att.path), sh.out);
  const up = s.cli(['updates', 'alpha']);
  check('updates prints the path', up.out.includes(att.path), up.out);

  // Inbox: attach a file with the picker alongside text.
  s.cli(['ask', 'alpha', c2.id, 'Logs?', '--as', 'Lead']);
  await page.goto(BASE + '/#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${c2.id}"] input[type=file]`, { state: 'attached' });
  await page.setInputFiles(`.ib-item[data-id="${c2.id}"] input[type=file]`, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.fill(`.ib-item[data-id="${c2.id}"] textarea`, 'here you go');
  await page.click(`.ib-item[data-id="${c2.id}"] button[data-act="send"]`);
  await sleep(800);
  c = await getCard(s, 'alpha', c2.id);
  const last = c.comments.at(-1);
  check('inbox reply carries text and file', last.text === 'here you go' && last.attachments && last.attachments[0].name === 'notes.txt', last);

  // Your call: send back with only a screenshot (it counts as the reason).
  const c3 = await mkCard(s, 'alpha', 'To test');
  s.cli(['test', 'alpha', c3.id, '1. look', '--as', 'Lead']);
  await page.goto(BASE + '/#/p/alpha/' + c3.id);
  await page.waitForSelector('.verdict input[type=file]', { state: 'attached' });
  await page.setInputFiles('.verdict input[type=file]', { name: 'bug.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await page.click('.verdict button:has-text("Send back")');
  await sleep(800);
  c = await getCard(s, 'alpha', c3.id);
  check('send back with a screenshot only', c.status === 'team' && c.comments.at(-1).verdict === 'sendback' && c.comments.at(-1).attachments[0].name === 'bug.png', c.comments.at(-1));

  // Inbox task: Done with a file.
  const c4 = await mkCard(s, 'alpha', 'Do a thing');
  s.cli(['task', 'alpha', c4.id, 'run it', '--as', 'Lead']);
  await page.goto(BASE + '/#/inbox');
  await page.waitForSelector(`.ib-item[data-id="${c4.id}"] input[type=file]`, { state: 'attached' });
  await page.setInputFiles(`.ib-item[data-id="${c4.id}"] input[type=file]`, { name: 'out.txt', mimeType: 'text/plain', buffer: Buffer.from('ok') });
  await page.click(`.ib-item[data-id="${c4.id}"] button[data-act="taskdone"]`);
  await sleep(800);
  c = await getCard(s, 'alpha', c4.id);
  check('task Done carries the file', /^✅ Done/.test(c.comments.at(-1).text) && c.comments.at(-1).attachments[0].name === 'out.txt', c.comments.at(-1));

  // Raise bug with a pasted screenshot (AIG-80).
  await page.goto(BASE + '/#/p/alpha');
  await page.click('button:has-text("Raise bug")');
  await page.fill('#dialog input[type=text]', 'Broken thing');
  check('Raise bug is roomy on a big screen (AIG-89)', await page.$eval('#dialog .dialog', d => d.offsetWidth >= 900) && await page.$eval('#f-description', d => d.offsetHeight >= 300));
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    document.querySelector('#dialog input[type=text]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.waitForSelector('#dialog .att-chip');
  // AIG-129: the pasted screenshot shows as a thumbnail; clicking it previews it; Escape closes only the preview.
  await page.click('#dialog .att-thumb');
  await page.waitForSelector('.att-lightbox img');
  check('thumbnail opens a full-size preview', await page.$eval('.att-lightbox img', i => i.naturalWidth > 0));
  await page.keyboard.press('Escape');
  check('Escape closes the preview, not the dialog', (await page.locator('.att-lightbox').count()) === 0 && (await page.locator('#dialog .dialog').count()) === 1);
  // A second paste and two picked files add to the list (AIG-82).
  await page.evaluate(b64 => {
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    document.querySelector('#dialog textarea').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG);
  await page.setInputFiles('#dialog input[type=file]', [{ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }, { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }]);
  check('four attachments pending', (await page.locator('#dialog .att-chip').count()) === 4, await page.locator('#dialog .att-chip').count());
  await page.click('#dialog button[type=submit]');
  await sleep(800);
  const bug = (await s.ok('GET', '/api/projects/alpha')).cards.find(x => x.title === 'Broken thing');
  check('raised bug has all four', bug && bug.attachments && bug.attachments.length === 4 && /screenshot-.*.png$/.test(bug.attachments[0].name), bug);
  check('show prints the bug screenshot path', s.cli(['show', 'alpha', bug.id]).out.includes(bug.attachments[0].path));
  await page.goto(BASE + '/#/p/alpha/' + bug.id);
  await page.click('[data-ctab="details"]');
  await page.waitForSelector('[data-pane="details"] .att-shown img');
  check('all four show under the description', (await page.locator('[data-pane="details"] .att-shown img').count()) === 4);
  noErrors(page);
}, true);

def('refresh', 'a new build shows a 🆕 Refresh pill above an open card; it asks before losing an unsent reply', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Typing here');
  let build = 'one';
  const page = await ctx.newPage();
  await page.route('**/api/meta', async r => { try { const res = await r.fetch(); await r.fulfill({ response: res, json: { ...(await res.json()), dev: true, build } }); } catch {} });
  await page.goto(BASE + '/#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  await page.fill('#r-text', 'half a sentence');
  build = 'two';
  await page.waitForSelector('#updateTop button', { timeout: 8000 });
  check('Refresh pill shows, no pop-up', (await page.textContent('#updateTop')).includes('Refresh') && (await page.locator('.overlay.center').count()) === 0);
  check('typing untouched', (await page.inputValue('#r-text')) === 'half a sentence');
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.click('#updateTop button');
  await sleep(300);
  check('asks before losing the reply, and stays when cancelled', /unsent reply/.test(asked) && (await page.inputValue('#r-text')) === 'half a sentence', asked);
  await page.fill('#r-text', '');
  await Promise.all([page.waitForEvent('load'), page.click('#upRefresh button')]);
  check('reloads straight away with nothing unsent', true);
  // Desktop app: its Restart pill replaces Refresh, since a restart reloads too (AIG-83, AIG-130), and asks first.
  await page.waitForSelector('#r-text').catch(() => page.click('[data-ctab="reply"]'));
  await page.fill('#r-text', 'another half');
  build = 'three';
  await page.waitForSelector('#upRefresh button', { timeout: 8000 });
  await page.evaluate(() => window.showRestartApp());
  check('Restart app shows and Refresh hides', (await page.textContent('#upRestart')).includes('Restart app') && !(await page.isVisible('#upRefresh button')));
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.click('#upRestart button');
  await sleep(300);
  check('Restart asks before losing the reply', /Restart anyway/.test(asked) && (await page.inputValue('#r-text')) === 'another half', asked);
}, true);

def('look', 'each project has a colour and emoji: inbox badge and stripe, tabs, home, 🎨 Look dialog', async (s, ctx) => {
  await mkProject(s, 'Tunio', 'TUN'); await mkProject(s, 'LocoRadio', 'LOC');
  const a = await mkCard(s, 'tunio', 'Music q'), b = await mkCard(s, 'locoradio', 'Radio q');
  s.cli(['ask', 'tunio', a.id, 'Go?', '--as', 'Lead']); s.cli(['ask', 'locoradio', b.id, 'Go?', '--as', 'Lead']);
  const sum = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('summary has an automatic colour and emoji', /^#[0-9a-f]{6}$/i.test(sum.color) && sum.emoji === '🎵', sum);
  const ib = await s.ok('GET', '/api/inbox');
  check('inbox items carry the look', ib.every(c => c.projectColor && c.projectEmoji));
  const page = await openPage(ctx, '#/inbox');
  // Messages (AIG-87): one chat per project, newest first; picking a chat shows its questions.
  await page.waitForSelector('#ibChats button[data-chat]');
  const chats = await page.$$eval('#ibChats button[data-chat]', els => els.map(e => e.dataset.chat));
  check('a chat per project, newest message first', JSON.stringify(chats) === JSON.stringify(['locoradio', 'tunio']), chats);
  check('newest chat open: only its question shows', (await page.locator(`.ib-item[data-id="${b.id}"]`).count()) === 1 && (await page.locator(`.ib-item[data-id="${a.id}"]`).count()) === 0);
  await page.click('#ibChats button[data-chat="tunio"]');
  await page.waitForSelector(`.ib-item[data-id="${a.id}"]`);
  check('chat shows the lead and the project look', (await page.textContent('#ibChats button[data-chat="tunio"]')).includes('Lead') && (await page.textContent('#ibChats')).includes('🎵'));
  check('badge shows emoji and name', (await page.textContent(`.ib-item[data-id="${a.id}"] .ib-proj`)).includes('🎵 Tunio'));
  check('item has the project stripe', (await page.getAttribute(`.ib-item[data-id="${a.id}"]`, 'style')).includes(sum.color));
  check('project tab shows the emoji', (await page.textContent('#ibTabs')).includes('📻 LocoRadio'));
  await page.goto(BASE + '/#/');
  await page.waitForSelector('a.proj');
  check('home card shows the emoji', (await page.textContent('a.proj[href="#/p/tunio"] h2')).includes('🎵'));
  // Waiting on you folds away, closed by default, and stays open through the 1s redraw (AIG-105).
  check('Waiting on you starts closed', !(await page.$eval('details.inbox', d => d.open)));
  await page.click('details.inbox summary');
  await sleep(1500);
  check('stays open after redraws', await page.$eval('details.inbox', d => d.open));
  await page.goto(BASE + '/#/p/tunio');
  await page.click('button:has-text("Look")');
  await page.fill('#look-emoji', '🎸');
  await page.$eval('#look-color', el => { el.value = '#123456'; });
  await page.click('#dialog button:has-text("Save")');
  await sleep(500);
  let t = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Look saves emoji and colour', t.emoji === '🎸' && t.color === '#123456', t);
  check('bad colour refused', (await s.api('PATCH', '/api/projects/tunio', { color: 'red' })).status === 400);
  await s.ok('PATCH', '/api/projects/tunio', { color: '', emoji: '' });
  t = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'tunio');
  check('Automatic brings the picks back', t.emoji === '🎵' && t.color === sum.color, t);
  noErrors(page);
}, true);

def('guard', 'only the board on this computer may use the API: host, origin and JSON checks (AIG-90)', async s => {
  await mkProject(s, 'Alpha', 'ALP');
  // Raw request so the Host and Origin headers can be set freely.
  const raw = (method, p, headers, body) => new Promise(res => {
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers }, x => { x.resume(); res(x.statusCode); });
    r.on('error', () => res(0)); r.end(body);
  });
  const json = { 'Content-Type': 'application/json' }, card = JSON.stringify({ title: 'evil' });
  check('wrong Host refused (DNS rebinding)', await raw('GET', '/api/projects', { Host: 'evil.example:' + PORT }) === 403);
  check('localhost Host allowed', await raw('GET', '/api/projects', { Host: 'localhost:' + PORT }) === 200);
  check('other site Origin refused', await raw('POST', '/api/projects/alpha/cards', { ...json, Origin: 'https://evil.example' }, card) === 403);
  check('plain-text body refused (form/beacon trick)', await raw('POST', '/api/projects/alpha/cards', { 'Content-Type': 'text/plain' }, card) === 415);
  check('board page Origin allowed', await raw('POST', '/api/projects/alpha/cards', { ...json, Origin: 'http://127.0.0.1:' + PORT }, card) === 200);
  check('CLI style (JSON, no Origin) allowed', await raw('POST', '/api/projects/alpha/cards', json, card) === 200);
  check('no evil card got in', (await s.ok('GET', '/api/projects/alpha')).cards.length === 2);
});

def('owner', 'the board works for any owner name, not just Rich (AIG-103)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  check('meta tells the page the owner', (await s.ok('GET', '/api/meta')).owner === 'Sam');
  const c = await mkCard(s, 'alpha', 'Question');
  s.cli(['ask', 'alpha', c.id, 'Go?', '--as', 'Lead']);
  const inbox = s.cli(['inbox']);
  check('CLI speaks of the owner', /asked Sam|Sam/.test(s.cli(['help']).out) && !/\bRich\b/.test(s.cli(['help']).out));
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  check('reply box says Sam', /Reply as Sam/.test(await page.getAttribute('#r-text', 'placeholder')));
  await page.click('.reply button:has-text("Go")');
  await sleep(500);
  const card = await getCard(s, 'alpha', c.id);
  check('owner reply is from Sam and counts as the owner', card.comments.at(-1).author === 'Sam' && card.status === 'team' && !card.needsYou, card);
  const up = s.cli(['updates', 'alpha']);
  check('team sees Sam in updates', /new from Sam/.test(up.out) && /Sam \(/.test(up.out), up.out);
  s.cli(['task', 'alpha', c.id, 'log in', '--as', 'Lead']);
  check('tasks go to Sam', (await getCard(s, 'alpha', c.id)).assignee === 'Sam' && (await s.ok('GET', '/api/inbox')).some(x => x.id === c.id));
  noErrors(page);
}, true, { AIGILE_OWNER: 'Sam' });

def('setup', 'a new install opens Setup; saving writes the local settings file (AIG-91)', async (s, ctx) => {
  const file = process.env.QA_SETUP_FILE;
  check('new install needs setup', (await s.ok('GET', '/api/meta')).setupNeeded === true);
  const page = await openPage(ctx, '#/');
  await page.waitForFunction(() => location.hash === '#/setup', null, { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#setupForm');
  check('board opens Setup first', page.url().endsWith('#/setup'));
  check('name is required', (await s.api('POST', '/api/setup', { owner: '' })).status === 400);
  await page.fill('input[data-key="owner"]', 'Sam');
  await page.fill('input[data-key="agent.command"]', 'C:/tools/agent.exe');
  await page.fill('input[data-key="agent.notesFile"]', 'NOTES.local.md');
  await page.fill('input[data-key="agent.settingsFile"]', '.agent/settings.local.json');
  await page.click('#setupForm button[type=submit]');
  await page.waitForSelector('#setup-done:has-text("ready")');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('saved to the local settings file', saved.owner === 'Sam' && saved.agent.command === 'C:/tools/agent.exe' && saved.agent.settingsFile === '.agent/settings.local.json', saved);
  const m = await s.ok('GET', '/api/meta');
  check('setup done and the name is used at once', m.setupNeeded === false && m.owner === 'Sam', m);
  noErrors(page);
}, true, { AIGILE_LOCAL: (process.env.QA_SETUP_FILE = path.join(tmp('setup'), 'aigile.local.json')) });

def('update', 'a clone behind its GitHub upstream offers an update and fast-forwards safely (AIG-92)', async s => {
  const g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  const repo = process.env.QA_UPDATE_REPO, origin = path.join(path.dirname(repo), 'origin.git'), other = path.join(path.dirname(repo), 'other');
  // Someone else pushes a new commit to the shared origin.
  fs.writeFileSync(path.join(other, 'new.txt'), 'v2'); g(other, 'add', '.'); g(other, '-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', 'Version 2'); g(other, 'push', '-q');
  const st = await s.ok('POST', '/api/update/check');
  check('sees one new commit', st.behind === 1 && st.subjects[0] === 'Version 2', st);
  check('meta carries it for the pill', (await s.ok('GET', '/api/meta')).update.behind === 1);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'changed by hand');
  check('refuses with hand-changed files', (await s.api('POST', '/api/update/apply')).status === 400);
  g(repo, 'checkout', '--', 'a.txt');
  const ap = await s.ok('POST', '/api/update/apply');
  check('fast-forwards', ap.updated === 1 && fs.existsSync(path.join(repo, 'new.txt')), ap);
  check('up to date after', (await s.ok('POST', '/api/update/check')).behind === 0);
}, false, (() => {
  // Scratch origin + two clones: "repo" is the install the server updates, "other" pushes new work.
  const dir = tmp('update'), origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'install'), other = path.join(dir, 'other');
  const g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  g(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  g(dir, 'clone', '-q', origin, other);
  fs.writeFileSync(path.join(other, 'a.txt'), 'v1'); g(other, 'add', '.'); g(other, '-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', 'Version 1'); g(other, 'push', '-q', '-u', 'origin', 'HEAD:main');
  g(dir, 'clone', '-q', origin, repo);
  process.env.QA_UPDATE_REPO = repo;
  return { AIGILE_REPO: repo, AIGILE_NO_RESTART: '1' };
})());

def('foryou', 'For you column: tests, questions, tasks and blocks together; chips pick what comes first (AIG-106)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const t = await mkCard(s, 'alpha', 'A test', { status: 'verify', testSteps: 's' });
  const q = await mkCard(s, 'alpha', 'A question', { status: 'doing' });
  const k = await mkCard(s, 'alpha', 'A task', { status: 'todo' });
  const other = await mkCard(s, 'alpha', 'Not mine', { status: 'todo' });
  s.cli(['ask', 'alpha', q.id, 'Go?', '--as', 'Lead']); s.cli(['task', 'alpha', k.id, 'log in', '--as', 'Lead']);
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');
  const ids = async () => page.$$eval('.column.foryou .card', els => els.map(e => e.dataset.id));
  check('all three kinds in For you', (await ids()).length === 3 && !(await ids()).includes(other.id), await ids());
  check('they are not repeated in their own columns', (await page.locator(`.column[data-status="doing"] .card[data-id="${q.id}"]`).count()) === 0);
  check('questions first by default', (await ids())[0] === q.id);
  await page.click('.fy-chip[data-first="t"]');
  await page.waitForFunction(id => document.querySelector('.column.foryou .card')?.dataset.id === id, t.id, { timeout: 3000 }).catch(() => {});
  check('Tests chip puts the test first', (await ids())[0] === t.id, await ids());
  await page.reload(); await page.waitForSelector('.column.foryou .card');
  check('the pick is remembered', (await ids())[0] === t.id && await page.isVisible('.fy-chip.on[data-first="t"]'));
  await page.click('.fy-chip[data-first="k"]');
  await page.waitForFunction(id => document.querySelector('.column.foryou .card')?.dataset.id === id, k.id, { timeout: 3000 }).catch(() => {});
  check('Tasks chip puts the task first', (await ids())[0] === k.id, await ids());
  noErrors(page);
}, true);

def('popout', '⧉ Pop out opens a card on its own in a new window (AIG-122)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Follow these steps', { status: 'verify', testSteps: '1. Do the thing\n2. See the result' });
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('button:has-text("Pop out")');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('button:has-text("Pop out")')]);
  await pop.waitForSelector('.panel h2');
  check('pop-out shows the card', (await pop.textContent('.panel h2')) === 'Follow these steps' && /\/pop\/alpha\//.test(pop.url()), pop.url());
  check('no header or board behind it', !(await pop.isVisible('header')) && (await pop.locator('.board').count()) === 0);
  check('pop-out has no Pop out button of its own', (await pop.locator('button:has-text("Pop out")').count()) === 0);
  check('main window goes back to the board', await page.waitForFunction(() => location.hash === '#/p/alpha').then(() => true).catch(() => false));
  await pop.click('.verdict button:has-text("Accept")');
  await sleep(500);
  check('accepting in the pop-out works', (await getCard(s, 'alpha', c.id)).status === 'done');
  noErrors(page);
}, true);

def('columns', '⚙️ Columns: rename, reorder, hide and colour a board\'s columns; statuses never change (AIG-116)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  const c = await mkCard(s, 'alpha', 'Plan it', { status: 'todo' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("Columns")');
  await page.waitForSelector('.colrow');
  const row = n => page.locator('.colrow').nth(n);
  await row(1).locator('input[aria-label="Name"]').fill('Next up');   // To do
  await row(1).locator('input.emoji').fill('⏭️');
  await row(1).locator('button[title="Move left"]').click();                 // before Backlog
  await page.locator('.colrow').nth(1).locator('input[type=checkbox]').check(); // hide Backlog (now 2nd)
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.locator('.colrow').nth(4).locator('input[type=checkbox]').click(); // For you: asks, cancelled
  check('hiding For you asks first', /could miss things/.test(asked), asked);
  check('cancel keeps it shown', !(await page.locator('.colrow').nth(4).locator('input[type=checkbox]').isChecked()));
  await page.click('#dialog button:has-text("Save")');
  await page.waitForFunction(() => !document.querySelector('#dialog .dialog'));
  await page.waitForSelector('.column h3');
  const heads = await page.$$eval('.column h3 span:first-child', els => els.map(e => e.textContent));
  check('renamed, moved first, Backlog hidden', heads[0] === '⏭️ Next up' && !heads.includes('Backlog') && heads.length === 6, heads);
  check('card still todo underneath', (await getCard(s, 'alpha', c.id)).status === 'todo');
  check('other project untouched', !(await s.ok('GET', '/api/projects/beta')).columns);
  check('bad columns refused', (await s.api('PATCH', '/api/projects/alpha', { columns: [{ status: 'todo' }] })).status === 400);
  await s.ok('PATCH', '/api/projects/alpha', { columns: [] });
  check('reset to default', !(await s.ok('GET', '/api/projects/alpha')).columns);
  noErrors(page);
}, true);

def('cardview', '🃏 Cards: compact or roomy, and which details show on board cards (AIG-119)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  const c = await mkCard(s, 'alpha', 'Show me', { type: 'bug', priority: 'high', assignee: 'Tweak', sprint: 'S9' });
  await say(s, 'alpha', c.id, 'Tweak', 'a comment');
  const page = await openPage(ctx, '#/p/alpha');
  const card = page.locator(`.card[data-id="${c.id}"]`);
  await card.waitFor();
  const txt = async () => (await card.textContent()).replace(/\s+/g, ' ');
  let t = await txt();
  check('defaults show today\'s details', /bug/.test(t) && /high/.test(t) && /Tweak/.test(t) && /S9/.test(t) && /💬 1/.test(t) && !/🕒/.test(t), t);
  check('default is roomy', !(await card.evaluate(e => e.classList.contains('compact'))));
  await page.click('button:has-text("Cards")');
  await page.waitForSelector('[data-cv]');
  await page.locator('[data-cv=assignee]').uncheck();
  await page.locator('[data-cv=age]').check();
  await page.locator('[name=cv-density][value=compact]').check();
  await page.click('#dialog button:has-text("Save")');
  await page.waitForFunction(() => !document.querySelector('#dialog .dialog'));
  await page.waitForSelector(`.card.compact[data-id="${c.id}"]`);
  t = await txt();
  check('assignee hidden, age shown', !/Tweak/.test(t) && /🕒/.test(t) && /bug/.test(t) && /S9/.test(t), t);
  check('saved on the project only', (await s.ok('GET', '/api/projects/alpha')).cardView.density === 'compact' && !(await s.ok('GET', '/api/projects/beta')).cardView);
  for (const bad of [{ density: 'tiny' }, { show: { colour: true } }, { show: { age: 'yes' } }, 'compact'])
    check('bad cardView refused: ' + JSON.stringify(bad), (await s.api('PATCH', '/api/projects/alpha', { cardView: bad })).status === 400);
  await s.ok('PATCH', '/api/projects/alpha', { cardView: null });
  check('reset to default', !(await s.ok('GET', '/api/projects/alpha')).cardView);
  noErrors(page);
}, true);

def('wip', 'WIP limits per column: n / limit in the header, amber at the limit, red over it (AIG-118)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'One', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("Columns")');
  await page.waitForSelector('.colrow');
  await page.locator('.colrow').nth(2).locator('input.wip').fill('2');   // In progress
  await page.locator('.colrow').nth(4).locator('input.wip').fill('1');   // For you
  await page.click('#dialog button:has-text("Save")');
  await page.waitForFunction(() => !document.querySelector('#dialog .dialog'));
  const doing = page.locator('.column[data-status="doing"]'), verify = page.locator('.column[data-status="verify"]');
  await page.waitForSelector('.column[data-status="doing"] .wipn');
  check('header shows n / limit', (await doing.locator('h3').textContent()).includes('1 / 2'));
  check('under the limit: no colour', !/wip-/.test(await doing.getAttribute('class')));
  await mkCard(s, 'alpha', 'Two', { status: 'doing' });
  await page.waitForSelector('.column.wip-at[data-status="doing"]');
  check('at the limit: amber', (await doing.locator('h3').textContent()).includes('2 / 2'));
  await mkCard(s, 'alpha', 'Three', { status: 'doing' });
  await page.waitForSelector('.column.wip-over[data-status="doing"]');
  check('over the limit: red', (await doing.locator('h3').textContent()).includes('3 / 2'));
  check('limit saved as a number', (await s.ok('GET', '/api/projects/alpha')).columns.find(c => c.status === 'doing').wip === 2);
  await mkCard(s, 'alpha', 'Test me', { status: 'verify' });
  await page.waitForSelector('.column.wip-at[data-status="verify"]');
  check('For you column can have a limit', (await verify.locator('h3').textContent()).includes('1 / 1'));
  const cols = (await s.ok('GET', '/api/projects/alpha')).columns;
  for (const bad of [-1, 1000, 1.5, 'lots']) {
    const r = await s.api('PATCH', '/api/projects/alpha', { columns: cols.map(c => c.status === 'doing' ? { ...c, wip: bad } : c) });
    check('bad limit refused: ' + bad, r.status === 400);
  }
  await s.ok('PATCH', '/api/projects/alpha', { columns: cols.map(c => c.status === 'doing' ? { ...c, wip: 0 } : c) });
  await page.waitForSelector('.column[data-status="doing"]:not(.wip-over)');
  check('0 = no limit', !(await doing.locator('.wipn').count()));
  noErrors(page);
}, true);

def('lanes', '≡ Lanes: group the board into rows by assignee, type, sprint or priority; remembered per project (AIG-120)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Ann one', { status: 'todo', assignee: 'Ann' });
  const b = await mkCard(s, 'alpha', 'Bob one', { status: 'todo', assignee: 'Bob', type: 'bug' });
  await mkCard(s, 'alpha', 'Nobody', { status: 'backlog' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column .card');
  check('default has no lanes', (await page.locator('.lane').count()) === 0);
  await page.selectOption('.lanesel', 'assignee');
  await page.waitForSelector('.lane');
  const heads = await page.$$eval('.lane-h', els => els.map(e => e.firstChild.textContent.trim()));
  check('one lane per assignee, unassigned last', JSON.stringify(heads) === JSON.stringify(['Ann', 'Bob', 'No assignee']), heads);
  const lane = n => page.locator(`.lane:has(.lane-h:has-text("${n}"))`);
  check('Ann lane holds only her card', (await lane('Ann').locator('.card').count()) === 1 && (await lane('Ann').locator(`.card[data-id="${a.id}"]`).count()) === 1);
  await lane('Ann').locator(`.card[data-id="${a.id}"]`).dragTo(lane('Ann').locator('.column[data-status="doing"]'));
  await sleep(500);
  check('drag inside a lane changes status', (await getCard(s, 'alpha', a.id)).status === 'doing');
  check('other lane card untouched', (await getCard(s, 'alpha', b.id)).status === 'todo');
  await page.reload(); await page.waitForSelector('.lane');
  check('choice survives a reload', (await page.locator('.lanesel').inputValue()) === 'assignee' && (await page.locator('.lane').count()) === 3);
  await page.selectOption('.lanesel', 'type');
  await page.waitForFunction(() => document.querySelectorAll('.lane').length === 2);
  await page.selectOption('.lanesel', '');
  await page.waitForFunction(() => !document.querySelector('.lane'));
  check('off goes back to one board', (await page.locator('.board').count()) === 1);
  noErrors(page);
}, true);

def('quick', '👀 What\'s happening? summarises the board; 💬 Ask the team sends a question whose answer lands in Messages (AIG-132)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Building the thing', { status: 'doing', assignee: 'Pixel' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("What\'s happening?")');
  await page.waitForSelector('#dialog h2');
  check('summary shows what is in progress', (await page.textContent('#dialog')).includes('Building the thing'));
  await page.click('#dialog button:has-text("Ask the team")');
  await page.fill('#ask-text', 'Where are we with the login page?');
  await page.click('#dialog button[type=submit]');
  await sleep(500);
  const q = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.quick);
  check('question card goes to the team', q && q.status === 'team' && q.title === '💬 Where are we with the login page?', q);
  s.cli(['comment', 'alpha', q.id, 'Nearly done, testing now', '--as', 'Lead']);
  check('the answer lands in your Messages', (await getCard(s, 'alpha', q.id)).needsYou === true && (await s.ok('GET', '/api/inbox')).some(c => c.id === q.id));
  noErrors(page);
}, true);

def('views', '👁 Views: save the filters as a named view, apply it, last view re-applied on reload, delete; bad views refused (AIG-121)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Zebra bug', { status: 'todo', type: 'bug' });
  await mkCard(s, 'alpha', 'Zebra feature', { status: 'todo' });
  await mkCard(s, 'alpha', 'Plain thing', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#f-q');
  const cards = () => page.locator('.board .card').count();
  await page.fill('#f-q', 'zebra');
  await page.selectOption('select[data-f=type]', 'bug');
  check('filtered to one card', (await cards()) === 1);
  await page.click('button:has-text("Views")');
  await page.fill('#view-name', 'My bugs');
  await page.click('#dialog button:has-text("Save view")');
  await page.waitForSelector('.viewrow button:has-text("My bugs")');
  const saved = (await s.ok('GET', '/api/projects/alpha')).views;
  check('view stored on the project', saved && saved.length === 1 && saved[0].name === 'My bugs' && saved[0].filters.q === 'zebra' && saved[0].filters.type === 'bug', saved);
  check('other project has no views', !(await s.ok('GET', '/api/projects/beta')).views);
  await page.click('#dialog button:has-text("Close")');
  await page.click('#f-count a');
  check('cleared: all cards', (await cards()) === 3);
  await page.click('button:has-text("Views")');
  await page.click('.viewrow button:has-text("My bugs")');
  check('applying the view filters the board', (await cards()) === 1 && (await page.inputValue('#f-q')) === 'zebra' && (await page.inputValue('select[data-f=type]')) === 'bug');
  await page.reload();
  await page.waitForSelector('#f-q');
  await page.waitForSelector('.board .card');
  check('last view re-applied after reload', (await cards()) === 1 && (await page.inputValue('#f-q')) === 'zebra');
  await page.click('#f-count a');
  await page.reload();
  await page.waitForSelector('.board .card');
  check('clearing forgets the last view', (await cards()) === 3);
  await page.click('button:has-text("Views")');
  await page.click('.viewrow button[title="Delete this view"]');
  await page.waitForSelector('#dialog :text("No saved views yet")');
  check('deleted on the server', !(await s.ok('GET', '/api/projects/alpha')).views);
  const patch = views => s.api('PATCH', '/api/projects/alpha', { views });
  check('empty name refused', (await patch([{ name: ' ', filters: {} }])).status === 400);
  check('long name refused', (await patch([{ name: 'x'.repeat(41), filters: {} }])).status === 400);
  check('non-object filters refused', (await patch([{ name: 'a', filters: 'q' }])).status === 400);
  check('array filters refused', (await patch([{ name: 'a', filters: [] }])).status === 400);
  check('more than 20 refused', (await patch(Array.from({ length: 21 }, (_, i) => ({ name: 'v' + i, filters: {} })))).status === 400);
  check('20 accepted', (await patch(Array.from({ length: 20 }, (_, i) => ({ name: 'v' + i, filters: {} })))).status === 200);
  noErrors(page);
}, true);

def('steps', 'your own steps inside a column: sub-columns, drag between them, status unchanged (AIG-117)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Make it', { status: 'doing' });
  const cols = (await s.ok('GET', '/api/meta')).statuses.map(st => ({ status: st, ...(st === 'doing' ? { steps: ['Design', 'Build', 'QA'] } : {}) }));
  await s.ok('PATCH', '/api/projects/alpha', { columns: cols });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.step');
  const heads = await page.$$eval('.column.step h3 span:first-child', els => els.map(e => e.textContent));
  check('three step columns', JSON.stringify(heads) === JSON.stringify(['In progress · Design', 'In progress · Build', 'In progress · QA']), heads);
  check('a card with no step sits in the first', (await page.locator('.column.step[data-step="Design"] .card').count()) === 1);
  await page.dragAndDrop(`.card[data-id="${c.id}"]`, '.column.step[data-step="Build"]');
  await sleep(600);
  const moved = await getCard(s, 'alpha', c.id);
  check('dragging sets the step, status stays doing', moved.step === 'Build' && moved.status === 'doing', moved);
  check('team sees plain status', /\[doing\]/.test(s.cli(['show', 'alpha', c.id]).out));
  noErrors(page);
}, true);

def('fynext', 'For you: focus on that column only; dealing with a card opens the next one (AIG-141)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Test one', { status: 'verify', testSteps: 'do it' });
  await sleep(20);
  const b = await mkCard(s, 'alpha', 'Test two', { status: 'verify', testSteps: 'do it' });
  await mkCard(s, 'alpha', 'Other work', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('.column.foryou .fy-head');
  await page.waitForFunction(() => document.querySelectorAll('.board .column').length === 1);
  check('focus shows only For you', (await page.locator('.board .column').count()) === 1);
  await page.click('.column.foryou .fy-head');
  await page.waitForFunction(() => document.querySelectorAll('.board .column').length > 1);
  check('click again shows all', (await page.locator('.board .column').count()) > 1);
  await page.goto(BASE + '/#/p/alpha/' + a.id);
  await page.click('.verdict button:has-text("Accept")');
  await page.waitForFunction(id => location.hash.endsWith('/' + id), b.id, { timeout: 4000 }).catch(() => {});
  check('accepting opens the next test', page.url().endsWith('/' + b.id), page.url());
  await page.click('.verdict button:has-text("Accept")');
  await page.waitForFunction(() => location.hash === '#/p/alpha', null, { timeout: 4000 }).catch(() => {});
  check('last one closes back to the board', page.url().endsWith('#/p/alpha'), page.url());
  noErrors(page);
}, true);

/* ---------- runner ---------- */
const args = process.argv.slice(2);
if (args.includes('--list')) { for (const [n, a] of Object.entries(areas)) console.log(n.padEnd(10) + a.doc); process.exit(0); }
const wanted = args.length ? args : Object.keys(areas);
for (const w of wanted) if (!areas[w]) { console.error('unknown area: ' + w + '  (try --list)'); process.exit(2); }

let browser = null;
for (const name of wanted) {
  area = name;
  const s = await startServer(areas[name].env);
  let ctx = null;
  try {
    if (areas[name].needsBrowser) {
      if (!browser) browser = await loadPw().chromium.launch({ executablePath: CHROME, headless: true });
      ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    }
    await areas[name].fn(s, ctx);
  } catch (e) {
    check('area ran to the end', false, String(e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    s.stop();
    await sleep(300);
  }
}
if (browser) await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
