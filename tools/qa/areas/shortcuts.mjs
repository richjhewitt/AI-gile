// QA area: shortcuts (AIG-807): real key presses for j/k/o, a/b on an open For you card, n, g+letter, /, ? cheat sheet; nothing fires while typing.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('shortcuts', 'keyboard shortcuts: list, card verdict, new card, g+letter pages, search, ? cheat sheet; silent while typing (AIG-807)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Verify me', { status: 'verify', testSteps: 'Step one' });
  await mkCard(s, 'alpha', 'Verify two', { status: 'verify', testSteps: 'Step two' });
  await mkCard(s, 'alpha', 'Plain card', { status: 'todo' });
  await mkCard(s, 'alpha', 'Verify three', { status: 'verify', testSteps: 'Step three' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('a.card[data-id]');
  const hash = () => page.evaluate(() => location.hash);
  const dialog = () => page.locator('#dialog .dialog.sc').count();

  // Typing in a text box must trigger nothing.
  await page.fill('#f-q', '');
  await page.focus('#f-q');
  await page.keyboard.type('n?gsj');
  check('typing in the search box fires no shortcut', (await dialog()) === 0 && (await hash()) === '#/p/alpha' && (await page.locator('#modal .panel').count()) === 0 && (await page.inputValue('#f-q')) === 'n?gsj');
  await page.fill('#f-q', '');
  await page.evaluate(() => document.activeElement.blur());

  // Ctrl held: nothing.
  await page.keyboard.press('Control+/');
  check('Ctrl+key is left alone', (await page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'f-q');

  // Cheat sheet.
  await page.keyboard.press('?');
  check('? opens the cheat sheet', (await dialog()) === 1 && (await page.locator('.sc-t tr').count()) >= 10);
  check('cheat sheet button says Close, not the self-care Done (AIG-1269)', (await page.locator('#scClose').innerText()).trim() === 'Close');
  check('cheat sheet has no raw language keys', !/\bsc\.[a-z]+/.test(await page.locator('#dialog').innerText()));
  await page.keyboard.press('Escape');
  check('Esc closes the cheat sheet', (await dialog()) === 0 && (await page.locator('#dialog > *').count()) === 0);
  await page.keyboard.press('?'); await page.keyboard.press('?');
  check('? again closes it', (await dialog()) === 0);

  // Phone width.
  await page.setViewportSize({ width: 375, height: 700 });
  await page.keyboard.press('?');
  const box = await page.locator('#dialog .dialog.sc').boundingBox();
  check('cheat sheet fits a phone', box && box.x >= 0 && box.x + box.width <= 376, box);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1200, height: 800 });

  // Dark mode.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.keyboard.press('?');
  const col = await page.locator('.sc-t kbd').first().evaluate(e => getComputedStyle(e).color + '|' + getComputedStyle(e).backgroundColor);
  check('cheat sheet keys are readable in dark mode', col.split('|')[0] !== col.split('|')[1], col);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ colorScheme: 'light' });

  // List: j / k / o.
  await page.keyboard.press('j');
  let first = await page.evaluate(() => document.activeElement.dataset.id);
  await page.keyboard.press('j');
  const second = await page.evaluate(() => document.activeElement.dataset.id);
  check('j moves the focus down the cards', !!first && !!second && first !== second, [first, second]);
  await page.keyboard.press('k');
  check('k moves it back up', (await page.evaluate(() => document.activeElement.dataset.id)) === first);
  await page.focus('a.card[data-id="ALP-3"]');
  await page.keyboard.press('o');
  await page.waitForSelector('#modal .panel');
  check('o opens the focused card', (await hash()) === '#/p/alpha/ALP-3', await hash());
  await page.keyboard.press('Escape');
  await page.goto(page.url().split('#')[0] + '#/p/alpha');
  await page.waitForSelector('a.card[data-id]');
  first = 'ALP-1';
  await page.focus('a.card[data-id="ALP-1"]');
  await page.keyboard.press('o');
  await page.waitForSelector('#fyfList .fyf-row.open');
  check('o on a For you card unfolds it in the For you window', true);

  // b / a on the unfolded For you card.
  await page.keyboard.press('b');
  await sleep(300);
  check('b opens the reason box (one Send back, AIG-1373) and sends nothing', await page.locator('#fyfList .fyf-row.open .ib-sb textarea').isVisible() && await page.locator('#fyfList .fyf-row.open [data-act=sbopen]').isHidden() && (await getCard(s, 'alpha', first)).status === 'verify');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('a');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', first)).status === 'verify'; i++) await sleep(250);
  check('a accepts the open card', (await getCard(s, 'alpha', first)).status === 'done');

  // Accepting a test opens the next one (AIG-1212): wait for that before unfolding more, or a click can race it and fold ALP-2 shut.
  await page.waitForSelector('#fyfList .fyf-row.open[data-id="ALP-2"]');
  check('accepting opens the next test row', (await page.locator('#fyfList .fyf-row[data-id="ALP-1"]').count()) === 0);
  // Several rows unfolded: a/b act on the focused row only, or do nothing when none is focused.
  const rowOpen = async id => { if (!(await page.locator(`#fyfList .fyf-row.open[data-id="${id}"]`).count())) await page.click(`#fyfList .fyf-row[data-id="${id}"] [data-fyrow]`); };
  await rowOpen('ALP-2'); await rowOpen('ALP-4');
  await page.evaluate(() => document.activeElement.blur());
  check('ALP-2 and ALP-4 are both unfolded', (await page.locator('#fyfList .fyf-row.open').count()) === 2);
  await page.keyboard.press('a'); await sleep(800);
  check('two rows unfolded and none focused: a does nothing', (await getCard(s, 'alpha', 'ALP-2')).status === 'verify' && (await getCard(s, 'alpha', 'ALP-4')).status === 'verify');
  await page.focus('#fyfList .fyf-row[data-id="ALP-4"] [data-act="accept"]');
  await page.keyboard.press('a');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', 'ALP-4')).status === 'verify'; i++) await sleep(250);
  check('a acts on the focused row, not the first one', (await getCard(s, 'alpha', 'ALP-4')).status === 'done' && (await getCard(s, 'alpha', 'ALP-2')).status === 'verify');

  await page.keyboard.press('Escape');
  // a in a normal card modal clicks Accept (the button is verdict(true, this))
  await page.goto(page.url().split('#')[0] + '#/p/alpha/ALP-2');
  await page.waitForSelector('#modal .panel .verdict');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('a');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', 'ALP-2')).status === 'verify'; i++) await sleep(250);
  check('a accepts from the card modal', (await getCard(s, 'alpha', 'ALP-2')).status === 'done');
  // n: new card dialog; typing in it fires nothing.
  await page.goto(page.url().split('#')[0] + '#/p/alpha');
  await page.waitForSelector('a.card[data-id]');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('n');
  await page.waitForSelector('#dialog input, #dialog textarea');
  check('n opens the new card dialog', (await page.locator('#dialog .dialog').count()) === 1);
  await page.keyboard.press('Escape');
  await sleep(200);

  // / focuses search; g then i / h / s / m.
  await page.keyboard.press('/');
  check('/ focuses the search box', (await page.evaluate(() => document.activeElement.id)) === 'f-q');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('g'); await page.keyboard.press('i');
  await page.waitForFunction(() => location.hash === '#/inbox');
  check('g i goes to the inbox', true);
  await page.keyboard.press('g'); await page.keyboard.press('s');
  await page.waitForFunction(() => location.hash === '#/setup');
  check('g s goes to Setup', true);
  await page.keyboard.press('g'); await page.keyboard.press('h');
  await page.waitForFunction(() => location.hash === '#/');
  check('g h goes home', true);
  await page.keyboard.press('g'); await page.keyboard.press('m');
  await page.waitForSelector('#dmPanel:not([hidden])');
  check('g m opens Messages', true);

  // AIG-1267: Shift+Right / Shift+Left move the focused card one column and keep focus; AIG-1268: e edits, c comments.
  await mkCard(s, 'alpha', 'Mover', { status: 'todo' });
  await page.goto(page.url().split('#')[0] + '#/p/alpha');
  await page.waitForFunction(() => [...document.querySelectorAll('a.card[data-id]')].some(a => /Mover/.test(a.textContent)));   // the board can paint the cached project first
  const mid = await page.evaluate(() => [...document.querySelectorAll('a.card[data-id]')].find(a => /Mover/.test(a.textContent)).dataset.id);
  const st0 = (await getCard(s, 'alpha', mid)).status;
  await page.focus(`a.card[data-id="${mid}"]`);
  await page.keyboard.press('Shift+ArrowRight');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', mid)).status === st0; i++) await sleep(250);
  const st1 = (await getCard(s, 'alpha', mid)).status;
  await sleep(500);
  check('Shift+Right moves the focused card to the next column', st1 !== st0, [st0, st1]);
  check('the moved card keeps focus', (await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.id)) === mid);
  check('the move is announced', /moved to/.test(await page.locator('#scLive').innerText()));
  await page.keyboard.press('Shift+ArrowLeft');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', mid)).status === st1; i++) await sleep(250);
  check('Shift+Left moves it back', (await getCard(s, 'alpha', mid)).status === st0);
  // AIG-1267: two Shift+Right in a row, waiting past the board redraw in between, move the card two columns.
  const colOrder = await page.evaluate(() => [...document.querySelectorAll('#app .board .column')].filter(c => c.getClientRects().length).map(c => c.dataset.status));
  await page.focus(`a.card[data-id="${mid}"]`);
  await page.keyboard.press('Shift+ArrowRight');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', mid)).status === st0; i++) await sleep(250);
  await sleep(1500);
  await page.evaluate(async () => { state.lastSig = state.lastBoardSig = null; await refresh(true); });
  const focusedAfter = await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.id);
  const stA = (await getCard(s, 'alpha', mid)).status;
  await page.keyboard.press('Shift+ArrowRight');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', mid)).status === stA; i++) await sleep(250);
  const stB = (await getCard(s, 'alpha', mid)).status;
  check('after a move and a board redraw the card still has focus', focusedAfter === mid, focusedAfter);
  check('two Shift+Right in a row move the card two columns', colOrder.indexOf(stB) === colOrder.indexOf(st0) + 2, [colOrder, st0, stA, stB]);
  await page.focus(`a.card[data-id="${mid}"]`);
  await page.keyboard.press('Shift+ArrowLeft');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', mid)).status === stB; i++) await sleep(250);
  await sleep(300);
  await page.keyboard.press('Shift+ArrowLeft');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', mid)).status !== st0; i++) await sleep(250);
  check('two Shift+Left bring it back', (await getCard(s, 'alpha', mid)).status === st0);
  await page.focus(`a.card[data-id="${mid}"]`);
  await page.evaluate(async () => { state.lastSig = state.lastBoardSig = null; await refresh(true); });
  check('a board redraw keeps the focused card focused (AIG-1289)', (await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.id)) === mid);
  await page.keyboard.press('?');
  check('cheat sheet lists move, edit and comment', /Shift\+←/.test(await page.locator('#dialog').innerText()) && (await page.locator('.sc-t kbd', { hasText: /^e$/ }).count()) === 1);
  await page.keyboard.press('Escape');
  await page.goto(page.url().split('#')[0] + '#/p/alpha/' + mid);
  await page.waitForSelector('#modal .panel');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('c');
  check('c puts the cursor in the reply box', (await page.evaluate(() => document.activeElement.id)) === 'r-text');
  await page.keyboard.type('hello');
  check('typing in the reply box fires no shortcut', (await page.inputValue('#r-text')) === 'hello');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('e');
  await page.waitForSelector('#f-title');
  check('e opens the edit form', true);
  // AIG-1268: Esc leaves the edit form (nothing saved, focus on the card panel), so c then jumps to the reply box.
  await page.keyboard.type('XYZ');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#f-title', { state: 'detached' });
  check('Esc in the edit form goes back to the card view', (await page.locator('#modal .panel').count()) === 1 && (await page.locator('#modal .panel form #f-title').count()) === 0);
  check('Esc saved nothing', (await getCard(s, 'alpha', mid)).title === 'Mover');
  check('after Esc the focus is on the card panel', await page.evaluate(() => !!document.activeElement.closest('#modal .panel')));
  await page.keyboard.press('c');
  check('c after Esc puts the cursor in the reply box, not the title', (await page.evaluate(() => document.activeElement.id)) === 'r-text');
  // AIG-1371: Esc in the reply box leaves the box; the next Esc closes the card and focus goes back to its board card. Opening puts focus in the card.
  await page.keyboard.press('Escape');
  check('Esc in the reply box leaves the box, the card stays open', (await page.locator('#modal .panel').count()) === 1 && await page.evaluate(() => document.activeElement.id !== 'r-text' && !!document.activeElement.closest('#modal .panel')));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#modal .panel', { state: 'detached', timeout: 3000 }).catch(() => {});
  check('Esc closes the open card', (await page.locator('#modal .panel').count()) === 0 && !(await page.evaluate(() => location.hash)).includes(mid));
  await page.waitForFunction(id => (document.activeElement || {}).dataset?.id === id, mid, { timeout: 3000 }).catch(() => {});
  check('after closing, focus is back on its board card', (await page.evaluate(() => (document.activeElement || {}).dataset?.id)) === mid);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal .panel');
  check('opening a card with Enter puts focus inside the card', await page.evaluate(() => !!document.activeElement.closest('#modal .panel')));
  await page.locator('#cm-btn').click();
  await page.keyboard.press('Escape');
  check('Esc with the ⋯ menu open closes only the menu', (await page.locator('#modal .panel').count()) === 1 && await page.evaluate(() => !state.cardMenu && document.getElementById('card-menu').hidden));   // QA mode always shows the menu's buttons, so read the state
  await page.keyboard.press('Escape');
  await page.waitForSelector('#modal .panel', { state: 'detached', timeout: 3000 }).catch(() => {});
  check('the next Esc closes the card', (await page.locator('#modal .panel').count()) === 0);
  await noErrors(page);
  await page.close();
}, true);
