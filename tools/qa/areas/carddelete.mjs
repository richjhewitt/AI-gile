// QA area: carddelete (AIG-1260, AIG-1263, AIG-1264): delete = Undo bar + Recently deleted with Restore; ⋯ menu Copy link and Duplicate.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def, tbClick } from '../lib.mjs';

def('carddelete', 'delete keeps the card (Undo bar, Recently deleted, Restore); ⋯ menu Copy link and Duplicate', async (s, ctx) => {
  await mkProject(s, 'Delta', 'DEL');
  await mkCard(s, 'delta', 'Weekly check', { status: 'todo', description: 'Look at things', testSteps: 'Step A', type: 'bug', priority: 'high', checklist: ['one', 'two'] });
  await s.ok('POST', '/api/projects/delta/cards/DEL-1/comments', { author: 'Owner', text: 'a note' });
  await s.ok('POST', '/api/projects/delta/cards/DEL-1/check', { tick: [1] });

  // API: delete moves, restore returns the whole card
  await s.ok('DELETE', '/api/projects/delta/cards/DEL-1');
  let p = await s.ok('GET', '/api/projects/delta');
  check('deleted card leaves the board', !p.cards.some(c => c.id === 'DEL-1') && p.nDeleted === 1 && !p.deletedCards, p.nDeleted);
  const list = await s.ok('GET', '/api/projects/delta/deleted');
  check('Recently deleted lists it', list.length === 1 && list[0].id === 'DEL-1' && list[0].comments === 1, list);
  await s.ok('POST', '/api/projects/delta/deleted/DEL-1/restore', {});
  const back = await getCard(s, 'delta', 'DEL-1');
  check('restore brings the card back with its comments', back && back.comments.length === 1 && back.title === 'Weekly check', back);
  check('nothing left in Recently deleted', (await s.ok('GET', '/api/projects/delta/deleted')).length === 0);

  // Page: ⋯ Duplicate, Copy link, Delete + Undo, Restore dialog
  openPage.realMenu = true;
  try {
    const page = await openPage(ctx, '#/p/delta/DEL-1');
    await page.waitForSelector('#modal .panel h2');
    await page.click('#cm-btn');
    check('menu has Copy link and Duplicate', await page.isVisible('#copylink-btn') && await page.isVisible('#dup-btn'));
    const link = await page.getAttribute('#copylink-btn', 'data-copy-text');
    check('Copy link is the card address', /#\/p\/delta\/DEL-1$/.test(link), link);
    await page.click('#dup-btn');
    await page.waitForFunction(() => location.hash === '#/p/delta/DEL-2');
    const d = await getCard(s, 'delta', 'DEL-2');
    check('Duplicate: new id, same fields, Backlog, no comments, unticked checklist',
      d && d.status === 'backlog' && d.title === 'Weekly check' && d.description === 'Look at things' && d.testSteps === 'Step A' && d.type === 'bug' && d.priority === 'high'
      && d.comments.length === 0 && (d.checklist || []).map(x => x.text).join() === 'one,two' && !(d.checklist || []).some(x => x.done), d);

    await page.waitForSelector('#modal .panel h2');
    await page.click('#cm-btn');
    await page.click('#card-menu button.danger');
    await page.waitForSelector('#undoBar:not([hidden])');
    check('delete shows the Undo bar', /DEL-2/.test(await page.textContent('#undoMsg')));
    await page.click('#undoBtn');
    await sleep(800);
    check('Undo brings it back', !!(await getCard(s, 'delta', 'DEL-2')));

    await s.ok('DELETE', '/api/projects/delta/cards/DEL-2');
    await page.goto(page.url().split('#')[0] + '#/p/delta');
    await page.reload();
    await tbClick(page, '#deletedBtn');   // under ⋯ More (AIG-1359)
    await page.waitForSelector('[data-restore="DEL-2"]');
    await page.click('[data-restore="DEL-2"]');
    await sleep(800);
    check('Restore from Recently deleted', !!(await getCard(s, 'delta', 'DEL-2')) && (await s.ok('GET', '/api/projects/delta')).nDeleted === undefined);
    await page.setViewportSize({ width: 390, height: 800 });
    noErrors(page);
    await page.close();
  } finally { openPage.realMenu = false; }
}, true);
