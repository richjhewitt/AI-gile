// QA area: errors (AIG-1194): when things go wrong the page says plainly what is wrong: relay down (DM send, invite, shared board),
// the board itself unreachable (calm "can't reach AI-gile, retrying", then recovers), calls not set up, a failing save. No raw
// "Error:", stack text, JSON or status codes in what the person sees.
import path from 'node:path';
import fs from 'node:fs';
import { freePort, startRelay, startServer, until, check, sleep, mkProject, mkCard, def, openPage } from '../lib.mjs';
import { pair } from './share.mjs';

const RAW = /\bError:|\bat \S+ \(|\bat async\b|TypeError|ECONN|ENOTFOUND|fetch failed|Failed to fetch|NetworkError|Unexpected token|is not valid JSON|\{"|"error"|\b(?:500|502|503|504)\b|relay said|undefined|\[object|AbortError|TimeoutError|timed out|SyntaxError|Internal Server/;

def('errors', 'when things go wrong every screen says plainly what: relay down (DM send, invite, shared board), board unreachable then back, calls not set up, a failing save; nothing raw (AIG-1194)', async (s, ctx) => {
  const shots = process.env.QA_SHOTS;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const shot = (pg, name) => shots ? pg.screenshot({ path: path.join(shots, name + '.png') }).catch(() => {}) : null;
  const see = process.env.QA_SEE ? (what, v) => console.log('SEE ' + what + ': ' + JSON.stringify(v)) : () => {};
  const relay = await startRelay();
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const watch = pg => { pg.seen = []; pg.on('dialog', d => { pg.seen.push('dialog: ' + d.message()); d.accept().catch(() => {}); }); };
  const body = pg => pg.evaluate(() => document.body.innerText);
  try {
    const { ca, cb } = await pair(s, b, relay);
    await s.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { checked: true });
    await mkProject(s, 'Alpha', 'ALP'); await mkProject(b, 'Bravo', 'BRA');
    const c1 = await mkCard(s, 'alpha', 'First card');
    await mkCard(s, 'alpha', 'Shared one');
    const off = await s.ok('POST', '/api/shares', { slug: 'alpha', contact: cb.id });
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === off.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${off.id}/accept`, { slug: 'bravo' });
    await until(async () => (await s.ok('GET', '/api/shares?slug=alpha')).find(l => l.state === 'live'));
    await s.ok('POST', `/api/shares/${off.id}/cards`, { card: c1.id });

    // The friend's shared board is open on B, then the relay goes away.
    const pb = await ctx.newPage(); pb.errors = []; watch(pb);
    pb.on('pageerror', e => pb.errors.push('pageerror: ' + e.message));
    await pb.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); localStorage.setItem('aigile.lang', 'en'); } catch {} });
    await pb.goto(b.base + '/#/p/bravo');
    await pb.waitForSelector('#shareOpenBoard', { timeout: 10000 });
    await pb.click('#shareOpenBoard');
    await pb.waitForSelector('.sb-board', { timeout: 10000 });
    const pa = await openPage(ctx, '#/'); watch(pa);
    await pa.waitForSelector('#dmRail [data-dms]');
    await pa.click('#dmRail [data-dms]');
    await pa.waitForSelector(`#dmPanel [data-dm="dm:${cb.id}"]`);
    await pa.click(`#dmPanel [data-dm="dm:${cb.id}"]`);
    relay.stop(); await sleep(500);

    // 1. DM send with the relay down.
    await pa.fill('#dmText', 'Anyone there?'); await pa.press('#dmText', 'Enter');
    await sleep(1500);
    const dmTxt = await body(pa); see('dm', [dmTxt.slice(-600), pa.seen]);
    await shot(pa, 'errors-1-dm-relay-down');
    check('relay down: sending a DM shows nothing raw', !RAW.test(dmTxt.replace(/Anyone there\?/g, '')) && !pa.seen.some(x => RAW.test(x)), [dmTxt.slice(-300), pa.seen]);
    // 2. Invite with the relay down.
    const pi = await ctx.newPage(); pi.errors = []; watch(pi);
    await pi.goto(s.base + '/#/setup'); await pi.waitForSelector('#dmfInvite');
    await pi.fill('#dmfInvName', 'Cleo'); await pi.click('#dmfInvite'); await sleep(1500);
    const invTxt = await pi.evaluate(() => document.getElementById('dmfBody').innerText); see('invite', [invTxt, pi.seen]);
    check('relay down: making an invite shows nothing raw', !RAW.test(invTxt) && !pi.seen.some(x => RAW.test(x)), [invTxt, pi.seen]);
    // 2b. Setup's relay check against a dead address: a plain sentence, the technical reason only in the small details line (AIG-1197).
    await pi.fill('#dmsRelay', 'http://127.0.0.1:1'); await pi.click('#dmsRelayCheck');
    await pi.waitForFunction(() => /❌/.test(document.getElementById('dmsRelay-msg').textContent), null, { timeout: 15000 });
    const rc = await pi.evaluate(() => { const m = document.getElementById('dmsRelay-msg'), d = m.querySelector('small'); return { main: [...m.childNodes].filter(n => n !== d).map(n => n.textContent).join(''), det: d ? d.textContent : '' }; });
    see('relaycheck', rc); await shot(pi, 'errors-2b-relay-check');
    check('relay check: a plain sentence, no raw codes outside the details line', /Can't reach the relay at that address/.test(rc.main) && !RAW.test(rc.main) && !/could not reach/.test(rc.main), rc);
    check('relay check: the technical reason is kept in a small details line', /^Details: /.test(rc.det), rc);
    // 3. Shared board with the relay down: a raise.
    await pb.click('[data-sb-raise]'); await pb.fill('#sbTitle', 'Snag'); await pb.click('#sbRaiseSend'); await sleep(1500);
    const sbTxt = await body(pb); see('sharedboard', [sbTxt.slice(-500), pb.seen]);
    await shot(pb, 'errors-2-shared-board-relay-down');
    check('relay down: raising on a shared board shows nothing raw', !RAW.test(sbTxt.replace(/Snag/g, '')) && !pb.seen.some(x => RAW.test(x)), [sbTxt.slice(-300), pb.seen]);

    // 4. Calls not set up (Join call from a DM).
    await pa.reload(); await pa.waitForSelector('#dmRail [data-dms]');
    await pa.click('#dmRail [data-dms]'); await pa.click(`#dmPanel [data-dm="dm:${cb.id}"]`);
    see('callbtns', await pa.$$eval('#dmPanel button', xs => xs.map(x => (x.id || x.className || '') + '|' + x.title)));
    const callBtn = pa.locator('#dmPanel [data-dmact="call"], #dmPanel .dm-call, #dmPanel button[title*="all"]').first();
    if (await callBtn.count()) { await callBtn.click(); await sleep(800); const t = await body(pa); see('call', t.slice(-400)); check('calls not set up: plain words, nothing raw', !RAW.test(t) && /Setup|set up/i.test(t), t.slice(-300)); await shot(pa, 'errors-3-calls-not-set-up'); }
    else check('the call button exists in the DM', false);

    // 5. A failing route (500) during a card save.
    const pc = await openPage(ctx, '#/p/alpha/' + c1.id); watch(pc);
    await sleep(800);
    await pc.route('**/api/projects/alpha/cards/' + c1.id, r => r.request().method() === 'PATCH' ? r.fulfill({ status: 500, contentType: 'text/html', body: '<html><body>Internal Server Error at Object.handler (server.js:1:1)</body></html>' }) : r.continue());
    await pc.evaluate(() => api('PATCH', `/api/projects/alpha/cards/${state.route.card}`, { title: 'x' }).catch(e => alert(e.message)));
    await sleep(300);
    await pc.unroute('**/api/projects/alpha/cards/' + c1.id);
    await pc.route('**/api/projects/alpha/cards/' + c1.id, r => r.request().method() === 'PATCH' ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'TypeError: Cannot read properties of undefined (reading \'x\') at save (/srv/app/lib/store.js:10:3)' }) }) : r.continue());
    await pc.evaluate(() => api('PATCH', `/api/projects/alpha/cards/${state.route.card}`, { title: 'y' }).catch(e => alert(e.message)));
    await sleep(300);
    see('save500', pc.seen);
    check('a failing save (500) says plainly it did not work, nothing raw', pc.seen.length === 2 && pc.seen.every(x => /Something went wrong inside AI-gile/.test(x) && !RAW.test(x.replace('Something went wrong inside AI-gile', ''))), pc.seen);

    // 6. The board itself goes away while the page is open, then comes back.
    const data = b.data, port = Number(new URL(b.base).port);
    await pb.goto(b.base + '/#/p/bravo'); await pb.waitForSelector('#app > *'); await sleep(500);
    b.stop(); await sleep(6000);
    const offTxt = await body(pb); see('boardoff', [offTxt.slice(0, 600), pb.seen]); await shot(pb, 'errors-4-board-offline');
    check('board off: the page says plainly it cannot reach AI-gile', /can.?t reach AI-gile/i.test(offTxt) && !RAW.test(offTxt), offTxt.slice(0, 300));
    const b2 = await startServer({ AIGILE_DM_POLL_MS: '300', AIGILE_DATA: data }, port);
    try {
      check('board back: the page recovers by itself', !!(await until(async () => !/can.?t reach AI-gile/i.test(await body(pb)) && (await pb.$('.sb-board, #shareOpenBoard, .board')), 20000)), (await body(pb)).slice(0, 300));
    } finally { b2.stop(); }
    check('no page errors', pa.errors.length === 0, pa.errors);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
