// QA area: refactor (AIG-98): projects with files over 400 lines show in the offer with rough numbers; accepting makes one
// refactor project inside each (or one for all) with a card per big file.
import fs from 'fs';
import path from 'path';
import { check, tmp, def, mkProject, openPage, noErrors, until } from '../lib.mjs';

def('refactor', '🧹 refactor offer: big files found with rough numbers, one project inside each or one for all, a card per file (AIG-98)', async (s, ctx) => {
  const big = tmp('rfbig'), small = tmp('rfsmall');
  fs.mkdirSync(path.join(big, 'src'));
  fs.writeFileSync(path.join(big, 'src', 'huge.js'), 'x();\n'.repeat(900));
  fs.writeFileSync(path.join(big, 'ok.js'), 'y();\n'.repeat(50));
  fs.mkdirSync(path.join(big, 'node_modules')); fs.writeFileSync(path.join(big, 'node_modules', 'dep.js'), 'z();\n'.repeat(5000));
  fs.writeFileSync(path.join(small, 'tiny.js'), 'a();\n');
  await mkProject(s, 'Bigapp', 'BGA', { path: big });
  await mkProject(s, 'Smallapp', 'SMA', { path: small });
  const offer = await s.ok('GET', '/api/refactor');
  check('only the project with a big file, node_modules skipped', offer.length === 1 && offer[0].slug === 'bigapp' && offer[0].files.length === 1 && offer[0].files[0].file === 'src/huge.js' && offer[0].savedPerWeek > 0 && offer[0].cost > 0, offer);
  const page = await openPage(ctx, '#/');
  await page.click('button:has-text("Refactor offer")');
  await page.waitForSelector('.rf-row', { timeout: 10000 });
  check('the dialog lists it with its numbers', /Bigapp/.test(await page.textContent('.rf-row')) && /huge\.js/.test(await page.textContent('.rf-row')));
  await page.click('#rf-go');
  await page.waitForSelector('#rf-done li', { timeout: 8000 });
  const all = await s.ok('GET', '/api/projects?all=1'), rp = all.find(p => p.parent === 'bigapp');
  const cards = rp ? (await s.ok('GET', '/api/projects/' + rp.slug)).cards : [];
  check('a refactor project inside it, with a card for the big file, no folder', rp && !rp.path && cards.length === 1 && /huge\.js/.test(cards[0].title) && cards[0].status === 'backlog', { rp, cards });
  noErrors(page); await page.close();
  const one = await s.ok('POST', '/api/refactor', { slugs: ['bigapp'], mode: 'one' });
  check('one for all: a top-level Refactor project', one.made.length === 1 && !(await s.ok('GET', '/api/projects/' + one.made[0].slug)).parent, one);
  check('nothing picked is refused', (await s.api('POST', '/api/refactor', { slugs: [] })).status === 400);
}, true);
