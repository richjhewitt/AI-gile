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
  console.log(JSON.stringify(r));
})();
