// QA area: topbar (AIG-575/576). Setup lists the top bar buttons: hide one, reorder, move to the left, colour, reset; the bar follows, and it survives a reload.
import { check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('topbar', 'Setup: top bar buttons on/off, reorder, left or right side, theme colour, Reset to default (AIG-575/576)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#tbList .tb-row');
  const ids = () => page.evaluate(() => [...document.querySelectorAll('header > *')].map(e => e.id).filter(Boolean));
  const vis = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  const leftOfSpacer = () => page.evaluate(() => { const b = document.getElementById('bugBtn'); return !!(b.compareDocumentPosition(document.querySelector('header .spacer')) & Node.DOCUMENT_POSITION_FOLLOWING); });
  const before = await ids();
  check('lists 16 buttons (with 🎥 Streamer, 📊 ScrumGlance, 🌿 WeedGlance, 🔋 Tired), reset starts disabled', await page.locator('#tbList .tb-row').count() === 16 && await page.locator('#tbReset').isDisabled());
  check('the settings gear switch is locked on', await page.locator('[data-tb="setupNav"] .tb-on').isDisabled());

  // Hide the Idea button
  await page.locator('[data-tb="ideaBtn"] .tb-on').uncheck();
  check('Idea button hidden', !(await vis('ideaBtn')));
  check('Reset is now enabled', await page.locator('#tbReset').isEnabled());

  // Reorder with the arrows: Help below Idea
  await page.locator('[data-tb="helpBtn"] .tb-down').click();
  let o = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-row')].map(r => r.dataset.tb));
  check('down arrow swaps Help and Idea in the list', o[0] === 'ideaBtn' && o[1] === 'helpBtn', o.join());
  const now = await ids();
  check('the bar follows (Idea before Help)', now.indexOf('ideaBtn') < now.indexOf('helpBtn'), now.join());

  // Drag Raise bug to the top
  await page.locator('[data-tb="bugBtn"] .tb-grip').dragTo(page.locator('[data-tb="ideaBtn"] .tb-name'));
  o = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-row')].map(r => r.dataset.tb));
  check('dragging a row moves it', o[0] === 'bugBtn', o.join());

  // Raise bug: left side, red
  const plain = await page.evaluate(() => getComputedStyle(document.getElementById('bugBtn')).color);
  await page.locator('[data-tb="bugBtn"] .tb-side').selectOption('l');
  await page.locator('[data-tb="bugBtn"] .tb-sw[data-tbc="danger"]').click();
  check('Raise bug sits left of the spacer, next to the project name', await leftOfSpacer());
  const bug = await page.evaluate(() => { const b = document.getElementById('bugBtn'); return { c: b.dataset.tbc, col: getComputedStyle(b).color }; });
  check('Raise bug is coloured with the danger theme colour', bug.c === 'danger' && bug.col !== plain, JSON.stringify(bug) + ' was ' + plain);
  check('the red swatch shows as pressed', await page.locator('[data-tb="bugBtn"] .tb-sw[data-tbc="danger"]').getAttribute('aria-pressed') === 'true');

  // Survives a reload
  await page.reload(); await page.waitForSelector('#tbList .tb-row');
  check('saved: Idea still hidden, Raise bug still left and red', !(await vis('ideaBtn')) && await leftOfSpacer() && await page.evaluate(() => document.getElementById('bugBtn').dataset.tbc === 'danger'));

  // Phone width: the bar still fits
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.setViewportSize({ width: 1280, height: 800 });

  // Reset
  await page.locator('#tbReset').click();
  check('reset: the bar is back to today\'s order and Idea shows', JSON.stringify(await ids()) === JSON.stringify(before) && await vis('ideaBtn'), (await ids()).join());
  check('reset: no colour, nothing saved, button disabled again', await page.evaluate(() => !document.getElementById('bugBtn').dataset.tbc && !localStorage.getItem('aigile.topbar')) && await page.locator('#tbReset').isDisabled());
  noErrors(page);
}, true);
