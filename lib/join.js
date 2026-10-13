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
// The codes made here, with whether the join service saw them used (undefined while it can't be reached).
async function list() {
  const mine = readJson(CODES(), []);
  let remote = null, error = '';
  if (mine.length) try { remote = (await call('GET', '/join/codes')).codes; } catch (e) { error = e.message; }
  const codes = mine.map(c => {
    const r = remote && remote.find(x => x.code === c.code);
    return { ...c, link: joinUrl() + '/join?code=' + c.code, used: r ? r.used : null, known: !!r, ...(c.inv ? { pic: require('./friendpics').urls(c.inv) } : {}) };
  }).reverse();
  return { url: joinUrl(), ownerKey: dm.identity().ePub, codes, error };
}
function setUrl(b) {
  const url = b && b.url ? cleanUrl(b.url) : '';
  writeJson(SETTINGS(), url ? { url } : {});
  return { url: joinUrl() };
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
  const out = { help: null, linked: null };
  if (['1', '2', '3'].includes(String(inv.help))) { setup.applyPrefs({ helpLevel: String(inv.help) }); out.help = String(inv.help); }
  if (inv.dm) {
    try {
      const relay = dm.readInvite(inv.dm).r;
      await dm.setSettings({ relay, on: true });
      out.linked = (await dm.acceptInvite({ code: inv.dm, name: String(inv.from || '').trim() || 'Friend' })).name;
    } catch (e) { out.error = e.message; }
  }
  try { fs.writeFileSync(done, JSON.stringify({ applied: new Date().toISOString(), ...out }, null, 2)); } catch {}
  return out;
}

module.exports = { make, list, setUrl, joinUrl, applyInvite };
