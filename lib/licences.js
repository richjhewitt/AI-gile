// 📜 Business licences (AIG-601): firms apply on the website (POST /apply on the relay, relay/relay.js); the owner reads the list here,
// signed with this board's relay key (the relay answers GET /apply only to the key set as RELAY_STATS_KEY, so that must be the key
// shown in Setup > Business licences). Approve or Decline is kept in data/licences.conf (name ending .conf: every .json in data/ is a project).
// Approve gives a short licence letter to copy and send.
const fs = require('fs');
const path = require('path');
const { DATA, bad, localSettings } = require('./store');

const FILE = () => path.join(DATA, 'licences.conf');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { return {}; } };
const dm = () => require('./dm');

function letter(a, owner) {
  const day = new Date().toISOString().slice(0, 10);
  return `Business licence for AI-gile

Date: ${day}

${a.company}${a.website ? ' (' + a.website + ')' : ''} is welcome to use AI-gile in its business, free of charge, for: ${a.what}

Thank you for the good it does: ${a.how}

This licence is personal to ${a.company}, may be withdrawn at any time, and comes with no warranty. Please keep a link back to AI-gile where you can.

${owner || 'The AI-gile owner'}`;
}
async function list() {
  const base = dm().relayAddress();
  const out = { key: dm().identity().ePub, xKey: dm().identity().xPub, relay: base, items: [], error: '' };   // xKey: RELAY_OWNER_XPUB
  if (!base) { out.error = 'set the relay address in Setup (DMs) first'; return out; }
  let apps = [];
  try { apps = (await dm().relayCall(base, 'GET', '/apply')).applications || []; }
  catch (e) { out.error = e.message; return out; }
  const st = read(), owner = require('./store').owner();
  out.items = apps.reverse().map(a => ({ ...a, status: (st[a.id] || {}).status || 'new', decidedAt: (st[a.id] || {}).at || null, letter: (st[a.id] || {}).status === 'approved' ? letter(a, owner) : '' }));
  return out;
}
async function decide(id, decision) {
  if (!/^\d{13}-[0-9a-f]{16}$/.test(String(id))) throw bad('no such application', 404);
  if (!['approve', 'decline'].includes(decision)) throw bad('decision must be approve or decline');
  const st = read();
  st[id] = { status: decision === 'approve' ? 'approved' : 'declined', at: new Date().toISOString() };
  fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(st));
  const found = (await list()).items.find(a => a.id === id);
  if (!found) throw bad('no such application', 404);
  return found;
}
// 📝 Alpha / beta interest (AIG-754): the website form posts to the relay's /interest; read with the same operator key.
// AIG-1235: the relay keeps each sign-up sealed to this board's X25519 key (RELAY_OWNER_XPUB = identity().xPub); opened here.
// Old plain { email, which, at } items are still shown. One row per email, newest first.
function openInterest(raw) {
  const byEmail = new Map(); let unopened = 0;
  for (const x of raw) {
    let it = null;
    if (x && x.v === 2 && x.sealed) { try { it = dm().openSealed(x.sealed); } catch { unopened++; continue; } }
    else if (x && typeof x.email === 'string') it = x;
    if (!it || typeof it.email !== 'string') continue;
    const row = { email: String(it.email), which: String(it.which || ''), at: String(it.at || '') }, had = byEmail.get(row.email);
    if (!had || had.at < row.at) byEmail.set(row.email, row);
  }
  return { items: [...byEmail.values()].sort((a, b) => b.at.localeCompare(a.at)), unopened };
}
async function interest() {
  const base = dm().relayAddress(), out = { items: [], error: '' };
  if (!base) { out.error = 'set the relay address in Setup (DMs) first'; return out; }
  try {
    const o = openInterest((await dm().relayCall(base, 'GET', '/interest')).interest || []);
    out.items = o.items; out.unopened = o.unopened;
    if (o.unopened && !o.items.length) out.error = `${o.unopened} sign-ups are sealed for another key: set RELAY_OWNER_XPUB on the relay to ${dm().identity().xPub}`;
  } catch (e) { out.error = e.message; }
  return out;
}
module.exports = { list, decide, letter, interest };
