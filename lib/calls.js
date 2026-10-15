// 📞 Calls (AIG-1162): voice, video and screen share in a friend's DM, over the owner's own LiveKit server (lifted from ChilledChat).
// Setup keeps the LiveKit address and API key in aigile.local.json ("calls": { url, key }) and the API secret like the Gemini key
// (secrets.keep, encrypted on this PC, never listed or sent to the page). The board signs LiveKit access tokens itself
// (HS256 JWT with node's crypto, no SDK). The page never picks the room: it is worked out here from the two boards' mailboxes,
// so both sides get the same name, and only the owner (the page, not a team) of a DM with that friend gets a token.
//
// The friend's board may have no LiveKit of its own: starting a call ("ringing") also seals a guest token for the friend into
// the DM ({ t: 'call' }). Their board keeps it (data/calls/invites.json) while it lasts, and their 📞 joins with it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, LOCAL_FILE, localSettings, owner, now, bad } = require('./store');
const dm = require('./dm');
const tr = (k, v) => require('./i18n').t(k, v);

const SECRET = 'livekit:secret';
const TTL_S = 2 * 3600;   // a token works for 2 hours, like ChilledChat's
const INVITES = () => path.join(DATA, 'calls', 'invites.json');
const secrets = () => require('./secrets');

/* ---------- settings ---------- */
const conf = () => { const c = localSettings().calls || {}; return { url: String(c.url || ''), key: String(c.key || '') }; };
const secretSet = () => { try { return secrets().hasKept(SECRET); } catch { return false; } };
const ready = () => { const c = conf(); return !!(c.url && c.key && secretSet()); };
// What the page may see: never the secret, only whether there is one.
const status = () => { const c = conf(); return { set: ready(), url: c.url, key: c.key, secret: secretSet() }; };
function cleanUrl(u) {
  let x; try { x = new URL(String(u || '').trim()); } catch { throw bad('the LiveKit address must look like wss://livekit.example.com'); }
  if (!/^(wss|https|ws|http):$/.test(x.protocol) || x.username || x.password || x.search || x.hash) throw bad('the LiveKit address must be a plain wss:// or https:// address');
  return x.origin + x.pathname.replace(/\/+$/, '');
}
// { url, key, secret? } (secret '' or missing = keep the saved one) or { clear: true }. The caller checked the secrets page token.
function save(b = {}) {
  const s = localSettings();
  if (b.clear) { delete s.calls; fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2) + '\n'); secrets().keep(SECRET, null); return status(); }
  const url = cleanUrl(b.url), key = String(b.key || '').trim(), secret = String(b.secret || '').trim();
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(key)) throw bad('the API key is letters and numbers, like APIxxxxxxxx');
  if (secret && (secret.length > 200 || /\s/.test(secret))) throw bad('that API secret does not look right');
  if (!secret && !secretSet()) throw bad('paste the API secret too');
  s.calls = { url, key }; fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2) + '\n');
  if (secret) secrets().keep(SECRET, secret);
  return status();
}

/* ---------- tokens ---------- */
const b64u = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
// A LiveKit access token: HS256, iss = API key, sub = identity, video grant for one room.
function sign(key, secret, { identity, name, room }) {
  const t = Math.floor(Date.now() / 1000);
  const body = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ iss: key, sub: identity, name, nbf: t - 10, exp: t + TTL_S,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true } });
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
// The room of a DM: both boards' mailboxes, sorted, hashed. Never from the page.
const roomOf = c => 'aigile-dm-' + crypto.createHash('sha256').update('aigile-call-v1|' + [dm.identity().mailbox, c.mailbox].sort().join('|')).digest('hex').slice(0, 32);

/* ---------- invites a friend sent (their board's guest token for me) ---------- */
const readInv = () => { try { return JSON.parse(fs.readFileSync(INVITES(), 'utf8')); } catch { return {}; } };
function writeInv(v) { fs.mkdirSync(path.dirname(INVITES()), { recursive: true, mode: 0o700 }); fs.writeFileSync(INVITES(), JSON.stringify(v), { mode: 0o600 }); }
// The guest token's own claims (we cannot check its signature: that is the friend's server's secret). It must be for this DM's
// room, for me (my mailbox, as the friend's board mints it), joinable, and live now for no longer than a token we would sign.
// AIG-1171: the envelope's room/exp alone are the friend's word; a token forwarded from another room carries that room inside.
function guestClaims(c, token) {
  if (typeof token !== 'string' || token.length > 4000 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
  let h, x; try { h = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')); x = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return null; }
  const t = Math.floor(Date.now() / 1000), v = x && x.video;
  if (!h || h.alg === 'none' || !v || v.room !== roomOf(c) || v.roomJoin !== true || x.sub !== dm.identity().mailbox) return null;
  if (!Number.isFinite(x.exp) || x.exp <= t + 60 || x.exp > t + TTL_S + 300 || (x.nbf != null && !(Number.isFinite(x.nbf) && x.nbf <= t + 60))) return null;
  return x;
}
const liveInvite = c => { const i = readInv()[c.id]; return i && i.room === roomOf(c) && guestClaims(c, i.token) && i.exp * 1000 - Date.now() > 60e3 ? i : null; };
// dm.hooks.call: a friend started a call. Kept only when its token is for our DM's own room and for me; shown as a line in the chat.
function receive(c, env, p) {
  const x = p && p.room === roomOf(c) && guestClaims(c, p.token);
  if (!x) return 'dropped';
  let url; try { url = cleanUrl(p.url); } catch { return 'dropped'; }
  const all = readInv(); all[c.id] = { url, token: p.token, room: x.video.room, exp: x.exp, at: now() }; writeInv(all);
  dm.keepLine(c.id, { id: env.id, dir: 'in', kind: 'call', text: tr('srv.lkcall.in'), at: new Date(env.ts).toISOString(), got: now(), verified: true, raw: env });
  return 'message';
}
dm.hooks.call = receive;

// Who may have a token: the owner (the page, or the owner's own CLI; never a team or a background run), for a friend in their DMs.
function friend(req, cid) {
  require('./share').ownerOnly(req);
  if (!dm.on()) throw bad('DMs are off', 409);
  const c = dm.contactRaw(cid);   // 404 when this is not one of my DMs
  if (c.blocked) throw bad('unblock this person first', 409);
  return c;
}
// AIG-1171: both of us press Call at once, each with our own LiveKit: each joins their own server and rings the other. So when
// both servers could host, the lower mailbox's server is where we meet: their invite wins only when I have no LiveKit or theirs wins.
// (The page, alone on its own server, asks again now and then and moves to theirs when this says so.)
const joinTheirs = (c, inv) => !!inv && (!ready() || String(c.mailbox) < String(dm.identity().mailbox));
// GET: what the 📞 button can do here, without making a token. theirs: a token now would join the friend's call on their server.
function dmState(req, cid) { const c = friend(req, cid), inv = liveInvite(c); return { set: ready(), invite: !!inv, theirs: joinTheirs(c, inv) }; }
// POST { ring? }: a token for this DM's room. A live invite from the friend wins (join their call, on their server) unless both of us
// have LiveKit and mine wins the tie-break; else my own server, and (ring, the default) a guest token for the friend goes into the DM.
async function dmToken(req, cid, b = {}) {
  const c = friend(req, cid), room = roomOf(c), inv = liveInvite(c);
  if (joinTheirs(c, inv)) return { url: inv.url, token: inv.token, room, theirs: true };
  if (!ready()) throw bad(tr('srv.lkcall.notset'), 409);
  const { url, key } = conf(), secret = secrets().kept(SECRET), mine = dm.identity().mailbox;
  const token = sign(key, secret, { identity: mine, name: owner(), room });
  if (b.ring !== false) {
    const exp = Math.floor(Date.now() / 1000) + TTL_S;
    await dm.sendPayload(c, { t: 'call', url, room, exp, token: sign(key, secret, { identity: c.mailbox, name: c.name, room }) },
      { dir: 'out', kind: 'call', text: tr('srv.lkcall.out'), at: now(), verified: true });
  }
  return { url, token, room, theirs: false };
}

/* ---------- a project's Meeting Room (AIG-1168) ---------- */
// The same call module, another room: this board's mailbox plus the project, hashed (never from the page). Owner only: this board
// cannot hand a guest pass to a friend or an agent, and a friend on a shared project has their own board, not my Meeting Room.
const meetRoom = slug => 'aigile-meet-' + crypto.createHash('sha256').update('aigile-meet-v1|' + dm.identity().mailbox + '|' + slug).digest('hex').slice(0, 32);
function meetProject(req, slug) {
  require('./share').ownerOnly(req);
  const p = require('./store').peek(slug);
  if (!p || p.archived) throw bad('no such project', 404);
  return p;
}
function meetState(req, slug) { meetProject(req, slug); return { set: ready() }; }
function meetToken(req, slug) {
  const p = meetProject(req, slug);
  if (!ready()) throw bad(tr('srv.lkcall.notset'), 409);
  const { url, key } = conf(), room = meetRoom(p.slug);
  return { url, token: sign(key, secrets().kept(SECRET), { identity: dm.identity().mailbox, name: owner(), room }), room, theirs: false };
}

module.exports = { meetState, meetToken, meetRoom, status, save, dmState, dmToken, roomOf, sign, ready };
