// Sharing (AIG-304): offer, accept, decline, the switch / role / board patch, ping, unlink and forget. Built on share-base.js.
const fs = require('fs');
const crypto = require('crypto');
const { now, load, save, bad } = require('./store');
const dm = require('./dm');
const { DIR, FILES, OFFER_MS, cleanName, cleanAllow, ROLES, isRole, PEOPLE, people, roleOf, roleMsg, changeOf, canOf, read, write, change, all, link, ofProject, effective, shown, sendOn, needChecked } = require('./share-base');
const { shareAll } = require('./share-cards');

/* ---------- offer, accept, decline ---------- */
// { slug, contact, allow? }: offer one of my projects to a contact whose safety code I checked.
async function offer(b) {
  if (!dm.on()) throw bad('turn DMs on first', 409);
  const p = load(String(b.slug || ''));
  if (!p) throw bad('project not found', 404);
  needChecked(String(b.contact || ''));
  if (ofProject(p.slug)) throw bad('this project already has a link (one per project for now)', 409);
  const L = write({ v: 1, id: crypto.randomBytes(16).toString('base64url'), contact: b.contact, slug: p.slug, state: 'offered',
    mine: cleanAllow(b.allow), theirs: null, theirName: '', on: true, seqOut: 0, seqIn: 0, created: now(), exp: Date.now() + OFFER_MS, ...(isRole(b.role) ? { role: b.role } : {}) });
  await sendOn(L.id, 'link-offer', { name: cleanName(p.name), allow: L.mine, exp: L.exp, role: roleOf(L), chg: changeOf(L) });
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
  change(id, L => { L.slug = p.slug; L.mine = cleanAllow(b.allow); L.state = 'live'; L.since = now(); if (isRole(b.role)) L.role = b.role; });
  await sendOn(id, 'link-accept', { name: cleanName(p.name), allow: read(id).mine, role: roleOf(read(id)), chg: changeOf(read(id)) });
  require('./features').push(L.contact).catch(() => {});   // AIG-847: tell them their switches too
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
// { teamRead } (AIG-306): "let my team read their cards", mine alone (it is about my team), so nothing is sent.
// { role, scope? } (AIG-307): the friend's role, scope 'project' (this link, the default) or 'all' (every project I
// link with them, now and later; it clears each link's own role). Each live link tells them, as a label.
async function patch(id, b) {
  const L0 = link(id);
  if ('role' in b && !isRole(b.role)) throw bad('role must be one of ' + ROLES.join(', '));
  if ('on' in b) {
    change(id, L => { L.on = !!b.on; });
    if (b.on === true && L0.on === false && L0.state === 'live' && L0.roleStale) { change(id, L => { delete L.roleStale; }); await sendOn(id, 'role', roleMsg(read(id))).catch(() => {}); }   // AIG-856: resumed, the change roles missed while paused
    if (b.on === true && L0.on === false && L0.state === 'live') require('./features').syncAll().catch(() => {});   // AIG-847: switches changed while paused
  }
  if ('teamRead' in b) change(id, L => { L.mine = { ...L.mine, teamRead: b.teamRead === true }; });
  if ('role' in b) {
    const ids = b.scope === 'all' ? all().filter(L => L.contact === L0.contact).map(L => L.id) : [id];
    if (b.scope === 'all') {
      fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(PEOPLE(), JSON.stringify({ ...people(), [L0.contact]: b.role }, null, 2), { mode: 0o600 });
      for (const x of ids) change(x, L => { delete L.role; });
    } else change(id, L => { L.role = b.role; });
    for (const x of ids) { const L = read(x); if (L.state === 'live' && L.on !== false) await sendOn(x, 'role', roleMsg(L)).catch(() => {}); else if (L.state === 'live') change(x, L => { L.roleStale = true; }); }
  }
  // { board } (AIG-324): show them my whole board (every card of this project, live) instead of only the cards I tick
  // 🔗. Off by default. They are told with the role message (a label); off again stops sending (their copies stay theirs).
  if ('board' in b) {
    const on = b.board === true, L = read(id);
    if (on && !canOf(L).seeMine) throw bad(shown(L).friend + ' is a ' + roleOf(L) + ' on this link: they only see their own cards', 409);
    change(id, L => { if (on) L.board = true; else delete L.board; });
    if (L.state === 'live' && L.on !== false) await sendOn(id, 'role', roleMsg(L, { board: on })).catch(() => {});
    if (on && L.state === 'live' && L.on !== false && (effective(L) || {}).sendCards) return { ...shown(read(id)), shared: await shareAll(id) };
  }
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
// Their copies: the 📥 lane and their comments (L.inbound), and lane cards I took (tagged from: 'share:<link>').
function forget(id) {
  const L = read(id), tag = 'share:' + id, p = L && L.slug && load(L.slug);
  if (p) {
    const before = JSON.stringify(p.cards);
    p.cards = p.cards.filter(c => c.from !== tag);
    for (const c of p.cards) c.comments = (c.comments || []).filter(m => m.from !== tag);
    for (const c of p.cards) if (c.share && c.share.link === id) delete c.share;   // my cards that were shared on it
    if (JSON.stringify(p.cards) !== before) save(p);
  }
  change(id, L => { L.forgotten = true; L.theirName = ''; delete L.inbound; });
  try { fs.rmSync(FILES(id), { recursive: true, force: true }); } catch {}   // their attachments too
}
// Blocking or removing a contact ends every link with them (no message: they are blocked).
function endAllWith(cid) {
  for (const L of all()) if (L.contact === cid && L.state !== 'ended') change(L.id, L => { L.state = 'ended'; L.ended = now(); L.endedBy = 'blocked'; });
}

module.exports = { offer, accept, decline, patch, ping, unlink, forget, endAllWith };
