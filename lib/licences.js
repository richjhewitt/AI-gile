// 📜 Business licences (AIG-601): firms apply on the website (POST /apply on the relay, relay/relay.js); the owner reads the list here,
// signed with this board's relay key (the relay answers GET /apply only to the key set as RELAY_STATS_KEY, so that must be the key
// shown in Setup > Business licences). Approve or Decline is kept in data/licences.conf (name ending .conf: every .json in data/ is a project).
// Approve gives a short licence letter to copy and send.
// AIG-1282: both website forms reach the relay sealed to this board's X25519 key (RELAY_OWNER_XPUB = identity().xPub), sealed in the
// browser or by the relay on arrival. Each look collects them: opened here, saved in data/forms.conf (sealed at rest, lib/atrest.js),
// then acked, which deletes them on the relay. The owner deletes a row here once replied (Delete in Setup).
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');

const FILE = () => path.join(DATA, 'licences.conf');
const INBOX = () => path.join(DATA, 'forms.conf');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { return {}; } };
const dm = () => require('./dm');
const atrest = () => require('./atrest');
const ID = /^\d{13}-[0-9a-f]{16}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

function readInbox() { const o = atrest().readJson(INBOX(), {}) || {}; return { apply: o.apply || {}, interest: o.interest || {} }; }
const writeInbox = o => atrest().writeText(INBOX(), JSON.stringify(o));

// Takes what waits on the relay for one form ('apply' or 'interest'), opens it, saves it here, then tells the relay to delete it.
// Items sealed for another key are left on the relay (counted in unopened); anything else collected is acked, even if it was junk.
async function collect(kind) {
  const base = dm().relayAddress();
  if (!base) return { error: 'set the relay address in Setup (DMs) first', unopened: 0 };
  let raw;
  try { raw = (await dm().relayCall(base, 'GET', '/' + kind))[kind === 'apply' ? 'applications' : 'interest'] || []; }
  catch (e) { return { error: e.message, unopened: 0 }; }
  const box = readInbox(), done = [];
  let unopened = 0;
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    let it = x;
    if (x.v === 2 && x.sealed) { try { it = dm().openSealed(x.sealed); } catch { unopened++; continue; } }
    if (x.id) done.push(String(x.id));
    if (!it || typeof it !== 'object') continue;
    const at = str(x.at || it.at, 40);
    if (kind === 'apply') {
      const a = { company: str(it.company, 120), website: str(it.website, 200), what: str(it.what, 1000), how: str(it.how, 1000), email: str(it.email, 160), at };
      if (ID.test(String(x.id)) && a.company && EMAIL.test(a.email)) box.apply[x.id] = a;
    } else {
      const email = str(it.email, 160).toLowerCase(), which = str(it.which, 10), had = box.interest[email];
      if (EMAIL.test(email) && ['alpha', 'beta', 'both'].includes(which) && (!had || had.at <= at)) box.interest[email] = { which, at };
    }
  }
  if (done.length) {
    writeInbox(box);   // saved here first: only then is it deleted on the relay
    try { await dm().relayCall(base, 'POST', '/' + kind + '/ack', { ids: done }); } catch {}   // not acked now: next look acks it
  }
  return { error: '', unopened };
}

function letter(a, owner) {
  const day = new Date().toISOString().slice(0, 10);
  return `Business licence for AI-gile

Date: ${day}

${a.company}${a.website ? ' (' + a.website + ')' : ''} is welcome to use AI-gile in its business, free of charge, for: ${a.what}

Thank you for the good it does: ${a.how}

This licence is personal to ${a.company}, may be withdrawn at any time, and comes with no warranty. Please keep a link back to AI-gile where you can.

${owner || 'The AI-gile owner'}`;
}
const sealedNote = n => `${n} items are sealed for another key: set RELAY_OWNER_XPUB on the relay to ${dm().identity().xPub}`;
async function list() {
  const out = { key: dm().identity().ePub, xKey: dm().identity().xPub, relay: dm().relayAddress(), items: [], error: '' };   // xKey: RELAY_OWNER_XPUB
  const c = await collect('apply');
  out.error = c.error || (c.unopened ? sealedNote(c.unopened) : '');
  const st = read(), owner = require('./store').owner(), box = readInbox();
  out.items = Object.entries(box.apply).sort((a, b) => b[0].localeCompare(a[0])).map(([id, a]) => ({ id, ...a, status: (st[id] || {}).status || 'new', decidedAt: (st[id] || {}).at || null, letter: (st[id] || {}).status === 'approved' ? letter(a, owner) : '' }));
  return out;
}
async function decide(id, decision) {
  if (!ID.test(String(id))) throw bad('no such application', 404);
  if (!['approve', 'decline'].includes(decision)) throw bad('decision must be approve or decline');
  if (!readInbox().apply[id]) throw bad('no such application', 404);
  const st = read();
  st[id] = { status: decision === 'approve' ? 'approved' : 'declined', at: new Date().toISOString() };
  fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(st));
  return (await list()).items.find(a => a.id === id);
}
// Replied: the application and its decision go from this board too.
function remove(id) {
  const box = readInbox();
  if (!ID.test(String(id)) || !box.apply[id]) throw bad('no such application', 404);
  delete box.apply[id]; writeInbox(box);
  const st = read(); if (st[id]) { delete st[id]; fs.writeFileSync(FILE(), JSON.stringify(st)); }
  return { ok: true };
}
// 📝 Alpha / beta interest (AIG-754): the website form posts to the relay's /interest; read with the same operator key.
// One row per email, newest first.
async function interest() {
  const c = await collect('interest'), box = readInbox();
  const out = { items: Object.entries(box.interest).map(([email, x]) => ({ email, which: x.which, at: x.at })).sort((a, b) => b.at.localeCompare(a.at)), error: c.error, unopened: c.unopened };
  if (c.unopened && !out.error) out.error = sealedNote(c.unopened);
  return out;
}
function removeInterest(email) {
  const box = readInbox(), e = String(email || '').toLowerCase();
  if (!box.interest[e]) throw bad('no such sign-up', 404);
  delete box.interest[e]; writeInbox(box);
  return { ok: true };
}
module.exports = { list, decide, remove, letter, interest, removeInterest };
