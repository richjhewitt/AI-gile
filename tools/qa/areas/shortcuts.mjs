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
  check('cheat sheet has no raw language keys',!/\bsc\.[a-z]+/.test(await page.locator('#dialog').innerText()));
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
  check('b with no comment asks for one and sends nothing', (await page.locator('#fyfList .fyf-row.open .ib-err').innerText()).length > 0 && (await getCard(s, 'alpha', first)).status === 'verify');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('a');
  for (let i = 0; i < 20 && (await getCard(s, 'alpha', first)).status === 'verify'; i++) await sleep(250);
  check('a accepts the open card', (await getCard(s, 'alpha', first)).status === 'done');

  // Several rows unfolded: a/b act on the focused row only, or do nothing when none is focused.
  const rowOpen = async id => { if (!(await page.locator(`#fyfList .fyf-row.open[data-id="${id}"]`).count())) await page.click(`#fyfList .fyf-row[data-id="${id}"] [data-fyrow]`); };
  await rowOpen('ALP-2'); await rowOpen('ALP-4');
  await page.evaluate(() => document.activeElement.blur());
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
  await noErrors(page);
  await page.close();
}, true);
