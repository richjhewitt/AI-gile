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
  const box = readInbox(), done = [], fresh = new Set();
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
      if (ID.test(String(x.id)) && a.company && EMAIL.test(a.email)) { box.apply[x.id] = box.apply[x.id] && box.apply[x.id].card ? { ...a, card: box.apply[x.id].card } : a; fresh.add(x.id); }
    } else {
      const email = str(it.email, 160).toLowerCase(), which = str(it.which, 10), had = box.interest[email];
      if (EMAIL.test(email) && ['alpha', 'beta', 'both'].includes(which) && (!had || had.at <= at)) { box.interest[email] = { which, at, ...(had && had.card ? { card: had.card, again: true } : {}) }; fresh.add(email); }
    }
  }
  const routed = toCards(box, fresh);   // AIG-1339: with a destination, the new requests become cards there first (older ones: Move)
  if (done.length || routed) {
    writeInbox(box);   // saved here first: only then is it deleted on the relay
    if (done.length) try { await dm().relayCall(base, 'POST', '/' + kind + '/ack', { ids: done }); } catch {}   // not acked now: next look acks it
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
  out.items = Object.entries(box.apply).filter(([, a]) => !a.card).sort((a, b) => b[0].localeCompare(a[0])).map(([id, a]) => ({ id, ...a, status: (st[id] || {}).status || 'new', decidedAt: (st[id] || {}).at || null, letter: (st[id] || {}).status === 'approved' ? letter(a, owner) : '' }));
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
  const out = { items: Object.entries(box.interest).filter(([, x]) => !x.card).map(([email, x]) => ({ email, which: x.which, at: x.at })).sort((a, b) => b.at.localeCompare(a.at)), error: c.error, unopened: c.unopened };
  if (c.unopened && !out.error) out.error = sealedNote(c.unopened);
  return out;
}
function removeInterest(email) {
  const box = readInbox(), e = String(email || '').toLowerCase();
  if (!box.interest[e]) throw bad('no such sign-up', 404);
  delete box.interest[e]; writeInbox(box);
  return { ok: true };
}

/* ---------- 📮 Where requests go (AIG-1339) ---------- */
// Setup > Where requests go: a project (forms.to in aigile.local.json); empty = the lists above, as before. With a project chosen each new
// request becomes a service-request card there (c.form = { kind, key }, c.desk.kind request, hidePublic, never auto-shared), its fields
// fenced in the description, reply-by from the friend row of the targets table (lib/targets.js). Done = Replied: delete, and the
// card's copy of the details goes too (What we keep: until we've replied). Nothing about the relay or the sealing changes.
const S = () => require('./store');
const tr = (k, v) => require('./i18n').t(k, v);
const routeSlug = () => { const v = ((S().peekSettings().forms || {}).to) || ''; return v && S().load(v) ? v : ''; };
function route() {
  const slug = routeSlug(), p = slug && S().load(slug), box = readInbox();
  const waiting = Object.values(box.apply).filter(a => !a.card).length + Object.values(box.interest).filter(x => !x.card).length;
  const projects = S().listSlugs().map(x => { try { return S().load(x); } catch { return null; } }).filter(p => p && !p.archived && !p.public && !p.sample && !p.lifeAdmin).map(p => ({ slug: p.slug, name: p.name }));
  return { project: slug, name: p ? p.name : '', waiting, projects };
}
function setRoute(b) {
  const want = String((b && b.project) || '').trim(), s = S().localSettings();
  if (want) {
    const p = S().load(want);
    if (!p) throw bad('no such project', 404);
    if (p.public) throw bad(tr('srv.forms.public'), 400);
    if (!require('./service').of(p)) { require('./service').set(p, { on: true }); S().save(p); }   // reply-by times only count on a service
    s.forms = { ...(s.forms || {}), to: p.slug };
  } else if (s.forms) { delete s.forms.to; if (!Object.keys(s.forms).length) delete s.forms; }
  S().writeSettings(s);
  return route();
}
const whoOf = email => String(email || '').split('@')[0];
const up = s => s.charAt(0).toUpperCase() + s.slice(1);
const titleOf = (kind, it, who) => up(kind === 'apply' ? tr('srv.forms.t.apply', { who: who ?? it.company }) : tr('srv.forms.t.interest', { which: tr('int.which.' + it.which), who: who ?? whoOf(it.key) }));
function textOf(kind, it) {
  const L = k => tr('srv.forms.f.' + k), at = it.at ? it.at.slice(0, 16).replace('T', ' ') : '-';
  const body = kind === 'apply'
    ? [L('company') + ': ' + it.company, L('website') + ': ' + (it.website || '-'), L('email') + ': ' + it.email, L('at') + ': ' + at, '', L('what') + ':', it.what, '', L('how') + ':', it.how].join('\n')
    : [L('email') + ': ' + it.key, L('which') + ': ' + tr('int.which.' + it.which), L('at') + ': ' + at].join('\n');
  return require('./share-base').fence('Website form', body) + '\n\n' + tr('srv.forms.done');
}
function cardFor(p, kind, it) {
  const at = S().now();
  const c = { id: p.key + '-' + p.nextId++, title: titleOf(kind, it), description: textOf(kind, it), testSteps: '', type: 'task', priority: 'normal', status: 'todo', assignee: '', sprint: '',
    blocked: false, needsYou: false, createdBy: 'Website form', from: 'form', created: at, updated: at, comments: [], hidePublic: true,
    desk: { kind: 'request', auto: false }, form: { kind, key: it.key, ...(kind === 'interest' ? { which: it.which } : {}) } };
  return c;
}
// The items (only = a Set of keys, or all) without a card get one (a repeat sign-up updates its open card). Mutates box; returns how many changed.
function toCards(box, only) {
  const slug = routeSlug(); if (!slug) return 0;
  const p = S().load(slug); let n = 0;
  for (const [kind, set] of [['apply', box.apply], ['interest', box.interest]]) for (const [key, it] of Object.entries(set)) {
    if ((only && !only.has(key)) || (it.card && !it.again)) continue;
    const old = it.card && p.cards.find(c => c.id === it.card && c.form && c.status !== 'done');
    if (old) { old.title = titleOf(kind, { ...it, key }); old.description = textOf(kind, { ...it, key }); if (old.form && kind === 'interest') old.form.which = it.which; old.updated = S().now(); }
    else { const c = cardFor(p, kind, { ...it, key }); p.cards.push(c); it.card = c.id; }
    delete it.again; n++;
  }
  if (n) S().save(p);
  return n;
}
// One button: the items still in the Setup lists move to cards.
function moveAll() {
  if (!routeSlug()) throw bad(tr('srv.forms.noroute'), 409);
  const box = readInbox(), n = toCards(box);
  if (n) writeInbox(box);
  return { moved: n, ...route() };
}
// Look now (the timer and tests): collect both forms, which routes them.
async function pull() { const a = await collect('apply'), b = await collect('interest'); return { error: a.error || b.error, ...route() }; }
// Called by store.save before writing: a form card that is done drops the request here (Replied: delete) and on the card.
function onSave(p) {
  const done = (p.cards || []).filter(c => c.form && c.form.key && c.status === 'done');
  if (!done.length) return;
  const box = readInbox(); let changed = false;
  for (const c of done) {
    const set = c.form.kind === 'apply' ? box.apply : box.interest, it = set[c.form.key];
    if (it && it.card === c.id) { delete set[c.form.key]; changed = true; if (c.form.kind === 'apply') { const st = read(); if (st[c.form.key]) { delete st[c.form.key]; fs.writeFileSync(FILE(), JSON.stringify(st)); } } }
    c.title = titleOf(c.form.kind, { which: c.form.which || (it && it.which) || 'both' }, tr('srv.forms.replied'));
    c.description = tr('srv.forms.gone');
    c.form = { kind: c.form.kind, key: '', replied: S().now() };
  }
  if (changed) writeInbox(box);
}
function start() {
  if (process.env.AIGILE_NO_FORMS_POLL) return;
  setInterval(() => { if (routeSlug() && dm().relayAddress()) pull().catch(() => {}); }, 10 * 60e3).unref();
}
module.exports = { list, decide, remove, letter, interest, removeInterest, route, setRoute, moveAll, pull, onSave, start };
