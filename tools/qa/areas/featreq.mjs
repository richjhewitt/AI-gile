// QA area featreq (AIG-846): a friend's Request a feature form. It always lands in the owner's Approvals (the project's Approvals
// setting stays off), marked feature request / custom build; Approve makes a feature card (custom: "for <friend>"); Decline tells the
// friend; a team gets 403; the friend's dialog and the owner's inbox work at phone width and in dark mode.
import { freePort, check, sleep, startServer, mkProject, openPage, noErrors, def } from '../lib.mjs';
import { startRelay, pair, until } from './share.mjs';

def('featreq', "featreq: a friend's feature request / custom build always waits in Approvals, approve -> feature card (custom: for <friend>), decline -> the friend sees the note, team 403, dialog + inbox phone + dark (AIG-846)", async (a, ctx) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    const { ca, cb } = await pair(a, b, relay);
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { checked: true });
    await mkProject(a, 'Nora', 'NOR'); await mkProject(b, 'Oscar', 'OSC');
    // a shares Nora with b (b is the friend); later b shares Oscar with a (a is the friend, for the page dialog).
    const id = (await a.ok('POST', '/api/shares', { slug: 'nora', contact: cb.id })).id;
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${id}/accept`, { slug: 'oscar' });
    await until(async () => (await a.ok('GET', '/api/shares?slug=nora')).find(l => l.state === 'live'));
    const pa = () => a.ok('GET', '/api/projects/nora'), lane = async () => (await a.ok('GET', '/api/shares-approvals')).cards;
    const asWho = (where, as, method, url, body) => fetch(a.base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(r => r.status);
    check('Approvals is off on the project', !(await pa()).approvals);

    check('a request needs a title and what you want', (await b.api('POST', `/api/shares/${id}/request`, { title: 'x', want: ' ' })).status === 400 && (await b.api('POST', `/api/shares/${id}/request`, { want: 'x' })).status === 400);
    const r1 = await b.ok('POST', `/api/shares/${id}/request`, { title: 'Dark charts', want: 'Charts in dark', why: 'Night work' });
    const r2 = await b.ok('POST', `/api/shares/${id}/request`, { title: 'My own export', want: 'CSV with my columns', custom: true });
    const w = await until(async () => { const l = await lane(); return l.length === 2 ? l : null; });
    const w1 = w && w.find(c => c.title === 'Dark charts'), w2 = w && w.find(c => c.title === 'My own export');
    check('with Approvals off, both requests still wait in Approvals, marked', !!w1 && !!w2 && w1.req === 'feature' && w2.req === 'custom' && w1.type === 'feature' && /Night work/.test(w1.description), w);
    const plain = await b.ok('POST', `/api/shares/${id}/raise`, { type: 'bug', title: 'Plain bug' });
    const px = await until(async () => (await a.ok('GET', `/api/shares/${id}/inbound`)).cards.find(c => c.share === plain.share));
    check('a plain raise with Approvals off still goes straight to the lane', !!px && !px.approval && (await lane()).length === 2);
    check('nothing is a project card yet', (await pa()).cards.length === 0);

    const ap = s => `/api/shares/${id}/inbound/${s}/approve`, de = s => `/api/shares/${id}/inbound/${s}/decline`;
    check('a team gets 403 on approve, decline and request', (await asWho('cli', 'Nora Lead', 'POST', ap(r1.share))) === 403 && (await asWho('cli', 'Nora Lead', 'POST', de(r1.share), { note: 'no' })) === 403 && (await asWho('cli', 'Nora Lead', 'POST', `/api/shares/${id}/request`, { title: 't', want: 'w' })) === 403);

    const c1 = await a.ok('POST', ap(r1.share)), c2 = await a.ok('POST', ap(r2.share));
    const p = await pa(), k1 = p.cards.find(c => c.id === c1.id), k2 = p.cards.find(c => c.id === c2.id);
    check('Approve: a feature card in To do', !!k1 && k1.type === 'feature' && k1.status === 'todo' && !k1.forFriend && /Charts in dark/.test(k1.description) && /Night work/.test(k1.description), k1);
    check('Approve: the title is marked as friend text on one line, never a bare title', !!k1 && /^🔗 /.test(k1.title) && /<<friend-text/.test(k1.title) && /Dark charts/.test(k1.title) && !k1.title.includes(String.fromCharCode(10)), k1 && k1.title);
    const friend = (await a.ok('GET', '/api/shares?slug=nora'))[0].friend;
    check('Approve (custom build): the card is labelled for the friend', !!k2 && k2.type === 'feature' && !!k2.forFriend && k2.forFriend === friend, k2);

    // Decline tells the friend.
    const r3 = await b.ok('POST', `/api/shares/${id}/request`, { title: 'Too big', want: 'Everything' });
    await until(async () => (await lane()).some(c => c.title === 'Too big'));
    const d = await a.ok('POST', de(r3.share), { note: 'Not this year' });
    const seen = await until(async () => { const v = await b.ok('GET', `/api/shares/${id}/board`); const x = v.cards.find(c => c.share === r3.share); return x && x.status === 'done' && (v.comments[r3.share] || []).some(m => /Not this year/.test(m.text)); });
    check('Decline: the friend sees the note and the request closed', d.declined === true && !!seen);

    // Owner inbox: the request is tagged, at phone width and in dark mode.
    await b.ok('POST', `/api/shares/${id}/request`, { title: 'Page check', want: 'See it', custom: true });
    const page = await openPage(ctx, '#/inbox');
    await page.waitForSelector('#ibApprovals:not([hidden]) .appr-item', { timeout: 8000 });
    const tag = await page.textContent('#ibApprovals .ib-tag');
    check('inbox: the card is tagged as a custom build request', /custom build/i.test(tag), tag);
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' }); await sleep(200);
    const bx = await page.locator('#ibApprovals .appr-item').boundingBox();
    const col = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#ibApprovals .appr-item')); return { bg: c.backgroundColor, fg: c.color }; });
    const lum = s => (s.match(/\d+/g) || [255, 255, 255]).slice(0, 3).reduce((x, y) => x + Number(y), 0) / 3;
    check('inbox phone + dark: fits, dark card, light text', bx.x >= 0 && bx.x + bx.width <= 390 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth) && lum(col.bg) < 110 && lum(col.fg) > 140, { bx, col });
    await page.click('#ibApprovals [data-appr-yes]');
    await until(async () => (await pa()).cards.some(c => c.title.includes('Page check') && c.forFriend));
    check('inbox: Approve makes the custom card', (await pa()).cards.some(c => c.title.includes('Page check') && c.forFriend));

    // The friend's dialog (this server is the friend on b's project).
    await mkProject(a, 'Quinn', 'QUI'); await mkProject(b, 'Pablo', 'PAB');
    const id2 = (await b.ok('POST', '/api/shares', { slug: 'pablo', contact: ca.id })).id;
    await until(async () => (await a.ok('GET', '/api/shares')).find(l => l.id === id2 && l.state === 'incoming'));
    await a.ok('POST', `/api/shares/${id2}/accept`, { slug: 'quinn' });
    await until(async () => (await b.ok('GET', '/api/shares?slug=pablo')).find(l => l.state === 'live'));
    await page.goto(page.url().split('#')[0] + `#/shared/${id2}`);
    await page.waitForSelector('[data-sb-request]', { timeout: 8000 });
    await page.click('[data-sb-request]');
    await page.waitForSelector('#frTitle', { timeout: 5000 });
    const form = await page.evaluate(() => ({ ids: ['frTitle', 'frWant', 'frWhy', 'frCustom'].map(i => !!document.getElementById(i)), w: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
    check('friend dialog (phone, dark): title, want, why, custom tick; fits', form.ids.every(Boolean) && form.w, form);
    await page.click('#frSend');
    check('friend dialog: an empty form is refused', /title/i.test(await page.textContent('#sbErr')));
    await page.fill('#frTitle', 'From the page'); await page.fill('#frWant', 'A thing'); await page.check('#frCustom');
    await page.click('#frSend');
    const got = await until(async () => (await b.ok('GET', '/api/shares-approvals')).cards.find(c => c.title === 'From the page'));
    check('friend dialog: the request lands in the other side\'s Approvals as a custom build', !!got && got.req === 'custom', got);
    noErrors(page);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
