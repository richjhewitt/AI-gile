// QA areas: api, cli, guard, update, proof.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, PORT, check, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

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

  const cm = await say(s, 'alpha', 'ALP-1', 'Owner', 'hello team');
  check('Owner comment moves card to team', cm.status === 'team' && cm.prevStatus === 'doing', [cm.status, cm.prevStatus]);
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
  await s.ok('PATCH', `/api/projects/alpha/cards/${c4.id}`, { assignee: 'Owner' });
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
  check('updates lists Owner items', peek.cards.some(c => c.id === 'ALP-1') && peek.cards.some(c => c.id === c6.id && c.items[0].kind === 'poke'));
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
  check('team and log stored', full.team[0].name === 'Forge' && full.log.some(e => e.kind === 'decision' && e.author === 'Forge'));
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
  const t1 = await mkCard(s, 'alpha', 'Owner said', { status: 'doing' });
  await say(s, 'alpha', t1.id, 'Owner', 'please look');
  const nx = a('next', 'alpha');
  const pos = id => nx.out.indexOf(id + ' ');
  check('next exits 0', nx.code === 0, nx.err);
  check('next order team, doing, bug, rest', pos(t1.id) > 0 && pos(t1.id) < pos(d1.id) && pos(d1.id) < pos(b1.id) && pos(b1.id) < pos(n1.id), nx.out);
  check('next marks the first with >>', /^ {2}>> ALP-4/m.test(nx.out), nx.out);

  const t = a('test', 'alpha', d1.id, 'steps to follow', '--as', 'Forge');
  check('test hands to Owner', t.code === 0 && /handed to Owner/.test(t.out), t);
  const cd = await getCard(s, 'alpha', d1.id);
  check('test sets verify + steps', cd.status === 'verify' && cd.testSteps === 'steps to follow');
  const k = a('task', 'alpha', n1.id, 'add the key', '--as', 'Forge');
  check('task goes to Owner', k.code === 0 && /task for Owner on ALP-1/.test(k.out), k);
  check('task card is assigned to Owner', (await getCard(s, 'alpha', n1.id)).assignee === 'Owner');
  const inb = a('inbox');
  check('cli inbox lists verify and task', inb.out.includes(d1.id) && inb.out.includes(n1.id), inb.out);
  const br = a('brief', 'alpha');
  check('brief has the digest', br.code === 0 && /^Alpha \(alpha\):/.test(br.out) && /Waiting on Owner/.test(br.out) && /For the team/.test(br.out), br.out);
  check('list/show work', a('list', 'alpha').out.includes('Bug todo') && a('show', 'alpha', b1.id).out.includes('Conversation (0)'));
  check('add via cli', /^added ALP-5/.test(a('add', 'alpha', 'cli card', '--type', 'bug', '--desc', 'd').out));
  check('edit via cli', /^updated/.test(a('edit', 'alpha', 'ALP-5', '--title', 'renamed').out));
  check('comment via cli', /commented on ALP-5/.test(a('comment', 'alpha', 'ALP-5', 'hi', '--as', 'Forge').out));
  check('ask via cli', /asked Owner/.test(a('ask', 'alpha', 'ALP-5', 'why?', '--as', 'Forge').out) && (await getCard(s, 'alpha', 'ALP-5')).needsYou === true);
  check('block/unblock', /^blocked/.test(a('block', 'alpha', 'ALP-5', '--as', 'Forge').out) && /^unblocked/.test(a('unblock', 'alpha', 'ALP-5').out));
  check('missing --as is an error', a('comment', 'alpha', 'ALP-5', 'x').code === 1);

  // hooks: fresh project so nothing is new
  await mkProject(s, 'Beta', 'BET');
  const bc = await mkCard(s, 'beta', 'B card', { status: 'doing' });
  const silent = a('updates', 'beta', '--hook');
  check('updates --hook is silent with nothing new', silent.code === 0 && silent.out === '' && silent.err === '', silent);
  const quiet = a('updates', 'beta');
  check('plain updates says nothing new', quiet.out === 'Nothing new from Owner.', quiet.out);
  await say(s, 'beta', bc.id, 'Owner', 'news!');
  const sh = a('updates', 'beta', '--stop-hook');
  let j = null; try { j = JSON.parse(sh.out); } catch {}
  check('--stop-hook prints block JSON', j && j.decision === 'block' && /news!/.test(j.reason), sh.out);
  check('--stop-hook silent once seen', a('updates', 'beta', '--stop-hook').out === '');
  await say(s, 'beta', bc.id, 'Owner', 'again');
  const hk = a('updates', 'beta', '--hook');
  check('--hook speaks when there is news', /AI-gile board \(beta\)/.test(hk.out) && /again/.test(hk.out), hk.out);

  // move done
  const m1 = await mkCard(s, 'beta', 'to close', { status: 'todo' });
  const refused = a('move', 'beta', m1.id, 'done');
  check('move done refused outside team', refused.code === 1 && /only Owner/.test(refused.err), refused);
  check('card was not moved', (await getCard(s, 'beta', m1.id)).status === 'todo');
  await say(s, 'beta', m1.id, 'Owner', 'fyi');
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

def('proof', 'proof on hand-back: test --commit shows what changed; --shot adds screenshots (AIG-166)', async (s, ctx) => {
  const folder = tmp('proof'), g = (...a) => spawnSync('git', a, { cwd: folder, encoding: 'utf8' });
  g('init', '-q'); fs.writeFileSync(path.join(folder, 'app.js'), 'const colour = "red";\n'); g('add', '.'); g('-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', 'start');
  fs.writeFileSync(path.join(folder, 'app.js'), 'const colour = "blue";\n'); g('-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qam', 'Make it blue');
  const sha = g('rev-parse', 'HEAD').stdout.trim();
  const shot = path.join(folder, 'result.png');
  fs.writeFileSync(shot, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmgACZgYAAAKfEC/tW5j8QAAAAASUVORK5CYII=', 'base64'));
  await mkProject(s, 'Alpha', 'ALP', { path: folder });
  const c = await mkCard(s, 'alpha', 'Blue please');
  const r = s.cli(['test', 'alpha', c.id, '1. look', '--as', 'Lead', '--commit', sha.slice(0, 8), '--shot', shot]);
  const card = await getCard(s, 'alpha', c.id);
  check('the board keeps the proof', r.code === 0 && card.proof && card.proof.subject === 'Make it blue' && card.proof.files[0].file === 'app.js' && /\+const colour = "blue"/.test(card.proof.diff), r);
  check('a bad commit id is refused', (await s.api('POST', `/api/projects/alpha/cards/${c.id}/proof`, { commit: 'nope; rm' })).status === 400);
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('.proof');
  const pane = await page.textContent('[data-pane="test"]');
  check('Test tab shows what changed', pane.includes('Make it blue') && pane.includes('app.js'));
  await page.click('.proof summary');
  check('the change unfolds, colour-coded', await page.isVisible('.proof pre.diff .add'));
  check('the screenshot shows on the Test tab', (await page.locator('[data-pane="test"] .att-shown img').count()) === 1);
  noErrors(page);
}, true);
