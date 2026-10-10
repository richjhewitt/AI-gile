// AI-gile QA: starts its own server on a temp data folder and checks the API, the CLI and the page.
//   node tools/qa/qa.mjs [area ...]     (no args = all areas; --list shows them; QA_PORT changes the port)
// The page areas need playwright: `cd tools/qa && npm i`, or it falls back to the shared install below.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
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
async function startServer() {
  const dir = tmp('run'), data = path.join(dir, 'data'), usageDir = path.join(dir, 'usage');
  fs.mkdirSync(usageDir);
  const out = path.join(dir, 'wake-out.txt');
  const stub = path.join(dir, 'agent-stub.bat');
  fs.writeFileSync(stub, `@echo off\r\ncd > "${out}"\r\necho %* >> "${out}"\r\nping -n 4 127.0.0.1 >nul\r\nexit\r\n`);
  const env = { ...process.env, AIGILE_PORT: String(PORT), AIGILE_DATA: data, AIGILE_AGENT_COMMAND: stub, AIGILE_USAGE_DIR: usageDir };
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
const def = (name, doc, fn, needsBrowser = false) => { areas[name] = { doc, fn, needsBrowser }; };

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
  check('seven columns in order', JSON.stringify(heads) === JSON.stringify(['Backlog', 'To do', 'In progress', 'Review', 'For you to test', 'For the team', 'Done']), heads);
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
  await page.waitForSelector('#modal .panel', { state: 'detached' });
  const w = await getCard(s, 'alpha', 'ALP-1');
  check('Wait and see closes panel, keeps verify, moves to back', w.status === 'verify' && w.updated >= before && !page.url().endsWith('ALP-1'), [w.status, page.url()]);

  // Enter sends (ALP-2)
  await page.goto(BASE + '/#/p/alpha/ALP-2');
  await page.waitForSelector('#r-text');
  await page.fill('#r-text', 'thanks, carry on');
  await page.press('#r-text', 'Enter');
  await page.waitForSelector('#modal .panel', { state: 'detached' });
  const c2 = await getCard(s, 'alpha', 'ALP-2');
  check('Enter sends and closes the panel', c2.comments.at(-1).text === 'thanks, carry on' && c2.comments.at(-1).author === 'Rich' && c2.status === 'team', [c2.status, c2.comments.at(-1)]);

  // Accept (ALP-3)
  await page.goto(BASE + '/#/p/alpha/ALP-3');
  await page.waitForSelector('#modal .panel');
  await page.click('button.good');
  await page.waitForSelector('#modal .panel', { state: 'detached' });
  check('Accept closes the panel and marks done', (await getCard(s, 'alpha', 'ALP-3')).status === 'done');

  // Send back needs a reason (ALP-4)
  await page.goto(BASE + '/#/p/alpha/ALP-4');
  await page.waitForSelector('#modal .panel');
  await page.click('button.warn');
  check('Send back without a reason shows an error', /Say what is wrong/.test(await page.textContent('#v-err')));
  await page.fill('#v-text', 'nope');
  await page.click('button.warn');
  await page.waitForSelector('#modal .panel', { state: 'detached' });
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
  check('route: ../ escape refused', [400, 404].includes((await get('../outside.md')).status));
  check('route: absolute outside refused', [400, 404].includes((await get(path.join(root, 'outside.md'))).status));
  check('route: non-.md refused', (await get('notes.txt')).status === 400);
  check('route: missing is 404', (await get('protocol/none.md')).status === 404);
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

/* ---------- runner ---------- */
const args = process.argv.slice(2);
if (args.includes('--list')) { for (const [n, a] of Object.entries(areas)) console.log(n.padEnd(10) + a.doc); process.exit(0); }
const wanted = args.length ? args : Object.keys(areas);
for (const w of wanted) if (!areas[w]) { console.error('unknown area: ' + w + '  (try --list)'); process.exit(2); }

let browser = null;
for (const name of wanted) {
  area = name;
  const s = await startServer();
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
