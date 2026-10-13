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
    await page.goto(page.url().replace('ALP-1', 'ALP-2'));
    await page.waitForSelector('#modal .panel .verdict');
    const v = await page.evaluate(() => { const h = document.querySelector('#modal .panel h2').getBoundingClientRect().top, a = document.querySelector('#modal .verdict button.good').getBoundingClientRect().top; return { h, a }; });
    check('Accept is visible and below the title', v.a > v.h && await page.isVisible('#modal .verdict button.good'), v);
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
