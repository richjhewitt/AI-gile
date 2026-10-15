// Run by the QA area "discord": the bridge against a stubbed fetch (no network, no board). Prints one JSON line.
const fs = require('fs');
const root = process.argv[2];
fs.writeFileSync(process.env.AIGILE_LOCAL, JSON.stringify({ discord: { bots: [{ name: 'lead', token: 'TKN', users: ['123456789'], target: 't' }] } }));
const st = require(root + '/lib/store'), sent = [], calls = [];
st.save({ slug: 't', name: 'T', cards: [{ id: 'T-1', title: 'q', status: 'team', needsYou: true, updated: '2026-01-01', comments: [] }], team: [], log: [] });
global.fetch = async (u, o) => {
  const b = o && o.body ? JSON.parse(o.body) : null;
  if (u.startsWith('http://localhost')) { calls.push([o.method, u.replace(/^http:\/\/localhost:\d+/, ''), b]); return { ok: true, json: async () => ({ id: 'T-1' }) }; }
  sent.push([u.replace(/.*v10/, ''), b]); return { ok: true, status: 200, json: async () => ({ id: 'CH1' }) };
};
const d = require(root + '/lib/discord'), bot = d.bots()[0];
(async () => {
  const r = {};
  r.stranger = await d.handleMessage(bot, { author: { id: '9' }, content: 'hi' });
  r.guild = await d.handleMessage(bot, { author: { id: '123456789' }, guild_id: '1', content: 'hi' });
  r.bot = await d.handleMessage(bot, { author: { id: '123456789', bot: true }, content: 'hi' });
  r.ok = await d.handleMessage(bot, { author: { id: '123456789' }, content: 'yes go' });
  r.first = d.newReplies(bot);
  const p = st.load('t');
  p.cards[0].comments.push({ author: 'Lead', text: 'Done it', at: new Date(Date.now() + 5000).toISOString() }, { author: st.owner(), text: 'mine', at: new Date(Date.now() + 6000).toISOString() });
  st.save(p);
  r.sent = await d.sendReplies(bot); r.sentCalls = sent; r.again = await d.sendReplies(bot); r.calls = calls;
  r.status = d.status(); r.chunks = d.chunks('x'.repeat(4000)).map(c => c.length);
  // Link my Discord (AIG-1011)
  const lk = d.linkStart('lead'), users = () => JSON.parse(fs.readFileSync(process.env.AIGILE_LOCAL, 'utf8')).discord.bots[0].users;
  r.code = lk.code; r.wait = d.linkStatus('lead');
  r.rand = await d.handleMessage(bot, { author: { id: '777777' }, content: 'hello' });
  r.wrong = await d.handleMessage(bot, { author: { id: '777777' }, content: lk.code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA' });
  r.guildCode = await d.handleMessage(bot, { author: { id: '777777' }, guild_id: '1', content: lk.code });
  r.botCode = await d.handleMessage(bot, { author: { id: '777777', bot: true }, content: lk.code });
  r.usersBefore = users();
  const mark = sent.length;
  r.good = await d.handleMessage(bot, { author: { id: '777777', username: 'Rich' }, content: ' ' + lk.code.toLowerCase() + ' ' });
  await new Promise(x => setTimeout(x, 100));
  r.usersAfter = users(); r.done = d.linkStatus('lead'); r.thanks = JSON.stringify(sent.slice(mark));
  r.reuse = await d.handleMessage(d.bots()[0], { author: { id: '888888' }, content: lk.code });
  r.usersFinal = users();
  const lk2 = d.linkStart('lead'), real = Date.now; Date.now = () => real() + 11 * 60e3;
  r.late = await d.handleMessage(d.bots()[0], { author: { id: '888888' }, content: lk2.code }); r.exp = d.linkStatus('lead'); Date.now = real;
  r.usersEnd = users();
  r.words = [[400, 50033], [404, 10013], [403, 50007], [401, 0], [400, 0]].map(([a, c]) => d.restWords(a, c));
  // Invite link (AIG-1019): the bot is in no server, then in one
  let guilds = [];
  global.fetch = async u => ({ ok: true, status: 200, json: async () => u.endsWith('/applications/@me') ? { id: '4242' } : guilds });
  r.in0 = (await d.statusFull())[0]; guilds = [{ id: '1' }]; r.cached = (await d.statusFull())[0].inServer;
  d.saveConfig([{ name: 'lead', users: '123456789', target: 't' }]); r.in1 = (await d.statusFull())[0];
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ code: 50033, message: 'Invalid Recipient(s)' }) });
  console.warn = () => {};
  try { await d.test('lead'); r.err = 'none'; } catch (e) { r.err = e.message; }
  console.log(JSON.stringify(r));
})();
