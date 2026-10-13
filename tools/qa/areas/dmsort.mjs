// QA area: dmsort (AIG-917): Messages list sorted by latest message (newest first, All hands pinned), unread obvious,
// a ✕ closes a chat (history kept, Show closed lists it, a new message brings it back).
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('dmsort', 'Messages: newest chat first, All hands pinned, ✕ Close hides a chat (Show closed lists it, a new message brings it back) (AIG-917)', async (s, ctx) => {
  for (const [n, k] of [['Sort One', 'SO'], ['Sort Two', 'ST'], ['Sort Three', 'SH']]) { await mkProject(s, n, k); await s.ok('POST', '/api/projects/' + n.toLowerCase().replace(' ', '-') + '/team', { name: 'Lead', role: 'Lead' }); }
  const say = async (slug, text) => { await s.ok('POST', `/api/projects/${slug}/leadchat`, { text, author: 'Lead' }); await sleep(30); };
  const q = await mkCard(s, 'sort-three', 'A question', { status: 'team' });
  await s.ok('POST', `/api/projects/sort-three/cards/${q.id}/comments`, { author: 'Lead', text: 'Which colour?', needsYou: true, mark: 'ask' });
  await sleep(30);
  await say('sort-two', 'first'); await say('sort-three', 'second'); await say('sort-one', 'third');
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dm="sort-one"]');
  const order = async () => (await page.locator('#dmPanel .dm-list [data-dm]').evaluateAll(a => a.map(x => x.dataset.dm))).filter(k => k.startsWith('sort-') || k === '_allhands');
  let o = await order();
  check('All hands first, then newest chat first', o.join() === '_allhands,sort-one,sort-three,sort-two', o);
  check('an unread chat has an obvious mark', await page.locator('#dmPanel .dm-rowwrap.unread [data-dm="sort-one"]').count() === 1 && await page.locator('#dmPanel [data-dm="sort-one"] .dm-unread').count() === 1);
  const row = await page.textContent('#dmPanel [data-dm="sort-one"]');
  check("row shows the project name first, then lead and the message preview", /Sort OneLead . third/.test(row) && !/^\W*Lead/.test(row), row);
  const row3 = await page.textContent('#dmPanel [data-dm="sort-three"]');
  check('the preview keeps every letter (no lost s)', /Lead . second/.test(row3), row3);
  const dir = process.env.QA_SHOTS || process.env.TEMP || '.';
  try { await page.screenshot({ path: dir + '/dmsort-list2.png' }); } catch {}
  await say('sort-two', 'newest now');
  await page.evaluate(() => Dms.reload());
  await page.waitForFunction(() => document.querySelector('#dmPanel .dm-list [data-dm="sort-two"]') === document.querySelectorAll('#dmPanel .dm-list [data-dm]')[1]);
  check('a new message moves its chat to the top', (await order()).join() === '_allhands,sort-two,sort-one,sort-three', await order());
  for (const k of ['sort-one', 'sort-two']) await s.ok('GET', '/api/chats/' + k);   // opening a chat reads it
  await page.evaluate(() => Dms.reload());
  await sleep(300);
  await page.click('#dmPanel [data-dmclose="sort-three"]');
  await sleep(500);
  check('a chat with a question waiting on you stays even when closed', (await order()).includes('sort-three'));
  await page.click('#dmPanel [data-dmclose="sort-one"]');
  await page.waitForFunction(() => !document.querySelector('#dmPanel .dm-list > .dm-rowwrap [data-dm="sort-one"]'));
  check('closed chat is gone from the list', !(await order()).includes('sort-one'));
  check('it is stored on the server', !!(await s.ok('GET', '/api/dmclosed'))['sort-one']);
  check('Show closed (1) is at the bottom', /1/.test(await page.textContent('[data-dmshowclosed]')));
  await page.click('[data-dmshowclosed]');
  check('Show closed lists it', await page.locator('.dm-closed [data-dm="sort-one"]').count() === 1);
  await page.click('.dm-closed [data-dm="sort-one"]');
  await page.waitForSelector('#dmList .dm-fold');
  check('its history is untouched', /third/.test(await page.textContent('#dmList')));
  await page.click('#dmPanel button[onclick="Dms.back()"]');
  await page.waitForSelector('#dmPanel [data-dmfilter]');
  await say('sort-one', 'back again');
  await page.evaluate(() => Dms.reload());
  await page.waitForSelector('#dmPanel .dm-list > .dm-rowwrap [data-dm="sort-one"]');
  o = await order();
  check('a new message brings it back, on top', o[1] === 'sort-one' && !(await page.$('[data-dmshowclosed]')), o);
  noErrors(page);
}, true);
