// QA area: raisebug (AIG-733), the Raise bug button: always there, red, next to the project name, opens on top.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('raisebug', 'Raise bug button: on board, card view and Setup; left of the spacer; danger colour; opens on top; Submit keeps the open card (AIG-733)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const card = await mkCard(s, 'alpha', 'Open me');
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#bugBtn');
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await sleep(800); };
  const shown = () => page.evaluate(() => { const b = document.getElementById('bugBtn'), r = b.getBoundingClientRect(); return getComputedStyle(b).display !== 'none' && r.width > 0 && r.height > 0; });
  const left = () => page.evaluate(() => !!(document.getElementById('bugBtn').compareDocumentPosition(document.querySelector('header .spacer')) & Node.DOCUMENT_POSITION_FOLLOWING));
  check('visible on the board', await shown());
  check('left of the spacer, next to the project name', await left());
  const col = await page.evaluate(() => { const p = document.createElement('i'); p.style.color = 'var(--danger)'; document.body.appendChild(p); const d = getComputedStyle(p).color; p.remove(); return { d, c: getComputedStyle(document.getElementById('bugBtn')).color }; });
  check('coloured with the danger colour', col.d === col.c, JSON.stringify(col));
  await go(`#/p/alpha/${card.id}`);
  check('visible in the card view', await shown());
  await go('#/setup'); await page.waitForSelector('#tbList');
  check('visible in Setup', await shown());
  // Open it over a card, submit, the card stays open
  await go(`#/p/alpha/${card.id}`);
  const hash = await page.evaluate(() => location.hash);
  try { await page.click('#bugBtn', { timeout: 4000 }); } catch (e) { check('clicked', false, e.message.slice(0, 900)); return; }
  await page.waitForSelector('#f-title');
  const top = await page.evaluate(() => { const o = document.querySelector('#dialog .overlay'), r = o.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + 5); return { z: Number(getComputedStyle(o).zIndex), hit: !!e.closest('#dialog') }; });
  check('the dialog opens above everything else', top.z >= 1000 && top.hit, JSON.stringify(top));
  await page.fill('#f-title', 'Raised over a card');
  await page.click('#dialog button[type=submit]'); await page.waitForSelector('#f-title', { state: 'detached' }); await sleep(500);
  check('after Submit the same card is still open', (await page.evaluate(() => location.hash)) === hash && (await page.evaluate(() => state.route.id || state.route.card || location.hash)).toString().includes(card.id));
  const bugs = (await s.ok('GET', '/api/projects/alpha')).cards.filter(c => c.title.includes('Raised over a card'));
  check('a new bug card exists', bugs.length === 1 && bugs[0].type === 'bug', JSON.stringify(bugs.map(b => b.type)));
  noErrors(page);
}, true);

def('raisebug-once', 'Raise bug: opening the dialog several times then sending (even clicked twice) makes one card; two identical POSTs within 10 s make one card (AIG-1061)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#bugBtn');
  for (let i = 0; i < 4; i++) { await page.click('#bugBtn'); await page.waitForSelector('#f-title'); await page.click('#dialog button[type=button]'); await page.waitForSelector('#f-title', { state: 'detached' }); }
  await page.click('#bugBtn'); await page.waitForSelector('#f-title');
  await page.fill('#f-title', 'Sent once only');
  await page.evaluate(() => { const b = document.querySelector('#dialog button[type=submit]'); b.click(); b.click(); document.querySelector('#dialog form').requestSubmit(); });
  await page.waitForSelector('#f-title', { state: 'detached' }); await sleep(800);
  check('one card from many opens and a double send', (await s.ok('GET', '/api/projects/alpha')).cards.filter(c => c.title === 'Sent once only').length === 1);
  const a = await mkCard(s, 'alpha', 'Same twice', { description: 'same text', createdBy: 'Owner' });
  const b = await mkCard(s, 'alpha', 'Same twice', { description: 'same text', createdBy: 'Owner' });
  check('two identical POSTs make one card', a.id === b.id && (await s.ok('GET', '/api/projects/alpha')).cards.filter(c => c.title === 'Same twice').length === 1, { a: a.id, b: b.id });
  const c = await mkCard(s, 'alpha', 'Same twice', { description: 'other text', createdBy: 'Owner' });
  check('different text is a new card', c.id !== a.id);
  noErrors(page);
}, true);
