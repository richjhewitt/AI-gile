// QA area: sitepass (AIG-699): test site passes. The owner's board makes a one-use pass link (signed, through a local join
// service); the Open button uses it up and sets an HttpOnly cookie; /join/site/check (what nginx asks on every request of a
// private site) says 204 with a good pass and 401 without; a pass code never downloads the app; End pass and sign out work;
// the check is never rate limited. Also the Setup box button and list row.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, freePort, check, sleep, openPage, tmp, def } from '../lib.mjs';

async function startJoin(ownerKey, extraEnv = {}) {
  const port = await freePort(), data = path.join(tmp('sitepass'), 'data');
  const proc = spawn(process.execPath, [path.join(ROOT, 'relay', 'join.js')], { env: { ...process.env, JOIN_PORT: String(port), JOIN_HOST: '127.0.0.1', JOIN_DATA: data, JOIN_OWNER_KEY: ownerKey, JOIN_RATE: '100000', ...extraEnv }, stdio: 'ignore', windowsHide: true });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(100); }
  return { base, data, stop: () => { try { proc.kill(); } catch {} } };
}
const form = code => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'code=' + code, redirect: 'manual' });

def('sitepass', 'test site passes: one-use link sets an HttpOnly cookie, /join/site/check 204/401 for nginx, never downloads the app, End pass, sign out, check not rate limited, Setup button (AIG-699)', async (s, ctx) => {
  await s.ok('POST', '/api/dms/settings', { on: true }).catch(() => {});
  const ownerKey = (await s.ok('GET', '/api/join')).ownerKey;
  const join = await startJoin(ownerKey);
  const SITE = 'http://site.test';
  try {
    await s.ok('POST', '/api/join/settings', { url: join.base, site: SITE });
    check('the join settings keep the test site address', (await s.ok('GET', '/api/join')).site === SITE);
    const made = await s.ok('POST', '/api/join/site', { name: 'Mo' });
    check('the board makes a pass link on the test site', made.link === `${SITE}/join/site?code=${made.code}`, made);
    const at = join.base + '/join/site?code=' + made.code;
    const page = await (await fetch(at)).text();
    check('the pass page has an Open button and does not use the code', /Open the test site/.test(page) && /action="\/join\/site"/.test(page) && (await fetch(join.base + '/join/site/check')).status === 401);
    check('the pass page speaks nl', /testsite/.test(await (await fetch(at + '&lng=nl')).text()));
    check('a pass code never shows the app download', (await fetch(join.base + '/join?code=' + made.code)).status === 404
      && !/zip/.test((await fetch(join.base + '/join/download', form(made.code))).headers.get('content-type') || ''));

    const open = await fetch(join.base + '/join/site', form(made.code));
    const set = open.headers.get('set-cookie') || '', tok = (set.match(/aigile_pass=([A-Za-z0-9_-]{43})/) || [])[1];
    check('Open uses the code: 303 to the site with an HttpOnly, Secure, SameSite=Lax cookie for 90 days', open.status === 303 && open.headers.get('location') === '/' && !!tok
      && /HttpOnly/.test(set) && /Secure/.test(set) && /SameSite=Lax/.test(set) && /Max-Age=7776000/.test(set), set);
    const cookie = { headers: { cookie: 'x=1; aigile_pass=' + tok } };
    check('the check says 204 with the pass, 401 with a made-up one', (await fetch(join.base + '/join/site/check', cookie)).status === 204
      && (await fetch(join.base + '/join/site/check', { headers: { cookie: 'aigile_pass=' + 'A'.repeat(43) } })).status === 401);
    check('the link works only once', (await fetch(join.base + '/join/site', form(made.code))).status === 410);
    check('a browser with a pass gets "already has a pass" on the link', /already has a pass/.test(await (await fetch(at, cookie)).text()));
    check('only a hash of the pass is kept', !fs.readFileSync(path.join(join.data, 'passes.json'), 'utf8').includes(tok));
    const row = (await s.ok('GET', '/api/join')).codes.find(c => c.code === made.code);
    check('the board lists it as a site pass in use', row && row.kind === 'site' && !!row.used && row.passes === 1, row);

    const unsigned = await fetch(join.base + '/join/site/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: made.code }) });
    check('ending a pass needs the owner signature', unsigned.status === 401 && (await fetch(join.base + '/join/site/check', cookie)).status === 204);
    await s.ok('POST', '/api/join/revoke', { code: made.code });
    check('End pass: the browser is out', (await fetch(join.base + '/join/site/check', cookie)).status === 401 && (await s.ok('GET', '/api/join')).codes.find(c => c.code === made.code).passes === 0);

    const m2 = await s.ok('POST', '/api/join/site', {});
    const t2 = ((await fetch(join.base + '/join/site', form(m2.code))).headers.get('set-cookie') || '').match(/aigile_pass=([A-Za-z0-9_-]{43})/)[1];
    const out = await fetch(join.base + '/join/site/out', { method: 'POST', headers: { cookie: 'aigile_pass=' + t2 }, redirect: 'manual' });
    check('sign out clears the cookie and ends the pass', out.status === 303 && /Max-Age=0/.test(out.headers.get('set-cookie') || '') && (await fetch(join.base + '/join/site/check', { headers: { cookie: 'aigile_pass=' + t2 } })).status === 401);
  } finally { join.stop(); }

  // nginx asks the check for every file: it is never rate limited, unlike the pages
  const slow = await startJoin(ownerKey, { JOIN_RATE: '3' });
  try {
    const checks = await Promise.all(Array.from({ length: 12 }, () => fetch(slow.base + '/join/site/check').then(r => r.status)));
    const pages = []; for (let i = 0; i < 5; i++) pages.push((await fetch(slow.base + '/join/site?code=AAAA-AAAA-AAAA')).status);
    check('the check is not rate limited, pages are', checks.every(x => x === 401) && pages.includes(429), { checks, pages });
  } finally { slow.stop(); }

  // The Setup box
  const j3 = await startJoin(ownerKey);
  try {
    await s.ok('POST', '/api/join/settings', { url: j3.base, site: SITE });
    const pa = await openPage(ctx, '#/setup'); pa.on('response', r => { if (r.status() >= 500) pa.errors.push('500 ' + r.url()); });
    await pa.waitForSelector('#joinSec #joinSite');
    await pa.fill('#joinName', 'Pip');
    await pa.click('#joinSite');
    await pa.waitForSelector('#joinLink');
    check('🌐 Make a test site pass shows a pass link on the test site', (await pa.inputValue('#joinLink')).startsWith(SITE + '/join/site?code='));
    await pa.waitForSelector('.join-c .join-end');
    check('the list shows the 🌐 pass with End pass', /🌐 Pip/.test(await pa.textContent('.join-c')));
    pa.on('dialog', d => d.accept());
    await pa.click('.join-c .join-end');
    await pa.waitForFunction(() => /Pass ended/.test(document.getElementById('join-msg').textContent));
    check('End pass on an unused link stops the link too', (await fetch(j3.base + '/join/site?code=' + (await s.ok('GET', '/api/join')).codes.find(c => c.kind === 'site').code)).status === 410);
    check('no page errors', pa.errors.length === 0, pa.errors);
  } finally { j3.stop(); await s.ok('POST', '/api/join/settings', { url: '', site: '' }); }
}, true);
