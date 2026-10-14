// ✉️ Mail, card 1 (AIG-902, docs/MAIL-PLAN.md): add an IMAP mailbox and read the newest 50 mails of its inbox (from, subject,
// date, unread). Reading one mail is card 2 (AIG-903, message() below). Built-ins only: a small IMAP client over node:tls (LOGIN, SELECT INBOX,
// UID SEARCH ALL, UID FETCH (UID FLAGS INTERNALDATE ENVELOPE), LOGOUT) that reads literals ({n} plus n bytes) properly.
// A Microsoft mailbox (card 7, AIG-909) logs in with AUTHENTICATE XOAUTH2 instead of LOGIN (lib/mailoauth.js).
//
// Where things live (data/ is git-ignored):
// - data/mail/config.json: the mailboxes { id, name, address, host, port, user, lastOkAt, lastError }. No password.
// - the password: lib/secrets.js keep()/kept() (same DPAPI or AES as 🔑 secrets, its own file, never listed, never granted).
//   Never sent to the page, never logged, never in an error text (LOGIN is not echoed anywhere).
// - data/mail/<id>/inbox.json: cached headers of mail from the last 30 days, so the page opens fast. "Forget cache" deletes it.
// The fence: saving a mailbox and testing a connection take the secrets page token (secrets.gate): the board page only, never
// the CLI or an agent, so nobody else can point a saved password at another server.
// Tests: AIGILE_MAIL_PLAIN=1 talks plain TCP (the QA fake server); AIGILE_MAIL_FIND_STUB = JSON { mx: [...], answers: [...] }
// stands in for DNS and the port 993 probe of "find settings".
// Mail is untrusted data: everything here is cut to size and stripped of control characters; the page escapes it.
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const crypto = require('crypto');
const dns = require('dns').promises;
const { DATA, bad, now } = require('./store');
const secrets = require('./secrets');
const oauth = require('./mailoauth');

const DIR = () => path.join(DATA, 'mail');
const CONF = () => path.join(DIR(), 'config.json');
const CACHE = id => path.join(DIR(), id, 'inbox.json');
const KEEP_DAYS = 30, NEWEST = 50, TIMEOUT = 20000, MAX_BUF = 32 * 1024 * 1024;
const plain = () => process.env.AIGILE_MAIL_PLAIN === '1';
const secretKey = id => 'mail:' + id;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\x00-\x1f\x7f​-‏‪-‮⁦-⁩]+/g, ' ').trim().slice(0, n);

/* ---------- the IMAP client ---------- */
// One connection. Server output is cut into "units": a line, with any {n} literals swapped for a \0<i>\0 marker and the
// bytes kept in lits[i]. A tagged line ends the running command; "+" answers a literal we are sending.
class Imap {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.text = ''; this.lits = []; this.need = -1; this.n = 0;
    this.cur = null; this.cont = null; this.dead = null;
    this.greeting = new Promise((res, rej) => { this.greet = { res, rej }; });
    sock.on('data', d => { this.buf = Buffer.concat([this.buf, d]); try { this.pump(); } catch (e) { this.fail(e); } });
    sock.on('error', e => this.fail(e));
    sock.on('close', () => this.fail(new Error('the mail server closed the connection')));
    sock.setTimeout(TIMEOUT, () => { this.fail(new Error('the mail server did not answer in time')); sock.destroy(); });
  }
  pump() {
    for (;;) {
      if (this.need >= 0) {
        if (this.buf.length < this.need) return;
        this.lits.push(this.buf.subarray(0, this.need)); this.text += '\0' + (this.lits.length - 1) + '\0';
        this.buf = this.buf.subarray(this.need); this.need = -1; continue;
      }
      const i = this.buf.indexOf('\r\n');
      if (i < 0) { if (this.buf.length > MAX_BUF) throw new Error('the mail server sent too much'); return; }
      const line = this.buf.subarray(0, i).toString('utf8'); this.buf = this.buf.subarray(i + 2);
      const m = line.match(/\{(\d+)\+?\}$/);
      if (m) { const n = Number(m[1]); if (n > MAX_BUF) throw new Error('the mail server sent too much'); this.text += line.slice(0, -m[0].length); this.need = n; continue; }
      const u = { text: this.text + line, lits: this.lits }; this.text = ''; this.lits = [];
      this.unit(u);
    }
  }
  unit(u) {
    if (this.greet) {
      const g = this.greet; this.greet = null;
      if (/^\* (OK|PREAUTH)\b/i.test(u.text)) g.res(u); else g.rej(new Error('the mail server said: ' + clip(u.text.slice(2), 200)));
      return;
    }
    // A "+" nobody waits for is a SASL challenge (a refused XOAUTH2 sends its error that way): an empty line ends it with a NO.
    if (/^\+/.test(u.text)) { const c = this.cont; this.cont = null; if (c) c.res(); else if (this.cur) this.sock.write('\r\n'); return; }
    const c = this.cur;
    if (c && u.text.startsWith(c.tag + ' ')) {
      this.cur = null;
      const rest = u.text.slice(c.tag.length + 1), ok = /^OK\b/i.test(rest);
      if (this.cont) { this.cont.rej(new Error('the mail server said: ' + clip(rest, 200))); this.cont = null; }
      if (ok) c.res({ units: c.units, text: rest }); else c.rej(new Error('the mail server said: ' + clip(rest.replace(/^(NO|BAD)\s*/i, ''), 200)));
      return;
    }
    if (c) c.units.push(u);
  }
  fail(e) {
    if (this.dead) return; this.dead = e;
    if (this.greet) { this.greet.rej(e); this.greet = null; }
    if (this.cont) { this.cont.rej(e); this.cont = null; }
    if (this.cur) { this.cur.rej(e); this.cur = null; }
  }
  // args are sent as quoted strings, or as literals when they hold anything but plain printable ASCII.
  async run(cmd, args = []) {
    if (this.dead) throw this.dead;
    const tag = 'A' + (++this.n);
    const done = new Promise((res, rej) => { this.cur = { tag, units: [], res, rej }; });
    done.catch(() => {});
    let line = tag + ' ' + cmd;
    for (const a of args) {
      const s = String(a);
      if (/^[\x20-\x7e]*$/.test(s) && s.length < 900) { line += ' "' + s.replace(/[\\"]/g, '\\$&') + '"'; continue; }
      const b = Buffer.from(s, 'utf8');
      const go = new Promise((res, rej) => { this.cont = { res, rej }; });
      this.sock.write(line + ' {' + b.length + '}\r\n');
      await go;
      this.sock.write(b); line = '';
    }
    this.sock.write(line + '\r\n');
    return done;
  }
  close() { try { this.sock.destroy(); } catch {} }
}

function connect(host, port) {
  return new Promise((res, rej) => {
    const opts = { host, port, timeout: TIMEOUT };
    const sock = plain() ? net.connect(opts) : tls.connect({ ...opts, servername: net.isIP(host) ? undefined : host });
    const s = new Imap(sock);
    const timer = setTimeout(() => { s.fail(new Error('could not reach ' + host + ':' + port + ' in time')); sock.destroy(); }, TIMEOUT);
    s.greeting.then(() => { clearTimeout(timer); res(s); }, e => { clearTimeout(timer); s.close(); rej(niceError(e, host, port)); });
  });
}
function niceError(e, host, port) {
  const c = e && e.code;
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return new Error('no server called ' + host + ' was found');
  if (c === 'ECONNREFUSED') return new Error(host + ' does not take connections on port ' + port);
  if (c === 'ETIMEDOUT') return new Error('could not reach ' + host + ':' + port + ' in time');
  if (c && /CERT|SELF_SIGNED|ALTNAME/.test(c)) return new Error('the server\'s certificate is not valid for ' + host + ' (' + c + ')');
  return new Error(clip(e && e.message || String(e), 300));
}

// Parse one unit into nested arrays: atoms and strings as strings, NIL as null, ( ) as arrays.
function parse(u) {
  const s = u.text; let i = 0;
  function list() {
    const out = [];
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ') { i++; continue; }
      if (ch === '(') { i++; out.push(list()); continue; }
      if (ch === ')') { i++; return out; }
      if (ch === '"') { let v = ''; i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; v += s[i++]; } i++; out.push(v); continue; }
      if (ch === '\0') { const j = s.indexOf('\0', i + 1); const b = u.lits[Number(s.slice(i + 1, j))]; out.push(b ? b.toString('utf8') : ''); i = j + 1; continue; }
      let j = i; while (j < s.length && !' ()"\0'.includes(s[j])) j++;
      if (j === i) { i++; continue; }
      const a = s.slice(i, j); i = j; out.push(/^NIL$/i.test(a) ? null : a);
    }
    return out;
  }
  return list();
}

/* ---------- headers ---------- */
function decodeBytes(b, cs) { try { return new TextDecoder(cs).decode(b); } catch { return b.toString('latin1'); } }
// RFC 2047 encoded words (=?utf-8?B?...?=), joined when one character is split over two words.
function words(v) {
  const s = String(v == null ? '' : v).replace(/(\?=)\s+(=\?)/g, '$1$2');
  return s.replace(/(?:=\?[^?\s]+\?[bBqQ]\?[^?\s]*\?=)+/g, run => {
    let out = '', cs = null, parts = [];
    const flush = () => { if (parts.length) out += decodeBytes(Buffer.concat(parts), cs); parts = []; };
    for (const m of run.matchAll(/=\?([^?*\s]+)(?:\*[^?]*)?\?([bBqQ])\?([^?\s]*)\?=/g)) {
      const c = m[1].toLowerCase(); if (c !== cs) { flush(); cs = c; }
      parts.push(m[2].toUpperCase() === 'B' ? Buffer.from(m[3], 'base64')
        : Buffer.from(m[3].replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1'));
    }
    flush(); return out;
  });
}
const addr = a => Array.isArray(a) ? { name: clip(words(a[0]), 120), address: clip([a[2], a[3]].filter(Boolean).join('@'), 200) } : null;
function when(env, internal) {
  for (const d of [env, internal && String(internal).replace(/^(\d+)-(\w+)-(\d+)/, '$1 $2 $3')]) { const t = d ? Date.parse(d) : NaN; if (!isNaN(t)) return new Date(t).toISOString(); }
  return null;
}
function fetchItem(u) {
  const p = parse(u), k = p.findIndex(x => typeof x === 'string' && /^FETCH$/i.test(x)), f = p[k + 1];
  if (k < 0 || !Array.isArray(f)) return null;
  const o = {}; for (let i = 0; i + 1 < f.length; i += 2) o[String(f[i]).toUpperCase()] = f[i + 1];
  const env = Array.isArray(o.ENVELOPE) ? o.ENVELOPE : [], flags = Array.isArray(o.FLAGS) ? o.FLAGS.map(String) : [];
  const from = (Array.isArray(env[2]) && env[2].map(addr).find(Boolean)) || { name: '', address: '' };
  return { uid: Number(o.UID) || 0, from, subject: clip(words(env[1]), 300), date: when(env[0], o.INTERNALDATE),
    unread: !flags.some(x => /^\\Seen$/i.test(x)), flagged: flags.some(x => /^\\Flagged$/i.test(x)) };
}

// How a mailbox logs in: { pass } (LOGIN) or, for a Microsoft mailbox (AIG-909), { bearer } (AUTHENTICATE XOAUTH2).
async function cred(b) {
  if (b.auth === 'microsoft' || b.auth === 'google') return { bearer: await oauth.token(b) };   // google: AIG-910
  const pass = secrets.kept(secretKey(b.id)); if (!pass) throw bad('no password saved: add it in Setup > Mail');
  return { pass };
}
const login = (s, box, c) => c.bearer ? s.run('AUTHENTICATE XOAUTH2 ' + oauth.xoauth2(box.user, c.bearer)) : s.run('LOGIN', [box.user, c.pass]);

// Log in, open INBOX; with list, read the newest 50 headers. Always logs out and closes.
async function session(box, c, list) {
  const s = await connect(box.host, box.port);
  try {
    await login(s, box, c);
    const sel = await s.run('SELECT', ['INBOX']);
    const all = [sel.text, ...sel.units.map(u => u.text)].join('\n');
    const exists = Number((all.match(/^\* (\d+) EXISTS/im) || [])[1] || 0), uidvalidity = (all.match(/UIDVALIDITY (\d+)/i) || [])[1] || '';
    let items = [];
    if (list && exists) {
      const sr = await s.run('UID SEARCH ALL');
      const uids = sr.units.filter(u => /^\* SEARCH\b/i.test(u.text)).flatMap(u => u.text.slice(8).trim().split(/\s+/)).map(Number).filter(n => n > 0);
      const newest = [...new Set(uids)].sort((a, b) => b - a).slice(0, NEWEST);
      if (newest.length) {
        const fr = await s.run('UID FETCH ' + newest.join(',') + ' (UID FLAGS INTERNALDATE ENVELOPE)');
        items = fr.units.filter(u => /^\* \d+ FETCH\b/i.test(u.text)).map(fetchItem).filter(x => x && x.uid);
        items.sort((a, b) => b.uid - a.uid);
      }
    }
    await s.run('LOGOUT').catch(() => {});
    return { exists, uidvalidity, items };
  } finally { s.close(); }
}

/* ---------- mailboxes ---------- */
function readConf() { try { const c = JSON.parse(fs.readFileSync(CONF(), 'utf8')); return { boxes: Array.isArray(c.boxes) ? c.boxes : [] }; } catch { return { boxes: [] }; } }
function writeConf(c) { fs.mkdirSync(DIR(), { recursive: true }); fs.writeFileSync(CONF(), JSON.stringify(c, null, 1)); }
const pub = b => ({ id: b.id, name: b.name, address: b.address, host: b.host, port: b.port, user: b.user, smtpHost: b.smtpHost || '', smtpPort: b.smtpPort || 465, agents: !!b.agents, hasPassword: secrets.hasKept(secretKey(b.id)),
  auth: b.auth === 'microsoft' || b.auth === 'google' ? b.auth : 'password', msClient: b.msClient || '', msSignedIn: b.auth === 'microsoft' && oauth.signedIn(b.id),   // AIG-909
  gClient: b.gClient || '', gHasSecret: b.auth === 'google' && oauth.hasGoogleSecret(b.id), gSignedIn: b.auth === 'google' && oauth.signedIn(b.id),   // AIG-910: the client secret never goes to the page
  lastOkAt: b.lastOkAt || null, lastError: b.lastError || '' });
const config = () => ({ boxes: readConf().boxes.map(pub) });
const findBox = id => { const b = readConf().boxes.find(x => x.id === id) || (!id && readConf().boxes[0]); if (!b) throw bad('no such mailbox', 404); return b; };

function clean(b) {
  // Microsoft sign-in (AIG-909): a client ID instead of a password, and Microsoft's own servers.
  const ms = b.auth === 'microsoft', gg = b.auth === 'google';
  if (ms) { oauth.checkClient(b.msClient); b = oauth.fixed(b); }
  if (gg) { oauth.checkGoogleClient(b.gClient); b = oauth.gfixed(b); }   // Google sign-in (AIG-910): Gmail's own servers
  const address = clip(b.address, 200), host = clip(b.host, 253).toLowerCase(), port = Number(b.port || 993), user = clip(b.user, 200) || address;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw bad('type the email address, like you@example.com');
  if (!/^[a-z0-9.-]+$/.test(host) && !net.isIP(host)) throw bad('type the mail server, like imap.example.com');
  if (!(Number.isInteger(port) && port > 0 && port < 65536)) throw bad('the port is a number, usually 993');
  // Sending (AIG-904): the SMTP server, by default the IMAP one with imap. swapped for smtp., port 465 (TLS) or 587 (STARTTLS).
  const smtpHost = clip(b.smtpHost, 253).toLowerCase(), smtpPort = Number(b.smtpPort || 465);
  if (smtpHost && !/^[a-z0-9.-]+$/.test(smtpHost) && !net.isIP(smtpHost)) throw bad('type the send server, like smtp.example.com');
  if (!(Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort < 65536)) throw bad('the send port is a number, usually 465 or 587');
  return { name: clip(b.name, 60) || address, address, host, port, user, smtpHost, smtpPort, agents: !!b.agents,   // agents: AIG-908
    auth: ms ? 'microsoft' : gg ? 'google' : 'password', msClient: ms ? String(b.msClient).toLowerCase() : '', msAuthority: ms && process.env.AIGILE_MAIL_MS_TEST === '1' ? clip(b.msAuthority, 200) : '',
    gClient: gg ? String(b.gClient).toLowerCase() : '', gAuthority: gg && process.env.AIGILE_MAIL_GOOGLE_TEST === '1' ? clip(b.gAuthority, 200) : '' };
}
function save(req, b) {
  secrets.gate(req, b.token);
  const c = readConf();
  if (b.remove) {
    const x = c.boxes.find(y => y.id === b.id); if (!x) throw bad('no such mailbox', 404);
    secrets.keep(secretKey(x.id), null); oauth.forget(x.id, true); forget(x.id);
    writeConf({ boxes: c.boxes.filter(y => y !== x) }); return config();
  }
  const v = clean(b), pass = String(b.password == null ? '' : b.password);
  if (pass.length > 1000) throw bad('that password is too long');
  let x = b.id && c.boxes.find(y => y.id === b.id);
  if (b.id && !x) throw bad('no such mailbox', 404);
  if (x && !('msAuthority' in b) && x.msAuthority && v.auth === 'microsoft') v.msAuthority = x.msAuthority;   // tests: the page never sends it
  if (x && !('gAuthority' in b) && x.gAuthority && v.auth === 'google') v.gAuthority = x.gAuthority;
  const gSecret = String(b.gSecret == null ? '' : b.gSecret);
  if (gSecret.length > 500) throw bad('that client secret is too long');
  if (!x) { x = { id: 'm' + crypto.randomBytes(4).toString('hex') }; c.boxes.push(x); }
  const moved = x.host && (x.host !== v.host || x.user !== v.user || x.port !== v.port);
  if (v.auth === 'microsoft') {
    // No password here. The sign-in belongs to one account and one app: a new address or client ID means signing in again.
    if (x.auth !== 'microsoft' || x.msClient !== v.msClient || x.user !== v.user) oauth.forget(x.id);
    secrets.keep(secretKey(x.id), null);
  } else if (v.auth === 'google') {   // AIG-910: client ID + secret instead of a password; a new account or client means signing in again
    if (!gSecret && !oauth.hasGoogleSecret(x.id)) throw bad('paste the Client secret of your Google app');
    if (x.auth !== 'google' || x.gClient !== v.gClient || x.user !== v.user || gSecret) oauth.forget(x.id);
    secrets.keep(secretKey(x.id), null);
    if (gSecret) oauth.setGoogleSecret(x.id, gSecret);
  } else {
    if (x.auth === 'google') oauth.forget(x.id, true);
    if (!pass && (!secrets.hasKept(secretKey(x.id)) || moved)) throw bad('type the password' + (moved ? ' again: the server or user name changed' : ''));
    if (x.auth === 'microsoft') oauth.forget(x.id);
  }
  Object.assign(x, v, { lastError: '' });
  if (pass && v.auth === 'password') secrets.keep(secretKey(x.id), pass);
  if (moved) forget(x.id);
  writeConf(c);
  return { ...config(), id: x.id };
}
// Test what the form says. A blank password uses the saved one only for the same server and user (never sends it elsewhere).
async function test(req, b) {
  secrets.gate(req, b.token);
  const v = clean(b);
  if (v.auth === 'microsoft') {   // AIG-909: tests the saved, signed-in mailbox (its token never goes anywhere the form says)
    const x = b.id && readConf().boxes.find(y => y.id === b.id);
    if (!x || x.auth !== 'microsoft' || x.msClient !== v.msClient || !oauth.signedIn(x.id)) throw bad('save, then press Sign in with Microsoft first');
    try { const r = await session(x, await cred(x), false); return { ok: true, count: r.exists }; }
    catch (e) { return { ok: false, error: clip(e.message, 300) }; }
  }
  if (v.auth === 'google') {   // AIG-910: same, for the saved Google mailbox
    const x = b.id && readConf().boxes.find(y => y.id === b.id);
    if (!x || x.auth !== 'google' || x.gClient !== v.gClient || !oauth.signedIn(x.id)) throw bad('save, then press Sign in with Google first');
    try { const r = await session(x, await cred(x), false); return { ok: true, count: r.exists }; }
    catch (e) { return { ok: false, error: clip(e.message, 300) }; }
  }
  let pass = String(b.password == null ? '' : b.password);
  if (!pass && b.id) {
    const x = readConf().boxes.find(y => y.id === b.id);
    if (x && x.host === v.host && x.user === v.user && x.port === v.port) pass = secrets.kept(secretKey(x.id)) || '';
  }
  if (!pass) throw bad('type the password to test');
  try { const r = await session(v, { pass }, false); return { ok: true, count: r.exists }; }
  catch (e) { return { ok: false, error: clip(e.message, 300) }; }
}

/* ---------- the inbox list ---------- */
const cutoff = () => Date.now() - KEEP_DAYS * 864e5;
function readCache(id) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE(id), 'utf8'));
    if (Date.parse(c.at) < cutoff()) { forget(id); return null; }
    return c;
  } catch { return null; }
}
function forget(id) { try { fs.rmSync(path.join(DIR(), String(id).replace(/[^a-z0-9]/gi, '')), { recursive: true, force: true }); } catch {} return { ok: true }; }
function mark(id, patch) { const c = readConf(), x = c.boxes.find(y => y.id === id); if (x) { Object.assign(x, patch); writeConf(c); } }
let busy = {};
async function inbox(id, fresh) {
  const b = findBox(id), head = { id: b.id, name: b.name, address: b.address };
  const cached = readCache(b.id);
  if (!fresh) return { box: head, at: cached ? cached.at : null, items: cached ? cached.items : [], cached: !!cached, error: b.lastError || '' };
  const oa = b.auth === 'microsoft' || b.auth === 'google';
  if (oa ? !oauth.signedIn(b.id) : !secrets.hasKept(secretKey(b.id))) return { box: head, at: cached ? cached.at : null, items: cached ? cached.items : [], cached: !!cached, error: oa ? 'not signed in to ' + (b.auth === 'google' ? 'Google: press Sign in with Google' : 'Microsoft: press Sign in with Microsoft') + ' in Setup > Mail' : 'no password saved: add it in Setup > Mail' };
  try {
    const r = await (busy[b.id] = busy[b.id] || cred(b).then(c => session(b, c, true)).finally(() => { delete busy[b.id]; }));
    const at = now(), keep = r.items.filter(x => !x.date || Date.parse(x.date) >= cutoff());
    fs.mkdirSync(path.dirname(CACHE(b.id)), { recursive: true });
    fs.writeFileSync(CACHE(b.id), JSON.stringify({ at, uidvalidity: r.uidvalidity, items: keep }));
    mark(b.id, { lastOkAt: at, lastError: '' });
    return { box: head, at, items: r.items, cached: false, total: r.exists, error: '' };
  } catch (e) {
    const error = clip(e.message, 300); mark(b.id, { lastError: error });
    return { box: head, at: cached ? cached.at : null, items: cached ? cached.items : [], cached: !!cached, error };
  }
}

/* ---------- reading one mail (AIG-903) ---------- */
// UID FETCH uid (UID FLAGS ENVELOPE BODY.PEEK[]<0.cap>) on a read-only EXAMINE: PEEK, so the mail is never marked as read. The MIME
// tree is cut up here: the plain text, the HTML (scripts, forms, frames and every remote picture taken out, a count kept) and a
// list of attachments (name, type, size; never opened).
const BODY_CAP = 1024 * 1024;
function splitMsg(buf) {
  const s = buf.toString('latin1'), m = s.match(/\r?\n\r?\n/), at = m ? m.index : s.length;
  const head = {};
  for (const line of s.slice(0, at).replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) { const k = line.slice(0, i).trim().toLowerCase(); if (!(k in head)) head[k] = line.slice(i + 1).trim(); }
  }
  return { head, body: buf.subarray(m ? at + m[0].length : at) };
}
const param = (h, k) => { const m = String(h || '').match(new RegExp('(?:^|;)\\s*' + k + '\\*?\\s*=\\s*(?:"([^"]*)"|([^;\\s]*))', 'i')); return m ? (m[1] != null ? m[1] : m[2]) : ''; };
function decodeBody(body, enc) {
  enc = String(enc || '').toLowerCase().trim();
  if (enc === 'base64') return Buffer.from(body.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64');
  if (enc === 'quoted-printable') return Buffer.from(body.toString('latin1').replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  return body;
}
function walk(buf, out, depth) {
  if (depth > 6 || out.parts > 60) return;
  out.parts++;
  const { head, body } = splitMsg(buf), ct = String(head['content-type'] || 'text/plain').toLowerCase(), type = ct.split(';')[0].trim();
  if (type.startsWith('multipart/')) {
    const bd = param(head['content-type'], 'boundary'); if (!bd) return;
    const text = body.toString('latin1'), marks = [];
    const re = new RegExp('(?:^|\\r?\\n)--' + bd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(--)?[ \\t]*(?=\\r?\\n|$)', 'g');
    for (let m; (m = re.exec(text));) { marks.push({ at: m.index, end: m.index + m[0].length }); if (m[1]) break; }
    for (let i = 0; i + 1 < marks.length; i++) walk(Buffer.from(text.slice(marks[i].end, marks[i + 1].at).replace(/^\r?\n/, ''), 'latin1'), out, depth + 1);
    return;
  }
  const disp = String(head['content-disposition'] || '').toLowerCase();
  const name = words(param(head['content-disposition'], 'filename') || param(head['content-type'], 'name'));
  const raw = decodeBody(body, head['content-transfer-encoding']);
  if (/^attachment/.test(disp) || !/^text\/(plain|html)$/.test(type)) { out.attachments.push({ name: clip(name || '(no name)', 120), type: clip(type, 60), size: raw.length }); return; }
  const txt = decodeBytes(raw, (param(head['content-type'], 'charset') || 'utf-8').toLowerCase());
  if (type === 'text/html') out.html = out.html || txt; else out.text = out.text || txt;
}
// Take out what can run or phone home. The page also shows the result in a sandboxed iframe under a content security policy.
function safeHtml(h) {
  let blocked = 0;
  h = String(h).replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/<(script|iframe|frameset|object|embed|applet|form|svg|math|audio|video)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, '');
  h = h.replace(/<\/?(script|iframe|frame|frameset|object|embed|applet|form|base|meta|link|input|button|select|textarea|svg|math|audio|video|source)\b[^>]*>/gi, '');
  h = h.replace(/\s(?:on\w+|formaction|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  h = h.replace(/<img\b[^>]*>/gi, tag => { if (/\ssrc\s*=\s*["']?\s*data:image\//i.test(tag)) return tag; blocked++; return ''; });
  h = h.replace(/\s(?:background|poster)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, () => { blocked++; return ''; });
  h = h.replace(/url\(\s*["']?\s*(?!data:image\/)[^)]*\)/gi, () => { blocked++; return 'none'; }).replace(/@import[^;]*;?/gi, () => { blocked++; return ''; });
  h = h.replace(/javascript\s*:/gi, 'blocked:');
  return { html: h.slice(0, 600000), blocked };
}
function readMail(buf) {
  const out = { text: '', html: '', attachments: [], parts: 0 }; walk(buf, out, 0);
  const sh = out.html ? safeHtml(out.html) : { html: '', blocked: 0 };
  return { text: out.text.replace(/\r\n/g, '\n').replace(/\0/g, '').slice(0, 300000), html: sh.html, blockedImages: sh.blocked, attachments: out.attachments.slice(0, 30) };
}
async function message(id, uidIn) {
  const b = findBox(id), uid = Number(uidIn);
  if (!(Number.isInteger(uid) && uid > 0)) throw bad('which mail? (uid)');
  const c = await cred(b);
  const s = await connect(b.host, b.port);
  try {
    await login(s, b, c);
    await s.run('EXAMINE', ['INBOX']);
    const fr = await s.run('UID FETCH ' + uid + ' (UID FLAGS INTERNALDATE ENVELOPE BODY.PEEK[]<0.' + BODY_CAP + '>)');
    const u = fr.units.find(x => /^\* \d+ FETCH\b/i.test(x.text)); if (!u) throw bad('that mail is not in the inbox any more', 404);
    const head = fetchItem(u), p = parse(u), f = p[p.findIndex(x => typeof x === 'string' && /^FETCH$/i.test(x)) + 1] || [];
    const env = Array.isArray(f[f.indexOf('ENVELOPE') + 1]) ? f[f.indexOf('ENVELOPE') + 1] : [];
    const lm = u.text.match(/BODY\[[^\]]*\](?:<\d+>)?\s+\0(\d+)\0/), rawBuf = (lm && u.lits[Number(lm[1])]) || Buffer.alloc(0);
    await s.run('LOGOUT').catch(() => {});
    const to = (Array.isArray(env[5]) ? env[5] : []).map(addr).filter(Boolean).slice(0, 10);
    return { box: { id: b.id, name: b.name }, ...head, to, messageId: clip(env[9], 300), ...readMail(rawBuf), truncated: rawBuf.length >= BODY_CAP };
  } finally { s.close(); }
}

/* ---------- find settings ---------- */
// For a custom domain: try imap.<domain>, mail.<domain>, the _imaps SRV target and the MX hosts on 993; the first that greets wins.
function probe(host) {
  return new Promise(res => {
    let done = false; const end = (ok, why) => { if (done) return; done = true; try { sock.destroy(); } catch {} res({ host, port: 993, ok, why }); };
    const sock = tls.connect({ host, port: 993, servername: host, timeout: 6000 });
    sock.once('data', d => end(/^\* (OK|PREAUTH)/i.test(d.toString('utf8')), 'answered'));
    sock.once('error', e => end(false, clip(niceError(e, host, 993).message, 160)));
    sock.once('timeout', () => end(false, 'no answer'));
  });
}
async function find(b) {
  const m = String(b && b.address || '').trim().toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) throw bad('type the email address first');
  const domain = m[1];
  let stub = null; try { stub = process.env.AIGILE_MAIL_FIND_STUB ? JSON.parse(process.env.AIGILE_MAIL_FIND_STUB) : null; } catch {}
  const mx = stub ? stub.mx || [] : await dns.resolveMx(domain).then(l => l.sort((a, b) => a.priority - b.priority).map(x => x.exchange), () => []);
  const srv = stub ? [] : await dns.resolveSrv('_imaps._tcp.' + domain).then(l => l.map(x => x.name).filter(Boolean), () => []);
  const hosts = [...new Set([...srv, 'imap.' + domain, 'mail.' + domain, ...mx].map(h => h.toLowerCase().replace(/\.$/, '')))].slice(0, 6);
  const tried = [];
  for (const host of hosts) {
    const r = stub ? { host, port: 993, ok: (stub.answers || []).includes(host), why: 'stub' } : await probe(host);
    tried.push(r); if (r.ok) break;
  }
  const best = tried.find(r => r.ok);
  return { domain, tried, best: best ? { host: best.host, port: 993, user: b.address.trim() } : null };
}

/* ---------- Microsoft sign-in (AIG-909, lib/mailoauth.js) ---------- */
// Start and Sign out take the secrets page token like Save; status only says waiting / done / error and the code to type.
function msBox(id) { const b = findBox(String(id || '')); if (b.auth !== 'microsoft') throw bad('this mailbox signs in with a password'); return b; }
const ms = {
  start: (req, b) => { secrets.gate(req, b.token); return oauth.start(msBox(b.box)); },
  status: id => oauth.status(msBox(id).id),
  signOut: (req, b) => { secrets.gate(req, b.token); oauth.forget(msBox(b.box).id); return oauth.status(msBox(b.box).id); },
};

/* ---------- Google sign-in (AIG-910, lib/mailoauth.js) ---------- */
// Start and Sign out take the secrets page token; the callback is where Google sends the browser (checked by its one-time state).
function gBox(id) { const b = findBox(String(id || '')); if (b.auth !== 'google') throw bad('this mailbox does not sign in with Google'); return b; }
const google = {
  start: (req, b) => { secrets.gate(req, b.token); return oauth.googleStart(gBox(b.box)); },
  status: id => oauth.googleStatus(gBox(id).id),
  signOut: (req, b) => { secrets.gate(req, b.token); oauth.forget(gBox(b.box).id); return oauth.googleStatus(gBox(b.box).id); },
  callback: q => oauth.googleCallback(q),
};

module.exports = { config, google, save, test, inbox, message, ms, cred, send: (req, b) => require('./mailsend').send(req, b, findBox(String(b.box || ''))), _read: readMail, forget: id => { findBox(id); return forget(findBox(id).id); }, find, _parse: parse, _words: words };
