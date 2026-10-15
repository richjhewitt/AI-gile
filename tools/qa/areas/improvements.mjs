// QA area: improvements (AIG-1157, lib/improvements.js): one read-only list of retro suggestions, post-incident review actions and
// problem fixes across projects, with status, per-project filter and links to the cards; opened from the board toolbar and Help.
import { tmp, check, mkProject, mkCard, openPage, noErrors, until, def } from '../lib.mjs';

def('improvements', '📈 improvement list: retro (open / Go), review actions (ticked / card) and problem with a fix, all projects, filter, links (AIG-1157)', async (s, ctx) => {
  await mkProject(s, 'Impa', 'IMA');
  await mkProject(s, 'Impb', 'IMB');
  await s.ok('POST', '/api/projects/impa/team', { name: 'Lead', role: 'lead' });
  await s.ok('POST', '/api/projects/impa/team', { name: 'Pager', role: 'Backend' });
  await s.ok('PATCH', '/api/projects/impa', { service: { on: true, onCall: 'Pager' } });
  check('empty at first', (await s.ok('GET', '/api/improvements')).items.length === 0);

  // retros: one open, one answered Go on a card
  const r1 = await s.ok('POST', '/api/projects/impa/retros', { text: 'Run the suite before every push', why: 'a red push', author: 'Lead' });
  const r2 = await s.ok('POST', '/api/projects/impb/retros', { text: 'Name the on-call early', why: 'late wake', author: 'Lead' });
  await s.ok('POST', `/api/projects/impb/cards/${r2.id}/comments`, { author: 'Owner', text: 'Not yet' });

  // review actions: one ticked, one made into a card, one open
  const inc = await mkCard(s, 'impa', 'Site down', { type: 'incident', status: 'doing', assignee: 'Lead' });
  await s.ok('POST', `/api/projects/impa/cards/${inc.id}/major`, {});
  await s.ok('PATCH', `/api/projects/impa/cards/${inc.id}`, { status: 'done', postmortem: { happened: 'down', why: 'bug', change: 'fix' } });
  await s.ok('POST', `/api/projects/impa/cards/${inc.id}/review`, { timeline: '10:00 down', helped: 'status page', actions: 'Add an alert | Write a rollback note | Test the backup', author: 'Pager' });
  await s.ok('POST', `/api/projects/impa/cards/${inc.id}/review/tick`, { i: 0, on: true });
  const made = await s.ok('POST', `/api/projects/impa/cards/${inc.id}/review/card`, { i: 1 });

  // a problem with a fix (change card)
  const ch = await s.ok('POST', '/api/projects/impa/changes', { title: 'Fix the relay', kind: 'fix', what: 'restart logic', why: 'drops', undo: 'revert' });
  const pr = await s.ok('POST', '/api/projects/impa/problems', { title: 'Relay drops at night', incidents: [inc.id] });
  await s.ok('PATCH', '/api/projects/impa/problems/' + pr.id, { rootCause: 'idle timeout', change: ch.id });
  await s.ok('POST', '/api/projects/impa/problems', { title: 'No fix yet' });

  const items = (await s.ok('GET', '/api/improvements')).items;
  const by = (k, st) => items.filter(x => x.kind === k && (!st || x.state === st));
  check('two retros: one open, one Not yet', by('retro').length === 2 && by('retro', 'open').length === 1 && by('retro', 'notyet').length === 1, by('retro'));
  check('three review actions: ticked, card (with its status), open', by('review').length === 3 && by('review', 'ticked').length === 1 && by('review', 'open').length === 1
    && by('review', 'card').length === 1 && !!by('review', 'card')[0].cardStatus, by('review'));
  check('one problem with its fix and the fix status; the one without a fix is left out', by('problem').length === 1 && by('problem')[0].card === ch.id && !!by('problem')[0].cardStatus, by('problem'));

  const page = await openPage(ctx, '#/improvements');
  check('the page lists every improvement', !!(await until(() => page.$$eval('.imp-row', e => e.length === 6), 8000)));
  const txt = await page.$eval('.rk-page', e => e.textContent);
  check('shows retro text, review action, problem and states', /Run the suite/.test(txt) && /Add an alert/.test(txt) && /Relay drops/.test(txt) && /Not yet/.test(txt) && /Ticked/.test(txt) && new RegExp(made.card + ': ').test(txt), txt);
  check('a row links to its card', (await page.$$eval('.imp-row a', a => a.map(x => x.getAttribute('href')))).some(h => h.endsWith('/impa/' + made.card)));
  await page.selectOption('#impFilter', 'impb');
  check('the project filter narrows the list', !!(await until(() => page.$$eval('.imp-row', e => e.length === 1), 5000)));
  await page.selectOption('#impFilter', '');
  check('All projects shows everything again', !!(await until(() => page.$$eval('.imp-row', e => e.length === 6), 5000)));
  await page.evaluate(() => { location.hash = '#/p/impa'; });
  await page.waitForSelector('#boardTbMore', { state: 'attached' });
  check('the board ⋯ More menu links to it', await page.$$eval('#boardTbMore button', b => b.some(x => /improvements/.test(x.getAttribute('onclick') || ''))));
  await page.click('#helpBtn');
  await page.waitForSelector('#hmImprove');
  await page.click('#hmImprove');
  check('Help opens the list', !!(await until(() => page.$$eval('.imp-row', e => e.length === 6), 8000)));
  noErrors(page);
  await page.close();
}, true, { AIGILE_WOW: tmp('improvements') + '/WAYS-OF-WORKING.md' });
