// QA area: assistant (AIG-1021): quiet chats hide after 6 hours (not with unread), and the 💚 Personal assistant chat is pinned under
// All hands: "remind me at 3 to call Bob" makes a reminder, "help" answers, anything else is passed to the Lead Scrum Master.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, openPage, noErrors, until, def } from '../lib.mjs';

def('assistant', '💚 Personal assistant chat pinned under All hands (reminder, help, start my day, else relayed to the Scrum Master); quiet chats hide after 6 hours but not with unread (AIG-1021)', async (s, ctx) => {
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
  await send('remind me at 3 to call Bob');
  check('"remind me at 3 to call Bob" makes a reminder', (await s.ok('GET', '/api/lifeadmin')).reminders.some(r => /call Bob/i.test(r.text)));
  check('and it confirms in the chat', (await msgs()).some(m => !m.mine && /Reminder set.*call Bob/i.test(m.text)), await msgs());
  await send('help');
  check('help says what it can do', (await msgs()).some(m => /Lead Scrum Master/.test(m.text) && /remind/.test(m.text) && !m.mine));
  check('start my day opens the check-in', (await send('start my day')).openDay === true);
  await send('how are the teams doing?');
  check('other text is passed to the Lead Scrum Master', (await msgs()).some(m => /Passed to the Lead Scrum Master/.test(m.text)));
  check('and it is in the Scrum Master chat', !!(await until(async () => (await s.ok('GET', '/api/chats/_watchman')).messages.some(m => m.mine && /how are the teams doing/.test(m.text)))));
  // The page
  await page.click('#dmPanel [data-dm="_assistant"]');
  await page.waitForSelector('#dmText');
  await page.waitForFunction(() => /Reminder set/.test(document.getElementById('dmList').textContent));
  await page.fill('#dmText', 'help'); await page.press('#dmText', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#dmList .dm-msg.mine').length >= 5);
  check('typing in the page chat works', /remind you/.test(await page.textContent('#dmList')));
  noErrors(page);
}, true);
