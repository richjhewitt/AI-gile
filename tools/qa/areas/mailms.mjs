// QA area: mailms (AIG-909). ✉️ Mail card 7: Outlook.com / Microsoft 365 sign-in. A mailbox set to "Sign in with: Microsoft"
// has a client ID and no password; Sign in with Microsoft shows a device code, the board polls Microsoft's token endpoint, keeps
// the refresh token encrypted, and IMAP / SMTP log in with XOAUTH2. No real Microsoft: a fake token server, a fake IMAP server
// and a fake SMTP server run inside this QA process (AIGILE_MAIL_MS_TEST=1 lets the mailbox point at them, tests only).
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { check, def, tmp, freePort, openPage, noErrors, sleep } from '../lib.mjs';

const SECDIR = tmp('mailmssec');
const USER = 'rich@outlook.test';
const CLIENT = '0a1b2c3d-1111-2222-3333-444455556666';
const listen = (srv, port) => new Promise(r => srv.listen(port, '127.0.0.1', r));

// Microsoft's /devicecode and /token. mode.next decides what the next token call says.
function fakeMs() {
  const seen = { calls: [] }, mode = { pending: 1, refresh: 'ok', n: 0 };
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      const f = Object.fromEntries(new URLSearchParams(body)), what = req.url.split('/').pop();
      seen.calls.push({ what, ...f });
      const out = j => { res.writeHead(j.error ? 400 : 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
      if (f.client_id !== CLIENT) return out({ error: 'unauthorized_client', error_description: 'AADSTS700016: Application not found' });
      if (what === 'devicecode') return out({ device_code: 'DEV-1', user_code: 'ABCD-1234', verification_uri: 'https://microsoft.com/devicelogin', expires_in: 900, interval: 1 });
      if (f.grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
        if (mode.pending-- > 0) return out({ error: 'authorization_pending' });
        return out({ access_token: 'AT-' + (++mode.n), refresh_token: 'RT-' + mode.n, expires_in: 1 });
      }
      if (f.grant_type === 'refresh_token') {
        if (mode.refresh === 'gone') return out({ error: 'invalid_grant', error_description: 'AADSTS70008: The refresh token has expired' });
        if (mode.refresh === 'badtoken') return out({ access_token: 'WRONG', expires_in: 1 });
        return out({ access_token: 'AT-' + (++mode.n), refresh_token: 'RT-' + mode.n, expires_in: 1 });   // expires at once: every use refreshes
      }
      out({ error: 'unsupported_grant_type' });
    });
  });
  return { srv, seen, mode };
}
// IMAP that only takes AUTHENTICATE XOAUTH2 with a token the fake Microsoft gave out; a wrong one gets a "+" challenge first.
function fakeImap() {
  const seen = { lines: [] };
  const srv = net.createServer(sock => {
    let buf = '', pend = null;
    sock.write('* OK fake Outlook IMAP\r\n');
    sock.on('data', d => {
      buf += d.toString('utf8'); let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2); seen.lines.push(line);
        if (pend) { sock.write(`${pend} NO AUTHENTICATE failed.\r\n`); pend = null; continue; }
        const [tag, cmd, a2, a3] = line.split(' ');
        if (/^AUTHENTICATE$/i.test(cmd) && a2 === 'XOAUTH2') {
          const s = Buffer.from(a3 || '', 'base64').toString('utf8');
          if (/^user=rich@outlook\.test\x01auth=Bearer AT-\d+\x01\x01$/.test(s)) sock.write(`${tag} OK AUTHENTICATE completed.\r\n`);
          else { pend = tag; sock.write('+ ' + Buffer.from('{"status":"401","schemes":"bearer","scope":"https://outlook.office365.com/"}').toString('base64') + '\r\n'); }
        } else if (/^LOGIN$/i.test(cmd)) sock.write(`${tag} NO LOGIN failed.\r\n`);
        else if (/^SELECT$/i.test(cmd)) sock.write(`* 1 EXISTS\r\n* OK [UIDVALIDITY 9] ok\r\n${tag} OK [READ-WRITE] done\r\n`);
        else if (/^UID$/i.test(cmd) && /^SEARCH$/i.test(a2)) sock.write(`* SEARCH 7\r\n${tag} OK done\r\n`);
        else if (/^UID$/i.test(cmd) && /^FETCH$/i.test(a2)) sock.write(`* 1 FETCH (UID 7 FLAGS () INTERNALDATE "14-Oct-2026 05:00:00 +0000" ENVELOPE ("${new Date().toUTCString()}" "Hello from Outlook" (("Mo" NIL "mo" "example.org")) NIL NIL NIL NIL NIL NIL "<7@x>"))\r\n${tag} OK done\r\n`);
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
    sock.write('220 fake Outlook SMTP\r\n');
    sock.on('data', d => {
      buf += d.toString('latin1');
      if (inData) { const e = buf.indexOf('\r\n.\r\n'); if (e < 0) return; seen.datas++; buf = buf.slice(e + 5); inData = false; sock.write('250 queued\r\n'); }
      let i; while ((i = buf.indexOf('\r\n')) >= 0 && !inData) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2); seen.lines.push(l);
        if (/^EHLO/i.test(l)) sock.write('250-fake\r\n250 AUTH LOGIN XOAUTH2\r\n');
        else if (/^AUTH XOAUTH2 /i.test(l)) sock.write(/auth=Bearer AT-\d+\x01/.test(Buffer.from(l.slice(13), 'base64').toString('utf8')) ? '235 ok\r\n' : '334 eyJzdGF0dXMiOiI0MDEifQ==\r\n');
        else if (l === '') sock.write('535 5.7.3 Authentication unsuccessful\r\n');
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

def('mailms', 'Mail card 7: Outlook / Microsoft 365 sign-in with a device code; IMAP and SMTP over XOAUTH2; token kept encrypted, fixed to Microsoft (AIG-909)', async (s, ctx) => {
  const ms = fakeMs(), imap = fakeImap(), smtp = fakeSmtp();
  const [mport, iport, sport] = [await freePort(), await freePort(), await freePort()];
  await listen(ms.srv, mport); await listen(imap.srv, iport); await listen(smtp.srv, sport);
  try {
    // Outside tests the servers are always Microsoft's own, whatever the form says
    const oauth = createRequire(import.meta.url)('../../../lib/mailoauth.js');
    const fx = oauth.fixed({ host: 'evil.example', port: 1, smtpHost: 'evil.example', smtpPort: 2 });
    check('a Microsoft mailbox always uses outlook.office365.com:993 and smtp.office365.com:587', fx.host === 'outlook.office365.com' && fx.port === 993 && fx.smtpHost === 'smtp.office365.com' && fx.smtpPort === 587, fx);

    const { token } = await s.ok('GET', '/api/secrets/token');
    const box = { name: 'Outlook', address: USER, auth: 'microsoft', msClient: CLIENT, msAuthority: `http://127.0.0.1:${mport}`, host: '127.0.0.1', port: iport, smtpHost: '127.0.0.1', smtpPort: sport, token };
    check('a Microsoft mailbox needs a real client ID', (await s.api('POST', '/api/mail/config', { ...box, msClient: 'nope' })).status === 400);
    const saved = await s.ok('POST', '/api/mail/config', box), b = saved.boxes[0];
    check('saved with no password: auth microsoft, not signed in yet', b.auth === 'microsoft' && b.msClient === CLIENT && b.msSignedIn === false && b.hasPassword === false, b);
    const before = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('before signing in the inbox says to sign in, and nothing reaches the mail server', /Sign in with Microsoft/.test(before.error) && imap.seen.lines.length === 0, before);
    check('sign-in start needs the page token', (await s.api('POST', '/api/mail/ms/start', { box: b.id })).status === 403
      && (await fetch(s.base + '/api/mail/ms/start', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'terminal' }, body: JSON.stringify({ box: b.id, token }) })).status === 403);

    // Setup with real clicks: pick Microsoft, sign in, see the code, then "Signed in"
    const page = await openPage(ctx, '#/');
    await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#mailAuth');
    await page.evaluate(() => { window.__mailMsPollMs = 300; });
    check('Setup shows Sign in with: Microsoft, the client ID, and hides the servers and password', await page.inputValue('#mailAuth') === 'microsoft' && await page.inputValue('#mailMsClient') === CLIENT && !(await page.isVisible('#mailPass')) && !(await page.isVisible('#mailHost')));
    check('it says not signed in yet', /Not signed in/.test(await page.textContent('#mailMsState')));
    await page.click('#mailMsSignIn');
    await page.waitForSelector('#mailMsUserCode');
    if (process.env.QA_SHOTS) await page.locator('#mailBox').screenshot({ path: path.join(process.env.QA_SHOTS, 'mailms-code.png') });   // for the hand-over
    check('Sign in with Microsoft shows the code and microsoft.com/devicelogin', await page.textContent('#mailMsUserCode') === 'ABCD-1234' && /microsoft\.com\/devicelogin/.test(await page.textContent('#mailMsCode')));
    await page.waitForFunction(() => /Signed in to Microsoft/.test((document.getElementById('mailMsState') || {}).textContent || ''), null, { timeout: 15000 });
    check('after Microsoft says yes, Setup says Signed in and offers Sign out', await page.isVisible('#mailMsOut') && !(await page.isVisible('#mailMsUserCode')));
    const polls = ms.seen.calls.filter(c => c.grant_type && /device_code/.test(c.grant_type));
    check('the board waited while Microsoft said authorization_pending, then took the token', polls.length >= 2 && polls.every(c => c.device_code === 'DEV-1'));
    const sec = path.join(SECDIR, 'secrets', 'kept.json'), secTxt = fs.readFileSync(sec, 'utf8');
    check('the refresh token is kept encrypted, never in config or on the page', /"mailms:m[0-9a-f]+": "aes:/.test(secTxt) && !secTxt.includes('RT-1') && !JSON.stringify(await s.ok('GET', '/api/mail/config')).includes('RT-') && !JSON.stringify(await s.ok('GET', `/api/mail/ms/status?box=${b.id}`)).includes('RT-'));

    // Reading and sending log in with XOAUTH2
    const inb = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('the inbox reads over AUTHENTICATE XOAUTH2 (no LOGIN, no password)', inb.items.length === 1 && inb.items[0].subject === 'Hello from Outlook' && imap.seen.lines.some(l => / AUTHENTICATE XOAUTH2 /.test(l)) && !imap.seen.lines.some(l => / LOGIN /i.test(l)), inb);
    check('a used-up access token is swapped with the refresh token, and the new refresh token is kept', ms.seen.calls.some(c => c.grant_type === 'refresh_token' && c.refresh_token === 'RT-1') && !fs.readFileSync(sec, 'utf8').includes('RT-'));
    const t1 = await s.ok('POST', '/api/mail/test', { ...box, id: b.id });
    check('Test connection works on the signed-in mailbox', t1.ok === true && t1.count === 1, t1);
    const sent = await s.ok('POST', '/api/mail/send', { box: b.id, to: 'mo@example.org', subject: 'Hi', text: 'Hello', token });
    check('sending logs in with AUTH XOAUTH2 over the send server', sent.ok && smtp.seen.datas === 1 && smtp.seen.lines.some(l => /^AUTH XOAUTH2 /.test(l)) && !smtp.seen.lines.some(l => /^AUTH PLAIN/.test(l)));

    // Refusals end cleanly, with words Rich can act on
    ms.mode.refresh = 'badtoken';
    const bad1 = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('a token the mail server refuses: the "+" challenge is answered and the error comes back (no hang)', /AUTHENTICATE failed/.test(bad1.error) && bad1.items.length === 1, bad1);
    const bad2 = await s.api('POST', '/api/mail/send', { box: b.id, to: 'mo@example.org', subject: 'Hi', text: 'x', token });
    check('…and sending says the sign-in was refused, nothing sent', bad2.status >= 400 && /refused the Microsoft sign-in/.test(bad2.body.error || '') && smtp.seen.datas === 1, bad2);
    ms.mode.refresh = 'gone';
    const bad3 = await s.ok('GET', `/api/mail/inbox?box=${b.id}&fresh=1`);
    check('an expired sign-in says to press Sign in with Microsoft again', /run out.*Sign in with Microsoft/.test(bad3.error), bad3);
    ms.mode.refresh = 'ok';

    // A new client ID or switching to a password drops the sign-in; Sign out and Remove delete it
    await s.ok('POST', '/api/mail/config', { ...box, id: b.id, msClient: CLIENT.replace('6666', '7777') });
    check('a new client ID means signing in again', (await s.ok('GET', '/api/mail/config')).boxes[0].msSignedIn === false && !/mailms:/.test(fs.readFileSync(sec, 'utf8')));
    await s.ok('POST', '/api/mail/config', { ...box, id: b.id });
    ms.mode.pending = 0;
    await s.ok('POST', '/api/mail/ms/start', { box: b.id, token });
    await sleep(1600);
    check('signing in again works', (await s.ok('GET', `/api/mail/ms/status?box=${b.id}`)).signedIn === true);
    await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#mailMsOut');
    await page.click('#mailMsOut');
    await page.waitForFunction(() => /Not signed in/.test((document.getElementById('mailMsState') || {}).textContent || ''));
    check('Sign out deletes the refresh token', !/mailms:/.test(fs.readFileSync(sec, 'utf8')) && (await s.ok('GET', '/api/mail/config')).boxes[0].msSignedIn === false);
    await page.selectOption('#mailAuth', 'password');
    check('switching to a password shows the servers and password again', await page.isVisible('#mailPass') && await page.isVisible('#mailHost') && !(await page.isVisible('#mailMsSignIn')));
    noErrors(page);
  } finally { ms.srv.close(); imap.srv.close(); smtp.srv.close(); }
}, true, { AIGILE_SECRETS_DIR: SECDIR, AIGILE_MAIL_PLAIN: '1', AIGILE_MAIL_MS_TEST: '1' });
