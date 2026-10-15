// QA area: assistant (AIG-1021): quiet chats hide after 6 hours (not with unread), and the 💚 Personal assistant chat is pinned under
// All hands: "remind me at 3 to call Bob" makes a reminder, "help" answers, anything else starts the assistant's OWN agent run (AIG-1034),
// which answers with `aigile pasay`, can pick its own name (`paname`) and never touches the Scrum Master's chat; No Token Mode gives a plain line.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, openPage, noErrors, until, def, tmp, ROOT } from '../lib.mjs';

// The stub agent: in the assistant's folder it notes the cwd and model, answers with pasay (or picks a name when asked), else does nothing.
const dir = tmp('pa'), calls = path.join(dir, 'calls.txt'), stub = path.join(dir, 'pa-stub.bat'), local = path.join(dir, 'local.json');
fs.writeFileSync(path.join(dir, 'pa-stub.js'), `const fs = require('fs'), a = process.argv.slice(2), m = a[a.indexOf('--model') + 1] || '-', p = a[a.indexOf('-p') + 1] || '', cwd = process.cwd(), cli = ${JSON.stringify(path.join(ROOT, 'aigile.js'))};
fs.appendFileSync(${JSON.stringify(calls)}, m + ' ' + cwd + '\\n');
const run = (...x) => require('child_process').spawnSync(process.execPath, [cli, ...x], { stdio: 'inherit' });
if (/assistant/i.test(cwd)) { console.log('{"type":"system"}'); if (/pick a name/i.test(p)) run('paname', 'Juno'); run('pasay', 'Stub reply from ' + m); }`);
fs.writeFileSync(stub, `@echo off
node "${path.join(dir, 'pa-stub.js')}" %*
exit /b 0
`);
fs.writeFileSync(local, JSON.stringify({ owner: 'Owner', agent: { command: 'x', notesFile: 'CLAUDE.local.md', settingsFile: '.claude/settings.local.json' } }));
const callList = () => { try { return fs.readFileSync(calls, 'utf8').split(/\r?\n/).filter(Boolean); } catch { return []; } };

def('assistant', '💚 Personal assistant chat pinned under All hands (reminder, help, start my day, else its own agent run); quiet chats hide after 6 hours but not with unread (AIG-1021)', async (s, ctx) => {
  const hr = 3600000, ago = ms => new Date(Date.now() - ms).toISOString();
  for (const [n, k] of [['Qh Seven', 'QS'], ['Qh Unread', 'QU'], ['Qh Fresh', 'QF']]) { await mkProject(s, n, k); await s.ok('POST', '/api/projects/' + n.toLowerCase().replace(' ', '-') + '/team', { name: 'Lead', role: 'Lead' }); }
  const say = slug => s.ok('POST', `/api/projects/${slug}/leadchat`, { text: 'hello', author: 'Lead' });
  await say('qh-seven'); await say('qh-unread'); await say('qh-fresh');
  const back = (slug, ms, read) => { const f = path.join(s.data, slug + '.chat'), j = JSON.parse(fs.readFileSync(f, 'utf8')); j.msgs.forEach(m => { m.at = ago(ms); }); j.readAt = read ? ago(ms - 1000) : ''; fs.writeFileSync(f, JSON.stringify(j)); };
  back('qh-seven', 7 * hr, true); back('qh-unread', 7 * hr, false); back('qh-fresh', 2 * hr, true);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dm="qh-fresh"]');
  const keys = async () => await page.locator('#dmPanel .dm-list [data-dm]').evaluateAll(a => a.map(x => x.dataset.dm));
  let k = await keys();
  check('a chat quiet for 7 hours is hidden', !k.includes('qh-seven'), k);
  check('a chat from 2 hours ago stays', k.includes('qh-fresh'), k);
  check('7 hours old but unread stays', k.includes('qh-unread'), k);
  check('the assistant row is at the top, under All hands', k[0] === '_allhands' && k[1] === '_assistant', k);
  // The chat
  const send = t => s.ok('POST', '/api/chats/_assistant', { text: t });
  const msgs = async () => (await s.ok('GET', '/api/chats/_assistant')).messages;
  // AIG-1119: an agent or background caller never writes as the owner, renames the assistant, picks the owner's day or starts a Discord link
  const team = (url, body) => fetch(s.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'background', 'x-aigile-as': 'Dev' }, body: JSON.stringify(body) }).then(r => r.status);
  const st = [await team('/api/chats/_assistant', { text: 'remind me at 3 to leak' }), await team('/api/assistant/name', { name: 'Evil' }), await team('/api/today/pick', { slugs: [] }), await team('/api/discord/link', { name: 'x' })];
  check('owner-only: assistant chat, assistant name, today pick, Discord link refuse a team call (403)', st.every(x => x === 403) && !(await msgs()).some(m => /leak/.test(m.text)), st);
  await send('remind me at 3 to call Bob');
  check('"remind me at 3 to call Bob" makes a reminder', (await s.ok('GET', '/api/lifeadmin')).reminders.some(r => /call Bob/i.test(r.text)));
  check('and it confirms in the chat', (await msgs()).some(m => !m.mine && /Reminder set.*call Bob/i.test(m.text)), await msgs());
  await send('help');
  check('help says what it can do', (await msgs()).some(m => /remind/.test(m.text) && /start my day/.test(m.text) && !m.mine));
  check('start my day opens the check-in', (await send('start my day')).openDay === true);
  const smBefore = (await s.ok('GET', '/api/chats/_watchman')).messages.length;
  const r1 = await send('how are you today?');
  check('other text starts its own run', r1.working === true, r1);
  check('its own agent answers in its chat, with pasay', !!(await until(async () => (await msgs()).some(m => !m.mine && m.text === 'Stub reply from sonnet'), 15000)), await msgs());
  check('the run is Sonnet, in data/assistant', callList().some(l => /^sonnet .*assistant/i.test(l)), callList());
  check('its folder has its brief and a notes file', /NOT the Lead Scrum Master/.test(fs.readFileSync(path.join(s.data, 'assistant', 'CLAUDE.md'), 'utf8')) && fs.existsSync(path.join(s.data, 'assistant', 'NOTES.md')));
  check('nothing says "Passed to the Lead Scrum Master"', !(await msgs()).some(m => /Passed to the Lead Scrum Master/.test(m.text)));
  check('and the Scrum Master chat got nothing', (await s.ok('GET', '/api/chats/_watchman')).messages.length === smBefore && !(await s.ok('GET', '/api/chats/_watchman')).messages.some(m => /how are you today/.test(m.text)));
  await until(async () => !(await s.ok('GET', '/api/chats/_assistant')).busy, 10000);
  // Its name
  check('default name', (await s.ok('GET', '/api/chats/_assistant')).name === '💚 Personal assistant');
  await send('please pick a name for yourself');
  check('it picks its own name', !!(await until(async () => (await s.ok('GET', '/api/chats/_assistant')).name === '💚 Juno', 15000)), await s.ok('GET', '/api/assistant'));
  await until(async () => !(await s.ok('GET', '/api/chats/_assistant')).busy, 10000);
  // No Token Mode: a plain line, no run
  await s.ok('POST', '/api/notokens', { on: true });
  const c0 = callList().length;
  await send('what should I eat?');
  check('No Token Mode: a plain one-line answer', (await msgs()).some(m => !m.mine && /No Token Mode is on/.test(m.text)), await msgs());
  await new Promise(r => setTimeout(r, 1200));
  check('and no run starts', callList().length === c0);
  await s.ok('POST', '/api/notokens', { on: false });
  // The page
  await page.click('#dmPanel [data-dm="_assistant"]');
  await page.waitForSelector('#dmText');
  await page.waitForFunction(() => /Reminder set/.test(document.getElementById('dmList').textContent));
  await page.fill('#dmText', 'help'); await page.press('#dmText', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#dmList .dm-msg.mine').length >= 7);
  check('typing in the page chat works', /remind you/.test(await page.textContent('#dmList')));
  const head = await page.textContent('#dmPanel .dm-head');
  check('header shows the chosen name once and what it does', /Juno/.test(head) && /Your day, reminders and life admin/.test(head) && !/Personal assistant/.test(head), head);
  await page.click('#dmPanel .dm-head button'); await page.waitForSelector('#dmPanel [data-dm="_assistant"]');
  check('the Messages row shows the name', /Juno/.test(await page.textContent('#dmPanel [data-dm="_assistant"]')));
  noErrors(page);
}, true, { AIGILE_AGENT_COMMAND: stub, AIGILE_LOCAL: local, AIGILE_NO_WINDOWS: '1', AIGILE_NO_USAGE_AUTO: '1' });
