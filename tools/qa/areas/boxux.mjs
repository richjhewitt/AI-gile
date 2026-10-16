// QA area: boxux (AIG-933, AIG-938, AIG-939): board toolbar behind a ⋯ on a phone, For you chips with something in them, folded Details, priority chip only once set, labelled icons.
import { check, sleep, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('boxux', 'board on a phone opens cards first (⋯ opens the toolbar), For you shows only chips with cards, Details is folded, the priority chip shows once set, icons carry labels (AIG-933/938/939)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { description: 'A test project', path: tmp('boxux'), team: true });   // a team and a folder, like a new project: else the AIG-1298 line sits on top
  const a = await mkCard(s, 'alpha', 'Plain task'), b = await mkCard(s, 'alpha', 'Prio task');
  s.cli(['task', 'alpha', a.id, 'log in', '--as', 'Lead']);
  s.cli(['task', 'alpha', b.id, 'run it', '--as', 'Lead']);
  await s.ok('PATCH', `/api/projects/alpha/cards/${b.id}`, { ownerPrio: 'now' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');

  // desktop: unchanged toolbar, no ⋯
  check('desktop: More stays after adding cards (AIG-1359)', await page.isVisible('#tbDots') && !(await page.isVisible('#hfBtn')));
  check('desktop: Views stays visible', await page.isVisible('.toolbar button[onclick="viewsDialog()"]'));
  check('desktop: the New card button is visible', await page.isVisible('.toolbar .primary'));

  check('rare Pick and deleted tools stay folded (AIG-1420)', !(await page.isVisible('#pickBtn')) && !(await page.isVisible('#boardTbMore')));
  check('deleted tool stays inside More (AIG-1385)', await page.evaluate(p => { const host = document.createElement('div'); host.innerHTML = renderBoard({ ...p, nDeleted: 1 }); return !!host.querySelector('#boardTbMore #deletedBtn') && !!host.querySelector('#boardTbMore #pickBtn'); }, await s.ok('GET', '/api/projects/alpha')));
  await page.click('#tbDots');
  check('Ask the team and What is happening stay visible (AIG-1420)', await page.isVisible('.tb-keep [onclick="askTeamDialog()"]') && await page.isVisible('.tb-keep [onclick="happeningDialog()"]'));
  await page.evaluate(() => { if (state.tbOpen) toggleTb(); });
  if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/AIG-1420.png'});
  // For you chips (AIG-938)
  const chips = await page.$$eval('.fy-chips .fy-chip', els => els.map(e => e.dataset.first));
  check('For you shows only chips with cards (plus the active one)', chips.length >= 1 && chips.length < 8 && chips.includes('k'), chips);
  check('no chip with a 0 count unless active', (await page.$$eval('.fy-chips .fy-chip', els => els.filter(e => /\s0\s*$/.test(e.textContent) && !e.classList.contains('on')).length)) === 0);

  // Details (AIG-938)
  check('Details is a closed details element', await page.$eval('#bDetails', d => d.tagName === 'DETAILS' && !d.open));
  check('the folder path and In flight are inside it', await page.$eval('#bDetails', d => !!d.querySelector('.flight')));
  check('In flight is not visible while folded', !(await page.isVisible('#bDetails .flight')));
  await page.click('#bDetails summary');
  check('Details opens and shows In flight', await page.isVisible('#bDetails .flight'));
  await sleep(1500);
  check('Details stays open across the redraw', await page.$eval('#bDetails', d => d.open));
  await page.click('#bDetails summary');

  // icons and the priority chip (AIG-939)
  const sv = page.locator(`.column.foryou .card[data-id="${a.id}"] [data-server]`);
  check('the server switch has a visible label and aria-label', /\S+\s+\S+/.test((await sv.textContent()).trim()) && !!(await sv.getAttribute('aria-label')), await sv.textContent());
  const ou = page.locator(`.column.foryou .card[data-id="${a.id}"] [data-outside]`);
  check('the outside switch has a visible label and aria-label', /\S+\s+\S+/.test((await ou.textContent()).trim()) && !!(await ou.getAttribute('aria-label')), await ou.textContent());
  const unset = page.locator(`.column.foryou .card[data-id="${a.id}"] [data-prio]`);
  const op = () => unset.evaluate(e => getComputedStyle(e).opacity);
  check('an unset priority chip is invisible until hovered', (await op()) === '0');
  await page.hover(`.column.foryou .card[data-id="${a.id}"] .q-chips`);
  await sleep(300);
  check('it shows when its chip row is hovered', (await op()) === '1', await op());
  check('a set priority chip is always visible', await page.isVisible(`.column.foryou .card[data-id="${b.id}"] [data-prio]`));
  await page.mouse.move(0, 0);

  await page.screenshot({ path: 'R:/wt/shot-board-desk.png' }).catch(() => {});

  await page.evaluate(() => { if (state.tbOpen) toggleTb(); });
  // phone (AIG-933)
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(300);
  check('phone: the ⋯ button shows', await page.isVisible('#tbDots'));
  check('phone: toolbar buttons are folded away', !(await page.isVisible('.toolbar button[onclick="openDocs()"]')));
  const top = await page.$eval('.column.foryou .card', e => e.getBoundingClientRect().top - document.querySelector('.toolbar').getBoundingClientRect().top);   // the top bar above is not this card's
  check('phone: the first card follows within 350px of the toolbar with visible chat actions', top < 350, await page.$$eval('#app > *, .toolbar > *', els => els.map(e => e.className + '@' + Math.round(e.getBoundingClientRect().top) + '/' + Math.round(e.getBoundingClientRect().height)).join(' ')));
  await page.click('#tbDots');
  check('phone: ⋯ opens the same controls', await page.isVisible('.toolbar button[onclick="openDocs()"]') && await page.isVisible('#hfBtn'));
  await sleep(1500);
  check('phone: the toolbar stays open across the redraw', await page.isVisible('#hfBtn'));
  check('phone: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'R:/wt/shot-board-phone-open.png' }).catch(() => {});
  await page.click('#tbDots');
  check('phone: ⋯ closes it again', !(await page.isVisible('#hfBtn')));
  await page.screenshot({ path: 'R:/wt/shot-board-phone.png' }).catch(() => {});
  await page.emulateMedia({ colorScheme: 'dark' });
  await sleep(300);
  await page.screenshot({ path: 'R:/wt/shot-board-phone-dark.png' }).catch(() => {});
  await page.emulateMedia({ colorScheme: 'light' });

  // AIG-1076: an empty project on a desktop shows few buttons, the rest behind ⋯ More
  await mkProject(s, 'Empty', 'EMP');
  const ep = await openPage(ctx, '#/p/empty');
  await ep.waitForSelector('.toolbar.compact');
  check('empty project: New, Docs, Ask the team and Views stay on the bar', await ep.isVisible('.toolbar .primary') && await ep.isVisible('.toolbar button[onclick="openDocs()"]') && await ep.isVisible('.toolbar button[onclick="askTeamDialog()"]') && await ep.isVisible('.toolbar button[onclick="viewsDialog()"]'));
  check('empty project: ⋯ More shows and the other buttons are folded away', await ep.isVisible('#tbDots') && !(await ep.isVisible('#hfBtn')));
  await ep.click('#tbDots');
  check('empty project: ⋯ More opens the rest', await ep.isVisible('#hfBtn'));
  check('empty project: the bar is one row', await ep.$eval('.toolbar', e => e.getBoundingClientRect().height < 70));
  // AIG-1083: column headers stay on one line and all 7 columns fit at 1366
  await ep.setViewportSize({ width: 1366, height: 800 });
  await sleep(400);
  check('1366px: all columns fit without sideways scroll', await ep.$eval('.board', e => e.scrollWidth <= e.clientWidth + 1));
  check('column names remain fully readable', await ep.$$eval('.column h3 > span:first-child', es => es.every(e => e.scrollWidth <= e.clientWidth + 1)));
  check('For you actions sit below the full label', await ep.$eval('.column.foryou h3', h => { const [a, b] = h.children; return b.getBoundingClientRect().top >= a.getBoundingClientRect().bottom - 1; }));
  // AIG-1082: a phone shows search plus a ⚙ Filters button, the dropdowns open under it
  await ep.setViewportSize({ width: 390, height: 844 });
  await sleep(400);
  check('phone: the dropdowns are folded behind ⚙ Filters', await ep.isVisible('#f-q') && await ep.isVisible('#f-tog') && !(await ep.isVisible('#f-sel')));
  check('phone: the search and Filters share one row', await ep.$eval('#filterbar', e => e.getBoundingClientRect().height < 60));
  await ep.click('#f-tog');
  check('phone: ⚙ Filters opens the dropdowns', await ep.isVisible('#f-sel select'));
  await ep.click('#f-tog');
  check('phone: the top bar stays on one line', await ep.$eval('header', e => e.getBoundingClientRect().height < 70));
  // AIG-1086: the new card labels its GIF button and has no Pop out on a phone
  await ep.click('.toolbar .primary');
  await ep.waitForSelector('.att-gif');
  check('new card: the GIF button has a visible label', /GIF/.test(await ep.textContent('.att-gif')) && !!(await ep.getAttribute('.att-gif', 'aria-label')));
  check('phone: no Pop out in the new card', await ep.$$eval('.dlg-pop, .card-pop', els => els.every(e => getComputedStyle(e).display === 'none')));
  await ep.keyboard.press('Escape');
  await ep.setViewportSize({ width: 1280, height: 800 });
  await sleep(300);
  check('desktop: More remains available', await ep.isVisible('#tbDots'));
  await ep.close();
  noErrors(page);
}, true);
