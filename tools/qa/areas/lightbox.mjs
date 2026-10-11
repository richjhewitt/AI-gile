// QA area: lightbox (AIG-372).
import { BASE, check, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('lightbox', 'pictures open full size on click (inbox), arrows and Esc; Copy and folder buttons side by side (AIG-372)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmgACZgYAAAKfEC/tW5j8QAAAAASUVORK5CYII=';
  const c = await mkCard(s, 'alpha', 'Pictures', { status: 'doing', assignee: 'Forge' });
  const ids = [];
  for (const n of ['one.png', 'two.png']) ids.push((await s.ok('POST', '/api/projects/alpha/attachments', { name: n, type: 'image/png', data: PNG })).id);
  await say(s, 'alpha', c.id, 'Forge', 'look at these\n```\nC:/Users/rich/Desktop\n```', { needsYou: true, attachments: ids });
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-item .att-shown img');
  await page.click('.ib-item .att-shown a:nth-child(1) img');
  await page.waitForSelector('.att-lightbox img');
  check('click opens the full-size overlay', await page.locator('.att-lightbox').count() === 1);
  check('first picture shown', (await page.getAttribute('.att-lightbox img', 'src')).endsWith(encodeURIComponent(ids[0])));
  await page.keyboard.press('ArrowRight');
  check('arrow key shows the next picture', (await page.getAttribute('.att-lightbox img', 'src')).endsWith(encodeURIComponent(ids[1])));
  await page.keyboard.press('Escape');
  check('Esc closes it', await page.locator('.att-lightbox').count() === 0);
  await page.click('.ib-item .att-shown a:nth-child(2) img');
  await page.waitForSelector('.att-lightbox');
  await page.mouse.click(5, 5);
  check('click outside closes it', await page.locator('.att-lightbox').count() === 0);
  await page.goto(BASE + '/#/p/alpha/' + c.id);
  await page.waitForSelector('.codebox .copy.edit');
  const boxes = await page.$$eval('.codebox .copy', els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
  check('Copy and 📂 do not overlap', boxes.length === 2 && (boxes[0][1] <= boxes[1][0] || boxes[1][1] <= boxes[0][0]), boxes);
  noErrors(page);
}, true);
