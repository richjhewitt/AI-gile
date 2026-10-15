// AI-gile join service (AIG-347): one-use invite links for friends to download the app. Standalone: Node only, no
// packages, and nothing from the rest of AI-gile, so this one file can be copied to a server next to relay.js.
//   node join.js     (JOIN_PORT default 4600, JOIN_HOST default 0.0.0.0, JOIN_DATA default ./join-data next to this file)
//   JOIN_OWNER_KEY   the owner's public signing key (base64url, shown in the board's Invite a friend box): only it may add codes
//   JOIN_ZIP         the release zip to hand out (default ./AI-gile.zip next to this file)
//   JOIN_EXE         the Windows installer to hand out (AIG-1231; default AI-gile-Setup.exe next to the zip). Without it only the zip is offered.
//
// No usernames, no passwords: the one-use link is the only key. It stores only codes (with created / expiry / used
// times and what the code carries) in JOIN_DATA/codes.json. It never logs who asked for anything.
//   GET  /join?code=XXXX-XXXX-XXXX   a friendly page with a Download button (valid, unused, not expired), else a plain reason
//   POST /join/download              the button: marks the code used and serves the zip with invite.json added inside
//                                    (what=exe, AIG-1231: marks it used and shows a claim code XXXX-XXXX instead, see below)
//   GET  /join/exe?claim=XXXX-XXXX   the Windows installer, named "AI-gile Setup (XXXX-XXXX).exe" (while the claim code lasts)
//   POST /join/claim                 { code: "XXXX-XXXX" }: the installed app fetches its invite with the claim code, once
// The installer is one file for everyone (so it can be signed later), so the invite cannot ride inside it: the Download
// button keeps the invite under a short claim code instead, shown on the page and put in the file name. The app reads the
// code from the name of the file it was installed from, or asks for it, and fetches the invite once (JOIN_CLAIM_DAYS, default 7).
//   POST /join/codes             the owner adds a code (signed): { code, help, dm?, from?, days? }
//   GET  /join/codes             the owner lists codes and whether they were used (signed)
//   GET  /health   (and /join/health)
// A page GET never uses a code up (link previews in chat apps fetch pages), only the Download button does.
//
// Site passes (AIG-699): a private site (test.aigile.lol) lets in only people with a pass. The owner adds a code with
// kind "site"; its link is <site>/join/site?code=...; the Open button uses it up and sets an HttpOnly cookie (JOIN_PASS_DAYS,
// default 90). nginx asks GET /join/site/check on every request (auth_request): 204 with a good pass, else 401, which the
// site turns into a redirect to the public teaser. Only a hash of each pass is stored (JOIN_DATA/passes.json).
//   GET  /join/site?code=...   POST /join/site (the Open button)   GET /join/site/check   POST /join/site/out (sign out)
//   POST /join/site/revoke     the owner ends every pass made from a code (signed): { code }
// Signed requests carry x-join-key (Ed25519 public key, base64url), x-join-ts (ms), x-join-nonce and x-join-sig:
// an Ed25519 signature over "aigile-join-v1\n<METHOD>\n<path>\n<ts>\n<nonce>\n<sha256 hex of the body>".
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.JOIN_PORT) || 4600;
const HOST = process.env.JOIN_HOST || '0.0.0.0';
const DATA = path.resolve(process.env.JOIN_DATA || path.join(__dirname, 'join-data'));
const ZIP = path.resolve(process.env.JOIN_ZIP || path.join(__dirname, 'AI-gile.zip'));
const OWNER_KEY = String(process.env.JOIN_OWNER_KEY || '').trim();
const DAYS = Number(process.env.JOIN_DAYS) || 7;           // how long a code works
const SKEW_MS = 2 * 60e3;                                   // a signed request is only good for 2 minutes
const RATE = Number(process.env.JOIN_RATE) || 60;           // requests per minute per IP
const MAX_BODY = 16 * 1024;
const MAX_CODES = 2000;
const KEEP_USED_MS = 30 * 24 * 3600e3;                      // used or expired codes are forgotten after 30 days
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.JOIN_TRUST_PROXY || '');   // behind a reverse proxy: use X-Forwarded-For

const isCode = s => /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(s);
const isClaim = s => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(s);
const EXE = path.resolve(process.env.JOIN_EXE || path.join(path.dirname(ZIP), 'AI-gile-Setup.exe'));
const CLAIM_DAYS = Number(process.env.JOIN_CLAIM_DAYS) || 7;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0 or 1: easy to read and type
const newClaim = () => { const c = [...crypto.randomBytes(8)].map(n => ALPHABET[n % 32]).join(''); return c.slice(0, 4) + '-' + c.slice(4); };
const isKey = s => /^[A-Za-z0-9_-]{43}$/.test(s);
const sha256 = d => crypto.createHash('sha256').update(d).digest('hex');
const fail = (msg, code) => Object.assign(new Error(msg), { code });
const FILE = path.join(DATA, 'codes.json');

fs.mkdirSync(DATA, { recursive: true });

/* ---------- storage: { "<code>": { created, exp, used?, help, dm?, from? } } ---------- */
let codes = {};
try { codes = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(codes), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
function sweep() {
  const old = Date.now() - KEEP_USED_MS;
  let changed = false;
  // a used site code is kept while a pass made from it lasts, so the owner can still see and revoke it
  for (const [c, v] of Object.entries(codes)) if ((v.used || v.exp) < old && !Object.values(passes).some(p => p.code === c)) { delete codes[c]; changed = true; }
  if (changed) save();
  let gone = false;
  for (const [h, p] of Object.entries(passes)) if (p.exp < Date.now()) { delete passes[h]; gone = true; }
  if (gone) savePasses();
  let cl = false;
  for (const [c, v] of Object.entries(claims)) {
    if ((v.used || v.exp) < old) { delete claims[c]; cl = true; }
    else if (v.dm && v.exp < Date.now()) { delete v.dm; cl = true; }   // a claim code that ran out drops the DM invite it held
  }
  if (cl) saveClaims();
}

/* ---------- claim codes (AIG-1231): { "<XXXX-XXXX>": { created, exp, used?, help, dm?, from? } } ---------- */
const CLAIMS = path.join(DATA, 'claims.json');
let claims = {};
try { claims = JSON.parse(fs.readFileSync(CLAIMS, 'utf8')); } catch {}
function saveClaims() {
  const tmp = CLAIMS + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(claims), { mode: 0o600 });
  fs.renameSync(tmp, CLAIMS);
}
const claimState = c => { const v = claims[c]; return !v ? 'unknown' : v.used ? 'used' : v.exp < Date.now() ? 'expired' : 'valid'; };

/* ---------- site passes (AIG-699): { "<sha256 of the cookie>": { code, created, exp } } ---------- */
const PASSES = path.join(DATA, 'passes.json');
const PASS_DAYS = Number(process.env.JOIN_PASS_DAYS) || 90;
const COOKIE = 'aigile_pass';
let passes = {};
try { passes = JSON.parse(fs.readFileSync(PASSES, 'utf8')); } catch {}
function savePasses() {
  const tmp = PASSES + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(passes), { mode: 0o600 });
  fs.renameSync(tmp, PASSES);
}
const cookieOf = req => { const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]{43})(?:;|$)')); return m ? m[1] : ''; };
function passOf(req) {
  const c = cookieOf(req), p = c && passes[sha256(c)];
  return p && p.exp > Date.now() ? p : null;
}
// valid / used / expired / unknown
const stateOf = code => { const v = codes[code]; return !v ? 'unknown' : v.used ? 'used' : v.exp < Date.now() ? 'expired' : 'valid'; };

/* ---------- rate limit and replay protection ---------- */
const hits = new Map();   // ip -> { start, n }
function limited(ip) {
  const t = Date.now(), h = hits.get(ip);
  if (!h || t - h.start > 60e3) { hits.set(ip, { start: t, n: 1 }); return false; }
  return ++h.n > RATE;
}
const nonces = new Map();   // nonce -> time seen
setInterval(() => {
  const t = Date.now();
  for (const [ip, h] of hits) if (t - h.start > 60e3) hits.delete(ip);
  for (const [n, at] of nonces) if (t - at > 2 * SKEW_MS) nonces.delete(n);
}, 30e3).unref();

// A request from the owner: the owner's key, valid signature, fresh timestamp, unused nonce.
function owner(req, pathname, body) {
  if (!isKey(OWNER_KEY)) throw fail('this server has no owner key set', 403);
  const h = n => String(req.headers[n] || '');
  const key = h('x-join-key'), ts = h('x-join-ts'), nonce = h('x-join-nonce'), sig = h('x-join-sig');
  if (!/^\d{13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^[A-Za-z0-9_-]{86}$/.test(sig) || !isKey(key)) throw fail('sign the request', 401);
  if (key !== OWNER_KEY) throw fail('not the owner', 403);
  if (Math.abs(Date.now() - Number(ts)) > SKEW_MS) throw fail('the request is too old (or the clock is wrong)', 401);
  let pub;
  try { pub = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key }, format: 'jwk' }); } catch { throw fail('bad key', 401); }
  const msg = ['aigile-join-v1', req.method, pathname, ts, nonce, sha256(body)].join('\n');
  if (!crypto.verify(null, Buffer.from(msg), pub, Buffer.from(sig, 'base64url'))) throw fail('bad signature', 401);
  if (nonces.has(nonce)) throw fail('that request was already used', 401);
  nonces.set(nonce, Date.now());
}

/* ---------- the zip, with invite.json added ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// Adds one stored (uncompressed) file to an existing zip without unpacking it: the new entry goes in front of the
// central directory, which is rewritten with one more row. Plain (not zip64) archives only.
function addToZip(zip, name, data) {
  let e = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) if (zip.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file');
  const total = zip.readUInt16LE(e + 10), cdSize = zip.readUInt32LE(e + 12), cdOff = zip.readUInt32LE(e + 16);
  if (total === 0xffff || cdOff === 0xffffffff) throw new Error('zip64 is not supported');
  const nm = Buffer.from(name, 'utf8'), crc = crc32(data);
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const local = Buffer.alloc(30 + nm.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
  local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nm.length, 26); local.writeUInt16LE(0, 28); nm.copy(local, 30);
  const cen = Buffer.alloc(46 + nm.length);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
  cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nm.length, 28); cen.writeUInt32LE(0o100644 << 16 >>> 0, 38); cen.writeUInt32LE(cdOff, 42); nm.copy(cen, 46);
  const end = Buffer.from(zip.subarray(e));
  end.writeUInt16LE(total + 1, 8); end.writeUInt16LE(total + 1, 10); end.writeUInt32LE(cdSize + cen.length, 12); end.writeUInt32LE(cdOff + local.length + data.length, 16);
  return Buffer.concat([zip.subarray(0, cdOff), local, data, zip.subarray(cdOff, e), cen, end]);
}

/* ---------- the page ---------- */
const TEXT = {
  en: { title: 'AI-gile: your invitation', h: "You're invited to AI-gile", p: 'A board where AI teams build your projects, and you just say GO and test what they make. This link works once, for you.',
    btn: 'Download AI-gile', steps: ['Download it.', 'Open it. Windows may warn you: click More info > Run anyway.', 'Type your code if it asks.'],
    note: 'This link works once. After you press Download you get a short code: keep it.',
    zipH: 'Not on Windows?', zipBtn: 'Download the zip instead', zipSteps: ['You need Node.js (LTS, from nodejs.org) and Claude Code, signed in.', 'Right-click the zip, choose Extract All.', 'Open the AI-gile folder and double-click start-aigile.bat.', 'Your board starts already linked to the person who invited you.'],
    zipNote: 'Once you press Download this link is used up. Keep the zip safe.',
    codeTitle: 'AI-gile: your code', codeH: 'Your code: {code}', codeP: 'Your download starts now. Write the code down: AI-gile may ask for it when it opens.', codeAgain: 'Download did not start?', codeBtn: 'Download AI-gile again', codeNote: 'The code works once and runs out in {days} days. Keep it to yourself.',
    used: 'This link has already been used.', expired: 'This link has run out.', unknown: 'This link is not valid.', ask: 'Ask the person who sent it for a new one.', down: 'The download is not ready yet. Try again later.',
    sTitle: 'AI-gile: test site', sH: "You're invited to the AI-gile test site", sP: 'An early look at what we are building. This link works once, for you, and lets this browser in for 90 days.', sBtn: 'Open the test site', sOk: 'This browser already has a pass.', sGo: 'Go to the test site' },
  nl: { title: 'AI-gile: je uitnodiging', h: 'Je bent uitgenodigd voor AI-gile', p: 'Een bord waar AI-teams je projecten bouwen, en jij zegt alleen GO en test wat ze maken. Deze link werkt één keer, voor jou.',
    btn: 'Download AI-gile', steps: ['Download het.', 'Open het. Windows kan je waarschuwen: klik op Meer informatie > Toch uitvoeren.', 'Typ je code als erom gevraagd wordt.'],
    note: 'Deze link werkt één keer. Na Download krijg je een korte code: bewaar die.',
    zipH: 'Geen Windows?', zipBtn: 'Download dan het zipbestand', zipSteps: ['Je hebt Node.js nodig (LTS, van nodejs.org) en Claude Code, ingelogd.', 'Klik met rechts op het zipbestand en kies Alles uitpakken.', 'Open de map AI-gile en dubbelklik op start-aigile.bat.', 'Je bord start al gekoppeld aan degene die je uitnodigde.'],
    zipNote: 'Zodra je op Download drukt, is deze link op. Bewaar het zipbestand goed.',
    codeTitle: 'AI-gile: je code', codeH: 'Je code: {code}', codeP: 'Je download begint nu. Schrijf de code op: AI-gile kan erom vragen als het opent.', codeAgain: 'Begint de download niet?', codeBtn: 'Download AI-gile opnieuw', codeNote: 'De code werkt één keer en verloopt na {days} dagen. Houd hem voor jezelf.',
    used: 'Deze link is al gebruikt.', expired: 'Deze link is verlopen.', unknown: 'Deze link klopt niet.', ask: 'Vraag degene die hem stuurde om een nieuwe.', down: 'De download is nog niet klaar. Probeer het later opnieuw.',
    sTitle: 'AI-gile: testsite', sH: 'Je bent uitgenodigd voor de AI-gile-testsite', sP: 'Een vroege blik op wat we bouwen. Deze link werkt één keer, voor jou, en laat deze browser 90 dagen binnen.', sBtn: 'Open de testsite', sOk: 'Deze browser heeft al een pas.', sGo: 'Naar de testsite' },
  'nl-BE': { title: 'AI-gile: je uitnodiging', h: 'Je bent uitgenodigd voor AI-gile', p: 'Een bord waar AI-teams je projecten bouwen, en jij zegt enkel GO en test wat ze maken. Deze link werkt één keer, voor jou.',
    btn: 'AI-gile downloaden', steps: ['Download het.', 'Open het. Windows kan een waarschuwing tonen: klik op Meer informatie > Toch uitvoeren.', 'Typ je code als het gevraagd wordt.'],
    note: 'Deze link werkt één keer. Na Downloaden krijg je een korte code: hou die goed bij.',
    zipH: 'Geen Windows?', zipBtn: 'Download dan het zipbestand', zipSteps: ['Je hebt Node.js nodig (LTS, van nodejs.org) en Claude Code, aangemeld.', 'Klik met rechts op het zipbestand en kies Alles uitpakken.', 'Open de map AI-gile en dubbelklik op start-aigile.bat.', 'Je bord start al gekoppeld aan wie je uitnodigde.'],
    zipNote: 'Zodra je op Downloaden drukt, is deze link op. Bewaar het zipbestand goed.',
    codeTitle: 'AI-gile: je code', codeH: 'Je code: {code}', codeP: 'Je download start nu. Schrijf de code op: AI-gile kan erom vragen als het opent.', codeAgain: 'Start de download niet?', codeBtn: 'AI-gile opnieuw downloaden', codeNote: 'De code werkt één keer en vervalt na {days} dagen. Hou hem voor jezelf.',
    used: 'Deze link is al gebruikt.', expired: 'Deze link is verlopen.', unknown: 'Deze link klopt niet.', ask: 'Vraag aan wie hem stuurde om een nieuwe.', down: 'De download is nog niet klaar. Probeer het later opnieuw.',
    sTitle: 'AI-gile: testsite', sH: 'Je bent uitgenodigd voor de AI-gile-testsite', sP: 'Een vroege blik op wat we bouwen. Deze link werkt één keer, voor jou, en laat deze browser 90 dagen binnen.', sBtn: 'Testsite openen', sOk: 'Deze browser heeft al een pas.', sGo: 'Naar de testsite' },
};
const langOf = (req, q) => {
  const want = String(q || req.headers['accept-language'] || '').toLowerCase();
  return /nl-be/.test(want) ? 'nl-BE' : /^nl|[, ]nl/.test(want) ? 'nl' : 'en';
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page(res, code, tx, body) {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(tx.title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1d2330;background:#f6f7f9}
button.dl{background:#3b6cf6;color:#fff;border:0;padding:12px 22px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer}li{margin:6px 0}.muted{color:#6b7385;font-size:14px}
button.alt{background:none;color:inherit;border:1px solid #9aa3b5;padding:8px 16px;border-radius:10px;font:inherit;cursor:pointer}ol.big{font-size:18px}h2{font-size:17px;margin-top:32px}
.code{display:inline-block;font:700 30px/1.3 ui-monospace,Consolas,monospace;letter-spacing:2px;background:#fff;border:2px dashed #3b6cf6;border-radius:12px;padding:4px 14px;user-select:all}
@media (prefers-color-scheme:dark){body{background:#12151b;color:#e6e9ef}.muted{color:#9aa3b5}.code{background:#1b2029}}</style>${body}`);
}
function joinPage(req, res, code, lang) {
  const tx = TEXT[lang], st = codes[code] && codes[code].kind === 'site' ? 'unknown' : stateOf(code);   // a site pass never downloads the app
  if (st !== 'valid') return page(res, st === 'unknown' ? 404 : 410, tx, `<h1>🗂️ AI-gile</h1><p>${esc(tx[st])}</p><p class="muted">${esc(tx.ask)}</p>`);
  const form = (what, cls, label) => `<form method="post" action="/join/download"><input type="hidden" name="code" value="${esc(code)}"><input type="hidden" name="lng" value="${esc(lang)}">${what ? `<input type="hidden" name="what" value="${what}">` : ''}<button class="${cls}" type="submit">${esc(label)}</button></form>`;
  const ol = (list, cls = '') => `<ol${cls ? ` class="${cls}"` : ''}>${list.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
  // AIG-1231: the Windows installer first, the zip (needs Node and an AI program) as the fallback; with no installer on the server, the zip as before.
  if (!fs.existsSync(EXE)) return page(res, 200, tx, `<h1>🗂️ ${esc(tx.h)}</h1><p>${esc(tx.p)}</p>
${form('', 'dl', '⬇ ' + tx.btn)}
<p class="muted">${esc(tx.zipNote)}</p>${ol(tx.zipSteps)}`);
  page(res, 200, tx, `<h1>🗂️ ${esc(tx.h)}</h1><p>${esc(tx.p)}</p>
${form('exe', 'dl', '⬇ ' + tx.btn)}
${ol(tx.steps, 'big')}<p class="muted">${esc(tx.note)}</p>
<h2>${esc(tx.zipH)}</h2>${form('zip', 'alt', tx.zipBtn)}${ol(tx.zipSteps, 'muted')}`);
}
// After Download (what=exe): the claim code, big, and the installer starting by itself (the page stays, so the code stays on screen).
function codePage(res, claim, lang) {
  const tx = TEXT[lang], file = `/join/exe?claim=${claim}`;
  page(res, 200, { ...tx, title: tx.codeTitle }, `<meta http-equiv="refresh" content="1;url=${file}">
<h1>🗂️ ${esc(tx.codeH.replace('{code}', ''))}<span class="code" id="claim">${esc(claim)}</span></h1><p>${esc(tx.codeP)}</p>
<ol class="big">${tx.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
<p>${esc(tx.codeAgain)} <a href="${file}">${esc(tx.codeBtn)}</a></p><p class="muted">${esc(tx.codeNote.replace('{days}', CLAIM_DAYS))}</p>`);
}

// The site pass page (AIG-699). A browser that already has a pass just gets a link to the site; the code stays unused.
function sitePage(req, res, code, lang) {
  const tx = TEXT[lang], st = codes[code] && codes[code].kind === 'site' ? stateOf(code) : 'unknown', t2 = { ...tx, title: tx.sTitle };
  if (passOf(req)) return page(res, 200, t2, `<h1>🗂️ AI-gile</h1><p>${esc(tx.sOk)}</p><p><a href="/">${esc(tx.sGo)}</a></p>`);
  if (st !== 'valid') return page(res, st === 'unknown' ? 404 : 410, t2, `<h1>🗂️ AI-gile</h1><p>${esc(tx[st])}</p><p class="muted">${esc(tx.ask)}</p>`);
  page(res, 200, t2, `<h1>🗂️ ${esc(tx.sH)}</h1><p>${esc(tx.sP)}</p>
<form method="post" action="/join/site"><input type="hidden" name="code" value="${esc(code)}"><input type="hidden" name="lng" value="${esc(lang)}"><button class="dl" type="submit">${esc(tx.sBtn)}</button></form>`);
}
const passCookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

/* ---------- http ---------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let n = 0;
    req.on('data', d => { n += d.length; if (n > MAX_BODY) { reject(fail('too big', 413)); req.pause(); return; } parts.push(d); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

let zipCache = null;   // { mtime, buf }
function zipFile() {
  let st; try { st = fs.statSync(ZIP); } catch { return null; }
  if (!zipCache || zipCache.mtime !== st.mtimeMs) zipCache = { mtime: st.mtimeMs, buf: fs.readFileSync(ZIP) };
  return zipCache.buf;
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://join');
  const { pathname } = url;
  // nginx asks this for every file of a private site (AIG-699), so it is not rate limited: it only reads a hash.
  if (req.method === 'GET' && pathname === '/join/site/check') { res.writeHead(passOf(req) ? 204 : 401, { 'Cache-Control': 'no-store' }); return res.end(); }
  const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
  if (limited(ip)) throw fail('slow down', 429);
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/join/health')) return send(res, 200, { ok: true });

  if (req.method === 'GET' && pathname === '/join') {
    const code = String(url.searchParams.get('code') || '').toUpperCase().trim();
    return joinPage(req, res, isCode(code) ? code : '', langOf(req, url.searchParams.get('lng')));
  }
  // The Download button: the code is used up as the download starts, so a link can only ever give out one zip.
  if (req.method === 'POST' && pathname === '/join/download') {
    const form = new URLSearchParams(await readBody(req));
    const code = String(form.get('code') || '').toUpperCase().trim(), lang = langOf(req, form.get('lng'));
    if (!isCode(code) || stateOf(code) !== 'valid' || codes[code].kind === 'site') return joinPage(req, res, isCode(code) ? code : '', lang);
    // AIG-1231: the installer. The link is used up now and its invite moves to a claim code, which the installed app fetches once.
    if (form.get('what') === 'exe') {
      if (!fs.existsSync(EXE)) return page(res, 503, TEXT[lang], `<h1>🗂️ AI-gile</h1><p>${esc(TEXT[lang].down)}</p>`);
      const v = codes[code];
      let claim; do claim = newClaim(); while (claims[claim]);
      claims[claim] = { created: Date.now(), exp: Date.now() + CLAIM_DAYS * 24 * 3600e3, help: v.help, dm: v.dm || '', from: v.from || '' };
      saveClaims();
      v.used = Date.now(); delete v.dm;
      save();
      return codePage(res, claim, lang);
    }
    const zip = zipFile();
    if (!zip) return page(res, 503, TEXT[lang], `<h1>🗂️ AI-gile</h1><p>${esc(TEXT[lang].down)}</p>`);
    const v = codes[code];
    let out;
    try { out = addToZip(zip, 'AI-gile/invite.json', Buffer.from(JSON.stringify({ v: 1, help: v.help, dm: v.dm || '', from: v.from || '' }, null, 2) + '\n')); }
    catch { return page(res, 503, TEXT[lang], `<h1>🗂️ AI-gile</h1><p>${esc(TEXT[lang].down)}</p>`); }
    v.used = Date.now(); delete v.dm;   // used up; the DM invite it carried is not kept
    save();
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': out.length, 'Content-Disposition': `attachment; filename="${path.basename(ZIP).replace(/[^\w.\-]/g, '_')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(out);
  }
  // The installer (AIG-1231), named after the claim code so the app can read it from the file name. The file itself holds no
  // invite, so it can be fetched again while the claim code lasts (a download that broke off), but only with a live claim code.
  if (req.method === 'GET' && pathname === '/join/exe') {
    const claim = String(url.searchParams.get('claim') || '').toUpperCase().trim(), lang = langOf(req, url.searchParams.get('lng'));
    const st = isClaim(claim) ? claimState(claim) : 'unknown';
    if (st === 'unknown' || st === 'expired') return page(res, st === 'unknown' ? 404 : 410, TEXT[lang], `<h1>🗂️ AI-gile</h1><p>${esc(TEXT[lang][st])}</p><p class="muted">${esc(TEXT[lang].ask)}</p>`);
    let size; try { size = fs.statSync(EXE).size; } catch { return page(res, 503, TEXT[lang], `<h1>🗂️ AI-gile</h1><p>${esc(TEXT[lang].down)}</p>`); }
    res.writeHead(200, { 'Content-Type': 'application/vnd.microsoft.portable-executable', 'Content-Length': size, 'Content-Disposition': `attachment; filename="AI-gile Setup (${claim}).exe"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return fs.createReadStream(EXE).pipe(res);
  }
  // The installed app fetches its invite: { code } -> { v, help, dm, from }, once. Used, run out or unknown: refused.
  if (req.method === 'POST' && pathname === '/join/claim') {
    let b; try { b = JSON.parse(await readBody(req)); } catch { throw fail('send JSON', 400); }
    const claim = String(b && b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');
    if (!isClaim(claim)) throw fail('that code is not valid', 400);
    const st = claimState(claim);
    if (st === 'unknown') throw fail('that code is not valid', 404);
    if (st !== 'valid') throw fail(st === 'used' ? 'that code was already used' : 'that code has run out', 410);
    const v = claims[claim], out = { v: 1, help: v.help, dm: v.dm || '', from: v.from || '' };
    v.used = Date.now(); delete v.dm;   // used up; the DM invite it carried is not kept
    saveClaims();
    return send(res, 200, out);
  }
  // Site passes (AIG-699): the page, the Open button (uses the code up, sets the cookie), and sign out.
  if (req.method === 'GET' && pathname === '/join/site') {
    const code = String(url.searchParams.get('code') || '').toUpperCase().trim();
    return sitePage(req, res, isCode(code) ? code : '', langOf(req, url.searchParams.get('lng')));
  }
  if (req.method === 'POST' && pathname === '/join/site') {
    const form = new URLSearchParams(await readBody(req));
    const code = String(form.get('code') || '').toUpperCase().trim(), lang = langOf(req, form.get('lng'));
    if (!isCode(code) || !codes[code] || codes[code].kind !== 'site' || stateOf(code) !== 'valid' || passOf(req)) return sitePage(req, res, isCode(code) ? code : '', lang);
    const token = crypto.randomBytes(32).toString('base64url'), exp = Date.now() + PASS_DAYS * 24 * 3600e3;
    codes[code].used = Date.now(); save();
    passes[sha256(token)] = { code, created: Date.now(), exp }; savePasses();
    res.writeHead(303, { Location: '/', 'Set-Cookie': passCookie(token, PASS_DAYS * 24 * 3600), 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method === 'POST' && pathname === '/join/site/out') {
    const c = cookieOf(req); if (c && passes[sha256(c)]) { delete passes[sha256(c)]; savePasses(); }
    res.writeHead(303, { Location: '/', 'Set-Cookie': passCookie('', 0), 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method === 'POST' && pathname === '/join/site/revoke') {
    const body = await readBody(req);
    owner(req, pathname, body);
    let b; try { b = JSON.parse(body); } catch { throw fail('send JSON', 400); }
    const code = String(b && b.code || '');
    if (!isCode(code)) throw fail('send { code }', 400);
    let n = 0; for (const [h, p] of Object.entries(passes)) if (p.code === code) { delete passes[h]; n++; }
    if (codes[code] && !codes[code].used) codes[code].used = Date.now();   // an unused link stops working too
    save(); savePasses();
    return send(res, 200, { ok: true, ended: n });
  }
  // The owner adds a code: an app download { code, help, dm?, from?, days? } or a site pass (AIG-699) { code, kind: 'site', from?, days? }.
  if (req.method === 'POST' && pathname === '/join/codes') {
    const body = await readBody(req);
    owner(req, pathname, body);
    let b; try { b = JSON.parse(body); } catch { throw fail('send JSON', 400); }
    const site = b && b.kind === 'site';
    if (!b || !isCode(String(b.code)) || (!site && !['1', '2', '3'].includes(String(b.help)))) throw fail('send { code, help: 1, 2 or 3 } or { code, kind: "site" }', 400);
    if (codes[b.code]) throw fail('that code exists already', 409);
    if (Object.keys(codes).length >= MAX_CODES) throw fail('too many codes', 507);
    const days = Math.min(30, Math.max(0.00001, Number(b.days) || DAYS));
    codes[b.code] = site ? { created: Date.now(), exp: Date.now() + days * 24 * 3600e3, kind: 'site' }
      : { created: Date.now(), exp: Date.now() + days * 24 * 3600e3, help: String(b.help), dm: String(b.dm || '').slice(0, 4000), from: String(b.from || '').replace(/[\u0000-\u001f]/g, '').slice(0, 40) };
    save();
    return send(res, 201, { ok: true, exp: codes[b.code].exp });
  }
  if (req.method === 'GET' && pathname === '/join/codes') {
    owner(req, pathname, '');
    const live = code => Object.values(passes).filter(p => p.code === code && p.exp > Date.now()).length;
    return send(res, 200, { codes: Object.entries(codes).map(([code, v]) => ({ code, created: v.created, exp: v.exp, used: v.used || null, help: v.help, ...(v.kind === 'site' ? { kind: 'site', passes: live(code) } : {}) })) });
  }
  throw fail('not found', 404);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    const known = typeof e.code === 'number';   // our own errors; anything else is not described (no paths leak)
    if (e.code === 413) res.setHeader('Connection', 'close');
    send(res, known ? e.code : 500, { error: known ? e.message : 'join error' });
  });
});
server.requestTimeout = 60e3;
sweep();
setInterval(sweep, 3600e3).unref();
server.listen(PORT, HOST, () => console.log(`AI-gile join service on ${HOST}:${PORT}, data in ${DATA}`));
