// ✉️ Mail, card 7 (AIG-909, docs/MAIL-PLAN.md): Outlook.com / Hotmail / Microsoft 365 sign-in. Password logins are gone there,
// so the board signs in with OAuth device code: Setup shows a short code and Microsoft's sign-in page, you sign in there (on any
// device), and the board polls until Microsoft hands over a refresh token. IMAP and SMTP then log in with XOAUTH2.
// - Client ID: your own free app registration in Microsoft Entra ("Allow public client flows" on, no secret). Kept on the mailbox.
// - The refresh token: secrets.keep('mailms:<id>') (same encryption as a mailbox password; never to the page, never logged).
//   Access tokens live in memory only (about an hour each). Remove mailbox, Sign out, or a new client ID or address deletes it.
// - The token only goes to Microsoft: a Microsoft mailbox's IMAP and SMTP servers are fixed (HOSTS), whatever the form says.
// Tests: AIGILE_MAIL_MS_TEST=1 lets a Microsoft mailbox keep its own servers and an msAuthority (the QA fake token server).
const { bad } = require('./store');
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
function remember(id, j) { cache[id] = { token: j.access_token, until: Date.now() + Math.max(testing() ? 0 : 60, (Number(j.expires_in) || 3600) - 120) * 1000 }; }
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
function forget(id) { secrets.keep(key(id), null); delete cache[id]; delete flows[id]; }

// SASL XOAUTH2, for IMAP AUTHENTICATE and SMTP AUTH.
const xoauth2 = (user, tok) => Buffer.from('user=' + user + '\x01auth=Bearer ' + tok + '\x01\x01', 'utf8').toString('base64');

module.exports = { start, status, token, forget, fixed, checkClient, xoauth2, signedIn: id => secrets.hasKept(key(id)) };
