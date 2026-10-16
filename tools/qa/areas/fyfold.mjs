// QA area: fyfold (AIG-738): a For you chip or card opens one window with the chip's cards, folded; a row unfolds in place.
import { check, sleep, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('fyfold', 'For you: a chip opens a window of folded rows, a card opens it unfolded on its chip, Accept inside updates the list (AIG-738)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const reads = [];
  for (const n of ['One', 'Two', 'Three']) {
    const c = await mkCard(s, 'alpha', 'Read ' + n);
    s.cli(['test', 'alpha', c.id, 'Nothing to click: note about ' + n, '--info', '--as', 'Lead']);
    reads.push(c);
  }
  const tests = [];
  for (const n of ['Alpha', 'Beta']) {
    const c = await mkCard(s, 'alpha', 'Check ' + n);
    s.cli(['test', 'alpha', c.id, '1. Click **Go** for ' + n + '\n2. It works', '--as', 'Lead']);
    tests.push(c);
  }
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .fy-chip');
  await page.waitForFunction(() => /^\s*📖/.test(document.querySelector('.fy-chip[data-first="r"]')?.textContent) && /3/.test(document.querySelector('.fy-chip[data-first="r"]').textContent));
  await page.click('.fy-chip[data-first="r"]');
  await page.waitForSelector('.fyf-row');
  check('the To read chip opens a window with 3 rows', (await page.locator('.fyf-row').count()) === 3);
  check('all rows start folded', (await page.locator('.fyf-row.open').count()) === 0 && (await page.locator('.fyf-b:visible').count()) === 0);
  const first = page.locator('.fyf-row').first();
  const rowId = await first.getAttribute('data-id');
  check('a row shows the id, the type and the title', (await first.locator('.fyf-h').textContent()).includes(rowId) && (await first.locator('.fyf-h .pill').count()) === 1 && /Read/.test(await first.locator('.fyf-t').textContent()));
  await first.locator('.fyf-h').click();
  await page.waitForSelector('.fyf-row.open .ib-item');
  check('a click unfolds it with the description', /Nothing to click: note about/.test(await first.locator('.fyf-b').textContent()));
  check('the others stay folded', (await page.locator('.fyf-row.open').count()) === 1);
  check('its Got it and Reply buttons are there', (await first.locator('[data-act="gotit"]').count()) === 1 && (await first.locator('[data-act="inforeply"]').count()) === 1);
  await page.keyboard.press('Escape');
  check('Esc closes the window', (await page.locator('.fyf').count()) === 0);
  // AIG-1033: a To read card the inbox list lacks (project not picked for today, snoozed) still opens, from the column card and from its row.
  await page.evaluate(() => { IB.raw = []; IB.items = []; });
  await page.click(`.column.foryou .card[data-id="${reads[1].id}"] .t`);
  await page.waitForSelector('.fyf[data-kind="r"] .fyf-row.open');
  check('a To read card opens from the column even when the inbox list lacks it', (await page.locator('.fyf-row.open .fyf-b [data-act="gotit"]').count()) === 1 && /Nothing to click: note about Two/.test(await page.locator('.fyf-row.open .fyf-b').textContent()));
  await page.locator('.fyf-row:not(.open) .fyf-h').first().click();
  check('its row unfolds the same way', (await page.locator('.fyf-row.open .fyf-b [data-act="gotit"]').count()) === 2);
  await page.keyboard.press('Escape');

  // AIG-1067: with the inbox list empty, Reply and Got it on a To read item take it out of the fold; the empty fold closes.
  for (const act of ['inforeply', 'gotit']) {
    await page.evaluate(() => { IB.raw = []; IB.items = []; });
    const left = await page.locator('.column.foryou .card[data-id]').evaluateAll((els, ids) => els.filter(e => ids.includes(e.dataset.id)).map(e => e.dataset.id), reads.map(r => r.id));
    if (!left.length) { check('a To read card is left for ' + act, false); continue; }
    await page.click(`.column.foryou .card[data-id="${left[0]}"] .t`);
    await page.waitForSelector('.fyf[data-kind="r"] .fyf-row.open');
    const n0 = await page.locator('.fyf-row').count();
    if (act === 'inforeply') await page.fill('.fyf-row.open textarea', 'Thanks, noted');
    await page.click(`.fyf-row.open [data-act="${act}"]`);
    await page.waitForFunction(n => document.querySelectorAll('.fyf-row').length < n, n0, { timeout: 5000 }).catch(() => {});
    check(act + ' takes the item out of the fold', (await page.locator(`.fyf-row[data-id="${left[0]}"]`).count()) === 0);
    if (n0 === 1) check(act + ' closes the empty fold', (await page.locator('.fyf').count()) === 0);
    else await page.keyboard.press('Escape');
    await sleep(300);
  }

  // A card in the column opens the Tests list with that card unfolded.
  const target = tests[1];
  await page.click(`.column.foryou .card[data-id="${target.id}"] .t`);
  await page.waitForSelector('.fyf[data-kind="t"]');
  check('the window is on the Tests list (2 rows)', (await page.locator('.fyf-row').count()) === 2);
  check('only the clicked card is unfolded', (await page.locator('.fyf-row.open').count()) === 1 && (await page.locator(`.fyf-row.open[data-id="${target.id}"]`).count()) === 1);
  check('the page stayed on the board', /#\/p\/alpha$/.test(page.url()), page.url());
  check('it has steps, Accept and Send back', /Click/.test(await page.locator('.fyf-row.open .fyf-b').textContent()) && (await page.locator('.fyf-row.open [data-act="accept"]').count()) === 1 && (await page.locator('.fyf-row.open [data-act="sbopen"]').count()) === 1);
  check('one Send back on the unfolded test, not two (AIG-1373)', (await page.locator('.fyf-row.open button:visible', { hasText: 'Send back' }).count()) === 1);
  await page.click('.fyf-row.open [data-act="accept"]');
  await page.waitForFunction(() => document.querySelectorAll('.fyf-row').length === 1, null, { timeout: 5000 }).catch(() => {});
  check('Accept inside the window takes the row away', (await page.locator('.fyf-row').count()) === 1);
  await sleep(300);
  check('the card moved to done', (await getCard(s, 'alpha', target.id)).status === 'done');
  await page.click('.fyf-dlg .window-close');
  check('the cross closes the window', (await page.locator('.fyf').count()) === 0);
  noErrors(page);
}, true);

def('fyfoldnext', 'Tests list: Accept or Send back opens the next test in the list; the last says All tests done (AIG-1212)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const tests = [];
  for (const n of ['One', 'Two', 'Three']) {
    const c = await mkCard(s, 'alpha', 'Check ' + n);
    s.cli(['test', 'alpha', c.id, '1. Click **Go** for ' + n + '\n2. It works', '--as', 'Lead']);
    tests.push(c); await sleep(20);
  }
  const page = await openPage(ctx, '#/p/alpha');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForSelector('.column.foryou .card[data-id]');
  const order = async () => page.locator('.fyf-row').evaluateAll(els => els.map(e => e.dataset.id));
  const openId = async () => page.locator('.fyf-row.open').evaluateAll(els => els.map(e => e.dataset.id));
  await page.click(`.column.foryou .card[data-id="${tests[0].id}"] .t`);
  await page.waitForSelector('.fyf[data-kind="t"] .fyf-row.open');
  const ids = await order();
  await page.click('.fyf-row.open [data-act="accept"]');
  await page.waitForFunction(() => document.querySelectorAll('.fyf-row').length === 2, null, { timeout: 5000 }).catch(() => {});
  let o = await openId();
  check('Accept opens the next test in the list straight away', o.length === 1 && o[0] === ids[1], JSON.stringify({ ids, o }));
  check('the list fits at 390px', await page.evaluate(() => document.querySelector('.fyf').scrollWidth <= window.innerWidth + 1));
  await page.click('.fyf-row.open [data-act="sbopen"]');
  check('Send back opens the reason box and is then the only Send back (AIG-1373)', await page.locator('.fyf-row.open [data-act="sbopen"]').isHidden() && (await page.locator('.fyf-row.open button:visible', { hasText: 'Send back' }).count()) === 1);
  await page.fill('.fyf-row.open [data-sb]', 'Not yet');
  await page.click('.fyf-row.open [data-act="sbsend"]');
  await page.waitForFunction(() => document.querySelectorAll('.fyf-row').length === 1, null, { timeout: 5000 }).catch(() => {});
  o = await openId();
  check('Send back opens the next test too', o.length === 1 && o[0] === ids[2], JSON.stringify(o));
  await page.click('.fyf-row.open [data-act="accept"]');
  await page.waitForFunction(() => document.querySelectorAll('.fyf-row').length === 0 || /All tests done/.test(document.body.textContent), null, { timeout: 5000 }).catch(() => {});
  check('after the last one it says All tests done', /All tests done/.test(await page.textContent('body')));
  noErrors(page);
}, true);

def('fyquestions', 'Questions pile: a tapped answer sends it and the question leaves the pile (AIG-1411); my own question shows the team answer (AIG-1414)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const page = await openPage(ctx, '#/p/alpha');
  const owner = await page.evaluate(() => me());
  const c = await mkCard(s, 'alpha', '💬 What should I plant first?', { description: 'What should I plant first?', status: 'team', createdBy: owner, quick: true });
  await say(s, 'alpha', c.id, 'Lead', 'Start with broad beans and onion sets.');
  s.cli(['ask', 'alpha', c.id, 'Vegetables, or fruit too?', '--options', 'Just vegetables,Vegetables and fruit', '--as', 'Lead']);
  await page.reload();
  await page.waitForSelector(`.column.foryou .card[data-id="${c.id}"]`);
  await page.click(`.column.foryou .card[data-id="${c.id}"] .t`);
  await page.waitForSelector('.fyf[data-kind="q"] .fyf-row.open .msg-act');
  const shown = await page.locator('.fyf-row.open .ib-answer').evaluateAll(els => els.map(e => ({ open: e.open, text: e.textContent })));
  check('my own question shows the team\'s answer above the follow-up (AIG-1414)', shown.length === 1 && shown[0].open && /broad beans/.test(shown[0].text) && /Lead/.test(shown[0].text), shown);
  if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/AIG-1414.png' });
  await page.click('.fyf-row.open .msg-act[data-say="Vegetables and fruit"]');
  await page.waitForFunction(() => !document.querySelector('.fyf'), null, { timeout: 5000 }).catch(() => {});
  const got = await getCard(s, 'alpha', c.id);
  check('a tapped answer is sent once', got.comments.filter(m => m.text === 'Vegetables and fruit').length === 1, got.comments.map(m => m.text));
  check('the question leaves the pile and the empty window closes', (await page.locator('.fyf').count()) === 0);
  check('it says Sent', /Sent to the team on/.test(await page.textContent('body')));
  if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/AIG-1411.png' });
  noErrors(page);
}, true);
