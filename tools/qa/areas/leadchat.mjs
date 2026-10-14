// QA area: leadchat (AIG-872): one card-free Lead chat per project. A DM from the page lands there (no 💬 card), is pinned at the
// top of the Messages chat, wakes the lead (updates / brief list it, `aigile chat` reads and replies), and a lead reply waits in the inbox.
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, check, sleep, until, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('leadchat', '💬 Lead chat: DMs go to one chat per project, not a card each; pinned in Messages; aigile chat reads and replies; reply waits in the inbox (AIG-872)', async (s, ctx) => {
  await mkProject(s, 'Chatty', 'CHT');
  await s.ok('POST', '/api/projects/chatty/team', { name: 'Lead', role: 'Lead' });
  const old = await mkCard(s, 'chatty', '💬 old style', { status: 'team', quick: true, createdBy: 'Owner' });
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.click('#dmPanel [data-dm="chatty"]');
  await page.waitForSelector('#dmText');
  await page.waitForSelector('#dmTarget');
  await page.selectOption('#dmTarget', '_new');   // an old 💬 card is open in the chat: a new message is for the Lead chat
  await page.fill('#dmText', 'Hello lead, what about dark mode?');
  await page.press('#dmText', 'Enter');
  await until(async () => (await s.ok('GET', '/api/projects/chatty/leadchat')).messages.length);
  const cards = (await s.ok('GET', '/api/projects/chatty')).cards;
  check('the DM made no card (the old 💬 card is still the only one)', cards.length === 1 && cards[0].id === old.id, cards.map(c => c.title));
  const chat = await s.ok('GET', '/api/projects/chatty/leadchat');
  check('it is in the Lead chat, unanswered', chat.messages.length === 1 && chat.unanswered === 1 && /dark mode/.test(chat.messages[0].text), chat);
  await page.waitForFunction(() => /Lead chat/.test((document.querySelector('#dmList .dm-fold:first-child .dm-fold-h') || {}).textContent || ''));   // the page redraws after its own POST + reload, a moment after the API has the message
  check('the chat shows it in a pinned Lead chat fold', /Lead chat/.test(await page.textContent('#dmList .dm-fold:first-child .dm-fold-h')) && !(await page.$('#dmList .dm-fold:first-child .dm-fold-id')));
  const up = await s.ok('GET', '/api/projects/chatty/updates?peek=1');
  check('updates tells the lead (a wake like a new card)', up.cards.some(c => c.chat && c.items[0].text.includes('dark mode')) && up.chat === 1, up);
  const o = s.cli(['updates', 'chatty', '--peek']);
  check('aigile updates shows the message and how to answer', /Lead chat/.test(o.out) && /aigile chat chatty/.test(o.out), o.out);
  check('aigile brief lists it as unanswered', /Lead chat/.test(s.cli(['brief', 'chatty']).out) && /dark mode/.test(s.cli(['brief', 'chatty']).out));
  check('aigile chat shows recent messages', /dark mode/.test(s.cli(['chat', 'chatty']).out));
  const card = await mkCard(s, 'chatty', 'Dark mode', { status: 'backlog' });
  const r = s.cli(['chat', 'chatty', `Made ${card.id} for it.`, '--as', 'Lead']);
  check('aigile chat "text" --as replies', r.code === 0 && (await s.ok('GET', '/api/projects/chatty/leadchat')).unanswered === 0, r);
  const inbox = await s.ok('GET', '/api/inbox');
  check('the reply waits in the inbox', inbox.some(i => i.leadChat && i.project === 'chatty' && i.id === 'chat'), inbox.map(i => i.id));
  await page.goto(page.url().replace(/#.*/, '') + '#/inbox');
  await page.waitForSelector('#ib .ib-item, .ib-item', { timeout: 8000 });
  check('the inbox item says Lead chat and links the card id', /Lead chat/.test(await page.textContent('.ib-item')) && !!(await page.$(`.ib-item a[href="#/p/chatty/${card.id}"]`)));
  check('a Lead chat item has no ⤢ pop-out (it would open a card that no longer exists)', !(await page.$('.ib-item .ib-popone')));   // AIG-1016
  await page.fill('.ib-item textarea', 'Thanks, go ahead');
  await page.click('.ib-item [data-act="send"]');
  await sleep(800);
  const after = await s.ok('GET', '/api/projects/chatty/leadchat');
  check('answering in the inbox goes to the Lead chat and clears the item', after.messages.at(-1).text === 'Thanks, go ahead' && !(await s.ok('GET', '/api/inbox')).some(i => i.leadChat), after.messages.at(-1));
  check('still no extra 💬 card', (await s.ok('GET', '/api/projects/chatty')).cards.filter(c => c.quick).length === 1);
  // AIG-964: "remind me at 3 to X" from the owner makes a life-admin reminder with no AI; the board answers in the chat. Expectations come from "now".
  const { parseRemind: pr } = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'lifeadmin.js'));
  const at = new Date(2026, 5, 10, 10, 0, 0).getTime(), hm = d => d && `${d.getDate() - 10}|${d.getHours()}:${d.getMinutes()}`;   // a fixed local 10:00; day offset from the 10th
  const cases = [['remind me at 15:00 to call the barber', '0|15:0'], ['remind me at 3pm to call the barber', '0|15:0'], ['remind me at 3:30pm to x', '0|15:30'],
    ['remind me at 3 to x', '0|15:0'], ['remind me at 11 to x', '0|11:0'], ['remind me at 9 to x', '0|21:0'], ['remind me at 8:15 to x', '0|20:15'],
    ['remind me at 09:00 to x', '1|9:0'], ['remind me at 21:00 to x', '0|21:0'], ['remind me at 9am to x', '1|9:0'], ['remind me tomorrow at 3pm to x', '1|15:0'], ['remind me at 3pm tomorrow to x', '1|15:0'],
    ['remind me to call the barber at 15:00', '0|15:0'], ['remind me to x at 3pm tomorrow', '1|15:0'], ['Remind me at 3 to x.', '0|15:0']];
  for (const [t, want] of cases) check('parse "' + t + '"', hm(pr(t, at) && pr(t, at).due) === want, pr(t, at));
  check('parse keeps the text', pr('remind me to call the barber at 15:00', at).text === 'call the barber' && pr('remind me at 3 to call the barber', at).text === 'call the barber');
  check('parse refuses what it cannot read', ['remind me', 'remind me later to x', 'remind me at 25:00 to x', 'remind me at 13pm to x', 'remind me at 3 to ', 'please remind me at 3 to x', 'hello'].every(t => pr(t, at) === null));
  const lifeBefore = (await s.ok('GET', '/api/lifeadmin')).reminders.length, nowMs = Date.now();
  await s.ok('POST', '/api/projects/chatty/leadchat', { author: 'Owner', text: 'remind me at 3 to call the barber' });
  const reps = (await s.ok('GET', '/api/lifeadmin')).reminders, made = reps.filter(r => r.text === 'call the barber');
  const want = [0, 1].flatMap(dd => [3, 15].map(h => { const d = new Date(nowMs); d.setDate(d.getDate() + dd); d.setHours(h, 0, 0, 0); return d.getTime(); })).filter(x => x > nowMs - 5000).sort((a, b) => a - b)[0];
  check('the reminder was made with the next 3 o\'clock as its due time', reps.length === lifeBefore + 1 && made.length === 1 && Math.abs(Date.parse(made[0].due) - want) < 1000, made);
  const c2 = await s.ok('GET', '/api/projects/chatty/leadchat'), last = c2.messages.at(-1);
  check('the board posted a reply in the chat', last.author === 'Board' && !last.mine && /call the barber/.test(last.text) && /\d\d:\d\d/.test(last.text), last);
  check('the owner message was still saved and the reply is not a lead answer', c2.messages.at(-2).text === 'remind me at 3 to call the barber' && c2.unanswered === 2,   // "Thanks, go ahead" + the reminder message: the board's reply does not count as the lead answering
 c2.messages.slice(-2));
  check('the reply is not owner news for the lead', !JSON.stringify((await s.ok('GET', '/api/projects/chatty/updates?peek=1')).cards.filter(c => c.chat)).includes('Reminder set'));
  check('the reply did not land in the firewall bin', !JSON.stringify(await s.ok('GET', '/api/firewall')).includes('Reminder set'));
  await s.ok('POST', '/api/projects/chatty/leadchat', { author: 'Lead', text: 'remind me at 3 to feed the cat' });
  await s.ok('POST', '/api/projects/chatty/leadchat', { author: 'Owner', text: 'remind me at the weekend' });
  const after2 = await s.ok('GET', '/api/lifeadmin');
  check('a team message makes no reminder, an unreadable one neither', after2.reminders.length === lifeBefore + 1 && !after2.reminders.some(r => /feed the cat/.test(r.text)), after2.reminders.map(r => r.text));
  check('an unreadable message gets no board reply', (await s.ok('GET', '/api/projects/chatty/leadchat')).messages.at(-1).text === 'remind me at the weekend');
  await noErrors(page);
}, true);
