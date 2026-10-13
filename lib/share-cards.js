// Sharing (AIG-305): my cards and comments going to the friend. The 🔗 preview and send, unshare, my whole board
// (AIG-324), assign, and the hooks the card and comment routes call. Built on share-base.js.
const fs = require('fs');
const crypto = require('crypto');
const { now, load, save, bad } = require('./store');
const dm = require('./dm');
const { fileOf: attachmentFile } = require('./attachments');
const { CAPS, cleanName, FIELDS, roleOf, canOf, read, change, link, ofProject, effective, shown, queueOn, sendOn, cleanText, safeName, payloadOf, hashOf, scrub, scrubMsg, liveFor, cardOf } = require('./share-base');

// 🔗 on a card, step 1: exactly what would be sent, and what the scrub flags. Nothing is sent.
// files (AIG-306): the card's own attachments that would go too, when both of us allow attachments.
function preview(id, cardId) {
  const L = link(id), { p, c } = cardOf(L, cardId), payload = payloadOf(c);
  return { payload, fields: FIELDS, flags: scrub(payload, p), shared: c.share && c.share.link === id ? c.share : null,
    files: (effective(L) || {}).files ? filesToSend(L, c).map(a => ({ name: a.name, size: a.size, big: a.size > CAPS.file })) : [] };
}
// The card's own attachments (data/attachments/<slug>/, from a raised bug or a paste), not sent before on this link.
function filesToSend(L, c) {
  const sent = new Set((((L.outbound || {})[c.share && c.share.id] || {}).files) || []);
  return (c.attachments || []).filter(a => a && a.id && !sent.has(a.id)).slice(0, CAPS.filesPerCard);
}
// One sealed message per file, data only. Too big, gone, or over the cap: skipped (and said so).
async function sendFiles(L, p, c) {
  const out = { sent: [], skipped: [] };
  if (!(effective(L) || {}).files) return out;
  const already = (((L.outbound || {})[c.share.id] || {}).files || []).length;
  for (const a of filesToSend(L, c)) {
    let buf = null;
    try { buf = fs.readFileSync(attachmentFile(p.slug, a.id)); } catch {}
    if (!buf || buf.length > CAPS.file || already + out.sent.length >= CAPS.filesPerCard) { out.skipped.push(a.name); continue; }
    await sendOn(L.id, 'file', { share: c.share.id, name: safeName(a.name), type: String(a.type || '').slice(0, 100), data: buf.toString('base64') });
    change(L.id, L => { const o = L.outbound[c.share.id]; (o.files = o.files || []).push(a.id); });
    out.sent.push(a.name);
  }
  return out;
}
// 🔗 on a card, step 2: { card, force? }. Sends the allow-listed payload with a share id (never my card id or slug).
// Flags from the scrub refuse it unless force (I looked at the preview and said send anyway). Again later: an update.
async function shareCard(id, b = {}) {
  const L = liveFor(id, 'sendCards'), { p, c } = cardOf(L, b.card), payload = payloadOf(c), flags = scrub(payload, p);
  if (c.share && c.share.theirs) throw bad('this card came from ' + shown(L).friend + ': it is already theirs', 409);
  if (!canOf(L).seeMine) throw bad(shown(L).friend + ' is a ' + roleOf(L) + ' on this link: they only see their own cards', 409);
  if (c.share && c.share.link !== id) throw bad('this card is shared on another link', 409);
  if (!c.share && Object.values(L.outbound || {}).filter(o => !o.stopped).length >= CAPS.cards) throw bad('this link already shares ' + CAPS.cards + ' cards', 409);
  if (flags.length && !b.force) throw bad(scrubMsg(flags), 409);
  const share = c.share ? c.share.id : crypto.randomBytes(12).toString('base64url');
  c.share = { link: id, id: share, mine: true, at: c.share ? c.share.at : now(), sent: hashOf(payload), sentAt: now(), sentStatus: c.status };
  save(p);
  // Merged, not replaced: their status label, a test I handed them and the files already sent stay (AIG-306).
  change(id, L => { const o = L.outbound = L.outbound || {}; o[share] = { ...(o[share] || {}), card: c.id, at: c.share.at }; delete o[share].stopped; });
  await sendOn(id, 'card', { share, ...payload });
  if (effective(read(id)).status || read(id).board) await sendOn(id, 'status', { share, status: c.status });
  const files = await sendFiles(read(id), p, c);
  return { card: c.id, share: c.share, payload, files };
}
// Untick 🔗: nothing more is sent, and their comments on it are dropped from now on. Their copy stays theirs.
function unshareCard(id, cardId) {
  const L = link(id), { p, c } = cardOf(L, cardId);
  if (!c.share || c.share.link !== id || !c.share.mine) throw bad('this card is not shared', 409);
  const share = c.share.id;
  delete c.share; save(p);
  change(id, L => { if (L.outbound && L.outbound[share]) L.outbound[share].stopped = now(); });
  return { card: c.id, shared: false };
}
/* ---------- my whole board for them (AIG-324) ---------- */
// "Show {friend} my whole board": every card of mine on the project is shared, now and as it is made, through the
// same allow-listed card messages and the same scrub (a flagged card is not sent: it waits until it is clean, or I
// send it from the 🔗 preview). Never cards that came from them. Sync, so a route can call it before it saves;
// the caller flushes. Returns 'sent', 'held' (the scrub) or ''.
function autoShare(L, p, c) {
  if (!L || L.state !== 'live' || L.on === false || !L.board || !canOf(L).seeMine || !(effective(L) || {}).sendCards) return '';
  if (c.share || String(c.from || '').startsWith('share:')) return '';
  if (Object.values(L.outbound || {}).filter(o => !o.stopped).length >= CAPS.cards) return '';
  const payload = payloadOf(c);
  if (scrub(payload, p).length) return 'held';
  const share = crypto.randomBytes(12).toString('base64url'), at = now();
  c.share = { link: L.id, id: share, mine: true, auto: true, at, sent: hashOf(payload), sentAt: at, sentStatus: c.status };
  change(L.id, L => { const o = L.outbound = L.outbound || {}; o[share] = { card: c.id, at }; });
  queueOn(L.id, 'card', { share, ...payload });
  queueOn(L.id, 'status', { share, status: c.status });   // the column it sits in on my board: a label there
  return 'sent';
}
async function shareAll(id) {
  const L = read(id), p = load(L.slug), out = { sent: 0, held: 0 };
  if (!p) return out;
  for (const c of p.cards) {
    // A card I ticked 🔗 before: its column goes now, as a label (status follows may have been off).
    if (c.share && c.share.mine && c.share.link === id) { queueOn(id, 'status', { share: c.share.id, status: c.status }); c.share.sentStatus = c.status; out.status = (out.status || 0) + 1; continue; }
    const r = autoShare(read(id), p, c); if (r) out[r]++;
  }
  if (out.sent || out.status) save(p);
  await dm.flush().catch(() => {});
  return out;
}
// { assigned } (AIG-307): put the friend on one of my shared cards. A Member or Tester acts (their status label)
// only on cards assigned to them; they are told, so their board can show it. Never an assignee in my team.
async function assignCard(id, cardId, b = {}) {
  const L = liveFor(id), { p, c } = cardOf(L, cardId), on = b.assigned === true;
  if (!c.share || c.share.link !== id || !c.share.mine) throw bad('share this card first', 409);
  if (on) c.share.assigned = true; else delete c.share.assigned;
  save(p);
  change(id, L => { const o = L.outbound[c.share.id]; if (on) o.assigned = true; else delete o.assigned; });
  await sendOn(id, 'assign', { share: c.share.id, on });
  return { card: c.id, assigned: on };
}
// A card of mine changed (PATCH route, before it saves): send the update if the allow-listed fields changed and the
// scrub is clean; otherwise hold it (c.share.held) until I send it from the 🔗 preview. Never throws.
// Its status (AIG-306), mine or theirs that I took: sent as a label when both of us allow "status follows". Also
// called by the comment and verdict routes, which move cards too.
function cardChanged(p, c) {
  try {
    if (!c.share) {   // a new or unshared card: on a link that shows my whole board (AIG-324), it goes too
      const L = ofProject(p.slug);
      if (L && L.board && autoShare(L, p, c) === 'sent') dm.flush().catch(() => {});
      return;
    }
    const L = read(c.share.link);
    if (!L || L.state !== 'live' || L.on === false) return;
    if (c.share.mine && !canOf(L).seeMine) return;   // a Reporter sees only their own cards (AIG-307)
    if ((effective(L).status || L.board) && c.status !== c.share.sentStatus && (c.share.mine || c.share.theirs)) {
      c.share.sentStatus = c.status;
      sendOn(L.id, 'status', { share: c.share.id, status: c.status }).catch(() => {});
    }
    if (!c.share.mine) return;
    const payload = payloadOf(c), h = hashOf(payload);
    if (!effective(L).sendCards || h === c.share.sent) return;
    if (scrub(payload, p).length) { c.share.held = h; return; }
    c.share.sent = h; c.share.sentAt = now(); delete c.share.held;
    sendOn(L.id, 'card', { share: c.share.id, ...payload }).catch(() => {});
  } catch {}
}
// A comment on a shared card (mine, or theirs that I took): goes to the friend, from me or my team, unless the scrub
// flags it (m.shared = 'held', sent only from the page's "Send anyway"). Called before the route saves. Never throws.
function commentAdded(p, c, m) {
  try {
    if (!c.share) return;
    const L = read(c.share.link);
    if (!L || L.state !== 'live' || L.on === false || !effective(L).comments) return;
    if (c.share.mine && !canOf(L).seeMine) return;   // a Reporter sees only their own cards (AIG-307)
    if (scrub({ text: m.text }, p).length) { m.shared = 'held'; return; }
    m.shared = 'sent';
    sendOn(L.id, 'comment', { share: c.share.id, author: cleanName(m.author), text: cleanText(m.text).slice(0, CAPS.comment) }).catch(() => {});
  } catch {}
}
// "Send anyway" on a held comment: { card, at }.
async function sendHeld(id, b = {}) {
  const L = liveFor(id, 'comments'), { p, c } = cardOf(L, b.card), m = (c.comments || []).find(m => m.at === b.at && m.shared === 'held');
  if (!m || !c.share || c.share.link !== id) throw bad('no held comment there', 404);
  m.shared = 'sent'; save(p);
  await sendOn(id, 'comment', { share: c.share.id, author: cleanName(m.author), text: cleanText(m.text).slice(0, CAPS.comment) });
  return { sent: true };
}

module.exports = { preview, shareCard, unshareCard, autoShare, shareAll, assignCard, cardChanged, commentAdded, sendHeld };
