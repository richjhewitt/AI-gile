// QA area: mention (AIG-851/853), @ tags in a card reply: a searchable list of the team, Enter picks instead of sending, @Best dispatch.
import { check, sleep, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('mention', '@ in a card reply lists the team (search as you type, Best first); Enter or a click puts @Name in, Esc closes; @Best goes to the lead to pick (AIG-851/853)', async (s, ctx) => {
  await mkProject(s, 'Tagged', 'TAG');
  for (const [name, role] of [['Lead', 'lead'], ['Pixel', 'Frontend'], ['Forge', 'Backend']]) await s.ok('POST', '/api/projects/tagged/team', { name, role });
  await mkCard(s, 'tagged', 'Tag card', { status: 'doing', assignee: 'Forge' });
  await say(s, 'tagged', 'TAG-1', 'Forge', 'working on it');
  const page = await openPage(ctx, '#/p/tagged/TAG-1');
  await page.waitForSelector('#r-text');
  await page.click('#r-text');
  await page.keyboard.type('hi @');
  await page.waitForSelector('.mention-box .mention-item');
  const names = () => page.$$eval('.mention-item', l => l.map(x => x.textContent.trim()));
  const all = await names();
  check('@ lists Best first, then the team', all[0].includes('Best') && ['@Lead', '@Pixel', '@Forge'].every(n => all.some(x => x.startsWith(n))), all);
  await page.keyboard.type('pix');
  await sleep(100);
  check('typing searches the list', JSON.stringify(await names()) === JSON.stringify(['@Pixel Frontend']), await names());
  await page.keyboard.press('Enter');
  check('Enter picks the name and does not send', (await page.inputValue('#r-text')) === 'hi @Pixel ' && !(await page.isVisible('.mention-box')), await page.inputValue('#r-text'));
  await page.keyboard.type('and @');
  await page.waitForSelector('.mention-box');
  await page.keyboard.press('Escape');
  check('Esc closes the list and keeps the text', !(await page.isVisible('.mention-box')) && (await page.inputValue('#r-text')) === 'hi @Pixel and @');
  await page.keyboard.type('b');
  await page.waitForSelector('.mention-box');
  await page.click('.mention-item');
  check('clicking Best puts @Best in', (await page.inputValue('#r-text')) === 'hi @Pixel and @Best ');
  await page.fill('#r-text', 'mail me@pixel.com');
  await sleep(200);
  check('an email address opens no list', !(await page.isVisible('.mention-box')));
  const d = require_dispatch();
  const p = { team: [{ name: 'Lead', role: 'lead' }, { name: 'Pixel', role: 'Frontend' }] }, c = { title: 'x', status: 'todo' };
  check('@Best goes to the lead to pick (unclear)', (r => r.unclear && /@Best/.test(r.why))(d.dispatch(p, c, { text: 'what now @Best' })));
  check('@Pixel still wakes Pixel', d.dispatch(p, c, { text: 'what now @Pixel' }).role === 'Pixel');
  await noErrors(page);
}, true);

import { createRequire } from 'node:module';
const require_dispatch = () => createRequire(import.meta.url)('../../../lib/dispatch.js');
