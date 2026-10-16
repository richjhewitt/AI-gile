// Closed alpha invites (AIG-347): the owner makes a one-use link for a friend (relay/join.js serves it), and a
// friend's first start reads the invite.json that came inside the zip. No usernames or passwords anywhere: the
// link is the only key. The owner's board signs what it sends the join service with its DM key (lib/dm.js).
const fs = require('fs');
const path = require('path');
const tr = (k, v) => require('./i18n').t(k, v);
const crypto = require('crypto');
const { DATA, ROOT, bad, owner, localSettings, writeSettings, forgetOwner } = require('./store');
const dm = require('./dm');
const setup = require('./setup');

const DEFAULT_URL = 'https://aigile.lol';
const DEFAULT_SITE = 'https://test.aigile.lol';   // the private test site that site passes open (AIG-699)
const DAYS = 7;
const CODES = () => path.join(DATA, 'join', 'codes.json');
const SETTINGS = () => path.join(DATA, 'join', 'settings.json');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); };

function cleanUrl(u) {
  let url;
  try { url = new URL(String(u)); } catch { throw bad(tr('srv.join.url')); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw bad(tr('srv.join.plain'));
  return url.origin + url.pathname.replace(/\/+$/, '');
}
const joinUrl = () => process.env.AIGILE_JOIN || readJson(SETTINGS(), {}).url || DEFAULT_URL;
const siteUrl = () => process.env.AIGILE_JOIN_SITE || readJson(SETTINGS(), {}).site || DEFAULT_SITE;
const firstName = s => String(s || '').replace(/[\u0000-\u001f<>"&]/g, '').trim().split(/\s+/)[0].slice(0, 24);
const newCode = () => { const c = [...crypto.randomBytes(12)].map(n => ALPHABET[n % 32]).join(''); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); };

async function call(method, p, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  const headers = dm.signHeaders('aigile-join-v1', 'x-join', method, p, data);
  if (data) headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch(joinUrl() + p, { method, headers, body: data || undefined, signal: AbortSignal.timeout(8000), redirect: 'error' }); }
  catch (e) { throw bad(tr('srv.join.unreach', { why: (e.cause && e.cause.code) || e.message }), 502); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw bad(tr('srv.join.said', { status: r.status, why: j.error ? ': ' + j.error : '' }), 502);
  return j;
}

/* ---------- the owner's side ---------- */
// { help: '1'|'2'|'3', name? }: make a code, send it signed to the join service, keep it here to list.
async function make(b = {}) {
  const help = String(b.help || '');
  if (!['1', '2', '3'].includes(help)) throw bad(tr('srv.join.help'));
  const name = String(b.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  const invite = dm.createInvite({ name, days: DAYS + 1 });   // a DM invite that outlasts the link; throws if DMs are off
  const code = newCode();
  const r = await call('POST', '/join/codes', { code, help, dm: invite.code, from: owner(), friend: firstName(name), days: DAYS });   // friend: their first name only, for the greeting (AIG-1311)
  const mine = readJson(CODES(), []);
  mine.push({ code, help, name, inv: invite.id, created: Date.now(), exp: r.exp });
  writeJson(CODES(), mine.slice(-100));
  return { code, link: joinUrl() + '/join?code=' + code, exp: r.exp };
}
// 🌐 A test site pass (AIG-699): { name? }: a one-use link that lets one browser into the private test site for 90 days.
async function makeSite(b = {}) {
  const name = String(b.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  const code = newCode();
  const r = await call('POST', '/join/codes', { code, kind: 'site', days: DAYS });
  const mine = readJson(CODES(), []);
  mine.push({ code, kind: 'site', name, created: Date.now(), exp: r.exp });
  writeJson(CODES(), mine.slice(-100));
  return { code, link: siteUrl() + '/join/site?code=' + code, exp: r.exp };
}
// Ends every pass made from a site code (and the link, if unused).
async function revoke(b = {}) {
  const code = String(b.code || '');
  if (!readJson(CODES(), []).some(c => c.code === code && c.kind === 'site')) throw bad(tr('srv.join.nosite'), 404);
  return call('POST', '/join/site/revoke', { code });
}
// Cancels a link nobody has used (AIG-1249): the join service ends it (signed), and the DM invite it carried goes too.
async function cancel(b = {}) {
  const code = String(b.code || ''), mine = readJson(CODES(), []), c = mine.find(x => x.code === code && x.kind !== 'site');
  if (!c) throw bad(tr('srv.join.nolink'), 404);
  await call('POST', '/join/revoke', { code });
  if (c.inv) dm.dropInvite(c.inv);
  writeJson(CODES(), mine.map(x => x.code === code ? { ...x, cancelled: Date.now() } : x));
  return { ok: true };
}
// The codes made here, with whether the join service saw them used (undefined while it can't be reached).
async function list() {
  const mine = readJson(CODES(), []);
  let remote = null, shares = null, error = '';
  if (mine.length) try { const j = await call('GET', '/join/codes'); remote = j.codes; shares = j.shares || {}; noteShares(shares); } catch (e) { error = e.message; }
  const codes = readJson(CODES(), []).map(({ seen, ...c }) => {
    const r = remote && remote.find(x => x.code === c.code), sh = shares && c.kind !== 'site' ? shares[c.code] || [] : null;
    return { ...c, ...(sh ? { shared: sh.length, sharedWith: sh.map(s => s.name) } : {}), link: c.kind === 'site' ? siteUrl() + '/join/site?code=' + c.code : joinUrl() + '/join?code=' + c.code, used: r ? r.used : null, ...(c.cancelled ? { cancelled: true } : {}), known: !!r, ...(c.kind === 'site' ? { passes: r ? r.passes || 0 : null } : {}), ...(c.inv ? { pic: require('./friendpics').urls(c.inv) } : {}) };
  }).reverse();
  return { url: joinUrl(), site: siteUrl(), ownerKey: dm.identity().ePub, codes, error };
}
// { url, site? }: the join service address, and the test site address for site passes (left as it was when not sent).
function setUrl(b) {
  const url = b && b.url ? cleanUrl(b.url) : '', old = readJson(SETTINGS(), {});
  const site = b && 'site' in b ? (b.site ? cleanUrl(b.site) : '') : old.site || '';
  writeJson(SETTINGS(), { ...(url ? { url } : {}), ...(site ? { site } : {}) });
  return { url: joinUrl(), site: siteUrl() };
}

/* ---------- the friend's side: invite.json from the zip, on first start ---------- */
const inviteFile = () => process.env.AIGILE_INVITE || path.join(ROOT, 'invite.json');
// Applies it once and renames it, so a restart never repeats it. The help level is kept even if the DM link fails.
async function applyInvite() {
  const f = inviteFile();
  if (!fs.existsSync(f)) return null;
  const done = f.replace(/\.json$/, '') + '.applied.json';
  let inv;
  try { inv = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  try { fs.renameSync(f, done); } catch { return null; }   // if it can't be marked done, do nothing rather than repeat it
  const out = await applyData(inv);
  try { fs.writeFileSync(done, JSON.stringify({ applied: new Date().toISOString(), ...out }, null, 2)); } catch {}
  return out;
}
// What an invite carries: the help level, and the DM invite that links the friend to the owner (DMs turned on with its relay).
async function applyData(inv, me) {
  const out = { help: null, linked: null };
  if (['1', '2', '3'].includes(String(inv.help))) { setup.applyPrefs({ helpLevel: String(inv.help) }); out.help = String(inv.help); }
  if (inv.dm) {
    try {
      const relay = dm.readInvite(inv.dm).r;
      await dm.setSettings({ relay, on: true });
      out.linked = (await dm.acceptInvite({ code: inv.dm, name: String(inv.from || '').trim() || 'Friend', ...(me ? { me } : {}) })).name;
    } catch (e) { out.error = e.message; }
  }
  return out;
}

/* ---------- the friend's side, Windows installer (AIG-1231): a claim code instead of invite.json ---------- */
// The installer is one file for everyone, so the join page hands out a short claim code (XXXX-XXXX) and names the
// download "AI-gile Setup (XXXX-XXXX).exe". The installer writes its own file name to AIGILE_SETUP_NAME; the first start
// claims that code, or the page asks for it while AIGILE_CLAIM is set (the desktop app sets both). Kept in data/join/claim.json.
const CLAIM = () => path.join(DATA, 'join', 'claim.json');
const cleanClaim = s => { const c = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-Z2-9]{8}$/.test(c) ? c.slice(0, 4) + '-' + c.slice(4) : ''; };
function claimFromName() {
  const f = process.env.AIGILE_SETUP_NAME;
  if (!f) return '';
  try { const m = fs.readFileSync(f, 'utf8').toUpperCase().match(/\(([A-Z2-9]{4}-[A-Z2-9]{4})\)/); return m ? m[1] : ''; } catch { return ''; }
}
// { ask, code, done }: ask = show "Type your code" (a fresh installed app, not linked yet); done = what the claim gave, until welcomed.
// share (AIG-1311): the code was claimed already, so someone was given the friend's installer: the page says hello and asks their name.
function claimStatus() {
  const st = readJson(CLAIM(), {});
  const fresh = !st.done && !st.skipped && !fs.existsSync(inviteFile().replace(/\.json$/, '') + '.applied.json') && !dm.contacts().length;
  const share = fresh && st.share ? { friend: st.share.friend || '' } : null;
  return { ask: !!process.env.AIGILE_CLAIM && fresh && !share, code: fresh ? claimFromName() : '', share,
    done: st.done && !st.welcomed ? { from: st.from || '', linked: st.linked || '', error: st.error || '', friend: st.friend || '', ...(st.shared ? { shared: true, me: st.me || '' } : {}) } : null };
}
const langOf = b => /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(b.lang || '')) ? String(b.lang) : undefined;
async function postClaim(body, tr) {
  let r, j = {};
  try { r = await fetch(joinUrl() + '/join/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error' }); j = await r.json().catch(() => ({})); }
  catch { throw bad(tr('claim.err.offline'), 502); }
  if (r.status === 429) throw bad(tr('claim.err.full'), 429);   // AIG-1311: a code shared too often (posted publicly)
  return { r, j };
}
// { code }: fetch the invite from the join service once, and apply it like invite.json.
// The errors are in the friend's language (AIG-1248): b.lang is the page's language (a fresh app has not saved one yet), else the saved one.
async function claim(b = {}) {
  const lang = langOf(b);
  const tr = (k, v) => require('./i18n').t(k, v, lang);
  const code = cleanClaim(b.code);
  if (!code) throw bad(tr('claim.err.format'));
  if (readJson(CLAIM(), {}).done) throw bad(tr('claim.err.done'), 409);
  const { r, j } = await postClaim({ code }, tr);
  // AIG-1311: someone already claimed this code, so this is a person they shared it with. Nothing is counted until they give a name.
  if (r.status === 410 && j.share) {
    const friend = firstName(j.friend);
    writeJson(CLAIM(), { ...readJson(CLAIM(), {}), share: { code, friend } });
    return { share: { friend } };
  }
  if (r.status === 404 || r.status === 400) throw bad(tr('claim.err.wrong'), 404);
  if (r.status === 410) throw bad(tr(/used/.test(j.error || '') ? 'claim.err.used' : 'claim.err.expired'), 410);
  if (!r.ok || !j || j.v !== 1) throw bad(tr('claim.err.service', { status: r.status }), 502);
  const out = await applyData(j), friend = firstName(j.friend);
  writeJson(CLAIM(), { done: Date.now(), from: String(j.from || ''), friend, linked: out.linked || '', ...(/^[A-Za-z0-9_-]{43}$/.test(j.share || '') ? { token: j.share } : {}), ...(out.error ? { error: out.error } : {}) });
  shareTick().catch(() => {});   // leave Friends invites at the join service for whoever this friend shares their copy with
  return { ok: true, from: String(j.from || ''), friend, linked: out.linked || '', help: out.help, ...(out.error ? { error: out.error } : {}) };
}
// { name }: the newcomer on a shared copy (AIG-1311). Their own fresh board: their name is saved here (if none yet), and if the
// friend left a Friends invite at the join service it links them; the join service only ever gets their first name.
async function claimShare(b = {}) {
  const tr = (k, v) => require('./i18n').t(k, v, langOf(b));
  const st = readJson(CLAIM(), {});
  if (st.done) throw bad(tr('claim.err.done'), 409);
  if (!st.share || !st.share.code) throw bad(tr('claim.err.format'), 409);
  const name = String(b.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  if (!firstName(name)) throw bad(tr('claim.share.need'));
  const { r, j } = await postClaim({ code: st.share.code, name }, tr);
  if (r.status === 404 || r.status === 400) throw bad(tr('claim.err.wrong'), 404);
  if (r.status === 410) throw bad(tr('claim.err.expired'), 410);
  if (!r.ok || !j || j.v !== 1 || !j.shared) throw bad(tr('claim.err.service', { status: r.status }), 502);
  const s = localSettings();
  if (!String(s.owner || '').trim()) { writeSettings({ ...s, owner: name }); forgetOwner(); }
  const friend = firstName(j.friend) || st.share.friend || '';
  const out = await applyData({ help: j.help, dm: j.dm || '', from: friend || 'Friend' }, name);
  writeJson(CLAIM(), { done: Date.now(), shared: true, friend, me: name, linked: out.linked || '', ...(out.error ? { error: out.error } : {}) });
  return { ok: true, shared: true, friend, me: name, linked: out.linked || '', help: out.help, ...(out.error ? { error: out.error } : {}) };
}
// "I don't have a code" and "seen the welcome": both only change what the first run shows.
function claimSkip() { writeJson(CLAIM(), { ...readJson(CLAIM(), {}), skipped: Date.now() }); return claimStatus(); }
function claimSeen() { writeJson(CLAIM(), { ...readJson(CLAIM(), {}), welcomed: Date.now() }); return claimStatus(); }
// At start: the code in the installer's file name, once. If it fails (offline, typo), the page asks and offers it again.
async function autoClaim() {
  const code = claimFromName();
  if (!code || !claimStatus().code) return null;
  try { return await claim({ code }); } catch { return null; }
}

/* ---------- friendly leaks (AIG-1311): the friend's board keeps invites at the join service; the owner hears who shared ---------- */
const POOL = 3;
// The friend's side: with the token from its claim, top the join service up to 3 Friends invites (one per newcomer, 8 days each).
async function sharePool() {
  const st = readJson(CLAIM(), {});
  if (!st.token || !dm.on()) return null;
  const post = async body => {
    const r = await fetch(joinUrl() + '/join/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: st.token, ...body }), signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!r.ok) throw new Error('join service ' + r.status);
    return r.json();
  };
  let j = await post({});
  const want = Math.max(0, Math.min(POOL, Number(j.max) || POOL) - (Number(j.pool) || 0));
  if (want) j = await post({ add: Array.from({ length: want }, () => dm.createInvite({ name: '', days: 8 }).code) });
  return j;
}
// The owner's side: each new share the join service reports becomes one note in the inbox ("Davy shared AI-gile with Sam").
const NOTES = () => path.join(DATA, 'join', 'notes.json');
function noteShares(shares) {
  const mine = readJson(CODES(), []), add = [];
  for (const c of mine) {
    const list = (shares && shares[c.code]) || [];
    if (list.length > (c.seen || 0)) { for (const s of list.slice(c.seen || 0)) add.push({ id: crypto.randomBytes(6).toString('hex'), friend: c.name || c.code, name: String(s.name || '').slice(0, 24), at: Number(s.at) || Date.now() }); c.seen = list.length; }
  }
  if (!add.length) return;
  writeJson(CODES(), mine);
  writeJson(NOTES(), [...readJson(NOTES(), []), ...add].slice(-100));
}
async function ownerShares() {
  if (!readJson(CODES(), []).some(c => c.kind !== 'site')) return;
  noteShares((await call('GET', '/join/codes')).shares || {});
}
async function shareTick() {
  await Promise.allSettled([sharePool(), ownerShares()]);
}
let shareTimer = null;
function startShares() {
  if (shareTimer) return;
  setTimeout(() => shareTick().catch(() => {}), 5000).unref();
  shareTimer = setInterval(() => shareTick().catch(() => {}), Number(process.env.AIGILE_SHARE_TICK_MS) || 15 * 60e3);
  shareTimer.unref();
}
const shareNotes = () => ({ notes: readJson(NOTES(), []).filter(n => !n.seen).reverse() });
// { id } or { all: true }: the owner has seen it (OK in the inbox).
function shareNotesSeen(b = {}) {
  const all = readJson(NOTES(), []);
  writeJson(NOTES(), all.map(n => b.all || n.id === b.id ? { ...n, seen: Date.now() } : n));
  return shareNotes();
}

module.exports = { make, makeSite, revoke, cancel, list, setUrl, joinUrl, applyInvite, claimStatus, claim, claimShare, claimSkip, claimSeen, autoClaim, shareTick, startShares, shareNotes, shareNotesSeen };
