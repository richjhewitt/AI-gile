// QA area: desk (AIG-1104, AIG-1105): service desk sorting. Cards that come in from the public feedback form and from a friend (the
// lane, Take) on a project where the service is on get a desk kind by plain rules (broken/down/error/can't -> incident, please add /
// could you / feature -> request, else idea); an incident is made an incident card; a project without the service is left alone; the
// owner (only) can change the kind; the board filter "Desk: requests / incidents / ideas".
import fs from 'node:fs';
import path from 'node:path';
import { freePort, tmp, startRelay, startServer, until, check, mkProject, getCard, openPage, noErrors, def } from '../lib.mjs';
import { pair } from './share.mjs';

// The stub agent for the duplicate hint (AIG-1105): notes each call, answers with the first card id after "Open cards:".
const dir = tmp('desk'), calls = path.join(dir, 'calls.txt'), stub = path.join(dir, 'desk-stub.bat');
fs.writeFileSync(path.join(dir, 'desk-stub.js'), `const fs = require('fs'), a = process.argv.slice(2), m = a[a.indexOf('--model') + 1] || '-', p = a[a.indexOf('-p') + 1] || '';
fs.appendFileSync(${JSON.stringify(calls)}, m + ' ' + p + '\\n'); const id = (p.split('Open cards:')[1] || '').match(/[A-Z]+-\\d+/); console.log(id ? id[0] : 'none');`);
fs.writeFileSync(stub, `@echo off\r\nnode "${path.join(dir, 'desk-stub.js')}" %*\r\nexit /b 0\r\n`);
const callList = () => { try { return fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean); } catch { return []; } };

def('desk', '🛎️ service desk: form and friend cards get a kind (request / incident / idea) by plain rules only where the service is on, owner changes it, board filter (AIG-1104), duplicate hint: plain text match first, one stubbed Haiku call only when unsure and AI is allowed (AIG-1105)', async (s, ctx) => {
  const relay = await startRelay({ RELAY_FEEDBACK_RATE: '50' });
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    const { ca, cb } = await pair(s, b, relay);
    await s.ok('PATCH', `/api/dms/contacts/${cb.id}`, { checked: true });
    await b.ok('PATCH', `/api/dms/contacts/${ca.id}`, { checked: true });
    await mkProject(s, 'Desk Site', 'DSK'); await mkProject(s, 'Plain Site', 'PLN');
    await s.ok('PATCH', '/api/projects/desk-site', { service: { on: true } });
    for (const n of ['desk-site', 'plain-site']) {
      await s.ok('PATCH', '/api/projects/' + n, { public: true, publicName: n });
      await until(async () => (await fetch(relay.base + '/b/' + n + '.json')).status === 200, 8000);
      await s.ok('PATCH', '/api/projects/' + n, { feedback: { on: true } });
    }
    const post = (name, says) => fetch(relay.base + '/f/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: 'en', page: '/x', says, should: '' }) });
    const send = async (name, says) => { check('report accepted: ' + says, await until(async () => (await post(name, says)).status === 201, 8000)); };
    await send('desk-site', 'The site is down');
    await send('desk-site', 'Please add dark mode');
    await send('desk-site', 'I love the colours here');
    await send('desk-site', "I can't log in, error 500");
    await send('plain-site', 'The site is down');
    check('four reports filed on the service project', (await s.ok('POST', '/api/projects/desk-site/feedback/pull', {})).filed === 4);
    check('one report filed on the plain project', (await s.ok('POST', '/api/projects/plain-site/feedback/pull', {})).filed === 1);
    const cards = (await s.ok('GET', '/api/projects/desk-site')).cards;
    const by = t => cards.find(c => (c.description || '').includes(t));
    const down = by('site is down'), add = by('dark mode'), love = by('colours'), login = by('log in');
    check('"site is down" lands as an incident and an incident card', down.desk && down.desk.kind === 'incident' && down.type === 'incident' && down.desk.auto === true, down);
    check('"please add dark mode" is a request (stays a bug card)', add.desk.kind === 'request' && add.type === 'bug', add);
    check('plain praise is an idea', love.desk.kind === 'idea' && love.type === 'bug', love);
    check('"can\'t ... error" is an incident', login.desk.kind === 'incident' && login.type === 'incident');
    const plain = (await s.ok('GET', '/api/projects/plain-site')).cards[0];
    check('a project without the service gets no kind and stays a bug', !plain.desk && plain.type === 'bug', plain);

    // Owner changes the kind
    const set = (id, kind, headers = {}) => fetch(s.base + `/api/projects/desk-site/cards/${id}/desk`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ kind }) });
    check('a team (CLI) cannot change the kind', (await set(love.id, 'incident', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Lead' })).status === 403 && (await getCard(s, 'desk-site', love.id)).desk.kind === 'idea');
    check('a made-up kind is refused', (await set(love.id, 'party')).status === 400);
    check('the owner makes an idea an incident card', (await set(love.id, 'incident')).status === 200 && (await getCard(s, 'desk-site', love.id)).type === 'incident');
    await set(down.id, 'idea');
    const after = await getCard(s, 'desk-site', down.id);
    check('moving off incident gives the old type back and marks it hand-sorted', after.desk.kind === 'idea' && after.type === 'bug' && after.desk.auto === false, after);

    // Friend lane: Take sorts too
    await mkProject(b, 'Friend Side', 'FRS');
    const off = await s.ok('POST', '/api/shares', { slug: 'desk-site', contact: cb.id });
    await until(async () => (await b.ok('GET', '/api/shares')).find(l => l.id === off.id && l.state === 'incoming'));
    await b.ok('POST', `/api/shares/${off.id}/accept`, { slug: 'friend-side' });
    await until(async () => (await s.ok('GET', '/api/shares?slug=desk-site')).find(l => l.state === 'live'));
    const r = await b.ok('POST', `/api/shares/${off.id}/raise`, { type: 'bug', title: 'The checkout is broken' });
    await until(async () => (await s.ok('GET', `/api/shares/${off.id}/inbound`)).cards.find(c => c.share === r.share));
    const taken = await s.ok('POST', `/api/shares/${off.id}/inbound/${r.share}/take`);
    const tc = await getCard(s, 'desk-site', taken.id);
    check("a friend's card taken from the lane is sorted (broken = incident)", tc.desk && tc.desk.kind === 'incident' && tc.type === 'incident', tc);

    // 🔎 AIG-1105: duplicate hint
    const file = async (name, says) => { await send(name, says); await s.ok('POST', '/api/projects/' + name + '/feedback/pull', {}); return (await s.ok('GET', '/api/projects/' + name)).cards.filter(c => (c.description || '').includes(says)).pop(); };
    const A = await file('desk-site', 'The upload button crashes whenever the file is large');
    const A2 = await file('desk-site', 'The upload button crashes whenever the file is large');
    await new Promise(r => setTimeout(r, 800));
    const a2 = await getCard(s, 'desk-site', A2.id);
    check('the same report twice: the second says looks like the first (plain text)', a2.desk.dup && a2.desk.dup.id === A.id && a2.desk.dup.how === 'text', a2.desk);
    check('a plain-text match makes no AI call', callList().length === 0, callList());
    check('the first card has no hint', !(await getCard(s, 'desk-site', A.id)).desk.dup);
    await file('desk-site', 'Exporting the monthly invoice report to PDF fails with a long table');
    const B = await file('desk-site', 'Invoice report export to PDF is slow, monthly numbers');
    const first = (await s.ok('GET', '/api/projects/desk-site')).cards.find(c => (c.description || '').includes('Exporting the monthly'));
    await until(async () => (await getCard(s, 'desk-site', B.id)).desk.dup, 8000);
    const b2 = await getCard(s, 'desk-site', B.id);
    check('an unsure match asks Haiku once and gets the hint', b2.desk.dup && b2.desk.dup.id === first.id && b2.desk.dup.how === 'ai' && b2.desk.ai === true, b2.desk);
    check('exactly one tiny Haiku call, none for the other cards', callList().length === 1 && /^haiku /.test(callList()[0]), callList());
    await s.ok('POST', '/api/projects/desk-site/feedback/pull', {});
    await new Promise(r => setTimeout(r, 500));
    check('no second call for the same card later', callList().length === 1);
    const U = await file('desk-site', 'Zebras migrate across the savannah every autumn');
    await new Promise(r => setTimeout(r, 500));
    check('an unrelated report gets no hint and no call', !(await getCard(s, 'desk-site', U.id)).desk.dup && callList().length === 1);
    await s.ok('POST', '/api/notokens', { on: true });
    await file('desk-site', 'Calendar sync drops events from the shared team calendar');
    const C = await file('desk-site', 'Shared calendar sync duplicates events weekly');
    await new Promise(r => setTimeout(r, 800));
    check('No Token Mode: no AI call and no hint when unsure', callList().length === 1 && !(await getCard(s, 'desk-site', C.id)).desk.dup && !(await getCard(s, 'desk-site', C.id)).desk.cand, [callList().length, (await getCard(s, 'desk-site', C.id)).desk]);
    await s.ok('POST', '/api/notokens', { on: false });

    // The board filter and the picker on the card
    const pg = await openPage(ctx, '#/p/desk-site');
    await pg.waitForSelector('#filterbar select[data-f="desk"]');
    const n = async v => { await pg.selectOption('#filterbar select[data-f="desk"]', v); await pg.waitForTimeout(250); return pg.locator('#app .card').count(); };
    const all = await n(''), inc = await n('incident'), req = await n('request'), idea = await n('idea');
    const want = async k => (await s.ok('GET', '/api/projects/desk-site')).cards.filter(c => c.desk && c.desk.kind === k).length;
    check('the Desk filter shows only that kind', inc === await want('incident') && req === await want('request') && idea === await want('idea') && inc > 0 && req > 0 && idea > 0 && all > inc, { all, inc, req, idea });
    await pg.selectOption('#filterbar select[data-f="desk"]', '');
    await pg.click(`.card[data-id="${add.id}"]`);
    await pg.waitForSelector('#desk-kind');
    check('the open card has the Desk picker', (await pg.inputValue('#desk-kind')) === 'request');
    await pg.selectOption('#desk-kind', 'idea');
    check('picking a kind in the card saves it', !!(await until(async () => (await getCard(s, 'desk-site', add.id)).desk.kind === 'idea', 4000)));
    await pg.goto(pg.url().split('#')[0] + '#/p/desk-site/' + A2.id);
    await pg.waitForSelector('.desk-link');
    check('the card shows looks like AIG-x with a Link button', /looks like/.test(await pg.locator('.desk-dup').innerText()) && (await pg.locator('.desk-dup a').innerText()) === A.id);
    await pg.click('.desk-link');
    await until(async () => (await getCard(s, 'desk-site', A2.id)).desk.linked === A.id, 4000);
    const l2 = await getCard(s, 'desk-site', A2.id), l1 = await getCard(s, 'desk-site', A.id);
    check('Link keeps the link, drops the hint and notes both cards', l2.desk.linked === A.id && !l2.desk.dup && l2.comments.some(m => m.text.includes(A.id)) && l1.comments.some(m => m.text.includes(A2.id)), [l2.desk, l2.comments, l1.comments]);
    check('Link is owner only', (await fetch(s.base + '/api/projects/desk-site/cards/' + B.id + '/desk-link', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Lead' }, body: '{}' })).status === 403);
    noErrors(pg); await pg.close();
    const plainPg = await openPage(ctx, '#/p/plain-site');
    check('no Desk filter on a project with no desk cards', (await plainPg.locator('#filterbar select[data-f="desk"]').count()) === 0);
    await plainPg.close();
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_AGENT_COMMAND: stub, AIGILE_DM_POLL_MS: '300', AIGILE_PUBLIC_MS: '300', AIGILE_NO_FEEDBACK_POLL: '1' });
