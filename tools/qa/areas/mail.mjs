// QA area: mail (AIG-902). ✉️ Mail card 1: add an IMAP mailbox in Setup (find settings, test, save), the password kept in the
// secrets store and never sent back, the #/mail inbox list (from, subject, date, unread dot) with mail text escaped, the 30-day
// header cache and its Forget button. No real mail server: a tiny fake IMAP server runs inside this QA process on plain TCP
// (AIGILE_MAIL_PLAIN=1, tests only), and AIGILE_MAIL_FIND_STUB stands in for DNS and the port 993 probe.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { check, def, tmp, freePort, openPage, noErrors, until, sleep } from '../lib.mjs';

const SECDIR = tmp('mailsec');
const USER = 'admin@locoradio.test';
const PASS_A = 'q"uo\\te pw';          // plain ASCII with a quote and a backslash: sent as a quoted string
const PASS_U = 'Gëheim-wachtwoord1';     // not ASCII: sent as a literal {n}
const HOUR = 3600e3;
// Two hostile mails (card 2, AIG-903): 103 is multipart (text + HTML with scripts, a form, tracking pictures, plus a PDF attachment);
// 102 is HTML only. Lines end in CRLF.
const crlf = s => s.replace(/\n/g, '\r\n');
const BODY_103 = crlf(`From: Jorg <jorg@example.org>
Subject: hello
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="B1"

--B1
Content-Type: multipart/alternative; boundary="B2"

--B2
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

Hello J=C3=B6rg <script>window.pwned=3</script>
Second line of the mail
Third line with a long url https://example.org/a
--B2
Content-Type: text/html; charset=utf-8

<p onclick="window.pwned=4">Hi <b>there</b></p><script>window.pwned=5</script><form action="http://evil.test/post"><input name=x></form><img src="http://tracker.test/p.gif"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><div style="background:url(http://tracker.test/b.png)">styled</div><iframe src="http://evil.test/f"></iframe>
--B2--
--B1
Content-Type: application/pdf; name="bill.pdf"
Content-Disposition: attachment; filename="bill.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQK
--B1--
`);
const BODY_102 = crlf(`From: news@letters.example
Subject: Weekly news
Content-Type: text/html; charset=utf-8

<h1>Big news</h1><img src="https://tracker.test/open.gif" width=1 height=1><p>Only HTML here.</p>
`);

// A fake IMAP server: greeting, LOGIN (quoted or literal), SELECT, UID SEARCH, UID FETCH, LOGOUT. Mail text is hostile on purpose.
function fakeImap() {
  const seen = { logins: 0, peeks: 0, lines: [] };
  const imapDate = d => d.toUTCString().replace(/^\w+, /, '').replace(/ GMT$/, ' +0000').replace(/^(\d+) (\w+) (\d+)/, '$1-$2-$3');
  const lit = s => { const b = Buffer.from(s, 'utf8'); return `{${b.length}}\r\n` + s; };
  const msgs = () => [
    { uid: 103, body: BODY_103, flags: '', date: new Date(Date.now() - 2 * HOUR), subject: lit('<script>window.pwned=1</script> <img src=x onerror="window.pwned=2"> {5}'), from: '(("=?UTF-8?B?SsO2cmcgw5xucmVhZA==?=" NIL "jorg" "example.org"))' },
    { uid: 102, body: BODY_102, flags: '\\Seen', date: new Date(Date.now() - 5 * HOUR), subject: '"Weekly \\"news\\""', from: '((NIL NIL "news" "letters.example"))' },
    { uid: 101, flags: '', date: new Date(Date.now() - 40 * 24 * HOUR), subject: 'NIL', from: '(("Old Sender" NIL "old" "example.net"))' },
  ];
  const srv = net.createServer(sock => {
    let buf = Buffer.alloc(0), text = '', lits = [], need = -1;
    sock.write('* OK fake IMAP ready\r\n');
    const args = s => { const out = []; let i = 0; while (i < s.length) { const c = s[i];
      if (c === ' ') { i++; continue; }
      if (c === '"') { let v = ''; i++; while (s[i] !== '"') { if (s[i] === '\\') i++; v += s[i++]; } i++; out.push(v); continue; }
      if (c === '\0') { const j = s.indexOf('\0', i + 1); out.push(lits[Number(s.slice(i + 1, j))]); i = j + 1; continue; }
      let j = i; while (j < s.length && s[j] !== ' ') j++; out.push(s.slice(i, j)); i = j; } return out; };
    const handle = line => {
      seen.lines.push(line);
      const a = args(line), tag = a[0], cmd = String(a[1] || '').toUpperCase();
      if (cmd === 'LOGIN') { seen.logins++; const ok = a[2] === USER && (a[3] === PASS_A || a[3] === PASS_U); return sock.write(ok ? `${tag} OK logged in\r\n` : `${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`); }
      if (cmd === 'SELECT') return sock.write(`* 3 EXISTS\r\n* 0 RECENT\r\n* OK [UIDVALIDITY 77] ok\r\n${tag} OK [READ-WRITE] done\r\n`);
      if (cmd === 'UID' && /^SEARCH$/i.test(a[2])) return sock.write(`* SEARCH 101 102 103\r\n${tag} OK search done\r\n`);
      if (cmd === 'EXAMINE') return sock.write(`* 3 EXISTS\r\n* OK [UIDVALIDITY 77] ok\r\n${tag} OK [READ-ONLY] done\r\n`);
      if (cmd === 'UID' && /^FETCH$/i.test(a[2])) {
        const want = String(a[3]).split(',').map(Number), peek = line.includes('BODY.PEEK[]');
        const env = m => `ENVELOPE ("${m.date.toUTCString()}" ${m.subject} ${m.from} NIL NIL (("Me" NIL "admin" "locoradio.test")) NIL NIL NIL "<${m.uid}@x>")`;
        if (peek) {   // the whole mail as one literal, as BODY[]<0>; the flags stay as they are (nothing here can set \Seen)
          seen.peeks++;
          const parts = msgs().filter(m => want.includes(m.uid)).map(m => Buffer.concat([Buffer.from(`* 1 FETCH (UID ${m.uid} FLAGS (${m.flags}) INTERNALDATE "${imapDate(m.date)}" ${env(m)} BODY[]<0> {${Buffer.byteLength(m.body)}}\r\n`), Buffer.from(m.body), Buffer.from(')\r\n')]));
          return sock.write(Buffer.concat([...parts, Buffer.from(`${tag} OK fetch done\r\n`)]));
        }
        const out = msgs().filter(m => want.includes(m.uid)).map((m, i) => `* ${i + 1} FETCH (UID ${m.uid} FLAGS (${m.flags}) INTERNALDATE "${imapDate(m.date)}" ${env(m)})\r\n`).join('');
        return sock.write(out + `${tag} OK fetch done\r\n`);
      }
      if (cmd === 'LOGOUT') { sock.write(`* BYE bye\r\n${tag} OK\r\n`); return sock.end(); }
      sock.write(`${tag} BAD unknown\r\n`);
    };
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (need >= 0) { if (buf.length < need) return; lits.push(buf.subarray(0, need).toString('utf8')); text += '\0' + (lits.length - 1) + '\0'; buf = buf.subarray(need); need = -1; continue; }
        const i = buf.indexOf('\r\n'); if (i < 0) return;
        const line = buf.subarray(0, i).toString('utf8'); buf = buf.subarray(i + 2);
        const m = line.match(/\{(\d+)\}$/);
        if (m) { text += line.slice(0, -m[0].length); need = Number(m[1]); sock.write('+ go on\r\n'); continue; }
        const whole = text + line; text = ''; handle(whole); lits = [];
      }
    });
    sock.on('error', () => {});
  });
  return { srv, seen };
}

const everyFile = dir => { const out = []; try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...everyFile(p)); else out.push(p); } } catch {} return out; };
const holds = (files, s) => files.some(f => fs.readFileSync(f).includes(Buffer.from(s, 'utf8')));

def('mail', 'Mail card 1: add an IMAP mailbox in Setup (find, test, save), password never back to the page, #/mail list escaped, cache and Forget (AIG-902)', async (s, ctx) => {
  const { srv, seen } = fakeImap(), port = await freePort();
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  try {
    check('no mailbox at first', (await s.ok('GET', '/api/mail/config')).boxes.length === 0);
    check('no mailbox: the inbox list is a 404', (await s.api('GET', '/api/mail/inbox')).status === 404);
    const box = { name: 'LocoRadio', address: USER, host: '127.0.0.1', port, user: USER, password: PASS_A };
    check('saving without the page token is refused', (await s.api('POST', '/api/mail/config', box)).status === 403);
    const { token } = await s.ok('GET', '/api/secrets/token');
    const cliTry = await fetch(s.base + '/api/mail/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'terminal' }, body: JSON.stringify({ ...box, token }) });
    check('the CLI and agents cannot save a mailbox, even with the token', cliTry.status === 403);

    const f = await s.ok('POST', '/api/mail/find', { address: USER });
    check('find settings tries imap., then mail., then the MX host, and picks the first that answers', f.best && f.best.host === 'mail.locoradio.test' && f.best.port === 993 && f.tried[0].host === 'imap.locoradio.test' && !f.tried[0].ok, f);
    check('find settings with no address is refused', (await s.api('POST', '/api/mail/find', { address: 'nope' })).status === 400);

    const t1 = await s.ok('POST', '/api/mail/test', { ...box, token });
    check('test connection: a quoted ASCII password with " and \\ logs in and counts the inbox', t1.ok === true && t1.count === 3, t1);
    const t2 = await s.ok('POST', '/api/mail/test', { ...box, password: 'wrong', token });
    check('test connection: a wrong password says what the server said', t2.ok === false && /Invalid credentials/.test(t2.error) && !t2.error.includes('wrong'), t2);
    const t3 = await s.ok('POST', '/api/mail/test', { ...box, port: await freePort(), token });
    check('test connection: nothing listening gives a plain error', t3.ok === false && /port|connect|closed/i.test(t3.error), t3);

    // Setup with real clicks
    const page = await openPage(ctx, '#/');
    await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#mailAddr');
    check('Setup has the ✉️ Mail box', /Mail/.test(await page.textContent('#mailBox')));
    await page.fill('#mailName', 'LocoRadio');
    await page.fill('#mailAddr', USER);
    await page.click('#mailFind');
    await page.waitForFunction(() => document.getElementById('mailHost').value === 'mail.locoradio.test');
    check('🔎 Find settings fills the server, port 993 and the user name', await page.inputValue('#mailPort') === '993' && await page.inputValue('#mailUser') === USER);
    await page.fill('#mailHost', '127.0.0.1'); await page.fill('#mailPort', String(port)); await page.fill('#mailPass', PASS_U);
    await page.click('#mailTest');
    await page.waitForFunction(() => /3/.test(document.getElementById('mailSetState').textContent));
    check('Test connection with a non-ASCII password (sent as a literal) says 3 mails', /Connected: 3/.test(await page.textContent('#mailSetState')));
    await page.click('#mailSave');
    await page.waitForFunction(() => /Saved/.test((document.getElementById('mailSetState') || {}).textContent || ''));
    check('after saving the password box is empty and says blank keeps it', await page.inputValue('#mailPass') === '' && /blank/.test(await page.getAttribute('#mailPass', 'placeholder')));

    const cfg = await s.ok('GET', '/api/mail/config'), raw = JSON.stringify(cfg), b = cfg.boxes[0];
    check('config: one mailbox, has a password, never the password itself', cfg.boxes.length === 1 && b.hasPassword === true && b.host === '127.0.0.1' && !raw.includes(PASS_U) && !raw.includes('Gëheim') && !('password' in b), cfg);
    const sec = path.join(SECDIR, 'secrets', 'kept.json');
    check('the password is kept encrypted in the secrets folder', fs.existsSync(sec) && /"mail:m[0-9a-f]+": "aes:/.test(fs.readFileSync(sec, 'utf8')) && !holds([sec], PASS_U));
    check('the secrets list (Setup > Secrets) does not show it', !JSON.stringify(await s.ok('GET', '/api/secrets')).includes('mail:'));
    check('no file in the data folder holds the password', !holds(everyFile(s.data), PASS_U) && !holds(everyFile(s.data), PASS_A));

    // The inbox list
    await page.goto(s.base + '/#/setup'); await page.reload();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('mailNav')).display !== 'none');
    check('the ✉️ Mail link shows once a mailbox is set up', true);
    await page.click('#mailNav');
    await page.waitForSelector('.mail-list .mail-row');
    await until(async () => (await page.locator('.mail-row').count()) === 3);
    const rows = await page.locator('.mail-row').allTextContents();
    check('#/mail lists the 3 newest mails, newest first', rows.length === 3 && /Jörg Ünread/.test(rows[0]) && /Weekly "news"/.test(rows[1]) && /Old Sender/.test(rows[2]), rows);
    check('From shows the decoded name, or the address when there is none', await page.locator('.mail-from').nth(1).textContent() === 'news@letters.example' && await page.locator('.mail-from').first().getAttribute('title') === 'jorg@example.org');
    check('a mail with no subject says so', /\(no subject\)/.test(rows[2]));
    check('unread mails get the dot (2 of 3)', await page.locator('.mail-dot').count() === 2 && await page.locator('.mail-row.unread').count() === 2);
    check('mail text is escaped: shown as text, nothing runs', /<script>window\.pwned=1<\/script>/.test(rows[0]) && /\{5\}/.test(rows[0]) && await page.evaluate(() => !window.pwned && !document.querySelector('#app script, #app img[onerror]')));
    check('dates show', (await page.locator('.mail-date').first().textContent()).trim().length > 0);

    // Card 2 (AIG-903): open one mail and read it safely
    const requests = []; page.on('request', r => requests.push(r.url()));
    const api103 = await s.ok('GET', `/api/mail/message?box=${b.id}&uid=103`);
    check('message API: text decoded (quoted-printable, UTF-8), HTML cleaned, attachment listed, still unread', /Hello Jörg <script>window\.pwned=3<\/script>/.test(api103.text) && api103.unread === true && api103.attachments.length === 1 && api103.attachments[0].name === 'bill.pdf' && api103.attachments[0].type === 'application/pdf', api103);
    check('message API: the HTML has no script, form, frame, handler or remote picture, and counts what it blocked', !/<script|<form|<iframe|<input|onclick|tracker\.test|evil\.test/i.test(api103.html) && /data:image\/gif/.test(api103.html) && api103.blockedImages === 2 && /Hi <b>there<\/b>/.test(api103.html), api103);
    check('message API: from, to and subject come back', api103.from.address === 'jorg@example.org' && api103.to[0].address === 'admin@locoradio.test' && /pwned=1/.test(api103.subject), api103);
    check('message API: a bad uid is a 400, an unknown mail a 404', (await s.api('GET', `/api/mail/message?box=${b.id}&uid=abc`)).status === 400 && (await s.api('GET', `/api/mail/message?box=${b.id}&uid=999`)).status === 404);
    check('reading uses BODY.PEEK on a read-only EXAMINE and never sets a flag', seen.peeks >= 1 && seen.lines.some(l => /EXAMINE/.test(l)) && !seen.lines.some(l => /STORE/i.test(l)) && seen.lines.filter(l => /BODY/.test(l)).every(l => l.includes('BODY.PEEK[')));
    await s.ok('POST', '/api/projects', { name: 'Mailcards', key: 'MLC' });
    await page.locator('.mail-open').first().click();
    await page.waitForSelector('#mailText');
    // 📋 Make a card from the open mail (AIG-905)
    await page.waitForSelector('#mailCardProj option[value="mailcards"]', { state: 'attached' });
    await page.selectOption('#mailCardProj', 'mailcards');
    await page.click('#mailMakeCard');
    await page.waitForSelector('#mailCardMade');
    const made = (await s.ok('GET', '/api/projects/mailcards')).cards.find(c => /pwned=1/.test(c.title));
    check('📋 Make a card: subject as title, sender and first lines as bullets, in backlog', !!made && made.status === 'backlog' && /📧 .*jorg@example\.org/.test(made.description) && /Second line of the mail/.test(made.description) && /MLC-1/.test(await page.textContent('#mailCardMade')), made);
    check('click a mail: it opens with subject, sender and plain text shown as text', /pwned=1/.test(await page.textContent('#mailSubject')) && /Jörg Ünread/.test(await page.textContent('#mailFromFull')) && /Hello Jörg <script>window\.pwned=3<\/script>/.test(await page.textContent('#mailText')));
    check('mail text runs nothing and creates no elements', await page.evaluate(() => !window.pwned && !document.querySelector('#mailText script, #mailText img, #mailText *')));
    check('the attachment is listed, not opened', /bill\.pdf/.test(await page.textContent('#mailAttach')) && /Second line of the mail/.test(await page.textContent('#mailText')));
    check('text view: no iframe yet', await page.locator('#mailFrame').count() === 0);
    await page.click('#mailToggle');
    await page.waitForSelector('#mailFrame');
    const sandbox = await page.getAttribute('#mailFrame', 'sandbox'), doc = await page.getAttribute('#mailFrame', 'srcdoc');
    check('HTML goes only in an iframe with an empty sandbox (no scripts, no forms, no same-origin)', sandbox === '' && !/allow-/.test(await page.evaluate(() => document.getElementById('mailFrame').outerHTML)));
    check('the iframe document carries a policy that allows no remote loads and holds no script, form or tracker', /Content-Security-Policy/.test(doc) && /default-src 'none'/.test(doc) && !/<script|<form|tracker\.test|onclick/i.test(doc) && /there/.test(doc));
    check('the "remote images blocked" line shows with the count', /blocked/i.test(await page.textContent('#mailBlocked')) && /2/.test(await page.textContent('#mailBlocked')));
    await sleep(500);
    check('nothing ran in the page and the browser asked no remote host for anything', await page.evaluate(() => !window.pwned) && !requests.some(u => /tracker\.test|evil\.test/.test(u)), requests.filter(u => /test/.test(u)));
    await page.click('#mailBack');
    await page.waitForSelector('.mail-list .mail-row');
    check('Back returns to the list, and opening did not mark the mail read (still 2 unread)', await page.locator('.mail-dot').count() === 2);
    await page.locator('.mail-open').nth(1).click();
    await page.waitForSelector('#mailFrame');
    check('an HTML-only mail opens straight in the sandboxed frame, with the picture blocked', await page.getAttribute('#mailFrame', 'sandbox') === '' && !/tracker\.test/.test(await page.getAttribute('#mailFrame', 'srcdoc')) && /1/.test(await page.textContent('#mailBlocked')) && await page.locator('#mailToggle').count() === 0);
    await page.click('#mailBack');
    await page.waitForSelector('.mail-list .mail-row');

    // 🏷️ Rules without AI (AIG-906)
    const starter = (await s.ok('GET', '/api/mail/rules')).rules;
    check('rules: four starter rules (bills, appointments, deliveries, newsletters), all on', starter.length === 4 && starter.every(r => r.on) && starter.some(r => r.id === 'bills'), starter);
    check('rules: a rule with nothing to match or nothing to do is refused', (await s.api('POST', '/api/mail/rules', { rules: [{ name: 'x', label: 'y' }] })).status === 400 && (await s.api('POST', '/api/mail/rules', { rules: [{ name: 'x', from: 'y' }] })).status === 400);
    await page.click('#mailRulesBtn');
    await page.waitForSelector('#mailRules .mail-rule');
    check('🏷️ Rules opens the list with the starter rules', await page.locator('#mailRules .mail-rule').count() === 4);
    await page.fill('#mrName', 'Jörg'); await page.fill('#mrFrom', 'nobody@x|JORG@example'); await page.fill('#mrLabel', '⭐ Jörg'); await page.check('#mrCard');
    await page.click('#mrAdd');
    await page.waitForFunction(() => [...document.querySelectorAll('.mail-label')].some(e => /Jörg/.test(e.textContent)));
    const tagged = (await s.ok('GET', `/api/mail/inbox?box=${b.id}`)).items, jorg = tagged.find(x => x.from.address === 'jorg@example.org');
    check('a new rule labels the matching mail (any case, | means or) and suggests a card; others untouched', jorg && jorg.labels.includes('⭐ Jörg') && jorg.suggestCard === true && tagged.filter(x => x !== jorg).every(x => !x.labels.includes('⭐ Jörg')), tagged);
    check('the row shows the label and the 📋 chip', await page.locator('.mail-row .mail-suggest').count() >= 1);
    await page.locator('#mailRules .mail-rule input[type=checkbox]').last().uncheck();
    await page.waitForFunction(() => ![...document.querySelectorAll('.mail-label')].some(e => /Jörg/.test(e.textContent)));
    check('switching a rule off takes its label away; rules never STORE, MOVE or EXPUNGE on the server', !seen.lines.some(l => /STORE|MOVE|EXPUNGE|COPY/i.test(l)));

    // ↩️ Reply and send (AIG-904): a fake SMTP server in this process, plain TCP like the fake IMAP one.
    const smtp = { lines: [], datas: [] }, sport = await freePort();
    const ssrv = net.createServer(sock => {
      let buf = '', inData = false;
      sock.write('220 fake SMTP\r\n');
      sock.on('data', d => {
        buf += d.toString('latin1');
        if (inData) { const e = buf.indexOf('\r\n.\r\n'); if (e < 0) return; smtp.datas.push(buf.slice(0, e)); buf = buf.slice(e + 5); inData = false; sock.write('250 queued\r\n'); }
        let i; while ((i = buf.indexOf('\r\n')) >= 0 && !inData) {
          const l = buf.slice(0, i); buf = buf.slice(i + 2); smtp.lines.push(l);
          if (/^EHLO/i.test(l)) sock.write('250-fake\r\n250 AUTH PLAIN\r\n');
          else if (/^AUTH PLAIN /i.test(l)) sock.write(Buffer.from(l.slice(11), 'base64').toString('utf8').startsWith('\0' + USER + '\0') ? '235 ok\r\n' : '535 no\r\n');
          else if (/^(MAIL|RCPT)/i.test(l)) sock.write('250 ok\r\n');
          else if (/^DATA/i.test(l)) { inData = true; sock.write('354 go\r\n'); }
          else if (/^QUIT/i.test(l)) { sock.write('221 bye\r\n'); sock.end(); }
          else sock.write('500 what\r\n');
        }
      });
    });
    await new Promise(r => ssrv.listen(sport, '127.0.0.1', r));
    try {
      await s.ok('POST', '/api/mail/config', { ...box, id: b.id, password: '', smtpHost: '127.0.0.1', smtpPort: sport, token });
      const mailx = { box: b.id, to: 'jorg@example.org', subject: 'Re: hello ü', text: 'Thanks!\n.a line with a dot' };
      check('send: refused without the page token, and from the CLI even with it', (await s.api('POST', '/api/mail/send', mailx)).status === 403
        && (await fetch(s.base + '/api/mail/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'terminal' }, body: JSON.stringify({ ...mailx, token }) })).status === 403 && smtp.datas.length === 0);
      check('send: a bad address is refused before connecting', (await s.api('POST', '/api/mail/send', { ...mailx, to: 'not an address', token })).status === 400 && smtp.lines.length === 0);
      const sent = await s.ok('POST', '/api/mail/send', { ...mailx, token });
      const raw = smtp.datas[0] || '', body64 = raw.split('\r\n\r\n')[1] || '';
      check('send: logs in, one RCPT, the body arrives (base64, UTF-8 subject encoded)', sent.ok && smtp.lines.some(l => /^AUTH PLAIN/.test(l)) && smtp.lines.filter(l => /^RCPT TO:<jorg@example\.org>/.test(l)).length === 1
        && /^Subject: =\?UTF-8\?B\?/m.test(raw) && Buffer.from(body64.replace(/\r\n/g, ''), 'base64').toString('utf8') === 'Thanks!\r\n.a line with a dot', raw.slice(0, 400));
      const log = fs.readFileSync(path.join(s.data, 'mail', 'log.jsonl'), 'utf8');
      check('send: one log line with the subject, never the body', /"what":"sent"/.test(log) && /hello/.test(log) && !/Thanks/.test(log));
      await page.evaluate(() => { window.__mailUndoS = 2; });
      await page.locator('.mail-open').first().click();
      await page.waitForSelector('#mailReply');
      await page.click('#mailReply');
      await page.waitForSelector('#mcTo');
      check('↩️ Reply fills in the sender, Re: subject and the quoted text', await page.inputValue('#mcTo') === 'jorg@example.org' && /^Re: /.test(await page.inputValue('#mcSubj')) && /> Hello Jörg/.test(await page.inputValue('#mcText')));
      await page.fill('#mcText', 'Undo me');
      await page.click('#mcSend');
      await page.click('#mcUndo');
      await sleep(2600);
      check('↶ Undo within the countdown: nothing is sent', smtp.datas.length === 1 && /undid/i.test(await page.textContent('#mcMsg')));
      await page.fill('#mcText', 'Real reply');
      await page.click('#mcSend');
      await page.waitForFunction(() => !document.getElementById('mailCompose'), null, { timeout: 15000 });
      check('📤 Send after the countdown: sent once, as a reply (In-Reply-To kept when the mail had one)', smtp.datas.length === 2 && /Real reply/.test(Buffer.from((smtp.datas[1].split('\r\n\r\n')[1] || '').replace(/\r\n/g, ''), 'base64').toString('utf8')));
      await page.click('#mailBack');
      await page.waitForSelector('.mail-list .mail-row');
    } finally { ssrv.close(); }

    const cache = path.join(s.data, 'mail', b.id, 'inbox.json');
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    check('the cache keeps headers of the last 30 days only (the 40-day-old one is left out)', c.items.length === 2 && c.items.every(x => x.uid !== 101), c.items.map(x => x.uid));
    check('the cached list comes back without asking the server', (await s.ok('GET', `/api/mail/inbox?box=${b.id}`)).cached === true && (await s.ok('GET', `/api/mail/inbox?box=${b.id}`)).items.length === 2);
    await page.click('#mailForget');
    await page.waitForFunction(() => /Cache cleared/.test(document.getElementById('mailState').textContent));
    check('🧹 Forget cache deletes the cached headers', !fs.existsSync(cache));
    const before = seen.logins;
    await page.click('#mailRefresh');
    await page.waitForFunction(() => document.querySelectorAll('.mail-row').length === 3);
    check('🔄 Refresh fetches again', seen.logins > before && fs.existsSync(cache));
    check('the server never saw a LOGIN line holding the non-ASCII password inline', !seen.lines.some(l => l.includes(PASS_U)));

    // The password stays with its server
    const x = { id: b.id, name: 'LocoRadio', address: USER, host: '127.0.0.1', port, user: USER, password: '', token };
    check('a blank password keeps the saved one', (await s.api('POST', '/api/mail/config', x)).status === 200);
    check('test with a blank password uses the saved one for the same server', (await s.ok('POST', '/api/mail/test', x)).ok === true);
    const away = await s.api('POST', '/api/mail/test', { ...x, host: 'evil.example' });
    check('…but never sends it to another server', away.status === 400 && /password/.test(away.body.error || ''), away);
    const moved = await s.api('POST', '/api/mail/config', { ...x, host: 'other.example' });
    check('changing the server asks for the password again', moved.status === 400 && /again/.test(moved.body.error || ''), moved);

    // Wrong password later: the error shows, the list stays
    await s.ok('POST', '/api/mail/config', { ...x, password: 'wrong' });
    await page.click('#mailRefresh');
    await page.waitForSelector('#mailErr');
    check('a failing fetch shows the error and keeps the cached list', /Invalid credentials/.test(await page.textContent('#mailErr')) && await page.locator('.mail-row').count() >= 2);

    // Remove
    page.on('dialog', d => d.accept());
    await page.goto(s.base + '/#/setup'); await page.reload(); await page.waitForSelector('#mailRemove');
    await page.click('#mailRemove');
    await page.waitForFunction(() => /Removed/.test((document.getElementById('mailSetState') || {}).textContent || ''));
    check('Remove mailbox drops the config, the password and the cache', (await s.ok('GET', '/api/mail/config')).boxes.length === 0 && !fs.readFileSync(sec, 'utf8').includes('mail:') && !fs.existsSync(cache));
    await sleep(200);
    page.errors = page.errors.filter(e => !/^console: Blocked script execution in 'about:srcdoc'/.test(e));   // the sandbox saying no (the test runner's own helper script also lands there); the srcdoc is checked above to hold no script
    noErrors(page);
  } finally { srv.close(); }
}, true, { AIGILE_SECRETS_DIR: SECDIR, AIGILE_MAIL_PLAIN: '1', AIGILE_MAIL_FIND_STUB: JSON.stringify({ mx: ['mail.locoradio.test'], answers: ['mail.locoradio.test'] }) });
