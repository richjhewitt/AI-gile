// QA area: groups (AIG-386): cards in a named group are dealt with together: CLI, board chip + filter + picker, one item in For you.
import { check, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('groups', 'card groups: aigile group add/remove/list/move, test on a group, chip, filter, Group field, one For you item (AIG-386)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const cli = (...args) => s.cli(args);
  const a = await mkCard(s, 'alpha', 'Addon one', { status: 'doing' }), b = await mkCard(s, 'alpha', 'Addon two', { status: 'doing' }), c = await mkCard(s, 'alpha', 'Addon three', { status: 'doing' }), z = await mkCard(s, 'alpha', 'Loner', { status: 'doing' });

  const add = cli('group', 'alpha', 'Addon testing', a.id, b.id, c.id);
  check('group adds cards', add.code === 0 && /3 card/.test(add.out), add);
  check('cards carry the group', (await getCard(s, 'alpha', a.id)).group === 'Addon testing' && !(await getCard(s, 'alpha', z.id)).group);
  const ls = cli('group', 'alpha', '--list');
  check('--list shows the group and its cards', /Addon testing \(3\)/.test(ls.out) && ls.out.includes(c.id), ls.out);
  const rm = cli('group', 'alpha', 'addon testing', '--remove', c.id);
  check('--remove takes a card out (name matched case-insensitively)', rm.code === 0 && !(await getCard(s, 'alpha', c.id)).group && (await getCard(s, 'alpha', b.id)).group === 'Addon testing', rm);
  cli('group', 'alpha', 'Addon testing', c.id);

  const mv = cli('group', 'alpha', 'Addon testing', '--move', 'review');
  check('--move moves the whole group', mv.code === 0 && (await Promise.all([a, b, c].map(x => getCard(s, 'alpha', x.id)))).every(x => x.status === 'review') && (await getCard(s, 'alpha', z.id)).status === 'doing', mv);
  const nd = cli('group', 'alpha', 'Addon testing', '--move', 'done');
  check('--move done is refused', nd.code !== 0 && /done/.test(nd.err), nd);

  const noSteps = cli('test', 'alpha', 'Addon testing', '--as', 'Forge');
  check('test on a group needs steps', noSteps.code !== 0, noSteps);
  const t = cli('test', 'alpha', 'Addon testing', '1. Open the addon\n2. It works', '--as', 'Forge');
  const cards = await Promise.all([a, b, c].map(x => getCard(s, 'alpha', x.id)));
  check('test on a group hands every card over with the steps', t.code === 0 && /handed 3 cards/.test(t.out) && cards.every(x => x.status === 'verify' && /Open the addon/.test(x.testSteps)), t);
  check('the loner is untouched', (await getCard(s, 'alpha', z.id)).status === 'doing');
  const inb = await s.ok('GET', '/api/inbox');
  check('the inbox API still lists each card with its group', inb.filter(x => x.group === 'Addon testing').length === 3);

  // space-separated values for add and edit
  const e = cli('add', 'alpha', 'New one', '--group', 'Other group', '--sprint', 'Big sprint');
  check('add --group "two words" and --sprint (space)', e.code === 0 && (await s.ok('GET', '/api/projects/alpha')).cards.some(x => x.title === 'New one' && x.group === 'Other group' && x.sprint === 'Big sprint'), e);

  // Review fix: a question (not a test) with a group name is an ordinary question item; it used to throw in the inbox.
  const gq = await mkCard(s, 'alpha', 'Grouped question', { status: 'doing', group: 'Asks' });
  await say(s, 'alpha', gq.id, 'Forge', 'which colour?', { needsYou: true });
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibT .ib-item');
  await page.waitForSelector(`#ibQ .ib-item[data-id="${gq.id}"]`, { timeout: 5000 }).catch(() => {});
  check('a grouped question shows as a plain question item', (await page.$$eval(`#ibQ .ib-item[data-id="${gq.id}"]`, es => es.length === 1 && !es[0].dataset.group && /which colour/.test(es[0].textContent))));
  await s.ok('PATCH', `/api/projects/alpha/cards/${gq.id}`, { status: 'done', needsYou: false });
  const items = await page.$$eval('#ibT .ib-item', es => es.map(e => ({ group: e.dataset.group, text: e.textContent })));
  check('For you shows the group as ONE item', items.length === 1 && items[0].group === 'Addon testing', items);
  check('the item names the cards inside', [a, b, c].every(x => items[0].text.includes(x.id)), items[0].text);
  await page.click('#ibT .ib-item summary');
  check('expanding shows the steps', (await page.$$eval('#ibT .ib-gcard .body', es => es.length)) === 3);
  await page.click('#ibT [data-act="gwait"]');
  await page.waitForFunction(() => !document.querySelector('#ibT .ib-item'));
  check('Wait and see hides the whole group', true);
  for (const x of [a, b, c]) await s.ok('DELETE', `/api/projects/alpha/cards/${x.id}/snooze`);
  await page.waitForSelector('#ibT .ib-item');
  await page.click('#ibT [data-act="gaccept"]');
  await page.waitForFunction(() => !document.querySelector('#ibT .ib-item'));
  check('Accept all closes every card in the group', (await Promise.all([a, b, c].map(x => getCard(s, 'alpha', x.id)))).every(x => x.status === 'done'));
  noErrors(page);
  await page.close();

  // Board: chip, filter, Group field
  const d = await mkCard(s, 'alpha', 'Grouped on board', { status: 'todo', group: 'Chip group' });
  const bp = await openPage(ctx, '#/p/alpha');
  await bp.waitForSelector('.card');
  check('a grouped card shows a group chip', (await bp.$$eval('.card .pill.grp', es => es.map(e => e.textContent))).some(x => x.includes('Chip group')));
  await bp.selectOption('select[data-f="group"]', 'Chip group');
  await bp.waitForFunction(() => document.querySelectorAll('.card').length === 1);
  check('the group filter narrows the board to the group', (await bp.$$eval('.card', es => es[0].dataset.id)) === d.id);
  await bp.goto(bp.url().split('#')[0] + `#/p/alpha/${d.id}`);
  await bp.waitForSelector('.panel'); await bp.click('.panel button[onclick="editCard()"]');
  await bp.waitForSelector('#f-group');
  check('the card has a Group field', (await bp.$eval('#f-group', e => e.value)) === 'Chip group');
  noErrors(bp);
  await bp.close();
}, true);
