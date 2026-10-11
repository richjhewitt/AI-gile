// QA area: emoji (AIG-342), :shortcodes: with a search popup in text boxes.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('emoji', ':smi opens a popup, Enter inserts; :thumbsup: typed in full becomes the emoji and is sent; Esc closes', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Chatty', { status: 'verify', testSteps: 'Step one' });
  const page = await openPage(ctx, '#/p/alpha/ALP-1');
  await page.waitForSelector('#modal .panel');
  await page.click('.ctab[data-ctab=reply]');
  await page.click('#r-text');
  await page.keyboard.type(':smi');
  await page.waitForSelector('.emj');
  const rows = await page.$$eval('.emj-row', els => els.map(e => e.textContent));
  check('popup lists matches with name and glyph', rows.length > 1 && rows.some(r => r.includes(':smile:')) && rows[0].includes('😄'), rows);
  check('popup shows the hint', /Esc closes/.test(await page.textContent('.emj-hint')));
  await page.keyboard.press('Enter');
  check('Enter inserts the emoji and closes the popup', (await page.inputValue('#r-text')) === '😄' && !(await page.$('.emj')), await page.inputValue('#r-text'));
  check('Enter did not send the reply', (await getCard(s, 'alpha', 'ALP-1')).comments.length === 0);
  await page.keyboard.type(' :smi');
  await page.waitForSelector('.emj');
  await page.keyboard.press('Escape');
  check('Esc closes the popup and keeps the text', !(await page.$('.emj')) && (await page.inputValue('#r-text')) === '😄 :smi');
  await page.fill('#r-text', '');
  await page.keyboard.type(':heart_ey');
  await page.waitForSelector('.emj');
  await page.keyboard.press('ArrowDown');
  await page.click('.emj-row >> nth=0');
  check('mouse click picks', (await page.inputValue('#r-text')).length > 0 && !(await page.$('.emj')), await page.inputValue('#r-text'));
  await page.fill('#r-text', 'nice :thumbsup:');
  check('a full :thumbsup: turns into the emoji', (await page.inputValue('#r-text')) === 'nice 👍', await page.inputValue('#r-text'));
  await page.fill('#r-text', 'see 10:30:45 and :nosuchthing:');
  check('unknown names and times are left alone', (await page.inputValue('#r-text')) === 'see 10:30:45 and :nosuchthing:');
  await page.fill('#r-text', 'done :tada:');
  await page.press('#r-text', 'Enter');
  await sleep(700);
  const c = await getCard(s, 'alpha', 'ALP-1');
  check('the sent comment holds the emoji', c.comments.at(-1) && c.comments.at(-1).text === 'done 🎉', c.comments);
  noErrors(page);
}, true);
