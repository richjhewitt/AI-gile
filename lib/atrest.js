// 🔒 Chats at rest (AIG-1166): friends' DM chats (data/dms/<contact>.json) and group chats (data/groups/<id>.chat) are kept
// encrypted on disk with AES-256-GCM, one sealed blob per file. AIG-1170 added lead chats (data/<slug>.chat), the Lead Scrum
// Master's chat (data/watchman.conf / watchman.last) and DM attachments (data/dms/files/), see chatFiles() below. Lifted from ChilledChat's crypto-at-rest.js and migrate-encrypt.js
// (Davy OK'd the reuse), with two changes: the key is never in an env var or in the code, and a missing key never falls back to
// plaintext (ChilledChat passed text through unencrypted when its key was unset).
//
// The key: 32 random bytes made on first use and kept with the board's own logins (lib/secrets.js keep(), so Windows DPAPI for
// this Windows user, or AES with a key file off Windows and in tests). Read once per start, held in memory, never printed or sent.
// File format: "aigile-atrest-v1:" + base64(iv 12 | auth tag 16 | ciphertext). Anything else is old plaintext JSON: it is read as
// it is and sealed on its next write; migrate() (run at start, safe to run twice) seals every old chat file at once.
// Key gone while sealed chats exist (data/ copied to another PC or Windows user, or data/secrets/kept.json lost): reading and
// writing chats are refused with a plain message. A new key is never made over old sealed chats, and nothing falls back to plaintext.
// Backups: a copy of data/ holds sealed chats that open only where the key opens. To take chats elsewhere, export them as plain
// JSON for the owner: GET /api/dms/contacts/:id/export and GET /api/chats/_groups/:id/export.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA, bad } = require('./store');

const PREFIX = 'aigile-atrest-v1:';
const BPREFIX = 'aigile-atrest-b1:';   // a sealed attachment (bytes, not base64): same length as PREFIX
const NAME = 'chats.atrest';   // the kept-value name in data/secrets/kept.json
const tr = (k, v) => require('./i18n').t(k, v);
const fail = k => { const e = bad(tr(k), 500); e.atrest = true; return e; };

// Every chat file this covers: a DM chat (12 hex digits, the contact id), a group chat, a lead chat (data/<slug>.chat, the
// 💚 assistant's data/_assistant.chat among them, AIG-1170) and the 🧭 Lead Scrum Master's chat (data/watchman.conf while quiet,
// data/watchman.last by day). DM attachments (data/dms/files/<contact>/<id>, AIG-1170) are sealed as bytes (BPREFIX, raw iv|tag|ct).
const isDmChat = f => /^[0-9a-f]{12}\.json$/.test(f);
const dir = (d, ok) => { try { return fs.readdirSync(d).filter(ok).map(f => path.join(d, f)); } catch { return []; } };
function chatFiles() {
  return [...dir(path.join(DATA, 'dms'), isDmChat), ...dir(path.join(DATA, 'groups'), f => f.endsWith('.chat')),
    ...dir(DATA, f => f.endsWith('.chat') || f === 'watchman.conf' || f === 'watchman.last')];
}
const FILES = () => path.join(DATA, 'dms', 'files');
const attachmentFiles = () => dir(FILES(), f => /^[0-9a-f]{12}$/.test(f)).flatMap(d => dir(d, f => !f.endsWith('.tmp')));
function startsSealed(file) {
  let fd; try { fd = fs.openSync(file, 'r'); const b = Buffer.alloc(PREFIX.length); fs.readSync(fd, b, 0, b.length, 0); const h = b.toString('latin1'); return h === PREFIX || h === BPREFIX; }
  catch { return false; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}
const isSealed = raw => typeof raw === 'string' && raw.startsWith(PREFIX);
const isSealedBytes = buf => buf.length >= BPREFIX.length && buf.toString('latin1', 0, BPREFIX.length) === BPREFIX;

/* ---------- the key ---------- */
let cached = null;
// make: true for a write, so the very first chat makes the key. Never when sealed chats already exist without one.
function key(make) {
  if (cached) return cached;
  const S = require('./secrets');
  let hex;
  try { hex = S.kept(NAME); } catch { throw fail('atrest.locked'); }
  if (hex) {
    const k = Buffer.from(hex, 'hex');
    if (k.length !== 32) throw fail('atrest.locked');
    return (cached = k);
  }
  if (!make || chatFiles().some(startsSealed) || attachmentFiles().some(startsSealed)) throw fail('atrest.nokey');
  const k = crypto.randomBytes(32);
  try { S.keep(NAME, k.toString('hex')); if (S.kept(NAME) !== k.toString('hex')) throw new Error('not kept'); } catch { throw fail('atrest.nokeep'); }
  return (cached = k);
}
// Throws (plain message) when chats could not be written now; the DM poll checks this before it takes anything off the relay.
const ready = () => { key(true); return true; };

/* ---------- seal and open ---------- */
function seal(text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(true), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function open(raw) {
  if (!isSealed(raw)) return raw;   // old plaintext: read as it is
  const k = key(false), b = Buffer.from(raw.slice(PREFIX.length), 'base64');
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch { throw fail('atrest.badfile'); }   // never handed on as if it were the chat, never overwritten by a fresh empty one
}
// Attachments (AIG-1170): the same AES-256-GCM, as bytes. Old plaintext bytes are handed back as they are.
function sealBytes(buf) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(true), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from(BPREFIX, 'latin1'), iv, c.getAuthTag(), ct]);
}
function openBytes(buf) {
  if (!isSealedBytes(buf)) return buf;
  const k = key(false), b = buf.subarray(BPREFIX.length);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]);
  } catch { throw fail('atrest.badfile'); }
}

/* ---------- files ---------- */
// Sealed, atomic (temp file + rename), owner-only where the OS has file modes. Refuses (never plaintext) when there is no key.
function put(file, sealed) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, sealed, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
const writeText = (file, text) => put(file, seal(text));
const readText = file => open(fs.readFileSync(file, 'utf8'));   // a missing file throws ENOENT as before
const writeBytes = (file, buf) => put(file, sealBytes(buf));
const readBytes = file => openBytes(fs.readFileSync(file));
// As lib/dm.js readJson: missing or damaged plaintext gives dflt; a sealed file that cannot be opened is an error, so a
// read-modify-write never replaces the chat with an empty one.
function readJson(file, dflt) {
  let raw; try { raw = fs.readFileSync(file, 'utf8'); } catch { return dflt; }
  if (isSealed(raw)) return JSON.parse(open(raw));
  try { return JSON.parse(raw); } catch { return dflt; }
}

/* ---------- the one-off migration ---------- */
// Seals every old plaintext chat file. Already sealed ones are skipped, so it is safe to run again (it runs at every start).
// A damaged plaintext file is left alone for the owner to look at.
function migrate() {
  let sealed = 0, already = 0, skipped = 0;
  for (const f of chatFiles()) {
    if (startsSealed(f)) { already++; continue; }
    let raw; try { raw = fs.readFileSync(f, 'utf8'); JSON.parse(raw); } catch { skipped++; continue; }
    writeText(f, raw); sealed++;
  }
  for (const f of attachmentFiles()) {   // AIG-1170: DM attachments, any bytes
    if (startsSealed(f)) { already++; continue; }
    let buf; try { buf = fs.readFileSync(f); } catch { skipped++; continue; }
    writeBytes(f, buf); sealed++;
  }
  return { sealed, already, skipped };
}

module.exports = { readJson, readText, writeText, readBytes, writeBytes, migrate, ready, isSealed, PREFIX };
