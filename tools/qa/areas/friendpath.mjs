// QA area friendpath (AIG-1182): the whole friend path by clicking and typing, as two people would on two boards and a local relay:
// A switches DMs on and makes an invite, B pastes it, they match the safety words, DM (send, reply, react), A shares a project,
// B accepts from the inbox, opens it as a board and raises a card, A sees it. Also: no raw translation keys, no console errors,
// and one look at phone width. QA_SHOTS=<folder> saves a screenshot at each step.
import path from 'node:path';
import fs from 'node:fs';
import { freePort, startRelay, until, check, startServer, openPage, noErrors, mkProject, mkCard, def, tbClick } from '../lib.mjs';

def('friendpath', 'the friend path in the page: invite, join, match words, DM send / reply / react, share a project, accept, raise a card, A sees it; no raw keys, no errors, phone width (AIG-1182)', async (s, ctx) => {
  const relay = await startRelay();
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const shots = process.env.QA_SHOTS;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const shot = async (pg, name) => { if (shots) await pg.screenshot({ path: path.join(shots, name + '.png') }).catch(() => {}); };
  // A raw key looks like dms.act.react or share.role.x: dotted lowercase words with no spaces.
  const rawKeys = async pg => pg.evaluate(() => (document.body.innerText.match(/\b[a-z][a-zA-Z]+(?:\.[a-zA-Z][a-zA-Z0-9]*){1,4}\b/g) || []).filter(k => /^(dms|share|setup|inbox|board|card|nav|common|dm|sb|friends)\./.test(k)));
  const seen = [];
  const keys = async (pg, where) => { const k = await rawKeys(pg); if (k.length) seen.push(where + ': ' + [...new Set(k)].join(',')); };
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { relay: relay.base });
    await mkProject(s, 'Alpha', 'ALP'); await mkProject(b, 'Bravo', 'BRA');
    await mkCard(s, 'alpha', 'First card');

    // A: switch DMs on, make the invite.
    const pa = await openPage(ctx, '#/setup');
    await pa.waitForSelector('#dmfOn');
    await pa.check('#dmfOn');
    await until(async () => (await s.ok('GET', '/api/dms')).on);
    await pa.fill('#dmfInvName', 'Beatrix');
    await pa.click('#dmfInvite');
    await pa.waitForSelector('#dmfMade');
    const code = await pa.inputValue('#dmfMade');
    check('A: the invite shows a code', code.length > 40);
    await shot(pa, '01-A-invite'); await keys(pa, 'A invite');

    // B: join with it.
    const pb = await ctx.newPage(); pb.errors = [];
    pb.on('pageerror', e => pb.errors.push('pageerror: ' + e.message));
    pb.on('console', m => { if (m.type() === 'error') pb.errors.push('console: ' + m.text()); });
    await pb.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); localStorage.setItem('aigile.lang', 'en'); } catch {} });
    await pb.goto(b.base + '/#/setup');
    await pb.waitForSelector('#dmfOn');
    await pb.check('#dmfOn'); await until(async () => (await b.ok('GET', '/api/dms')).on);
    await pb.fill('#dmfCode', code); await pb.fill('#dmfName', 'Alberto'); await pb.click('#dmfAdd');
    await pb.waitForSelector('#dmfBody .dmf-c');
    check('B: the friend is listed after pasting the code', /Alberto/.test(await pb.textContent('.dmf-c')));
    await shot(pb, '02-B-joined'); await keys(pb, 'B joined');
    await until(async () => (await s.ok('GET', '/api/dms/contacts')).length === 1);
    await pa.reload(); await pa.waitForSelector('#dmfBody .dmf-c');
    const wa = (await pa.textContent('#dmfBody .dmf-words')).trim(), wb = (await pb.textContent('#dmfBody .dmf-words')).trim();
    check('A and B show the same six safety words', wa === wb && wa.split(/\s+/).length === 6, [wa, wb]);
    await pa.click('#dmfBody .dmf-c [data-act="match"]');
    await pb.click('#dmfBody .dmf-c [data-act="match"]');
    await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0].checked && (await b.ok('GET', '/api/dms/contacts'))[0].checked);
    check('both tick "They match"', true);
    await shot(pa, '03-A-matched');
    const ca = (await b.ok('GET', '/api/dms/contacts'))[0], cb = (await s.ok('GET', '/api/dms/contacts'))[0];

    // DM: A writes, B replies, A reacts.
    await pa.goto(s.base + '/#/'); await pa.waitForSelector('#dmRail [data-dms]');
    await pa.click('#dmRail [data-dms]');
    await pa.waitForSelector(`#dmPanel [data-dm="dm:${cb.id}"]`);
    await pa.click(`#dmPanel [data-dm="dm:${cb.id}"]`);
    await pa.fill('#dmText', 'Hello Alberto!'); await pa.press('#dmText', 'Enter');
    await pa.waitForSelector('#dmList .dm-msg.mine');
    check('A sends a DM and sees it', /Hello Alberto/.test(await pa.textContent('#dmList .dm-msg.mine')));
    await pb.goto(b.base + '/#/'); await pb.waitForSelector('#dmRail [data-dms]');
    await pb.click('#dmRail [data-dms]');
    await pb.waitForSelector(`#dmPanel [data-dm="dm:${ca.id}"]`);
    check('B gets an unread badge on the DM', (await pb.textContent(`#dmPanel [data-dm="dm:${ca.id}"] .dm-unread`).catch(() => '')).trim() === '1');
    await pb.click(`#dmPanel [data-dm="dm:${ca.id}"]`);
    await pb.waitForSelector('#dmList .dm-msg:not(.mine)');
    check('B sees the message on the left', /Hello Alberto/.test(await pb.textContent('#dmList .dm-msg:not(.mine)')));
    await pb.fill('#dmText', 'Hi Beatrix, got it'); await pb.press('#dmText', 'Enter');
    await pb.waitForSelector('#dmList .dm-msg.mine');
    await shot(pb, '04-B-dm');
    await pa.waitForFunction(() => /got it/.test(document.getElementById('dmList').textContent), null, { timeout: 8000 });
    check('A sees B\'s reply', true);
    const line = pa.locator('#dmList .dm-msg:not(.mine)').last();
    await line.hover();
    const reactBtn = line.locator('[data-dmact="react"]');
    check('A: the 😊 react button exists on a friend\'s line', await reactBtn.count() === 1);
    await reactBtn.click({ force: true });
    await pa.waitForSelector('.dm-picker [data-dmpick="❤️"]');
    await pa.click('.dm-picker [data-dmpick="❤️"]');
    await pa.waitForSelector('#dmList .dm-react');
    check('A: the reaction shows as a chip', /❤️/.test(await pa.textContent('#dmList .dm-react')));
    check('B sees the reaction', !!(await pb.waitForFunction(() => /❤️/.test(document.getElementById('dmList').textContent), null, { timeout: 8000 }).catch(() => null)));
    await shot(pa, '05-A-reacted'); await keys(pa, 'A dm'); await keys(pb, 'B dm');
    await pa.evaluate(() => Dms.close()).catch(() => {}); await pb.evaluate(() => Dms.close()).catch(() => {});

    // Share: A offers Alpha, B accepts from the inbox.
    await pa.goto(s.base + '/#/p/alpha');
    await tbClick(pa, '#shareBtn');
    await pa.waitForSelector('#dialog #shareSend');
    await shot(pa, '06-A-share-dialog'); await keys(pa, 'A share dialog');
    check('A: Send is enabled (words already checked)', !(await pa.isDisabled('#shareSend')));
    await pa.click('#shareSend');
    await pa.waitForFunction(() => /Offer sent/.test(document.querySelector('#dialog').textContent), null, { timeout: 6000 }).catch(() => {});
    check('A: "Offer sent" shows', /Offer sent/.test(await pa.textContent('#dialog')));
    await pa.click('#dialog button[onclick="closeDialog()"]');
    await pb.goto(b.base + '/#/inbox');
    await pb.waitForSelector('.share-offer [data-share-yes]:not([disabled])', { timeout: 12000 });
    check('B: the offer names the project and the friend', /Alpha/.test(await pb.textContent('.share-offer')), await pb.textContent('.share-offer'));
    await shot(pb, '07-B-offer'); await keys(pb, 'B inbox offer');
    await pb.selectOption('.share-offer [data-share-into]', 'bravo');
    await pb.click('.share-offer [data-share-yes]');
    await until(async () => (await s.ok('GET', '/api/shares?slug=alpha')).find(l => l.state === 'live'));
    check('the link is live on A\'s side', true);

    // B opens it as a board and raises a card.
    const link = (await b.ok('GET', '/api/shares'))[0];
    await pb.goto(b.base + '/#/p/bravo');
    await pb.waitForSelector('#shareOpenBoard', { timeout: 10000 });
    await pb.click('#shareOpenBoard');
    await pb.waitForSelector('.sb-board', { timeout: 10000 });
    await shot(pb, '08-B-shared-board'); await keys(pb, 'B shared board');
    const raise = await pb.$$eval('[data-sb-raise]', xs => xs.map(x => x.dataset.sbRaise));
    check('B can raise something', raise.length > 0, raise);
    await pb.click(`[data-sb-raise="${raise.includes('bug') ? 'bug' : raise[0]}"]`);
    await pb.fill('#sbTitle', 'Friend found a snag');
    await shot(pb, '09-B-raise-dialog'); await keys(pb, 'B raise');
    await pb.click('#sbRaiseSend');
    const got = await until(async () => (await s.ok('GET', `/api/shares/${link.id}/inbound`)).cards.find(c => c.title === 'Friend found a snag'));
    check('A receives the raised card', !!got, link);

    // A sees it on the page (inbox or board).
    await pa.goto(s.base + '/#/p/alpha');
    await pa.waitForFunction(() => /Friend found a snag/.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
    check('A sees the card on the Alpha board', /Friend found a snag/.test(await pa.evaluate(() => document.body.innerText)));
    await shot(pa, '10-A-sees-card'); await keys(pa, 'A board');

    // Phone width, once, on B's shared board and A's DMs.
    await pa.setViewportSize({ width: 390, height: 800 });
    await pa.goto(s.base + '/#/p/alpha'); await pa.waitForSelector('#app > *');
    await shot(pa, '11-A-phone-board');
    const over = await pa.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('phone width 390: no sideways page scroll on the board', over <= 2, over);
    await pa.goto(s.base + '/#/setup'); await pa.waitForSelector('#dmfBody'); await pa.waitForTimeout(500);
    const over2 = await pa.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await shot(pa, '12-A-phone-setup');
    check('phone width 390: no sideways page scroll on Setup', over2 <= 2, over2);
    await keys(pa, 'A phone');

    check('no raw translation keys on any step', seen.length === 0, seen);
    noErrors(pa);
    check('no page errors on board B', pb.errors.length === 0, pb.errors);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
