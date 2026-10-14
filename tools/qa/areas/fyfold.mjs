// QA area: fyfold (AIG-738): a For you chip or card opens one window with the chip's cards, folded; a row unfolds in place.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

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

  // A card in the column opens the Tests list with that card unfolded.
  const target = tests[1];
  await page.click(`.column.foryou .card[data-id="${target.id}"] .t`);
  await page.waitForSelector('.fyf[data-kind="t"]');
  check('the window is on the Tests list (2 rows)', (await page.locator('.fyf-row').count()) === 2);
  check('only the clicked card is unfolded', (await page.locator('.fyf-row.open').count()) === 1 && (await page.locator(`.fyf-row.open[data-id="${target.id}"]`).count()) === 1);
  check('the page stayed on the board', /#\/p\/alpha$/.test(page.url()), page.url());
  check('it has steps, Accept and Send back', /Click/.test(await page.locator('.fyf-row.open .fyf-b').textContent()) && (await page.locator('.fyf-row.open [data-act="accept"]').count()) === 1 && (await page.locator('.fyf-row.open [data-fyback]').count()) === 1);
  await page.click('.fyf-row.open [data-act="accept"]');
  await page.waitForFunction(() => document.querySelectorAll('.fyf-row').length === 1, null, { timeout: 5000 }).catch(() => {});
  check('Accept inside the window takes the row away', (await page.locator('.fyf-row').count()) === 1);
  await sleep(300);
  check('the card moved to done', (await getCard(s, 'alpha', target.id)).status === 'done');
  await page.click('.fyf-x');
  check('the cross closes the window', (await page.locator('.fyf').count()) === 0);
  noErrors(page);
}, true);
