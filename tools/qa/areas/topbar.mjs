// QA area: topbar (AIG-575/576). Setup lists the top bar buttons: hide one, reorder, move to the left, colour, reset; the bar follows, and it survives a reload.
import { check, mkProject, mkCard, openPage, noErrors, def, sleep } from '../lib.mjs';

def('topbar', 'Setup: top bar buttons on/off, reorder, left or right side, theme colour, Reset to default (AIG-575/576)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#tbList .tb-row');
  const ids = () => page.evaluate(() => [...document.querySelectorAll('header > *')].map(e => e.id).filter(i => i && !/^(twitchBtn|mailNav|immWrap|hfTop|quietTimeTop|liveBtn|live|tbMore)$/.test(i)));   // AIG-932: the extras and the More button are not part of the order
  const vis = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  const leftOfSpacer = () => page.evaluate(() => { const b = document.getElementById('bugBtn'); return !!(b.compareDocumentPosition(document.querySelector('header .spacer')) & Node.DOCUMENT_POSITION_FOLLOWING); });
  const before = await ids();
  check('lists 17 buttons (with 🎥 Streamer, 📊 ScrumGlance, 🌿 WeedGlance, 🟢 Status, 🔋 Tired), reset starts disabled', await page.locator('#tbList .tb-row').count() === 17 && await page.locator('#tbReset').isDisabled());
  { const ic = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-name, #tbPins .tb-pin')].map(l => ({ id: (l.closest('[data-tb]') || {}).dataset?.tb || l.querySelector('[data-pin]').dataset.pin, ico: (l.querySelector('.tb-ico') || {}).textContent || '', text: l.textContent.trim() })));
    const want = { helpBtn: '❓', bugBtn: '🐞', ideaBtn: '💡', inboxTop: '📥', pokeTop: '🔔', nightTop: '🌙', glanceBtn: '📊', setupNav: '⚙️', twitchBtn: '💬', quietTop: '🌙', immWrap: '🌍' };
    check('every top bar row and "Show in top bar" switch has its button\'s icon (AIG-1351)', ic.length > 30 && ic.every(x => x.ico) && ic.every(x => !want[x.id] || x.ico === want[x.id]), JSON.stringify(ic.filter(x => !x.ico || (want[x.id] && x.ico !== want[x.id]))));
    check('the icon comes once: "🌙 Going quiet", not "🌙 🌙 Going quiet"', ic.filter(x => x.id === 'quietTop').every(x => (x.text.match(/🌙/gu) || []).length === 1), JSON.stringify(ic.filter(x => x.id === 'quietTop'))); }
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
  // the default is a darker mix of the danger colour for contrast (AIG-1196), so check it is still red, not the exact value
  const [r, g, b] = (bug.col.match(/[\d.]+/g) || []).map(Number), red = r > 1 ? r : r * 255, gg = g > 1 ? g : g * 255, bb = b > 1 ? b : b * 255;
  check('Raise bug is coloured with the danger theme colour', bug.c === 'danger' && red > gg + 60 && red > bb + 60, JSON.stringify(bug) + ' was ' + plain);
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
  check('first run: ⚡ Usage is in the bar (AIG-1169)', ids.includes('usageNav'), ids.join());
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
  check('🌐 is the next sibling of Idea (Raise bug, Idea, 🌐) (AIG-1087)', await page.evaluate(() => document.getElementById('ideaBtn').nextElementSibling === document.getElementById('enBtn')));
  check('Idea shows on the bar by default', await page.evaluate(() => !document.getElementById('ideaBtn').closest('#tbMoreMenu') && document.getElementById('ideaBtn').getClientRects().length > 0));
  await page.click('#enBtn');
  await page.waitForFunction(() => document.documentElement.lang === 'en' && document.getElementById('enBtn') && /NL/.test(document.getElementById('enBtn').textContent), null, { timeout: 8000 }).catch(() => {});
  check('clicking 🌐 flips the board to English', await page.evaluate(() => document.documentElement.lang === 'en' && !document.getElementById('enBtn').hidden), await page.evaluate(() => document.documentElement.lang + '|' + document.getElementById('enBtn').textContent));
  noErrors(page);
}, true);

// AIG-1169: Usage is on the bar by default and joins a saved pin list once (unpinning it sticks); More ends with "Customise top bar…", which opens Setup on the top bar box.
def('tbusage', 'Top bar: ⚡ Usage on the bar (joins a saved pin list once, unpinning sticks); More ends with ⚙ Customise top bar…, which lands on Setup > Top bar buttons (AIG-1169)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  openPage.firstrun = true;
  const fresh = await ctx.browser().newContext({ viewport: { width: 1400, height: 900 } });
  // an older browser: a saved pin list without Usage, from before the one-time join
  await fresh.addInitScript(() => { try { if (!sessionStorage.getItem('qaSeeded')) { sessionStorage.setItem('qaSeeded', '1'); localStorage.setItem('aigile.topbar.pinned', JSON.stringify(['bugBtn', 'ideaBtn', 'helpBtn', 'inboxTop', 'setupNav', 'statusBtn'])); localStorage.setItem('aigile.topbar.pinned.status', '1'); localStorage.setItem('aigile.topbar.pinned.idea', '1'); } } catch {} });
  let page; try { page = await openPage(fresh, '#/'); } finally { openPage.firstrun = false; }
  await page.waitForSelector('#tbMoreBtn');
  const onBar = () => page.evaluate(() => { const e = document.getElementById('usageNav'); return !!e && !e.closest('#tbMoreMenu') && e.getClientRects().length > 0; });
  check('a saved pin list without Usage: Usage joins the bar once', await onBar() && await page.evaluate(() => JSON.parse(localStorage.getItem('aigile.topbar.pinned')).includes('usageNav') && localStorage.getItem('aigile.topbar.pinned.usage') === '1'));
  await page.locator('#tbMoreBtn').click();
  check('More ends with ⚙ Customise top bar…', await page.evaluate(() => { const m = document.getElementById('tbMoreMenu'), l = m.lastElementChild; return !!l && l.id === 'tbCustom' && l.getClientRects().length > 0 && /Customise top bar/.test(l.textContent); }));
  await page.locator('#tbCustom').click();
  await page.waitForSelector('#topbarBox.tb-flash', { timeout: 8000 }).catch(() => {});
  check('it opens Setup on the top bar box, flashed, and the menu closes', page.url().endsWith('#/setup/topbar') && await page.locator('#tbMoreMenu').isHidden() && await page.evaluate(() => document.getElementById('topbarBox').classList.contains('tb-flash')), page.url());
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => Math.round(document.getElementById('topbarBox').getBoundingClientRect().top));
  check('the top bar box is scrolled into view (' + top + 'px)', top >= 0 && top < 300);
  await page.locator('#tbMoreBtn').click(); await page.locator('#tbCustom').click(); await page.waitForTimeout(200);
  check('from Setup itself it works again (still on the box, menu closed)', page.url().endsWith('#/setup/topbar') && await page.locator('#tbMoreMenu').isHidden());
  // unpin Usage: it stays off after a reload
  await page.locator('[data-pin=usageNav]').uncheck();
  await page.reload(); await page.waitForSelector('#tbMoreBtn');
  check('unpinning Usage sticks after a reload (it is under More)', !(await onBar()) && await page.evaluate(() => !!document.getElementById('usageNav').closest('#tbMoreMenu') && !JSON.parse(localStorage.getItem('aigile.topbar.pinned')).includes('usageNav')));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('header').offsetHeight < 70);
  await page.waitForFunction(() => document.getElementById('tbCustom').hidden, null, { timeout: 8000 }).catch(() => {});
  check('phone: no Customise item in the ☰ menu', await page.evaluate(() => document.getElementById('tbCustom').hidden));
  noErrors(page);
  await fresh.close();
}, true);

// AIG-1180: the project board header is one row at 1280, 1024 and 390 px, light and dark. AIG-1181: a card added where no team exists goes to Backlog, not For the team.
def('tbboard', 'Project board: the header stays on one row at 1280/1024/390 px, light and dark; a first card with no team goes to Backlog (AIG-1180/1181)', async (s, ctx) => {
  const p = await mkProject(s, 'A rather long project name for the crumb', 'LNG');
  await mkCard(s, p.slug, 'Waiting work', { status: 'todo' });
  openPage.firstrun = true; const fresh = await ctx.browser().newContext({ viewport: { width: 1280, height: 800 } }); let page; try { page = await openPage(fresh, '#/p/' + p.slug); } finally { openPage.firstrun = false; }   // the bar as a new user sees it
  await page.waitForSelector('header .crumb');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    for (const w of [1280, 1024, 390]) {
      await page.setViewportSize({ width: w, height: 800 });
      await sleep(250);
      const m = await page.evaluate(() => { const h = document.querySelector('header'), tops = [...h.children].filter(e => e.getClientRects().length && getComputedStyle(e).position !== 'absolute').map(e => Math.round(e.getBoundingClientRect().top)); return { rows: new Set(tops.map(t => Math.round(t / 12))).size, h: h.offsetHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      check(`${theme} ${w}px: header fits (1280 and 390: one row; 1024 may take two) (${m.rows} rows, ${m.h}px)`, m.h <= (w === 1024 ? 100 : 70) && m.over <= 0, JSON.stringify(m));
      if (theme === 'light' && w === 1280 && process.env.QA_SHOT_DIR) await page.screenshot({ path: process.env.QA_SHOT_DIR + '/header-1280-after.png' }).catch(() => {});
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  const addCard = async title => {
    await page.evaluate(() => newCard());
    await page.waitForSelector('#dialog #f-title');
    await page.fill('#f-title', title);
    await page.click('#dialog button[type=submit]');
    await sleep(800);
    return (await s.ok('GET', '/api/projects/' + p.slug)).cards.find(c => c.title === title);
  };
  const first = await addCard('First card, no team');
  check('no team members: the new card goes to Backlog', first && first.status === 'backlog', first && first.status);
  await s.ok('POST', `/api/projects/${p.slug}/team`, { name: 'Dev', role: 'Developer' });
  await page.reload(); await page.waitForSelector('header .crumb');
  const second = await addCard('Second card, team exists');
  check('with a team member: the new card goes to For the team', second && second.status === 'team', second && second.status);
  const e = await mkProject(s, 'Empty one', 'EMP');   // AIG-1189: a column's + keeps its status when another project is picked
  await page.reload(); await page.waitForSelector('header .crumb');
  await page.evaluate(() => newCard({ status: 'doing' }));
  await page.waitForSelector('#dialog #nc-project');
  await page.selectOption('#nc-project', e.slug);
  await page.fill('#f-title', 'Column plus, other project');
  await page.click('#dialog button[type=submit]');
  await sleep(800);
  const third = (await s.ok('GET', '/api/projects/' + e.slug)).cards.find(c => c.title === 'Column plus, other project');
  check('a column + then another project: the card keeps the column it was added in', third && third.status === 'doing', third && third.status);
  noErrors(page);
}, true);
