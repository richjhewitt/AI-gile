// QA area: boxux (AIG-933, AIG-938, AIG-939): board toolbar behind a ⋯ on a phone, For you chips with something in them, folded Details, priority chip only once set, labelled icons.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('boxux', 'board on a phone opens cards first (⋯ opens the toolbar), For you shows only chips with cards, Details is folded, the priority chip shows once set, icons carry labels (AIG-933/938/939)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { description: 'A test project' });
  const a = await mkCard(s, 'alpha', 'Plain task'), b = await mkCard(s, 'alpha', 'Prio task');
  s.cli(['task', 'alpha', a.id, 'log in', '--as', 'Lead']);
  s.cli(['task', 'alpha', b.id, 'run it', '--as', 'Lead']);
  await s.ok('PATCH', `/api/projects/alpha/cards/${b.id}`, { ownerPrio: 'now' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');

  // desktop: unchanged toolbar, no ⋯
  check('desktop: no ⋯ button', !(await page.isVisible('#tbDots')));
  check('desktop: toolbar buttons visible', await page.isVisible('.toolbar button[onclick="docsDialogOpen()"], .toolbar button[onclick="openDocs()"]'));
  check('desktop: the New card button is visible', await page.isVisible('.toolbar .primary'));

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

  // phone (AIG-933)
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(300);
  check('phone: the ⋯ button shows', await page.isVisible('#tbDots'));
  check('phone: toolbar buttons are folded away', !(await page.isVisible('.toolbar button[onclick="openDocs()"]')));
  const top = await page.$eval('.column.foryou .card', e => e.getBoundingClientRect().top - document.querySelector('.toolbar').getBoundingClientRect().top);   // the top bar above is not this card's
  check('phone: the first card follows within 250px of the toolbar', top < 250, await page.$$eval('#app > *, .toolbar > *', els => els.map(e => e.className + '@' + Math.round(e.getBoundingClientRect().top) + '/' + Math.round(e.getBoundingClientRect().height)).join(' ')));
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
  noErrors(page);
}, true);
