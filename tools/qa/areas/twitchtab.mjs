// QA area: twitchtab (AIG-628). The Twitch tab in the DM window: hidden with no channel, Setup box saves the channel, stub chat
// messages show (name, colour, text), newest at the bottom, live updating. No network: AIGILE_TWITCH_STUB stands in for Twitch.
import { createRequire } from 'node:module';
import { check, until, openPage, noErrors, def } from '../lib.mjs';

def('twitchtab', 'Twitch tab in the DM window: hidden with no channel, set in Setup, chat shown newest at the bottom and live (AIG-628)', async (s, ctx) => {
  const cfg0 = await s.ok('GET', '/api/twitch/config');
  check('no channel: config empty and no messages', cfg0.channel === '' && (await s.ok('GET', '/api/twitch/messages')).length === 0, cfg0);
  check('a bad channel name is refused', (await s.api('POST', '/api/twitch/config', { channel: 'no spaces!' })).status === 400);

  const page = await openPage(ctx, '#/setup');
  await page.click('#dmRail [data-dms]'); await page.waitForSelector('#dmPanel .dm-filter');
  check('no channel: there is no Twitch tab', await page.locator('[data-dmfilter="twitch"]').count() === 0);

  // Set the channel in Setup with real clicks
  await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#twSave');
  await page.fill('#twChannel', '#SmizFlark'); await page.click('#twSave');
  await page.waitForFunction(() => /Saved|Opgeslagen/.test(document.getElementById('twState').textContent));
  check('Setup saved the channel, lower case, without the #', (await s.ok('GET', '/api/twitch/config')).channel === 'smizflark');

  // Chat arrives
  await s.ok('POST', '/api/twitch/stub-message', { name: 'Alice', color: '#ff0000', content: 'first message' });
  await s.ok('POST', '/api/twitch/stub-message', { name: 'Bob', content: 'second <b>message</b>' });
  const all = await s.ok('GET', '/api/twitch/messages');
  check('messages come oldest first, with ids, and only new ones after an id', all.length === 2 && all[0].name === 'Alice' && all[0].color === '#ff0000' && all[1].color === '' && (await s.ok('GET', '/api/twitch/messages?after=' + all[0].id)).length === 1, all);

  const pg = await openPage(ctx, '#/');
  await pg.click('#dmRail [data-dms]');
  await pg.waitForSelector('[data-dmfilter="twitch"]');
  check('with a channel the Twitch tab appears', true);
  await pg.click('[data-dmfilter="twitch"]');
  await pg.waitForSelector('#dmPanel .dm-row');
  check('the tab lists the channel', /#smizflark/.test(await pg.textContent('#dmPanel .dm-row')));
  await pg.click('#dmPanel .dm-row');
  await pg.waitForSelector('#dmList .tw-msg');
  const names = await pg.locator('#dmList .tw-name').allTextContents();
  check('chat shows both messages in order', names.join() === 'Alice,Bob', names);
  check('the colour is applied and text is escaped', /rgb\(255, 0, 0\)/.test(await pg.locator('#dmList .tw-name').first().evaluate(e => getComputedStyle(e).color)) && /second <b>message<\/b>/.test(await pg.textContent('#dmList')));

  // Live
  await s.ok('POST', '/api/twitch/stub-message', { name: 'Carol', content: 'live one' });
  await pg.waitForFunction(() => /live one/.test(document.getElementById('dmList').textContent), null, { timeout: 10000 });
  const last = await pg.locator('#dmList .tw-name').last().textContent();
  check('a new message appears live at the bottom', last === 'Carol', last);
  // AIG-1120: the Twitch pop-out window keeps polling
  const tp = await openPage(ctx, '#/'); await tp.goto(s.base + '/#/pop-twitch'); await tp.reload(); await tp.waitForSelector('#twPop #dmList .tw-msg');
  await s.ok('POST', '/api/twitch/stub-message', { name: 'Dave', content: 'popout live' });
  await tp.waitForFunction(() => /popout live/.test(document.getElementById('dmList').textContent), null, { timeout: 10000 });
  check('the Twitch pop-out shows a new message live', true);
  await tp.close();
  check('no token: there is no reply box (read-only)', await pg.locator('#twText').count() === 0 && (await s.ok('GET', '/api/twitch/config')).canReply === false);
  check('no token: sending is refused', (await s.api('POST', '/api/twitch/send', { text: 'hi' })).status === 400);
  check('a bad token is refused', (await s.api('POST', '/api/twitch/token', { login: 'smizflark', token: 'short', secretsToken: (await s.ok('GET', '/api/secrets/token')).token })).status === 400);

  // Sign in to reply (Setup box, real clicks), then the reply box shows and Enter sends
  const su = await openPage(ctx, '#/setup'); await su.waitForSelector('#twOther', { state: 'attached' }); await su.click('#twOther summary');   // AIG-1346: the paste way sits under Other ways
  await su.waitForSelector('#twSignIn');
  await su.fill('#twLogin', 'SmizFlark'); await su.fill('#twToken', 'oauth:abcdefghijklmnopqrstuvwxyz0123'); await su.click('#twSignIn');
  await su.waitForSelector('#twOut');
  const c1 = await s.ok('GET', '/api/twitch/config');
  check('signed in: canReply and the login, and the token is never sent to the page', c1.canReply === true && c1.login === 'smizflark' && !JSON.stringify(c1).includes('abcdefghijkl'), c1);
  await su.close();
  await pg.waitForSelector('#twText', { timeout: 10000 });
  await pg.fill('#twText', 'hello from me'); await pg.press('#twText', 'Enter');
  await pg.waitForFunction(() => /hello from me/.test(document.getElementById('dmList').textContent), null, { timeout: 10000 });
  const sent = await s.ok('GET', '/api/twitch/stub-sent');
  check('Enter sent it (recorded by the stub) and it shows in the list as me', sent.length === 1 && sent[0].text === 'hello from me' && sent[0].login === 'smizflark' && await pg.locator('#dmList .tw-name').last().textContent() === 'smizflark' && await pg.inputValue('#twText') === '', sent);

  // Pop out
  const popP = ctx.waitForEvent('page');
  await pg.click('#twPopBtn');
  const pop = await popP; await pop.waitForLoadState();
  await pop.waitForSelector('#twPop .tw-msg', { timeout: 10000 });
  check('the pop-out shows the chat with the reply box', /live one/.test(await pop.textContent('#dmList')) && await pop.locator('#twText').count() === 1);
  await pop.fill('#twText', 'from the pop-out'); await pop.press('#twText', 'Enter');
  await pop.waitForFunction(() => /from the pop-out/.test(document.getElementById('dmList').textContent), null, { timeout: 10000 });
  check('replying from the pop-out sends', (await s.ok('GET', '/api/twitch/stub-sent')).length === 2);
  await pop.close();
  await s.ok('POST', '/api/twitch/token', { login: '', token: '', secretsToken: (await s.ok('GET', '/api/secrets/token')).token });
  check('signing out removes the reply ability', (await s.ok('GET', '/api/twitch/config')).canReply === false);

  // 💡 !idea (AIG-630): a viewer's idea lands as an unaccepted backlog card, with guards
  await s.ok('POST', '/api/projects', { name: 'Idealand' });
  const ideas = async () => (await s.ok('GET', '/api/projects/idealand')).cards.filter(c => c.createdBy === 'Ideas');
  const say = (name, content) => s.ok('POST', '/api/twitch/stub-message', { name, content });
  await say('Dana', '!idea');
  await say('Dana', '!idea    ');
  check('an empty !idea is ignored', (await ideas()).length === 0);
  await say('Dana', '!idea a dark mode for the board');
  let il = await ideas();
  check('!idea makes a backlog idea card that needs the owner, not in To do', il.length === 1 && il[0].status === 'backlog' && il[0].needsYou === true && il[0].quick === true && /dark mode/.test(il[0].title) && /Dana/.test(il[0].description), il);
  await say('Dana', '!idea a second one straight away');
  check('one idea per viewer per minute', (await ideas()).length === 1);
  await say('Eli', '!idea ' + 'x'.repeat(500));
  il = await ideas();
  check('a long idea is cut at 200 characters, from another viewer it still counts', il.length === 2 && il.every(c => c.description.split('\n')[0].length <= 200), il.map(c => c.description.length));
  await say('Fay', 'idea without the bang');
  check('plain chat is not an idea', (await ideas()).length === 2);

  // Switch off
  await s.ok('POST', '/api/twitch/config', { channel: '' });
  check('clearing the channel clears the chat', (await s.ok('GET', '/api/twitch/messages')).length === 0);
  noErrors(pg); await pg.close();

  // The IRC line parser (tags, colour, display name)
  const tw = createRequire(import.meta.url)('../../../lib/twitch.js');
  const p = tw.parse('@badges=;color=#1E90FF;display-name=Zed;tmi-sent-ts=1700000000000 :zed!zed@zed.tmi.twitch.tv PRIVMSG #chan :hi there');
  check('parse reads name, colour, text and time', p && p.name === 'Zed' && p.color === '#1E90FF' && p.text === 'hi there' && p.at.startsWith('2023-11-14'), p);
  check('parse ignores other lines', tw.parse(':tmi.twitch.tv 001 justinfan1 :Welcome') === null);
}, true, { AIGILE_TWITCH_STUB: '1' });
