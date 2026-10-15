// QA areas: popout-glances, popout-pages (AIG-1313). Every glance opens in its own window (ScrumGlance, WeedGlance, Night,
// Usage), and the pages, Messages and the reading dialogs that are worth keeping beside the board have the same ⧉ Pop out.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def, BASE } from '../lib.mjs';

// A pop window opened straight at its address (openPage waits for #app content, which a chat or dialog window leaves empty).
async function openPop(ctx, hash, sel) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text() + ' ' + hash); });
  await page.goto(BASE + '/' + hash);
  const ok = await page.waitForSelector(sel, { timeout: 8000 }).then(() => true, () => false);
  return { page, ok };
}
const track = p => { p.errors = []; p.on('pageerror', e => p.errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') p.errors.push('console: ' + m.text() + ' ' + (m.location() || {}).url); }); return p; };
const sameBtn = async (loc) => {
  const [txt, title, aria] = await Promise.all([loc.textContent(), loc.getAttribute('title'), loc.getAttribute('aria-label')]);
  return /⧉/.test(txt) && /Pop out/.test(txt) && !!title && /Pop out/.test(aria || '');
};

def('popout-glances', '⧉ every glance pops out: ScrumGlance, WeedGlance, the night glance and the usage glance each open in their own window and stay live (AIG-1313)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Build the thing', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  // 📊 ScrumGlance
  await page.evaluate(() => ScrumGlance.toggle());
  await page.waitForSelector('#sgPop');
  check('ScrumGlance has the shared ⧉ Pop out (label, hover text, screen-reader name)', await sameBtn(page.locator('#sgPop')));
  const [sg] = await Promise.all([ctx.waitForEvent('page').then(track), page.click('#sgPop')]);
  await sg.waitForSelector('.sg-pop .sg-grp');
  check('ScrumGlance pops out at #/pop-glance/alpha with no header', /#\/pop-glance\/alpha$/.test(sg.url()) && !(await sg.isVisible('header')));
  await mkCard(s, 'alpha', 'Another one', { status: 'doing' });
  check('the ScrumGlance window stays live', await sg.waitForFunction(() => (document.querySelector('.sg-doing .sg-n') || {}).textContent === '2', null, { timeout: 8000 }).then(() => true, () => false));
  await sg.close();
  // 🌿 WeedGlance
  const [wd] = await Promise.all([ctx.waitForEvent('page').then(track), page.evaluate(() => Weed.pop())]);
  check('WeedGlance opens in its own window at #/pop-weed', await wd.waitForSelector('#weedPop', { timeout: 8000 }).then(() => /#\/pop-weed$/.test(wd.url()), () => false), wd.url());
  await wd.close();
  // 🌙 Night glance
  const [ng] = await Promise.all([ctx.waitForEvent('page').then(track), page.evaluate(() => openNightGlance())]);
  check('the night glance opens in its own window at #/pop-night', await ng.waitForSelector('.ng', { timeout: 8000 }).then(() => /#\/pop-night$/.test(ng.url()), () => false), ng.url());
  await ng.close();
  // ⚡ Usage glance: the Usage page's ⧉ Pop out, a small window of the same figures
  await page.evaluate(() => { location.hash = '#/usage'; });
  await page.waitForSelector('#pagePop:not([hidden])');
  check('Usage has the shared ⧉ Pop out', await sameBtn(page.locator('#pagePop')));
  const [uz] = await Promise.all([ctx.waitForEvent('page').then(track), page.click('#pagePop')]);
  await uz.waitForSelector('#app > *');
  check('Usage pops out at #/pop-page/usage: no header, no second Pop out', /#\/pop-page\/usage$/.test(uz.url()) && !(await uz.isVisible('header')) && !(await uz.isVisible('#pagePop')), uz.url());
  check('the Usage window shows the page', await uz.waitForSelector('.uz, #app .muted', { timeout: 8000 }).then(() => true, () => false));
  check('it is remembered per page', await uz.evaluate(() => popKindOf(location.hash)) === 'page-usage');
  noErrors(uz); await uz.close();
  // every glance's pop route renders on its own
  for (const [hash, sel] of [['#/pop-glance', '.sg-pop'], ['#/pop-weed', '#weedPop'], ['#/pop-night', '.ng'], ['#/pop-page/usage', '#app > *']]) {
    const { page: p, ok } = await openPop(ctx, hash, sel);
    check(`${hash} renders by itself`, ok && !(await p.isVisible('header')));
    noErrors(p); await p.close();
  }
  noErrors(page);
}, true);

def('popout-pages', '⧉ pages (Usage, Today, Glossary, Stand-ups, Stats, Inbox, ...), Messages and the reading dialogs pop out with the same button; none on a phone (AIG-1313)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Something', { status: 'todo' });
  const page = await openPage(ctx, '#/');
  const pages = ['usage', 'today', 'glossary', 'standups', 'stats/alpha', 'risks/alpha', 'releases/alpha', 'ci/alpha', 'review/alpha', 'known-errors', 'improvements', 'life', 'whats-new', 'mail', 'bin', 'assumptions', 'inbox'];
  for (const h of pages) {
    await page.evaluate(x => { location.hash = '#/' + x; }, h);
    const has = await page.waitForSelector('#pagePop:not([hidden])', { timeout: 5000 }).then(() => true, () => false);
    check(`#/${h} has ⧉ Pop out`, has);
    const { page: p, ok } = await openPop(ctx, '#/pop-page/' + h, '#app > *');
    check(`#/pop-page/${h} renders the page alone`, ok && !(await p.isVisible('header')) && !(await p.isVisible('#pagePop')), [ok, await p.isVisible('header'), await p.isVisible('#pagePop'), await p.evaluate(() => document.body.className + ' | ' + JSON.stringify(state.route) + ' | ' + document.getElementById('app').innerHTML.slice(0, 200))]);
    if (h === 'review/alpha') p.errors = p.errors.filter(e => !/400/.test(e));   // the review asks for a summary a QA board refuses (400), popped or not
    noErrors(p); await p.close();
  }
  page.errors = page.errors.filter(e => !/400/.test(e));
  await page.evaluate(() => { location.hash = '#/p/alpha'; });
  await sleep(600);
  check('a board has no page Pop out', !(await page.isVisible('#pagePop')), await page.evaluate(() => [location.hash, JSON.stringify(state.route), document.getElementById('pagePop').outerHTML]));
  // the inbox in its own window still lists
  const { page: ib, ok: ibOk } = await openPop(ctx, '#/pop-page/inbox', '#ib');
  check('the whole inbox pops out', ibOk);
  await ib.close();
  // 💬 Messages and one chat
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel #dmPop');
  check('Messages has the shared ⧉ Pop out', await sameBtn(page.locator('#dmPanel #dmPop')));
  const [ml] = await Promise.all([ctx.waitForEvent('page').then(track), page.click('#dmPanel #dmPop')]);
  check('Messages pops out at #/pop-chat', await ml.waitForSelector('#dmPanel .dm-head', { timeout: 8000 }).then(() => /#\/pop-chat$/.test(ml.url()), () => false), ml.url());
  check('the Messages window has no header or second Pop out', !(await ml.isVisible('header')) && (await ml.locator('#dmPop').count()) === 0);
  check('the panel in the main window closed', await page.locator('#dmPanel').isHidden());
  await ml.close();
  await page.evaluate(() => Dms.show('alpha'));
  await page.waitForSelector('#dmPanel #dmText');
  const [ch] = await Promise.all([ctx.waitForEvent('page').then(track), page.click('#dmPanel #dmPop')]);
  check('one chat pops out at #/pop-chat/alpha with its reply box', await ch.waitForSelector('#dmText', { timeout: 8000 }).then(() => /#\/pop-chat\/alpha$/.test(ch.url()), () => false), ch.url());
  noErrors(ch); await ch.close();
  // reading dialogs that can now pop out
  for (const [kind, sel] of [['keys', '.sc-t'], ['start', '#gettingStarted'], ['deleted', '.dialog h2'], ['incidents', '#incGuide'], ['service', '#svcGuide']]) {
    const { page: p, ok } = await openPop(ctx, `#/pop-dlg/${kind}/alpha`, sel);
    check(`the ${kind} dialog opens in its own window`, ok && (await p.locator('.dialog .dlg-pop').count()) === 0);
    noErrors(p); await p.close();
  }
  await page.evaluate(() => Shortcuts.sheet());
  await page.waitForSelector('.dialog .dlg-pop');
  check('the shortcuts dialog has the shared ⧉ Pop out', await sameBtn(page.locator('.dialog .dlg-pop')));
  await page.evaluate(() => closeDialog());
  noErrors(page);
  // 📱 no Pop out on a phone
  const ph = await openPage(ctx, '#/usage');
  await ph.setViewportSize({ width: 390, height: 844 });
  await ph.waitForSelector('#pagePop', { state: 'attached' });
  check('phone: no page Pop out', await ph.$eval('#pagePop', e => getComputedStyle(e).display === 'none'));
  await ph.click('#dmRail [data-dms]').catch(() => {});
  await sleep(500);
  check('phone: no Messages Pop out', await ph.$$eval('#dmPop', els => els.every(e => getComputedStyle(e).display === 'none')));
  await ph.close();
}, true);
