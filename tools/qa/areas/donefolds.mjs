// QA area: donefolds (AIG-1025): in a project's chat in Messages, folds of done/accepted cards sit under a collapsed "Done (N)" toggle;
// a card still waiting on you stays in the list.
import { check, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('donefolds', 'Messages: a project chat lists only unread / in-progress card folds; done ones are under a collapsed Done (N) toggle (AIG-1025)', async (s, ctx) => {
  await mkProject(s, 'Fold Test', 'FT'); await s.ok('POST', '/api/projects/fold-test/team', { name: 'Lead', role: 'Lead' });
  const a = await mkCard(s, 'fold-test', 'Finished thing', { status: 'team' });
  await say(s, 'fold-test', a.id, 'Lead', 'Shall I build it?', { needsYou: true, mark: 'ask' }); await say(s, 'fold-test', a.id, 'Owner', 'Yes, go.');
  await s.ok('PATCH', `/api/projects/fold-test/cards/${a.id}`, { status: 'done' });
  const b = await mkCard(s, 'fold-test', 'Open question', { status: 'team' });
  await say(s, 'fold-test', b.id, 'Lead', 'Which colour?', { needsYou: true, mark: 'ask' });
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]');
  await page.click('#dmPanel [data-dm="fold-test"]');
  await page.waitForSelector('#dmList .dm-fold');
  const folds = async () => await page.locator('#dmList .dm-fold-h').evaluateAll(a => a.map(x => x.dataset.fold));
  check('the open question is listed, the done card is not', (await folds()).includes(b.id) && !(await folds()).includes(a.id), await folds());
  const tog = page.locator('[data-dmshowdone]');
  check('a Done (1) toggle is there', /Done \(1\)/.test(await tog.textContent()), await tog.textContent());
  await tog.click();
  check('the toggle lists the done card', (await folds()).includes(a.id) && /Hide done/.test(await tog.textContent()), await folds());
  await tog.click();
  check('and hides it again', !(await folds()).includes(a.id));
  noErrors(page);
}, true);
