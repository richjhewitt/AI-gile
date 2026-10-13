// Personal builds (AIG-847): features switched on for one friend. The owner keeps a small list of switches in
// data/features/switches.json (key, label, who: nobody | everyone | some + friends = contact ids). A friend is sent only
// THEIR own keys over a live share link (message kind 'features'); their board keeps what it was told in
// data/features/mine.json {contactId: {keys, at}} and the page asks Features.on('<key>').
const fs = require('fs');
const path = require('path');
const { DATA, bad } = require('./store');

const KEY = /^[a-z0-9][a-z0-9-]{0,29}$/, MAXK = 30, WHO = ['nobody', 'everyone', 'some'];
const D = path.join(DATA, 'features');   // a folder of its own: loose .json files in data/ are read as projects
const F = () => path.join(D, 'switches.json'), M = () => path.join(D, 'mine.json');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const wr = (f, v) => { fs.mkdirSync(D, { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 2)); fs.renameSync(t, f); };
const cid = id => /^[0-9a-f]{12}$/.test(String(id));
const switches = () => { const d = rd(F(), {}); return Array.isArray(d.switches) ? d.switches.filter(s => s && KEY.test(s.key)) : []; };
const norm = s => ({ key: s.key, label: String(s.label || s.key).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) || s.key, who: WHO.includes(s.who) ? s.who : 'nobody',
  friends: [...new Set((Array.isArray(s.friends) ? s.friends : []).filter(cid))].slice(0, 200) });
const has = (s, id) => s.who === 'everyone' || (s.who === 'some' && s.friends.includes(id));
const keysFor = id => switches().map(norm).filter(s => has(s, id)).map(s => s.key);
const contactIds = () => require('./dm').contacts().map(c => c.id);

// the owner's list, each switch with the friends who have it
function list() { return { switches: switches().map(norm).map(s => ({ ...s, friends: s.who === 'some' ? s.friends : [] })), friends: require('./dm').contacts().map(c => ({ id: c.id, name: c.name, keys: keysFor(c.id) })) }; }
function save(arr) { wr(F(), { v: 1, switches: arr.slice(0, MAXK) }); }
// create or change a switch: { key, label?, who? }
function set(b) {
  b = b || {};
  if (!KEY.test(String(b.key || ''))) throw bad('key must be 1 to 30 of a-z, 0-9 and -');
  if (b.who !== undefined && !WHO.includes(b.who)) throw bad('who must be nobody, everyone or some');
  const all = switches().map(norm), i = all.findIndex(s => s.key === b.key);
  if (i < 0 && all.length >= MAXK) throw bad('that is enough switches (' + MAXK + ')');
  const s = i < 0 ? { key: b.key, label: b.label, who: 'nobody', friends: [] } : all[i];
  if (b.label !== undefined) s.label = b.label;
  if (b.who) s.who = b.who;
  const n = norm(s); if (i < 0) all.push(n); else all[i] = n;
  save(all); return n;
}
function remove(key) {
  const all = switches().map(norm);
  if (!all.some(s => s.key === key)) throw bad('no such switch', 404);
  save(all.filter(s => s.key !== key)); return { key };
}
// give or take one switch for one friend
function give(key, id, on) {
  if (!cid(id) || !contactIds().includes(id)) throw bad('no such friend', 404);
  const all = switches().map(norm), s = all.find(s => s.key === key);
  if (!s) throw bad('no such switch', 404);
  let fr = s.who === 'everyone' ? contactIds() : s.friends;
  fr = on ? [...new Set([...fr, id])] : fr.filter(x => x !== id);
  s.friends = fr; s.who = fr.length ? 'some' : 'nobody';
  save(all); return { ...norm(s), pushed: false };
}
// tell a friend their switches (only theirs), over their live share link
async function push(id) {
  const base = require('./share-base'), L = base.all().find(L => L.contact === id && L.state === 'live' && L.on !== false);
  if (!L) return false;
  try { await base.sendOn(L.id, 'features', { feat: keysFor(id) }); return true; } catch { return false; }
}
// a friend's board: what I was told
const keysOk = k => Array.isArray(k) && k.length <= MAXK && k.every(x => typeof x === 'string' && KEY.test(x));
function receive(id, keys) { if (!keysOk(keys)) return; const m = rd(M(), {}); m[id] = { keys, at: new Date().toISOString() }; wr(M(), m); }
function mine() { const m = rd(M(), {}); return [...new Set(Object.values(m).flatMap(v => Array.isArray(v && v.keys) ? v.keys.filter(k => KEY.test(k)) : []))].sort(); }
function forget(id) { const m = rd(M(), {}); if (m[id]) { delete m[id]; wr(M(), m); } }

module.exports = { list, set, remove, give, push, receive, mine, keysFor, keysOk, forget, KEY };
