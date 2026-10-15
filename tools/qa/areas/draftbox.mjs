// QA area: draftbox (AIG-1022): an unsent reply is kept as a draft (no "lose it?" box): Messages lists it under 📝 Drafts after a
// reload in its own 📝 Drafts tab (AIG-1043), a click opens the chat with the text back, sending clears it, ✕ discards one.
import { check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('draftbox', '📝 Drafts: an unsent reply survives a reload and is listed in Messages; click restores it, send clears it, ✕ discards; no leave/refresh box (AIG-1022)', async (s, ctx) => {
  await mkProject(s, 'Draft Box', 'DB'); await s.ok('POST', '/api/projects/draft-box/team', { name: 'Lead', role: 'Lead' });
  const page = await openPage(ctx, '#/');
  let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  const openList = async () => { await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]'); await page.waitForSelector('#dmPanel [data-dm="_assistant"]'); };
  await openList();
  check('no drafts: no Drafts tab', await page.locator('#dmPanel [data-dmfilter="drafts"]').count() === 0);
  await page.click('#dmPanel [data-dm="_assistant"]'); await page.waitForSelector('#dmText');
  await page.fill('#dmText', 'help');
  await Promise.all([page.waitForEvent('load'), page.evaluate(() => refreshPage())]);
  await page.waitForSelector('#dmRail [data-dms]');
  check('the refresh asked nothing', dialogs === 0, dialogs);
  await openList();
  check('All lists no drafts', await page.locator('#dmPanel .dm-drafts').count() === 0);
  await page.click('#dmPanel [data-dmfilter="drafts"]');
  const row = page.locator('#dmPanel [data-dmdraft="dm/_assistant"]');
  await row.waitFor();
  check('the draft row names the chat and shows the first words', /Personal assistant/.test(await row.textContent()) && /help/.test(await row.textContent()), await row.textContent());
  check('the Drafts tab lists only drafts', await page.locator('#dmPanel [data-dm="_assistant"]').count() === 0);
  await row.click(); await page.waitForSelector('#dmText');
  check('click opens the chat with the text back', (await page.inputValue('#dmText')) === 'help');
  await page.waitForSelector('#dmList .dm-empty, #dmList .dm-fold');   // the thread has loaded
  await page.evaluate(() => Dms.send());
  await page.waitForFunction(() => !document.getElementById('dmText').value);
  await page.click('#dmPanel .dm-head button'); await page.waitForSelector('#dmPanel [data-dm="_assistant"]');
  check('sending clears the draft and the tab', await page.locator('#dmPanel .dm-drafts, #dmPanel [data-dmfilter="drafts"]').count() === 0);
  await page.click('#dmPanel [data-dm="_assistant"]'); await page.waitForSelector('#dmText');
  await page.fill('#dmText', 'throw me away');
  await page.click('#dmPanel .dm-head button'); await page.click('#dmPanel [data-dmfilter="drafts"]'); await page.waitForSelector('#dmPanel [data-dmdraftx]');
  await page.click('#dmPanel [data-dmdraftx]');
  check('✕ discards the draft', await page.locator('#dmPanel .dm-drafts').count() === 0 && (await page.evaluate(() => listDrafts().length)) === 0);
  noErrors(page);
}, true);
