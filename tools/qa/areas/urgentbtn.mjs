// QA area: urgentbtn (AIG-899), one click to mark any card urgent, again to put the old priority back.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('urgentbtn', '🔥 button: a tile click makes the card urgent, a second click restores the old priority, also from the open card (AIG-899)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Plain card');
  await s.ok('PATCH', `/api/projects/alpha/cards/${a.id}`, { priority: 'high' });
  const page = await openPage(ctx, '#/p/alpha');
  const sel = `.card[data-id="${a.id}"] .urg-btn`;
  await page.waitForSelector(sel, { state: 'attached' });
  check('tile has the Mark urgent tooltip', (await page.getAttribute(sel, 'title')) === 'Mark urgent');
  await page.hover(`.card[data-id="${a.id}"]`);
  await page.click(sel);
  await page.waitForSelector(`.card[data-id="${a.id}"].is-urgent`);
  let c = await getCard(s, 'alpha', a.id);
  check('one click: urgent, old priority kept', c.priority === 'urgent' && c.prevPriority === 'high', JSON.stringify([c.priority, c.prevPriority]));
  check('tile shows urgent pill and the Not urgent tooltip', /Urgent/i.test(await page.textContent(`.card[data-id="${a.id}"]`)) && (await page.getAttribute(sel, 'title')) === 'Not urgent any more');
  await page.hover(`.card[data-id="${a.id}"]`);
  await page.click(sel);
  await page.waitForSelector(`.card[data-id="${a.id}"]:not(.is-urgent)`);
  c = await getCard(s, 'alpha', a.id);
  check('second click: back to high, no dialog', c.priority === 'high' && !c.prevPriority, JSON.stringify([c.priority, c.prevPriority]));
  const open = await openPage(ctx, `#/p/alpha/${a.id}`);
  await open.waitForSelector('.actions .urg-btn');
  await open.click('.actions .urg-btn');
  await sleep(500);
  c = await getCard(s, 'alpha', a.id);
  check('open card: urgent', c.priority === 'urgent' && c.prevPriority === 'high', JSON.stringify([c.priority, c.prevPriority]));
  await open.click('.actions .urg-btn');
  await sleep(500);
  c = await getCard(s, 'alpha', a.id);
  check('open card: back again', c.priority === 'high', c.priority);
  // inbox rows: a real card row has the button and it works; the Lead chat row (not a card) has none
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const q = await mkCard(s, 'alpha', 'Question card', { status: 'doing' });
  s.cli(['ask', 'alpha', q.id, 'Go?', '--as', 'Lead']);
  await s.ok('POST', '/api/projects/alpha/leadchat', { text: 'hello lead' });
  s.cli(['chat', 'alpha', 'Reply for you', '--as', 'Lead']);
  const ib = await openPage(ctx, '#/inbox');
  await ib.waitForSelector(`.ib-item[data-id="${q.id}"]`);
  await ib.waitForSelector('.ib-item[data-id="chat"]');
  check('Lead chat inbox row has no fire button', (await ib.locator('.ib-item[data-id="chat"] .urg-btn').count()) === 0);
  await ib.click(`.ib-item[data-id="${q.id}"] .urg-btn`);
  await sleep(600);
  c = await getCard(s, 'alpha', q.id);
  check('inbox card row: click makes it urgent', c.priority === 'urgent', c.priority);
  await noErrors(page); await noErrors(open); await noErrors(ib);
}, true);
