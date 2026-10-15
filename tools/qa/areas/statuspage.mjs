// QA area: statuspage (AIG-1050): public services go to the relay as { name, offers, state, line, at } and show on site/status.html.
// A major incident is red with its "Status:" line, an ordinary open incident amber, none green; a non-public service never appears;
// no card title or text leaks; the page is plain, phone width, dark mode, "All quiet" when empty.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { freePort, startRelay, startServer, until, check, sleep, mkProject, mkCard, say, ROOT, def } from '../lib.mjs';

const SECRET = 'SECRET-CARD-TITLE', SECRET_TXT = 'SECRET-COMMENT-TEXT';

def('statuspage', '🟢 status page: public services reach the relay /status.json (red major, amber open incident, green), a non-public one never, no titles leak; site/status.html rows, All quiet, phone width, dark (AIG-1050)', async (s, ctx) => {
  const key = (await s.ok('GET', '/api/licences')).key;   // only the operator's board (RELAY_STATS_KEY) may publish (AIG-1119)
  const relay = await startRelay({ RELAY_STATS_KEY: key }), b = await startServer({ AIGILE_DM_POLL_MS: '300', AIGILE_PUBLIC_MS: '300' }, await freePort());
  try {
    // a stranger's self-signed POST is refused, even on a fresh relay (no trust on first use)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'), x = publicKey.export({ format: 'jwk' }).x;
    const bad = JSON.stringify({ services: [{ name: 'Hijack', state: 'red' }] }), ts = String(Date.now()), nonce = crypto.randomBytes(12).toString('base64url');
    const sig = crypto.sign(null, Buffer.from(['aigile-relay-v1', 'POST', '/status', ts, nonce, crypto.createHash('sha256').update(bad).digest('hex')].join('\n')), privateKey).toString('base64url');
    const hj = await fetch(relay.base + '/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-relay-key': x, 'x-relay-ts': ts, 'x-relay-nonce': nonce, 'x-relay-sig': sig }, body: bad });
    check('a stranger key cannot claim or publish the status page', hj.status === 403, hj.status);
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    const json = async () => (await fetch(relay.base + '/status.json')).json();
    const empty = await fetch(relay.base + '/status.json');
    check('/status.json is served with CORS and says no services at first', empty.status === 200 && empty.headers.get('access-control-allow-origin') === '*' && (await empty.json()).services.length === 0);

    await mkProject(s, 'Radio Pub', 'RAD'); await mkProject(s, 'Hidden Svc', 'HID');
    await s.ok('PATCH', '/api/projects/radio-pub', { service: { on: true, offers: 'Radio streaming', public: true } });
    await s.ok('PATCH', '/api/projects/hidden-svc', { service: { on: true, offers: 'Secret thing' } });
    const inc = await mkCard(s, 'radio-pub', SECRET, { type: 'incident', description: SECRET_TXT });
    const inc2 = await mkCard(s, 'hidden-svc', 'Hidden incident', { type: 'incident' });
    await say(s, 'hidden-svc', inc2.id, 'Forge', 'Status: hidden outage line');
    await say(s, 'radio-pub', inc.id, 'Forge', SECRET_TXT);
    await say(s, 'radio-pub', inc.id, 'Forge', 'Status: Looking into it');
    // the relay caches for 30 s, so an early (empty) read may linger: wait for the new text
    let j = await json(); const t0 = Date.now();
    while (!(j.services.length && j.services[0].line) && Date.now() - t0 < 45000) { await sleep(1000); j = await json(); }
    const text = JSON.stringify(j), r = j.services[0] || {};
    check('the public service shows amber with its status line, name and offers', j.services.length === 1 && r.name === 'Radio Pub' && r.offers === 'Radio streaming' && r.state === 'amber' && r.line === 'Looking into it' && !!r.at, j);
    check('the non-public service never appears', !/Hidden|Secret thing|hidden outage/.test(text), text);
    check('no card title or other comment leaks', !text.includes(SECRET) && !text.includes(SECRET_TXT) && Object.keys(r).sort().join() === 'at,line,name,offers,state', text);
  } finally { relay.stop(); try { await b.stop(); } catch {} }

  // AIG-1119: after a board restart, unticking Public still takes the service off the relay
  {
    const b1 = await startServer({ AIGILE_PUBLIC_MS: '300' }, await freePort());
    const relay2 = await startRelay({ RELAY_STATS_KEY: (await b1.ok('GET', '/api/licences')).key });
    let b2 = null;
    try {
      await b1.ok('POST', '/api/dms/settings', { relay: relay2.base });
      await mkProject(b1, 'Restart Pub', 'RSP');
      await b1.ok('PATCH', '/api/projects/restart-pub', { service: { on: true, offers: 'Radio', public: true } });
      const names = async () => (await (await fetch(relay2.base + '/status.json')).json()).services.map(x => x.name);
      check('a public service is published before the restart', !!(await until(async () => (await names()).includes('Restart Pub'), 15000)), await names());
      await b1.stop();
      b2 = await startServer({ AIGILE_PUBLIC_MS: '300', AIGILE_DATA: b1.data, AIGILE_LOCAL: path.join(b1.dir, 'aigile.local.json') }, await freePort());
      await b2.ok('PATCH', '/api/projects/restart-pub', { service: { on: true, offers: 'Radio', public: false } });
      check('after a restart, unticking Public takes it off the relay', !!(await until(async () => !(await names()).includes('Restart Pub'), 15000)), await names());
    } finally { relay2.stop(); try { await b1.stop(); } catch {} try { if (b2) await b2.stop(); } catch {} }
  }

  // red: a major incident (c.major, AIG-1049) beats the amber one; the line comes from the worst incident
  const SP = (await import('../../../lib/statuspage.js')).default;
  const mk = (name, service, cards) => ({ slug: name.toLowerCase(), name, service, cards, updated: '2026-10-14T10:00:00Z' });
  const inc = (id, extra, comments) => ({ id, title: SECRET, type: 'incident', status: 'doing', comments: comments || [], ...extra });
  const out = SP.compute([
    mk('Pub', { on: true, offers: 'Radio', public: true }, [inc('P-1', {}, [{ text: 'Status: minor wobble', at: '2026-10-14T09:00:00Z' }]), inc('P-2', { major: true }, [{ text: SECRET_TXT, at: '2026-10-14T09:30:00Z' }, { text: 'Status: Stream is down', at: '2026-10-14T09:40:00Z' }]), { id: 'P-3', title: 'a bug', type: 'bug', status: 'doing' }]),
    mk('Quiet', { on: true, public: true }, [inc('Q-1', { major: true }, []), inc('Q-2', { status: 'done' })]),
    mk('Green', { on: true, public: true }, []),
    mk('Amber', { on: true, public: true }, [inc('A-1', {})]),
    mk('Private', { on: true }, [inc('X-1', { major: true })]),
    mk('Off', { on: false, public: true }, []),
  ]);
  const by = n => out.find(x => x.name === n) || {};
  check('red for a major incident with the Status: line of the worst incident', by('Pub').state === 'red' && by('Pub').line === 'Stream is down' && by('Pub').at === '2026-10-14T09:40:00Z', by('Pub'));
  check('major without a status line is red with an empty line; no incident is green; a missing major is amber', by('Quiet').state === 'red' && by('Quiet').line === '' && by('Green').state === 'green' && by('Amber').state === 'amber');
  check('non-public and switched-off services are not listed, nothing else leaks', out.length === 4 && !JSON.stringify(out).includes(SECRET) && !JSON.stringify(out).includes(SECRET_TXT), out);

  // the page, file:// with a stubbed fetch
  const url = pathToFileURL(path.join(ROOT, 'site', 'status.html')).href, ago = m => new Date(Date.now() - m * 60000).toISOString();
  const open = async body => {
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(b => { window.__n = 0; window.fetch = () => { window.__n++; return Promise.resolve({ ok: true, json: () => Promise.resolve(b) }); }; }, body);
    await page.goto(url); await sleep(400); page.errs = errs; return page;
  };
  const page = await open({ services: [{ name: 'Radio', offers: 'Streaming', state: 'red', line: 'Stream is down', at: ago(5) }, { name: 'Web', offers: '', state: 'amber', line: '', at: ago(30) }, { name: 'API', offers: 'Data', state: 'green', line: '', at: ago(0) }] });
  const rows = await page.$$eval('#list li', l => l.map(e => e.textContent));
  check('one row per service with colour, name, offers, status line and updated N min ago', rows.length === 3 && rows[0].includes('🔴') && /Radio/.test(rows[0]) && /Streaming/.test(rows[0]) && /Stream is down/.test(rows[0]) && /updated 5 min ago/.test(rows[0]) && rows[1].includes('🟠') && rows[2].includes('🟢'), rows);
  check('All quiet is hidden while services show', await page.$eval('#quiet', e => e.hidden));
  await page.setViewportSize({ width: 360, height: 700 }); await page.emulateMedia({ colorScheme: 'dark' });
  check('no sideways scroll at phone width and dark mode applies', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.body).backgroundColor === 'rgb(18, 21, 27)'));
  check('it polls the relay status.json', await page.evaluate(() => window.__n >= 1));
  check('no page errors', page.errs.length === 0, page.errs);
  const p2 = await open({ services: [] });
  check('no services says All quiet', await p2.$eval('#quiet', e => !e.hidden && e.textContent.trim() === 'All quiet') && (await p2.$$('#list li')).length === 0);
  check('the teaser footer links to Status', /<footer>[^]*href="status.html"[^]*<\/footer>/.test(fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8')));
  await page.close(); await p2.close();
}, true);
