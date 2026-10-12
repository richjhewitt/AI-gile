// QA area: spacekids (AIG-435): New project with child projects in one go: each child sits in the new space, gets its own
// folder inside the space's folder (notes written), only the space itself is woken.
import fs from 'fs';
import path from 'path';
import { check, tmp, def, openPage, noErrors, until } from '../lib.mjs';

def('spacekids', '🪐 a new project with child projects, one per line: parent set, folders made inside, duplicates and blanks skipped (AIG-435)', async (s, ctx) => {
  const root = path.join(tmp('kids'), 'Galaxy');
  const page = await openPage(ctx, '#/');
  await page.evaluate(() => newProject());
  await page.fill('#p-name', 'Galaxy');
  await page.fill('#p-path', root);
  await page.fill('#p-kids', 'Website\n\nApp\nWebsite\n');
  await page.click('#p-acts button.primary');
  await until(async () => /App/.test(await page.textContent('#p-done')), 20000);
  const all = await s.ok('GET', '/api/projects?all=1');
  const kids = all.filter(p => p.parent === 'galaxy').map(p => p.name).sort();
  check('two children inside the space (blank and repeat skipped)', JSON.stringify(kids) === '["App","Website"]', all.map(p => [p.slug, p.parent]));
  check('each child has its folder inside the space folder', fs.existsSync(path.join(root, 'Website')) && fs.existsSync(path.join(root, 'App')));
  const kid = all.find(p => p.name === 'App');
  check('the child folder is connected to its project', kid && path.resolve((await s.ok('GET', '/api/projects/' + kid.slug)).path) === path.resolve(root, 'App'), kid);
  const txt = await page.textContent('#p-done');
  check('the dialog lists what it made', /Website/.test(txt) && /App/.test(txt), txt);
  noErrors(page);
  await page.close();
}, true);

def('spacetpl', '🪐 New space button: a space template fills the child projects, editable; None leaves it an ordinary project (AIG-440)', async (s, ctx) => {
  const page = await openPage(ctx, '#/');
  await page.click('button:has-text("New space")');
  await page.waitForSelector('#p-spacetpl', { timeout: 8000 });
  check('New space starts with a template picked and its children filled in', (await page.inputValue('#p-spacetpl')) === 'product' && /Website\nApp/.test(await page.inputValue('#p-kids')));
  await page.selectOption('#p-spacetpl', 'event');
  check('another template swaps the list', /Venue/.test(await page.inputValue('#p-kids')));
  await page.fill('#p-name', 'Gig'); await page.fill('#p-path', '');
  await page.fill('#p-kids', 'Venue\nTickets');
  await page.click('#p-acts button.primary');
  await until(async () => (await s.ok('GET', '/api/projects?all=1')).filter(p => p.parent === 'gig').length === 2, 10000);
  check('the edited list is what gets made', (await s.ok('GET', '/api/projects?all=1')).filter(p => p.parent === 'gig').map(p => p.name).sort().join() === 'Tickets,Venue');
  noErrors(page); await page.close();
}, true);
