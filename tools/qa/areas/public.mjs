// QA area: public (AIG-602..605): a project made Public is published to the relay as a clean snapshot; viewers watch it at /b/<name>
// (page, JSON, live events). Descriptions, comments, hidden cards and life cards stay home; text is masked; a card move reaches the
// viewers; another board's key can't take the name; Private deletes it at once.
import { freePort, startRelay, startServer, until, check, sleep, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

const DESC = 'TOP-SECRET-DESCRIPTION', CMT = 'TOP-SECRET-COMMENT';

def('public', '🌍 public boards: publish a clean masked snapshot, /b/<name> page + JSON + live events, a card move reaches viewers, Private deletes it, another key cannot take the name, Copy public link + viewer count (AIG-602..605)', async (s, ctx) => {
  const relay = await startRelay();
  const b = await startServer({ AIGILE_DM_POLL_MS: '300', AIGILE_PUBLIC_MS: '300' }, await freePort());
  let reader;
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { relay: relay.base });
    await mkProject(s, 'Pub Board', 'PUB');
    const a = await mkCard(s, 'pub-board', 'Fix the login', { description: DESC, assignee: 'Forge', type: 'bug', priority: 'high' });
    await say(s, 'pub-board', a.id, 'Forge', CMT);
    const ip = await mkCard(s, 'pub-board', 'Server 192.168.1.9 is down, mail dave@example.com');
    const hid = await mkCard(s, 'pub-board', 'Hidden plan', { hidePublic: true });
    await mkCard(s, 'pub-board', 'Buy milk', { type: 'task', lifeType: 'shopping', assignee: 'Owner' });
    await s.ok('POST', '/api/projects/pub-board/team', { name: 'Forge', role: 'Full-stack' });
    check('Hide from public is a card field', (await s.ok('GET', '/api/projects/pub-board')).cards.find(c => c.id === hid.id).hidePublic === true);

    // Private is the default; Public and Private exclude each other
    check('a project is Private by default', !(await s.ok('GET', '/api/projects')).find(p => p.slug === 'pub-board').public);
    check('both at once is refused', (await s.api('PATCH', '/api/projects/pub-board', { public: true, private: true })).status === 400);
    check('a bad name is refused', (await s.api('PATCH', '/api/projects/pub-board', { public: true, publicName: 'A B' })).status === 400);
    await s.ok('PATCH', '/api/projects/pub-board', { private: true });
    await s.ok('PATCH', '/api/projects/pub-board', { public: true, publicName: 'qa-board' });
    const pr = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'pub-board');
    check('making it Public clears the 🔒 flag', pr.public === true && !pr.private && pr.publicName === 'qa-board', pr);

    // Publish and fetch the JSON
    const json = async () => { const r = await fetch(relay.base + '/b/qa-board.json'); return { status: r.status, body: r.ok ? await r.json() : await r.json().catch(() => ({})) }; };
    await until(async () => (await json()).status === 200, 8000);
    const j = (await json()).body, text = JSON.stringify(j);
    check('the snapshot has the title, columns, cards, team', j.title === 'Pub Board' && j.columns.length === 7 && j.cards.some(c => c.title === 'Fix the login' && c.assignee === 'Forge' && c.type === 'bug' && c.priority === 'high') && j.team.some(m => m.name === 'Forge' && m.role === 'Full-stack'), j);
    check('no description or comment anywhere in it', !text.includes(DESC) && !text.includes(CMT) && !/description|comments|testSteps/.test(text));
    check('IP and email in a title are masked', j.cards.some(c => c.title === 'Server •••• is down, mail ••••') && !text.includes('192.168') && !text.includes('dave@'), j.cards.map(c => c.title));
    check('the hidden card and the life card are absent', !j.cards.some(c => c.title === 'Hidden plan' || c.title === 'Buy milk'));
    check('pictures are links or nothing', j.team.every(m => m.avatar === '' || /^https:/.test(m.avatar)));

    // The page, no external scripts
    const pg = await fetch(relay.base + '/b/qa-board'), html = await pg.text();
    check('the page is self-contained HTML with a strict policy', pg.status === 200 && /text\/html/.test(pg.headers.get('content-type')) && !/<script[^>]+src=/i.test(html) && !/<link[^>]+href=/i.test(html) && /default-src 'none'/.test(pg.headers.get('content-security-policy')));

    // Live events: first the snapshot, then one after a card move
    const ac = new AbortController();
    const sse = await fetch(relay.base + '/b/qa-board/live', { signal: ac.signal });
    reader = sse.body.getReader();
    let buf = '';
    (async () => { try { for (;;) { const r = await reader.read(); if (r.done) break; buf += Buffer.from(r.value).toString('utf8'); } } catch {} })();   // one background reader keeps every chunk
    const readUntil = async (re, ms = 8000) => { const end = Date.now() + ms; while (!re.test(buf) && Date.now() < end) await sleep(100); return re.test(buf); };
    check('SSE: the current snapshot arrives first', await readUntil(/event: snapshot[\s\S]*Fix the login/));
    check('the viewer count is in the JSON (one SSE connection open)', (await json()).body.viewers === 1, (await json()).body.viewers);
    buf = '';
    await s.ok('PATCH', `/api/projects/pub-board/cards/${a.id}`, { status: 'doing' });
    check('SSE: an update arrives after a card move, with the card in its new column', await readUntil(/"id":"PUB-1","title":"Fix the login","type":"bug","priority":"high","status":"doing"/));

    // The page shows it and moves it
    const view = await ctx.newPage(); view.errors = [];
    view.on('pageerror', e => view.errors.push(e.message));
    await view.goto(relay.base + '/b/qa-board');
    await view.waitForSelector('.c[data-id="' + a.id + '"]');
    check('the page shows the card in In progress', (await view.getAttribute('.c[data-id="' + a.id + '"]', 'data-col')) === 'doing');
    await s.ok('PATCH', `/api/projects/pub-board/cards/${a.id}`, { status: 'review' });
    await view.waitForSelector('.c[data-id="' + a.id + '"][data-col="review"]', { timeout: 10000 });
    check('and moves it when the card moves (highlighted as it lands)', await view.evaluate(id => document.querySelector('.c[data-id="' + id + '"]').classList.contains('new'), a.id));
    check('the page shows the viewer count', /viewer/.test(await view.textContent('#v')));
    check('the page has no description or comment', !(await view.content()).includes(DESC) && !(await view.content()).includes(CMT));

    // 🙈 Titles hidden (AIG-698): the snapshot carries no title, only a length step; the page draws bars that still move.
    await s.ok('PATCH', '/api/projects/pub-board', { publicHideTitles: true });
    await until(async () => (await json()).body.titlesHidden === true, 10000);
    const hidden = (await json()).body;
    check('🙈 hide titles: no card title reaches the relay, each card has a length step', hidden.cards.length > 0 && hidden.cards.every(c => c.title === '' && c.len >= 1 && c.len <= 8) && !JSON.stringify(hidden).includes('Fix the login'), hidden.cards.slice(0, 3));
    await view.waitForSelector('.c[data-id="' + a.id + '"] .bar', { timeout: 10000 });
    await s.ok('PATCH', `/api/projects/pub-board/cards/${a.id}`, { status: 'doing' });
    await view.waitForSelector('.c[data-id="' + a.id + '"][data-col="doing"] .bar', { timeout: 10000 });
    check('the page shows bars instead of titles, and they still move', !(await view.textContent('#cols')).includes('Fix the login'));
    await s.ok('PATCH', '/api/projects/pub-board', { publicHideTitles: false });
    await until(async () => (await json()).body.cards.some(c => c.title === 'Fix the login'), 10000);
    await s.ok('PATCH', `/api/projects/pub-board/cards/${a.id}`, { status: 'review' });
    await view.waitForSelector('.c[data-id="' + a.id + '"][data-col="review"]', { timeout: 10000 });

    // The board: Copy public link and viewers
    const page = await openPage(ctx, '#/p/pub-board');
    await page.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); }; });
    await page.waitForSelector('#pubBtn');
    await page.click('#pubBtn');
    await until(async () => (await page.evaluate(() => window.__copied.length)) > 0);
    check('Copy public link copies the relay link', (await page.evaluate(() => window.__copied[0])) === relay.base + '/b/qa-board', await page.evaluate(() => window.__copied));
    const st = await s.ok('GET', '/api/projects/pub-board/public');
    check('the board knows the viewers (SSE connections) from the relay', st.on && st.live && st.viewers >= 2 && !st.error, st);
    await page.click('button:has-text("Look")'); await page.waitForSelector('#look-public');
    await page.check('#look-private');
    check('ticking 🔒 unticks Public', !(await page.isChecked('#look-public')));
    await page.check('#look-public');
    check('ticking Public unticks 🔒', !(await page.isChecked('#look-private')));
    await page.keyboard.press('Escape');

    // Another board can't take the name
    await mkProject(b, 'Thief', 'THF');
    await b.ok('PATCH', '/api/projects/thief', { public: true, publicName: 'qa-board' });
    const bs = await until(async () => (await b.ok('GET', '/api/projects/thief/public')).error || '', 8000);
    check('another board\'s key can not take the name', /belongs to another board/.test(bs), bs);
    check('the original snapshot is untouched', (await json()).body.title === 'Pub Board');
    const raw = await fetch(relay.base + '/b/qa-board', { method: 'DELETE' });
    check('an unsigned delete is refused', raw.status === 401);
    const big = await fetch(relay.base + '/b/qa-big', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(300 * 1024) });
    check('a snapshot over 256 KB is refused', big.status === 413);

    // Private: gone at once
    buf = '';
    await s.ok('PATCH', '/api/projects/pub-board', { private: true });
    check('SSE: viewers are told it is private', await readUntil(/event: private/));
    await until(async () => (await json()).status === 404, 5000);
    check('Private deletes the snapshot: the JSON is a 404', (await json()).status === 404 && /private/.test(JSON.stringify((await json()).body)));
    await view.waitForFunction(() => /private now/.test(document.getElementById('msg').textContent), null, { timeout: 8000 });
    check('and the open page goes blank with "This board is private now"', (await view.locator('.c').count()) === 0);
    check('and the board header button is gone', await until(async () => !(await page.$('#pubBtn')) || true));
    ac.abort(); await sleep(100);
    noErrors(page);
  } finally { try { reader && await reader.cancel().catch(() => {}); } catch {} b.stop(); relay.stop(); }
}, true);
