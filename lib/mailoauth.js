// ✉️ Mail, card 7 (AIG-909, docs/MAIL-PLAN.md): Outlook.com / Hotmail / Microsoft 365 sign-in. Password logins are gone there,
// so the board signs in with OAuth device code: Setup shows a short code and Microsoft's sign-in page, you sign in there (on any
// device), and the board polls until Microsoft hands over a refresh token. IMAP and SMTP then log in with XOAUTH2.
// - Client ID: your own free app registration in Microsoft Entra ("Allow public client flows" on, no secret). Kept on the mailbox.
// - The refresh token: secrets.keep('mailms:<id>') (same encryption as a mailbox password; never to the page, never logged).
//   Access tokens live in memory only (about an hour each). Remove mailbox, Sign out, or a new client ID or address deletes it.
// - The token only goes to Microsoft: a Microsoft mailbox's IMAP and SMTP servers are fixed (HOSTS), whatever the form says.
// Google sign-in (card 8, AIG-910) is the same shape, but Google's device flow refuses the Gmail scope, so it is the installed-app
// loopback flow with PKCE: Setup shows a link to Google, Google sends the browser back to this board's /api/mail/google/callback,
// and the board swaps the code for tokens. The user's own Desktop-app OAuth client (id + secret); the secret is kept like a password
// (secrets.keep('mailgooglesecret:<id>')), the refresh token as secrets.keep('mailgoogle:<id>'). Servers fixed to Gmail's own.
// Tests: AIGILE_MAIL_GOOGLE_TEST=1 keeps form hosts and a gAuthority (the QA fake Google). AIGILE_MAIL_MS_TEST=1 lets a Microsoft mailbox keep its own servers and an msAuthority (the QA fake token server).
const crypto = require('node:crypto');
const { bad, PORT } = require('./store');
const secrets = require('./secrets');

const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const SCOPE = 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access';
const HOSTS = { host: 'outlook.office365.com', port: 993, smtpHost: 'smtp.office365.com', smtpPort: 587 };
const CLIENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const testing = () => process.env.AIGILE_MAIL_MS_TEST === '1';
const key = id => 'mailms:' + id;
const authority = box => (testing() && box.msAuthority) || AUTHORITY;
const msErr = j => String((j && (j.error_description || j.error)) || 'Microsoft did not answer').split(/\r?\n/)[0].slice(0, 200);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(box, what, form) {
  let r;
  try { r = await fetch(authority(box) + '/' + what, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('could not reach Microsoft\'s sign-in server'); }
  try { return await r.json(); } catch { return {}; }
}

// The form's servers, swapped for Microsoft's own (tests keep theirs).
const fixed = b => testing() ? { ...b, host: b.host || HOSTS.host, port: b.port || HOSTS.port, smtpHost: b.smtpHost || HOSTS.smtpHost, smtpPort: b.smtpPort || HOSTS.smtpPort } : { ...b, ...HOSTS };
const checkClient = id => { if (!CLIENT.test(String(id || ''))) throw bad('paste the Application (client) ID of your Microsoft app, like 1234abcd-…'); };

/* ---------- device code sign-in ---------- */
// One sign-in at a time per mailbox; starting again drops the old one. The page polls status().
const flows = {};
async function start(box) {
  if (box.auth !== 'microsoft') throw bad('this mailbox signs in with a password');
  checkClient(box.msClient);
  const j = await post(box, 'devicecode', { client_id: box.msClient, scope: SCOPE });
  if (!j.device_code || !j.user_code) throw bad('Microsoft said: ' + msErr(j));
  const f = { state: 'waiting', code: String(j.user_code).slice(0, 20), url: /^https:\/\//.test(j.verification_uri) ? j.verification_uri : 'https://microsoft.com/devicelogin',
    until: Date.now() + (Number(j.expires_in) || 900) * 1000, error: '' };
  flows[box.id] = f;
  poll(box, f, j.device_code, Math.max(1, Number(j.interval) || 5));
  return status(box.id);
}
async function poll(box, f, device, wait) {
  while (flows[box.id] === f && Date.now() < f.until) {
    await sleep(wait * 1000);
    if (flows[box.id] !== f) return;
    let j; try { j = await post(box, 'token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: box.msClient, device_code: device }); } catch { continue; }
    if (j.access_token && j.refresh_token) {
      secrets.keep(key(box.id), j.refresh_token); remember(box.id, j);
      f.state = 'done'; return;
    }
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { wait += 5; continue; }
    f.state = 'error'; f.error = j.error === 'expired_token' ? 'the code ran out: press Sign in again' : j.error === 'authorization_declined' ? 'you said no on Microsoft\'s page' : msErr(j);
    return;
  }
  if (flows[box.id] === f && f.state === 'waiting') { f.state = 'error'; f.error = 'the code ran out: press Sign in again'; }
}
function status(id) {
  const f = flows[id];
  return { signedIn: secrets.hasKept(key(id)), state: f ? f.state : 'none', code: f && f.state === 'waiting' ? f.code : '', url: f ? f.url : '', error: f ? f.error : '' };
}

/* ---------- access tokens ---------- */
const cache = {}, busy = {};
function remember(id, j) { cache[id] = { token: j.access_token, until: Date.now() + Math.max(testing() || gtesting() ? 0 : 60, (Number(j.expires_in) || 3600) - 120) * 1000 }; }
async function token(box) {
  const c = cache[box.id]; if (c && c.until > Date.now()) return c.token;
  return busy[box.id] = busy[box.id] || (async () => {
    const rt = secrets.kept(key(box.id));
    if (!rt) throw new Error('not signed in to Microsoft: press Sign in with Microsoft in Setup > Mail');
    const j = await post(box, 'token', { grant_type: 'refresh_token', client_id: box.msClient, refresh_token: rt, scope: SCOPE });
    if (!j.access_token) throw new Error(j.error === 'invalid_grant' ? 'the Microsoft sign-in has run out: press Sign in with Microsoft in Setup > Mail' : 'Microsoft said: ' + msErr(j));
    if (j.refresh_token && j.refresh_token !== rt) secrets.keep(key(box.id), j.refresh_token);
    remember(box.id, j); return j.access_token;
  })().finally(() => { delete busy[box.id]; });
}
function forget(id, all) { secrets.keep(key(id), null); secrets.keep(gkey(id), null); if (all) secrets.keep(gsecret(id), null); delete cache[id]; delete flows[id]; delete gflows[id]; }

// SASL XOAUTH2, for IMAP AUTHENTICATE and SMTP AUTH.
const xoauth2 = (user, tok) => Buffer.from('user=' + user + '\x01auth=Bearer ' + tok + '\x01\x01', 'utf8').toString('base64');

/* ---------- Google (AIG-910): loopback + PKCE ---------- */
const GHOSTS = { host: 'imap.gmail.com', port: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465 };
const GSCOPE = 'https://mail.google.com/';
const GCLIENT = /^[a-z0-9][a-z0-9._-]{5,120}\.apps\.googleusercontent\.com$/i;
const gtesting = () => process.env.AIGILE_MAIL_GOOGLE_TEST === '1';
const gkey = id => 'mailgoogle:' + id, gsecret = id => 'mailgooglesecret:' + id;
const gurl = (box, what) => { const a = gtesting() && box.gAuthority; return a ? a + '/' + what : what === 'auth' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://oauth2.googleapis.com/token'; };
const gErr = j => String((j && (j.error_description || j.error)) || 'Google did not answer').split(/\r?\n/)[0].slice(0, 200);
const gfixed = b => gtesting() ? { ...b, host: b.host || GHOSTS.host, port: b.port || GHOSTS.port, smtpHost: b.smtpHost || GHOSTS.smtpHost, smtpPort: b.smtpPort || GHOSTS.smtpPort } : { ...b, ...GHOSTS };
const checkGoogleClient = id => { if (!GCLIENT.test(String(id || ''))) throw bad('paste the Client ID of your Google app, like 1234-abcd.apps.googleusercontent.com'); };
const redirect = () => 'http://127.0.0.1:' + PORT + '/api/mail/google/callback';
const b64u = b => Buffer.from(b).toString('base64url');
const gflows = {};

async function gpost(box, form) {
  let r;
  try { r = await fetch(gurl(box, 'token'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('could not reach Google\'s sign-in server'); }
  try { return await r.json(); } catch { return {}; }
}
// Start: remember a random state and PKCE verifier for this mailbox, hand back the Google link for the page to open.
function googleStart(box) {
  if (box.auth !== 'google') throw bad('this mailbox does not sign in with Google');
  checkGoogleClient(box.gClient);
  if (!secrets.hasKept(gsecret(box.id))) throw bad('paste the Client secret of your Google app');
  const state = b64u(crypto.randomBytes(18)), verifier = b64u(crypto.randomBytes(40));
  const q = new URLSearchParams({ client_id: box.gClient, redirect_uri: redirect(), response_type: 'code', scope: GSCOPE, access_type: 'offline', prompt: 'consent', state,
    code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', login_hint: String(box.address || '') });
  gflows[box.id] = { state: 'waiting', st: state, verifier, box: { id: box.id, gClient: box.gClient, gAuthority: box.gAuthority }, until: Date.now() + 10 * 60 * 1000, error: '', url: gurl(box, 'auth') + '?' + q };
  return googleStatus(box.id);
}
function googleStatus(id) {
  const f = gflows[id];
  if (f && f.state === 'waiting' && Date.now() > f.until) { f.state = 'error'; f.error = 'the sign-in took too long: press Sign in again'; }
  return { signedIn: secrets.hasKept(gkey(id)), state: f ? f.state : 'none', code: '', url: f && f.state === 'waiting' ? f.url : '', error: f ? f.error : '' };
}
// Google sends the browser here. The state must match a waiting sign-in, once; the answer is a small page to close.
async function googleCallback(q) {
  const st = String(q.get('state') || ''), id = Object.keys(gflows).find(k => gflows[k].state === 'waiting' && st && gflows[k].st === st);
  const page = (ok, msg) => ({ __html: '<!doctype html><meta charset="utf-8"><title>AI-gile</title><body style="font:16px system-ui;max-width:32em;margin:15vh auto;padding:0 1em"><h2>' + (ok ? 'Signed in to Google' : 'Google sign-in did not work') + '</h2><p>' + String(msg).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';') + '</p></body>' });
  if (!id) return page(false, 'This sign-in is not waiting any more (or did not start here). Go back to AI-gile Setup > Mail and press Sign in with Google again.');
  const f = gflows[id]; f.st = '';
  try {
    if (Date.now() > f.until) throw new Error('the sign-in took too long: press Sign in again');
    if (q.get('error')) throw new Error(q.get('error') === 'access_denied' ? 'you said no on Google\'s page' : 'Google said: ' + String(q.get('error')).slice(0, 100));
    const code = String(q.get('code') || ''); if (!code) throw new Error('Google sent no code');
    const j = await gpost(f.box, { grant_type: 'authorization_code', code, client_id: f.box.gClient, client_secret: secrets.kept(gsecret(id)) || '', redirect_uri: redirect(), code_verifier: f.verifier });
    if (!j.access_token) throw new Error('Google said: ' + gErr(j));
    if (!j.refresh_token) throw new Error('Google gave no refresh token: remove this app at myaccount.google.com/permissions, then sign in again');
    secrets.keep(gkey(id), j.refresh_token); remember(id, j);
    f.state = 'done'; f.verifier = '';
    return page(true, 'You can close this tab and go back to AI-gile.');
  } catch (e) { f.state = 'error'; f.error = e.message; f.verifier = ''; return page(false, e.message); }
}
async function googleToken(box) {
  const c = cache[box.id]; if (c && c.until > Date.now()) return c.token;
  return busy[box.id] = busy[box.id] || (async () => {
    const rt = secrets.kept(gkey(box.id));
    if (!rt) throw new Error('not signed in to Google: press Sign in with Google in Setup > Mail');
    const j = await gpost(box, { grant_type: 'refresh_token', client_id: box.gClient, client_secret: secrets.kept(gsecret(box.id)) || '', refresh_token: rt });
    if (!j.access_token) throw new Error(j.error === 'invalid_grant' ? 'the Google sign-in has run out: press Sign in with Google in Setup > Mail' : 'Google said: ' + gErr(j));
    if (j.refresh_token && j.refresh_token !== rt) secrets.keep(gkey(box.id), j.refresh_token);
    remember(box.id, j); return j.access_token;
  })().finally(() => { delete busy[box.id]; });
}
const anyToken = box => box.auth === 'google' ? googleToken(box) : token(box);

module.exports = { start, status, token: anyToken, forget, fixed, checkClient, xoauth2, signedIn: id => secrets.hasKept(key(id)) || secrets.hasKept(gkey(id)),
  googleStart, googleStatus, googleCallback, checkGoogleClient, gfixed, setGoogleSecret: (id, v) => secrets.keep(gsecret(id), v), hasGoogleSecret: id => secrets.hasKept(gsecret(id)) };
