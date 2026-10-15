// QA area: discordtab (AIG-557, AIG-559). The Discord tab in the DM window, against a stubbed Discord REST (a tiny http server in this
// process; the board is told about it through AIGILE_DISCORD_API, and AIGILE_DISCORD_STUB lets a test stand in for the gateway).
import http from 'node:http';
import { freePort, check, until, mkProject, openPage, noErrors, def } from '../lib.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const port = await freePort();
const sent = [], hist = [{ id: '1', author: { id: '123456789', username: 'Rich' }, content: 'hello bot', timestamp: '2026-01-01T10:00:00.000Z', attachments: [{ url: `http://127.0.0.1:${port}/pic.png`, content_type: 'image/png', filename: 'pic.png' }] }];
const stub = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const j = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    const u = req.url.split('?')[0];
    if (u === '/pic.png') { res.setHeader('Content-Type', 'image/png'); return res.end(PNG); }
    if (req.method === 'POST' && u === '/users/@me/channels') return j({ id: 'DM1', recipients: [{ username: 'rich', global_name: 'Rich' }] });
    if (u === '/users/@me/guilds') return j([{ id: 'G1', name: 'Guild' }]);
    if (u === '/guilds/G1/channels') return j([{ id: 'C1', type: 0, name: 'general' }, { id: 'C2', type: 2, name: 'voice' }]);
    if (req.method === 'GET' && u === '/channels/DM1/messages') return j(hist);
    if (req.method === 'GET' && /^\/channels\/C1\/messages/.test(u)) return j([]);
    if (req.method === 'POST' && u === '/channels/DM1/messages') { const b = JSON.parse(body); sent.push(b.content); hist.push({ id: String(hist.length + 1), author: { id: 'BOT', username: 'Helper', bot: true }, content: b.content, timestamp: new Date().toISOString(), attachments: [] }); return j({ id: 'x' }); }
    res.statusCode = 404; j({});
  });
});
await new Promise(r => stub.listen(port, '127.0.0.1', r));

def('discordtab', 'Discord tab in the DM window: hidden with no bot, chats and channels listed, reply goes out, unread badge, browser notification, pictures inline, message reaches the lead\'s chat (AIG-557/559)', async (s, ctx) => {
  try {
    await mkProject(s, 'Alpha', 'ALP');
    await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
    check('no bot: the page says not linked', (await s.ok('GET', '/api/discord/unread')).linked === false);
    const page = await openPage(ctx, '#/');
    await page.click('#dmRail [data-dms]'); await page.waitForSelector('#dmPanel .dm-filter');
    check('no bot: there is no Discord tab', await page.locator('[data-dmfilter="discord"]').count() === 0);

    // Link a bot
    const cfg = await s.ok('POST', '/api/discord/config', { bots: [{ name: 'Helper', token: 'SECRET-TKN', users: '123456789', target: 'alpha' }] });
    check('the saved config never carries the token', !JSON.stringify(cfg).includes('SECRET-TKN'));
    const pg = await openPage(ctx, '#/');
    await pg.click('#dmRail [data-dms]');
    await pg.waitForSelector('[data-dmfilter="discord"]');
    check('with a bot the Discord tab appears', true);
    await pg.click('[data-dmfilter="discord"]');
    await pg.waitForSelector('#dmPanel .dm-row');
    const rows = await pg.locator('#dmPanel .dm-row b').allTextContents();
    check('lists the chat with you and the text channel, not the voice one', rows.includes('Rich') && rows.includes('#general') && !rows.includes('#voice'), rows);
    const chats = await s.ok('GET', '/api/discord/chats');
    check('the chats list never carries the token', !JSON.stringify(chats).includes('SECRET-TKN') && chats.length === 2);
    check('a channel the bot does not have is refused', (await s.api('GET', '/api/discord/messages?bot=Helper&channel=NOPE')).status === 404 && (await s.api('POST', '/api/discord/send', { bot: 'Helper', channel: 'NOPE', text: 'x' })).status === 404);

    // A DM from Discord: unread badge, and the lead's chat gets it
    const m = await s.ok('POST', '/api/discord/stub-message', { bot: 'Helper', author: '123456789', channel: 'DM1', content: 'hi from discord' });
    check('a stranger is not heard (no unread, no card)', (await s.ok('POST', '/api/discord/stub-message', { bot: 'Helper', author: '999999', channel: 'DM1', content: 'spam' })).routed === null && (await s.ok('GET', '/api/discord/unread')).total === 1);
    const card = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => /hi from discord/.test(c.title + c.description));
    check('the message lands in the lead\'s chat as a quick card', !!card && card.quick === true && m.routed && m.routed.to === 'alpha', JSON.stringify(m));
    const ch = await s.ok('GET', '/api/chats/alpha');
    check('and shows in that lead\'s DM thread', JSON.stringify(ch).includes('hi from discord'));
    await until(async () => await pg.locator('[data-dmfilter="discord"] .dm-unread').count() === 1, 8000);
    check('the Discord tab shows an unread badge', await pg.locator('[data-dmfilter="discord"] .dm-unread').count() === 1);
    check('and so does the rail 💬', await pg.locator('#dmRail [data-dms] .dm-unread').count() === 1);

    // Read and reply
    await pg.locator('#dmPanel .dm-row', { hasText: 'Rich' }).click();
    await pg.waitForSelector('#dmList .dm-msg');
    check('the chat shows the message and the picture inline', /hello bot/.test(await pg.textContent('#dmList')) && await pg.locator('#dmList img.dc-pic').count() === 1);
    check('the picture loads from its Discord URL', await pg.evaluate(() => new Promise(r => { const i = document.querySelector('#dmList img.dc-pic'); i.complete ? r(i.naturalWidth > 0) : (i.onload = () => r(true), i.onerror = () => r(false)); })));
    check('opening the chat clears the unread', (await s.ok('GET', '/api/discord/unread')).total === 0);
    await pg.fill('#dmText', 'hello back'); await pg.click('#dcSend');
    await until(async () => sent.includes('hello back'), 5000);
    check('the reply went out through the bot', sent.includes('hello back'), sent);
    await pg.waitForFunction(() => /hello back/.test(document.getElementById('dmList').textContent));
    check('and shows in the chat as mine', await pg.locator('#dmList .dm-msg.mine').count() >= 1);
    noErrors(pg); await pg.close();

    // A browser notification when the page is hidden
    const np = await ctx.newPage(); np.errors = [];
    await np.addInitScript(() => {
      localStorage.setItem('aigile.alerts', '1'); localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv'));
      window.__notes = []; window.Notification = class { constructor(t, o) { window.__notes.push([t, o && o.body]); } close() {} static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    });
    await np.goto(s.base + '/#/'); await np.waitForSelector('#app > *');
    await s.ok('POST', '/api/discord/stub-message', { bot: 'Helper', author: '123456789', channel: 'DM1', content: 'ping while away' });
    await np.waitForFunction(() => window.__notes.length > 0, null, { timeout: 10000 }).catch(() => {});
    const notes = await np.evaluate(() => window.__notes);
    check('a hidden page gets a browser notification with who and what', notes.length >= 1 && /Rich|Discord/.test(notes[0][0]) && /ping while away/.test(notes[0][1]), JSON.stringify(notes));
  } finally { stub.close(); }
}, true, { AIGILE_DISCORD_API: `http://127.0.0.1:${port}`, AIGILE_DISCORD_GATEWAY: 'ws://127.0.0.1:9', AIGILE_DISCORD_STUB: '1' });
