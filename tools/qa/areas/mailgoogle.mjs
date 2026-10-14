// QA area: mailgoogle (AIG-910). Mail card 8: Gmail sign-in. A mailbox set to "Sign in with: Google" has the user's own client ID and
// secret and no password; Sign in with Google gives a link, Google sends the browser back to the board's loopback callback (state
// checked, PKCE), the board keeps the refresh token encrypted, and IMAP / SMTP log in with XOAUTH2. No real Google: a fake auth + token
// server, a fake IMAP server and a fake SMTP server run inside this QA process (AIGILE_MAIL_GOOGLE_TEST=1 points the mailbox at them).
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { check, def, tmp, freePort, openPage, noErrors } from '../lib.mjs';

const SECDIR = tmp('mailgooglesec');
const USER = 'rich@gmail.test';
const CLIENT = '123456789-abcdefgh.apps.googleusercontent.com';
const SECRET = 'GOCSPX-sekrit-value';
const listen = (srv, port) => new Promise(r => srv.listen(port, '127.0.0.1', r));

// Google's /auth (redirects back with a code, as the browser would) and /token.
function fakeGoogle() {
  const seen = { calls: [], auths: [] }, mode = { refresh: 'ok', n: 0, noRefreshToken: false }, codes = {};
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET' && u.pathname === '/auth') {
      const q = Object.fromEntries(u.searchParams); seen.auths.push(q);
      if (q.client_id !== CLIENT) { res.writeHead(400); return res.end('bad client'); }
      const code = 'CODE-' + crypto.randomBytes(4).toString('hex'); codes[code] = q;
      res.writeHead(302, { Location: q.redirect_uri + '?code=' + code + '&state=' + encodeURIComponent(q.state) }); return res.end();
    }
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      const f = Object.fromEntries(new URLSearchParams(body)); seen.calls.push({ path: u.pathname, ...f });
      const out = j => { res.writeHead(j.error ? 400 : 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
      if (f.client_id !== CLIENT || f.client_secret !== SECRET) return out({ error: 'invalid_client', error_description: 'The OAuth client was not found.' });
      if (f.grant_type === 'authorization_code') {
        const a = codes[f.code]; delete codes[f.code];
        if (!a) return out({ error: 'invalid_grant', error_description: 'Bad Request' });
        const challenge = crypto.createHash('sha256').update(String(f.code_verifier || '')).digest('base64url');
        if (challenge !== a.code_challenge || f.redirect_uri !== a.redirect_uri) return out({ error: 'invalid_grant', error_description: 'Bad Request (PKCE)' });
        const n = ++mode.n; return out(mode.noRefreshToken ? { access_token: 'AT-' + n, expires_in: 1 } : { access_token: 'AT-' + n, refresh_token: 'RT-' + n, expires_in: 1 });
      }
      if (f.grant_type === 'refresh_token') {
        if (mode.refresh === 'gone') return out({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
        return out({ access_token: mode.refresh === 'badtoken' ? 'WRONG' : 'AT-' + (++mode.n), expires_in: 1 });   // Google does not send a new refresh token
      }
      out({ error: 'unsupported_grant_type' });
    });
  });
  return { srv, seen, mode };
}
function fakeImap() {
  const seen = { lines: [] };
  const srv = net.createServer(sock => {
    let buf = '', pend = null;
    sock.write('* OK fake Gmail IMAP\r\n');
    sock.on('data', d => {
      buf += d.toString('utf8'); let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2); seen.lines.push(line);
        if (pend) { sock.write(`${pend} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`); pend = null; continue; }
        const [tag, cmd, a2, a3] = line.split(' ');
        if (/^AUTHENTICATE$/i.test(cmd) && a2 === 'XOAUTH2') {
          const s = Buffer.from(a3 || '', 'base64').toString('utf8');
          if (/^user=rich@gmail\.test\x01auth=Bearer AT-\d+\x01\x01$/.test(s)) sock.write(`${tag} OK rich@gmail.test authenticated (Success)\r\n`);
          else { pend = tag; sock.write('+ ' + Buffer.from('{"status":"400","schemes":"Bearer","scope":"https://mail.google.com/"}').toString('base64') + '\r\n'); }
        } else if (/^LOGIN$/i.test(cmd)) sock.write(`${tag} NO LOGIN failed.\r\n`);
        else if (/^SELECT$/i.test(cmd)) sock.write(`* 1 EXISTS\r\n* OK [UIDVALIDITY 9] ok\r\n${tag} OK [READ-WRITE] done\r\n`);
        else if (/^UID$/i.test(cmd) && /^SEARCH$/i.test(a2)) sock.write(`* SEARCH 7\r\n${tag} OK done\r\n`);
        else if (/^UID$/i.test(cmd) && /^FETCH$/i.test(a2)) sock.write(`* 1 FETCH (UID 7 FLAGS () INTERNALDATE "14-Oct-2026 05:00:00 +0000" ENVELOPE ("${new Date().toUTCString()}" "Hello from Gmail" (("Mo" NIL "mo" "example.org")) NIL NIL NIL NIL NIL NIL "<7@x>"))\r\n${tag} OK done\r\n`);
        else if (/^LOGOUT$/i.test(cmd)) { sock.write(`* BYE\r\n${tag} OK\r\n`); sock.end(); }
        else sock.write(`${tag} BAD what\r\n`);
      }
    });
    sock.on('error', () => {});
  });
  return { srv, seen };
}
function fakeSmtp() {
  const seen = { lines: [], datas: 0 };
  const srv = net.createServer(sock => {
    let buf = '', inData = false;
    sock.write('220 fake Gmail SMTP\r\n');
    sock.on('data', d => {
      buf += d.toString('latin1');
      if (inData) { const e = buf.indexOf('\r\n.\r\n'); if (e < 0) return; seen.datas++; buf = buf.slice(e + 5); inData = false; sock.write('250 queued\r\n'); }
      let i; while ((i = buf.indexOf('\r\n')) >= 0 && !inData) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2); seen.lines.push(l);
        if (/^EHLO/i.test(l)) sock.write('250-fake\r\n250 AUTH LOGIN PLAIN XOAUTH2\r\n');
        else if (/^AUTH XOAUTH2 /i.test(l)) sock.write(/auth=Bearer AT-\d+\x01/.test(Buffer.from(l.slice(13), 'base64').toString('utf8')) ? '235 2.7.0 Accepted\r\n' : '334 eyJzdGF0dXMiOiI0MDAifQ==\r\n');
        else if (l === '') sock.write('535 5.7.8 Username and Password not accepted\r\n');
        else if (/^(MAIL|RCPT)/i.test(l)) sock.write('250 ok\r\n');
        else if (/^DATA/i.test(l)) { inData = true; sock.write('354 go\r\n'); }
        else if (/^QUIT/i.test(l)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('500 what\r\n');
      }
    });
    sock.on('error', () => {});
  });
  return { srv, seen };
}

def('mailgoogle', 'Mail card 8: Gmail sign-in with the user\'s own Google client (loopback + PKCE); IMAP and SMTP over XOAUTH2; token and secret kept encrypted, fixed to Gmail (AIG-910)', async (s, ctx) => {
  const g = fakeGoogle(), imap = fakeImap(), smtp = fakeSmtp();
  const [gport, iport, sport] = [await freePort(), await freePort(), await freePort()];
  await listen(g.srv, gport); await listen(imap.srv, iport); await listen(smtp.srv, sport);
  try {
    const oauth = createRequire(import.meta.url)('../../../lib/mailoauth.js');
    const fx = oauth.gfixed({ host: 'evil.example', port: 1, smtpHost: 'evil.example', smtpPort: 2 });
    check('a Google mailbox always uses imap.gmail.com:993 and smtp.gmail.com:465', fx.host === 'imap.gmail.com' && fx.port === 993 && fx.smtpHost === 'smtp.gmail.com' && fx.smtpPort === 465, fx);

    const { token } = await s.ok('GET', '/api/secrets/token');
    const box = { name: 'Gmail', address: USER, auth: 'google', gClient: CLIENT, gSecret: SECRET, gAuthority: `http://127.0.0.1:${gport}`, host: '127.0.0.1', port: iport, smtpHost: '127.0.0.1', smtpPort: sport, token };
    check('a Google mailbox needs a real client ID and a client secret', (await s.api('POST', '/api/mail/config', { ...box, gClient: 'nope' })).status === 400 && (await s.api('POST', '/api/mail/config', { ...box, gSecret: '' })).status === 400);
    const saved = await s.ok('POST', '/api/mail/config', box), b = saved.boxes[0];
    check('saved with no password: auth google, secret kept but never listed, not signed in yet', b.auth === 'google' && b.gClient === CLIENT && b.gHasSecret === true && b.gSignedIn === false && b.hasPassword === false && !JSON.stringify(saved).includes(SECRET), b);
    const before = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('before signing in the inbox says to sign in, and nothing reaches the mail server', /Sign in with Google/.test(before.error) && imap.seen.lines.length === 0, before);
    check('sign-in start needs the page token', (await s.api('POST', '/api/mail/google/start', { box: b.id })).status === 403
      && (await fetch(s.base + '/api/mail/google/start', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'terminal' }, body: JSON.stringify({ box: b.id, token }) })).status === 403);
    const wrong = await fetch(s.base + '/api/mail/google/callback?code=CODE-x&state=nope');
    check('a callback with no matching sign-in is refused and keeps nothing', /not waiting/.test(await wrong.text()) && !g.seen.calls.length);

    // Setup with real clicks
    const page = await openPage(ctx, '#/');
    await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#mailAuth');
    await page.evaluate(() => { window.__mailMsPollMs = 300; });
    check('Setup shows Sign in with: Google, the client ID, help lines, and hides the servers and password', await page.inputValue('#mailAuth') === 'google' && await page.inputValue('#mailGClient') === CLIENT
      && await page.inputValue('#mailGSecret') === '' && !(await page.isVisible('#mailPass')) && !(await page.isVisible('#mailHost')) && (await page.textContent('#mailGHelp')).length > 80);
    check('it says not signed in yet', /Not signed in/.test(await page.textContent('#mailGState')));
    await page.click('#mailGSignIn');
    await page.waitForSelector('#mailGLink');
    const href = await page.getAttribute('#mailGLink', 'href'), u = new URL(href);
    if (process.env.QA_SHOTS) await page.locator('#mailBox').screenshot({ path: path.join(process.env.QA_SHOTS, 'mailgoogle-link.png') });
    check('the Google link carries PKCE, offline access, consent prompt, the Gmail scope, a state and the loopback redirect', u.origin === `http://127.0.0.1:${gport}` && u.searchParams.get('code_challenge_method') === 'S256' && (u.searchParams.get('code_challenge') || '').length >= 40
      && u.searchParams.get('access_type') === 'offline' && u.searchParams.get('prompt') === 'consent' && u.searchParams.get('scope') === 'https://mail.google.com/' && (u.searchParams.get('state') || '').length >= 16
      && u.searchParams.get('redirect_uri') === `${s.base}/api/mail/google/callback` && u.searchParams.get('response_type') === 'code' && !href.includes(SECRET), href);
    // The browser goes to Google, Google redirects back to the board
    const hop = await fetch(href, { redirect: 'manual' }), back = hop.headers.get('location');
    const bad = await fetch(back.replace(/state=[^&]+/, 'state=forged'));
    check('a callback with the wrong state is refused', /not waiting/.test(await bad.text()) && !g.seen.calls.some(c => c.grant_type === 'authorization_code'));
    const ok = await fetch(back);
    check('the real callback says signed in', ok.status === 200 && /Signed in to Google/.test(await ok.text()) && /text\/html/.test(ok.headers.get('content-type')));
    const replay = await fetch(back);
    check('the same callback cannot be used twice', /not waiting/.test(await replay.text()) && g.seen.calls.filter(c => c.grant_type === 'authorization_code').length === 1);
    await page.waitForFunction(() => /Signed in to Google/.test((document.getElementById('mailGState') || {}).textContent || ''), null, { timeout: 15000 });
    check('Setup says Signed in and offers Sign out', await page.isVisible('#mailGOut') && !(await page.isVisible('#mailGLink')));
    const ex = g.seen.calls.find(c => c.grant_type === 'authorization_code');
    check('the code was swapped with the PKCE verifier and the client secret', ex && ex.client_secret === SECRET && ex.code_verifier.length >= 43 && ex.redirect_uri === `${s.base}/api/mail/google/callback`, ex);
    const sec = path.join(SECDIR, 'secrets', 'kept.json'), secTxt = fs.readFileSync(sec, 'utf8');
    check('the refresh token and client secret are kept encrypted, never in config or on the page', /"mailgoogle:m[0-9a-f]+": "aes:/.test(secTxt) && /"mailgooglesecret:m[0-9a-f]+": "aes:/.test(secTxt) && !secTxt.includes('RT-1') && !secTxt.includes(SECRET)
      && !JSON.stringify(await s.ok('GET', '/api/mail/config')).match(/RT-|sekrit/) && !JSON.stringify(await s.ok('GET', `/api/mail/google/status?box=${b.id}`)).match(/RT-|sekrit/) && !fs.readFileSync(path.join(s.data, 'mail', 'config.json'), 'utf8').includes(SECRET));

    // Reading and sending log in with XOAUTH2
    const inb = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('the inbox reads over AUTHENTICATE XOAUTH2 (no LOGIN, no password)', inb.items.length === 1 && inb.items[0].subject === 'Hello from Gmail' && imap.seen.lines.some(l => / AUTHENTICATE XOAUTH2 /.test(l)) && !imap.seen.lines.some(l => / LOGIN /i.test(l)), inb);
    check('a used-up access token is swapped with the refresh token and the client secret', g.seen.calls.some(c => c.grant_type === 'refresh_token' && c.refresh_token === 'RT-1' && c.client_secret === SECRET));
    const t1 = await s.ok('POST', '/api/mail/test', { ...box, id: b.id });
    check('Test connection works on the signed-in mailbox', t1.ok === true && t1.count === 1, t1);
    const sent = await s.ok('POST', '/api/mail/send', { box: b.id, to: 'mo@example.org', subject: 'Hi', text: 'Hello', token });
    check('sending logs in with AUTH XOAUTH2 over the send server', sent.ok && smtp.seen.datas === 1 && smtp.seen.lines.some(l => /^AUTH XOAUTH2 /.test(l)) && !smtp.seen.lines.some(l => /^AUTH PLAIN/.test(l)));

    // Refusals end cleanly
    g.mode.refresh = 'badtoken';
    const bad1 = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('a token the mail server refuses: the "+" challenge is answered and the error comes back (no hang)', /Invalid credentials/.test(bad1.error) && bad1.items.length === 1, bad1);
    const bad2 = await s.api('POST', '/api/mail/send', { box: b.id, to: 'mo@example.org', subject: 'Hi', text: 'x', token });
    check('…and sending says the Google sign-in was refused, nothing sent', bad2.status >= 400 && /refused the Google sign-in/.test(bad2.body.error || '') && smtp.seen.datas === 1, bad2);
    g.mode.refresh = 'gone';
    const bad3 = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('an expired sign-in says to press Sign in with Google again', /run out.*Sign in with Google/.test(bad3.error), bad3);
    g.mode.refresh = 'ok';

    // A new client ID drops the sign-in; a blank secret on save keeps the saved one; Sign out and Remove delete
    await s.ok('POST', '/api/mail/config', { ...box, gSecret: '', id: b.id, gClient: CLIENT.replace('abcdefgh', 'zzzzzzzz') });
    check('a new client ID means signing in again, the saved secret stays', (await s.ok('GET', '/api/mail/config')).boxes[0].gSignedIn === false && !/"mailgoogle:/.test(fs.readFileSync(sec, 'utf8')) && /mailgooglesecret:/.test(fs.readFileSync(sec, 'utf8')));
    await s.ok('POST', '/api/mail/config', { ...box, gSecret: '', id: b.id });
    const st = await s.ok('POST', '/api/mail/google/start', { box: b.id, token });
    check('start gives a waiting sign-in with a link and no code to type', st.state === 'waiting' && /^http:\/\/127\.0\.0\.1:\d+\/auth\?/.test(st.url) && st.code === '', st);
    g.mode.noRefreshToken = true;
    const t2 = await (await fetch((await fetch(st.url, { redirect: 'manual' })).headers.get('location'))).text();
    check('Google giving no refresh token says what to do, and stays signed out', /no refresh token/.test(t2) && (await s.ok('GET', `/api/mail/google/status?box=${b.id}`)).signedIn === false);
    g.mode.noRefreshToken = false;
    const st2 = await s.ok('POST', '/api/mail/google/start', { box: b.id, token });
    await fetch((await fetch(st2.url, { redirect: 'manual' })).headers.get('location'));
    check('signing in again works', (await s.ok('GET', `/api/mail/google/status?box=${b.id}`)).signedIn === true);
    await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#mailGOut');
    await page.click('#mailGOut');
    await page.waitForFunction(() => /Not signed in/.test((document.getElementById('mailGState') || {}).textContent || ''));
    check('Sign out deletes the refresh token', !/"mailgoogle:/.test(fs.readFileSync(sec, 'utf8')) && (await s.ok('GET', '/api/mail/config')).boxes[0].gSignedIn === false);
    await page.selectOption('#mailAuth', 'password');
    check('switching to a password shows the servers and password again', await page.isVisible('#mailPass') && await page.isVisible('#mailHost') && !(await page.isVisible('#mailGSignIn')));
    await s.ok('POST', '/api/mail/config', { id: b.id, remove: true, token });
    check('removing the mailbox deletes the client secret too', !/mailgoogle/.test(fs.readFileSync(sec, 'utf8')));
    noErrors(page);
  } finally { g.srv.close(); imap.srv.close(); smtp.srv.close(); }
}, true, { AIGILE_SECRETS_DIR: SECDIR, AIGILE_MAIL_PLAIN: '1', AIGILE_MAIL_GOOGLE_TEST: '1' });
