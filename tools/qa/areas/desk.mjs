// QA area: desk (AIG-1104, AIG-1105): service desk sorting. Cards that come in from the public feedback form and from a friend (the
// lane, Take) on a project where the service is on get a desk kind by plain rules (broken/down/error/can't -> incident, please add /
// could you / feature -> request, else idea); an incident is made an incident card; a project without the service is left alone; the
// owner (only) can change the kind; the board filter "Desk: requests / incidents / ideas".
import { freePort, startRelay, startServer, until, check, mkProject, getCard, openPage, noErrors, def } from '../lib.mjs';
import { pair } from './share.mjs';

def('desk', '🛎️ service desk: form and friend cards get a kind (request / incident / idea) by plain rules only where the service is on, owner changes it, board filter (AIG-1104)', async (s, ctx) => {
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

    // The board filter and the picker on the card
    const pg = await openPage(ctx, '#/p/desk-site');
    await pg.waitForSelector('#filterbar select[data-f="desk"]');
    const n = async v => { await pg.selectOption('#filterbar select[data-f="desk"]', v); await pg.waitForTimeout(250); return pg.locator('#app .card').count(); };
    const all = await n(''), inc = await n('incident'), req = await n('request'), idea = await n('idea');
    check('the Desk filter shows only that kind', all >= 5 && inc === 3 && req === 1 && idea === 1, { all, inc, req, idea });
    await pg.selectOption('#filterbar select[data-f="desk"]', '');
    await pg.click(`.card[data-id="${add.id}"]`);
    await pg.waitForSelector('#desk-kind');
    check('the open card has the Desk picker', (await pg.inputValue('#desk-kind')) === 'request');
    await pg.selectOption('#desk-kind', 'idea');
    check('picking a kind in the card saves it', !!(await until(async () => (await getCard(s, 'desk-site', add.id)).desk.kind === 'idea', 4000)));
    noErrors(pg); await pg.close();
    const plainPg = await openPage(ctx, '#/p/plain-site');
    check('no Desk filter on a project with no desk cards', (await plainPg.locator('#filterbar select[data-f="desk"]').count()) === 0);
    await plainPg.close();
  } finally { b.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300', AIGILE_PUBLIC_MS: '300', AIGILE_NO_FEEDBACK_POLL: '1' });
