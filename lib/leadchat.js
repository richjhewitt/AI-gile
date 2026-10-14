// 💬 Lead chat (AIG-872): one card-free chat per project between the owner and its lead, kept in data/<slug>.chat (not .json:
// every .json in data/ is a project). A message has no number, status or Done. The owner's messages wake the lead through
// presence.ownerNews (a made-up item, see `news`); the lead reads and answers with `aigile chat`.
const fs = require('fs');
const path = require('path');
const { DATA, now, isRich, writeAtomic } = require('./store');

const file = slug => path.join(DATA, String(slug).replace(/[\/]/g, '') + '.chat');
// Writers use strict(): only a missing file is an empty chat; a corrupt or unreadable one throws, so nothing overwrites the history.
// Readers (inbox, brief) use read(), which shows a damaged chat as empty rather than breaking every page.
const strict = slug => { let raw; try { raw = fs.readFileSync(file(slug), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return { msgs: [], readAt: '' }; throw e; } const j = JSON.parse(raw); if (!j || !Array.isArray(j.msgs || [])) throw new Error('chat file ' + slug + '.chat is damaged'); return { msgs: j.msgs || [], readAt: j.readAt || '' }; };
const read = slug => { try { return strict(slug); } catch { return { msgs: [], readAt: '' }; } };
const write = (slug, s) => writeAtomic(file(slug), JSON.stringify(s));
const KEEP = 500;   // the newest live messages kept; messages merged in by dmtidy (`merged: true`) are never trimmed

function add(slug, author, text, attachments, extra) {
  const s = strict(slug), m = { at: now(), author, text, mine: isRich(author), ...(attachments && attachments.length ? { attachments } : {}), ...(extra || {}) };
  s.msgs.push(m);
  const live = s.msgs.filter(x => !x.merged).length;
  if (live > KEEP) { let drop = live - KEEP; s.msgs = s.msgs.filter(x => x.merged || drop-- <= 0); }
  if (m.mine) s.readAt = m.at;
  write(slug, s); return m;
}
// Old 💬 DM cards moved in (AIG-873): merged by time; a message already there (same time, author, text) is not added twice. No trim: the archive holds the cards anyway.
function merge(slug, msgs) {
  const s = strict(slug), key = m => m.at + '|' + m.author + '|' + m.text + '|' + (m.attachments || []).map(a => a.id || a).join(','), seen = new Set(s.msgs.map(key));
  const fresh = msgs.filter(m => !seen.has(key(m)) && seen.add(key(m))).map(m => ({ ...m, merged: true }));
  if (fresh.length) { s.msgs = s.msgs.concat(fresh).map((m, i) => [m, i]).sort((a, b) => (a[0].at < b[0].at ? -1 : a[0].at > b[0].at ? 1 : a[1] - b[1])).map(x => x[0]); write(slug, s); }
  return fresh.length;
}
// The owner's messages since the lead last answered (what the lead still owes a reply).
function unanswered(slug) { const out = []; for (const m of read(slug).msgs.filter(x => !x.board).reverse()) { if (!m.mine) break; out.unshift(m); } return out; }
// The lead spoke last and the owner has not opened the chat since: it waits in the inbox. (The board's own replies, `board: true`, are not the lead.)
function waiting(slug) { const s = read(slug), last = s.msgs.filter(x => !x.board).at(-1); return !!last && !last.mine && last.at > s.readAt ? last : null; }
function markRead(slug) { const s = read(slug), last = s.msgs.at(-1); if (last && !(s.readAt >= last.at)) { s.readAt = last.at; write(slug, s); } }   // only when something is unread (AIG-1090): the page asks every 3 s
// For presence.ownerNews: the owner's messages after `since` as one made-up card, so every wake path (dispatch, hooks, updates) sees them.
function news(slug, since) {
  const items = read(slug).msgs.filter(m => m.mine && m.at > since).map(m => ({ kind: 'comment', text: m.text, at: m.at, attachments: m.attachments }));
  return items.length ? { c: { id: 'chat', title: '💬 Lead chat', status: 'team', type: 'chat', priority: 'normal', comments: [], leadChat: true }, items } : null;
}
// AIG-964: the owner's "remind me at 15:00 to call the barber" makes a 🏡 life-admin reminder with no AI, and the board answers in
// the chat. Only the owner's own message counts. The reply is added directly (never through the firewall) and marked `board`, so it
// is not owner news and not a lead reply. Returns the reply or null (not a reminder: nothing happens).
function remind(slug, author, text) {
  if (!isRich(author)) return null;
  const LA = require('./lifeadmin'), p = LA.parseRemind(text); if (!p) return null;
  const r = LA.addReminder({ text: p.text, due: p.due.toISOString() }), I = require('./i18n').t;
  const hh = String(p.due.getHours()).padStart(2, '0') + ':' + String(p.due.getMinutes()).padStart(2, '0');
  const when = I(p.tomorrow ? 'srv.remind.tomorrow' : 'srv.remind.today', { time: hh });
  return add(slug, 'Board', I('srv.remind.set', { text: r.text, when }), null, { board: true });
}
module.exports = { remind, read, add, merge, unanswered, waiting, markRead, news };
