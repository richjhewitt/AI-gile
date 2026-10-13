// Sharing (AIG-304): receiving. A verified share payload from a contact is checked and applied to the link file only.
// Built on share-base.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { now, STATUSES } = require('./store');
const { FILES, OFFER_MS, MAX_AGE, MAX_AHEAD, CAPS, KINDS, ALLOW, isLink, cleanName, cleanAllow, day, isShare, isRole, canOf, read, write, change, all, effective, sendOn, cleanText, safeName, payloadOf } = require('./share-base');

/* ---------- receiving ---------- */
// A verified share payload from contact c (dm.js has checked the signature and decrypted it). Returns what happened.
// Order: shape and size, envelope age, the link and its owner, seq (replays), end, switch, daily caps, then the kind.
function receive(c, env, p) {
  try { return take(c, env, p); } catch { return 'dropped'; }
}
const str = (v, max) => typeof v === 'string' && v.length <= max;
function shapeOk(p) {
  if (!isLink(p.link) || !Number.isSafeInteger(p.seq) || p.seq < 1 || !KINDS.includes(p.kind)) return false;
  // A file's data is checked on its own (base64 of up to CAPS.file bytes); everything else stays under 64 KB.
  if (p.kind === 'file' && !(typeof p.data === 'string' && p.data.length <= Math.ceil(CAPS.file / 3) * 4 && /^[A-Za-z0-9+/]+=*$/.test(p.data))) return false;
  if (JSON.stringify(p.kind === 'file' ? { ...p, data: '' } : p).length > CAPS.payload) return false;
  if ((p.kind === 'link-offer' || p.kind === 'link-accept') && p.role !== undefined && !isRole(p.role)) return false;
  if (p.kind === 'link-offer') return str(p.name, CAPS.name) && Number.isFinite(p.exp) && p.exp > Date.now() && p.exp <= Date.now() + OFFER_MS + MAX_AHEAD;
  if (p.kind === 'link-accept') return str(p.name, CAPS.name);
  if (p.kind === 'role') return isRole(p.role) && (p.board === undefined || typeof p.board === 'boolean');
  if (p.kind === 'assign') return isShare(p.share) && typeof p.on === 'boolean';
  if (p.kind === 'card') return isShare(p.share) && str(p.title, CAPS.title) && !!p.title.trim() && (p.description === undefined || str(p.description, CAPS.description));
  if (p.kind === 'comment') return isShare(p.share) && str(p.text, CAPS.comment) && !!p.text.trim() && (p.author === undefined || str(p.author, CAPS.name));
  if (p.kind === 'status') return isShare(p.share) && STATUSES.includes(p.status);
  if (p.kind === 'test') return isShare(p.share) && str(p.text, CAPS.comment);
  if (p.kind === 'verdict') return isShare(p.share) && ['accept', 'back'].includes(p.verdict) && (p.note === undefined || str(p.note, CAPS.comment));
  if (p.kind === 'file') return isShare(p.share) && str(p.name, 200) && (p.type === undefined || str(p.type, 100));
  return true;
}
function take(c, env, p) {
  if (!shapeOk(p)) return 'dropped';
  if (env.ts < Date.now() - MAX_AGE || env.ts > Date.now() + MAX_AHEAD) return 'dropped';
  const L = read(p.link);
  if (p.kind === 'link-offer') {
    if (L) return 'dropped';   // a replayed offer, or a link id we already have (live or ended)
    if (all().filter(o => o.contact === c.id && o.state === 'incoming' && o.exp > Date.now()).length >= CAPS.pendingOffers) return 'dropped';
    write({ v: 1, id: p.link, contact: c.id, slug: '', state: 'incoming', mine: { ...ALLOW }, theirs: cleanAllow(p.allow), theirName: cleanName(p.name),
      on: true, seqOut: 0, seqIn: p.seq, created: now(), exp: Math.min(p.exp, Date.now() + OFFER_MS), lastHeard: now(), ...(p.role ? { theirRole: p.role } : {}) });
    return 'share-offer';
  }
  if (!L || L.contact !== c.id) return 'dropped';   // only the person the link is with can talk on it
  if (p.seq <= (L.seqIn || 0)) { change(L.id, L => { L.stale = (L.stale || 0) + 1; }); return 'replay'; }
  if (L.state === 'ended') return 'dropped';
  // link-end passes the switch: it only closes things, and the friend would otherwise keep a dead link.
  if (p.kind === 'link-end') { change(L.id, L => { L.seqIn = p.seq; L.endedBy = L.state === 'offered' ? 'declined' : 'them'; L.state = 'ended'; L.ended = now(); L.lastHeard = now(); }); return 'share-end'; }
  if (L.on === false) { change(L.id, L => { L.seqIn = p.seq; L.droppedOff = (L.droppedOff || 0) + 1; }); return 'off'; }   // off: not stored, never replayed
  const today = day(), d = L.day && L.day.d === today ? L.day : { d: today, n: 0, cards: 0 };
  // A whole board shown to me (AIG-324) may send up to the per-link card cap in a day, still under the message cap.
  if (d.n >= CAPS.perDay || (p.kind === 'card' && d.cards >= (L.theirBoard ? CAPS.cards : CAPS.cardsPerDay))) { change(L.id, L => { L.seqIn = p.seq; L.overCap = (L.overCap || 0) + 1; }); return 'cap'; }
  let out = 'later', reply = null;
  if (p.kind === 'link-accept') {
    if (L.state !== 'offered' || L.exp < Date.now() || !c.checked) return 'dropped';
    out = 'share-live';
  } else if (p.kind === 'ack') {
    if (L.state !== 'live') return 'dropped';
    out = 'ack';
    if (p.ping) reply = 'ack';
  } else if (L.state !== 'live') return 'dropped';
  // card / comment (AIG-305): only what my allowances take, only onto share ids I hold, never over one of my own cards.
  // Anything refused still moves the seq on, so it can't be replayed in later.
  const refuse = (why, key = 'refused') => { change(L.id, L => { L.seqIn = p.seq; L[key] = (L[key] || 0) + 1; }); return why; };
  const eff = effective(L) || {}, theirCards = (L.inbound || {}).cards || {}, mineOut = L.outbound || {};
  if (p.kind === 'card') {
    if (!eff.takeCards) return refuse('not-allowed');
    if (mineOut[p.share]) return refuse('dropped');   // a share id of one of my cards: they can't write over it
    if (!theirCards[p.share] && Object.keys(theirCards).length >= CAPS.cards) return refuse('cap', 'overCap');
    out = 'share-card';
  } else if (p.kind === 'comment') {
    if (!eff.comments) return refuse('not-allowed');
    if (!(mineOut[p.share] && !mineOut[p.share].stopped) && !theirCards[p.share]) return refuse('dropped');   // only on a card both of us hold
    out = 'share-comment';
  }
  // AIG-306. status: a label on a card both of us hold (their copy of mine, or theirs in my lane), never my column.
  // test: they hand me a test on a card they shared with me. verdict: only an answer to a test I handed them, once.
  // file: an attachment on a card they shared with me, kept as data only.
  const mineLive = mineOut[p.share] && !mineOut[p.share].stopped ? mineOut[p.share] : null;
  // AIG-324: a column on their board, never a move here: their own card when they show me their whole board, or a
  // card I raised from their board (it lives only on their board). Their status on my cards still needs the role.
  const column = p.kind === 'status' && ((L.theirBoard && !!theirCards[p.share]) || !!(mineLive && mineLive.raised));
  let fileMeta = null;
  if (p.kind === 'status') {
    if (!eff.status && !column && !(L.board && mineLive)) return refuse('not-allowed');
    if (!mineLive && !theirCards[p.share]) return refuse('dropped');
    out = 'share-status';
  } else if (p.kind === 'test') {
    if (!eff.comments) return refuse('not-allowed');
    if (!theirCards[p.share]) return refuse('dropped');   // only on a card they shared with me, never on one of mine
    out = 'share-test';
  } else if (p.kind === 'verdict') {
    if (!eff.comments) return refuse('not-allowed');
    if (!mineLive || !mineLive.test || !mineLive.test.open) return refuse('dropped');   // no test of mine waiting there
    out = 'share-verdict';
  } else if (p.kind === 'file') {
    if (!eff.files) return refuse('not-allowed');
    const x = theirCards[p.share];
    if (!x) return refuse('dropped');   // only on a card they shared with me
    if ((x.files || []).length >= CAPS.filesPerCard || (d.files || 0) >= CAPS.filesPerDay) return refuse('cap', 'overCap');
    const buf = Buffer.from(p.data, 'base64');
    if (!buf.length || buf.length > CAPS.file) return refuse('dropped');
    // Stored under a name of our own making, in the link's own folder, owner-only; the type is a label, never trusted.
    const name = safeName(p.name), id = crypto.randomBytes(9).toString('base64url') + '-' + name;
    fs.mkdirSync(FILES(L.id), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(FILES(L.id), id), buf, { mode: 0o600 });
    fileMeta = { id, name, type: String(p.type || '').replace(/[^\w.+/-]/g, '').slice(0, 100), size: buf.length, at: now() };
    out = 'share-file';
  }
  // Roles (AIG-307): what the role I gave them lets them do, on top of what both of us allow. Refused: seq moves on.
  const can = canOf(L), own = !!theirCards[p.share];
  if (p.kind === 'card' && !can.raise.includes(payloadOf(p).type)) return refuse('role');
  if (p.kind === 'comment' && !(can.comment === 'shared' || (can.comment === 'own' && own))) return refuse('role');
  if (p.kind === 'status' && !column && !(own ? can.own.includes('status') : can.act === 'all' || (can.act === 'assigned' && mineLive && mineLive.assigned))) return refuse('role');
  if ((p.kind === 'test' || p.kind === 'file') && !can.own.includes(p.kind)) return refuse('role');
  if (p.kind === 'verdict' && !can.verdict) return refuse('role');
  if (p.kind === 'role') { if (L.state !== 'live') return 'dropped'; out = 'share-role'; }
  if (p.kind === 'assign') { if (!own) return refuse('dropped'); out = 'share-assign'; }
  change(L.id, L => {
    L.seqIn = p.seq; L.lastHeard = now(); L.day = { ...d, n: d.n + 1, cards: d.cards + (p.kind === 'card' ? 1 : 0), files: (d.files || 0) + (p.kind === 'file' ? 1 : 0) };
    const I = L.inbound = L.inbound || {}, cards = I.cards = I.cards || {};
    if (p.kind === 'status') {
      const label = { status: p.status, at: now() };
      if (mineLive) L.outbound[p.share].theirStatus = label; else cards[p.share].status = label;
    }
    if (p.kind === 'test') cards[p.share].test = { text: cleanText(p.text).trim(), at: now(), open: true };
    if (p.kind === 'verdict') L.outbound[p.share].test = { ...L.outbound[p.share].test, open: false, verdict: p.verdict, note: cleanText(p.note).trim(), answered: now() };
    if (p.kind === 'file') (cards[p.share].files = cards[p.share].files || []).push(fileMeta);
    if (p.kind === 'link-accept') { L.state = 'live'; L.since = now(); L.theirs = cleanAllow(p.allow); L.theirName = cleanName(p.name); if (p.role) L.theirRole = p.role; }
    if (p.kind === 'role') { L.theirRole = p.role; if (typeof p.board === 'boolean') L.theirBoard = p.board; }   // labels: what they let me do and see on their board, never a power here
    if (p.kind === 'assign') { if (p.on) cards[p.share].forYou = true; else delete cards[p.share].forYou; }
    if (p.kind === 'card') {
      const was = cards[p.share], keep = was ? Object.fromEntries(['taken', 'status', 'test', 'files', 'forYou', 'approval', 'declinedAt', 'declineNote', 'approvedAt'].filter(k => was[k]).map(k => [k, was[k]])) : {};
      // Field by field from the allow-list: whatever else the payload carries (assignee, status, needsYou, paths) is ignored.
      const wait = !was && require('./approvals').isOn(L.slug) ? { approval: 'waiting' } : {};   // AIG-814: waits for the owner's OK
      cards[p.share] = { share: p.share, ...payloadOf(p), first: was ? was.first : now(), updated: now(), ...keep, ...wait, ...(was ? { n: (was.n || 0) + 1 } : {}) };
    }
    if (p.kind === 'comment') {
      const all = I.comments = I.comments || {}, list = all[p.share] = all[p.share] || [];
      list.push({ author: cleanName(p.author) || 'Friend', text: cleanText(p.text).trim(), at: now(), from: 'share:' + L.id });
      if (list.length > 1000) list.splice(0, list.length - 1000);
    }
  });
  if (reply) sendOn(L.id, 'ack').catch(() => {});
  return out;
}

module.exports = { receive };
