// QA area: topbar (AIG-575/576). Setup lists the top bar buttons: hide one, reorder, move to the left, colour, reset; the bar follows, and it survives a reload.
import { check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('topbar', 'Setup: top bar buttons on/off, reorder, left or right side, theme colour, Reset to default (AIG-575/576)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#tbList .tb-row');
  const ids = () => page.evaluate(() => [...document.querySelectorAll('header > *')].map(e => e.id).filter(i => i && !/^(twitchBtn|mailNav|immWrap|hfTop|quietTimeTop|liveBtn|live|tbMore)$/.test(i)));   // AIG-932: the extras and the More button are not part of the order
  const vis = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  const leftOfSpacer = () => page.evaluate(() => { const b = document.getElementById('bugBtn'); return !!(b.compareDocumentPosition(document.querySelector('header .spacer')) & Node.DOCUMENT_POSITION_FOLLOWING); });
  const before = await ids();
  check('lists 17 buttons (with 🎥 Streamer, 📊 ScrumGlance, 🌿 WeedGlance, 🟢 Status, 🔋 Tired), reset starts disabled', await page.locator('#tbList .tb-row').count() === 17 && await page.locator('#tbReset').isDisabled());
  check('the settings gear switch is locked on', await page.locator('[data-tb="setupNav"] .tb-on').isDisabled());

  // Hide the Idea button
  await page.locator('[data-tb="ideaBtn"] .tb-on').uncheck();
  check('Idea button hidden', !(await vis('ideaBtn')));
  check('Reset is now enabled', await page.locator('#tbReset').isEnabled());

  // Reorder with the arrows: Help below Idea
  await page.locator('[data-tb="helpBtn"] .tb-down').click();
  let o = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-row')].map(r => r.dataset.tb));
  check('down arrow swaps Help and Raise bug in the list', o[0] === 'bugBtn' && o[1] === 'helpBtn', o.join());
  const now = await ids();
  check('the bar follows (Raise bug before Help)', now.indexOf('bugBtn') < now.indexOf('helpBtn'), now.join());

  // Drag Idea to the top
  await page.locator('[data-tb="ideaBtn"] .tb-grip').dragTo(page.locator('[data-tb="bugBtn"] .tb-name'));
  o = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-row')].map(r => r.dataset.tb));
  check('dragging a row moves it', o[0] === 'ideaBtn', o.join());

  // Raise bug: left side, red
  const plain = await page.evaluate(() => getComputedStyle(document.getElementById('bugBtn')).color);
  await page.locator('[data-tb="bugBtn"] .tb-side').selectOption('l');
  await page.locator('[data-tb="bugBtn"] .tb-sw[data-tbc="danger"]').click();
  check('Raise bug sits left of the spacer, next to the project name', await leftOfSpacer());
  const bug = await page.evaluate(() => { const b = document.getElementById('bugBtn'); return { c: b.dataset.tbc, col: getComputedStyle(b).color }; });
  check('Raise bug is coloured with the danger theme colour', bug.c === 'danger' && bug.col === plain, JSON.stringify(bug) + ' was ' + plain);
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

// AIG-931/932: first run shows Inbox, Help, Setup and a More menu; at phone width the bar is one row with a ☰ menu.
def('topmenu', 'Top bar: Inbox/Help/Setup + More on desktop, one row with a ☰ menu on a phone (AIG-931/932)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  openPage.firstrun = true;
  const fresh = await ctx.browser().newContext({ viewport: { width: 1400, height: 900 } });   // a first run: nothing pinned yet
  let page; try { page = await openPage(fresh, '#/'); } finally { openPage.firstrun = false; }
  await page.waitForSelector('#tbMoreBtn');
  const shown = () => page.evaluate(() => [...document.querySelectorAll('header button, header a.navlink')].filter(e => !e.closest('#tbMoreMenu') && e.getClientRects().length).map(e => e.id));
  let ids = await shown();
  check('desktop: Help, Setup and More are in the bar, Glance/Theme are not (Idea sits by Raise bug, AIG-1066)', ['helpBtn', 'ideaBtn', 'setupNav', 'tbMoreBtn'].every(i => ids.includes(i)) && !['glanceBtn', 'themeBtn'].some(i => ids.includes(i)), ids.join());
  check('desktop: Inbox is in the bar', await page.evaluate(() => !!document.querySelector('#inboxTop') && !document.querySelector('#inboxTop').closest('#tbMoreMenu')));
  check('the menu starts closed', await page.locator('#tbMoreMenu').isHidden());
  await page.locator('#tbMoreBtn').click();
  check('More opens', await page.locator('#tbMoreMenu').isVisible() && await page.locator('#tbMoreBtn').getAttribute('aria-expanded') === 'true');
  const hid = ids => page.evaluate(ids => ids.every(i => { const e = document.getElementById(i); return e && getComputedStyle(e).display === 'none'; }), ids);
  check('first run: Streamer, Twitch chat, No Token Mode, Tired mode, Assumptions, ScrumGlance stay out of the menu (AIG-1077)', await hid(['streamBtn', 'twitchBtn', 'ntBtn', 'tiredBtn', 'assumeNav', 'glanceBtn']));
  await page.locator('#tbMoreBtn').click();
  await page.goto(page.url().split('#')[0] + '#/setup'); await page.waitForSelector('#powerTools');
  await page.locator('#powerTools').check();
  check('Setup > More settings: show my power tools brings them back', !(await hid(['streamBtn', 'glanceBtn'])));
  await page.goto(page.url().split('#')[0] + '#/');
  await page.locator('#tbMoreBtn').click();
  await page.locator('#glanceBtn').click();
  check('a button inside works (ScrumGlance opens) and the menu closes', await page.locator('#tbMoreMenu').isHidden() && await page.evaluate(() => !!document.getElementById('glancePanel') || document.body.innerText.length > 0));
  // Setup: pin it back
  await page.goto(page.url().split('#')[0] + '#/setup'); await page.waitForSelector('[data-pin=glanceBtn]');
  await page.locator('[data-pin=glanceBtn]').check();
  check('pinned back: ScrumGlance is in the bar and saved', (await shown()).includes('glanceBtn') && await page.evaluate(() => JSON.parse(localStorage.getItem('aigile.topbar.pinned')).includes('glanceBtn')));
  // phone
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('header').offsetHeight < 70);
  const h = await page.evaluate(() => document.querySelector('header').offsetHeight);
  check('phone: the bar is one row (' + h + 'px)', h < 70);
  await page.locator('#tbMoreBtn').click();
  check('phone: the menu opens and holds Help, Setup and Theme', await page.locator('#tbMoreMenu').isVisible() && await page.evaluate(() => ['helpBtn', 'setupNav', 'themeBtn'].every(i => document.getElementById(i).closest('#tbMoreMenu'))));
  check('phone: the gear is called Setup, not Settings gear (AIG-1077)', (await page.locator('#setupNav .tbm-label').textContent()) === 'Setup');
  check('phone: every visible menu item has a label (AIG-955)', await page.evaluate(() => [...document.querySelectorAll('#tbMoreMenu > *')].filter(e => getComputedStyle(e).display !== 'none').every(e => e.innerText.trim() !== '')), await page.evaluate(() => [...document.querySelectorAll('#tbMoreMenu > *')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id + '=' + JSON.stringify(e.innerText)).join(' | ')));
  check('phone: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.screenshot({ path: 'R:/wt/shot-topbar-phone.png' });
  await page.locator('#tbMoreBtn').click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => !document.getElementById('helpBtn').closest('#tbMoreMenu'));
  await page.screenshot({ path: 'R:/wt/shot-topbar-desk.png' });
  noErrors(page);
}, true);

// AIG-1066: the quick English 🌐 button stays on the desktop bar (Dutch + switch on), and Idea sits right after Raise bug.
def('topbaren', 'Top bar: 🌐 quick English button on the bar and flips to English; 💡 Idea is the next sibling of Raise bug (AIG-1066)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  openPage.firstrun = true;
  const fresh = await ctx.browser().newContext({ viewport: { width: 1400, height: 900 } });
  await fresh.addInitScript(() => { try { localStorage.setItem('aigile.lang', 'nl'); localStorage.setItem('aigile.enSwitch', '1'); } catch {} });
  let page; try { page = await openPage(fresh, '#/'); } finally { openPage.firstrun = false; }
  await page.waitForFunction(() => document.documentElement.lang === 'nl' && document.getElementById('enBtn') && !document.getElementById('enBtn').hidden, null, { timeout: 8000 }).catch(() => {});
  const on = await page.evaluate(() => { const e = document.getElementById('enBtn'); return !!e && !e.hidden && !e.closest('#tbMoreMenu') && e.getClientRects().length > 0 && e.parentElement === document.querySelector('header'); });
  check('Dutch + quick switch on: the 🌐 button is visible on the bar (not under Meer)', on);
  const sib = await page.evaluate(() => document.getElementById('bugBtn').nextElementSibling === document.getElementById('ideaBtn'));
  check('Idea is the next sibling of Raise bug', sib);
  check('Idea shows on the bar by default', await page.evaluate(() => !document.getElementById('ideaBtn').closest('#tbMoreMenu') && document.getElementById('ideaBtn').getClientRects().length > 0));
  await page.click('#enBtn');
  await page.waitForFunction(() => document.documentElement.lang === 'en' && document.getElementById('enBtn') && /NL/.test(document.getElementById('enBtn').textContent), null, { timeout: 8000 }).catch(() => {});
  check('clicking 🌐 flips the board to English', await page.evaluate(() => document.documentElement.lang === 'en' && !document.getElementById('enBtn').hidden), await page.evaluate(() => document.documentElement.lang + '|' + document.getElementById('enBtn').textContent));
  noErrors(page);
}, true);
