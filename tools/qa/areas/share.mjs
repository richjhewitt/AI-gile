// QA area: share (AIG-304): two boards on temp data and a local relay. Link offer and accept, the checked safety
// code, replays and old seq, the per-project 🔗 switch, unlink and unlink-and-forget, block, size caps; the 🔗 dialog
// and the inbox offer on the page.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, BASE, freePort, check, sleep, tmp, startServer, mkProject, openPage, noErrors, def } from '../lib.mjs';
import { shareCards } from './share-cards.mjs';
import { shareMore } from './share-more.mjs';
import { shareRoles } from './share-roles.mjs';

export async function startRelay(port) {
  const data = tmp('relay');
  const proc = spawn(process.execPath, [path.join(ROOT, 'relay', 'relay.js')], { env: { ...process.env, RELAY_PORT: String(port), RELAY_DATA: data, RELAY_RATE: '100000' }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(100); }
  return { base, data, stop: () => { try { proc.kill(); } catch {} } };
}
export const until = async (fn, ms = 8000) => { const end = Date.now() + ms; let v; while (!(v = await fn()) && Date.now() < end) await sleep(100); return v; };
const filesUnder = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const envFiles = (relay, box) => filesUnder(path.join(relay.data, box)).filter(f => !f.endsWith('owner.json'));
// The envelope as it waits on the relay (to drop it in again later, like a relay replaying old mail).
const envOf = f => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j.env || j; };
const drop = (relay, box, env) => fetch(relay.base + '/m/' + box, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(env) });

// Two boards that are DM contacts. a = the QA server, b = a second board.
export async function pair(a, b, relay) {
  await a.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
  await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
  const inv = await a.ok('POST', '/api/dms/invites', { name: 'Beatrix' });
  const ca = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });   // B's contact for A
  const cb = await until(async () => (await a.ok('GET', '/api/dms/contacts'))[0]);      // A's contact for B
  return { ca, cb, boxA: (await a.ok('GET', '/api/dms')).mailbox, boxB: (await b.ok('GET', '/api/dms')).mailbox };
}

def('share', 'sharing a project with a friend: offer / accept over the DMs, needs a checked safety code, replays and old seq dropped, the 🔗 switch drops while off, unlink and forget, block ends links (AIG-304)', async (s, ctx) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const a = s;
  try {
    const { ca, cb, boxA, boxB } = await pair(a, b, relay);
    check('the two boards are contacts', ca && cb && ca.safety === cb.safety, [ca, cb]);
    await mkProject(a, 'Alpha', 'ALP'); await mkProject(b, 'Bravo', 'BRA');
    const sh = (x, q = '') => x.ok('GET', '/api/shares' + q);

    // Offer: refused until the safety code is checked.
    const unchecked = await a.api('POST', '/api/shares', { slug: 'alpha', contact: cb.id });
    check('offer refused while the safety code is unchecked', unchecked.status === 409 && /safety code/.test(unchecked.body.error), unchecked);
    check('offer needs a real project', (await a.api('POST', '/api/shares', { slug: 'nope', contact: cb.id })).status === 404);
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('POST', '/api/dms/settings', { on: false });   // hold B's mail on the relay to look at it
    const off = await a.ok('POST', '/api/shares', { slug: 'alpha', contact: cb.id, allow: { status: true } });
    check('offer sent: state offered, 2 days to accept', off.state === 'offered' && off.slug === 'alpha' && new Date(off.exp) - Date.now() > 47 * 3600e3, off);
    check('one link per project', (await a.api('POST', '/api/shares', { slug: 'alpha', contact: cb.id })).status === 409);
    const offerFile = await until(() => envFiles(relay, boxB)[0]);
    const offerEnv = envOf(offerFile);
    const relayText = filesUnder(relay.data).map(f => fs.readFileSync(f, 'utf8')).join('\n');
    check('the relay sees no project name, link id or kind', !['Alpha', off.id, 'link-offer', 'share'].some(x => relayText.includes(x)));
    check('A keeps the link in data/shares/<link>.json', fs.existsSync(path.join(a.data, 'shares', off.id + '.json')));
    await b.ok('POST', '/api/dms/settings', { on: true });

    // B gets the offer in its inbox; accepting needs B's own check too.
    const inc = await until(async () => (await sh(b)).find(l => l.state === 'incoming'));
    check('B holds the offer: their project name and allowances', inc && inc.id === off.id && inc.theirName === 'Alpha' && inc.theirs.status === true && inc.friend === 'Alberto', inc);
    check('an offer is not a chat message', (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).length === 0);
    const noCheck = await b.api('POST', `/api/shares/${inc.id}/accept`, { slug: 'bravo' });
    check('accept refused while B has not checked the safety code', noCheck.status === 409 && /safety code/.test(noCheck.body.error), noCheck);
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { checked: true });
    check('accept needs one of B\'s projects', (await b.api('POST', `/api/shares/${inc.id}/accept`, { slug: 'nope' })).status === 400);
    const acc = await b.ok('POST', `/api/shares/${inc.id}/accept`, { slug: 'bravo', allow: { take: false, status: true } });
    check('B accepts into Bravo: live', acc.state === 'live' && acc.slug === 'bravo' && acc.mine.take === false, acc);
    const liveA = await until(async () => (await sh(a)).find(l => l.id === off.id && l.state === 'live'));
    check('A sees it live, with B\'s project name', liveA && liveA.theirName === 'Bravo', liveA);
    check('what crosses is what both allow', liveA && liveA.effective.sendCards === false && liveA.effective.takeCards === true && liveA.effective.status === true && liveA.effective.files === false, liveA && liveA.effective);
    check('?slug= filters to the project', (await sh(a, '?slug=alpha')).length === 1 && (await sh(a, '?slug=other')).length === 0);

    // Replays: the old offer again, and an old ping again (seq at or below the last seen).
    await drop(relay, boxB, offerEnv);
    await sleep(1200);
    const bl = await sh(b);
    check('a replayed offer is dropped (no second link, still live)', bl.length === 1 && bl[0].state === 'live', bl);
    await b.ok('POST', '/api/dms/settings', { on: false });
    await a.ok('POST', `/api/shares/${off.id}/ping`);
    const pingEnv = envOf(await until(() => envFiles(relay, boxB)[0]));
    await b.ok('POST', '/api/dms/settings', { on: true });
    const heard = await until(async () => (await sh(a)).find(l => l.id === off.id && l.lastHeard && l.lastHeard > liveA.lastHeard));
    check('👋 check the link: B answers, A hears back', !!heard, heard);
    await drop(relay, boxB, pingEnv);
    const stale = await until(async () => (await sh(b))[0].stale >= 1);
    check('a replayed ping (old seq) is dropped and counted', !!stale, (await sh(b))[0]);
    check('no chat lines from any of it', (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).length === 0 && (await a.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).length === 0);

    // The 🔗 switch on B: off drops what arrives (counted), sends nothing; on again does not replay.
    const swOff = await b.ok('PATCH', `/api/shares/${off.id}`, { on: false });
    check('switch off', swOff.on === false);
    check('switch off: B cannot send on the link', (await b.api('POST', `/api/shares/${off.id}/ping`)).status === 409);
    const before = (await sh(a))[0].lastHeard;
    await a.ok('POST', `/api/shares/${off.id}/ping`); await a.ok('POST', `/api/shares/${off.id}/ping`);
    const dropped = await until(async () => (await sh(b))[0].droppedOff === 2);
    check('switch off: B drops both pings and counts them', !!dropped, (await sh(b))[0]);
    await sleep(800);
    check('switch off: A hears nothing back', (await sh(a))[0].lastHeard === before);
    const swOn = await b.ok('PATCH', `/api/shares/${off.id}`, { on: true });
    await sleep(800);
    check('on again: nothing replayed, the count stays', swOn.on && (await sh(b))[0].droppedOff === 2 && (await sh(a))[0].lastHeard === before);
    await a.ok('POST', `/api/shares/${off.id}/ping`);
    check('on again: new pings get through', !!(await until(async () => (await sh(a))[0].lastHeard > before)));

    // Unlink: A ends it, B is told; nothing more goes across.
    const un = await a.ok('POST', `/api/shares/${off.id}/unlink`, {});
    check('A unlinks', un.state === 'ended' && un.endedBy === 'me', un);
    const endB = await until(async () => (await sh(b)).find(l => l.state === 'ended'));
    check('B is told: ended by them', endB && endB.endedBy === 'them', endB);
    check('no pings on an ended link', (await a.api('POST', `/api/shares/${off.id}/ping`)).status === 409 && (await b.api('POST', `/api/shares/${off.id}/ping`)).status === 409);
    check('A\'s file stays (ending never deletes)', fs.existsSync(path.join(a.data, 'shares', off.id + '.json')));

    // Unlink and forget on B: their cards and comments go, B's own stay.
    const pf = path.join(b.data, 'bravo.json'), pj = JSON.parse(fs.readFileSync(pf, 'utf8'));
    const at = new Date().toISOString(), base = { type: 'feature', priority: 'normal', status: 'backlog', created: at, updated: at, description: '', testSteps: '' };
    pj.cards.push({ ...base, id: 'BRA-1', title: 'Mine', comments: [{ author: 'Owner', text: 'my note', at }, { author: 'Alberto (via 🔗)', text: 'their note', at, from: 'share:' + off.id }] });
    pj.cards.push({ ...base, id: 'BRA-2', title: 'From Alberto', from: 'share:' + off.id, comments: [] });
    pj.nextId = 3; fs.writeFileSync(pf, JSON.stringify(pj));
    const fg = await b.ok('POST', `/api/shares/${off.id}/unlink`, { forget: true });
    const pb = await b.ok('GET', '/api/projects/bravo');
    check('unlink and forget: their card and comment are gone, mine stay', fg.forgotten && pb.cards.length === 1 && pb.cards[0].id === 'BRA-1' && pb.cards[0].comments.length === 1 && pb.cards[0].comments[0].text === 'my note', pb.cards);

    // A new offer, declined; then a third, accepted, ended by a block.
    const o2 = await a.ok('POST', '/api/shares', { slug: 'alpha', contact: cb.id });
    const i2 = await until(async () => (await sh(b)).find(l => l.id === o2.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${i2.id}/decline`);
    check('✋ No: A sees it declined', !!(await until(async () => (await sh(a)).find(l => l.id === o2.id && l.state === 'ended' && l.endedBy === 'declined'))));
    const o3 = await a.ok('POST', '/api/shares', { slug: 'alpha', contact: cb.id });
    const i3 = await until(async () => (await sh(b)).find(l => l.id === o3.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${i3.id}/accept`, { slug: 'bravo' });
    await until(async () => (await sh(a)).find(l => l.id === o3.id && l.state === 'live'));
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { blocked: true });
    check('blocking the person ends every link with them', (await sh(b)).find(l => l.id === o3.id).endedBy === 'blocked');
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { blocked: false });

    // The wire rules themselves (lib/share.js receive), on a scratch data folder: sizes, ages, kinds, seq.
    const r = spawnSync(process.execPath, ['-e', `
      const share = require(${JSON.stringify(path.join(ROOT, 'lib', 'share.js'))});
      const c = { id: 'aaaaaaaaaaaa', checked: true }, link = 'L'.repeat(22), exp = Date.now() + 3600e3, env = { ts: Date.now() };
      const o = (p, e = env) => share.receive(c, e, { t: 'share', link, ...p });
      console.log(JSON.stringify([
        o({ seq: 1, kind: 'link-offer', name: 'x'.repeat(81), exp, allow: {} }),
        o({ seq: 1, kind: 'link-offer', name: 'Ok', exp }, { ts: Date.now() - 9 * 864e5 }),
        o({ seq: 1, kind: 'link-offer', name: 'Ok', exp: Date.now() + 30 * 864e5 }),
        o({ seq: 1, kind: 'run-command', name: 'Ok', exp }),
        o({ seq: 0, kind: 'link-offer', name: 'Ok', exp }),
        o({ seq: 1, kind: 'link-offer', name: 'Ok', exp, pad: 'x'.repeat(70000) }),
        o({ seq: 1, kind: 'link-offer', name: 'Ok', exp }),
        o({ seq: 1, kind: 'link-offer', name: 'Ok', exp }),
        o({ seq: 1, kind: 'link-end' }),
        share.receive({ id: 'bbbbbbbbbbbb' }, env, { t: 'share', link, seq: 5, kind: 'link-end' }),
        o({ seq: 2, kind: 'card', share: 'abcdefgh', title: 'x'.repeat(201) }),
        o({ seq: 3, kind: 'comment', share: 'abcdefgh', text: 'x'.repeat(20001) }),
      ]));`], { env: { ...process.env, AIGILE_DATA: tmp('sharewire') }, encoding: 'utf8' });
    const got = JSON.parse(r.stdout || '[]');
    const want = ['dropped', 'dropped', 'dropped', 'dropped', 'dropped', 'dropped', 'share-offer', 'dropped', 'replay', 'dropped', 'dropped', 'dropped'];
    check('wire rules: long name, 9-day-old envelope, far expiry, unknown kind, seq 0, over 64 KB dropped; one offer per link id; seq at or below last seen is a replay; only the link\'s person; title over 200 and comment over 20,000 dropped', JSON.stringify(got) === JSON.stringify(want), [got, r.stderr]);

    // The page: 🔗 dialog on the board (safety code check, offer), and an offer in the inbox (✅ / ✋).
    await mkProject(a, 'Delta', 'DEL');
    await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: false });
    const page = await openPage(ctx, '#/p/delta');
    await page.waitForSelector('#shareBtn');
    check('the board has 🔗 Share with...', /Share with/.test(await page.textContent('#shareBtn')));
    await page.click('#shareBtn');
    await page.waitForSelector('#dialog .share-safety');
    check('dialog: an unchecked contact shows the 6 words, Send is off', (await page.textContent('#dialog .share-words')).trim() === cb.safety && await page.isDisabled('#shareSend'));
    await page.click('#dialog .share-safety button');
    await page.waitForFunction(() => { const b = document.querySelector('#shareSend'); return b && !b.disabled; }, null, { timeout: 5000 }).catch(() => {});
    check('dialog: after ✅ they match, Send works', !(await page.isDisabled('#shareSend')) && (await a.ok('GET', '/api/dms/contacts'))[0].checked === true);
    await page.click('#shareSend');
    await page.waitForFunction(() => /Offer sent/.test(document.querySelector('#dialog').textContent), null, { timeout: 5000 }).catch(() => {});
    const od = (await sh(a, '?slug=delta'))[0];
    check('dialog: the offer is sent', od && od.state === 'offered' && /Offer sent/.test(await page.textContent('#dialog')), od);
    await page.click('#dialog button[onclick="closeDialog()"]');
    const i4 = await until(async () => (await sh(b)).find(l => l.id === od.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${i4.id}/accept`, { slug: 'bravo' });
    await until(async () => (await sh(a)).find(l => l.id === od.id && l.state === 'live'));
    await page.waitForFunction(() => /Linked: Beatrix/.test(document.querySelector('#shareBtn').textContent), null, { timeout: 6000 }).catch(() => {});
    check('the button shows the link', /Linked: Beatrix/.test(await page.textContent('#shareBtn')));
    await page.click('#shareBtn');
    await page.waitForSelector('#shareOn');
    await page.uncheck('#shareOn');
    await until(async () => (await sh(a, '?slug=delta'))[0].on === false);
    check('dialog: the switch turns the link off', (await sh(a, '?slug=delta'))[0].on === false);
    await page.click('#dialog button[onclick="closeDialog()"]');

    await mkProject(b, 'Charlie', 'CHA');
    await b.ok('POST', '/api/shares', { slug: 'charlie', contact: ca.id });
    await mkProject(a, 'Echo', 'ECH');
    await page.goto(BASE + '/#/inbox');
    await page.waitForSelector('.share-offer [data-share-yes]', { timeout: 10000 }).catch(() => {});
    check('the inbox shows the offer with ✅ / ✋', await page.locator('.share-offer').count() === 1 && /Charlie/.test(await page.textContent('.share-offer')));
    check('the link offer is counted: top bar badge and rail 📥 (AIG-382)', /1/.test(await page.textContent('.ib-btn .ib-badge[data-friends]').catch(() => '')) && (await page.textContent('#dmRail [data-go="#/inbox"] .dm-unread').catch(() => '')).trim() === '1', await page.textContent('#inboxTop'));
    check('only projects without a link to pick from', !(await page.$$eval('.share-offer [data-share-into] option', os => os.map(o => o.value))).includes('delta'));
    await page.selectOption('.share-offer [data-share-into]', 'echo');
    await page.click('.share-offer [data-share-yes]');
    const le = await until(async () => (await sh(a, '?slug=echo'))[0]);
    check('✅ links it to the picked project', le && le.state === 'live' && le.theirName === 'Charlie', le);
    await page.waitForFunction(() => !document.querySelector('.share-offer'), null, { timeout: 5000 }).catch(() => {});
    check('and the offer leaves the inbox', await page.locator('.share-offer').count() === 0);
    await page.waitForFunction(() => !document.querySelector('.ib-badge[data-friends]'), null, { timeout: 5000 }).catch(() => {});
    check('and the badge goes with it', await page.locator('.ib-badge[data-friends]').count() === 0);
    noErrors(page);
    await page.close();

    // Shared cards and comments (AIG-305): tools/qa/areas/share-cards.mjs.
    await shareCards({ a, b, ca, cb, relay, ctx, until, filesUnder });
    // The team fence, status labels, tests and verdicts, attachments (AIG-306): tools/qa/areas/share-more.mjs.
    await shareMore({ a, b, ca, cb, relay, ctx, until, filesUnder });
    // Roles on links, owner-only /api/shares, the per-role allow/deny table (AIG-307): tools/qa/areas/share-roles.mjs.
    await shareRoles({ a, b, ca, cb, relay, ctx, until, filesUnder });
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
