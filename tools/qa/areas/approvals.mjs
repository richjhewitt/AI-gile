// QA area approvals (AIG-814, AIG-815): with the project's Approvals setting on, a card a friend raises waits for the owner's OK
// (no team or `next` sees it; take is refused); a team / background call to approve or decline gets 403; Approve puts it in To do,
// Decline closes it with a note the friend sees; the inbox shows a ✅ Approvals section with a count (nothing when none), at phone
// width and in dark mode. Two boards and a local relay, like share.
import { freePort, check, sleep, startServer, mkProject, openPage, noErrors, def } from '../lib.mjs';
import { startRelay, pair, until } from './share.mjs';

def('approvals', "approvals: a friend's raised card waits for the owner's OK (not in next / project / take), owner-only approve and decline, the friend sees the note, the inbox section with count, phone + dark (AIG-814/815)", async (a, ctx) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    const { ca, cb } = await pair(a, b, relay);
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { checked: true });
    await mkProject(a, 'Lima', 'LIM'); await mkProject(b, 'Mike', 'MIK');
    const off = await a.ok('POST', '/api/shares', { slug: 'lima', contact: cb.id });
    const id = off.id;
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${id}/accept`, { slug: 'mike' });
    await until(async () => (await a.ok('GET', '/api/shares?slug=lima')).find(l => l.state === 'live'));
    const pa = () => a.ok('GET', '/api/projects/lima'), lane = async () => (await a.ok('GET', '/api/shares-approvals')).cards;
    const owner = (await a.ok('GET', '/api/meta')).owner;
    const asWho = (where, as, method, url, body) => fetch(a.base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(r => r.status);
    const bg = { AIGILE_BACKGROUND: '1' };

    // Setting off (the default): the friend's card goes to the lane as before, nothing waits.
    const r0 = await b.ok('POST', `/api/shares/${id}/raise`, { type: 'bug', title: 'Before approvals' });
    const l0 = await until(async () => (await a.ok('GET', `/api/shares/${id}/inbound`)).cards.find(c => c.share === r0.share));
    check('setting off: the card lands in the lane as before, nothing waits', !!l0 && !l0.approval && (await lane()).length === 0, l0);
    check('Approvals is off by default and shows in the link', (await a.ok('GET', '/api/shares?slug=lima'))[0].approvals === false && !(await pa()).approvals);

    // Turn it on: owner only.
    check('a team cannot switch Approvals', (await asWho('cli', 'Lima Lead', 'PATCH', '/api/projects/lima', { approvals: true })) === 403 && !(await pa()).approvals);
    const sw = await a.ok('PATCH', '/api/projects/lima', { approvals: true });
    check('the owner switches it on', sw.approvals === true && (await a.ok('GET', '/api/shares?slug=lima'))[0].approvals === true);

    const r1 = await b.ok('POST', `/api/shares/${id}/raise`, { type: 'bug', title: 'Wait for me one', description: 'Button <b>broken</b>' });
    const r2 = await b.ok('POST', `/api/shares/${id}/raise`, { type: 'feature', title: 'Wait for me two' });
    const r3 = await b.ok('POST', `/api/shares/${id}/raise`, { type: 'bug', title: 'Wait for me three' });
    const w = await until(async () => { const l = await lane(); return l.length === 3 ? l : null; });
    check('with Approvals on, the three raised cards wait (friend, project, link)', !!w && w.every(c => c.friend && c.projectName === 'Lima' && c.link === id), w);
    const teamOut = a.cli(['next', 'lima'], bg).out + a.cli(['list', 'lima'], bg).out;
    check('no project card, `next` and `list` never show a waiting card', (await pa()).cards.length === 0 && !/Wait for me/.test(teamOut), teamOut);
    check('the lane (inbound) and Take do not offer a waiting card', !(await a.ok('GET', `/api/shares/${id}/inbound`)).cards.some(c => c.share === r1.share) && (await a.api('POST', `/api/shares/${id}/inbound/${r1.share}/take`)).status === 409);
    const sum = (await a.ok('GET', '/api/projects')).find(p => p.slug === 'lima');
    check('the board counts no To do for them', sum.counts.todo === 0 && sum.total === 0, sum.counts);

    // Owner only: a team (CLI), a background run (even under the owner name), and the list.
    const ap = `/api/shares/${id}/inbound/${r1.share}/approve`, de = `/api/shares/${id}/inbound/${r1.share}/decline`;
    check('a team gets 403 on approve, decline and the list', (await asWho('cli', 'Lima Lead', 'POST', ap)) === 403 && (await asWho('cli', 'Lima Lead', 'POST', de, { note: 'no' })) === 403 && (await asWho('cli', 'Lima Lead', 'GET', '/api/shares-approvals')) === 403);
    check('a background run gets 403 even under the owner name', (await asWho('background', owner, 'POST', ap)) === 403 && (await asWho('background', owner, 'POST', de, { note: 'no' })) === 403);
    check('the friend (their board) cannot approve their own card', (await b.api('POST', ap)).status >= 400 && (await lane()).length === 3);

    // Approve -> To do, approval cleared; the team can now see it.
    const ok1 = await a.ok('POST', ap);
    const p1 = await pa(), c1 = p1.cards.find(c => c.id === ok1.id);
    check('Approve: the card is in To do on the project', !!c1 && c1.status === 'todo' && c1.title === 'Wait for me one' && !c1.approval && p1.cards.length === 1, c1);
    check('Approve: it is no longer waiting, and `next` lists it', (await lane()).length === 2 && /Wait for me one/.test(a.cli(['next', 'lima'], bg).out));
    check('approving twice is refused', (await a.api('POST', ap)).status === 409);

    // Decline: a note is needed; closed; the friend sees the note and the card done.
    const de2 = `/api/shares/${id}/inbound/${r2.share}/decline`;
    check('Decline without a note is refused', (await a.api('POST', de2, { note: '  ' })).status === 400);
    const d2 = await a.ok('POST', de2, { note: 'Not for this year' });
    check('Decline: ok, the project gets no card', d2.declined === true && (await pa()).cards.length === 1 && (await lane()).length === 1);
    const seen = await until(async () => { const v = await b.ok('GET', `/api/shares/${id}/board`); const x = v.cards.find(c => c.share === r2.share); return x && x.status === 'done' && (v.comments[r2.share] || []).some(m => /Not for this year/.test(m.text)) ? v : null; });
    check('the friend sees the note and the card closed on their side', !!seen, seen && seen.comments[r2.share]);
    check('a declined card cannot be taken or approved later', (await a.api('POST', `/api/shares/${id}/inbound/${r2.share}/take`)).status === 409 && (await a.api('POST', `/api/shares/${id}/inbound/${r2.share}/approve`)).status === 409);

    // The inbox: section with a count; Decline asks for a note; nothing when none.
    const page = await openPage(ctx, '#/inbox');
    await page.waitForSelector('#ibApprovals:not([hidden]) .appr-item', { timeout: 8000 });
    const head = await page.textContent('#ibApprovals h3');
    check('inbox: the Approvals section shows the card with a count of 1', /Approvals/.test(head) && (await page.textContent('#ibApprN')).trim() === '1' && /Wait for me three/.test(await page.textContent('#ibApprovals')), head);
    check('inbox: Approve and Decline are there', (await page.locator('#ibApprovals [data-appr-yes]').count()) === 1 && (await page.locator('#ibApprovals [data-appr-no]').count()) === 1);
    // phone width and dark mode
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' }); await sleep(200);
    const bx = await page.locator('#ibApprovals .appr-item').boundingBox();
    check('phone width: the card fits, nothing scrolls sideways', bx.x >= 0 && bx.x + bx.width <= 390 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), bx);
    const col = await page.evaluate(() => { const e = document.querySelector('#ibApprovals .appr-item'); const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color }; });
    const lum = s => (s.match(/\d+/g) || [255, 255, 255]).slice(0, 3).reduce((x, y) => x + Number(y), 0) / 3;
    check('dark mode: a dark card with light text', lum(col.bg) < 110 && lum(col.fg) > 140, col);
    await page.setViewportSize({ width: 1400, height: 900 }); await page.emulateMedia({ colorScheme: 'light' });
    // Decline from the page: the first click opens the note box; an empty note is not sent.
    await page.click('#ibApprovals [data-appr-no]');
    check('inbox: Decline opens a note box', await page.locator('#ibApprovals [data-appr-note]').isVisible());
    await page.click('#ibApprovals [data-appr-no]');
    check('inbox: an empty note is not sent', /short note/.test(await page.textContent('#ibApprovals [data-appr-err]')) && (await lane()).length === 1);
    await page.fill('#ibApprovals [data-appr-note]', 'Maybe next sprint');
    await page.click('#ibApprovals [data-appr-no]');
    await page.waitForSelector('#ibApprovals[hidden]', { state: 'attached', timeout: 8000 });
    check('inbox: nothing shows when none wait', (await lane()).length === 0 && !(await page.locator('#ibApprovals').isVisible()) && (await page.locator('.ib-btn .ib-badge[data-friends]').count()) === 0);
    const seen3 = await until(async () => ((await b.ok('GET', `/api/shares/${id}/board`)).comments[r3.share] || []).some(m => /Maybe next sprint/.test(m.text)));
    check('the friend sees the note typed in the inbox', !!seen3);
    // Approve from the page.
    await b.ok('POST', `/api/shares/${id}/raise`, { type: 'feature', title: 'Wait for me four' });
    await page.waitForSelector('#ibApprovals:not([hidden]) [data-appr-yes]', { timeout: 8000 });
    check('inbox: a new waiting card brings the top badge', await page.locator('.ib-btn .ib-badge[data-friends]').count() === 1);
    await page.click('#ibApprovals [data-appr-yes]');
    await until(async () => (await pa()).cards.some(c => c.title === 'Wait for me four' && c.status === 'todo'));
    check('inbox: Approve puts it in To do', (await pa()).cards.some(c => c.title === 'Wait for me four' && c.status === 'todo'));
    noErrors(page);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
