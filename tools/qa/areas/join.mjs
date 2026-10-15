// QA area: join (AIG-347): one-use invite links. A local join service and relay, the owner's board (the main QA server)
// and a fresh friend's board: a code is made and signed, an unsigned or foreign-signed add is refused, the page shows Download
// without using the code up, the download is the zip with invite.json inside, a second use and an expired code are refused,
// and a fresh board applies the invite.json (help level saved, the owner added as a contact). Also the Setup box and its texts.
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, freePort, startRelay, until, check, sleep, startServer, openPage, tmp, def } from '../lib.mjs';

const b64 = buf => Buffer.from(buf).toString('base64url');
const sha = d => crypto.createHash('sha256').update(d).digest('hex');
// A signed request the way the board makes one (lib/dm.js signHeaders).
function signed(priv, pub, method, p, body) {
  const ts = String(Date.now()), nonce = b64(crypto.randomBytes(12)), data = body === undefined ? '' : JSON.stringify(body);
  const sig = crypto.sign(null, Buffer.from(['aigile-join-v1', method, p, ts, nonce, sha(data)].join('\n')), priv);
  return { headers: { 'x-join-key': pub, 'x-join-ts': ts, 'x-join-nonce': nonce, 'x-join-sig': b64(sig), ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data || undefined };
}
async function startJoin(ownerKey, zip, extraEnv = {}) {
  const port = await freePort(), data = path.join(tmp('join'), 'data');
  const proc = spawn(process.execPath, [path.join(ROOT, 'relay', 'join.js')], { env: { ...process.env, JOIN_PORT: String(port), JOIN_HOST: '127.0.0.1', JOIN_DATA: data, JOIN_ZIP: zip, JOIN_OWNER_KEY: ownerKey, JOIN_RATE: '100000', ...extraEnv }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(100); }
  return { base, data, stop: () => { try { proc.kill(); } catch {} } };
}

def('join', 'closed alpha invites: signed codes (unsigned refused), Download page, one use, expiry, invite.json inside the zip, a fresh board applies it (help level, owner linked), Setup box (AIG-347)', async (s, ctx) => {
  const work = tmp('joinzip'), zip = path.join(work, 'AI-gile-test.zip');
  execFileSync('git', ['archive', '--format=zip', '--prefix=AI-gile/', '-o', zip, 'HEAD', '--', 'AGENTS.md'], { cwd: ROOT });
  const exe = path.join(work, 'AI-gile-Setup.exe');   // AIG-1231: a stand-in for the Windows installer
  fs.writeFileSync(exe, Buffer.from('MZ stand-in installer ' + crypto.randomBytes(8).toString('hex')));
  const relay = await startRelay();
  await s.ok('POST', '/api/dms/settings', { relay: relay.base, on: true });
  const ownerKey = (await s.ok('GET', '/api/join')).ownerKey;
  const join = await startJoin(ownerKey, zip, { JOIN_EXE: exe, JOIN_SHARE_MAX: '3' });   // AIG-1311: 3 shares per code here (20 by default)
  let friend = null, friend2 = null, friend3 = null, friend4 = null;
  try {
    await s.ok('POST', '/api/join/settings', { url: join.base });

    // Adding a code: unsigned and foreign-signed are refused, the owner's signature works.
    const code = 'ABCD-EFGH-JKLM', body = { code, help: '2' };
    const raw = await fetch(join.base + '/join/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    check('an unsigned POST /codes is refused', raw.status === 401, raw.status);
    const other = crypto.generateKeyPairSync('ed25519'), otherPub = other.publicKey.export({ format: 'jwk' }).x;
    const fr = signed(other.privateKey, otherPub, 'POST', '/join/codes', body);
    check('a code signed by another key is refused', (await fetch(join.base + '/join/codes', { method: 'POST', ...fr })).status === 403);
    const bad = signed(other.privateKey, ownerKey, 'POST', '/join/codes', body);
    check('a forged signature with the owner key shown is refused', (await fetch(join.base + '/join/codes', { method: 'POST', ...bad })).status === 401);
    check('no code exists after those', (await fetch(join.base + '/join?code=' + code)).status === 404);

    // The board makes a code through the API: signed, and a DM invite rides along.
    const none = await s.api('POST', '/api/join/codes', { help: '9' });
    check('a bad help level is refused by the board', none.status === 400);
    const made = await s.ok('POST', '/api/join/codes', { help: '3', name: 'Beatrix' });
    check('the board makes a link and a code', /^[A-Z2-9]{4}(-[A-Z2-9]{4}){2}$/.test(made.code) && made.link === `${join.base}/join?code=${made.code}`, made);
    const listed = await s.ok('GET', '/api/join');
    check('it is listed as open, with an expiry about 7 days away', listed.codes.length === 1 && !listed.codes[0].used && listed.codes[0].known && Math.abs(listed.codes[0].exp - Date.now() - 7 * 864e5) < 6e4, listed.codes);

    // The page: Download button, and loading it does not use the code up.
    const html = await (await fetch(made.link)).text();
    check('the page shows a Download button', /Download AI-gile/.test(html) && /<form method="post" action="\/join\/download">/.test(html));
    await fetch(made.link);
    check('looking at the page does not use the code', !(await s.ok('GET', '/api/join')).codes[0].used);
    check('the page speaks nl and nl-BE', /uitgenodigd/.test(await (await fetch(made.link, { headers: { 'accept-language': 'nl-BE,nl;q=0.9' } })).text()) && /uitgenodigd/.test(await (await fetch(made.link + '&lng=nl')).text()));
    check('a made-up code gets a plain "not valid" page', /not valid/.test(await (await fetch(join.base + '/join?code=ZZZZ-ZZZZ-ZZZZ')).text()));

    // The download: the zip with invite.json inside, once.
    const dl = await fetch(join.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + made.code });
    const buf = Buffer.from(await dl.arrayBuffer());
    check('Download serves a zip', dl.status === 200 && /zip/.test(dl.headers.get('content-type')) && buf.readUInt32LE(0) === 0x04034b50);
    const got = path.join(work, 'got.zip'), out = path.join(work, 'out');
    fs.writeFileSync(got, buf); fs.mkdirSync(out);
    const bsd = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';   // bsdtar reads zips
    const tar = spawnSync(fs.existsSync(bsd) ? bsd : 'tar', ['-xf', 'got.zip', '-C', 'out'], { cwd: work });
    const inviteFile = path.join(out, 'AI-gile', 'invite.json');
    check('the zip still unpacks and holds the app files and invite.json', tar.status === 0 && fs.existsSync(path.join(out, 'AI-gile', 'AGENTS.md')) && fs.existsSync(inviteFile), String(tar.stderr));
    const inv = JSON.parse(fs.readFileSync(inviteFile, 'utf8'));
    check('invite.json carries the help level, a DM invite and the owner name', inv.help === '3' && inv.dm.length > 40 && inv.from === 'Owner', { ...inv, dm: '…' });
    check('a second download is refused', (await fetch(join.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + made.code })).status === 410);
    check('the link now says it was used', /already been used/.test(await (await fetch(made.link)).text()));
    check('the board sees it as used', !!(await until(async () => (await s.ok('GET', '/api/join')).codes[0].used)));
    const stored = fs.readFileSync(path.join(join.data, 'codes.json'), 'utf8');
    check('the service keeps no DM invite after use, and no names', !stored.includes(inv.dm) && !/Beatrix/.test(stored));

    // AIG-1249: cancel a link nobody used: the link reads as run out, the download is refused, a used one cannot be cancelled.
    const cx = await s.ok('POST', '/api/join/codes', { help: '2', name: 'Wrongperson' });
    check('an open link lists with a way to cancel it', (await s.ok('GET', '/api/join')).codes.some(c => c.code === cx.code && !c.used && !c.cancelled));
    check('cancel needs a code made here', (await s.api('POST', '/api/join/cancel', { code: 'ZZZZ-ZZZZ-ZZZZ' })).status === 404);
    await s.ok('POST', '/api/join/cancel', { code: cx.code });
    const cxr = await fetch(cx.link);
    check('a cancelled link says it ran out', cxr.status === 410 && /run out/.test(await cxr.text()));
    check('a cancelled link cannot be downloaded', (await fetch(join.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + cx.code })).status === 410);
    const cxl = (await s.ok('GET', '/api/join')).codes.find(c => c.code === cx.code);
    check('the board lists it as cancelled, and the service no longer holds the DM invite', cxl.cancelled === true && !/"dm":"[^"]/.test(JSON.stringify(JSON.parse(fs.readFileSync(path.join(join.data, 'codes.json'), 'utf8'))[cx.code])));
    check('a used link cannot be cancelled', (await s.api('POST', '/api/join/cancel', { code: made.code })).status === 502);

    // AIG-1231: the Windows installer. The page offers it first (the zip as the fallback), with plain steps in en, nl and nl-BE.
    const form = (code, what) => fetch(join.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + code + (what ? '&what=' + what : '') });
    const w1 = await s.ok('POST', '/api/join/codes', { help: '1', name: 'Cleo' });
    const wh = await (await fetch(w1.link)).text();
    check('the page offers the installer first and the zip as the fallback', wh.indexOf('name="what" value="exe"') > 0 && wh.indexOf('name="what" value="exe"') < wh.indexOf('name="what" value="zip"'), wh.slice(0, 300));
    check('the steps are plain: Download, Open it (More info > Run anyway), type your code', /Download it\./.test(wh) && /More info &gt; Run anyway/.test(wh) && /Type your code if it asks/.test(wh) && !/Node\.js[^<]*<\/li><li>Right-click/.test(wh.split('Not on Windows?')[0]), wh.slice(0, 600));
    const whNl = await (await fetch(w1.link + '&lng=nl')).text(), whBe = await (await fetch(w1.link, { headers: { 'accept-language': 'nl-BE' } })).text();
    check('the steps speak nl and nl-BE', /Meer informatie &gt; Toch uitvoeren/.test(whNl) && /Typ je code/.test(whNl) && /Meer informatie &gt; Toch uitvoeren/.test(whBe) && /Typ je code als het gevraagd wordt/.test(whBe));
    const wd = await form(w1.code, 'exe'), wpage = await wd.text();
    const claim = (wpage.match(/id="claim">([A-Z2-9]{4}-[A-Z2-9]{4})</) || [])[1];
    check('Download (installer) shows a short claim code and starts the download', wd.status === 200 && !!claim && /Your code/.test(wpage) && wpage.includes(`url=/join/exe?claim=${claim}`), wpage.slice(0, 400));
    check('the link is used up by it', (await form(w1.code, 'exe')).status === 410 && (await form(w1.code)).status === 410);
    const xr = await fetch(join.base + '/join/exe?claim=' + claim), xb = Buffer.from(await xr.arrayBuffer());
    check('the installer comes named after the code', xr.status === 200 && xr.headers.get('content-disposition') === `attachment; filename="AI-gile Setup (${claim}).exe"` && xb.equals(fs.readFileSync(exe)), xr.headers.get('content-disposition'));
    check('no installer for a made-up claim code', (await fetch(join.base + '/join/exe?claim=ZZZZ-ZZZZ')).status === 404);
    check('the link no longer holds the DM invite; the claim code does, until claimed', !/"dm":"[^"]/.test(JSON.stringify(JSON.parse(fs.readFileSync(path.join(join.data, 'codes.json'), 'utf8'))[w1.code])) && JSON.parse(fs.readFileSync(path.join(join.data, 'claims.json'), 'utf8'))[claim].dm.length > 40);
    const claimPost = code => fetch(join.base + '/join/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    check('a made-up claim code is refused', (await claimPost('ZZZZ-ZZZZ')).status === 404 && (await claimPost('nope')).status === 400);

    // The installed app: its first start reads the code from the installer's name (a browser may add " (1)") and fetches the invite.
    const local2 = path.join(work, 'friend2.local.json'), setupName = path.join(work, 'setup-name.txt');
    fs.writeFileSync(local2, JSON.stringify({})); fs.writeFileSync(setupName, `AI-gile Setup (${claim}) (1).exe`);
    friend2 = await startServer({ AIGILE_LOCAL: local2, AIGILE_JOIN: join.base, AIGILE_CLAIM: '1', AIGILE_SETUP_NAME: setupName, AIGILE_INVITE: path.join(work, 'none.json'), AIGILE_DM_POLL_MS: '300' }, await freePort());
    check('the installed app claims the code from the file name and links the owner', await until(async () => (await friend2.ok('GET', '/api/dms/contacts')).length === 1));
    const f2c = (await friend2.ok('GET', '/api/dms/contacts'))[0], f2s = await friend2.ok('GET', '/api/join/claim');
    check('the owner is a contact waiting for They match, the help level is set, and the welcome is due', f2c.name === 'Owner' && !f2c.checked && (await friend2.ok('GET', '/api/setup')).prefs.helpLevel === '1' && !f2s.ask && f2s.done && f2s.done.linked === 'Owner', [f2c, f2s]);
    check('AIG-1311: the welcome knows it is Cleo\'s own copy', f2s.done.friend === 'Cleo' && !f2s.share, f2s);
    check('the owner\'s board has the friend', await until(async () => (await s.ok('GET', '/api/dms/contacts')).some(c => c.name === 'Cleo')));
    const again = await claimPost(claim);
    check('a used claim code is refused', again.status === 410 && /already used/.test((await again.json()).error));
    check('the service drops the DM invite once claimed', !JSON.parse(fs.readFileSync(path.join(join.data, 'claims.json'), 'utf8'))[claim].dm);
    await friend2.ok('POST', '/api/join/claim/seen');
    check('seen: no welcome, no ask', !(await friend2.ok('GET', '/api/join/claim')).done && !(await friend2.ok('GET', '/api/join/claim')).ask);

    // AIG-1311 friendly leaks: Cleo's board leaves Friends invites at the join service, then someone else runs Cleo's installer.
    const claimsNow = () => JSON.parse(fs.readFileSync(path.join(join.data, 'claims.json'), 'utf8'))[claim];
    check('the friend\'s board keeps 3 Friends invites at the join service for newcomers', !!(await until(async () => (claimsNow().pool || []).length === 3)), claimsNow());
    const f2box = (await friend2.ok('GET', '/api/dms')).mailbox;
    const local4 = path.join(work, 'friend4.local.json'); fs.writeFileSync(local4, JSON.stringify({}));
    friend4 = await startServer({ AIGILE_OWNER: '', AIGILE_LOCAL: local4, AIGILE_JOIN: join.base, AIGILE_CLAIM: '1', AIGILE_SETUP_NAME: setupName, AIGILE_INVITE: path.join(work, 'none.json'), AIGILE_DM_POLL_MS: '300' }, await freePort());
    const f4s = await until(async () => { const x = await friend4.ok('GET', '/api/join/claim'); return x.share ? x : null; });
    check('a claimed code on another PC: a share hello with Cleo\'s first name, no code asked, nothing counted yet', !!f4s && f4s.share.friend === 'Cleo' && !f4s.ask && !f4s.done && !(claimsNow().shares || []).length, f4s);
    const p4 = await ctx.newPage(); p4.errors = []; p4.on('pageerror', e => p4.errors.push(e.message));
    await p4.setViewportSize({ width: 390, height: 800 });
    await p4.emulateMedia({ colorScheme: 'dark' });
    await p4.goto(friend4.base + '/#/setup');
    await p4.waitForSelector('#shareName', { timeout: 15000 });
    check('the newcomer sees "Ooo, nice to meet you! We\'re glad Cleo has been sharing" and the closed pre-alpha', /Ooo, nice to meet you/.test(await p4.textContent('#shareHi')) && /glad Cleo has been sharing/.test(await p4.textContent('#shareWho')) && /closed pre-alpha/.test(await p4.textContent('#shareWho')));
    check('the name box has a label and fits a phone (no sideways scroll)', /What's your name/.test(await p4.textContent('.dialog label')) && await p4.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await p4.click('#shareGo');
    check('no name: it asks for one', /Type your name/.test(await p4.textContent('#share-err')));
    await p4.fill('#shareName', 'Sam Smith'); await p4.press('#shareName', 'Enter');
    await p4.waitForSelector('#claimHi', { timeout: 15000 });
    check('then a welcome by name, and Cleo is a friend in Messages', /Welcome, Sam Smith/.test(await p4.textContent('#claimHi')) && /You and Cleo are friends/.test(await p4.textContent('#claimWho')), await p4.textContent('.dialog'));
    const f4c = await friend4.ok('GET', '/api/dms/contacts'), f4me = await friend4.ok('GET', '/api/dms');
    check('a fresh setup: own name and own keys, only Cleo as a contact (not the owner, not Cleo\'s data)', f4c.length === 1 && f4c[0].name === 'Cleo' && f4me.mailbox !== f2box && (await friend4.ok('GET', '/api/setup')).owner === 'Sam Smith', [f4c, f4me.mailbox, f2box]);
    check('Cleo\'s board gets Sam as a friend (the usual They match check)', !!(await until(async () => (await friend2.ok('GET', '/api/dms/contacts')).some(c => c.name === 'Sam Smith' && !c.checked))));
    check('the join service counted it, with the first name only, and used one invite (the friend's board may already have topped the pool back up)', claimsNow().shares.length === 1 && claimsNow().shares[0].name === 'Sam' && !JSON.stringify(claimsNow()).includes('Smith') && claimsNow().pool.length >= 2, claimsNow().shares);
    await p4.click('#claimOn'); await p4.waitForSelector('#wzYes');
    check('no page errors on the newcomer\'s first run', p4.errors.length === 0, p4.errors);
    await p4.close();
    friend4.stop(); friend4 = null;
    // Straight at the service: a share gives the friend's first name and an invite, never the owner's name; the 4th is refused.
    const shareRaw = async name => { const r = await fetch(join.base + '/join/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: claim, name }) }); return { status: r.status, j: await r.json() }; };
    const sh2 = await shareRaw('Tom');
    check('a share answer holds only the help level, Cleo\'s first name and one invite', sh2.status === 200 && sh2.j.friend === 'Cleo' && !('from' in sh2.j) && !('share' in sh2.j) && sh2.j.dm.length > 40 && Object.keys(sh2.j).sort().join() === 'dm,friend,help,shared,v', sh2.j);
    await shareRaw('Uma');
    const sh4 = await shareRaw('Vic'), ask4 = await claimPost(claim);
    check('rate limit: past JOIN_SHARE_MAX the code takes no one new (asked or named)', sh4.status === 429 && ask4.status === 429 && claimsNow().shares.length === 3, [sh4, ask4.status]);
    const full = await (async () => { const l = path.join(work, 'friend5.local.json'); fs.writeFileSync(l, '{}'); const f5 = await startServer({ AIGILE_LOCAL: l, AIGILE_JOIN: join.base, AIGILE_CLAIM: '1', AIGILE_INVITE: path.join(work, 'none.json') }, await freePort()); try { return (await f5.api('POST', '/api/join/claim', { code: claim })).body; } finally { f5.stop(); } })();
    check('the app says so in plain words', /shared a lot already/.test((full || {}).error || ''), full);
    const tok = await fetch(join.base + '/join/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'x'.repeat(43) }) });
    check('the pool needs the friend board\'s own token', tok.status === 404);

    // The owner: one inbox note per newcomer, and "shared with N" on the invite in Setup.
    const jl = await s.ok('GET', '/api/join'), cleo = jl.codes.find(c => c.code === w1.code);
    check('the owner\'s list says Cleo\'s invite was shared with 3', cleo.shared === 3 && cleo.sharedWith.join() === 'Sam,Tom,Uma', cleo);
    const notes = (await s.ok('GET', '/api/join/notes')).notes;
    check('the owner gets a note per share: "Cleo shared AI-gile with Sam"', notes.length === 3 && notes.some(n => n.friend === 'Cleo' && n.name === 'Sam'), notes);
    await s.ok('GET', '/api/join');
    check('listing again adds no copies', (await s.ok('GET', '/api/join/notes')).notes.length === 3);
    const po = await openPage(ctx, '#/inbox');
    await po.waitForSelector('#ibShareNotes:not([hidden]) .sn-item', { timeout: 20000 });
    check('inbox: the notes show, with a count', /Cleo shared AI-gile with Sam/.test(await po.textContent('#ibShareNotes')) && (await po.textContent('#ibSnN')).trim() === '3');
    await po.click('#ibShareNotes .sn-item .sn-ok');
    await po.waitForFunction(() => document.querySelectorAll('#ibShareNotes .sn-item').length === 2);
    check('OK clears one note', (await s.ok('GET', '/api/join/notes')).notes.length === 2);
    await po.click('#snAll');
    await po.waitForFunction(() => document.getElementById('ibShareNotes').hidden);
    check('All seen clears the rest', (await s.ok('GET', '/api/join/notes')).notes.length === 0);
    await po.goto(po.url().replace(/#.*$/, '#/setup')); await po.waitForSelector('#joinSec .join-shared', { timeout: 15000 });
    check('Setup: the invite shows "shared with 3 people"', /shared with 3 people/.test(await po.textContent('#joinSec')));
    check('no page errors on the owner\'s inbox and Setup', po.errors.length === 0, po.errors);
    await po.close();
    friend2.stop(); friend2 = null;

    // No code in the name: the first run asks for it (No-AI friendly), a wrong code says so, the right one says welcome.
    const w2 = await s.ok('POST', '/api/join/codes', { help: '2', name: 'Dex' });
    const claim2 = ((await (await form(w2.code, 'exe')).text()).match(/id="claim">([A-Z2-9]{4}-[A-Z2-9]{4})</) || [])[1];
    const local3 = path.join(work, 'friend3.local.json'), plainName = path.join(work, 'setup-plain.txt');
    fs.writeFileSync(local3, JSON.stringify({})); fs.writeFileSync(plainName, 'AI-gile Setup 1.0.0.exe');
    friend3 = await startServer({ AIGILE_LOCAL: local3, AIGILE_JOIN: join.base, AIGILE_CLAIM: '1', AIGILE_SETUP_NAME: plainName, AIGILE_INVITE: path.join(work, 'none.json'), AIGILE_DM_POLL_MS: '300' }, await freePort());
    check('no code in the name: the app asks for one', (await friend3.ok('GET', '/api/join/claim')).ask === true);
    const pf = await ctx.newPage(); pf.errors = []; pf.on('pageerror', e => pf.errors.push(e.message));
    await pf.goto(friend3.base + '/#/setup');
    await pf.waitForSelector('#claimCode', { timeout: 15000 });
    check('the first run asks "Got a code?"', /Got a code/.test(await pf.textContent('.dialog')));
    await pf.fill('#claimCode', 'abcd-ef23'); await pf.click('#claimGo');
    await pf.waitForFunction(() => /not right/.test(document.getElementById('claim-err').textContent));
    check('a wrong code says so in plain words', /check it and try again/.test(await pf.textContent('#claim-err')));
    // AIG-1248: the claim errors come in the friend's language (the page sends its own, as a fresh app has saved none).
    const nlErr = async code => ((await friend3.api('POST', '/api/join/claim', { code, lang: 'nl' })).body || {}).error || '';
    check('claim errors speak Dutch: wrong code and bad shape', /klopt niet/.test(await nlErr('ABCD-EF24')) && /8 letters en cijfers/.test(await nlErr('nope')));
    check('claim errors speak nl-BE and fall back to English', /controleer hem en probeer opnieuw/.test(((await friend3.api('POST', '/api/join/claim', { code: 'ABCD-EF24', lang: 'nl-BE' })).body || {}).error || '') && /check it and try again/.test(((await friend3.api('POST', '/api/join/claim', { code: 'ABCD-EF24', lang: 'xx' })).body || {}).error || ''));
    await pf.fill('#claimCode', claim2.toLowerCase().replace('-', ' ')); await pf.press('#claimCode', 'Enter');
    await pf.waitForSelector('#claimWho', { timeout: 15000 });
    check('AIG-1311: the friend\'s own copy greets them by name', /This is your copy, Dex/.test(await pf.textContent('#claimHi')), await pf.textContent('#claimHi'));
    check('the right code (any case, any spacing) says welcome and who they are linked to', /linked to Owner/.test(await pf.textContent('#claimWho')) && /They match/.test(await pf.textContent('.dialog')) && /don't need an AI program/.test(await pf.textContent('.dialog')));
    await pf.click('#claimOn'); await pf.waitForSelector('#wzYes');
    check('then the usual first-run choices', (await pf.isVisible('#wzNo')) && !(await friend3.ok('GET', '/api/join/claim')).done);
    check('the friend\'s board is linked', (await friend3.ok('GET', '/api/dms/contacts')).length === 1 && (await claimPost(claim2)).status === 410);
    check('no page errors on the friend\'s first run', pf.errors.length === 0, pf.errors);
    await pf.close();
    friend3.stop(); friend3 = null;

    // Expiry.
    const ex = signed(other.privateKey, otherPub, 'GET', '/join/codes');
    check('listing codes needs the owner key too', (await fetch(join.base + '/join/codes', { headers: ex.headers })).status === 403);
    join.stop();
    // A fresh service where this one's test key is the owner: a code that runs out in a second.
    const mine = crypto.generateKeyPairSync('ed25519'), minePub = mine.publicKey.export({ format: 'jwk' }).x;
    const j2 = await startJoin(minePub, zip, { JOIN_EXE: exe, JOIN_CLAIM_DAYS: '0.00001' });
    try {
      const add = signed(mine.privateKey, minePub, 'POST', '/join/codes', { code: 'EXPI-RED2-CODE', help: '1', days: 0.00001 });
      check('the owner key adds a code', (await fetch(j2.base + '/join/codes', { method: 'POST', ...add })).status === 201);
      check('a fresh code shows its page', (await fetch(j2.base + '/join?code=EXPI-RED2-CODE')).status === 200);
      // AIG-1231: a claim code that runs out (JOIN_CLAIM_DAYS here is about a second).
      const add2 = signed(mine.privateKey, minePub, 'POST', '/join/codes', { code: 'CLAI-MRUN-OUT2', help: '1', days: 1 });
      await fetch(j2.base + '/join/codes', { method: 'POST', ...add2 });
      const cp = await (await fetch(j2.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=CLAI-MRUN-OUT2&what=exe' })).text();
      const short = (cp.match(/id="claim">([A-Z2-9]{4}-[A-Z2-9]{4})</) || [])[1];
      await sleep(1500);
      const late = await fetch(j2.base + '/join/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: short }) });
      check('a claim code that ran out is refused, and so is its installer link', !!short && late.status === 410 && /run out/.test((await late.json()).error) && (await fetch(j2.base + '/join/exe?claim=' + short)).status === 410);
      check('an expired code gets "run out" on the page', /run out/.test(await (await fetch(j2.base + '/join?code=EXPI-RED2-CODE')).text()));
      const d2 = await fetch(j2.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=EXPI-RED2-CODE' });
      check('an expired code cannot download', d2.status === 410 && !/zip/.test(d2.headers.get('content-type')));
    } finally { j2.stop(); }

    // A fresh board applies invite.json on its first start.
    const local = path.join(work, 'friend.local.json');
    fs.writeFileSync(local, JSON.stringify({ owner: 'Beatrix' }));
    const invFile = path.join(work, 'invite.json');
    fs.copyFileSync(inviteFile, invFile);
    friend = await startServer({ AIGILE_LOCAL: local, AIGILE_INVITE: invFile, AIGILE_DM_POLL_MS: '300' }, await freePort());
    check('the friend\'s help level is saved as a pref', await until(async () => (await friend.ok('GET', '/api/setup')).prefs.helpLevel === '3'), (await friend.ok('GET', '/api/setup')).prefs);
    check('the friend\'s board turned DMs on and linked the owner', await until(async () => (await friend.ok('GET', '/api/dms/contacts')).length === 1));
    const fc = (await friend.ok('GET', '/api/dms/contacts'))[0];
    check('the owner is the contact, with the 6 safety words', fc.name === 'Owner' && fc.safety.split(' ').length === 6, fc);
    check('invite.json is used up (renamed)', !fs.existsSync(invFile) && fs.existsSync(path.join(work, 'invite.applied.json')));
    check('the owner\'s board has the friend already, under the name given', await until(async () => (await s.ok('GET', '/api/dms/contacts')).some(c => c.name === 'Beatrix')));
    const oc = (await s.ok('GET', '/api/dms/contacts')).find(c => c.name === 'Beatrix');
    check('both boards show the same safety words', !!oc && oc.safety === fc.safety, [oc && oc.safety, fc.safety]);
    const fdata = friend.data; friend.stop(); await sleep(300);
    friend = await startServer({ AIGILE_LOCAL: local, AIGILE_INVITE: invFile, AIGILE_DM_POLL_MS: '300', AIGILE_DATA: fdata }, await freePort());
    await sleep(500);
    check('a restart does not apply it again', (await friend.ok('GET', '/api/dms/contacts')).length === 1);
  } finally { for (const f of [friend, friend2, friend3, friend4]) if (f) f.stop(); join.stop(); relay.stop(); }

  // The Setup box, with a join service of its own (the first one is stopped).
  const j3 = await startJoin(ownerKey, zip);
  try {
    await s.ok('POST', '/api/join/settings', { url: j3.base });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const pa = await openPage(ctx, '#/setup'); pa.on('response', r => { if (r.status() >= 500) pa.errors.push('500 ' + r.url()); });
    await pa.waitForSelector('#joinSec #joinMake');
    check('Setup has the 🎟️ Invite a friend box', /Friend needs AI-gile/.test(await pa.textContent('#joinSec')));
    await pa.selectOption('#joinHelp', '1'); await pa.fill('#joinName', 'Cato');
    await pa.click('#joinMake');
    await pa.waitForSelector('#joinLink');
    const link = await pa.inputValue('#joinLink');
    check('Make an invite link shows the link', link.startsWith(j3.base + '/join?code='), link);
    await pa.click('#joinCopy');
    await pa.waitForFunction(() => /Copied/.test(document.getElementById('join-msg').textContent));
    check('Copy puts the link on the clipboard', (await pa.evaluate(() => navigator.clipboard.readText()).catch(() => link)) === link);
    await pa.waitForSelector('.join-c');
    check('the open links list shows it as unused with when it runs out', /Cato/.test(await pa.textContent('.join-c')) && /unused, runs out in (6|7) days/.test(await pa.textContent('.join-c')), await pa.textContent('.join-c'));
    await fetch(j3.base + '/join/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + link.split('=')[1] });
    await pa.reload(); await pa.waitForSelector('.join-c');
    check('after the download the list says used', await until(async () => /used/.test(await pa.textContent('.join-c').catch(() => ''))) );
    for (const [lng, re] of [['nl', /Vriend heeft AI-gile nodig/], ['nl-BE', /Vriend heeft AI-gile nodig/]]) {
      await pa.evaluate(l => localStorage.setItem('aigile.lang', l), lng); await pa.reload(); await pa.waitForSelector('#joinMake');
      check('texts in ' + lng, re.test(await pa.textContent('#joinSec')) && /Maak een uitnodigingslink/.test(await pa.textContent('#joinMake')) && /gebruikt/.test(await pa.textContent('.join-c')));
    }
    await pa.evaluate(() => localStorage.setItem('aigile.lang', 'en'));
    check('no page errors', pa.errors.length === 0, pa.errors);
  } finally { j3.stop(); await s.ok('POST', '/api/join/settings', { url: '' }); }
}, true);
