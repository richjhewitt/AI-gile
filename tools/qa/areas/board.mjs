// QA areas: board, filters, columns, cardview, wip, lanes, views, steps, quick.
import { BASE, check, sleep, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

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

  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #f-title');
  check('+ New defaults to For the team', (await page.inputValue('#f-status')) === 'team');
  await page.fill('#f-title', 'From the dialog');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await page.waitForTimeout(300);
  const made = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'From the dialog');
  check('created card is for the team, by Rich', made && made.status === 'team' && made.createdBy === 'Rich', made);
  check('new card shows in the team column', (await page.locator('.column[data-status=team] .card', { hasText: 'From the dialog' }).count()) === 1);

  await page.click('button.bug');
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
  await mkCard(s, 'alpha', 'Building the thing', { status: 'doing', assignee: 'Pixel' });
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('button:has-text("What\'s happening?")');
  await page.waitForSelector('#dialog h2');
  check('summary shows what is in progress', (await page.textContent('#dialog')).includes('Building the thing'));
  await page.click('#dialog button:has-text("Ask the team")');
  await page.fill('#ask-text', 'Where are we with the login page?');
  await page.click('#dialog button[type=submit]');
  await sleep(500);
  const q = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.quick);
  check('question card goes to the team', q && q.status === 'team' && q.title === '💬 Where are we with the login page?', q);
  s.cli(['comment', 'alpha', q.id, 'Nearly done, testing now', '--as', 'Lead']);
  check('the answer lands in your Messages', (await getCard(s, 'alpha', q.id)).needsYou === true && (await s.ok('GET', '/api/inbox')).some(c => c.id === q.id));
  noErrors(page);
}, true);
