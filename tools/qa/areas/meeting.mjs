// QA area: meeting (AIG-1168): 🎥 each project's standing Meeting Room in Messages: a group chat whose members are the project's
// live agents (read from the roster), plus a Join call button on the same call module with a room worked out on the board
// (this board + the project). Owner only for the call; an archived or unknown project has no room.
import crypto from 'node:crypto';
import { check, tmp, mkProject, openPage, noErrors, def, sleep, startRelay } from '../lib.mjs';

const SECDIR = tmp('meetsec');
const claims = tok => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));

def('meeting', '🎥 Meeting Room per project: listed in Messages with the roster as members, chat works, Join call gets a per-project room token (owner only, not set up -> 409), page head button fits a phone (AIG-1168)', async (s, ctx) => {
  const as = (method, url, headers, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) }).then(r => r.status);
  await mkProject(s, 'Pix', 'PIX'); await mkProject(s, 'Clo', 'CLO'); await mkProject(s, 'Solo', 'SOL');
  await s.ok('POST', '/api/projects/pix/team', { name: 'Pixel', role: 'Lead' });
  await s.ok('POST', '/api/projects/pix/team', { name: 'Pat', role: 'Reviewer' });
  await s.ok('POST', '/api/projects/clo/team', { name: 'Claudia', role: 'Lead' });
  await s.ok('POST', '/api/projects/solo/team', { name: 'Solly', role: 'Tester' });

  const list = await s.ok('GET', '/api/chats/_meetings');
  const px = list.find(g => g.meeting === 'pix'), cl = list.find(g => g.meeting === 'clo');
  check('each project with a lead has its room in the list (none for one without; the groups list stays groups only)', !!px && !!cl && !list.some(g => g.meeting === 'solo'), list.map(g => g.id));
  check('the plain groups list has no rooms in it', !(await s.ok('GET', '/api/chats/_groups')).some(g => g.meeting));
  check('the room is named for the project, id meeting-<slug>', px.id === 'meeting-pix' && /Meeting Room: Pix/.test(px.name), px);
  check('its members are that project\'s leads only (helpers are not woken)', px.members.map(m => m.name).join() === 'Pixel' && cl.members.map(m => m.name).join() === 'Claudia', [px.members, cl.members]);
  check('nothing is saved until the first word', !(await s.ok('GET', '/api/chats/_groups/meeting-pix')).messages.length);

  // the roster follows: a new lead is a member at once
  await s.ok('POST', '/api/projects/pix/team', { name: 'Newt', role: 'Co-lead' });
  check('a new lead on the roster is in the room', (await s.ok('GET', '/api/chats/_groups/meeting-pix')).members.some(m => m.name === 'Newt'));
  // AIG-1379: other projects' leads that once helped here stay out; a second lead (Lead (Opus)) is in; rooms read A to Z
  for (const m of [{ name: 'Lead-LocoRadio' }, { name: 'Medic Lead' }, { name: 'Melon', role: "Helper (MelonFarmer's lead)" }, { name: 'Lead (Opus)' }]) await s.ok('POST', '/api/projects/pix/team', m);
  const pxm = (await s.ok('GET', '/api/chats/_groups/meeting-pix')).members.map(m => m.name);
  check("only this project's leads: no visiting leads or helpers", pxm.join() === 'Pixel,Newt,Lead (Opus)', pxm);
  const names = (await s.ok('GET', '/api/chats/_meetings')).map(g => g.name);
  check('rooms are listed A to Z', names.join() === [...names].sort((a, b) => a.localeCompare(b)).join(), names);

  // chat: the owner writes, a member answers, anybody reads
  const w = await s.ok('POST', '/api/chats/_groups/meeting-pix', { text: 'stand-up in five' });
  check('the owner can write in the room', w.ok === true);
  await s.ok('POST', '/api/chats/_groups/meeting-pix/say', { as: 'Pixel', text: 'on it' });
  const th = await s.ok('GET', '/api/chats/_groups/meeting-pix');
  check('the thread has both lines, flagged as a meeting', th.meeting === 'pix' && th.messages.some(m => m.mine && m.text === 'stand-up in five') && th.messages.some(m => m.author.startsWith('Pixel') && m.text === 'on it'), th.messages);
  check('someone who is not on the roster cannot speak in it', (await s.api('POST', '/api/chats/_groups/meeting-pix/say', { as: 'Claudia', text: 'hi' })).status === 400);
  check('a team call cannot write as the owner (403)', await as('POST', '/api/chats/_groups/meeting-pix', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Pixel' }, { text: 'x' }) === 403);
  check('a project that does not exist has no room (404)', (await s.api('GET', '/api/chats/_groups/meeting-nope')).status === 404);

  // the call: not set up first
  check('call state: not set up', (await s.ok('GET', '/api/calls/meeting/pix')).set === false);
  const ns = await s.api('POST', '/api/calls/meeting/pix/token', {});
  check('no call server: the token route says so (409)', ns.status === 409 && /not available/.test(ns.body.error || ''), ns);

  // the page: head button, not-set-up note, phone width
  const page = await openPage(ctx, '#/');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.evaluate(() => Dms.show('grp:meeting-pix'));
  await page.waitForSelector('#dmMeetBtn');
  check('the room shows the Join call button', /Join call/.test(await page.locator('#dmMeetBtn').innerText()));
  check('rooms are not in the main list, only under the 🎥 Meeting Rooms tab, which is remembered (AIG-1188)', await page.evaluate(async () => { await Dms.back(); const tick = () => new Promise(r => setTimeout(r, 150)); document.querySelector('[data-dmfilter="all"]').click(); await tick(); const inAll = !!document.querySelector('[data-dm="grp:meeting-pix"]'); document.querySelector('[data-dmfilter="meet"]').click(); await tick(); const av = document.querySelector('[data-dm="grp:meeting-pix"] .dm-av'); return !inAll && !!av && av.textContent === '🎥' && localStorage.getItem('aigile.dmfilter') === 'meet'; }));
  await page.evaluate(() => Dms.show('grp:meeting-pix'));
  await page.waitForSelector('#dmMeetBtn');
  await page.click('#dmMeetBtn');
  await page.waitForSelector('#callNote');
  check('not available: plain English pointing at Setup → Calls', /not available/.test(await page.locator('#callNote').innerText()) && await page.locator('#callNoteGo').count() === 1);
  const fit = await page.evaluate(() => { const h = document.querySelector('#dmPanel .dm-head'), b = document.getElementById('dmMeetBtn').getBoundingClientRect(); return { over: document.documentElement.scrollWidth > innerWidth, btnRight: Math.round(b.right), head: Math.round(h.getBoundingClientRect().right), w: innerWidth }; });
  check('phone width (390): no sideways scroll, the button inside the screen', !fit.over && fit.btnRight <= fit.w, fit);
  const lines = await page.evaluate(() => { const one = e => { const s = getComputedStyle(e); return e.getBoundingClientRect().height < parseFloat(s.lineHeight || '18') * 1.6 + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + 4; }; return { join: one(document.getElementById('dmMeetBtn')), pop: !document.getElementById('dmPop') || one(document.getElementById('dmPop')), sub: one(document.querySelector('#dmPanel .dm-sub')) }; });
  check('Join call, Pop out and the member line each stay on one line (AIG-1379)', lines.join && lines.pop && lines.sub, lines);
  await page.emulateMedia({ colorScheme: 'dark' });
  check('dark mode: the button text is readable (not same colour as its background)', await page.evaluate(() => { const c = getComputedStyle(document.getElementById('dmMeetBtn')); return c.color !== c.backgroundColor; }));
  // AIG-1189: the rooms list polls like the groups list (not held until the board's revision changes)
  const before = await page.evaluate(() => PagePoll.get('/api/chats/_meetings'));
  await s.ok('POST', '/api/chats/_groups/meeting-pix/say', { as: 'Pixel', text: 'fresh reply papaya' });
  await sleep(1200);
  const after = await page.evaluate(() => PagePoll.get('/api/chats/_meetings'));
  check('a new line in a room shows in the next poll of the rooms list', !before.find(g => g.id === 'meeting-pix').lastText.includes('papaya') && after.find(g => g.id === 'meeting-pix').lastText.includes('papaya'), after.map(g => g.lastText));
  noErrors(page);

  // AIG-1218: out of the box through the relay's call server (a relay without one = 404 = not available)
  const RL_SECRET = 'qa-meet-relay-secret-5', relayOff = await startRelay(), relayOn = await startRelay({ RELAY_LIVEKIT_URL: 'wss://call.example.test', RELAY_LIVEKIT_KEY: 'APIqaMeetRelay', RELAY_LIVEKIT_SECRET: RL_SECRET });
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relayOff.base });
    check('a relay without a call server: still not available', (await s.ok('GET', '/api/calls/meeting/pix')).set === false && (await s.api('POST', '/api/calls/meeting/pix/token', {})).status === 409);
    await s.ok('POST', '/api/dms/settings', { relay: relayOn.base });
    check('a relay with a call server: calls work, nothing set up (DMs can stay off)', (await s.ok('GET', '/api/calls/meeting/pix')).set === true);
    const r1 = await s.ok('POST', '/api/calls/meeting/pix/token', { room: 'someone-elses-room' }), rc = claims(r1.token);
    const rwant = 'aigile-meet-' + crypto.createHash('sha256').update('aigile-meet-v1|' + rc.sub + '|pix').digest('hex').slice(0, 32);
    const [rh, rp, rs] = r1.token.split('.');
    check('relay pass: signed by the relay\'s secret, this board\'s Meeting Room (own mailbox + slug), its URL', crypto.createHmac('sha256', RL_SECRET).update(rh + '.' + rp).digest('base64url') === rs && r1.room === rwant && rc.video.room === rwant && rc.iss === 'APIqaMeetRelay' && r1.url === 'wss://call.example.test', rc);
    check('relay pass: another project is another room', (await s.ok('POST', '/api/calls/meeting/clo/token', {})).room !== r1.room);
    check('relay pass: still owner only (403 for a team)', await as('POST', '/api/calls/meeting/pix/token', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Pixel' }, {}) === 403);
    const pg = await openPage(ctx, '#/setup/calls');
    await pg.waitForSelector('#callSetState');
    check('Setup → Calls: "Calls work out of the box", own server folded', /out of the box/.test(await pg.locator('#callSetState').innerText()) && !(await pg.locator('#callSetAdv').evaluate(d => d.open)));
    noErrors(pg);
  } finally { relayOff.stop(); }

  // set up, then the token
  const tok = (await s.ok('GET', '/api/secrets/token')).token;
  await s.ok('POST', '/api/calls', { url: 'wss://livekit.example.test', key: 'APIqaMeet', secret: 'qa-meet-secret-77', token: tok });
  check('call state: ready', (await s.ok('GET', '/api/calls/meeting/pix')).set === true);
  const t1 = await s.ok('POST', '/api/calls/meeting/pix/token', { room: 'someone-elses-room' });
  const t2 = await s.ok('POST', '/api/calls/meeting/clo/token', {});
  const c1 = claims(t1.token), mailbox = c1.sub;
  const want = 'aigile-meet-' + crypto.createHash('sha256').update('aigile-meet-v1|' + mailbox + '|pix').digest('hex').slice(0, 32);
  const [h, p, sig] = t1.token.split('.');
  check('token: signed with the API secret, room from the board (not the page), for 2 hours, joins and publishes', crypto.createHmac('sha256', 'qa-meet-secret-77').update(h + '.' + p).digest('base64url') === sig && t1.room === want && c1.video.room === want && c1.video.roomJoin === true && c1.video.canPublish === true && Math.abs(c1.exp - Date.now() / 1000 - 7200) < 30, c1);
  check('another project is another room', t2.room !== t1.room && claims(t2.token).video.room === t2.room && /^aigile-meet-/.test(t2.room));
  check('the answer carries no secret', !JSON.stringify(t1).includes('qa-meet-secret-77'));
  check('an unknown project: 404', (await s.api('POST', '/api/calls/meeting/nope/token', {})).status === 404);
  check('a team call is refused (403)', await as('POST', '/api/calls/meeting/pix/token', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Pixel' }, {}) === 403);
  check('a background run is refused (403)', await as('POST', '/api/calls/meeting/pix/token', { 'X-Aigile-Where': 'background' }, {}) === 403);
  check('a team call cannot read the state either (403)', await as('GET', '/api/calls/meeting/pix', { 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Pixel' }) === 403);

  await s.ok('POST', '/api/calls', { clear: true, token: tok });
  relayOn.stop();
}, true, { AIGILE_SECRETS_DIR: SECDIR });
