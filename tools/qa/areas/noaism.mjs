// QA area: noaism (AIG-729..731). No AI mode keeps a 🧭 Scrum Master (no AI): fixed commands in plain code, never a model run.
import { check, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

def('noaism', 'No AI Scrum Master: shows as "(no AI)" in Messages, /sort /move /new project, the /request New server form, no AI run started (AIG-729..731)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('alpha') });
  await s.ok('POST', '/api/setup', { prefs: { noAi: true, servers: [{ name: 'Box', kind: 'ssh', value: 'rich@example.com', access: { Dana: 'admin' } }] } });
  const todo = ['One', 'Two', 'Three', 'Four'];
  const specs = [['low', 'task', ''], ['urgent', 'bug', 'Zed'], ['high', 'feature', 'Amy'], ['normal', 'task', '']];
  const ids = [];
  for (let i = 0; i < 4; i++) { const c = await mkCard(s, 'alpha', todo[i], { status: 'todo', priority: specs[i][0], type: specs[i][1] }); ids.push(c.id); if (specs[i][2]) await s.ok('PATCH', `/api/projects/alpha/cards/${c.id}`, { assignee: specs[i][2] }); }
  const chat = text => s.ok('POST', '/api/chats/_watchman', { text, project: 'alpha' });
  const thread = async () => (await s.ok('GET', '/api/chats/_watchman')).messages;
  const lastReply = async () => { const m = (await thread()).filter(x => !x.mine); return m.length ? m[m.length - 1].text : ''; };
  const todoOrder = async () => (await s.ok('GET', '/api/projects/alpha')).cards.filter(c => c.status === 'todo').sort((a, b) => (a.sortPos || 1e9) - (b.sortPos || 1e9)).map(c => c.id);

  // 729: listed, labelled, answered by plain code
  const list = await s.ok('GET', '/api/chats');
  check('the chat list holds only the Scrum Master (no AI)', list.length === 1 && list[0].slug === '_watchman' && list[0].noAi === true && /\(no AI\)/.test(list[0].lead), JSON.stringify(list));
  const r0 = await chat('hello there');
  check('a plain message gets the help reply at once, nothing queued', r0.auto === true && !r0.working && !r0.waiting && /\/sort/.test(await lastReply()), JSON.stringify(r0));

  // 730: /move
  check('/move works', /Moved/.test((await chat(`/move ${ids[0]} doing`)).reply) && (await getCard(s, 'alpha', ids[0])).status === 'doing');
  const bad = await chat('/move ALP-999 done');
  check('/move refuses an unknown id', /No card ALP-999/.test(bad.reply), bad.reply);
  check('/move refuses a badly formed id', /Use \/move/.test((await chat('/move banana done')).reply));
  const bs = await chat(`/move ${ids[1]} sideways`);
  check('/move refuses a bad status and moves nothing', /sideways/.test(bs.reply) && (await getCard(s, 'alpha', ids[1])).status === 'todo', bs.reply);
  await chat(`/move ${ids[0]} todo`);

  // 730: /sort priority
  const rs = await chat('/sort priority');
  check('/sort priority replies with one line', /Sorted 4 To do cards/.test(rs.reply), rs.reply);
  check('To do is now urgent, high, normal, low', JSON.stringify(await todoOrder()) === JSON.stringify([ids[1], ids[2], ids[3], ids[0]]), JSON.stringify(await todoOrder()));
  await chat('/sort who');
  check('/sort who puts Amy, Zed, then the unassigned', (await todoOrder())[0] === ids[2] && (await todoOrder())[1] === ids[1], JSON.stringify(await todoOrder()));
  check('/sort with a bad key says why', /Sort by one of/.test((await chat('/sort colour')).reply));
  check('/sort without a project says so', /Open a project/.test((await s.ok('POST', '/api/chats/_watchman', { text: '/sort age' })).reply));

  // 730: /new project
  const np = await chat('/new project Gamma Ray');
  check('/new project makes the project', /Made project Gamma Ray/.test(np.reply) && (await s.ok('GET', '/api/projects')).some(p => p.name === 'Gamma Ray'), np.reply);
  check('/new project twice says why not', /already exists/.test((await chat('/new project Gamma Ray')).reply));

  // 731: /request New server, assigned to whoever runs the servers (Dana)
  const rq = await s.ok('POST', '/api/chats/_watchman/request', { kind: 'server', name: 'Build box', why: 'Run nightly builds', project: 'alpha' });
  const made = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'New server: Build box');
  check('the request makes a task card in To do titled "New server: <name>" with the reason as a bullet', made && made.type === 'task' && made.status === 'todo' && /^- Run nightly builds/.test(made.description), JSON.stringify(made) + rq.reply);
  check('it is assigned to whoever runs the servers', made && made.assignee === 'Dana', made && made.assignee);
  await s.ok('POST', '/api/setup', { prefs: { servers: [] } });
  await s.ok('POST', '/api/chats/_watchman/request', { kind: 'server', name: 'Second', why: 'Spare', project: 'alpha' });
  check('with nobody in charge of servers it is unassigned', ((await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'New server: Second') || {}).assignee === '');
  check('a request with no reason makes nothing', (await s.ok('POST', '/api/chats/_watchman/request', { kind: 'server', name: 'Third', why: '', project: 'alpha' })).reply.includes('Nothing made'));

  // no AI run was started by any of it
  const sm = await s.ok('GET', '/api/scrummaster').catch(() => ({}));
  check('no Scrum Master run counted', !sm.runsToday, JSON.stringify(sm));
  check('no agent was started (no log, no stub output)', !fs.existsSync(path.join(s.data, 'logs', '_scrummaster.log')) && (!s.wakeOut || !fs.existsSync(s.wakeOut) || fs.statSync(s.wakeOut).size === 0));

  // The page: label, buttons, a typed command, the form
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.toolbar');
  await page.click('.dm-railbtn[data-dms]');
  await page.waitForSelector('[data-dm="_watchman"]');
  check('Messages lists the Scrum Master with the (no AI) label', /\(no AI\)/.test(await page.textContent('[data-dm="_watchman"]')));
  await page.click('[data-dm="_watchman"]');
  await page.waitForSelector('#smCmds');
  check('command buttons sit above the reply box', await page.locator('#smCmds [data-smcmd]').count() === 4 && await page.locator('#smRequest').count() === 1);
  await page.click('#smCmds [data-smcmd="/sort age"]');
  await page.waitForFunction(() => /by age/.test(document.getElementById('dmList').textContent));
  check('a sort button gets its one-line reply', true);
  await page.fill('#dmText', `/move ${ids[3]} done`); await page.click('.dm-compose .primary');
  await page.waitForFunction(id => new RegExp('Moved ' + id).test(document.getElementById('dmList').textContent), ids[3]);
  check('a typed /move works from the page', (await getCard(s, 'alpha', ids[3])).status === 'done');
  await page.click('#smRequest');
  await page.fill('#smReqName', 'Web 2'); await page.fill('#smReqWhy', 'Host the site');
  await page.click('#smReqGo');
  await page.waitForFunction(() => /New server: Web 2/.test(document.getElementById('dmList').textContent));
  check('the form makes the card', !!(await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'New server: Web 2'));
  noErrors(page);
}, true);
