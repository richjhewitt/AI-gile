// Closed alpha invites (AIG-347): the owner makes a one-use link for a friend (relay/join.js serves it), and a
// friend's first start reads the invite.json that came inside the zip. No usernames or passwords anywhere: the
// link is the only key. The owner's board signs what it sends the join service with its DM key (lib/dm.js).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, ROOT, bad, owner } = require('./store');
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
  try { url = new URL(String(u)); } catch { throw bad('the join address must be a web address, like https://aigile.lol'); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw bad('the join address must be a plain http(s) address');
  return url.origin + url.pathname.replace(/\/+$/, '');
}
const joinUrl = () => process.env.AIGILE_JOIN || readJson(SETTINGS(), {}).url || DEFAULT_URL;
const siteUrl = () => process.env.AIGILE_JOIN_SITE || readJson(SETTINGS(), {}).site || DEFAULT_SITE;
const newCode = () => { const c = [...crypto.randomBytes(12)].map(n => ALPHABET[n % 32]).join(''); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); };

async function call(method, p, body) {
  const data = body === undefined ? '' : JSON.stringify(body);
  const headers = dm.signHeaders('aigile-join-v1', 'x-join', method, p, data);
  if (data) headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch(joinUrl() + p, { method, headers, body: data || undefined, signal: AbortSignal.timeout(8000), redirect: 'error' }); }
  catch (e) { throw bad('could not reach the join service (' + ((e.cause && e.cause.code) || e.message) + ')', 502); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw bad('the join service said ' + r.status + (j.error ? ': ' + j.error : ''), 502);
  return j;
}

/* ---------- the owner's side ---------- */
// { help: '1'|'2'|'3', name? }: make a code, send it signed to the join service, keep it here to list.
async function make(b = {}) {
  const help = String(b.help || '');
  if (!['1', '2', '3'].includes(help)) throw bad('pick a help level: 1, 2 or 3');
  const name = String(b.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  const invite = dm.createInvite({ name, days: DAYS + 1 });   // a DM invite that outlasts the link; throws if DMs are off
  const code = newCode();
  const r = await call('POST', '/join/codes', { code, help, dm: invite.code, from: owner(), days: DAYS });
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
  if (!readJson(CODES(), []).some(c => c.code === code && c.kind === 'site')) throw bad('no such test site pass', 404);
  return call('POST', '/join/site/revoke', { code });
}
// Cancels a link nobody has used (AIG-1249): the join service ends it (signed), and the DM invite it carried goes too.
async function cancel(b = {}) {
  const code = String(b.code || ''), mine = readJson(CODES(), []), c = mine.find(x => x.code === code && x.kind !== 'site');
  if (!c) throw bad('no such invite link', 404);
  await call('POST', '/join/revoke', { code });
  if (c.inv) dm.dropInvite(c.inv);
  writeJson(CODES(), mine.map(x => x.code === code ? { ...x, cancelled: Date.now() } : x));
  return { ok: true };
}
// The codes made here, with whether the join service saw them used (undefined while it can't be reached).
async function list() {
  const mine = readJson(CODES(), []);
  let remote = null, error = '';
  if (mine.length) try { remote = (await call('GET', '/join/codes')).codes; } catch (e) { error = e.message; }
  const codes = mine.map(c => {
    const r = remote && remote.find(x => x.code === c.code);
    return { ...c, link: c.kind === 'site' ? siteUrl() + '/join/site?code=' + c.code : joinUrl() + '/join?code=' + c.code, used: r ? r.used : null, ...(c.cancelled ? { cancelled: true } : {}), known: !!r, ...(c.kind === 'site' ? { passes: r ? r.passes || 0 : null } : {}), ...(c.inv ? { pic: require('./friendpics').urls(c.inv) } : {}) };
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
async function applyData(inv) {
  const out = { help: null, linked: null };
  if (['1', '2', '3'].includes(String(inv.help))) { setup.applyPrefs({ helpLevel: String(inv.help) }); out.help = String(inv.help); }
  if (inv.dm) {
    try {
      const relay = dm.readInvite(inv.dm).r;
      await dm.setSettings({ relay, on: true });
      out.linked = (await dm.acceptInvite({ code: inv.dm, name: String(inv.from || '').trim() || 'Friend' })).name;
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
function claimStatus() {
  const st = readJson(CLAIM(), {});
  const fresh = !st.done && !st.skipped && !fs.existsSync(inviteFile().replace(/\.json$/, '') + '.applied.json') && !dm.contacts().length;
  return { ask: !!process.env.AIGILE_CLAIM && fresh, code: fresh ? claimFromName() : '', done: st.done && !st.welcomed ? { from: st.from || '', linked: st.linked || '', error: st.error || '' } : null };
}
// { code }: fetch the invite from the join service once, and apply it like invite.json.
// The errors are in the friend's language (AIG-1248): b.lang is the page's language (a fresh app has not saved one yet), else the saved one.
async function claim(b = {}) {
  const lang = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(b.lang || '')) ? String(b.lang) : undefined;
  const tr = (k, v) => require('./i18n').t(k, v, lang);
  const code = cleanClaim(b.code);
  if (!code) throw bad(tr('claim.err.format'));
  if (readJson(CLAIM(), {}).done) throw bad(tr('claim.err.done'), 409);
  let r, j = {};
  try { r = await fetch(joinUrl() + '/join/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(10000), redirect: 'error' }); j = await r.json().catch(() => ({})); }
  catch { throw bad(tr('claim.err.offline'), 502); }
  if (r.status === 404 || r.status === 400) throw bad(tr('claim.err.wrong'), 404);
  if (r.status === 410) throw bad(tr(/used/.test(j.error || '') ? 'claim.err.used' : 'claim.err.expired'), 410);
  if (!r.ok || !j || j.v !== 1) throw bad(tr('claim.err.service', { status: r.status }), 502);
  const out = await applyData(j);
  writeJson(CLAIM(), { done: Date.now(), from: String(j.from || ''), linked: out.linked || '', ...(out.error ? { error: out.error } : {}) });
  return { ok: true, from: String(j.from || ''), linked: out.linked || '', help: out.help, ...(out.error ? { error: out.error } : {}) };
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

module.exports = { make, makeSite, revoke, cancel, list, setUrl, joinUrl, applyInvite, claimStatus, claim, claimSkip, claimSeen, autoClaim };
