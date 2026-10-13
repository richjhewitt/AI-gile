// Sharing (AIG-304): the base every share-*.js module builds on. The wire constants and caps, roles, the link files
// (read / write / change), what both sides allow, sending, the text and scrub helpers. Pulls in no other share-*.js.
// The wire format and design are described at the top of share.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, load, bad, owner, isRich, TYPES, PRIORITIES } = require('./store');
const dm = require('./dm');
const changeRoles = require('./changeroles');   // AIG-856

const DIR = path.join(DATA, 'shares');
const FILES = id => path.join(DIR, 'files', id);   // their attachments (AIG-306), data only: never opened by the board
const OFFER_MS = 48 * 3600e3;          // an offer can be accepted for 2 days, like an invite
const MAX_AGE = 8 * 24 * 3600e3;       // envelopes older than this are dropped (the relay keeps 7 days)
const MAX_AHEAD = 10 * 60e3;           // or this far in the future (a wrong clock)
// file: one attachment per message, 6 MB before sealing (base64 twice over still fits the relay's 12 MB).
const CAPS = { title: 200, description: 20000, comment: 20000, name: 80, cards: 200, cardsPerDay: 50, perDay: 500, payload: 64 * 1024, pendingOffers: 5,
  file: 6 * 1024 * 1024, filesPerCard: 10, filesPerDay: 20, fileName: 80 };
const KINDS = ['link-offer', 'link-accept', 'link-end', 'card', 'comment', 'status', 'test', 'verdict', 'file', 'role', 'assign', 'features', 'ack'];
// What each side allows; what crosses is what both allow. Defaults are the safest (design: "What each side allows").
const ALLOW = { send: true, take: true, comments: true, status: false, files: false, teamRead: false };
const isLink = s => typeof s === 'string' && /^[A-Za-z0-9_-]{22}$/.test(s);
const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, CAPS.name);
const cleanAllow = a => Object.fromEntries(Object.entries(ALLOW).map(([k, d]) => [k, a && typeof a[k] === 'boolean' ? a[k] : d]));
const day = () => new Date().toISOString().slice(0, 10);
const isShare = s => typeof s === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(s);
// The allow-list: the only card fields that ever cross (design: "What is shared, and what never is").
const FIELDS = ['title', 'description', 'type', 'priority'];

/* ---------- roles on links (AIG-307, with AIG-185) ---------- */
// The friend's role, set by me on my board; nothing they send can raise it. Per link (this project), or for every
// project I link with them ("all my projects", data/shares/people.json); the link's own role wins. Default Member.
// raise: card types they may put in my 📥 lane. comment: '' none, 'own' only on cards they raised, 'shared' on any
// card we both hold. act: their status label on MY shared cards: '' never, 'assigned' only on cards I assigned
// them, 'all'. own: what they may add to their own lane cards. verdict: answer a test I handed them. seeMine: may
// I share my cards with them. No role ever counts as me or wakes a team: that is by construction (link file only).
const ROLES = ['viewer', 'alpha', 'reporter', 'member', 'tester', 'developer', 'admin'];
const MEMBER = { raise: TYPES.filter(k => k !== 'problem' && k !== 'change'), comment: 'shared', act: 'assigned', own: ['status', 'test', 'file'], verdict: false, seeMine: true };
const CAN = {
  viewer: { raise: [], comment: '', act: '', own: [], verdict: false, seeMine: true },
  alpha: { raise: ['bug', 'feature'], comment: 'own', act: '', own: [], verdict: false, seeMine: true },   // 🧪 Alpha tester (AIG-324)
  reporter: { raise: ['bug'], comment: 'own', act: '', own: ['status', 'file'], verdict: false, seeMine: false },
  member: MEMBER,
  tester: { ...MEMBER, verdict: true },
  developer: { ...MEMBER, act: 'all', verdict: true },
  admin: { ...MEMBER, act: 'all', verdict: true },   // as Developer on a link; the rest of Admin needs people on my board (later)
};
const isRole = r => ROLES.includes(r);
const PEOPLE = () => path.join(DIR, 'people.json');
function people() { try { return JSON.parse(fs.readFileSync(PEOPLE(), 'utf8')); } catch { return {}; } }
const roleOf = L => isRole(L.role) ? L.role : isRole(people()[L.contact]) ? people()[L.contact] : 'member';
const scopeOf = L => isRole(L.role) ? 'project' : isRole(people()[L.contact]) ? 'all' : 'default';
// AIG-856: a friend's change roles (Project manager, Test lead, Dev lead) sit on top of the share role and never replace it.
// change: the roles held here; a PM may raise a change card (once that type exists, AIG-857); the Test lead gets the verdict.
const changeOf = L => changeRoles.holds(L.slug, L.contact);
// The base role plus change roles. A PM may raise a change card (once the type exists, AIG-857). The Test lead's verdict
// right is only for change cards (verdictChange); the base verdict permission is never widened for other cards.
function withChange(base, h) {
  if (!h.length) return base;
  return { ...base, change: h, raise: h.includes('pm') && TYPES.includes('change') && !base.raise.includes('change') ? [...base.raise, 'change'] : base.raise, verdictChange: base.verdict || h.includes('testLead') };
}
const canOf = L => withChange(CAN[roleOf(L)], changeOf(L));
// What the role THEY gave me lets me do on their board: their base role plus the change roles they told me (validated;
// a label only, their board stays the authority).
const theirChangeOf = L => (Array.isArray(L.theirChange) ? L.theirChange : []).filter(x => changeRoles.ROLES.includes(x));
const theirCanOf = L => withChange(isRole(L.theirRole) ? CAN[L.theirRole] : MEMBER, theirChangeOf(L));
// May this role hand over / answer a test on this card type?
const verdictFor = (can, type) => !!(can.verdict || (type === 'change' && can.verdictChange));
// The role message to a friend: the share role, the board switch and the change roles I gave them (labels only).
const roleMsg = (L, extra) => ({ role: roleOf(L), board: !!L.board, chg: changeOf(L), ...extra });
// Who is asking (server.js passes the request): only the owner may use /api/shares. The page sends no
// X-Aigile-Where (server.js guard: this host, same origin for writes); the CLI always does, plus X-Aigile-As. A
// background run is always a team, whatever name it gives. Team agents keep their one door: teamView.
function ownerOnly(req) {
  const h = (req && req.headers) || {}, where = h['x-aigile-where'];
  if (!where) return;
  let as = ''; try { as = decodeURIComponent(String(h['x-aigile-as'] || '')); } catch {}
  if (where !== 'background' && as && isRich(as)) return;
  throw bad('only ' + owner() + ' can do this, from the board: sharing is the owner\'s (a team never ticks 🔗 or reads what a friend sent)', 403);
}

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
    droppedOff: L.droppedOff || 0, overCap: L.overCap || 0, stale: L.stale || 0, refused: L.refused || 0, inCards: Object.keys((L.inbound || {}).cards || {}).length,
    created: L.created, since: L.since || null, lastHeard: L.lastHeard || null, ended: L.ended || null, endedBy: L.endedBy || null, forgotten: !!L.forgotten,
    role: roleOf(L), roleScope: scopeOf(L), can: canOf(L), changeRoles: changeOf(L), theirChange: theirChangeOf(L), theirRole: isRole(L.theirRole) ? L.theirRole : null,
    // AIG-324: board = I show them my whole board; theirBoard = they show me theirs; theirCan = what the role they gave me lets me do there.
    approvals: !!(L.slug && (load(L.slug) || {}).approvals),   // AIG-814
    board: !!L.board, theirBoard: !!L.theirBoard, theirCan: isRole(L.theirRole) ? theirCanOf(L) : null };
}
const list = (slug) => all().filter(L => !slug || L.slug === slug).sort((a, b) => b.created.localeCompare(a.created)).map(shown);

/* ---------- sending ---------- */
// Every message on a link takes the next seq (saved before sealing, so a seq is never used twice).
function queueOn(id, kind, extra = {}) {
  if (!dm.on()) throw bad('DMs are off', 409);
  const L = link(id), c = dm.contactRaw(L.contact);
  if (c.blocked) throw bad('unblock this person first', 409);
  const seq = change(id, L => { L.seqOut = (L.seqOut || 0) + 1; return L.seqOut; });
  dm.queue(c, { t: 'share', link: id, seq, kind, ...extra });
}
async function sendOn(id, kind, extra = {}) { queueOn(id, kind, extra); await dm.flush(); }
function needChecked(cid) {
  const c = dm.contactRaw(cid);
  if (c.blocked) throw bad('this person is blocked', 409);
  if (!c.checked) throw bad('check the safety code with ' + c.name + ' first: read the 6 words to each other', 409);
  return c;
}

/* ---------- cards and comments (AIG-305) ---------- */
// Text from or to a friend: no control characters (newlines and tabs stay).
const cleanText = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const oneLine = v => cleanText(v).replace(/\s+/g, ' ').trim();
const safeName = n => String(n || 'file').split(/[\\/]/).pop().replace(/[^\w.\- ]+/g, '_').replace(/^[.\s]+/, '').slice(-CAPS.fileName) || 'file';

/* ---------- the friend-text fence for teams (AIG-306) ---------- */
// Every friend-authored string a team is given goes inside a marked block, with anything that looks like a fence
// marker taken out of it first (again until none is left, so a split marker can't rebuild itself), so friend text
// can't close the block early or open one of its own. The rule for teams is in AGENTS.md.
const MARK = /<<\s*\/?\s*friend-text[^>]*>>|<<\s*\/?\s*friend-text|friend-text\s*>>/gi;
function unfence(s) { let t = String(s == null ? '' : s), was; do { was = t; t = t.replace(MARK, ''); } while (t !== was); return t; }
const fence = (from, text) => `<<friend-text from="${unfence(cleanName(from)).replace(/["\\]/g, '')}" untrusted>>\n${unfence(cleanText(text))}\n<</friend-text>>`;
// The payload for a card: built from FIELDS only, never the card object. The same allow-list on the way in.
function payloadOf(c) {
  return { title: oneLine(c.title).slice(0, CAPS.title), description: cleanText(c.description).slice(0, CAPS.description),
    type: TYPES.includes(c.type) ? c.type : 'feature', priority: PRIORITIES.includes(c.priority) ? c.priority : 'normal',
    ...(c.req === 'feature' || c.req === 'custom' ? { req: c.req } : {}) };   // req: a friend's feature request / custom build (AIG-846), only ever set by request()
}
// A friend's card title on my board (Approve, Take): marked as friend text on one line, so a title in `next`, briefs or prompts is never read as an instruction (AIG-846).
const tagged = (friend, title) => '🔗 ' + fence(friend, unfence(title).trim() || '(untitled)').split(String.fromCharCode(10)).join(' ');
const hashOf = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('base64url').slice(0, 22);
// The scrub (a guard rail; the allow-list is the defence): anything that looks like a local path, a key file or a secret.
const SCRUB = [
  ['path', /\b[A-Za-z]:[\\/][^\s"'`<>|]*/g],
  ['path', /\\\\[A-Za-z0-9._$-]+\\[^\s"'`<>|]*/g],
  ['path', /(?:^|[\s"'`(=])(\/(?:Users|home|root|etc|var|opt|mnt|srv|tmp|private|Volumes)\/[^\s"'`<>|]*)/g],
  ['path', /(?:^|[\s"'`(=])(~[\\/][^\s"'`<>|]*)/g],
  ['file', /(?:^|[\s"'`(/\\])(\.env(?:\.[a-z]+)?|aigile\.local\.json|identity\.json|id_rsa|id_ed25519|\.npmrc|\.git-credentials)\b/gi],
  ['secret', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['secret', /\b(?:sk|pk|rk)-(?:ant-|live-|test-|proj-)?[A-Za-z0-9_-]{16,}/g],
  ['secret', /\bgh[pousr]_[A-Za-z0-9]{20,}/g],
  ['secret', /\bgithub_pat_[A-Za-z0-9_]{20,}/g],
  ['secret', /\bAKIA[0-9A-Z]{16}\b/g],
  ['secret', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ['secret', /\bAIza[0-9A-Za-z_-]{30,}/g],
  ['secret', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g],
  ['secret', /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\b["']?\s*[:=]\s*["']?[^\s"']{6,}/gi],
];
function scrub(fields, p) {
  const out = [], folders = [p && p.path, DATA].filter(Boolean).map(f => String(f).replace(/\\/g, '/').replace(/\/$/, '').toLowerCase());
  for (const [field, v] of Object.entries(fields)) {
    const text = String(v || ''), flat = text.replace(/\\/g, '/').toLowerCase();
    for (const [kind, re] of SCRUB) for (const m of text.matchAll(re)) out.push({ field, kind, text: (m[1] || m[0]).trim().slice(0, 80) });
    for (const f of folders) if (f.length > 3 && flat.includes(f)) out.push({ field, kind: 'folder', text: f.slice(0, 80) });
  }
  return out.filter((x, i) => out.findIndex(y => y.field === x.field && y.text === x.text) === i).slice(0, 12);
}
const scrubMsg = flags => 'it looks like there is a local path or a secret in it (' + flags.slice(0, 3).map(f => f.text).join(', ') + '): edit it, or send anyway';
// A live link with the switch on, and (what) one of the effective allowances.
function liveFor(id, what) {
  const L = link(id);
  if (L.state !== 'live') throw bad('the link is not live', 409);
  if (L.on === false) throw bad('the 🔗 switch is off', 409);
  if (what && !effective(L)[what]) throw bad(what === 'sendCards' ? 'this link does not send cards (both of you have to allow it)' : 'this link does not carry comments', 409);
  return L;
}
function cardOf(L, cardId) {
  const p = load(L.slug);
  if (!p) throw bad('project not found', 404);
  const c = p.cards.find(c => c.id.toLowerCase() === String(cardId || '').toLowerCase());
  if (!c) throw bad('card not found', 404);
  return { p, c };
}

module.exports = { DIR, FILES, OFFER_MS, MAX_AGE, MAX_AHEAD, CAPS, KINDS, ALLOW, isLink, cleanName, cleanAllow, day, isShare, FIELDS, ROLES, MEMBER, CAN, isRole, PEOPLE, people,
  roleOf, scopeOf, canOf, theirCanOf, verdictFor, changeOf, roleMsg, ownerOnly, read, write, change, all, link, ofProject, effective, shown, list, queueOn, sendOn, needChecked, cleanText, oneLine, safeName,
  unfence, fence, tagged, payloadOf, hashOf, SCRUB, scrub, scrubMsg, liveFor, cardOf };
