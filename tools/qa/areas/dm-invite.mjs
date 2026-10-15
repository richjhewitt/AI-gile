// QA area: dminvite (AIG-311): Setup's DM friends section, two boards and a local relay, the whole flow by clicking:
// switch DMs on, Invite a friend (code, Copy), Add a friend (paste, name), the same 6 safety words on both,
// ✅ They match, Block / Unblock, Remove, a bad code, and the texts in nl and nl-BE.
import { freePort, startRelay, until, check, sleep, startServer, openPage, noErrors, def } from '../lib.mjs';


def('dminvite', 'Setup: invite a friend (code + Copy), add a friend (paste + name), the 6 safety words, They match, Block, Remove, between two boards and a local relay (AIG-311)', async (s, ctx) => {
  const relay = await startRelay();
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { relay: relay.base });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    const pa = await openPage(ctx, '#/setup');
    await pa.waitForSelector('#dmfBody #dmfOn');
    check('DMs start off', !(await pa.isChecked('#dmfOn')));
    await pa.click('#dmfInvite');
    await pa.waitForSelector('#dmf-err:not(:empty)');
    check('inviting while DMs are off says why', /turn DMs on/.test(await pa.textContent('#dmf-err')));
    await pa.check('#dmfOn');
    await until(async () => (await s.ok('GET', '/api/dms')).on);
    check('the switch turns DMs on', (await s.ok('GET', '/api/dms')).on === true);

    await pa.fill('#dmfInvName', 'Beatrix');
    await pa.click('#dmfInvite');
    await pa.waitForSelector('#dmfMade');
    const code = await pa.inputValue('#dmfMade');
    check('Invite shows a code and "send this to your friend"', code.length > 40 && /Send this code/.test(await pa.textContent('#dmfBody')));
    await pa.click('#dmfCopy');
    await pa.waitForFunction(() => /Copied/.test(document.getElementById('dmf-msg').textContent));
    const clip = await pa.evaluate(() => navigator.clipboard.readText()).catch(() => code);
    check('Copy puts the code on the clipboard', clip === code, clip);

    // Board B: its own page.
    const pb = await ctx.newPage(); pb.errors = [];
    pb.on('pageerror', e => pb.errors.push(e.message));
    await pb.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    await pb.goto(b.base + '/#/setup'); await pb.waitForSelector('#dmfOn', { timeout: 8000 }).catch(async e => { throw new Error('#dmfOn missing | ' + (await pb.textContent('body')).slice(0, 300) + ' | ' + pb.errors); });
    await pb.check('#dmfOn'); await until(async () => (await b.ok('GET', '/api/dms')).on);
    await pb.fill('#dmfCode', 'not a code'); await pb.fill('#dmfName', 'Alberto'); await pb.click('#dmfAdd');
    await pb.waitForSelector('#dmf-err:not(:empty)');
    check('a bad code gives a plain error', /not valid/.test(await pb.textContent('#dmf-err')));
    await pb.fill('#dmfCode', code); await pb.fill('#dmfName', 'Alberto'); await pb.click('#dmfAdd');
    await pb.waitForSelector('#dmfBody .dmf-c');
    check('Add a friend lists them and clears the boxes', /Alberto/.test(await pb.textContent('.dmf-c')) && (await pb.inputValue('#dmfCode')) === '', await pb.textContent('#dmfBody'));
    await until(async () => (await s.ok('GET', '/api/dms/contacts')).length === 1);
    await pa.reload(); await pa.waitForSelector('#dmfBody .dmf-c');
    const wa = (await pa.textContent('#dmfBody .dmf-words')).trim(), wb = (await pb.textContent('#dmfBody .dmf-words')).trim();
    check('both boards show the same 6 safety words', wa === wb && wa.split(/\s+/).length === 6, [wa, wb]);

    await pa.click('#dmfBody .dmf-c [data-act="match"]');
    await pa.waitForSelector('#dmfBody .dmf-c:not(:has([data-act="match"]))');
    check('They match marks the friend as checked', (await s.ok('GET', '/api/dms/contacts'))[0].checked === true);
    check('the checked line replaces the question', /Checked/.test(await pa.textContent('#dmfBody .dmf-c')));

    await pa.click('#dmfBody .dmf-c [data-act="block"]');
    await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0].blocked);
    await pa.waitForFunction(() => /Unblock/.test(document.querySelector('.dmf-c').textContent));
    check('Block blocks, the button becomes Unblock', true);
    await pa.click('#dmfBody .dmf-c [data-act="block"]');
    await until(async () => !(await s.ok('GET', '/api/dms/contacts'))[0].blocked);
    check('Unblock unblocks', !(await s.ok('GET', '/api/dms/contacts'))[0].blocked);

    pa.once('dialog', d => d.dismiss());
    await pa.click('#dmfBody .dmf-c [data-act="remove"]'); await sleep(300);
    check('Remove asks first; Cancel keeps the friend', (await s.ok('GET', '/api/dms/contacts')).length === 1);
    pa.once('dialog', d => d.accept());
    await pa.click('#dmfBody .dmf-c [data-act="remove"]');
    await until(async () => (await s.ok('GET', '/api/dms/contacts')).length === 0);
    await pa.waitForFunction(() => /No friends yet/.test(document.getElementById('dmfBody').textContent));
    check('Remove deletes the friend', true);

    for (const lng of ['nl', 'nl-BE']) {
      await pa.evaluate(l => localStorage.setItem('aigile.lang', l), lng); await pa.reload(); await pa.waitForSelector('#dmfInvite');
      check('texts in ' + lng, /Een vriend uitnodigen/.test(await pa.textContent('#dmfBody')));
    }
    await pa.evaluate(() => localStorage.setItem('aigile.lang', 'en'));
    check('no page errors on board A (the expected 409 aside)', pa.errors.filter(e => !/409/.test(e)).length === 0, pa.errors); check('no page errors on board B', pb.errors.length === 0, pb.errors);
  } finally { b.stop(); relay.stop(); }
}, true);
