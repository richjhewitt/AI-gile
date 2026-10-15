// 🔑 Secrets (AIG-585..587): an agent asks for a named secret on a task card, the owner pastes it into a masked box on the card,
// and `aigile secret run` hands it to one command as an environment variable. The agent never sees the value.
//
// Where the value is kept: data/secrets/store.json (data/ is git-ignored), encrypted with Windows DPAPI (CurrentUser: only this
// Windows user on this PC can decrypt it). Off Windows, or when AIGILE_SECRETS_DIR is set (tests), AES-256-GCM with a key file
// (secrets.key, mode 0600) in that folder instead. The value is never put in a card, comment, log, transcript or any GET answer:
// the lists below hold names, purposes and times only. Value in: the page's POST body, on loopback only. Value out: one grant file.
//
// The fence for saving and deleting is the terminal's: a per-start token that GET /api/secrets/token hands only to the board
// page (loopback, no X-Aigile-Where header which every CLI and hook call sends, a same-origin fetch). The CLI is refused it.
//
// How `aigile secret run` gets the value (AIG-586), and why: the CLI is not given the token, so it asks POST /api/secrets/grant
// (loopback and X-Aigile-Where only). The answer carries no value: the board decrypts the secret, writes it to a fresh
// one-use file data/secrets/grants/<random>.grant (mode 0600, in the user's own profile), and answers with that file's path.
// The CLI reads it once and deletes it; the board also sweeps any grant older than 30 s. So the value never rides an HTTP
// body (nothing that logs, proxies or echoes a response can catch it), there is no long-lived token to steal, and a grant
// can be used once. A one-time secret (the default) is deleted by the board at the moment it writes the grant.
// Honest limit: a process running as the same Windows user could read the grant file in that instant, as it could read
// anything the user can. What this stops is the agent's own text channels: cards, comments, logs, transcripts and API answers.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { DATA, bad, now, load, save, findCard, need } = require('./store');

const DIR = () => path.join(process.env.AIGILE_SECRETS_DIR || DATA, 'secrets');
const FILE = () => path.join(DIR(), 'store.json');
const GRANTS = () => path.join(DIR(), 'grants');
const win = process.platform === 'win32';
const aes = () => !win || !!process.env.AIGILE_SECRETS_DIR;
const NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const TOKEN = crypto.randomBytes(24).toString('hex');
const loopback = a => /^(127\.|::1$|::ffff:127\.)/.test(String(a || ''));

/* ---------- encrypting ---------- */
function ps(script, input) {   // the value goes on stdin, never as an argument
  const r = cp.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { input, encoding: 'utf8', windowsHide: true, timeout: 20000 });
  if (r.status !== 0 || !r.stdout.trim()) throw bad('could not use Windows data protection for the secret', 500);
  return r.stdout.trim();
}
const PS_PROTECT = "Add-Type -AssemblyName System.Security; $i=[Console]::In.ReadToEnd(); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($i),$null,'CurrentUser'))";
const PS_UNPROTECT = "Add-Type -AssemblyName System.Security; $i=[Console]::In.ReadToEnd().Trim(); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($i),$null,'CurrentUser'))";
function key() {
  const f = path.join(DIR(), 'secrets.key');
  try { return Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex'); } catch {}
  fs.mkdirSync(DIR(), { recursive: true });
  const k = crypto.randomBytes(32); fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 });
  return k;
}
function protect(value) {
  if (!aes()) return 'dpapi:' + ps(PS_PROTECT, value);
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv), enc = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return 'aes:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function unprotect(blob) {
  if (blob.startsWith('dpapi:')) return Buffer.from(ps(PS_UNPROTECT, blob.slice(6)), 'base64').toString('utf8');
  const b = Buffer.from(blob.slice(4), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

/* ---------- the store ---------- */
// { hours: 24, items: [{ slug, card, name, purpose, askedBy, askedAt, blob?, storedAt?, lastUsedAt?, lastUsedBy? }] }
function read() { try { const s = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return { hours: s.hours === 0 ? 0 : s.hours || 24, items: s.items || [] }; } catch { return { hours: 24, items: [] }; } }
function write(s) { fs.mkdirSync(DIR(), { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(s, null, 1), { mode: 0o600 }); }
const expired = (s, x) => s.hours > 0 && x.blob && Date.parse(x.storedAt) + s.hours * 3600e3 < Date.now();
function purge() {
  const s = read(), keep = s.items.filter(x => !expired(s, x));
  if (keep.length !== s.items.length) { s.items.filter(x => expired(s, x)).forEach(x => markCard(x, false)); write({ ...s, items: keep }); }
  try { for (const f of fs.readdirSync(GRANTS())) { const g = path.join(GRANTS(), f); if (Date.now() - fs.statSync(g).mtimeMs > 30e3) fs.unlinkSync(g); } } catch {}
  return read();
}
// The card shows its asks as names only: { name, purpose, by, at, have }. Kept in step with the store.
function markCard(x, have) {
  try {
    const p = load(x.slug), c = p && p.cards.find(k => k.id === x.card); if (!c) return;
    c.secretAsks = (c.secretAsks || []).map(a => a.name === x.name ? { ...a, have } : a); save(p);
  } catch {}
}
const clean = x => ({ slug: x.slug, card: x.card, name: x.name, purpose: x.purpose, askedBy: x.askedBy, askedAt: x.askedAt, stored: !!x.blob, storedAt: x.storedAt || null, lastUsedAt: x.lastUsedAt || null, lastUsedBy: x.lastUsedBy || null,
  expiresAt: x.blob && read().hours > 0 ? new Date(Date.parse(x.storedAt) + read().hours * 3600e3).toISOString() : null });
const find = (s, slug, name) => s.items.find(x => x.slug === slug && x.name === name);
const checkName = n => { if (!NAME_RE.test(String(n || ''))) throw bad('a secret name is capital letters, digits and _ (like GITHUB_TOKEN)'); return n; };

/* ---------- the fence ---------- */
function asked(req) {
  if (!loopback(req && req.socket && req.socket.remoteAddress) || (req && req.aigilePhone)) throw bad('secrets are the owner\'s, on this computer only', 403);   // a phone comes in via 127.0.0.1 too (AIG-868)
}
function token(req) {
  asked(req);
  if (req.headers['x-aigile-where']) throw bad('secrets are saved from the board page, not the command line', 403);
  const site = req.headers['sec-fetch-site'];
  if (site && !['same-origin', 'none'].includes(site)) throw bad('secrets are saved from the board page only', 403);
  return { token: TOKEN };
}
function gate(req, tok) {
  asked(req);
  if (req.headers['x-aigile-where']) throw bad('secrets are saved from the board page, not the command line', 403);
  const a = Buffer.from(String(tok || '')), b = Buffer.from(TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw bad('wrong or missing secrets token: refresh the page', 403);
}

/* ---------- ask, save, list, delete ---------- */
// AIG-585: an agent asks on a task card. Marks the card for the owner and leaves a comment with the name and why, never a value.
function ask(slug, id, b) {
  const p = need(load(slug)), c = findCard(p, id);
  const name = checkName(b.name), purpose = String(b.purpose || '').trim().slice(0, 200), by = String(b.by || '').trim().slice(0, 60);
  if (!purpose) throw bad('say what the secret is for');
  const s = purge(), had = find(s, slug, name);
  if (had && had.blob) throw bad(name + ' is already stored for this project: use it with aigile secret run');
  if (!had) s.items.push({ slug, card: id, name, purpose, askedBy: by, askedAt: now() }); else Object.assign(had, { card: id, purpose, askedBy: by, askedAt: now() });
  write(s);
  c.secretAsks = [...(c.secretAsks || []).filter(a => a.name !== name), { name, purpose, by, at: now(), have: false }];
  c.needsYou = true;
  c.comments.push({ author: by || 'Agent', text: `🔑 Please store the secret **${name}** on this card: ${purpose}. Paste it into the masked box; I never see it.`, at: now() });
  c.updated = now(); save(p);
  return c;
}
function put(b) {
  const slug = String(b.slug || ''), name = checkName(b.name), value = String(b.value == null ? '' : b.value);
  if (!value) throw bad('paste the secret first');
  if (value.length > 8192) throw bad('that is too long for a secret');
  const s = purge(), x = find(s, slug, name);
  if (!x) throw bad('nobody asked for ' + name, 404);
  x.blob = protect(value); x.storedAt = now(); delete x.lastUsedAt; delete x.lastUsedBy;
  write(s); markCard(x, true);
  return { ok: true, name };
}
const list = () => ({ hours: purge().hours, items: read().items.map(clean) });
function forget(slug, name) {
  const s = read(), x = find(s, slug, name); if (!x) throw bad('no such secret', 404);
  write({ ...s, items: s.items.filter(y => y !== x) }); markCard(x, false);
  return { ok: true };
}
function setHours(h) {
  h = Number(h); if (!(h >= 0 && h <= 24 * 365)) throw bad('hours must be 0 (never) or more');
  const s = read(); s.hours = h; write(s); purge(); return { hours: h };
}

/* ---------- run (AIG-586) ---------- */
function grant(slug, name, b) {
  checkName(name);
  const s = purge(), x = find(s, slug, name);
  if (!x || !x.blob) throw bad(name + ' is not stored: ask for it on a card first (aigile secret ask)', 404);
  const f = grantFile(unprotect(x.blob));
  x.lastUsedAt = now(); x.lastUsedBy = String(b.by || '').slice(0, 60);
  const keep = !!b.keep;
  write(keep ? s : { ...s, items: s.items.filter(y => y !== x) });
  if (!keep) markCard(x, false);
  return { file: f, kept: keep };
}
// A fresh one-use grant file holding value (mode 0600); the reader deletes it, purge() sweeps it after 30 s. Also used by aigile sudo (AIG-1023).
function grantFile(value) {
  const f = path.join(GRANTS(), crypto.randomBytes(16).toString('hex') + '.grant');
  fs.mkdirSync(GRANTS(), { recursive: true });
  fs.writeFileSync(f, value, { mode: 0o600 });
  return f;
}
// Only aigile on this computer (loopback, X-Aigile-Where), never the page or a phone.
function cliOnly(req) {
  asked(req);
  if (!req.headers['x-aigile-where']) throw bad('secrets are handed to the aigile command only', 403);
}
function grantRoute(req, slug, name, b) {
  asked(req);
  if (!req.headers['x-aigile-where']) throw bad('secrets are handed to aigile secret run only', 403);
  return grant(slug, name, b);
}
/* ---------- kept values (AIG-902) ---------- */
// The board's own logins (a mailbox password, lib/mail.js): the same encryption, in their own file data/secrets/kept.json.
// Never purged by the hours setting, never in list(), never handed out by grant(): only board code reads them back.
// AIG-1172: it holds the only key to the sealed chats (lib/atrest.js), so it is never rewritten in place: a save goes to a temp
// file (flushed to disk) that is renamed over it, and the last good version is kept as kept.json.bak first. Reading: a missing
// or damaged kept.json falls back to the .bak. Missing and no .bak is "nothing kept yet" ({}); damaged with no good .bak throws,
// so no caller takes a damaged file for an empty one (atrest then refuses chats rather than make a new key; a save is refused
// rather than write over the other values).
const KEPT = () => path.join(DIR(), 'kept.json');
const KEPT_BAK = () => KEPT() + '.bak';
function readKeptFile(f) {   // { v } good, { missing: true }, or { bad: true }
  let raw; try { raw = fs.readFileSync(f, 'utf8'); } catch (e) { return e.code === 'ENOENT' ? { missing: true } : { bad: true }; }
  try { const v = JSON.parse(raw); return v && typeof v === 'object' && !Array.isArray(v) ? { v } : { bad: true }; } catch { return { bad: true }; }
}
function readKept() {
  const main = readKeptFile(KEPT());
  if (main.v) return main.v;
  const bak = readKeptFile(KEPT_BAK());
  if (bak.v) return bak.v;
  if (main.missing && bak.missing) return {};
  throw bad('the board\'s saved logins (data/secrets/kept.json) are damaged and there is no good backup', 500);
}
function writeAtomic(f, text) {
  const tmp = f + '.tmp', fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, f);
}
function keep(k, value) {
  const all = readKept();
  if (value == null || value === '') delete all[k]; else all[k] = protect(String(value));
  fs.mkdirSync(DIR(), { recursive: true });
  const cur = readKeptFile(KEPT());
  if (cur.v) writeAtomic(KEPT_BAK(), JSON.stringify(cur.v, null, 1));   // only a good version replaces the backup
  writeAtomic(KEPT(), JSON.stringify(all, null, 1));
}
function kept(k) { const b = readKept()[k]; return b ? unprotect(b) : null; }
const hasKept = k => !!readKept()[k];
const keptKeys = () => Object.keys(readKept());

setInterval(() => { try { purge(); } catch {} }, 60e3).unref();

module.exports = { token, gate, ask, put, list, forget, setHours, grantRoute, grant, grantFile, cliOnly, protect, unprotect, purge, keep, kept, hasKept, keptKeys };
