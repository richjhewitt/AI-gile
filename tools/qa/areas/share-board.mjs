// QA area shareboard (AIG-324/325): a project a friend shares, as its own board on the friend's side. Two boards and a
// local relay. The owner's "show my whole board" choice (default: only ticked cards), the columns following their
// status labels, live; per role (Alpha tester, Member, Tester, Viewer, Reporter) what the friend's board shows and which
// buttons exist; the friend's actions land on the owner's side as the same share messages; nothing wakes either team.
import fs from 'node:fs';
import { freePort, check, sleep, startServer, mkProject, mkCard, noErrors, def } from '../lib.mjs';
import { startRelay, pair, until } from './share.mjs';

def('shareboard', "a shared project as its own board on the friend's side, shaped by their role: whole board or ticked cards, live columns, raise / comment / status / verdict per role, nothing wakes (AIG-324/325)", async (a, ctx) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    const { ca, cb } = await pair(a, b, relay);
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { checked: true });
    await mkProject(a, 'Lima', 'LIM'); await mkProject(b, 'Mike', 'MIK');
    const l1 = await mkCard(a, 'lima', 'Lima one', { status: 'todo' });
    const l2 = await mkCard(a, 'lima', 'Lima two', { status: 'doing' });
    await mkCard(a, 'lima', 'Lima secret', { description: 'see C:\\Users\\rich\\secret.txt' });
    const off = await a.ok('POST', '/api/shares', { slug: 'lima', contact: cb.id });
    const id = off.id;
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${id}/accept`, { slug: 'mike' });
    await until(async () => (await a.ok('GET', '/api/shares?slug=lima')).find(l => l.state === 'live'));
    const bv = () => b.ok('GET', `/api/shares/${id}/board`), inbA = () => a.ok('GET', `/api/shares/${id}/inbound`);
    const lA = async () => (await a.ok('GET', '/api/shares?slug=lima'))[0];

    // Default: only the cards I tick 🔗, and B is told nothing about a whole board.
    const s1 = (await a.ok('POST', `/api/shares/${id}/cards`, { card: l1.id })).share.id;
    const v0 = await until(async () => { const v = await bv(); return v.cards.length ? v : null; });
    check('default: the friend sees only the ticked card, no whole board, no column yet (status follows is off)', v0 && v0.cards.length === 1 && v0.cards[0].title === 'Lima one' && v0.board === false && v0.cards[0].status === '' && v0.role === 'member', v0);
    check('the owner\'s link says: whole board off', (await lA()).board === false);

    // 🧪 Alpha tester for all my projects, and my whole board: every card goes (the flagged one waits), with its column.
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'alpha', scope: 'all' });
    const wb = await a.ok('PATCH', `/api/shares/${id}`, { board: true });
    check('whole board on: the other cards are sent, the one with a path waits', wb.board === true && wb.shared && wb.shared.sent === 1 && wb.shared.held === 1, wb.shared);
    const v1 = await until(async () => { const v = await bv(); return v.board && v.role === 'alpha' && v.cards.length === 2 && v.cards.every(c => c.status) ? v : null; });
    const col = (v, title) => ((v && v.cards.find(c => c.title === title)) || {}).status;
    check('friend: whole board, as Alpha tester, each card in its column on my board', v1 && col(v1, 'Lima one') === 'todo' && col(v1, 'Lima two') === 'doing' && !v1.cards.some(c => /secret/.test(c.title)), v1);
    check('friend: the role shapes what they may do (bugs and ideas, own comments only)', v1 && v1.can.raise.join() === 'bug,feature' && v1.can.comment === 'own' && v1.can.act === '', v1 && v1.can);
    // Live: a new card goes by itself; a move changes its column there (a label: their board never moves my card).
    await mkCard(a, 'lima', 'Lima four');
    await a.ok('PATCH', `/api/projects/lima/cards/${l2.id}`, { status: 'done' });
    const v2 = await until(async () => { const v = await bv(); return col(v, 'Lima four') === 'backlog' && col(v, 'Lima two') === 'done' ? v : null; });
    check('live: a new card arrives in its column, a move follows', !!v2, await bv());

    // Alpha: raise a bug (lands in my 📥 row, nowhere in their project), not a task; comments only on their own.
    const raised = await b.ok('POST', `/api/shares/${id}/raise`, { type: 'bug', title: 'Button is broken', description: 'It does nothing' });
    check('alpha: a task is refused on their side already', (await b.api('POST', `/api/shares/${id}/raise`, { type: 'task', title: 'A task' })).status === 409);
    const lane = await until(async () => (await inbA()).cards.find(c => c.share === raised.share));
    check('alpha: their bug lands in my 📥 row (link file), not in a project file', lane && lane.title === 'Button is broken' && lane.type === 'bug' && (await a.ok('GET', '/api/projects/lima')).cards.length === 4, lane);
    check("alpha: the raised card is not in the friend's own project either", (await b.ok('GET', '/api/projects/mike')).cards.length === 0);
    await b.ok('POST', `/api/shares/${id}/board/${raised.share}/comments`, { text: 'Also on Firefox' });
    check('alpha: a comment on their own card lands', !!(await until(async () => ((await inbA()).comments[raised.share] || []).some(m => m.text === 'Also on Firefox'))));
    check('alpha: a comment on my card is refused', (await b.api('POST', `/api/shares/${id}/board/${s1}/comments`, { text: 'hi' })).status === 409);
    check('alpha: no status on my card', (await b.api('POST', `/api/shares/${id}/board/${s1}/status`, { status: 'doing' })).status === 409);
    // I take it and move it: the friend sees where their bug sits on my board.
    const took = await a.ok('POST', `/api/shares/${id}/inbound/${raised.share}/take`);
    await a.ok('PATCH', `/api/projects/lima/cards/${took.id}`, { status: 'doing' });
    check('alpha: their raised bug follows its column on my board', !!(await until(async () => { const x = (await bv()).cards.find(c => c.share === raised.share); return x && x.mine && x.status === 'doing'; })));

    // Member: comments on every shared card; status only on a card I 🙋 assign them (a label on mine, never my column).
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'member', scope: 'all' });
    await until(async () => (await bv()).role === 'member');
    await b.ok('POST', `/api/shares/${id}/board/${s1}/comments`, { text: 'Nice card' });
    check('member: a comment on my card lands', !!(await until(async () => ((await inbA()).comments[s1] || []).some(m => m.text === 'Nice card'))));
    check('member: no status on a card not assigned to them', (await b.api('POST', `/api/shares/${id}/board/${s1}/status`, { status: 'doing' })).status === 409);
    await a.ok('PATCH', `/api/shares/${id}/cards/${l1.id}`, { assigned: true });
    await until(async () => (await bv()).cards.find(c => c.share === s1 && c.forYou));
    await b.ok('POST', `/api/shares/${id}/board/${s1}/status`, { status: 'review' });
    const ts = await until(async () => { const o = (await inbA()).outbound[s1]; return o && o.theirStatus && o.theirStatus.status === 'review' ? o : null; });
    check('member: their status on an assigned card lands as a label, my column stays', !!ts && (await a.ok('GET', '/api/projects/lima')).cards.find(c => c.id === l1.id).status === 'todo', ts);

    // Tester: ✅ Accept on a test I hand them.
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'tester', scope: 'all' });
    await until(async () => (await bv()).role === 'tester');
    await a.ok('POST', `/api/shares/${id}/test`, { card: l1.id, text: 'Click it twice' });
    await until(async () => { const x = (await bv()).cards.find(c => c.share === s1); return x && x.test && x.test.open; });
    await b.ok('POST', `/api/shares/${id}/inbound/${s1}/verdict`, { verdict: 'accept' });
    check('tester: their ✅ Accept lands on my card as a label', !!(await until(async () => { const o = (await inbA()).outbound[s1]; return o && o.test && o.test.verdict === 'accept'; })));

    // The page, on the friend's board: the rail, the board, and the buttons per role.
    const page = await ctx.newPage(); page.errors = [];
    page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
    await page.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); if (!localStorage.getItem('aigile.lang')) localStorage.setItem('aigile.lang', 'en'); } catch {} });
    await page.goto(b.base + '/#/p/mike');
    await page.waitForSelector('#shareOpenBoard', { timeout: 8000 }).catch(() => {});
    check("friend's linked project: 🔗 Open Alberto's board", /Open Alberto's board/.test(await page.textContent('#shareOpenBoard').catch(() => '')));
    await page.waitForSelector('[data-sboard]', { timeout: 8000 }).catch(() => {});
    check('the rail has the shared board', await page.locator(`[data-sboard="${id}"]`).count() === 1);
    await page.click('#shareOpenBoard');
    await page.waitForSelector('.sb-board', { timeout: 8000 });
    const colOf = async t => page.locator('.sb-col', { has: page.locator('.sb-card', { hasText: t }) }).getAttribute('data-sb-col').catch(() => '');
    check('page: their cards in their columns', await colOf('Lima one') === 'todo' && await colOf('Lima two') === 'done' && await colOf('Lima four') === 'backlog' && await colOf('Button is broken') === 'doing');
    check('page: Tester can raise any type; the role shows', await page.locator('[data-sb-raise]').count() === 4 && await page.locator('[data-sb-raise="incident"]').count() === 1 && /Tester/.test(await page.textContent('#sbRole')), await page.$$eval('[data-sb-raise]', es => es.map(e => e.dataset.sbRaise).join()) + ' / ' + await page.textContent('#sbRole').catch(() => '-'));

    // Alpha tester on the page: bug and idea buttons only; on my card no reply box and no status.
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'alpha', scope: 'all' });
    await page.waitForFunction(() => /Alpha/.test((document.querySelector('#sbRole') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    check('page alpha: 🐞 Raise a bug and 💡 Suggest a feature, nothing else', (await page.$$eval('[data-sb-raise]', xs => xs.map(x => x.dataset.sbRaise))).join() === 'bug,feature');
    await page.click('.sb-card:has-text("Lima one")');
    await page.waitForSelector('.sb-open');
    check('page alpha: my card has no reply box and no status picker', await page.locator('#sbReply').count() === 0 && await page.locator('#sbNoReply').count() === 1 && await page.locator('#sbStatus').count() === 0);
    await page.click('#dialog button[onclick="closeDialog()"]');
    await page.click('[data-sb-raise="feature"]');
    await page.fill('#sbTitle', 'Dark mode please');
    await page.click('#sbRaiseSend');
    check('page alpha: a suggested feature lands in my 📥 row', !!(await until(async () => (await inbA()).cards.find(c => c.title === 'Dark mode please' && c.type === 'feature'))));
    await page.click('.sb-card:has-text("Button is broken")');
    await page.waitForSelector('.sb-open');
    check('page alpha: on their own card a reply box', await page.locator('#sbReplySend').count() === 1);
    await page.fill('#sbReply', 'Still broken');
    await page.click('#sbReplySend');
    check('page alpha: the reply lands on my side', !!(await until(async () => ((await inbA()).comments[raised.share] || []).some(m => m.text === 'Still broken'))));
    await page.click('#dialog button[onclick="closeDialog()"]').catch(() => {});

    // Member on the page: reply on my card, and the status picker on the one I assigned.
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'member', scope: 'all' });
    await page.waitForFunction(() => /Member/.test((document.querySelector('#sbRole') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    await page.click('.sb-card:has-text("Lima one")');
    await page.waitForSelector('.sb-open');
    check('page member: reply box and status picker on an assigned card', await page.locator('#sbReplySend').count() === 1 && await page.locator('#sbStatus').count() === 1);
    await page.selectOption('#sbStatus', 'doing');
    check('page member: the status lands as a label', !!(await until(async () => { const o = (await inbA()).outbound[s1]; return o && o.theirStatus && o.theirStatus.status === 'doing'; })));
    await page.click('#dialog button[onclick="closeDialog()"]').catch(() => {});
    await page.click('.sb-card:has-text("Lima four")');
    await page.waitForSelector('.sb-open');
    check('page member: no status picker on a card not assigned to them', await page.locator('#sbStatus').count() === 0 && await page.locator('#sbReplySend').count() === 1);
    await page.click('#dialog button[onclick="closeDialog()"]').catch(() => {});

    // Viewer: looks only.
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'viewer', scope: 'all' });
    await page.waitForFunction(() => /Viewer/.test((document.querySelector('#sbRole') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    check('page viewer: no raise buttons', await page.locator('[data-sb-raise]').count() === 0);
    await page.click('.sb-card:has-text("Lima one")');
    await page.waitForSelector('.sb-open');
    check('page viewer: no reply, no status, no verdict', await page.locator('#sbReply').count() === 0 && await page.locator('#sbStatus').count() === 0 && await page.locator('#sbAccept').count() === 0);
    await page.click('#dialog button[onclick="closeDialog()"]').catch(() => {});
    check('viewer: raising is refused', (await b.api('POST', `/api/shares/${id}/raise`, { type: 'bug', title: 'x' })).status === 409);

    // Flemish on the friend's board.
    await page.evaluate(() => localStorage.setItem('aigile.lang', 'nl-BE'));
    await page.reload();
    await page.waitForSelector('#sbRole');
    await page.waitForFunction(() => /Jij bent/.test(document.querySelector('#sbRole').textContent), null, { timeout: 6000 }).catch(() => {});
    check('page nl-BE: the board speaks Flemish', /Jij bent: 👀 Kijker|Jij bent/.test(await page.textContent('#sbRole')) && /rondkijken/.test(await page.textContent('#sbCan')), await page.textContent('#sbCan'));
    noErrors(page);
    await page.close();

    // Reporter: sees only their own, so my whole board can't be turned on for them.
    await a.ok('PATCH', `/api/shares/${id}`, { board: false });
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'reporter', scope: 'project' });
    check('reporter: my whole board is refused for them', (await a.api('PATCH', `/api/shares/${id}`, { board: true })).status === 409);
    check('the friend is told the whole board is off again', !!(await until(async () => (await bv()).board === false)));

    // The owner's 🔗 dialog has the choice.
    const pa = await ctx.newPage(); pa.errors = [];
    pa.on('pageerror', e => pa.errors.push('pageerror: ' + e.message));
    await pa.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); if (!localStorage.getItem('aigile.lang')) localStorage.setItem('aigile.lang', 'en'); } catch {} });
    await a.ok('PATCH', `/api/shares/${id}`, { role: 'alpha', scope: 'project' });
    await pa.goto(a.base + '/#/p/lima');
    await pa.waitForSelector('#shareBtn');
    await pa.click('#shareBtn');
    await pa.waitForSelector('#shareBoard');
    check("owner's dialog: 📋 Show Beatrix my whole board, off", !(await pa.isChecked('#shareBoard')) && /whole board/.test(await pa.textContent('label:has(#shareBoard)')));
    await pa.check('#shareBoard');
    check("owner's dialog: ticking it turns it on", !!(await until(async () => (await lA()).board === true)));
    noErrors(pa);
    await pa.close();

    // Nothing a friend did woke a team on either board.
    await sleep(500);
    check('nothing woke a team on either board', !fs.existsSync(a.wakeOut) && !fs.existsSync(b.wakeOut));
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
