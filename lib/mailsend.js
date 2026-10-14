// ✉️ Mail: reply and send with SMTP (AIG-904, docs/MAIL-PLAN.md card 3). Only the owner sends: the route takes the secrets
// page token through secrets.gate (loopback page only; the CLI and agents are refused), and there is no CLI command for it.
// Undo send is on the page (10 s before the request goes out). Port 465 is TLS from the start, any other port upgrades
// with STARTTLS (refused if the server can't); AIGILE_MAIL_PLAIN=1 (tests only) talks plain TCP. AUTH PLAIN with the
// mailbox's saved password, or AUTH XOAUTH2 for a Microsoft mailbox (AIG-909). Each send is one line in data/mail/log.jsonl: when, mailbox, to, subject (never the body).
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const crypto = require('crypto');
const { DATA, bad, now } = require('./store');
const secrets = require('./secrets');

const TIMEOUT = 20000, MAX_BODY = 200 * 1024;
const plain = () => process.env.AIGILE_MAIL_PLAIN === '1';
const one = (s, n) => String(s == null ? '' : s).replace(/[\r\n\x00]+/g, ' ').trim().slice(0, n);
const ADDR = /^[^@\s<>(),;:"]+@[^@\s<>(),;:"]+\.[^@\s<>(),;:"]+$/;

// One SMTP conversation: say() sends a line and waits for the full (multi-line) reply, failing on an unexpected code.
function smtp(sock) {
  let buf = '', wait = null, dead = null;
  const feed = d => {
    buf += d.toString('latin1');
    const m = buf.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n$/);
    if (m && wait) { const w = wait, text = buf; wait = null; buf = ''; w.res({ code: Number(m[1]), text }); }
  };
  const fail = e => { dead = dead || e; if (wait) { const w = wait; wait = null; w.rej(dead); } };
  const hook = s => { s.on('data', feed); s.on('error', fail); s.on('close', () => fail(new Error('the mail server closed the connection'))); s.setTimeout(TIMEOUT, () => { fail(new Error('the mail server did not answer in time')); s.destroy(); }); };
  hook(sock);
  const c = {
    sock,
    read: ok => new Promise((res, rej) => { if (dead) return rej(dead); wait = { res, rej }; feed(''); }).then(r => { if (ok && !ok.includes(r.code)) throw new Error('the mail server said: ' + one(r.text, 200)); return r; }),
    say: (line, ok) => { c.sock.write(line + '\r\n'); return c.read(ok); },
    upgrade: host => new Promise((res, rej) => {
      c.sock.removeAllListeners('data');
      const s = tls.connect({ socket: c.sock, servername: net.isIP(host) ? undefined : host }, () => res());
      s.on('error', rej); c.sock = s; hook(s);
    }),
  };
  return c;
}

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
function build(from, x) {
  const body = x.text.replace(/\r?\n/g, '\r\n');   // sent as base64, whose lines never start with a dot: no dot-stuffing needed
  const head = [
    'From: ' + (from.name ? encWord(from.name) + ' ' : '') + '<' + from.address + '>',
    'To: ' + x.to.join(', '),
    'Subject: ' + encWord(x.subject),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@' + from.address.split('@')[1] + '>',
    ...(x.inReplyTo ? ['In-Reply-To: ' + x.inReplyTo, 'References: ' + x.inReplyTo] : []),
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64',
  ];
  return head.join('\r\n') + '\r\n\r\n' + b64(body).replace(/.{76}/g, '$&\r\n');
}

function connect(host, port) {
  return new Promise((res, rej) => {
    const opts = { host, port, timeout: TIMEOUT };
    const sock = plain() || port !== 465 ? net.connect(opts) : tls.connect({ ...opts, servername: net.isIP(host) ? undefined : host });
    sock.once('error', rej);
    const c = smtp(sock);
    c.read([220]).then(() => res(c), rej);
  });
}

// box: the saved mailbox (from lib/mail.js), x: { to, subject, text, inReplyTo }.
async function send(req, b, box) {
  secrets.gate(req, b.token);
  const to = String(b.to || '').split(/[,;]/).map(s => s.trim().replace(/^.*<([^>]+)>.*$/, '$1')).filter(Boolean);
  if (!to.length || to.length > 20 || !to.every(a => ADDR.test(a))) throw bad('type who it goes to, like name@example.com (up to 20, comma between)');
  const subject = one(b.subject, 300), text = String(b.text == null ? '' : b.text);
  if (!subject && !text.trim()) throw bad('the mail is empty');
  if (text.length > MAX_BODY) throw bad('that mail is too long');
  const inReplyTo = /^<[^<>\s]{1,300}>$/.test(String(b.inReplyTo || '')) ? b.inReplyTo : '';
  const cred = await require('./mail').cred(box);   // { pass }, or { bearer } for a Microsoft mailbox (AIG-909)
  const host = box.smtpHost || String(box.host).replace(/^imap\./, 'smtp.'), port = Number(box.smtpPort) || 465;
  const c = await connect(host, port);
  try {
    let ehlo = await c.say('EHLO aigile.local', [250]);
    if (!plain() && port !== 465) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error(host + ' does not offer STARTTLS on port ' + port + ': not sending the password in the clear');
      await c.say('STARTTLS', [220]); await c.upgrade(host); ehlo = await c.say('EHLO aigile.local', [250]);
    }
    if (cred.bearer) {   // XOAUTH2: a refusal comes as 334 <base64 JSON>, answered with an empty line
      const r = await c.say('AUTH XOAUTH2 ' + require('./mailoauth').xoauth2(box.user || box.address, cred.bearer), [235, 334]);
      if (r.code === 334) { await c.say('').catch(() => {}); throw new Error('the mail server refused the ' + (box.auth === 'google' ? 'Google' : 'Microsoft') + ' sign-in for sending (is SMTP AUTH on for this mailbox?)'); }
    } else await c.say('AUTH PLAIN ' + b64('\0' + (box.user || box.address) + '\0' + cred.pass), [235]);
    await c.say('MAIL FROM:<' + box.address + '>', [250]);
    for (const a of to) await c.say('RCPT TO:<' + a + '>', [250, 251]);
    await c.say('DATA', [354]);
    await c.say(build({ name: box.name, address: box.address }, { to, subject, text, inReplyTo }) + '\r\n.', [250]);
    await c.say('QUIT').catch(() => {});
  } finally { try { c.sock.destroy(); } catch {} }
  const at = now();
  fs.mkdirSync(path.join(DATA, 'mail'), { recursive: true });
  fs.appendFileSync(path.join(DATA, 'mail', 'log.jsonl'), JSON.stringify({ at, what: 'sent', box: box.id, to, subject }) + '\n');
  return { ok: true, at, to };
}

module.exports = { send, _build: build };
