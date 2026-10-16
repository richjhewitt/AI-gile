// QA area: cardux (AIG-935, AIG-942): the open card shows the title before the actions, with one ⋯ menu; the quick new card form shows three controls.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('cardux', 'open card: title before actions, ⋯ menu with a working Move; new card: 3 controls, More options closed, Create works', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Plain card', { status: 'todo' });
  await mkCard(s, 'alpha', 'Verify me', { status: 'verify', testSteps: 'Step one' });
  openPage.realMenu = true;   // this area checks the real, closed menu
  try {
    const page = await openPage(ctx, '#/p/alpha/ALP-1');
    await page.waitForSelector('#modal .panel h2');
    const order = await page.evaluate(() => {
      const h = document.querySelector('#modal .panel h2'), top = document.querySelector('#modal .panel .card-acts');
      const first = document.querySelector('#modal .panel > *');
      return { titleFirst: !!h && !!first && first.contains(h), actsInHeadRow: !!top && top.parentElement === first, y: h && h.getBoundingClientRect().top, menuHidden: document.getElementById('card-menu').hidden };
    });
    check('title is in the first block of the card', order.titleFirst, order);
    check('actions are beside the title, not above it', order.actsInHeadRow, order);
    check('the ⋯ menu starts closed', order.menuHidden);
    check('Move dropdown is hidden while the menu is closed', !(await page.isVisible('#mv-to')));
    check('Close, Edit and ⋯ stay visible', await page.isVisible('#cm-btn') && await page.isVisible('button[onclick="editCard()"]'));
    await page.click('#cm-btn');
    check('⋯ opens the menu', await page.isVisible('#card-menu') && await page.isVisible('#mv-to'));
    await page.screenshot({ path: process.env.QA_SHOT_CARD || 'R:/wt/shot-card-desk.png' }).catch(() => {});
    await page.selectOption('#mv-to', 'doing');
    await sleep(800);
    check('Move inside the menu works', (await getCard(s, 'alpha', 'ALP-1')).status === 'doing');
    await page.keyboard.press('Escape');
    // A card waiting for a test shows its answer buttons without opening anything
    await page.goto(page.url().split('#')[0] + '#/p/alpha/ALP-2');   // Esc may have closed ALP-1 (AIG-1371)
    await page.waitForSelector('#modal .panel .verdict');
    const v = await page.evaluate(() => { const h = document.querySelector('#modal .panel h2').getBoundingClientRect().top, a = document.querySelector('#modal .verdict button.good').getBoundingClientRect().top; return { h, a }; });
    check('Accept is visible and below the title', v.a > v.h && await page.isVisible('#modal .verdict button.good'), v);
    // AIG-1358: on a short card (title only) at 1366x768 the whole ⋯ menu shows: Move to and Delete are on screen, not cut off by the panel.
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(page.url().split('#')[0] + '#/p/alpha/ALP-1');
    await page.waitForFunction(() => /Plain card/.test((document.querySelector('#modal .panel h2') || {}).textContent || ''));
    await page.click('#cm-btn');
    const reach = await page.evaluate(() => [document.getElementById('mv-to'), document.querySelector('#card-menu button.danger')].map(el => {
      const r = el.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!t && (t === el || el.contains(t));
    }));
    check('short card: Move to and Delete in the ⋯ menu are on screen', reach.every(Boolean), reach);
    await page.keyboard.press('Escape');
    check('closing the menu gives the short card its own height back', await page.evaluate(() => document.querySelector('#modal .panel').getBoundingClientRect().height < 500));
    noErrors(page);
    await page.close();

    // New card form (phone width)
    const ph = await openPage(ctx, '#/p/alpha');
    await ph.setViewportSize({ width: 390, height: 800 });
    await ph.evaluate(() => newCard());
    await ph.waitForSelector('#dialog #f-title');
    check('new card: title and description shown', await ph.isVisible('#f-title') && await ph.isVisible('#f-description'));
    check('new card: other fields hidden', !(await ph.isVisible('#f-type')) && !(await ph.isVisible('#f-priority')) && !(await ph.isVisible('#f-assignee')) && !(await ph.isVisible('#f-sprint')));
    check('More options is closed', (await ph.getAttribute('#nc-more', 'open')) === null);
    check('Create is shown', await ph.isVisible('#dialog button[type=submit]'));
    await ph.screenshot({ path: process.env.QA_SHOT_NEW || 'R:/wt/shot-newcard-phone.png' }).catch(() => {});
    await ph.click('#nc-more summary');
    check('More options opens the other fields', await ph.isVisible('#f-type') && await ph.isVisible('#f-assignee'));
    await ph.fill('#f-title', 'Quick idea');
    await ph.fill('#f-description', 'Some text');
    await ph.click('#dialog button[type=submit]');
    await sleep(800);
    const cards = (await s.ok('GET', '/api/projects/alpha')).cards;
    check('Create makes the card', cards.some(c => c.title === 'Quick idea' && c.description === 'Some text'));
    noErrors(ph);
    await ph.close();
  } finally { openPage.realMenu = false; }
}, true);
