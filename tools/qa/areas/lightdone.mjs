// QA area: light done cards (AIG-1100). The board GET sends done cards without their heavy fields; opening one fetches it whole; Done shows 50 + Load more.
import { BASE, check, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('lightdone', 'done cards come light on the board GET, open whole (card, pop-out, search); Done shows 50 + Load more (AIG-1100)', async (s, ctx) => {
  await mkProject(s, 'Lite', 'LIT');
  const first = await mkCard(s, 'lite', 'Old finished work', { description: 'The zebrafinch description', testSteps: 'Click the thing' });
  await say(s, 'lite', first.id, 'Dev', 'A comment about walruses');
  await s.ok('PATCH', `/api/projects/lite/cards/${first.id}`, { status: 'done' });
  for (let i = 0; i < 54; i++) { const c = await mkCard(s, 'lite', 'Done ' + i); await s.ok('PATCH', `/api/projects/lite/cards/${c.id}`, { status: 'done' }); }
  const open = await mkCard(s, 'lite', 'Still open', { status: 'todo', description: 'open desc' });

  const p = await s.ok('GET', '/api/projects/lite'), d = p.cards.find(c => c.id === first.id), o = p.cards.find(c => c.id === open.id);
  check('a done card comes light', d && d.light === true && d.description === undefined && d.testSteps === undefined && Array.isArray(d.comments) && !d.comments.length && d.nComments >= 1, d);
  check('a done card keeps what the board card shows', d && d.title === 'Old finished work' && d.status === 'done' && d.type && d.priority && d.updated);
  check('an open card stays whole', o && !o.light && o.description === 'open desc');
  const full = await s.ok('GET', '/api/projects/lite?full=1');
  check('?full=1 sends done cards whole', full.cards.find(c => c.id === first.id).description === 'The zebrafinch description');
  const one = await s.ok('GET', `/api/projects/lite/cards/${first.id}`);
  check('GET one card is whole', one.description === 'The zebrafinch description' && one.comments.some(m => /walruses/.test(m.text)) && !one.light, one);
  check('the search route finds a done card by its description', (await s.ok('GET', '/api/projects/lite/find?q=zebrafinch')).ids.includes(first.id));

  const page = await openPage(ctx, '#/p/lite');
  await page.waitForSelector('.column[data-status=done] .card');
  check('Done shows the newest 50', (await page.locator('.column[data-status=done] .card').count()) === 50);
  check('Done has a Load more button', (await page.locator('.column[data-status=done] .done-more').count()) === 1);
  await page.click('.column[data-status=done] .done-more');
  await page.waitForTimeout(800);
  check('Load more shows the rest', (await page.locator('.column[data-status=done] .card').count()) === 55 && (await page.locator('.column[data-status=done] .done-more').count()) === 0);
  check('the 💬 count shows on a light card', /💬 1/.test(await page.textContent(`.card[data-id="${first.id}"]`)));

  await page.goto(BASE + `/#/p/lite/${first.id}`);
  await page.waitForSelector('#modal .panel');
  await page.waitForTimeout(800);
  const panel = await page.textContent('#modal .panel');
  check('opening a done card fetches it whole (comments)', /walruses/.test(panel), panel.slice(0, 300));

  await page.goto(BASE + '/#/p/lite');
  await page.waitForSelector('#f-q');
  await page.fill('#f-q', 'zebrafinch');
  await page.waitForTimeout(1500);
  check('search finds a light done card by its description', (await page.locator(`.card[data-id="${first.id}"]`).count()) === 1);
  await page.fill('#f-q', '');

  const w = ctx.waitForEvent('page');
  await page.evaluate(i => window.open('#/pop/lite/' + i, 'aigile-lite-' + i, 'width=560,height=780'), first.id);
  const pop = await w; pop.errors = []; pop.on('pageerror', e => pop.errors.push(String(e)));
  await pop.waitForSelector('#modal .panel');
  await pop.waitForTimeout(800);
  check('a popped-out done card is whole', /walruses/.test(await pop.textContent('#modal .panel')));
  noErrors(page); noErrors(pop);
}, true);
