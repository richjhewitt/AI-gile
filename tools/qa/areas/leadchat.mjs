// QA area: leadchat (AIG-872): one card-free Lead chat per project. A DM from the page lands there (no 💬 card), is pinned at the
// top of the Messages chat, wakes the lead (updates / brief list it, `aigile chat` reads and replies), and a lead reply waits in the inbox.
import { check, sleep, until, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

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
  await page.fill('.ib-item textarea', 'Thanks, go ahead');
  await page.click('.ib-item [data-act="send"]');
  await sleep(800);
  const after = await s.ok('GET', '/api/projects/chatty/leadchat');
  check('answering in the inbox goes to the Lead chat and clears the item', after.messages.at(-1).text === 'Thanks, go ahead' && !(await s.ok('GET', '/api/inbox')).some(i => i.leadChat), after.messages.at(-1));
  check('still no extra 💬 card', (await s.ok('GET', '/api/projects/chatty')).cards.filter(c => c.quick).length === 1);
  await noErrors(page);
}, true);
