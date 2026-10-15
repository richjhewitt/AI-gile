// QA area: popout-all (AIG-658): every window can pop out. Raise bug and Team open in their own browser window at #/pop-dlg/<kind>,
// and the window's place and size are remembered per kind.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('popout-all', '⧉ Raise bug, Team and the other dialogs pop out into their own window, which reopens where it was left (AIG-658)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Something', { status: 'todo' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('#bugBtn');
  await page.waitForSelector('.dialog h2');
  check('the Raise bug dialog has a Pop out button', (await page.locator('.dialog .dlg-pop').count()) === 1);
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('.dialog .dlg-pop')]);
  await pop.waitForSelector('.dialog h2');
  check('the pop window is at the pop route', /#\/pop-dlg\/bug\/alpha$/.test(pop.url()), pop.url());
  check('it shows the Raise bug dialog, full size', /Raise|bug/i.test(await pop.textContent('.dialog h2')) && (await pop.locator('.dialog .dlg-pop').count()) === 0);
  check('no header or board behind it', !(await pop.isVisible('header')));
  check('the dialog behind it in the main window is gone', (await page.locator('.dialog').count()) === 0);
  // resize, wait for the one-second check, see it saved
  await pop.setViewportSize({ width: 700, height: 520 });
  await sleep(1500);
  const saved = await pop.evaluate(() => JSON.parse(localStorage.getItem('aigile.popwin') || '{}')['dlg-bug']);
  check('the size is remembered for the Raise bug window', saved && saved.w >= 600, saved);
  // it is given to window.open as features next time
  const feat = await page.evaluate(() => popFeatures('dlg-bug', 560, 720));
  check('window.open gets the saved size back', new RegExp('width=' + saved.w + ',height=' + saved.h).test(feat), feat);
  // raising a bug from the pop window works
  await pop.fill('#f-title', 'Popped bug');
  const done = pop.waitForEvent('close', { timeout: 8000 }).then(() => true, () => false);
  await pop.click('.dialog button[type=submit]');
  check('raising a bug in the pop window closes it', await done);
  const got = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'Popped bug');
  check('the bug card exists', !!got && got.type === 'bug', got);
  await page.click('#bugBtn');
  await page.waitForSelector('.dialog .dlg-pop');
  const [pop2] = await Promise.all([ctx.waitForEvent('page'), page.click('.dialog .dlg-pop')]);
  await pop2.waitForSelector('.dialog h2');
  const w2 = await pop2.evaluate(() => window.innerWidth);
  check('the second pop window opens at the remembered size', Math.abs(w2 - 700) < 80, w2);
  // closing the dialog closes its window
  const closed = pop2.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false);
  await pop2.click('.dialog button:has-text("Cancel"), .dialog button:has-text("Annuleer")');
  check('Cancel closes the pop window', await closed);
  // Team pops out too
  await page.click('button[onclick="teamDialog()"]');
  await page.waitForSelector('.team-dlg .dlg-pop');
  const [pt] = await Promise.all([ctx.waitForEvent('page'), page.click('.team-dlg .dlg-pop')]);
  await pt.waitForSelector('#tm-box');
  check('Team opens in its own window', /#\/pop-dlg\/team\/alpha$/.test(pt.url()));
  noErrors(page);
}, true);
