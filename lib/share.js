// Sharing a project with a friend's board (AIG-304, design in docs/SHARING-DESIGN.md): the share wire format,
// link offer / accept, the per-project 🔗 switch and unlink. Built on the private DMs (lib/dm.js): the same
// contacts, sealed envelopes and relay. A friend's message is data: it can never wake a team or count as the owner.
//
// Wire: a DM payload { t: 'share', link, seq, kind, ... } sealed with dm.js seal() (via its outbox).
// - link: random 22-char id; seq: counts up per link per direction, the receiver drops anything at or below the last seen
// - kind: link-offer { name, allow, exp }, link-accept { name, allow }, link-end, ack { ping? },
//   card { share, title, description, type, priority } (AIG-305: only these fields, built from FIELDS, never the card object),
//   comment { share, author, text }, status { share, status } (AIG-306: a label only, never my column),
//   test { share, text } (I hand them a test on a card I shared), verdict { share, verdict: accept|back, note? }
//   (their answer to that test: a label on my card), file { share, name, type, data } (an attachment, data only),
//   role { role, board? } (AIG-307: the role they gave me, a label only; AIG-324: board = they show me their whole board),
//   assign { share, on } (they put me on one of their cards)
// One file per link in data/shares/<link>.json (git-ignored): contact, my slug, their project's name, both allowances,
// the switch, sequence counters and what was dropped; outbound (my share ids -> my card ids) and inbound (their cards
// in my 📥 lane, and every comment from them). Nothing a friend sends is written into a project file: teams read
// project files, so a friend's card or comment can't reach nextList, brief, For the team, toTeam or a wake.
// The code lives in share-*.js, split by the section markers it used to have:
//   share-base.js (wire constants, roles, link files, allowances, sending, text and scrub helpers),
//   share-link.js (offer / accept / decline / patch / ping / unlink), share-receive.js (receiving),
//   share-cards.js (my cards and comments going out, my whole board, the card and comment hooks),
//   share-board.js (their board, the 📥 lane, tests and verdicts, files, teamView).
// This file wires the DM hooks and re-exports everything, so callers still require('./share').
const dm = require('./dm');
const { ROLES, CAN, ownerOnly, list, ofProject, shown, CAPS, ALLOW, KINDS, FIELDS, SCRUB, scrub, payloadOf, fence, unfence } = require('./share-base');
const { offer, accept, decline, patch, ping, unlink, endAllWith } = require('./share-link');
const { receive } = require('./share-receive');
const { preview, shareCard, unshareCard, assignCard, cardChanged, commentAdded, sendHeld } = require('./share-cards');
const { boardView, raise, boardComment, boardStatus, inbound, laneComment, takeCard, handTest, laneVerdict, friendFile, teamView } = require('./share-board');

dm.hooks.share = receive;
dm.hooks.ended = endAllWith;

module.exports = { boardView, raise, boardComment, boardStatus, list, offer, accept, decline, patch, ping, assignCard, ownerOnly, ROLES, CAN, unlink, receive, preview, shareCard, unshareCard, cardChanged, commentAdded, sendHeld, inbound, laneComment, takeCard, handTest, laneVerdict, friendFile, teamView, fence, unfence, scrub, SCRUB, payloadOf, FIELDS, ofProject: slug => { const L = ofProject(slug); return L ? shown(L) : null; }, CAPS, ALLOW, KINDS };
