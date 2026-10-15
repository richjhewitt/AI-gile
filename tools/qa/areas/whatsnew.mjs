// QA area: whatsnew (AIG-562): `aigile release-notes` writes done cards as New / Fixed once; the ✨ What's new page lists them;
// after an update (newer notes than the ones seen) a note shows once and links to the page; a new install shows no note.
import fs from 'fs';
import path from 'path';
import { check, tmp, mkProject, mkCard, def, openPage, noErrors, until } from '../lib.mjs';

def('whatsnew', 'release-notes from done cards (New / Fixed, never twice), ✨ What\'s new page, the one-time note after an update (AIG-562)', async (s, ctx) => {
  await mkProject(s, 'Rel', 'REL', { path: tmp('rel') });
  const f = await mkCard(s, 'rel', '🚀 Shiny feature', { type: 'feature', status: 'done' });
  const b = await mkCard(s, 'rel', 'Broken button', { type: 'bug', status: 'done' });
  await mkCard(s, 'rel', 'Not done yet', { status: 'todo' });
  const file = path.join(tmp('relfile'), 'releases.json'), env = { AIGILE_RELEASES: file };
  let r = s.cli(['release-notes', 'rel', '--since', '2000-01-01', '--title', 'v0.1'], env);
  check('the CLI adds notes', /added "v0\.1": 1 new, 1 fixed/.test(r.out), r);
  const notes = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('feature under New (emoji trimmed), bug under Fixed', notes[0].features[0].id === f.id && notes[0].features[0].title === 'Shiny feature' && notes[0].fixes[0].id === b.id, notes);
  r = s.cli(['release-notes', 'rel', '--since', '2000-01-01'], env);
  check('a card is never listed twice', /nothing new/.test(r.out), r);

  const fake = [{ id: 'r2', at: '2026-10-12T20:00:00Z', title: 'Build two', features: [{ id: 'REL-9', title: 'Brand new thing' }], fixes: [] },
    { id: 'r1', at: '2026-10-01T20:00:00Z', title: 'Build one', features: [], fixes: [{ id: 'REL-1', title: 'Old fix' }] }];
  await ctx.route('**/releases.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fake) }));
  let page = await openPage(ctx, '#/');
  await page.waitForTimeout(1500);
  check('a new install shows no note', !(await page.$('#wnNote')));
  check('a new install marks the newest as seen', await page.evaluate(() => localStorage.getItem('aigile.seenRelease')) === 'r2');
  await page.evaluate(() => localStorage.setItem('aigile.seenRelease', 'r1'));
  await page.reload();
  check('after an update the note shows', !!(await until(() => page.$('#wnNote'), 8000)));
  await page.click('#wnOpen');
  await page.waitForSelector('.wn-rel', { timeout: 8000 });
  const text = await page.textContent('#app');
  check('the page lists both builds, newest first', text.indexOf('Build two') >= 0 && text.indexOf('Build two') < text.indexOf('Build one') && /Brand new thing/.test(text) && /Old fix/.test(text), text.slice(0, 300));
  check('the note is gone', !(await page.$('#wnNote')));
  await page.reload();
  await page.waitForTimeout(1500);
  check('it does not show again', !(await page.$('#wnNote')));
  noErrors(page);
  await page.close();
  await ctx.unroute('**/releases.json');
}, true);
