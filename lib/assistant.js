// 💚 Personal assistant chat (AIG-1021): the day helper has a chat, pinned in Messages under All hands. Plain code, no AI:
// "remind me at 3 to ..." makes a 🏡 reminder (leadchat.remind), "start my day" / "today" opens the Start my day check-in
// (the page's MyDay dialog), "help" says what it does; anything else goes to the 🧭 Lead Scrum Master (watchman.relay).
// Messages live in data/_assistant.chat like a Lead chat's.
const LC = require('./leadchat');
const ID = '_assistant', CARD = '_lead';   // the page groups a card-free chat under '_lead'
const tr = (k, v) => require('./i18n').t(k, v);

function thread() {
  const s = LC.read(ID);
  return { slug: ID, name: tr('pa.name'), lead: tr('pa.name'), emoji: '💚', assistant: true, open: [], cards: { [CARD]: { title: tr('pa.name'), kind: 'other' } }, team: [], unread: 0,
    messages: s.msgs.map(m => ({ card: CARD, title: tr('pa.name'), author: m.author, text: m.text, at: m.at, mine: !!m.mine })) };
}
const say = text => LC.add(ID, tr('pa.name'), text, null, { board: true });
function handle(text) {
  text = String(text || '').trim(); if (!text) throw Object.assign(new Error('text is required'), { status: 400 });
  const owner = require('./store').owner();
  LC.add(ID, owner, text);
  if (LC.remind(ID, owner, text)) return { ok: true };   // the reminder's confirmation is in the chat
  if (/^\W*(start (of )?my day|today)\W*$/i.test(text)) { say(tr('srv.pa.day')); return { ok: true, openDay: true }; }
  if (/^\W*help\W*$/i.test(text)) { say(tr('srv.pa.help')); return { ok: true }; }
  try { require('./watchman').relay(text, [], false); say(tr('srv.pa.passed')); }
  catch (e) { say(tr('srv.pa.failed', { why: e.message || String(e) })); }
  return { ok: true };
}
module.exports = { ID, thread, handle };
