// Private DMs (AIG-110, design in docs/DMS-DESIGN.md): this board's keys, invites, contacts and end-to-end
// encrypted messages. A relay (relay/relay.js) carries them and only ever sees sealed envelopes.
// Secrets stay on this computer: data/keys/identity.json and data/dms/ (both git-ignored).
//
// Envelope (what the relay stores): { v, to, from, id, ts, epk, iv, ct, sig }
// - to/from: random mailbox ids; id: random message id; ts: send time; epk: a fresh X25519 key for this message
// - ct: AES-256-GCM of the JSON payload, key = HKDF-SHA256(X25519(epk, contact's key)); the header is the AAD
// - sig: the sender's Ed25519 signature over the header, iv and ct
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('./emojis');
const { DATA, PORT, localSettings, now, bad } = require('./store');

const KEYS = path.join(DATA, 'keys'), DMS = path.join(DATA, 'dms');
const POLL_MS = Number(process.env.AIGILE_DM_POLL_MS) || 4000;
const INVITE_MS = 48 * 3600e3;      // an invite code works for 2 days, once
const RETRY_MS = 7 * 24 * 3600e3;   // the outbox gives up after the relay's own 7 days
const MAX_TEXT = 20000;
const MAX_FILES = 8 * 1024 * 1024;   // attachments on one message, before sealing (the relay takes 12 MB)
const V = 'aigile-dm-v1';

/* ---------- safety code words ---------- */
// 256 words, so each byte of the hash is one word: 6 words = 48 bits.
const WORDS = (
  'apple acorn anchor angel ankle arrow attic autumn bacon badge baker bamboo banana banjo barrel basket ' +
  'beach beaver berry bicycle bison blanket blossom bottle bridge brook bubble bucket buffalo butter button cabin ' +
  'cactus camel candle canoe canyon carpet carrot castle cedar cherry chess chimney cider circus clock cloud ' +
  'clover cobra coconut comet copper coral cotton cowboy crayon cricket crystal cup daisy desert diamond dinner ' +
  'dolphin donkey dragon drum eagle echo elbow ember engine falcon feather fern fiddle flute forest fossil ' +
  'fox frog garden garlic ginger glacier goat golden gorilla grape gravel guitar hammer harbor harp hazel ' +
  'helmet heron hill honey hornet island ivory jacket jaguar jelly jungle kayak kettle kitten koala ladder ' +
  'lagoon lantern lemon leopard lily lion lizard lobster locket magnet mango maple marble meadow melon mermaid ' +
  'mint mirror monkey moose mountain muffin mushroom needle nest noodle oak ocean olive onion orange orchid ' +
  'otter owl oyster paddle palace panda paper parrot peach peanut pearl pebble pelican pencil pepper piano ' +
  'pickle pigeon pillow pine pirate planet plum pocket pony poppy potato pumpkin puppet quail quartz rabbit ' +
  'radar radish rainbow raven ribbon river robin rocket saddle salmon sandal saturn scarf seal shadow shell ' +
  'silver skate sled snail spider sponge spoon squid star stone storm sugar summer sunset swan sword ' +
  'table tiger toast tomato topaz torch tractor trumpet tulip turtle tunnel umbrella valley velvet violin volcano ' +
  'waffle wagon walnut walrus whale wheat whistle willow window winter wizard wolf yacht yogurt zebra zipper ' +
  'ant bee crab duck fig kiwi lamp moon pear rose ship sun tent wave yarn bell').split(' ');
if (WORDS.length !== 256 || new Set(WORDS).size !== 256) throw new Error('safety word list must have 256 different words');

/* ---------- files ---------- */
const b64 = buf => Buffer.from(buf).toString('base64url');
const unb64 = s => Buffer.from(String(s || ''), 'base64url');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const isKey = s => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s);          // a raw 32-byte key, base64url
const isBox = s => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);       // a mailbox id
const isCid = s => /^[0-9a-f]{12}$/.test(String(s));                                // a contact id (its file name)
const cleanName = (n, dflt) => String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) || dflt;

// A chat file (data/dms/<contact>.json) is kept sealed on disk (lib/atrest.js, AIG-1166); the other files here are not chats.
const A = require('./atrest');
const isChat = f => path.dirname(f) === DMS && /^[0-9a-f]{12}\.json$/.test(path.basename(f));
function readJson(f, dflt) { if (isChat(f)) return A.readJson(f, dflt); try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }
// Atomic (temp file + rename) and owner-only where the OS supports file modes. Windows ignores the mode;
// there the files are protected by the user profile's own permissions.
function writeJson(f, v) {
  if (isChat(f)) return A.writeText(f, JSON.stringify(v));   // sealed; refused (never plaintext) when the key is missing
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, f);
}
const F = {
  settings: () => path.join(DMS, 'settings.json'),
  contacts: () => path.join(DMS, 'contacts.json'),
  invites: () => path.join(DMS, 'invites.json'),
  outbox: () => path.join(DMS, 'outbox.json'),
  msgs: id => path.join(DMS, id + '.json'),
  files: id => path.join(DMS, 'files', id),
};
// Sharing (lib/share.js, docs/SHARING-DESIGN.md) plugs in here, so dm.js never requires it:
// hooks.share(contact, env, payload) takes a verified { t: 'share' } payload; hooks.ended(contactId) runs on block or remove.
// Ask a mate (lib/ask.js, AIG-210) plugs in the same way: hooks.ask(contact, env, payload) takes { t: 'ask' | 'answer' }.
// Token use shared with friends (lib/usageshare.js, AIG-686): hooks.usage(contact, env, payload) takes { t: 'usage' }.
const hooks = {};
// Every read-modify-write below is synchronous, so two requests (or a request and the poll) can't interleave it.
const update = (file, dflt, fn) => { const v = readJson(file, dflt); const out = fn(v); writeJson(file, v); return out; };

/* ---------- identity: this board's keys ---------- */
// Made on first use: X25519 (key agreement), Ed25519 (signing) and a random mailbox id. Never leaves this computer.
let me = null;
function identity() {
  if (me) return me;
  const f = path.join(KEYS, 'identity.json');
  let id;
  if (fs.existsSync(f)) id = JSON.parse(fs.readFileSync(f, 'utf8'));   // a damaged file is an error, never silently replaced
  else {
    const jwk = k => k.export({ format: 'jwk' });
    id = { v: 1, created: now(), mailbox: b64(crypto.randomBytes(18)),
      x: jwk(crypto.generateKeyPairSync('x25519').privateKey), e: jwk(crypto.generateKeyPairSync('ed25519').privateKey) };
    writeJson(f, id);
  }
  me = { mailbox: id.mailbox, xPub: id.x.x, ePub: id.e.x,
    xPriv: crypto.createPrivateKey({ key: id.x, format: 'jwk' }), ePriv: crypto.createPrivateKey({ key: id.e, format: 'jwk' }) };
  return me;
}
const xKey = x => crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x }, format: 'jwk' });
const eKey = x => crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });

// Both sides get the same 6 words: the two people's public keys, sorted, hashed.
function safetyCode(a, b) {
  const [p, q] = [a.x + '.' + a.e, b.x + '.' + b.e].sort();
  const h = crypto.createHash('sha256').update(V + '|safety|' + p + '|' + q).digest();
  return [...h.subarray(0, 6)].map(n => WORDS[n]).join(' ');
}

/* ---------- settings: on/off and the relay ---------- */
function cleanRelay(u) {
  let url;
  try { url = new URL(String(u)); } catch { throw bad('the relay must be a web address, like https://relay.example.com'); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw bad('the relay must be a plain http(s) address');
  // A relay address comes from an invite, so never let one point the board at itself.
  if (/^(localhost|127\.[\d.]+|\[::1\]|0\.0\.0\.0)$/i.test(url.hostname) && Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === PORT) throw bad('the relay cannot be this board');
  return url.origin + url.pathname.replace(/\/+$/, '');
}
const defaultRelay = () => String(process.env.AIGILE_RELAY || localSettings().dmRelay || '');
function settings() {
  const s = readJson(F.settings(), {});
  return { on: !!s.on, relay: s.relay || defaultRelay() };
}
// { on?, relay? }. Turning DMs on claims this board's mailbox on the relay straight away (the first poll).
async function setSettings(b) {
  update(F.settings(), {}, s => {
    if ('relay' in b) s.relay = b.relay ? cleanRelay(b.relay) : '';
    if ('on' in b) s.on = !!b.on;
    if (s.on && !(s.relay || defaultRelay())) throw bad('set a relay address before turning DMs on');
  });
  if (settings().on) await poll();
  return status();
}

// { relay? }: ask that relay's /health (short timeout) so Setup can say whether the address works. Never throws: { ok, kind, reason }.
async function checkRelay(b) {
  let relay;
  try { relay = cleanRelay(b && b.relay || settings().relay); } catch (e) { return { ok: false, kind: 'address', reason: e.message }; }
  try {
    const r = await fetch(relay + '/health', { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!r.ok) return { ok: false, kind: 'status', reason: 'the relay answered ' + r.status };
    const j = await r.json().catch(() => null);
    return j && j.ok === true ? { ok: true, relay } : { ok: false, kind: 'notrelay', reason: 'that address answers, but it is not an AI-gile relay' };
  } catch (e) { return { ok: false, kind: e.name === 'TimeoutError' ? 'slow' : 'unreachable', reason: e.name === 'TimeoutError' ? 'no answer within 5 seconds' : 'could not reach it (' + ((e.cause && e.cause.code) || e.message) + ')' }; }
}

/* ---------- contacts ---------- */
const contacts = () => readJson(F.contacts(), []);
const shown = c => ({ pretend: !!c.pretend, id: c.id, name: c.name, safety: c.safety, checked: !!c.checked, blocked: !!c.blocked, added: c.added, mailbox: c.mailbox, relay: c.relay, ...require('./friendpics').urls(c.id) });   // pic, mine: my picture for them (AIG-883)
function contact(id) {
  const c = isCid(id) && contacts().find(c => c.id === id);
  if (!c) throw bad('contact not found', 404);
  return c;
}
function newContact(k, name, id) {
  try { xKey(k.x); eKey(k.e); } catch { throw bad('the keys in that invite are not valid'); }
  const mine = identity();
  return { id: isCid(id) && !contacts().some(c => c.id === id) ? id : crypto.randomBytes(6).toString('hex'), name, mailbox: k.m, relay: k.r, x: k.x, e: k.e,
    safety: safetyCode({ x: mine.xPub, e: mine.ePub }, k), added: now() };
}
// { name?, checked?, blocked? }. checked: the two people read the safety code to each other and it matched.
// Blocking is the killswitch for one person: nothing from them is kept, nothing is sent to them.
function patchContact(id, b) {
  contact(id);
  let out, pend;
  update(F.contacts(), [], list => {
    const c = list.find(c => c.id === id);
    if ('name' in b) c.name = cleanName(b.name, c.name);
    if ('checked' in b) { c.checked = !!b.checked || undefined; if (c.checked && c.play) { pend = c.play; delete c.play; } }
    if ('blocked' in b) c.blocked = !!b.blocked || undefined;
    if ('pretend' in b) c.pretend = !!b.pretend || undefined;
    out = shown(c);
  });
  if (pend) try { require('./playground').onChecked(id, pend); } catch {}   // a playground waiting for the safety check (AIG-818)
  if (out.blocked) { dropOutbox(id); if (hooks.ended) hooks.ended(id); }   // blocking ends every shared-project link with them
  return out;
}
// A playground waits on this friend's safety check (AIG-818).
function holdPlay(id, play) { contact(id); update(F.contacts(), [], list => { const c = list.find(c => c.id === id); if (c) c.play = play; }); }
function removeContact(id) {
  contact(id);
  update(F.contacts(), [], list => list.splice(list.findIndex(c => c.id === id), 1));
  dropOutbox(id);
  if (hooks.ended) hooks.ended(id);
  try { fs.unlinkSync(F.msgs(id)); } catch {}
  require('./friendpics').forget(id);
  require('./features').forget(id);
  try { fs.rmSync(F.files(id), { recursive: true, force: true }); } catch {}
  E.removeFrom(id);
  return { removed: id };
}

/* ---------- invites ---------- */
// The code is base64url JSON: [version, relay, mailbox, X25519 key, Ed25519 key, one-off secret, expiry].
// Only the secret's hash is kept here; the friend's board proves it has the code by sending it back sealed.
function createInvite(b = {}, meta = null) {   // meta: set by the owner-only playground code, never from a request body (AIG-818)
  const s = settings();
  if (!s.on) throw bad('turn DMs on first', 409);
  // days (AIG-347): an invite that rides inside a join link has to outlast that link (up to 8 days).
  const mine = identity(), secret = crypto.randomBytes(16), exp = Date.now() + (b.days ? Math.min(8, Math.max(1, Number(b.days) || 2)) * 24 * 3600e3 : INVITE_MS);
  const id = crypto.randomBytes(6).toString('hex');   // the picture key (AIG-883); the friend joins under this id
  update(F.invites(), [], list => {
    const keep = list.filter(i => i.exp > Date.now()).slice(-49);
    for (const i of list) if (i.id && !keep.includes(i)) require('./friendpics').forget(i.id);
    list.splice(0, list.length, ...keep);
    list.push({ id, hash: sha256(secret), exp, name: cleanName(b.name, ''), created: now(), ...(meta && meta.play ? { play: meta.play } : {}) });
  });
  return { id, code: b64(JSON.stringify([1, s.relay, mine.mailbox, mine.xPub, mine.ePub, b64(secret), exp])), expires: new Date(exp).toISOString() };
}
// Drops one open invite by its id (a cancelled join link, AIG-1249): the friend can no longer use the code.
function dropInvite(id) {
  const gone = update(F.invites(), [], list => { const i = list.findIndex(x => x.id === id); return i < 0 ? null : list.splice(i, 1)[0]; });
  if (gone) { try { require('./friendpics').forget(id); } catch {} }
  return !!gone;
}
function readInvite(code) {
  let a;
  try { a = JSON.parse(unb64(String(code || '').trim()).toString('utf8')); } catch {}
  if (!Array.isArray(a) || a[0] !== 1 || !isBox(a[2]) || !isKey(a[3]) || !isKey(a[4]) || !/^[A-Za-z0-9_-]{22}$/.test(a[5]) || typeof a[6] !== 'number') throw bad('that invite code is not valid');
  return { r: cleanRelay(a[1]), m: a[2], x: a[3], e: a[4], s: a[5], exp: a[6] };
}
// { code, name }: add the person who sent the code, and send them a sealed hello (our keys, relay and the secret).
async function acceptInvite(b) {
  const s = settings();
  if (!s.on) throw bad('turn DMs on first', 409);
  const inv = readInvite(b.code);
  if (inv.exp < Date.now()) throw bad('that invite has expired, ask for a new one');
  const mine = identity();
  if (inv.m === mine.mailbox) throw bad('that is your own invite');
  if (contacts().some(c => c.mailbox === inv.m)) throw bad('you already have this person', 409);
  const c = newContact(inv, cleanName(b.name, 'Friend'));
  update(F.contacts(), [], list => list.push(c));
  queue(c, { t: 'hello', s: inv.s, m: mine.mailbox, r: s.relay, x: mine.xPub, e: mine.ePub, name: cleanName(b.me, '') });
  await flush();
  return shown(c);
}

/* ---------- sealing and opening ---------- */
const header = h => [V, h.v, h.to, h.from, h.id, h.ts, h.epk].join('\n');
const signed = env => Buffer.from([header(env), env.iv, env.ct].join('\n'));
const keyFor = (shared, epk, to) => Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.concat([unb64(epk), unb64(to)]), V + '|msg', 32));

function seal(c, payload) {
  const mine = identity(), eph = crypto.generateKeyPairSync('x25519');
  const epk = eph.publicKey.export({ format: 'jwk' }).x;
  const head = { v: 1, to: c.mailbox, from: mine.mailbox, id: b64(crypto.randomBytes(16)), ts: Date.now(), epk };
  const key = keyFor(crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: xKey(c.x) }), epk, c.x);
  const iv = crypto.randomBytes(12), ci = crypto.createCipheriv('aes-256-gcm', key, iv);
  ci.setAAD(Buffer.from(header(head)));
  const ct = Buffer.concat([ci.update(JSON.stringify(payload), 'utf8'), ci.final(), ci.getAuthTag()]);
  const env = { ...head, iv: b64(iv), ct: b64(ct) };
  env.sig = b64(crypto.sign(null, signed(env), mine.ePriv));
  return env;
}
const wellFormed = e => e && typeof e === 'object' && e.v === 1 && isBox(e.to) && isBox(e.from) && /^[A-Za-z0-9_-]{22}$/.test(e.id)
  && Number.isFinite(e.ts) && isKey(e.epk) && /^[A-Za-z0-9_-]{16}$/.test(e.iv) && typeof e.ct === 'string' && e.ct.length > 22 && /^[A-Za-z0-9_-]{86}$/.test(e.sig || '');
function checkSig(env, signer) {
  if (!crypto.verify(null, signed(env), eKey(signer), unb64(env.sig))) throw new Error('the signature does not match this person\'s key');
}
function decrypt(env) {
  const mine = identity(), ct = unb64(env.ct);
  const key = keyFor(crypto.diffieHellman({ privateKey: mine.xPriv, publicKey: xKey(env.epk) }), env.epk, mine.xPub);
  const de = crypto.createDecipheriv('aes-256-gcm', key, unb64(env.iv));
  de.setAAD(Buffer.from(header(env)));
  de.setAuthTag(ct.subarray(ct.length - 16));
  try { return JSON.parse(Buffer.concat([de.update(ct.subarray(0, ct.length - 16)), de.final()]).toString('utf8')); }
  catch { throw new Error('it could not be decrypted'); }
}

/* ---------- receiving ---------- */
// One envelope from our mailbox. Known person: check the signature, then decrypt; anything that fails is kept as
// not verified, without text. Unknown sender: only a hello carrying one of our invite secrets is accepted.
// AIG-1172: an error that means something could not be saved (a sealed chat refused, or a file write failing: disk full,
// no permission, rename refused), as opposed to a bad envelope.
const unsaved = e => !!(e && (e.atrest || e.syscall));
function receive(env) {
  const mine = identity();
  if (!wellFormed(env) || env.to !== mine.mailbox) return 'dropped';
  const c = contacts().find(c => c.mailbox === env.from);
  if (!c) return receiveHello(env);
  if (c.blocked) return 'blocked';
  const list = readJson(F.msgs(c.id), []), same = list.find(m => m.raw && m.raw.id === env.id);
  if (same && JSON.stringify(same.raw) === JSON.stringify(env)) return 'duplicate';
  let msg;
  try {
    checkSig(env, c.e);
    const p = decrypt(env);
    if (same) throw new Error('it repeats an earlier message id');
    if (p.t === 'hello') return 'duplicate';   // they accepted twice; we already have them
    if (p && p.t === 'share') return hooks.share ? hooks.share(c, env, p) : 'dropped';   // a shared-project message: never a chat line
    if (p && (p.t === 'ask' || p.t === 'answer')) return hooks.ask ? hooks.ask(c, env, p) : 'dropped';   // ask a mate: lib/ask.js keeps it
    if (p && p.t === 'usage') return hooks.usage ? hooks.usage(c, env, p) : 'dropped';   // a friend's token use glance (AIG-686): lib/usageshare.js
    if (p && CHANGES.includes(p.t)) return receiveChange(c, env, p);   // AIG-1164: an edit, delete, reaction or typing, never a chat line
    if (p && p.t === 'call') return hooks.call ? hooks.call(c, env, p) : 'dropped';   // 📞 a friend started a call (AIG-1162): lib/calls.js
    if (p.t !== 'msg' || typeof p.text !== 'string') throw new Error('it is not a message');
    const attachments = saveFiles(c.id, env.id, p.files);
    try { E.receive(c.id, p.emojis); } catch {}   // custom emojis (AIG-650): checked one by one, a bad one is dropped
    const reply = replyIn(list, p.reply);
    typing.delete(c.id);
    msg = { id: env.id, dir: 'in', text: p.text.slice(0, MAX_TEXT), at: new Date(env.ts).toISOString(), got: now(), verified: true, ...(attachments.length ? { attachments } : {}), ...(reply ? { reply } : {}), raw: env };
  } catch (e) {
    if (unsaved(e)) throw e;   // AIG-1172: the disk failed, not the envelope: the poll leaves it on the relay
    msg = { id: b64(crypto.randomBytes(16)), dir: 'in', text: null, at: now(), got: now(), verified: false, reason: e.message, raw: env };
  }
  update(F.msgs(c.id), [], l => l.push(msg));
  return msg.verified ? 'message' : 'unverified';
}
function receiveHello(env) {
  let p;
  try { p = decrypt(env); } catch { return 'dropped'; }
  if (!p || p.t !== 'hello' || p.m !== env.from || !isKey(p.x) || !isKey(p.e) || typeof p.s !== 'string') return 'dropped';
  try { checkSig(env, p.e); } catch { return 'dropped'; }
  let r; try { r = cleanRelay(p.r); } catch { return 'dropped'; }
  const hash = sha256(unb64(p.s));
  const inv = update(F.invites(), [], list => {
    const i = list.findIndex(i => i.hash === hash && i.exp > Date.now());
    return i < 0 ? null : list.splice(i, 1)[0];   // one-off: the secret is used up
  });
  if (!inv) return 'dropped';
  const c = newContact({ m: p.m, r, x: p.x, e: p.e }, inv.name || cleanName(p.name, 'Friend'), inv.id);
  if (inv.play) c.play = inv.play;   // a playground invite (AIG-818): offered once the owner has checked the safety code
  update(F.contacts(), [], list => { if (!list.some(o => o.mailbox === c.mailbox)) list.push(c); });
  return 'hello';
}

/* ---------- sending: the outbox ---------- */
// Sealed envelopes wait in data/dms/outbox.json until their relay takes them (retried by the poll).
function queue(c, payload, msg) {
  const env = seal(c, payload);
  if (msg) update(F.msgs(c.id), [], l => l.push({ ...msg, id: env.id, raw: env }));
  update(F.outbox(), [], l => l.push({ cid: c.id, env, since: Date.now() }));
  return env;
}
function dropOutbox(cid) { update(F.outbox(), [], l => l.splice(0, l.length, ...l.filter(o => o.cid !== cid))); }
function markSent(cid, id, status) {
  update(F.msgs(cid), [], l => { const m = l.find(m => m.id === id); if (m) m.status = status; });
}
let flushing = null;
const flush = () => flushing || (flushing = doFlush().finally(() => { flushing = null; }));
async function doFlush() {
  for (const o of readJson(F.outbox(), [])) {
    const c = contacts().find(c => c.id === o.cid);
    let done = !c || c.blocked ? 'dropped' : null;
    if (!done) {
      try {
        const r = await fetch(c.relay + '/m/' + c.mailbox, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o.env), signal: AbortSignal.timeout(10000) });
        // 400/413: the relay will never take it. 404 (not claimed yet), 429 and 5xx: try again later.
        done = r.ok ? 'sent' : [400, 413].includes(r.status) ? 'failed' : r.status === 507 ? 'full' : null;
      } catch {}
      if (!done && Date.now() - o.since > RETRY_MS) done = 'failed';
    }
    if (!done) continue;
    update(F.outbox(), [], l => { const i = l.findIndex(x => x.env.id === o.env.id); if (i >= 0) l.splice(i, 1); });
    if (c && done === 'full') { update(F.msgs(c.id), [], l => { const m = l.find(m => m.id === o.env.id); if (m) { m.status = 'failed'; m.reason = c.name + "'s mailbox is full: they need to open AI-gile"; } }); continue; }
    if (c) markSent(c.id, o.env.id, done);
  }
}

/* ---------- attachments: sealed inside the message, kept in data/dms/files/<contact>/ (sealed on disk too, AIG-1170) ---------- */
const safeName = n => String(n || 'file').replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
// files: [{ name, type, data: base64 }] -> saved, returned as [{ id, name, type }].
function saveFiles(cid, mid, files) {
  const out = [];
  for (const [i, f] of (Array.isArray(files) ? files : []).slice(0, 10).entries()) {
    const buf = Buffer.from(String(f && f.data || ''), 'base64');
    if (!buf.length) continue;
    const id = String(mid).replace(/[^\w]/g, '').slice(0, 12) + i + '-' + safeName(f.name);
    fs.mkdirSync(F.files(cid), { recursive: true, mode: 0o700 });
    A.writeBytes(path.join(F.files(cid), id), buf);   // sealed (lib/atrest.js); refused, never plaintext, without the key
    out.push({ id, name: safeName(f.name), type: String(f.type || '').slice(0, 100) });
  }
  return out;
}
function fileOf(cid, id) {
  contact(cid);
  if (!/^\w+-[\w.\- ]+$/.test(id)) throw bad('bad attachment id', 404);
  const f = path.join(F.files(cid), id);
  if (!fs.existsSync(f)) throw bad('attachment not found', 404);
  return f;
}
// AIG-1170: for serving: the path (its extension picks the content type) and the bytes, opened (old plaintext ones as they are).
function fileData(cid, id) { const f = fileOf(cid, id); return { __file: f, bytes: A.readBytes(f) }; }

// { text, attachments? }: seal it to this person and hand it to their relay.
async function send(id, b) {
  if (!settings().on) throw bad('DMs are off', 409);
  const c = contact(id);
  if (c.blocked) throw bad('unblock this person first', 409);
  const text = String(b.text || '').trim(), files = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 10).filter(f => f && f.data);
  if (!text && !files.length) throw bad('text is required');
  if (text.length > MAX_TEXT) throw bad('messages can be up to ' + MAX_TEXT + ' characters');
  if (files.reduce((n, f) => n + String(f.data).length * 0.75, 0) > MAX_FILES) throw bad('attachments can be up to 8 MB in all');
  let reply = null;   // AIG-1164: quoting one message of this chat
  if (b.reply) { const q = chatRaw(c.id).find(m => m.id === String(b.reply) && m.verified !== false); if (!q) throw bad('the message you reply to is not in this chat', 404); reply = { id: q.id, text: excerpt(q) }; }
  const mid = b64(crypto.randomBytes(8)), saved = saveFiles(c.id, mid, files);
  const em = E.forSend(c.id, text);   // custom emojis (AIG-650): the small picture goes once per friend, inside this message
  E.markSent(c.id, em.mark);
  return sendPayload(c, { t: 'msg', text, ...(reply ? { reply } : {}), ...(Object.keys(em.emojis).length ? { emojis: em.emojis } : {}), ...(saved.length ? { files: files.map(f => ({ name: safeName(f.name), type: String(f.type || '').slice(0, 100), data: String(f.data) })) } : {}) },
    { dir: 'out', text, at: now(), verified: true, ...(reply ? { reply } : {}), ...(saved.length ? { attachments: saved } : {}) });
}

/* ---------- replies, edits, deletes, reactions and typing (AIG-1164, lifted from ChilledChat) ---------- */
// Each goes to the friend sealed like a message, naming the message by its id (the envelope id, the same on both boards).
// Only the author edits or deletes: my changes only touch my own lines ('out'), theirs only their lines ('in').
// A reaction may go on any line of the chat, by either of us. Typing is never kept: it lives in memory for a few seconds.
const CHANGES = ['edit', 'del', 'react', 'typing'];
const TYPING_MS = 8000, TYPING_EVERY = 4000, TYPING_AWAKE = 15 * 60e3;
const typing = new Map(), typingSent = new Map();   // contact id -> when they last typed / when I last told them
const isTyping = cid => (typing.get(cid) || 0) > Date.now() - TYPING_MS;
const excerpt = m => m.deleted ? '' : String(m.text || (m.attachments ? '📎' : '')).replace(/\s+/g, ' ').trim().slice(0, 120);
// A reaction is one real emoji (ChilledChat's isAllowedReaction): short, no letters, no HTML or control characters.
function okReaction(e) {
  if (typeof e !== 'string' || !e || [...e].length > 12) return false;
  if (/[<>&"'`\\\x00-\x1f]/.test(e) || /[A-Za-z0-9]/.test(e)) return false;
  return /[\p{Extended_Pictographic}⃣]/u.test(e);
}
// A reply that came in: our own copy of the quoted line wins over the excerpt they sent.
function replyIn(list, r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{8,40}$/.test(r.id)) return null;
  const q = list.find(m => m.id === r.id);
  return { id: r.id, text: q ? excerpt(q) : String(r.text || '').replace(/\s+/g, ' ').slice(0, 120) };
}
function dropFiles(cid, m) { for (const a of m.attachments || []) try { fs.unlinkSync(path.join(F.files(cid), a.id)); } catch {} delete m.attachments; }
function receiveChange(c, env, p) {
  if (p.t === 'typing') { if (Math.abs(Date.now() - env.ts) < TYPING_MS) typing.set(c.id, Date.now()); return 'typing'; }
  if (typeof p.id !== 'string') return 'dropped';
  let out = 'dropped';
  update(F.msgs(c.id), [], l => {
    const m = l.find(m => m.id === p.id && m.verified !== false); if (!m) return;
    if (p.t === 'react') {
      if (!okReaction(p.e) || m.deleted) return;
      m.rts = m.rts || {}; if ((m.rts[p.e] || 0) >= env.ts) return;   // an older one, replayed: ignored
      m.rts[p.e] = env.ts;
      const r = m.reacts = m.reacts || { mine: [], theirs: [] };
      r.theirs = r.theirs.filter(x => x !== p.e); if (p.on) r.theirs = [...r.theirs, p.e].slice(-20);
      out = 'react'; return;
    }
    if (m.dir !== 'in' || m.kind || m.deleted || (m.changeTs || 0) >= env.ts) return;   // only their own plain lines, newest change wins
    if (p.t === 'edit') { if (typeof p.text !== 'string' || !p.text.trim()) return; m.text = p.text.trim().slice(0, MAX_TEXT); m.edited = new Date(env.ts).toISOString(); }
    else { m.deleted = new Date(env.ts).toISOString(); m.text = ''; dropFiles(c.id, m); }
    m.changeTs = env.ts; out = p.t;
  });
  if (out === 'edit' || out === 'del') typing.delete(c.id);
  return out;
}
// Mine to change: a plain line I sent (not an ask, not deleted).
function ownLine(c, mid) {
  const m = chatRaw(c.id).find(m => m.id === String(mid));
  if (!m) throw bad('message not found', 404);
  if (m.dir !== 'out' || m.kind || m.deleted) throw bad('only the person who wrote a message can change it', 403);
  return m;
}
function canSend(id) {
  if (!settings().on) throw bad('DMs are off', 409);
  const c = contact(id);
  if (c.blocked) throw bad('unblock this person first', 409);
  return c;
}
async function editMessage(id, mid, b) {
  const c = canSend(id), m = ownLine(c, mid), text = String((b && b.text) || '').trim();
  if (!text) throw bad('text is required');
  if (text.length > MAX_TEXT) throw bad('messages can be up to ' + MAX_TEXT + ' characters');
  changeLine(c.id, m.id, x => { x.text = text; x.edited = now(); });
  queue(c, { t: 'edit', id: m.id, text }); await flush();
  return messages(c.id).find(x => x.id === m.id);
}
async function deleteMessage(id, mid) {
  const c = canSend(id), m = ownLine(c, mid);
  changeLine(c.id, m.id, x => { x.deleted = now(); x.text = ''; dropFiles(c.id, x); });
  queue(c, { t: 'del', id: m.id }); await flush();
  return messages(c.id).find(x => x.id === m.id);
}
// { emoji }: on when I had not put it on this line, off when I had (like ChilledChat).
async function react(id, mid, b) {
  const c = canSend(id), e = b && b.emoji;
  if (!okReaction(e)) throw bad('a reaction is one emoji');
  const m = chatRaw(c.id).find(m => m.id === String(mid) && m.verified !== false);
  if (!m || m.deleted) throw bad('message not found', 404);
  let on = false;
  changeLine(c.id, m.id, x => { const r = x.reacts = x.reacts || { mine: [], theirs: [] }; on = !r.mine.includes(e); r.mine = r.mine.filter(y => y !== e); if (on) r.mine = [...r.mine, e].slice(-20); });
  queue(c, { t: 'react', id: m.id, e, on }); await flush();
  return messages(c.id).find(x => x.id === m.id);
}
// "I am typing": straight to their relay, not through the outbox, at most every few seconds, and only while they have
// written lately (so a friend who is away never finds a pile of these in the mailbox).
async function sendTyping(id) {
  const c = canSend(id), last = lastOf(c.id).lastIn;
  if (Date.now() - (typingSent.get(c.id) || 0) < TYPING_EVERY) return { ok: true, sent: false };
  if (!last || Date.now() - Date.parse(last) > TYPING_AWAKE) return { ok: true, sent: false };
  typingSent.set(c.id, Date.now());
  try { await fetch(c.relay + '/m/' + c.mailbox, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seal(c, { t: 'typing' })), signal: AbortSignal.timeout(5000) }); } catch { return { ok: true, sent: false }; }
  return { ok: true, sent: true };
}
// Seal a payload, keep msg as our line in the chat, hand it to the relay. Returns the stored line (without the envelope).
async function sendPayload(c, payload, msg) {
  const env = queue(c, payload, { status: 'sending', ...msg });
  await flush();
  if (readJson(F.outbox(), []).some(o => o.env.id === env.id)) await flush();   // a flush already running may have missed it
  return messages(c.id).find(m => m.id === env.id);
}
// For lib/ask.js: a chat with its envelopes, add a line, change a line.
const chatRaw = cid => readJson(F.msgs(cid), []);
const keepLine = (cid, msg) => update(F.msgs(cid), [], l => l.push(msg));
const changeLine = (cid, id, fn) => update(F.msgs(cid), [], l => { const m = l.find(m => m.id === id); if (m) fn(m); });

// after (AIG-1102): a message id; only the messages that come after it (all of them when it is not in the chat), for polling.
const messages = (id, after) => {
  contact(id);
  let l = readJson(F.msgs(id), []);
  if (after) { const i = l.findIndex(m => m.id === after); if (i >= 0) l = l.slice(i + 1); }
  return l.map(({ raw, ...m }) => m);
};
// AIG-1102: the last-message summary per contact, kept by the chat file's size + mtime so the contacts poll does not re-read every chat.
const lastCache = new Map();   // file -> { size, mtime, meta }
function lastOf(id) {
  const f = F.msgs(id);
  let st; try { st = fs.statSync(f); } catch { lastCache.delete(f); st = null; }
  const c = lastCache.get(f);
  if (c && st && c.size === st.size && c.mtime === st.mtimeMs) return c.meta;
  const l = readJson(f, []), last = l.at(-1), lastIn = l.filter(m => m.dir === 'in').at(-1);
  const meta = { last: last ? last.at : null, lastText: last ? String(last.text || (last.attachments ? '📎' : '')).replace(/\s+/g, ' ').trim().slice(0, 120) : '', lastIn: lastIn ? lastIn.at : null, lastKind: last ? last.kind || '' : '', lastDir: last ? last.dir : '' };
  if (st) lastCache.set(f, { size: st.size, mtime: st.mtimeMs, meta });
  return meta;
}
// AIG-1166: the whole chat as plain JSON for the owner (the file on disk is sealed): a backup that opens anywhere.
function exportChat(id) {
  const c = contact(id);
  return { exported: now(), contact: { id: c.id, name: c.name }, messages: readJson(F.msgs(id), []).map(({ raw, ...m }) => m) };
}
// "See what the relay sees": the envelope exactly as it went through the relay.
function rawMessage(id, mid) {
  contact(id);
  const m = readJson(F.msgs(id), []).find(m => m.id === mid);
  if (!m) throw bad('message not found', 404);
  return { id: m.id, envelope: m.raw };
}

/* ---------- the relay mailbox ---------- */
// Requests to our own mailbox are signed with our Ed25519 key, with a timestamp and a one-off nonce (no replays).
async function relayCall(relay, method, p, body) {
  const mine = identity(), data = body === undefined ? '' : JSON.stringify(body);
  const ts = String(Date.now()), nonce = b64(crypto.randomBytes(12));
  const sig = crypto.sign(null, Buffer.from(['aigile-relay-v1', method, p, ts, nonce, sha256(data)].join('\n')), mine.ePriv);
  const headers = { 'x-relay-key': mine.ePub, 'x-relay-ts': ts, 'x-relay-nonce': nonce, 'x-relay-sig': b64(sig) };
  if (data) headers['Content-Type'] = 'application/json';
  const r = await fetch(relay + p, { method, headers, body: data || undefined, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('relay said ' + r.status + (j.error ? ': ' + j.error : ''));
  return j;
}
// Headers that sign one request with this board's key, for a service of ours that knows the key (the join service, AIG-347).
function signHeaders(domain, prefix, method, p, data) {
  const mine = identity(), ts = String(Date.now()), nonce = b64(crypto.randomBytes(12));
  const sig = crypto.sign(null, Buffer.from([domain, method, p, ts, nonce, sha256(data)].join('\n')), mine.ePriv);
  return { [prefix + '-key']: mine.ePub, [prefix + '-ts']: ts, [prefix + '-nonce']: nonce, [prefix + '-sig']: b64(sig) };
}
let lastPoll = null, polling = null;
// Collect our mailbox (and retry the outbox). Does nothing at all while DMs are off.
const poll = () => polling || (polling = doPoll().finally(() => { polling = null; }));
async function doPoll() {
  const s = settings();
  if (!s.on || !s.relay) return;
  try {
    A.ready();   // AIG-1166: chats cannot be saved (no key): leave everything on the relay rather than collect and lose it
    await flush();
    const box = '/m/' + identity().mailbox;
    const { envelopes = [] } = await relayCall(s.relay, 'GET', box);
    // AIG-1172: ack only what was saved or deliberately turned away (bad signature, not a message, unknown sender). At the first
    // one that could not be saved, stop: it and the rest stay on the relay and come again on the next poll.
    const rids = []; let failed = null;
    for (const { env, rid } of envelopes) {
      try { receive(env); } catch (e) { if (unsaved(e)) { failed = e; break; } }   // any other error: a bad envelope, dropped
      rids.push(rid);
    }
    if (rids.length) await relayCall(s.relay, 'POST', box + '/ack', { rids });
    if (failed) throw failed;
    lastPoll = { at: now(), ok: true, got: envelopes.length };
  } catch (e) {
    lastPoll = { at: now(), ok: false, error: e.message };
  }
}
let timer = null;
function startDms() { if (!timer) timer = setInterval(poll, POLL_MS); }

function status() {
  const s = settings();
  return { on: s.on, relay: s.relay, mailbox: identity().mailbox, contacts: contacts().map(shown), lastPoll };
}

const pendingInvite = id => readJson(F.invites(), []).some(i => i.id === id && i.exp > Date.now());   // AIG-883
// AIG-1235: open an envelope sealed to this board without a sender (the relay seals interest sign-ups to RELAY_OWNER_XPUB).
const openSealed = env => { if (!env || typeof env !== 'object' || env.v !== 1 || !isKey(env.epk) || typeof env.iv !== 'string' || typeof env.ct !== 'string') throw new Error('not a sealed item'); return decrypt(env); };
module.exports = { openSealed, fileData, exportChat, pendingInvite, dropInvite, relayCall, relayAddress: () => settings().relay, signHeaders, identity, readInvite, cleanRelay, status, setSettings, checkRelay, createInvite, holdPlay, acceptInvite, patchContact, removeContact, contacts: () => contacts().map(c => ({ ...shown(c), ...lastOf(c.id), typing: isTyping(c.id) })),  fileOf, send, editMessage, deleteMessage, react, sendTyping, okReaction, sendPayload, chatRaw, keepLine, changeLine, messages, hooks, queue: (c, payload) => queue(c, payload), flush, on: () => settings().on, contactRaw: contact, rawMessage, poll: async () => { await poll(); return status(); }, startDms, safetyCode, WORDS };
