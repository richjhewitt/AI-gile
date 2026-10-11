// Sharing a project with a friend's board (AIG-304, design in docs/SHARING-DESIGN.md): the share wire format,
// link offer / accept, the per-project 🔗 switch and unlink. Built on the private DMs (lib/dm.js): the same
// contacts, sealed envelopes and relay. A friend's message is data: it can never wake a team or count as the owner.
//
// Wire: a DM payload { t: 'share', link, seq, kind, ... } sealed with dm.js seal() (via its outbox).
// - link: random 22-char id; seq: counts up per link per direction, the receiver drops anything at or below the last seen
// - kind: link-offer { name, allow, exp }, link-accept { name, allow }, link-end, ack { ping? }; card, comment and
//   status are the later build cards (size-checked here, then dropped until they are built)
// One file per link in data/shares/<link>.json (git-ignored): contact, my slug, their project's name, both allowances,
// the switch, sequence counters and what was dropped.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, now, load, save, bad } = require('./store');
const dm = require('./dm');

const DIR = path.join(DATA, 'shares');
const OFFER_MS = 48 * 3600e3;          // an offer can be accepted for 2 days, like an invite
const MAX_AGE = 8 * 24 * 3600e3;       // envelopes older than this are dropped (the relay keeps 7 days)
const MAX_AHEAD = 10 * 60e3;           // or this far in the future (a wrong clock)
const CAPS = { title: 200, description: 20000, comment: 20000, name: 80, cards: 200, cardsPerDay: 50, perDay: 500, payload: 64 * 1024, pendingOffers: 5 };
const KINDS = ['link-offer', 'link-accept', 'link-end', 'card', 'comment', 'status', 'ack'];
// What each side allows; what crosses is what both allow. Defaults are the safest (design: "What each side allows").
const ALLOW = { send: true, take: true, comments: true, status: false, files: false, teamRead: false };
const isLink = s => typeof s === 'string' && /^[A-Za-z0-9_-]{22}$/.test(s);
const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, CAPS.name);
const cleanAllow = a => Object.fromEntries(Object.entries(ALLOW).map(([k, d]) => [k, a && typeof a[k] === 'boolean' ? a[k] : d]));
const day = () => new Date().toISOString().slice(0, 10);

/* ---------- files ---------- */
const file = id => path.join(DIR, id + '.json');
function read(id) { if (!isLink(id)) return null; try { return JSON.parse(fs.readFileSync(file(id), 'utf8')); } catch { return null; } }
function write(L) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const tmp = file(L.id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(L, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file(L.id));
  return L;
}
// Synchronous read-modify-write, like dm.js, so a request and the poll can't interleave it.
const change = (id, fn) => { const L = read(id); if (!L) return null; const out = fn(L); write(L); return out === undefined ? L : out; };
const all = () => { try { return fs.readdirSync(DIR).filter(f => /^[A-Za-z0-9_-]{22}\.json$/.test(f)).map(f => read(f.slice(0, -5))).filter(Boolean); } catch { return []; } };
function link(id) { const L = read(id); if (!L) throw bad('link not found', 404); return L; }
const isOpen = L => ['offered', 'incoming', 'live'].includes(L.state) && !(L.state !== 'live' && L.exp < Date.now());
const ofProject = slug => all().find(L => L.slug === slug && isOpen(L));

/* ---------- what both allow ---------- */
const effective = L => L.state !== 'live' ? null : {
  sendCards: L.mine.send && L.theirs.take, takeCards: L.mine.take && L.theirs.send,
  comments: L.mine.comments && L.theirs.comments, status: L.mine.status && L.theirs.status,
  files: L.mine.files && L.theirs.files, teamRead: L.mine.teamRead,
};
function shown(L) {
  const c = dm.contacts().find(c => c.id === L.contact) || {};
  return { id: L.id, contact: L.contact, friend: c.name || L.friend || 'Friend', safety: c.safety || '', checked: !!c.checked, blocked: !!c.blocked,
    slug: L.slug || '', projectName: L.slug ? ((load(L.slug) || {}).name || L.slug) : '', theirName: L.theirName || '',
    state: L.state, expired: L.state !== 'live' && L.state !== 'ended' && L.exp < Date.now(), exp: new Date(L.exp).toISOString(),
    on: L.on !== false, mine: L.mine, theirs: L.theirs || null, effective: effective(L),
    droppedOff: L.droppedOff || 0, overCap: L.overCap || 0, stale: L.stale || 0,
    created: L.created, since: L.since || null, lastHeard: L.lastHeard || null, ended: L.ended || null, endedBy: L.endedBy || null, forgotten: !!L.forgotten };
}
const list = (slug) => all().filter(L => !slug || L.slug === slug).sort((a, b) => b.created.localeCompare(a.created)).map(shown);

/* ---------- sending ---------- */
// Every message on a link takes the next seq (saved before sealing, so a seq is never used twice).
async function sendOn(id, kind, extra = {}) {
  if (!dm.on()) throw bad('DMs are off', 409);
  const L = link(id), c = dm.contactRaw(L.contact);
  if (c.blocked) throw bad('unblock this person first', 409);
  const seq = change(id, L => { L.seqOut = (L.seqOut || 0) + 1; return L.seqOut; });
  dm.queue(c, { t: 'share', link: id, seq, kind, ...extra });
  await dm.flush();
}
function needChecked(cid) {
  const c = dm.contactRaw(cid);
  if (c.blocked) throw bad('this person is blocked', 409);
  if (!c.checked) throw bad('check the safety code with ' + c.name + ' first: read the 6 words to each other', 409);
  return c;
}

/* ---------- offer, accept, decline ---------- */
// { slug, contact, allow? }: offer one of my projects to a contact whose safety code I checked.
async function offer(b) {
  if (!dm.on()) throw bad('turn DMs on first', 409);
  const p = load(String(b.slug || ''));
  if (!p) throw bad('project not found', 404);
  needChecked(String(b.contact || ''));
  if (ofProject(p.slug)) throw bad('this project already has a link (one per project for now)', 409);
  const L = write({ v: 1, id: crypto.randomBytes(16).toString('base64url'), contact: b.contact, slug: p.slug, state: 'offered',
    mine: cleanAllow(b.allow), theirs: null, theirName: '', on: true, seqOut: 0, seqIn: 0, created: now(), exp: Date.now() + OFFER_MS });
  await sendOn(L.id, 'link-offer', { name: cleanName(p.name), allow: L.mine, exp: L.exp });
  return shown(read(L.id));
}
// { slug, allow? }: link their offer to one of my projects (the page makes a new project first if asked).
async function accept(id, b) {
  const L = link(id);
  if (L.state !== 'incoming') throw bad('this offer is not waiting any more', 409);
  if (L.exp < Date.now()) throw bad('this offer has expired, ask for a new one', 409);
  if (!dm.on()) throw bad('turn DMs on first', 409);
  needChecked(L.contact);
  const p = load(String(b.slug || ''));
  if (!p) throw bad('pick one of your projects', 400);
  if (ofProject(p.slug)) throw bad('that project already has a link (one per project for now)', 409);
  change(id, L => { L.slug = p.slug; L.mine = cleanAllow(b.allow); L.state = 'live'; L.since = now(); });
  await sendOn(id, 'link-accept', { name: cleanName(p.name), allow: read(id).mine });
  return shown(read(id));
}
async function decline(id) {
  const L = link(id);
  if (L.state !== 'incoming') throw bad('this offer is not waiting any more', 409);
  change(id, L => { L.state = 'ended'; L.ended = now(); L.endedBy = 'declined'; });
  try { await sendOn(id, 'link-end', { why: 'no' }); } catch {}   // DMs off or blocked: it's still declined here
  return shown(read(id));
}

/* ---------- the switch, check, unlink ---------- */
// { on }: the per-project killswitch. Off: nothing sent, everything arriving for the link dropped (only counted).
function patch(id, b) {
  link(id);
  if ('on' in b) change(id, L => { L.on = !!b.on; });
  return shown(read(id));
}
// 👋 Check the link: a ping; their board answers with an ack, which shows as "last heard".
async function ping(id) {
  const L = link(id);
  if (L.state !== 'live') throw bad('the link is not live', 409);
  if (L.on === false) throw bad('the 🔗 switch is off', 409);
  await sendOn(id, 'ack', { ping: true });
  return shown(read(id));
}
// { forget? }: end the link (tells them, if DMs can reach them). forget: also delete their cards and comments here.
async function unlink(id, b = {}) {
  const L = link(id);
  if (L.state !== 'ended') {
    change(id, L => { L.state = 'ended'; L.ended = now(); L.endedBy = 'me'; });
    try { await sendOn(id, 'link-end'); } catch {}   // ending never waits on the relay or the switch
  }
  if (b.forget) forget(id);
  return shown(read(id));
}
// Their copies on my board are tagged from: 'share:<link>' (cards and comments; the later build cards add them).
function forget(id) {
  const L = read(id), tag = 'share:' + id, p = L && L.slug && load(L.slug);
  if (p) {
    const before = JSON.stringify(p.cards);
    p.cards = p.cards.filter(c => c.from !== tag);
    for (const c of p.cards) c.comments = (c.comments || []).filter(m => m.from !== tag);
    if (JSON.stringify(p.cards) !== before) save(p);
  }
  change(id, L => { L.forgotten = true; L.theirName = ''; delete L.inbound; });
}
// Blocking or removing a contact ends every link with them (no message: they are blocked).
function endAllWith(cid) {
  for (const L of all()) if (L.contact === cid && L.state !== 'ended') change(L.id, L => { L.state = 'ended'; L.ended = now(); L.endedBy = 'blocked'; });
}

/* ---------- receiving ---------- */
// A verified share payload from contact c (dm.js has checked the signature and decrypted it). Returns what happened.
// Order: shape and size, envelope age, the link and its owner, seq (replays), end, switch, daily caps, then the kind.
function receive(c, env, p) {
  try { return take(c, env, p); } catch { return 'dropped'; }
}
const str = (v, max) => typeof v === 'string' && v.length <= max;
function shapeOk(p) {
  if (!isLink(p.link) || !Number.isSafeInteger(p.seq) || p.seq < 1 || !KINDS.includes(p.kind)) return false;
  if (JSON.stringify(p).length > CAPS.payload) return false;
  if (p.kind === 'link-offer') return str(p.name, CAPS.name) && Number.isFinite(p.exp) && p.exp > Date.now() && p.exp <= Date.now() + OFFER_MS + MAX_AHEAD;
  if (p.kind === 'link-accept') return str(p.name, CAPS.name);
  if (p.kind === 'card') return typeof p.share === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(p.share) && str(p.title, CAPS.title) && (p.description === undefined || str(p.description, CAPS.description));
  if (p.kind === 'comment') return typeof p.share === 'string' && str(p.text, CAPS.comment);
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
      on: true, seqOut: 0, seqIn: p.seq, created: now(), exp: Math.min(p.exp, Date.now() + OFFER_MS), lastHeard: now() });
    return 'share-offer';
  }
  if (!L || L.contact !== c.id) return 'dropped';   // only the person the link is with can talk on it
  if (p.seq <= (L.seqIn || 0)) { change(L.id, L => { L.stale = (L.stale || 0) + 1; }); return 'replay'; }
  if (L.state === 'ended') return 'dropped';
  // link-end passes the switch: it only closes things, and the friend would otherwise keep a dead link.
  if (p.kind === 'link-end') { change(L.id, L => { L.seqIn = p.seq; L.endedBy = L.state === 'offered' ? 'declined' : 'them'; L.state = 'ended'; L.ended = now(); L.lastHeard = now(); }); return 'share-end'; }
  if (L.on === false) { change(L.id, L => { L.seqIn = p.seq; L.droppedOff = (L.droppedOff || 0) + 1; }); return 'off'; }   // off: not stored, never replayed
  const today = day(), d = L.day && L.day.d === today ? L.day : { d: today, n: 0, cards: 0 };
  if (d.n >= CAPS.perDay || (p.kind === 'card' && d.cards >= CAPS.cardsPerDay)) { change(L.id, L => { L.seqIn = p.seq; L.overCap = (L.overCap || 0) + 1; }); return 'cap'; }
  let out = 'later', reply = null;
  if (p.kind === 'link-accept') {
    if (L.state !== 'offered' || L.exp < Date.now() || !c.checked) return 'dropped';
    out = 'share-live';
  } else if (p.kind === 'ack') {
    if (L.state !== 'live') return 'dropped';
    out = 'ack';
    if (p.ping) reply = 'ack';
  } else if (L.state !== 'live') return 'dropped';
  change(L.id, L => {
    L.seqIn = p.seq; L.lastHeard = now(); L.day = { ...d, n: d.n + 1, cards: d.cards + (p.kind === 'card' ? 1 : 0) };
    if (p.kind === 'link-accept') { L.state = 'live'; L.since = now(); L.theirs = cleanAllow(p.allow); L.theirName = cleanName(p.name); }
  });
  // card / comment / status: checked and counted, but not applied until build cards 4..8 land (out stays 'later').
  if (reply) sendOn(L.id, 'ack').catch(() => {});
  return out;
}

dm.hooks.share = receive;
dm.hooks.ended = endAllWith;

module.exports = { list, offer, accept, decline, patch, ping, unlink, receive, ofProject: slug => { const L = ofProject(slug); return L ? shown(L) : null; }, CAPS, ALLOW, KINDS };
