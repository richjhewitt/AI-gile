// QA areas: chats, answerbtns, dms, railorder, dmchats, dmsrelay.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { ROOT, PORT, BASE, freePort, startRelay, until, check, sleep, tmp, startServer, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('chats', 'DMs with the team leads: rail with unread counts, chat bubbles, answer the open question or send a new message (AIG-137/138)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const c = await mkCard(s, 'alpha', 'Export format');
  s.cli(['ask', 'alpha', c.id, 'M3U or JSON? Assuming M3U', '--as', 'Lead']);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-go="#/p/alpha"] .dm-unread');
  check('project icon shows what needs you (AIG-149)', (await page.textContent('#dmRail [data-go="#/p/alpha"] .dm-unread')) === '1');
  check('DMs button shows the unread total', (await page.textContent('#dmRail [data-dms] .dm-unread')) === '1');
  await page.click('#dmRail [data-go="#/p/beta"]');
  await page.waitForFunction(() => location.hash === '#/p/beta');
  check('a project icon opens its board and shows as active (AIG-147)', await page.waitForSelector('#dmRail [data-go="#/p/beta"].on', { timeout: 5000 }).then(() => true).catch(() => false));
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dm="alpha"]');
  check('DMs opens the list of leads (AIG-148)', /Lead/.test(await page.textContent('#dmPanel [data-dm="alpha"]')));
  await page.click('#dmPanel [data-dm="alpha"]');
  await page.waitForSelector('#dmList .dm-msg');
  check('their message on the left', /M3U or JSON/.test(await page.textContent('#dmList .dm-msg:not(.mine)')));
  check('typing box defaults to the Lead chat, not the open question (AIG-936)', (await page.inputValue('#dmTarget')) === '_new');
  // Uploaded screenshots remain images; their contents are not live themed widgets.
  check('chat screenshot stays an image attachment', await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.innerHTML = Attach.shown({ attachments: [{ id: 'team-shot', name: 'team.png', type: 'image/png' }] }, 'alpha');
    const img = wrap.querySelector('.att-shown img');
    return !!img && img.getAttribute('src') === '/api/projects/alpha/attachments/team-shot' && !wrap.querySelector('.team');
  }));
  // A general message while a question waits (AIG-285): pick "New message to" in the list.
  await page.selectOption('#dmTarget', '_new');
  await page.fill('#dmText', 'Unrelated: how is the week going?');
  await page.press('#dmText', 'Enter');
  await sleep(600);
  const gen = (await s.ok('GET', '/api/projects/alpha/leadchat')).messages.at(-1);   // AIG-872: the Lead chat, not a 💬 card
  check('"New message to" sends a general message; the question stays open', gen && /Unrelated/.test(gen.text) && !(await s.ok('GET', '/api/projects/alpha')).cards.some(x => x.quick) && (await getCard(s, 'alpha', c.id)).needsYou, gen);
  check('after sending, the Lead chat is open and the box carries on in it (AIG-872)', (await page.inputValue('#dmTarget')) === '_new' && /Unrelated/.test(await page.textContent('#dmList .dm-fold.open')));
  await page.selectOption('#dmTarget', c.id);
  await page.fill('#dmText', 'JSON please');
  await page.press('#dmText', 'Enter');
  await page.waitForSelector('#dmList .dm-msg.mine');
  const after = await getCard(s, 'alpha', c.id);
  check('your reply lands on the card and clears the question', after.comments.at(-1).text === 'JSON please' && !after.needsYou && after.status === 'team', after.comments.at(-1));
  await page.waitForFunction(() => /New message to/.test(document.getElementById('dmTo').textContent), null, { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#dmTarget');
  await page.selectOption('#dmTarget', '_new');
  await page.fill('#dmText', 'Idea: dark mode for the player');
  await page.press('#dmText', 'Enter');
  await sleep(600);
  await sleep(300);
  check('with nothing open, a new message goes to the Lead chat', (await s.ok('GET', '/api/projects/alpha/leadchat')).messages.at(-1).text === 'Idea: dark mode for the player');
  const quick = await s.ok('POST', '/api/projects/alpha/cards', { title: '💬 Idea: dark mode for the player', description: 'Idea: dark mode for the player', type: 'task', status: 'team', createdBy: 'Owner', quick: true });   // an old-style 💬 card still works
  s.cli(['comment', 'alpha', quick.id, 'Nice: made AIG-cards for it', '--as', 'Lead']);
  await page.waitForFunction(() => /made AIG-cards/.test(document.getElementById('dmList').textContent), null, { timeout: 6000 }).catch(() => {});
  check('the lead answer shows in the chat', /made AIG-cards/.test(await page.textContent('#dmList')));
  // AIG-811: a tidied card's "Original:" comment is his message, not a second one after it.
  s.cli(['edit', 'alpha', quick.id, '--desc', '- tidied bullet', '--as', 'Lead']);
  s.cli(['comment', 'alpha', quick.id, 'Original: my own raw words', '--as', 'Lead']);
  const msgs = (await s.ok('GET', '/api/chats/alpha')).messages.filter(m => m.card === quick.id);
  check('Original: comment stands in for the tidied description, once', msgs.filter(m => /my own raw words/.test(m.text)).length === 1 && !msgs.some(m => /^Original:/.test(m.text)) && !msgs.some(m => /tidied bullet/.test(m.text)) && msgs.find(m => /raw words/.test(m.text)).mine, msgs.map(m => m.text));
  // Chatty lead (AIG-140): off by default; when on, the lead can start a DM without adding to the board.
  await s.ok('PATCH', '/api/projects/alpha', { chatty: false });   // not the owner's default for new projects
  check('a lead cannot start a DM while chatty is off', s.cli(['dm', 'alpha', 'hi!', '--as', 'Lead']).code !== 0);
  await s.ok('PATCH', '/api/projects/alpha', { chatty: true });
  const dm = s.cli(['dm', 'alpha', '3 things are waiting on you when you have a sec', '--as', 'Lead']);
  check('with chatty on, the lead can DM', dm.code === 0 && /sent to/.test(dm.out), dm);
  await page.waitForFunction(() => /3 things are waiting/.test(document.getElementById('dmList').textContent), null, { timeout: 6000 }).catch(() => {});
  check('the nudge shows in the chat, not on the board', /3 things are waiting/.test(await page.textContent('#dmList')) && (await s.ok('GET', '/api/projects/alpha')).cards.filter(x => x.status !== 'done' && /3 things/.test(x.title)).length === 0);
  // AIG-449: a card in the chat opens from its header (id + title), from 📂 Open card, and pops out with ⤢ Pop out.
  const freshChat = async () => { const pg = await openPage(ctx, '#/'); await pg.click('#dmRail [data-dms]'); await pg.click('#dmPanel [data-dm="alpha"]'); await pg.waitForSelector(`#dmList .dm-fold-h[data-fold="${c.id}"]`); return pg; };
  const hp = await freshChat();
  check('the card header id links to the card on its board', (await hp.getAttribute(`#dmList .dm-fold-h[data-fold="${c.id}"] a.dm-fold-id`, 'href')) === `#/p/alpha/${c.id}`);
  await hp.click(`#dmList .dm-fold-h[data-fold="${c.id}"] a.dm-fold-id`);
  await hp.waitForFunction(id => location.hash === '#/p/alpha/' + id, c.id, { timeout: 5000 }).catch(() => {});
  await hp.waitForSelector('.panel h2', { timeout: 5000 }).catch(() => {});
  check('clicking the header id opens the card', (await hp.evaluate(id => location.hash === '#/p/alpha/' + id, c.id)) && (await hp.textContent('.panel h2').catch(() => '')) === c.title, await hp.evaluate(() => location.hash));
  const op = await freshChat();
  await op.click(`#dmList .dm-fold-h[data-fold="${c.id}"] .dm-fold-n`);
  await op.waitForSelector(`#dmList .dm-fold.open [data-opencard="${c.id}"]`);
  check('one chat Pop out, with Open card for the conversation', await op.locator('#dmList [data-popcard]').count() === 0 && await op.locator('#dmPanel .dm-head .dlg-pop').count() === 1);
  await op.click(`#dmList [data-opencard="${c.id}"]`);
  await op.waitForFunction(id => location.hash === '#/p/alpha/' + id, c.id, { timeout: 5000 }).catch(() => {});
  check('📂 Open card opens the card on its board', (await op.evaluate(() => location.hash)) === `#/p/alpha/${c.id}`);
  // Card ids in a message are links into the board (format.js linkify, with the project's key).
  await say(s, 'alpha', quick.id, 'Lead', `Also see ${c.id} for the export`);
  const lp = await freshChat();
  await lp.click(`#dmList .dm-fold-h[data-fold="${quick.id}"] .dm-fold-n`);
  await lp.waitForSelector(`#dmList .dm-fold.open a[href="#/p/alpha/${c.id}"]`, { timeout: 6000 }).catch(() => {});
  check('a card id mentioned in a message is a link to it', (await lp.locator(`#dmList .dm-fold.open .dm-bubble a[href="#/p/alpha/${c.id}"]`).count()) > 0);
  noErrors(page);
  noErrors(hp); noErrors(op);
}, true);

def('answerbtns', 'answer buttons under each message, picked from what it asks; the team can set its own (AIG-176)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const a = await mkCard(s, 'alpha', 'Big plan'), b = await mkCard(s, 'alpha', 'Export'), c = await mkCard(s, 'alpha', 'Format');
  s.cli(['ask', 'alpha', a.id, 'Plan:\n- build it\n\nGO?', '--as', 'Lead']);
  s.cli(['ask', 'alpha', b.id, 'Should exports include archived items?', '--as', 'Lead']);
  s.cli(['ask', 'alpha', c.id, 'Which format?', '--options', 'M3U,JSON', '--as', 'Lead']);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.click('#dmPanel [data-dm="alpha"]');
  await page.waitForSelector('#dmList .msg-act');
  const labels = await page.$$eval('#dmList .msg-act', bs => bs.map(x => x.textContent.trim()));
  check('a GO? plan gets Go and Not yet; a yes/no question gets Yes and No; set options show as given', ['✅ Go', '✋ Not yet', '👍 Yes', '👎 No', 'M3U', 'JSON', '✏️ Other…'].every(l => labels.includes(l)), labels);
  await page.click(`#dmList .msg-act[data-card="alpha/${a.id}"][data-say="GO"]`);
  await page.waitForFunction(async id => (await (await fetch('/api/projects/alpha')).json()).cards.find(x => x.id === id).comments.at(-1).text === 'GO', a.id, { timeout: 5000 }).catch(() => {});
  const ga = await getCard(s, 'alpha', a.id);
  check('Go on a message further up answers that card, not the newest', ga.comments.at(-1).text === 'GO' && !ga.needsYou, ga.comments.at(-1));
  await page.waitForSelector(`#dmList .msg-act[data-card="alpha/${b.id}"][data-ask]`);
  await page.click(`#dmList .msg-act[data-card="alpha/${b.id}"][data-ask]`);
  check('No starts a reply to that card instead of sending', (await page.inputValue('#dmText')) === 'No: ' && (await getCard(s, 'alpha', b.id)).needsYou);
  await page.goto(BASE + '/#/inbox');
  await page.waitForSelector(`.ib-item .msg-act[data-card="alpha/${c.id}"]`);
  check('the inbox shows the same buttons, plus Other', (await page.locator(`.ib-item .msg-act[data-card="alpha/${c.id}"]`).count()) === 3);
  await page.click(`.ib-item .msg-act[data-card="alpha/${c.id}"][data-ask=""]`);
  check('Other puts you in that reply box', await page.evaluate(() => document.activeElement.tagName === 'TEXTAREA' && !!document.activeElement.closest('.ib-item')));
  // On the card itself (AIG-371, AIG-315): task Done, ask buttons, and Looks right only after a command.
  const tk = await mkCard(s, 'alpha', 'Run it'), yn = await mkCard(s, 'alpha', 'Archive?'), op = await mkCard(s, 'alpha', 'Pick');
  s.cli(['task', 'alpha', tk.id, 'Paste this: npm test', '--as', 'Lead']);
  s.cli(['ask', 'alpha', yn.id, 'Should we archive it?', '--as', 'Lead']);
  s.cli(['ask', 'alpha', op.id, 'Which one?', '--options', 'Red,Blue', '--as', 'Lead']);
  await page.evaluate(() => Dms.close());   // the earlier DM panel sat over the card and blocked real clicks
  await page.goto(BASE + `/#/p/alpha/${op.id}`);
  await page.waitForSelector('.reply .card-acts button');
  check('ask --options shows its buttons on the card', (await page.$$eval('.reply .card-acts button', bs => bs.map(x => x.textContent.trim()))).join('|') === 'Red|Blue');
  check('no Looks right after a plain question', (await page.locator('[data-looksright]').count()) === 0);
  await page.click('.reply .card-acts [data-say="Blue"]');
  await page.waitForFunction(async id => (await (await fetch('/api/projects/alpha')).json()).cards.find(x => x.id === id).comments.at(-1).text === 'Blue', op.id, { timeout: 5000 }).catch(() => {});
  check('one click posts the option as the owner', (await getCard(s, 'alpha', op.id)).comments.at(-1).text === 'Blue');
  await page.goto(BASE + `/#/p/alpha/${yn.id}`);
  await page.waitForSelector('.reply .card-acts button');
  check('a yes/no ask shows Yes and No on the card', (await page.$$eval('.reply .card-acts button', bs => bs.map(x => x.textContent.trim()))).join('|') === '👍 Yes|👎 No');
  await page.goto(BASE + `/#/p/alpha/${tk.id}`);
  await page.waitForSelector('[data-cardtaskdone]');
  await page.click('[data-cardtaskdone]');
  await page.waitForFunction(async id => (await (await fetch('/api/projects/alpha')).json()).cards.find(x => x.id === id).comments.at(-1).text.startsWith('✅ Done'), tk.id, { timeout: 5000 }).catch(() => {});
  const dt = await getCard(s, 'alpha', tk.id);
  check('an open task shows Done on the card; one click posts it and hands the card back', dt.comments.at(-1).text.startsWith('✅ Done') && dt.assignee !== 'Rich' && dt.status === 'team', dt.comments.at(-1));
  const lr = await mkCard(s, 'alpha', 'Check build');
  await s.ok('POST', `/api/projects/alpha/cards/${lr.id}/comments`, { author: 'Lead', text: 'Run this:\n```\nnpm test\n```\nYou should see 12 passing.' });
  await page.goto(BASE + `/#/p/alpha/${lr.id}`);
  await page.waitForSelector('[data-looksright]');
  await page.click('[data-looksright]');
  await page.waitForFunction(async id => (await (await fetch('/api/projects/alpha')).json()).cards.find(x => x.id === id).comments.at(-1).author !== 'Lead', lr.id, { timeout: 5000 }).catch(() => {});
  check('Looks right appears after a command and posts the expected text', (await getCard(s, 'alpha', lr.id)).comments.at(-1).text === 'Done, it looked as expected. Next step please.');
  noErrors(page);
}, true);

/* ---------- private DMs (AIG-110/112) ---------- */
// A relay and two boards (A = the area's own server, B = a second one), all on free ports and temp folders.
const filesUnder = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const envFiles = (relay, box) => filesUnder(path.join(relay.data, box)).filter(f => !f.endsWith('owner.json'));
// A request to the relay signed like a board's (lib/dm.js relayCall), with parts that can be bent for the tests.
async function relaySigned(relay, method, p, key, { ts = Date.now(), nonce = crypto.randomBytes(12).toString('base64url'), body } = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  const msg = ['aigile-relay-v1', method, p, String(ts), nonce, crypto.createHash('sha256').update(data).digest('hex')].join('\n');
  const headers = { 'x-relay-key': key.publicKey.export({ format: 'jwk' }).x, 'x-relay-ts': String(ts), 'x-relay-nonce': nonce,
    'x-relay-sig': crypto.sign(null, Buffer.from(msg), key.privateKey).toString('base64url'), ...(data ? { 'Content-Type': 'application/json' } : {}) };
  const r = await fetch(relay.base + p, { method, headers, body: data || undefined });
  return { status: r.status, headers, nonce, ts };
}

def('dms', 'private DMs: invite/accept, same safety code, encrypted send through a relay that sees no plaintext, tamper shows not verified, block, DMs off (AIG-110/112)', async s => {
  const relay = await startRelay({ RELAY_RATE: '100000' });
  const tiny = await startRelay({ RELAY_RATE: '5' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const a = s;
  try {
    check('relay is up', (await fetch(relay.base + '/health')).ok);
    const sa = await a.ok('GET', '/api/dms');
    check('DMs start off, with a random mailbox', sa.on === false && /^[A-Za-z0-9_-]{24}$/.test(sa.mailbox), sa);
    const idFile = path.join(a.data, 'keys', 'identity.json');
    const id = JSON.parse(fs.readFileSync(idFile, 'utf8'));
    check('keys made on first use in data/keys', id.x.crv === 'X25519' && id.e.crv === 'Ed25519' && !!id.x.d && !!id.e.d);
    check('an invite needs DMs on', (await a.api('POST', '/api/dms/invites', {})).status === 409);
    check('turning on needs a relay', (await a.api('POST', '/api/dms/settings', { on: true })).status === 400);
    check('the relay cannot be this board', (await a.api('POST', '/api/dms/settings', { on: true, relay: a.base + '/api' })).status === 400);
    check('a relay must be http(s)', (await a.api('POST', '/api/dms/settings', { on: true, relay: 'file:///etc' })).status === 400);
    const onA = await a.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const onB = await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    check('both on, and the first poll reached the relay', onA.on && onB.on && onA.lastPoll?.ok && onB.lastPoll?.ok, [onA.lastPoll, onB.lastPoll]);
    check('turning on claimed the mailbox with the signing key only', JSON.parse(fs.readFileSync(path.join(relay.data, onA.mailbox, 'owner.json'), 'utf8')).key === id.e.x);

    // Invite on A, accept on B; A learns about B from B's sealed hello.
    const inv = await a.ok('POST', '/api/dms/invites', { name: 'Beatrix' });
    check('invite code is short-ish base64url', /^[A-Za-z0-9_-]+$/.test(inv.code) && inv.code.length < 500, inv.code.length);
    check('a bad code is refused', (await b.api('POST', '/api/dms/accept', { code: 'nonsense', name: 'x' })).status === 400);
    const ca = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });
    check('B has A as a contact', ca.name === 'Alberto' && ca.mailbox === onA.mailbox);
    check('the same code twice is refused', (await b.api('POST', '/api/dms/accept', { code: inv.code, name: 'again' })).status === 409);
    const cb = await until(async () => (await a.ok('GET', '/api/dms/contacts'))[0]);
    check('A got B from the hello, named as the invite said', cb && cb.name === 'Beatrix' && cb.mailbox === onB.mailbox, cb);
    check('safety codes match: 6 words', cb && ca.safety === cb.safety && ca.safety.split(' ').length === 6, [ca.safety, cb?.safety]);
    check('safety code can be marked as checked', (await a.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true })).checked === true);
    check('the invite secret is used up', JSON.parse(fs.readFileSync(path.join(a.data, 'dms', 'invites.json'), 'utf8')).length === 0);

    // B off: A's message waits on the relay, and the relay copy is scrambled.
    await b.ok('POST', '/api/dms/settings', { on: false });
    const secret = 'pineapple secret 42';
    const sent = await a.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: secret });
    check('send reaches the relay', sent.status === 'sent' && sent.text === secret, sent);
    await sleep(1500);   // 5 of B's poll intervals
    check('DMs off: B does not collect (still on the relay)', envFiles(relay, onB.mailbox).length === 1);
    check('DMs off: nothing arrived on B', (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).length === 0);
    check('DMs off: B cannot send', (await b.api('POST', `/api/dms/contacts/${ca.id}/messages`, { text: 'x' })).status === 409);
    const idB = JSON.parse(fs.readFileSync(path.join(b.data, 'keys', 'identity.json'), 'utf8'));
    const relayText = filesUnder(relay.data).map(f => fs.readFileSync(f, 'utf8')).join('\n');
    const leaks = [secret, 'pineapple', 'Beatrix', 'Alberto', id.x.x, idB.x.x, id.x.d, id.e.d, idB.x.d, idB.e.d].filter(t => relayText.includes(t));
    check('the relay holds no plaintext, names, encryption keys or private keys', leaks.length === 0, leaks);
    const raw = (await a.ok('GET', `/api/dms/contacts/${cb.id}/messages/${sent.id}/raw`)).envelope;
    check('"what the relay sees" is the sealed envelope', raw && raw.to === onB.mailbox && raw.ct && raw.epk && raw.sig && !JSON.stringify(raw).includes('pineapple'), raw);
    check('the message list does not carry the envelope', !('raw' in sent));

    await b.ok('POST', '/api/dms/settings', { on: true });
    const got = await until(async () => (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).find(m => m.dir === 'in'));
    check('B receives, verifies and decrypts', got && got.verified === true && got.text === secret, got);
    check('collected envelopes are deleted from the relay', await until(() => envFiles(relay, onB.mailbox).length === 0));
    await b.ok('POST', `/api/dms/contacts/${ca.id}/messages`, { text: 'hello back' });
    const back = await until(async () => (await a.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).find(m => m.dir === 'in'));
    check('and the other way', back && back.verified && back.text === 'hello back', back);

    // Replayed, tampered (one changed byte) or forged on the way: a replay is ignored; the others are kept as not verified, without text.
    const drop = env => fetch(relay.base + '/m/' + onB.mailbox, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(env) });
    const rawBack = (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages/${got.id}/raw`)).envelope;
    await drop(rawBack);
    const bad1 = { ...raw, ct: (raw.ct[0] === 'A' ? 'B' : 'A') + raw.ct.slice(1) };
    check('the relay takes the tampered copy', (await fetch(relay.base + '/m/' + onB.mailbox, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bad1) })).status === 201);
    const forged = { ...raw, id: crypto.randomBytes(16).toString('base64url') };   // a new id under the old signature
    await fetch(relay.base + '/m/' + onB.mailbox, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(forged) });
    const unv = await until(async () => { const l = (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).filter(m => m.verified === false); return l.length === 2 && l; });
    check('tampered and forged messages show as not verified, with no text', unv && unv.every(m => m.text === null && m.reason), unv);
    check('a replay of the real message is ignored', (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).filter(m => m.verified && m.dir === 'in').length === 1);

    // Block: nothing from them is kept, nothing is sent to them.
    const blk = await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { blocked: true });
    check('block', blk.blocked === true);
    check('cannot send to a blocked person', (await b.api('POST', `/api/dms/contacts/${ca.id}/messages`, { text: 'x' })).status === 409);
    const before = (await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).length;
    await a.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'after the block' });
    await until(() => envFiles(relay, onB.mailbox).length === 1, 2000);
    check('a blocked person\'s message is collected and dropped', await until(() => envFiles(relay, onB.mailbox).length === 0));
    const afterBlock = await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`);
    check('block stops delivery', afterBlock.length === before && !afterBlock.some(m => m.text === 'after the block'));
    await b.ok('DELETE', `/api/dms/contacts/${ca.id}`);
    check('remove forgets the person and the chat', (await b.ok('GET', '/api/dms/contacts')).length === 0 && (await b.api('GET', `/api/dms/contacts/${ca.id}/messages`)).status === 404 && !fs.existsSync(path.join(b.data, 'dms', ca.id + '.json')));
    await a.ok('POST', '/api/dms/settings', { on: false });
    check('DMs off: A cannot send', (await a.api('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'x' })).status === 409);
    check('the API is behind the guard', (await fetch(a.base + '/api/dms/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: '{"on":true}' })).status === 403);

    // The relay itself: only the owner collects, signed and fresh; limits.
    const k = crypto.generateKeyPairSync('ed25519');
    check('relay: collecting needs a signature', (await fetch(relay.base + '/m/' + onB.mailbox)).status === 401);
    check('relay: someone else\'s key cannot collect', (await relaySigned(relay, 'GET', '/m/' + onB.mailbox, k)).status === 403);
    const box = crypto.randomBytes(18).toString('base64url');
    check('relay: dropping into an unclaimed mailbox is refused', (await fetch(relay.base + '/m/' + box, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: box, ct: 'x', sig: 'y' }) })).status === 404);
    const first = await relaySigned(relay, 'GET', '/m/' + box, k);
    check('relay: the first signed collect claims a new mailbox', first.status === 200);
    check('relay: a replayed request is refused', (await relaySigned(relay, 'GET', '/m/' + box, k, { nonce: first.nonce, ts: first.ts })).status === 401);
    check('relay: an old request is refused', (await relaySigned(relay, 'GET', '/m/' + box, k, { ts: Date.now() - 10 * 60e3 })).status === 401);
    check('relay: an envelope for another mailbox is refused', (await fetch(relay.base + '/m/' + box, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: onB.mailbox, ct: 'x', sig: 'y' }) })).status === 400);
    const big = await new Promise(res => {
      const rq = http.request({ host: '127.0.0.1', port: relay.port, method: 'POST', path: '/m/' + box, headers: { 'Content-Type': 'application/json', 'Content-Length': 13 * 1024 * 1024 } }, x => { x.resume(); res(x.statusCode); });
      rq.on('error', () => res('error'));
      rq.write('{');
    });
    check('relay: over 12 MB is refused', big === 413, big);
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await fetch(tiny.base + '/health')).status;
    check('relay: rate limit per IP', last === 429, last);
  } finally {
    b.stop(); relay.stop(); tiny.stop();
  }
}, false, { AIGILE_DM_POLL_MS: '300' });

def('dmstore', 'the relay keeps nothing once the friend has it: files acked then gone, big unacked ones expire sooner, a full mailbox refuses with a message the sender sees (AIG-341)', async s => {
  const relay = await startRelay({ RELAY_RATE: '100000', RELAY_BOX_BYTES: '20000', RELAY_BIG_BYTES: '5000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    await s.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const onB = await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await s.ok('POST', '/api/dms/invites', { name: 'Davy' });
    const cb = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Rich' });
    const ca = await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0]);
    await until(async () => (await b.ok('GET', '/api/dms/contacts'))[0] && (await s.ok('GET', '/api/dms/contacts'))[0]);
    const file = { name: 'pic.bin', type: 'application/octet-stream', data: Buffer.alloc(3000, 7).toString('base64') };
    await b.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'a file', attachments: [file] });
    const got = await until(async () => (await s.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).find(m => m.attachments));
    check('the file arrived', !!got);
    const mineA = (await s.ok('GET', '/api/dms')).mailbox;
    check('and the relay mailbox is empty straight after the ack', await until(() => envFiles(relay, mineA).length === 0 && filesUnder(relay.data).every(f => f.endsWith('owner.json'))));

    // Expiry: write envelopes by their age into a claimed mailbox, then collect. Big ones (over 5000 bytes here) last 48 h, others 7 days.
    const k = crypto.generateKeyPairSync('ed25519');
    const box = crypto.randomBytes(18).toString('base64url');
    check('claim a mailbox', (await relaySigned(relay, 'GET', '/m/' + box, k)).status === 200);
    const day = 24 * 3600e3, name = age => (Date.now() - age) + '-' + crypto.randomBytes(8).toString('hex') + '.json';
    const put = (age, size) => { const f = name(age); fs.writeFileSync(path.join(relay.data, box, f), 'x'.repeat(size)); return f; };
    const bigOld = put(3 * day, 6000), bigNew = put(1 * day, 6000), smallOld = put(3 * day, 100), smallAncient = put(8 * day, 100);
    await relaySigned(relay, 'GET', '/m/' + box, k);
    const left = fs.readdirSync(path.join(relay.data, box));
    check('a big envelope unacked for 3 days is gone', !left.includes(bigOld));
    check('a big one under 48 hours stays', left.includes(bigNew));
    check('a small one at 3 days stays (7 days)', left.includes(smallOld));
    check('a small one at 8 days is gone', !left.includes(smallAncient));

    // The cap: B is off so nothing is collected; A keeps sending files until the mailbox is full.
    await b.ok('POST', '/api/dms/settings', { on: false });
    const big = { name: 'big.bin', type: 'application/octet-stream', data: Buffer.alloc(6000, 9).toString('base64') };
    let last;
    for (let i = 0; i < 4; i++) last = await s.ok('POST', `/api/dms/contacts/${ca.id}/messages`, { text: 'more ' + i, attachments: [big] });
    check('the sender sees it failed, with who is full', last.status === 'failed' && last.reason === ca.name + "'s mailbox is full: they need to open AI-gile", last);
    check('the relay holds no more than the cap', filesUnder(path.join(relay.data, onB.mailbox)).filter(f => !f.endsWith('owner.json')).reduce((n, f) => n + fs.statSync(f).size, 0) <= 20000);
  } finally { b.stop(); relay.stop(); }
}, false, { AIGILE_DM_POLL_MS: '300' });

def('railorder', 'drag a project in the left rail to reorder; the order is used for the project list and DMs (AIG-189)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP'); await mkProject(s, 'Beta', 'BET'); await mkProject(s, 'Gamma', 'GAM');
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-slug="gamma"]');
  const rail = () => page.$$eval('#dmRail [data-slug]', bs => bs.map(b => b.dataset.slug).join(','));
  check('starts by name', (await rail()) === 'alpha,beta,gamma', await rail());
  await page.dragAndDrop('#dmRail [data-slug="gamma"]', '#dmRail [data-slug="alpha"]', { targetPosition: { x: 10, y: 4 } });
  await page.waitForFunction(() => [...document.querySelectorAll('#dmRail [data-slug]')].map(b => b.dataset.slug).join(',') === 'gamma,alpha,beta', null, { timeout: 5000 }).catch(() => {});
  check('dropping Gamma above Alpha moves it to the top', (await rail()) === 'gamma,alpha,beta', await rail());
  check('the board keeps that order', (await s.ok('GET', '/api/projects')).map(p => p.slug).join(',') === 'gamma,alpha,beta');
  check('the DMs list follows it (the 🧭 Lead Scrum Master last, AIG-359)', (await s.ok('GET', '/api/chats')).map(c => c.slug).join(',') === 'gamma,alpha,beta,_watchman');
  await mkProject(s, 'Delta', 'DEL');
  check('a new project goes at the bottom', (await s.ok('GET', '/api/projects')).map(p => p.slug).join(',') === 'gamma,alpha,beta,delta');
  noErrors(page);
}, true);

def('dmchats', 'friends\' private DMs show as chats next to the team leads, with an All / Agents / People filter, the same reply box, 👍 and attachments (AIG-111)', async (s, ctx) => {
  const relay = await startRelay({ RELAY_RATE: '100000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    await mkProject(s, 'Alpha', 'ALP');
    await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
    await s.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await s.ok('POST', '/api/dms/invites', { name: 'Beatrix' });
    const cb = await b.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });
    const ca = await until(async () => (await s.ok('GET', '/api/dms/contacts'))[0]);
    check('the friend is a contact', ca && ca.name === 'Beatrix', ca);
    await b.ok('POST', `/api/dms/contacts/${cb.id}/messages`, { text: 'Hi from Alberto' });
    await until(async () => (await s.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).length);

    const page = await openPage(ctx, '#/');
    await page.waitForSelector('#dmRail [data-dms]');
    await page.click('#dmRail [data-dms]');
    await page.waitForSelector('#dmPanel [data-dm="alpha"]');
    check('All shows the lead and the friend', await page.locator('#dmPanel [data-dm="alpha"]').count() === 1 && await page.locator(`#dmPanel [data-dm="dm:${ca.id}"]`).count() === 1);
    check('the friend\'s new message counts as unread', (await page.textContent(`#dmPanel [data-dm="dm:${ca.id}"] .dm-unread`)) === '1');
    await page.click('#dmPanel [data-dmfilter="agents"]');
    check('Agents shows only the lead', await page.locator('#dmPanel [data-dm="alpha"]').count() === 1 && await page.locator('#dmPanel [data-dm^="dm:"]').count() === 0);
    await page.click('#dmPanel [data-dmfilter="people"]');
    check('People shows only the friend', await page.locator('#dmPanel [data-dm="alpha"]').count() === 0 && await page.locator(`#dmPanel [data-dm="dm:${ca.id}"]`).count() === 1);
    await page.click('#dmPanel [data-dmfilter="all"]');
    check('All brings both back (and the 🧭 Lead Scrum Master, AIG-359)', await page.locator('#dmPanel .dm-row:not([data-dm="_allhands"]):not([data-dm="_assistant"]):not([data-dm^="grp:meeting-"])').count() === 3);

    await page.click(`#dmPanel [data-dm="dm:${ca.id}"]`);
    await page.waitForSelector('#dmList .dm-msg');
    check('their message is on the left', /Hi from Alberto/.test(await page.textContent('#dmList .dm-msg:not(.mine)')));
    await page.fill('#dmText', 'Hello back');
    await page.press('#dmText', 'Enter');
    await page.waitForSelector('#dmList .dm-msg.mine');
    check('the reply box sends a private message', /Hello back/.test(await page.textContent('#dmList .dm-msg.mine')));
    check('and it reaches the friend, decrypted', !!(await until(async () => (await b.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).find(m => m.dir === 'in' && m.text === 'Hello back'))));
    await page.click('#dmGo');
    check('👍 sends a thumbs up', !!(await until(async () => (await b.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).find(m => m.dir === 'in' && m.text === '👍'))));
    await page.setInputFiles('#dmPanel .att input[type=file]', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('secret note') });
    await page.waitForSelector('#dmPanel .att-chip');
    await page.fill('#dmText', 'See file');
    await page.press('#dmText', 'Enter');
    await page.waitForSelector('#dmList .att-file');
    const got = await until(async () => (await b.ok('GET', `/api/dms/contacts/${cb.id}/messages`)).find(m => m.attachments));
    check('an attachment is sent and shown', got && got.attachments[0].name === 'note.txt' && (await (await fetch(`${b.base}/api/dms/contacts/${cb.id}/files/${encodeURIComponent(got.attachments[0].id)}`)).text()) === 'secret note', got);
    check('the relay never sees the file text', !filesUnder(relay.data).some(f => fs.readFileSync(f, 'utf8').includes('secret note')));

    await page.click('#dmPanel button[onclick="Dms.back()"]');
    await page.waitForSelector('#dmPanel [data-dmfilter]');
    check('the chosen filter is still there when you come back to the list', await page.locator('#dmPanel [data-dmfilter="all"].on').count() === 1);
    await page.click('#dmPanel [data-dm="alpha"]');
    await page.waitForSelector('#dmGo', { state: 'attached' });
    check('a lead\'s chat still has its own Go button', /Go/.test(await page.textContent('#dmGo')));
    noErrors(page);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });

def('dmsrelay', 'Setup: the DMs relay address box saves, and Check fetches <relay>/health on the server: a local relay passes, a bad address fails with a reason (AIG-309)', async (s, ctx) => {
  const relay = await startRelay({ RELAY_RATE: '100000' });
  try {
    check('check passes against a running relay', (await s.ok('POST', '/api/dms/check', { relay: relay.base })).ok === true);
    const dead = await s.ok('POST', '/api/dms/check', { relay: 'http://127.0.0.1:1' });
    check('check fails for a dead address, with a reason', dead.ok === false && /reach/.test(dead.reason), dead);
    const ftp = await s.ok('POST', '/api/dms/check', { relay: 'ftp://example.com' });
    check('only http(s) is checked', ftp.ok === false && /http/.test(ftp.reason), ftp);
    const notRelay = await s.ok('POST', '/api/dms/check', { relay: s.base + '/api' });
    check('this board is not a relay', notRelay.ok === false, notRelay);

    const page = await openPage(ctx, '#/setup');
    await page.waitForSelector('#dmsRelay');
    await page.fill('#dmsRelay', relay.base);
    await page.click('#dmsRelayCheck');
    await page.waitForFunction(() => /✅/.test(document.getElementById('dmsRelay-msg').textContent));
    check('Check shows a tick for the running relay', true);
    await page.fill('#dmsRelay', 'http://127.0.0.1:1');
    await page.click('#dmsRelayCheck');
    await page.waitForFunction(() => /❌/.test(document.getElementById('dmsRelay-msg').textContent));
    check('Check shows a cross and the reason for a bad address', /could not reach/.test(await page.textContent('#dmsRelay-msg')));
    await page.fill('#dmsRelay', relay.base);
    await page.click('#dmsRelaySave');
    await page.waitForFunction(() => /Saved/.test(document.getElementById('dmsRelay-msg').textContent));
    check('Save keeps the address', (await s.ok('GET', '/api/dms')).relay === relay.base);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dmsRelay') && document.getElementById('dmsRelay').value);
    check('the saved address is in the box after a refresh', (await page.inputValue('#dmsRelay')) === relay.base);
    noErrors(page);
    await page.fill('#dmsRelay', 'file:///etc');
    await page.click('#dmsRelaySave');
    await page.waitForFunction(() => document.getElementById('dmsRelay-err').textContent);
    check('Save refuses a non-web address', true);
  } finally { relay.stop(); }
}, true);

def('teamnews', 'DMs hold only the owner and the lead; ðŸ“œ Team news pop-out lists every team comment; stand-up shows On call and hides retired (AIG-319)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Forge', role: 'Dev' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Ghost', role: 'Dev', status: 'ðŸ’¤ retired' });
  const q = await mkCard(s, 'alpha', 'Export format');
  s.cli(['ask', 'alpha', q.id, 'M3U or JSON?', '--as', 'Lead']);
  await say(s, 'alpha', q.id, 'Forge', 'FOLDNOTE handover: folded AIG-9 into this');
  await say(s, 'alpha', q.id, 'Owner', 'JSON please');
  await s.ok('POST', '/api/projects/alpha/cards', { title: 'ðŸ’¬ Quick idea', description: 'Quick idea text', quick: true });
  const t1 = await mkCard(s, 'alpha', 'A test for you', { testSteps: '- click it' });
  await say(s, 'alpha', t1.id, 'Forge', 'Folded in AIG-9');
  await s.ok('PATCH', `/api/projects/alpha/cards/${t1.id}`, { status: 'verify', needsYou: true });
  const chat = await s.ok('GET', '/api/chats/alpha');
  check('a test waiting in verify is not in the DM (AIG-370)', !chat.messages.some(m => m.card === t1.id) && !chat.open.some(o => o.id === t1.id), chat.open);
  const texts = chat.messages.map(m => m.text).join('|');
  check('lead chat keeps the question and the owner reply', /M3U or JSON/.test(texts) && /JSON please/.test(texts), texts);
  check('lead chat leaves out a fold / handover comment', !/FOLDNOTE/.test(texts), texts);
  const quick = chat.messages.find(m => /Quick idea text/.test(m.text));
  if (quick) await say(s, 'alpha', quick.card, 'Lead', 'Lead reply to the idea');
  check('a reply to a ðŸ’¬ card shows in the chat', /Lead reply to the idea/.test(JSON.stringify(await s.ok('GET', '/api/chats/alpha'))));
  const page = await openPage(ctx, '#/p/alpha');
  await page.click('#dmRail [data-dms]'); await page.click('#dmPanel [data-dm="alpha"]');
  await page.waitForSelector('#dmList .dm-msg');
  check('page chat has no fold comment', !/FOLDNOTE/.test(await page.textContent('#dmList')));
  await page.waitForSelector('button[onclick^="openNews"]');
  check('board has the Team news button', /Team news/.test(await page.textContent('button[onclick^="openNews"]')));
  const pop = await openPage(ctx, '#/pop-news/alpha');
  await pop.waitForSelector('.news-item');
  const items = await pop.$$eval('.news-item', n => n.map(x => x.textContent));
  check('Team news lists every comment, newest first, with card links', items.length >= 4 && /Lead reply/.test(items[0]) && items.some(x => /FOLDNOTE/.test(x)) && await pop.$('.news-item a[href^="#/pop/alpha/"]') !== null, items);
  await say(s, 'alpha', q.id, 'Forge', 'LIVECOMMENT');
  await pop.waitForFunction(() => /LIVECOMMENT/.test(document.body.textContent), null, { timeout: 6000 }).catch(() => {});
  check('Team news updates live', /LIVECOMMENT/.test(await pop.textContent('body')));
  noErrors(pop);
  await s.ok('POST', '/api/standup', { projects: ['alpha'] });
  s.cli(['standup', 'alpha', '--done', 'old', '--next', 'y', '--as', 'Ghost']);
  s.cli(['standup', 'alpha', '--done', 'Led', '--next', 'y', '--as', 'Lead']);
  const rp = await openPage(ctx, '#/standups');
  await rp.waitForSelector('.su-person');
  const su = await rp.textContent('.su');
  check('stand-up: a non-reporter shows On call', /Forge/.test(su) && /On call/.test(su), su);
  check('stand-up: a retired member is not listed', !/Ghost/.test(su), su);
}, true);

