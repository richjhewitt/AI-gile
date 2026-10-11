// QA areas: chats, answerbtns, dms, railorder, dmchats, dmsrelay.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { ROOT, PORT, BASE, check, sleep, tmp, startServer, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

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
  check('typing box replies to the open question', (await page.inputValue('#dmTarget')) === c.id);
  // A general message while a question waits (AIG-285): pick "New message to" in the list.
  await page.selectOption('#dmTarget', '_new');
  await page.fill('#dmText', 'Unrelated: how is the week going?');
  await page.press('#dmText', 'Enter');
  await sleep(600);
  const gen = (await s.ok('GET', '/api/projects/alpha')).cards.find(x => x.quick);
  check('"New message to" sends a general message; the question stays open', gen && /Unrelated/.test(gen.title) && (await getCard(s, 'alpha', c.id)).needsYou, gen);
  await s.ok('PATCH', `/api/projects/alpha/cards/${gen.id}`, { status: 'done' });
  await page.waitForFunction(id => document.getElementById('dmTarget') && document.getElementById('dmTarget').value === id, c.id, { timeout: 5000 }).catch(() => {});
  check('after sending, the typing box answers the question again', (await page.inputValue('#dmTarget')) === c.id);
  await page.fill('#dmText', 'JSON please');
  await page.press('#dmText', 'Enter');
  await page.waitForSelector('#dmList .dm-msg.mine');
  const after = await getCard(s, 'alpha', c.id);
  check('your reply lands on the card and clears the question', after.comments.at(-1).text === 'JSON please' && !after.needsYou && after.status === 'team', after.comments.at(-1));
  await page.waitForFunction(() => /New message to/.test(document.getElementById('dmTo').textContent), null, { timeout: 5000 }).catch(() => {});
  await page.fill('#dmText', 'Idea: dark mode for the player');
  await page.press('#dmText', 'Enter');
  await sleep(600);
  const quick = (await s.ok('GET', '/api/projects/alpha')).cards.find(x => x.quick && x.status !== 'done');
  check('with nothing open, a new message becomes a quick question for the team', quick && quick.title === '💬 Idea: dark mode for the player' && quick.status === 'team', quick);
  s.cli(['comment', 'alpha', quick.id, 'Nice: made AIG-cards for it', '--as', 'Lead']);
  await page.waitForFunction(() => /made AIG-cards/.test(document.getElementById('dmList').textContent), null, { timeout: 6000 }).catch(() => {});
  check('the lead answer shows in the chat', /made AIG-cards/.test(await page.textContent('#dmList')));
  // Chatty lead (AIG-140): off by default; when on, the lead can start a DM without adding to the board.
  await s.ok('PATCH', '/api/projects/alpha', { chatty: false });   // not the owner's default for new projects
  check('a lead cannot start a DM while chatty is off', s.cli(['dm', 'alpha', 'hi!', '--as', 'Lead']).code !== 0);
  await s.ok('PATCH', '/api/projects/alpha', { chatty: true });
  const dm = s.cli(['dm', 'alpha', '3 things are waiting on you when you have a sec', '--as', 'Lead']);
  check('with chatty on, the lead can DM', dm.code === 0 && /sent to/.test(dm.out), dm);
  await page.waitForFunction(() => /3 things are waiting/.test(document.getElementById('dmList').textContent), null, { timeout: 6000 }).catch(() => {});
  check('the nudge shows in the chat, not on the board', /3 things are waiting/.test(await page.textContent('#dmList')) && (await s.ok('GET', '/api/projects/alpha')).cards.filter(x => x.status !== 'done' && /3 things/.test(x.title)).length === 0);
  noErrors(page);
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
  noErrors(page);
}, true);

/* ---------- private DMs (AIG-110/112) ---------- */
// A relay and two boards (A = the area's own server, B = a second one on PORT+1), all on temp folders.
async function startRelay(port, extraEnv = {}) {
  const data = path.join(tmp('relay'), 'data');
  const proc = spawn(process.execPath, [path.join(ROOT, 'relay', 'relay.js')], { env: { ...process.env, RELAY_PORT: String(port), RELAY_HOST: '127.0.0.1', RELAY_DATA: data, ...extraEnv }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(100); }
  return { base, data, stop: () => { try { proc.kill(); } catch {} } };
}
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; let v; while (!(v = await fn()) && Date.now() < end) await sleep(100); return v; };
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
  const relay = await startRelay(PORT + 3, { RELAY_RATE: '100000' });
  const tiny = await startRelay(PORT + 2, { RELAY_RATE: '5' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, PORT + 1);
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
      const rq = http.request({ host: '127.0.0.1', port: PORT + 3, method: 'POST', path: '/m/' + box, headers: { 'Content-Type': 'application/json', 'Content-Length': 13 * 1024 * 1024 } }, x => { x.resume(); res(x.statusCode); });
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
  check('the DMs list follows it', (await s.ok('GET', '/api/chats')).map(c => c.slug).join(',') === 'gamma,alpha,beta');
  await mkProject(s, 'Delta', 'DEL');
  check('a new project goes at the bottom', (await s.ok('GET', '/api/projects')).map(p => p.slug).join(',') === 'gamma,alpha,beta,delta');
  noErrors(page);
}, true);

def('dmchats', 'friends\' private DMs show as chats next to the team leads, with an All / Agents / People filter, the same reply box, 👍 and attachments (AIG-111)', async (s, ctx) => {
  const relay = await startRelay(PORT + 3, { RELAY_RATE: '100000' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, PORT + 1);
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
    check('All brings both back', await page.locator('#dmPanel .dm-row').count() === 2);

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
    await page.waitForSelector('#dmGo');
    check('a lead\'s chat still has its own Go button', /Go/.test(await page.textContent('#dmGo')));
    noErrors(page);
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });

def('dmsrelay', 'Setup: the DMs relay address box saves, and Check fetches <relay>/health on the server: a local relay passes, a bad address fails with a reason (AIG-309)', async (s, ctx) => {
  const relay = await startRelay(PORT + 3, { RELAY_RATE: '100000' });
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
