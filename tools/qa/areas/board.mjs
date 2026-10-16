// QA areas: board, filters, columns, cardview, wip, lanes, views, steps, quick.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('board', 'columns, drag between columns, + New default, Raise bug', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Draggable', { status: 'todo' });
  await mkCard(s, 'alpha', 'Other', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column');
  const heads = await page.$$eval('.column h3 > span:first-child', els => els.map(e => e.textContent));
  check('seven columns in order', JSON.stringify(heads) === JSON.stringify(['Backlog', 'To do', 'In progress', 'Team checking', 'For you', 'For the team', 'Done']), heads);
  check('cards render in their column', (await page.locator('.column[data-status=todo] .card').count()) === 1 && (await page.locator('.column[data-status=doing] .card').count()) === 1);
  await page.dragAndDrop('.card[data-id="ALP-1"]', '.column[data-status="review"]');
  await page.waitForTimeout(600);
  check('drag moves the card (server)', (await getCard(s, 'alpha', 'ALP-1')).status === 'review');
  const sv = await mkCard(s, 'alpha', 'Snoozed one', { status: 'verify' });
  await s.ok('POST', `/api/projects/alpha/cards/${sv.id}/snooze`);
  await page.waitForTimeout(1500);
  check('snoozed card shows back-at label and Bring back', /back at \d/.test(await page.textContent(`.card[data-id="${sv.id}"]`)) && (await page.locator(`.card[data-id="${sv.id}"] button:has-text("Bring back")`).count()) === 1);
  await page.click(`.card[data-id="${sv.id}"] button:has-text("Bring back")`);
  await page.waitForTimeout(1500);
  check('Bring back clears the label', !(await getCard(s, 'alpha', sv.id)).snoozedUntil && !/back at/.test(await page.textContent(`.card[data-id="${sv.id}"]`)));
  check('drag moves the card (page)', (await page.locator('.column[data-status=review] .card[data-id="ALP-1"]').count()) === 1);

  await s.ok('POST', '/api/projects/alpha/team', { name: 'Pixel', role: 'Frontend' });   // with a crew + New goes to For the team (none: Backlog, AIG-1181)
  await page.reload(); await page.waitForSelector('.toolbar button.primary');
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #f-title');
  check('+ New defaults to For the team', (await page.inputValue('#f-status')) === 'team');
  await page.fill('#f-title', 'From the dialog');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await page.waitForTimeout(300);
  const made = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'From the dialog');
  check('created card is for the team, by Owner', made && made.status === 'team' && made.createdBy === 'Owner', made);
  check('new card shows in the team column', (await page.locator('.column[data-status=team] .card', { hasText: 'From the dialog' }).count()) === 1);

  await page.click('#bugBtn');
  await page.waitForSelector('#dialog #f-title');
  check('Raise bug presets', (await page.inputValue('#f-type')) === 'bug' && (await page.inputValue('#f-priority')) === 'high' && (await page.inputValue('#f-status')) === 'team');
  await page.fill('#f-title', 'It broke');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await page.waitForTimeout(300);
  const bug = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'It broke');
  check('bug raised', bug && bug.type === 'bug' && bug.priority === 'high' && bug.status === 'team', bug);

  await page.click('.column[data-status=backlog] .colbtn');
  await page.waitForSelector('#dialog #f-status');
  check('column + picks that column', (await page.inputValue('#f-status')) === 'backlog');
  await page.click('#dialog button[type=button]');
  await page.goto(BASE + '/#/');
  await page.waitForSelector('.proj');
  check('home lists the project', (await page.locator('.proj').count()) === 1);
  noErrors(page);
}, true);

def('newcard-project', 'New card: Project picker defaults to this board; another project gets the card, with a link note (AIG-316)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  const cards = async slug => (await s.ok('GET', `/api/projects/${slug}`)).cards;
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column');
  const eh = await page.textContent('#emptyHint');   // AIG-1074: a project with no folder says you can just add a card, Connect folder second
  check('empty board with no folder: add a card first, Connect folder second', /add your first card/i.test(eh) && eh.indexOf('+ New') < eh.indexOf('Connect folder'), eh);
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#nc-project');
  check('Project picker defaults to the board you are on', (await page.inputValue('#nc-project')) === 'alpha');
  await page.fill('#f-title', 'Stays home');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await page.waitForTimeout(300);
  check('default: card in this project, none in the other', (await cards('alpha')).some(c => c.title === 'Stays home') && !(await cards('beta')).some(c => c.title === 'Stays home'));
  // AIG-1075: the new card is shown: a note naming its column, and the card flashes
  check('a note says which column the new card went to', /Added ALP-\d+ to .+/.test(await page.textContent('#note')), await page.textContent('#note'));
  check('the new card flashes and is in view', await page.evaluate(() => { const a = document.querySelector('#app a.card.newflash'); if (!a) return false; const r = a.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; }));
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#nc-project');
  await page.selectOption('#nc-project', 'beta');
  await page.fill('#f-title', 'Goes to beta');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#nc-link');
  const b = (await cards('beta')).find(c => c.title === 'Goes to beta');
  check('the card is created in the other project', b && b.id === 'BET-1' && b.createdBy === 'Owner', b);
  check('and this project is unchanged', !(await cards('alpha')).some(c => c.title === 'Goes to beta') && (await page.locator('.card', { hasText: 'Goes to beta' }).count()) === 0);
  check('a note says where it went, with a link', /Added BET-1 to .*Beta/.test(await page.textContent('#dialog h2')) && (await page.getAttribute('#nc-link', 'href')) === '#/p/beta/BET-1');
  await page.click('#nc-link');
  await page.waitForTimeout(600);
  check('the link opens the new card', page.url().endsWith('#/p/beta/BET-1'));
  noErrors(page);
}, true);

def('filters', 'search survives polling, type filter, clear', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Zebra feature', { status: 'todo' });
  await mkCard(s, 'alpha', 'Zebra bug', { status: 'todo', type: 'bug' });
  await mkCard(s, 'alpha', 'Plain thing', { status: 'doing', assignee: 'Forge' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#f-q');
  const cards = () => page.locator('.board .card').count();
  check('all cards shown at first', (await cards()) === 3);
  await page.fill('#f-q', 'zebra');
  check('search narrows the board', (await cards()) === 2);
  await page.waitForTimeout(2500);
  check('search text survives polling', (await page.inputValue('#f-q')) === 'zebra' && (await cards()) === 2);
  check('count line shown', /Showing\s*2\s*of 3/.test(await page.textContent('#f-count')), await page.textContent('#f-count'));
  await page.selectOption('select[data-f=type]', 'bug');
  check('type filter narrows further', (await cards()) === 1 && (await page.locator('.board .card', { hasText: 'Zebra bug' }).count()) === 1);
  await page.click('#f-count a');
  check('clear resets everything', (await cards()) === 3 && (await page.inputValue('#f-q')) === '' && (await page.inputValue('select[data-f=type]')) === '');
  await page.selectOption('select[data-f=who]', 'Forge');
  check('assignee filter', (await cards()) === 1);
  noErrors(page);
}, true);

def('boardpick', 'search finds words in comments (hint on the card); Ctrl-click picks cards, move together, one undo, Esc clears (AIG-1265/1266)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'First card', { status: 'todo' });
  const b = await mkCard(s, 'alpha', 'Second card', { status: 'todo' });
  const c = await mkCard(s, 'alpha', 'Third card', { status: 'todo' });
  const d = await mkCard(s, 'alpha', 'Done card', { status: 'done' });
  await say(s, 'alpha', a.id, 'Forge', 'We tried the quokka approach');
  await say(s, 'alpha', d.id, 'Forge', 'Old quokka note');
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#f-q');
  await page.fill('#f-q', 'quokka');
  await page.waitForTimeout(900);
  const cards = () => page.locator('.board .card').count();
  check('search finds a word only in a comment, done card too', (await cards()) === 2, await cards());
  check('hint on cards found in a comment', (await page.locator('.board .card .incomment').count()) === 2);
  await page.fill('#f-q', 'First');
  check('no hint when the title matches', (await page.locator('.board .card .incomment').count()) === 0);
  await page.click('#f-count a');
  const sel = id => `.card[data-id="${id}"]`;
  await page.click(sel(a.id), { modifiers: ['Control'] });
  await page.click(sel(b.id), { modifiers: ['Control'] });
  await page.click(sel(c.id), { modifiers: ['Control'] });
  check('ctrl-click ticks, no card opens', (await page.locator('.card.picked').count()) === 3 && !page.url().includes('/ALP-'), page.url());
  check('bar shows 3 picked', /3 picked/.test(await page.textContent('#pickBar')));
  await page.waitForTimeout(1500);
  check('picks survive polling', (await page.locator('.card.picked').count()) === 3);
  await page.click('#pickBar [data-pickcol=done]');
  await page.waitForTimeout(800);
  const st = async () => (await s.ok('GET', '/api/projects/alpha')).cards.filter(x => [a.id, b.id, c.id].includes(x.id)).map(x => x.status).join();
  check('all three moved to Done', (await st()) === 'done,done,done', await st());
  check('bar gone after the move', (await page.locator('#pickBar').count()) === 0);
  await page.click('#undoBtn');
  await page.waitForTimeout(800);
  check('one Undo puts all three back', (await st()) === 'todo,todo,todo', await st());
  await page.click(sel(a.id), { modifiers: ['Control'] });
  await page.click(sel(b.id), { modifiers: ['Shift'] });
  check('shift-click ticks the run', (await page.locator('.card.picked').count()) === 2);
  await page.keyboard.press('Escape');
  check('Esc clears the picks', (await page.locator('.card.picked').count()) === 0 && (await page.locator('#pickBar').count()) === 0);
  await page.click('#pickBtn');
  await page.click(sel(c.id));
  check('select mode: plain click ticks', (await page.locator('.card.picked').count()) === 1);
  await page.setViewportSize({ width: 390, height: 800 });
  check('pick bar fits a phone', await page.evaluate(() => { const r = document.getElementById('pickBar').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  noErrors(page);
}, true);

def('columns', '⚙️ Columns: rename, reorder, hide and colour a board\'s columns; statuses never change (AIG-116)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  const c = await mkCard(s, 'alpha', 'Plan it', { status: 'todo' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("Columns")');
  await page.waitForSelector('.colrow');
  const row = n => page.locator('.colrow').nth(n);
  await row(1).locator('input[aria-label="Name"]').fill('Next up');   // To do
  await row(1).locator('input.emoji').fill('⏭️');
  await row(1).locator('button[title="Move left"]').click();                 // before Backlog
  await page.locator('.colrow').nth(1).locator('input[type=checkbox]').check(); // hide Backlog (now 2nd)
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  await page.locator('.colrow').nth(4).locator('input[type=checkbox]').click(); // For you: asks, cancelled
  check('hiding For you asks first', /could miss things/.test(asked), asked);
  check('cancel keeps it shown', !(await page.locator('.colrow').nth(4).locator('input[type=checkbox]').isChecked()));
  await page.click('#dialog button:has-text("Save")');
  await page.waitForFunction(() => !document.querySelector('#dialog .dialog'));
  await page.waitForSelector('.column h3');
  const heads = await page.$$eval('.column h3 span:first-child', els => els.map(e => e.textContent));
  check('renamed, moved first, Backlog hidden', heads[0] === '⏭️ Next up' && !heads.includes('Backlog') && heads.length === 6, heads);
  check('card still todo underneath', (await getCard(s, 'alpha', c.id)).status === 'todo');
  check('other project untouched', !(await s.ok('GET', '/api/projects/beta')).columns);
  check('bad columns refused', (await s.api('PATCH', '/api/projects/alpha', { columns: [{ status: 'todo' }] })).status === 400);
  await s.ok('PATCH', '/api/projects/alpha', { columns: [] });
  check('reset to default', !(await s.ok('GET', '/api/projects/alpha')).columns);
  noErrors(page);
}, true);

def('cardview', '🃏 Cards: compact or roomy, and which details show on board cards (AIG-119)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  const c = await mkCard(s, 'alpha', 'Show me', { type: 'bug', priority: 'high', assignee: 'Tweak', sprint: 'S9' });
  await say(s, 'alpha', c.id, 'Tweak', 'a comment');
  const page = await openPage(ctx, '#/p/alpha');
  const card = page.locator(`.card[data-id="${c.id}"]`);
  await card.waitFor();
  const txt = async () => (await card.textContent()).replace(/\s+/g, ' ');
  let t = await txt();
  check('defaults show today\'s details', /bug/.test(t) && /high/.test(t) && /Tweak/.test(t) && /S9/.test(t) && /💬 1/.test(t) && !/🕒/.test(t), t);
  check('default is roomy', !(await card.evaluate(e => e.classList.contains('compact'))));
  await page.click('button:has-text("Cards")');
  await page.waitForSelector('[data-cv]');
  // The board shows each change straight away; Cancel puts it back (AIG-119).
  await page.click('.cv-size:has([value=compact])');   // the Compact tile (AIG-184)
  await sleep(1500);   // through a poll, which must not undo the preview
  check('switching to compact shows at once, before Save', await card.evaluate(e => e.closest('.board').querySelector('.card').classList.contains('compact')));
  await page.click('#dialog button:has-text("Cancel")');
  await sleep(300);
  check('Cancel puts it back', !(await page.locator('.card.compact').count()));
  await page.click('button:has-text("Cards")');
  await page.waitForSelector('[data-cv]');
  await page.locator('[data-cv=assignee]').uncheck();
  await page.locator('[data-cv=age]').check();
  await page.click('.cv-size:has([value=compact])');   // the Compact tile (AIG-184)
  await page.click('#dialog button:has-text("Save")');
  await page.waitForFunction(() => !document.querySelector('#dialog .dialog'));
  await page.waitForSelector(`.card.compact[data-id="${c.id}"]`);
  t = await txt();
  check('assignee hidden, age shown', !/Tweak/.test(t) && /🕒/.test(t) && /bug/.test(t) && /S9/.test(t), t);
  check('saved on the project only', (await s.ok('GET', '/api/projects/alpha')).cardView.density === 'compact' && !(await s.ok('GET', '/api/projects/beta')).cardView);
  for (const bad of [{ density: 'tiny' }, { show: { colour: true } }, { show: { age: 'yes' } }, 'compact'])
    check('bad cardView refused: ' + JSON.stringify(bad), (await s.api('PATCH', '/api/projects/alpha', { cardView: bad })).status === 400);
  await s.ok('PATCH', '/api/projects/alpha', { cardView: null });
  check('reset to default', !(await s.ok('GET', '/api/projects/alpha')).cardView);
  noErrors(page);
}, true);

def('wip', 'WIP limits per column: n / limit in the header, amber at the limit, red over it (AIG-118)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'One', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("Columns")');
  await page.waitForSelector('.colrow');
  await page.locator('.colrow').nth(2).locator('input.wip').fill('2');   // In progress
  await page.locator('.colrow').nth(4).locator('input.wip').fill('1');   // For you
  await page.click('#dialog button:has-text("Save")');
  await page.waitForFunction(() => !document.querySelector('#dialog .dialog'));
  const doing = page.locator('.column[data-status="doing"]'), verify = page.locator('.column[data-status="verify"]');
  await page.waitForSelector('.column[data-status="doing"] .wipn');
  check('header shows n / limit', (await doing.locator('h3').textContent()).includes('1 / 2'));
  check('under the limit: no colour', !/wip-/.test(await doing.getAttribute('class')));
  await mkCard(s, 'alpha', 'Two', { status: 'doing' });
  await page.waitForSelector('.column.wip-at[data-status="doing"]');
  check('at the limit: amber', (await doing.locator('h3').textContent()).includes('2 / 2'));
  await mkCard(s, 'alpha', 'Three', { status: 'doing' });
  await page.waitForSelector('.column.wip-over[data-status="doing"]');
  check('over the limit: red', (await doing.locator('h3').textContent()).includes('3 / 2'));
  check('limit saved as a number', (await s.ok('GET', '/api/projects/alpha')).columns.find(c => c.status === 'doing').wip === 2);
  await mkCard(s, 'alpha', 'Test me', { status: 'verify' });
  await page.waitForSelector('.column.wip-at[data-status="verify"]');
  check('For you column can have a limit', (await verify.locator('h3').textContent()).includes('1 / 1'));
  const cols = (await s.ok('GET', '/api/projects/alpha')).columns;
  for (const bad of [-1, 1000, 1.5, 'lots']) {
    const r = await s.api('PATCH', '/api/projects/alpha', { columns: cols.map(c => c.status === 'doing' ? { ...c, wip: bad } : c) });
    check('bad limit refused: ' + bad, r.status === 400);
  }
  await s.ok('PATCH', '/api/projects/alpha', { columns: cols.map(c => c.status === 'doing' ? { ...c, wip: 0 } : c) });
  await page.waitForSelector('.column[data-status="doing"]:not(.wip-over)');
  check('0 = no limit', !(await doing.locator('.wipn').count()));
  noErrors(page);
}, true);

def('lanes', '≡ Lanes: group the board into rows by assignee, type, sprint or priority; remembered per project (AIG-120)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Ann one', { status: 'todo', assignee: 'Ann' });
  const b = await mkCard(s, 'alpha', 'Bob one', { status: 'todo', assignee: 'Bob', type: 'bug' });
  await mkCard(s, 'alpha', 'Nobody', { status: 'backlog' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column .card');
  check('default has no lanes', (await page.locator('.lane').count()) === 0);
  await page.selectOption('.lanesel', 'assignee');
  await page.waitForSelector('.lane');
  const heads = await page.$$eval('.lane-h', els => els.map(e => e.firstChild.textContent.trim()));
  check('one lane per assignee, unassigned last', JSON.stringify(heads) === JSON.stringify(['Ann', 'Bob', 'No assignee']), heads);
  const lane = n => page.locator(`.lane:has(.lane-h:has-text("${n}"))`);
  check('Ann lane holds only her card', (await lane('Ann').locator('.card').count()) === 1 && (await lane('Ann').locator(`.card[data-id="${a.id}"]`).count()) === 1);
  await lane('Ann').locator(`.card[data-id="${a.id}"]`).dragTo(lane('Ann').locator('.column[data-status="doing"]'));
  await sleep(500);
  check('drag inside a lane changes status', (await getCard(s, 'alpha', a.id)).status === 'doing');
  check('other lane card untouched', (await getCard(s, 'alpha', b.id)).status === 'todo');
  await page.reload(); await page.waitForSelector('.lane');
  check('choice survives a reload', (await page.locator('.lanesel').inputValue()) === 'assignee' && (await page.locator('.lane').count()) === 3);
  await page.selectOption('.lanesel', 'type');
  await page.waitForFunction(() => document.querySelectorAll('.lane').length === 2);
  await page.selectOption('.lanesel', '');
  await page.waitForFunction(() => !document.querySelector('.lane'));
  check('off goes back to one board', (await page.locator('.board').count()) === 1);
  noErrors(page);
}, true);

def('views', '👁 Views: save the filters as a named view, apply it, last view re-applied on reload, delete; bad views refused (AIG-121)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Zebra bug', { status: 'todo', type: 'bug' });
  await mkCard(s, 'alpha', 'Zebra feature', { status: 'todo' });
  await mkCard(s, 'alpha', 'Plain thing', { status: 'doing' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#f-q');
  const cards = () => page.locator('.board .card').count();
  await page.fill('#f-q', 'zebra');
  await page.selectOption('select[data-f=type]', 'bug');
  check('filtered to one card', (await cards()) === 1);
  await page.click('button:has-text("Views")');
  await page.fill('#view-name', 'My bugs');
  await page.click('#dialog button:has-text("Save view")');
  await page.waitForSelector('.viewrow button:has-text("My bugs")');
  const saved = (await s.ok('GET', '/api/projects/alpha')).views;
  check('view stored on the project', saved && saved.length === 1 && saved[0].name === 'My bugs' && saved[0].filters.q === 'zebra' && saved[0].filters.type === 'bug', saved);
  check('other project has no views', !(await s.ok('GET', '/api/projects/beta')).views);
  await page.click('#dialog button:has-text("Close")');
  await page.click('#f-count a');
  check('cleared: all cards', (await cards()) === 3);
  await page.click('button:has-text("Views")');
  await page.click('.viewrow button:has-text("My bugs")');
  check('applying the view filters the board', (await cards()) === 1 && (await page.inputValue('#f-q')) === 'zebra' && (await page.inputValue('select[data-f=type]')) === 'bug');
  await page.reload();
  await page.waitForSelector('#f-q');
  await page.waitForSelector('.board .card');
  check('last view re-applied after reload', (await cards()) === 1 && (await page.inputValue('#f-q')) === 'zebra');
  await page.click('#f-count a');
  await page.reload();
  await page.waitForSelector('.board .card');
  check('clearing forgets the last view', (await cards()) === 3);
  await page.click('button:has-text("Views")');
  await page.click('.viewrow button[title="Delete this view"]');
  await page.waitForSelector('#dialog :text("No saved views yet")');
  check('deleted on the server', !(await s.ok('GET', '/api/projects/alpha')).views);
  const patch = views => s.api('PATCH', '/api/projects/alpha', { views });
  check('empty name refused', (await patch([{ name: ' ', filters: {} }])).status === 400);
  check('long name refused', (await patch([{ name: 'x'.repeat(41), filters: {} }])).status === 400);
  check('non-object filters refused', (await patch([{ name: 'a', filters: 'q' }])).status === 400);
  check('array filters refused', (await patch([{ name: 'a', filters: [] }])).status === 400);
  check('more than 20 refused', (await patch(Array.from({ length: 21 }, (_, i) => ({ name: 'v' + i, filters: {} })))).status === 400);
  check('20 accepted', (await patch(Array.from({ length: 20 }, (_, i) => ({ name: 'v' + i, filters: {} })))).status === 200);
  noErrors(page);
}, true);

def('steps', 'your own steps inside a column: sub-columns, drag between them, status unchanged (AIG-117)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Make it', { status: 'doing' });
  const cols = (await s.ok('GET', '/api/meta')).statuses.map(st => ({ status: st, ...(st === 'doing' ? { steps: ['Design', 'Build', 'QA'] } : {}) }));
  await s.ok('PATCH', '/api/projects/alpha', { columns: cols });
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.step');
  const heads = await page.$$eval('.column.step h3 span:first-child', els => els.map(e => e.textContent));
  check('three step columns', JSON.stringify(heads) === JSON.stringify(['In progress · Design', 'In progress · Build', 'In progress · QA']), heads);
  check('a card with no step sits in the first', (await page.locator('.column.step[data-step="Design"] .card').count()) === 1);
  await page.dragAndDrop(`.card[data-id="${c.id}"]`, '.column.step[data-step="Build"]');
  await sleep(600);
  const moved = await getCard(s, 'alpha', c.id);
  check('dragging sets the step, status stays doing', moved.step === 'Build' && moved.status === 'doing', moved);
  check('team sees plain status', /\[doing\]/.test(s.cli(['show', 'alpha', c.id]).out));
  noErrors(page);
}, true);

def('quick', '👀 What\'s happening? summarises the board; 💬 Ask the team sends a question whose answer lands in Messages (AIG-132)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Building the thing', { status: 'doing', assignee: 'Pixel' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("What\'s happening?")');
  await page.waitForSelector('#dialog h2');
  check('summary shows what is in progress', (await page.textContent('#dialog')).includes('Building the thing'));
  await page.click('#dialog button:has-text("Ask the team")');
  await page.waitForSelector('#ask-text');
  const h0 = await page.$eval('#ask-text', e => e.offsetHeight);
  await page.fill('#ask-text', 'A long thought\n'.repeat(12));
  await page.dispatchEvent('#ask-text', 'input');
  check('Ask the team: the box is wide and grows with a long thought (AIG-344)', await page.$eval('#ask-text', (e, h) => e.offsetHeight > h && e.closest('.dialog').offsetWidth > 600, h0), h0);
  await page.fill('#ask-text', 'Where are we with the login page?');
  await page.click('#dialog button[type=submit]');
  await sleep(500);
  const q = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.quick);
  check('question card goes to the team', q && q.status === 'team' && q.title === '💬 Where are we with the login page?', q);
  s.cli(['comment', 'alpha', q.id, 'Nearly done, testing now', '--as', 'Lead']);
  check('a plain reply on your own 💬 stays off your Messages: it is an instruction to the team (AIG-1215)', (await getCard(s, 'alpha', q.id)).needsYou !== true);
  s.cli(['ask', 'alpha', q.id, 'Shall I ship it?', '--as', 'Lead']);
  check('a real question back lands in your Messages', (await getCard(s, 'alpha', q.id)).needsYou === true && (await s.ok('GET', '/api/inbox')).some(c => c.id === q.id));
  // Team picker (AIG-414): defaults to this board; picking another project sends the question there.
  await page.click('button:has-text("Ask the team")');
  await page.waitForSelector('#ask-to');
  check('the team picker defaults to this board', (await page.inputValue('#ask-to')) === 'alpha');
  await page.selectOption('#ask-to', 'beta');
  await page.fill('#ask-text', 'Is beta ready for review?');
  await page.click('#dialog button[type=submit]');
  await sleep(500);
  const bq = (await s.ok('GET', '/api/projects/beta')).cards.find(c => c.quick);
  check('picking another team sends the question there', bq && bq.status === 'team' && bq.title === '💬 Is beta ready for review?', bq);
  check('and not to this board', !(await s.ok('GET', '/api/projects/alpha')).cards.some(c => c.title.includes('beta ready')));
  noErrors(page);
}, true);

def('tidy', '🧹 Tidy my pile asks the lead; fold moves test steps across and closes the card (AIG-193)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Queue part 1'), b = await mkCard(s, 'alpha', 'Queue part 2');
  s.cli(['test', 'alpha', a.id, 'check part one', '--as', 'Lead']);
  s.cli(['test', 'alpha', b.id, 'check part two', '--as', 'Lead']);
  const f = s.cli(['fold', 'alpha', b.id, a.id, '--as', 'Lead']);
  const tb = await getCard(s, 'alpha', b.id), ta = await getCard(s, 'alpha', a.id);
  check('fold moves the steps across and closes the other card', f.code === 0 && /check part one/.test(tb.testSteps) && /Also \(was ALP-1/.test(tb.testSteps) && ta.status === 'done' && /Folded into/.test(ta.comments.at(-1).text), f);
  check('a card cannot fold into itself', s.cli(['fold', 'alpha', b.id, b.id, '--as', 'Lead']).code !== 0);
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou button[title*="fold"]');
  page.once('dialog', d => d.accept());
  await page.click('.column.foryou button[title*="fold"]');
  await sleep(600);
  const jobs = (await s.ok('GET', '/api/projects/alpha')).cards.filter(c => c.tidy && c.status !== 'done');
  check('🧹 makes one tidy job for the lead in For the team', jobs.length === 1 && jobs[0].status === 'team' && /aigile fold/.test(jobs[0].description));
  const again = await s.ok('POST', '/api/projects/alpha/tidy');
  check('a second click while it is open does not make another', again.already === true && (await s.ok('GET', '/api/projects/alpha')).cards.filter(c => c.tidy).length === 1);
  noErrors(page);
}, true);

// AIG-399: with Tidy cards on, a New card with only a description gets its first line as a temporary title (tidyTitle marks it).
def('tidynew', 'New card with only a description: with Tidy cards on it gets a temporary title from its first line (AIG-399)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Seed card');
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#f-description');
  await page.fill('#f-description', 'Make the logo bigger on the start page\n- and check it on a phone');
  await page.click('#dialog button[type=submit]');
  await sleep(600);
  const made = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.description.startsWith('Make the logo'));
  check('a description-only card is created', !!made, made);
  check('its title is the first line', !!made && made.title === 'Make the logo bigger on the start page', made && made.title);
  check('it is marked for the lead to retitle', !!made && made.tidyTitle === true);
  check('the board shows the temporary title', (await page.locator('.card', { hasText: 'Make the logo bigger' }).count()) >= 1);
  // A long first line is cut to about 60 characters; the words stay in the description.
  const long = 'Word '.repeat(30).trim();
  const lc = await s.ok('POST', '/api/projects/alpha/cards', { description: long + '\n- more' });
  check('a long first line is trimmed to about 60 characters', lc.title.length <= 60 && lc.title.endsWith('…') && lc.description.startsWith(long), lc.title);
  const titled = await s.api('POST', '/api/projects/alpha/cards', { title: 'Has a title', description: 'Body' });
  check('a card with a title keeps it and is not marked', titled.status === 200 && titled.body.title === 'Has a title' && !titled.body.tidyTitle);
  const none = await s.api('POST', '/api/projects/alpha/cards', { description: '   ' });
  check('no title and no words is still refused', none.status === 400);
  noErrors(page);
}, true, (() => {
  const dir = tmp('tidynew'), local = path.join(dir, 'local.json');
  // The project's own local settings, with Tidy cards on (chatty off, as in the QA runs).
  let base = {};
  try { base = JSON.parse(fs.readFileSync(path.join(ROOT, 'aigile.local.json'), 'utf8')); } catch {}
  fs.writeFileSync(local, JSON.stringify({ ...base, lead: { ...(base.lead || {}), tidyCards: true, chatty: false } }));
  return { AIGILE_LOCAL: local };
})());

// AIG-1211: a long board scrolls inside its columns (Team sits just under it); the Team panel lists only who is working now.
def('boardscroll', 'columns scroll inside themselves on a desktop, Team stays in view with 60 cards; quiet members fold under Show all (AIG-1211)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  for (let i = 0; i < 60; i++) await mkCard(s, 'alpha', 'Card ' + i, { status: 'todo' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Pixel', role: 'Frontend', status: 'working', task: 'busy' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Sleepy', role: 'Backend', status: 'idle' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Checker', role: 'QA', status: 'in review', task: 'looking' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForSelector('.column[data-status=todo] .card');
  await page.evaluate(() => { try { localStorage.removeItem('aigile.teamAll'); } catch {} });
  await page.reload(); await page.waitForSelector('.side');
  const col = await page.$eval('.column[data-status=todo]', e => ({ sh: e.scrollHeight, ch: e.clientHeight, oy: getComputedStyle(e).overflowY }));
  check('a long column scrolls inside itself', col.oy === 'auto' && col.sh > col.ch, col);
  // AIG-1217: every column ends on the same line, inside the window; the For you dashed edge is a border, so the scrollbar sits inside it.
  const fit = await page.$$eval('.board .column', cs => cs.map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.bottom), Math.round(r.height)]; }));
  check('all columns end on the same line, inside the window (or at their 360px floor)', new Set(fit.map(f => f[0])).size === 1 && (fit[0][0] <= 800 || fit[0][1] <= 362), fit);
  const fy = await page.$eval('.column[data-status=verify]', e => { const s = getComputedStyle(e); return s.borderTopStyle + ' ' + s.outlineStyle; });
  check('the For you dashed edge is a border, not an outline over the scrollbar', fy === 'dashed none', fy);
  check('a column with more below its fold fades at the bottom', await page.$eval('.column[data-status=todo]', e => e.classList.contains('more')));
  const top = await page.$eval('.side', e => e.getBoundingClientRect().top);
  const bt = await page.$eval('.board', e => e.getBoundingClientRect().top);
  check('Team and Log sit within one screen of the board, not 60 cards down', top - bt < 800, [bt, top]);
  const hy = await page.$eval('.column[data-status=todo]', e => { e.scrollTop = 600; return e.querySelector('h3').getBoundingClientRect().top - e.getBoundingClientRect().top; });
  check('the column header stays visible when it scrolls', hy >= -1 && hy < 12, hy);
  await page.waitForTimeout(1600);
  check('the column keeps its scroll through the redraw', (await page.$eval('.column[data-status=todo]', e => e.scrollTop)) > 300);
  const names = async () => page.$$eval('.side .box:first-child tr td:first-child b', els => els.map(e => e.textContent));
  check('working and in-review members are listed', JSON.stringify((await names()).sort()) === JSON.stringify(['Checker', 'Pixel']), await names());
  check('the idle one is folded under Show all (1)', (await page.textContent('.team-all')) === 'Show all (1)');
  await page.click('.team-all');
  await page.waitForTimeout(300);
  check('Show all lists everyone', (await names()).length === 3);
  await page.reload(); await page.waitForSelector('.side');
  check('the choice is remembered in this browser', (await names()).length === 3);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  check('a phone keeps its columns unclipped', (await page.$eval('.column[data-status=todo]', e => getComputedStyle(e).overflowY)) === 'visible');
  noErrors(page);
}, true);

// AIG-1344: the Team panel tells the truth: working only when running now or heard from in 12 hours; the rest 💤 idle with last seen;
// working first. The board clears a stale "working" itself (after 12 hours, or when the run or session ends), keeping last seen.
def('teamlive', 'Team panel: a member marked working 2 days ago shows 💤 idle with last seen, a running lead shows working, working first; the board clears stale working (12 h, session end); Home and the brief follow (AIG-1344)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  for (const [name, role, status] of [['Oldie', 'Frontend', '🔄 working'], ['Lead', 'Lead', '🔄 working'], ['Pixel', 'Backend', '🔄 working'], ['Sleepy', 'QA', '💤 idle']])
    await s.ok('POST', '/api/projects/alpha/team', { name, role, status, task: name + ' task' });
  const pf = path.join(s.data, 'alpha.json'), pj = JSON.parse(fs.readFileSync(pf, 'utf8')), old = new Date(Date.now() - 48 * 3600e3).toISOString();
  for (const m of pj.team) if (m.name === 'Oldie' || m.name === 'Lead') m.updated = old;
  fs.writeFileSync(pf, JSON.stringify(pj));
  const ping = () => fetch(BASE + '/api/projects/alpha/ping', { headers: { 'x-aigile-where': 'terminal' } });
  await ping();   // the lead's session is live: running now
  await sleep(1500);   // the board's tidy runs (AIGILE_TEAMTIDY_MS)
  let team = (await s.ok('GET', '/api/projects/alpha')).team, by = n => team.find(m => m.name === n);
  check('the board clears a working status 2 days old to idle', by('Oldie').status === '💤 idle', by('Oldie'));
  check('it keeps the member, the task and last seen', by('Oldie').task === 'Oldie task' && by('Oldie').updated === old, by('Oldie'));
  check('a running lead keeps working, even with an old status line', /working/.test(by('Lead').status), by('Lead'));
  check('a member heard from today keeps working', /working/.test(by('Pixel').status), by('Pixel'));
  const home = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'alpha');
  check('Home crew line lists only who is working', JSON.stringify(home.team.map(m => m.name).sort()) === JSON.stringify(['Lead', 'Pixel']), home.team.map(m => m.name));
  const brief = s.cli(['brief', 'alpha']).out, line = (brief.split('\n').find(l => l.startsWith('Team: ')) || '');
  check('the brief leaves the stale helper out', !/Oldie/.test(line) && /Pixel/.test(line), line);
  const page = await openPage(ctx, '#/p/alpha');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => { try { localStorage.setItem('aigile.teamAll', '1'); } catch {} });
  await page.reload(); await page.waitForSelector('.side table');
  await ping();
  const rows = async () => page.$$eval('.side .box:first-child tr', trs => trs.slice(1).map(tr => [tr.querySelector('b').textContent, tr.lastElementChild.textContent]));
  let r = await rows();
  check('working ones first, then the rest by last seen', JSON.stringify(r.map(x => x[0])) === JSON.stringify(['Lead', 'Pixel', 'Sleepy', 'Oldie']), r);
  check('the running lead shows working', /working/.test(r[0][1]), r);
  check('the 2-day-old one shows idle with last seen', r[3][1] === '💤 idle · last seen 2d ago', r);
  check('a fresh idle one shows last seen too', /^💤 idle · last seen/.test(r[2][1]), r);
  check('Show all counts the two idle ones', (await page.textContent('.team-all')) === 'Show active only');
  await page.evaluate(() => { try { localStorage.removeItem('aigile.teamAll'); } catch {} });
  await page.reload(); await page.waitForSelector('.side');
  check('active only: just the two working', JSON.stringify((await rows()).map(x => x[0])) === JSON.stringify(['Lead', 'Pixel']) && (await page.textContent('.team-all')) === 'Show all (2)');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  check('phone: the Team panel fits the width', await page.evaluate(() => document.documentElement.scrollWidth <= 392));
  // The session ends (SessionEnd hook): nobody is running, so working goes idle; last seen stays.
  const pixelSeen = by('Pixel').updated;
  await s.ok('POST', '/api/projects/alpha/bye');
  team = (await s.ok('GET', '/api/projects/alpha')).team;
  check('the session ending clears working to idle', team.every(m => !/working/.test(m.status)), team.map(m => m.name + ' ' + m.status));
  check('last seen stays as it was', team.find(m => m.name === 'Pixel').updated === pixelSeen && team.length === 4);
  noErrors(page);
}, true, { AIGILE_TEAMTIDY_MS: '500' });
