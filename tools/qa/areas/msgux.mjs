// QA area: msgux (AIG-936, AIG-943, AIG-946): the Lead chat answers the chat itself (a plain message) unless you pick a card, and
// Go shows only for a Go? question; All hands asks "Send to N teams?" first; quiet chats (6 hours) hide with a link, a new message
// brings one back, newest first, plain-text previews. Dates are set relative to now.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, mkCard, openPage, noErrors, def, readChat, writeChat } from '../lib.mjs';

def('msgux', 'Messages: Lead chat defaults to a plain message, Go only on a Go? question; All hands asks first; quiet chats hide; plain previews (AIG-936/943/946)', async (s, ctx) => {
  const day = 86400000, ago = ms => new Date(Date.now() - ms).toISOString();
  for (const [n, k] of [['Mux Chat', 'MC'], ['Mux Old', 'MO'], ['Mux New', 'MN'], ['Mux Mid', 'MM']]) { await mkProject(s, n, k); await s.ok('POST', '/api/projects/' + n.toLowerCase().replace(' ', '-') + '/team', { name: 'Lead', role: 'Lead' }); }
  const go = await mkCard(s, 'mux-chat', 'Build the thing', { status: 'team' });
  await s.ok('POST', `/api/projects/mux-chat/cards/${go.id}/comments`, { author: 'Lead', text: 'Plan:\n- build it\n\nGO?', needsYou: true, mark: 'ask' });
  const yn = await mkCard(s, 'mux-chat', 'Colour', { status: 'team' });
  await s.ok('POST', `/api/projects/mux-chat/cards/${yn.id}/comments`, { author: 'Lead', text: 'Which colour do you want?', needsYou: true, mark: 'ask' });
  const say = (slug, text) => s.ok('POST', `/api/projects/${slug}/leadchat`, { text, author: 'Lead' });
  await say('mux-old', 'ancient news'); await say('mux-mid', 'two hours old'); await say('mux-new', '- **Bold plan** for `today`\n- second bullet');
  const back = (slug, ms) => { const f = path.join(s.data, slug + '.chat'), j = readChat(s, f); j.msgs.forEach(m => { m.at = ago(ms); }); j.readAt = ago(ms - 1000); writeChat(s, f, j); };   // sealed on disk (AIG-1170)
  back('mux-old', 5 * day); back('mux-mid', 2 * 3600000);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dm="mux-new"]');
  const order = async () => (await page.locator('#dmPanel .dm-list [data-dm]').evaluateAll(a => a.map(x => x.dataset.dm))).filter(k => k.startsWith('mux-'));
  check('newest activity first', (await order()).indexOf('mux-new') < (await order()).indexOf('mux-mid'), await order());
  const row = await page.textContent('#dmPanel [data-dm="mux-new"]');
  check('preview is plain text: no ** or leading bullet', /Mux NewLead . Bold plan for today/.test(row) && !/\*\*|`|Lead . -/.test(row), row);
  check('a chat quiet for 5 days is hidden', !(await order()).includes('mux-old'));
  check('a chat from two hours ago stays', (await order()).includes('mux-mid'));
  const q = page.locator('[data-dmshowquiet]');
  check('Show quiet chats link says how many', /1/.test(await q.textContent()), await q.textContent());
  await q.click();
  check('the link lists the quiet chat', (await order()).includes('mux-old') && /Hide/.test(await q.textContent()));
  await q.click();
  check('Hide puts it away again', !(await order()).includes('mux-old'));
  await say('mux-old', 'wake up');
  await page.evaluate(() => Dms.reload());
  await page.waitForSelector('#dmPanel .dm-list > .dm-rowwrap [data-dm="mux-old"]');
  check('a new message brings the quiet chat back, on top', (await order())[0] === 'mux-old' && !(await page.$('[data-dmshowquiet]')), await order());
  try { await page.screenshot({ path: (process.env.QA_SHOTS || process.env.TEMP || '.') + '/shot-msg-desk.png' }); } catch {}
  // Lead chat
  await page.click('#dmPanel [data-dm="mux-chat"]');
  await page.waitForSelector('#dmTarget');
  check('Reply to defaults to the Lead chat, not the last question', (await page.inputValue('#dmTarget')) === '_new');
  check('no Go button while a plain message is being written', await page.locator('#dmGo').isHidden());
  await page.fill('#dmText', 'Just saying hi');
  await page.press('#dmText', 'Enter');
  await page.waitForFunction(() => /Just saying hi/.test(document.getElementById('dmList').textContent));
  const chat = (await s.ok('GET', '/api/projects/mux-chat/leadchat')).messages.at(-1);
  check('it went to the Lead chat and the question still waits', chat && /Just saying hi/.test(chat.text) && (await s.ok('GET', '/api/projects/mux-chat')).cards.find(c => c.id === go.id).needsYou, chat);
  check('after sending it is still the Lead chat', (await page.inputValue('#dmTarget')) === '_new');
  await page.selectOption('#dmTarget', yn.id);
  await page.waitForFunction(() => document.getElementById('dmTarget').value !== '_new');
  check('picking a non-Go question shows no Go', await page.locator('#dmGo').isHidden());
  await page.selectOption('#dmTarget', go.id);
  await page.locator('#dmGo').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  check('picking a Go? question shows Go', await page.locator('#dmGo').isVisible());
  await page.click('#dmGo');
  await page.waitForFunction(async id => (await (await fetch('/api/projects/mux-chat')).json()).cards.find(x => x.id === id).comments.at(-1).text === 'GO', go.id, { timeout: 5000 });
  check('Go answered that card', true);
  // All hands
  await page.click('#dmPanel button[onclick="Dms.back()"]');
  await page.waitForSelector('[data-dm="_allhands"]');
  await page.click('[data-dm="_allhands"]');
  await page.fill('#dmText', 'Team meeting at ten');
  await page.press('#dmText', 'Enter');
  check('Enter asks "Send to N teams?" before sending', /\d+ teams/.test(await page.textContent('#allHandsAsk')) && await page.locator('#allHandsAsk').isVisible());
  const count = async () => { let n = 0; for (const p of await s.ok('GET', '/api/projects')) n += (await s.ok('GET', '/api/projects/' + p.slug)).cards.filter(c => c.allhands).length; return n; };
  check('nothing is sent yet', await count() === 0);
  await page.click('#allHandsNo');
  check('Cancel sends nothing', await count() === 0 && await page.locator('#allHandsAsk').isHidden());
  await page.click('#allHandsSend');
  await page.click('#allHandsYes');
  await page.waitForFunction(() => !document.getElementById('allHandsSend').disabled && !document.getElementById('dmText').value);
  check('Send in the question sends to every team', await count() === 4, await count());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.fill('#dmText', 'Phone check');
  await page.click('#allHandsSend');
  const box = await page.locator('#allHandsAsk').boundingBox();
  check('the question fits at 390px', box && box.x >= 0 && box.x + box.width <= 390, box);
  try { await page.screenshot({ path: (process.env.QA_SHOTS || process.env.TEMP || '.') + '/shot-msg-phone-dark.png' }); } catch {}
  noErrors(page);
}, true);
