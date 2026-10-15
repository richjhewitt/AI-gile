// QA area: people (AIG-1314): 👥 Humans and Agents. The operator's board sends { humans, agents, working } to the relay (signed POST /people,
// RELAY_STATS_KEY only), the relay serves /people.json (CORS *, no names); the teaser shows "👥 n humans · 🤖 n agents", counts up on a change
// (not with reduced motion), plurals, hidden while the relay can't be reached, 390px, dark and black.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { freePort, startRelay, startServer, until, check, sleep, mkProject, ROOT, def } from '../lib.mjs';

def('people', '👥 Humans and Agents: the operator board sends three counts to the relay /people.json (signed, others refused, no names); the teaser line, count-up, plurals, hidden on error, 390px, dark/black (AIG-1314)', async (s, ctx) => {
  const b = await startServer({ AIGILE_DM_POLL_MS: '300', AIGILE_PEOPLE_MS: '300' }, await freePort());
  const relay = await startRelay({ RELAY_STATS_KEY: (await b.ok('GET', '/api/licences')).key });
  try {
    const json = async () => (await fetch(relay.base + '/people.json')).json();
    const first = await fetch(relay.base + '/people.json');
    check('/people.json is served with CORS and is empty before the first post', first.status === 200 && first.headers.get('access-control-allow-origin') === '*' && JSON.stringify(await first.json()) === '{}');
    const unsigned = await fetch(relay.base + '/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"humans":99,"agents":99}' });
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'), x = publicKey.export({ format: 'jwk' }).x;
    const bad = JSON.stringify({ humans: 99, agents: 99 }), ts = String(Date.now()), nonce = crypto.randomBytes(12).toString('base64url');
    const sig = crypto.sign(null, Buffer.from(['aigile-relay-v1', 'POST', '/people', ts, nonce, crypto.createHash('sha256').update(bad).digest('hex')].join('\n')), privateKey).toString('base64url');
    const stranger = await fetch(relay.base + '/people', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-relay-key': x, 'x-relay-ts': ts, 'x-relay-nonce': nonce, 'x-relay-sig': sig }, body: bad });
    check('an unsigned post is refused (401), a stranger key too (403)', unsigned.status === 401 && stranger.status === 403, [unsigned.status, stranger.status]);

    await mkProject(b, 'Crew One', 'CRO'); await mkProject(b, 'Crew Two', 'CRT');
    await b.ok('POST', '/api/projects/crew-one/team', { name: 'Forge', role: 'Lead' });
    await b.ok('POST', '/api/projects/crew-one/team', { name: 'Courier', role: 'Backend' });
    await b.ok('POST', '/api/projects/crew-one/team', { name: 'Sam Person', kind: 'person' });
    await b.ok('POST', '/api/projects/crew-two/team', { name: 'Scout', role: 'QA' });
    await b.ok('POST', '/api/projects/crew-two/team', { name: 'Oldie', status: '🪦 retired' });
    await b.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const got = await until(async () => { const j = await json(); return j.agents === 3 ? j : null; }, 15000);
    check('the board sends 1 human (the owner) and 3 agents (no person, no retired one)', got && got.humans === 1 && got.agents === 3 && got.working === 0, got || await json());

    // a friend joins from an invite link: their contact id is the invite's id, so they count as a human (the friend is the QA board)
    await s.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await b.ok('POST', '/api/dms/invites', { name: 'Friend' });
    await s.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Owner' });
    await until(async () => (await b.ok('GET', '/api/dms/contacts')).some(c => c.id === inv.id), 10000);
    fs.mkdirSync(path.join(b.data, 'join'), { recursive: true });
    fs.writeFileSync(path.join(b.data, 'join', 'codes.json'), JSON.stringify([{ code: 'AAAA-BBBB-CCCC', help: '2', inv: inv.id, created: Date.now() }, { code: 'DDDD-EEEE-FFFF', help: '2', inv: 'feedfeedfeed', created: Date.now() }, { code: 'GGGG-HHHH-JJJJ', kind: 'site', created: Date.now() }]));
    const two = await until(async () => { const j = await json(); return j.humans === 2 ? j : null; }, 15000);
    const text = JSON.stringify(two || await json());
    check('a friend who joined counts as a human; an unused link and a site pass do not', two && two.humans === 2 && two.agents === 3, text);
    check('only counts reach the relay: no names, no codes', Object.keys(two || {}).sort().join() === 'agents,at,humans,working' && !/Forge|Friend|Owner|AAAA|Crew/.test(text), text);
    await sleep(800);
    check('the friend board (not the operator) never replaced the numbers', (await json()).humans === 2);
  } finally { relay.stop(); try { await b.stop(); } catch {} }

  // the teaser line, file:// with a stubbed fetch
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    window.__ppl = { humans: 3, agents: 153, working: 2 };
    window.fetch = u => { const body = /\/people\.json$/.test(u) ? window.__ppl : null;
      return Promise.resolve(body ? { ok: true, json: () => Promise.resolve(body) } : { ok: false, json: () => Promise.reject(new Error('404')) }); };
  });
  await page.goto(pathToFileURL(path.join(ROOT, 'site', 'index.html')).href);
  await page.waitForSelector('#people-count:not([hidden])', { timeout: 5000 });
  const line = () => page.$eval('#people-count', e => e.textContent);
  check('the teaser shows "👥 3 humans · 🤖 153 agents · ⚡ 2 at work right now"', (await line()) === '👥 3 humans·🤖 153 agents·⚡ 2 at work right now', await line());
  const refresh = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => { window.__ppl = { humans: 3, agents: 253, working: 0 }; });
  await refresh(); await sleep(150);
  const mid = await page.$eval('#pc-agents', e => +e.textContent);
  await sleep(900);
  check('a new number counts up (153 -> 253); nobody at work: that part goes', mid > 153 && mid < 253 && (await line()) === '👥 3 humans·🤖 253 agents', [mid, await line()]);
  await page.evaluate(() => { window.__ppl = { humans: 1, agents: 1, working: 1 }; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await refresh(); await sleep(60);
  check('plurals: 1 human, 1 agent; reduced motion: the number just changes', (await line()) === '👥 1 human·🤖 1 agent·⚡ 1 at work right now', await line());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.evaluate(() => { window.__ppl = { humans: 123456, agents: 987654, working: 55555 }; }); await refresh(); await sleep(900);
  const look = () => page.evaluate(() => { const e = document.getElementById('people-count'), b = e.querySelector('b'); return { wide: document.documentElement.scrollWidth <= innerWidth, fits: e.getBoundingClientRect().right <= innerWidth, num: getComputedStyle(b).color, txt: getComputedStyle(e).color, bg: getComputedStyle(document.body).backgroundColor }; });
  const root = (t, bl) => page.evaluate(([t, bl]) => { const r = document.documentElement; r.setAttribute('data-theme', t); if (bl) r.setAttribute('data-black', ''); else r.removeAttribute('data-black'); }, [t, bl]);
  await root('light', false); const li = await look();
  await root('dark', false); const dk = await look();
  await root('dark', true); const bk = await look();
  const ok = x => x.wide && x.fits && x.num !== x.bg && x.txt !== x.bg;
  check('at 390px big numbers fit, no sideways scroll; readable in light, dark and black', ok(li) && ok(dk) && ok(bk) && bk.bg === 'rgb(0, 0, 0)' && li.bg !== dk.bg, { li, dk, bk });
  await root('light', false);
  await page.evaluate(() => { window.__ppl = null; }); await refresh(); await sleep(100);
  check('hidden while the relay cannot be reached', await page.$eval('#people-count', e => e.hidden));
  await page.evaluate(() => { window.__ppl = { humans: 0, agents: 5 }; }); await refresh(); await sleep(100);
  check('nonsense from the relay (0 humans) keeps it hidden', await page.$eval('#people-count', e => e.hidden));
  check('no page errors', errs.length === 0, errs);
  await page.close();
}, true);
