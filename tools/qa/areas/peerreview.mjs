// QA area: peerreview (AIG-993, AIG-994): the project setting `peerReview` (off when missing, owner only to change); with it on, a card
// handed over with `aigile test` starts exactly ONE hidden review run by the other engine (Claude work -> Codex, Codex work -> Claude),
// none when it is off or in No Token Mode; Codex not installed = a one-line "skipped" comment. Both agents are stub scripts: no real AI run.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { check, sleep, until, tmp, mkProject, mkCard, getCard, openPage, def } from '../lib.mjs';

const require = createRequire(import.meta.url);
const dir = tmp('peerrev'), stub = path.join(dir, 'codex-stub' + require('../../../lib/platform').stubExt()), out = path.join(dir, 'codex-out.txt');

def('peerreview', '🔍 peer review: setting off by default and owner only; on = one hidden review run per handover by the other engine, none when off or in No Token Mode, a skipped comment when the engine is missing (AIG-993/994)', async (s, ctx) => {
  const proj = tmp('revproj');
  await mkProject(s, 'Rev', 'REV', { path: proj });
  await s.ok('POST', '/api/projects/rev/team', { name: 'Dev', role: 'Backend' });                   // Claude (no engine stored)
  await s.ok('POST', '/api/projects/rev/team', { name: 'Cody', role: 'Backend', engine: 'codex' });
  const claudeOut = () => { try { return fs.readFileSync(s.wakeOut, 'utf8'); } catch { return ''; } };
  const codexOut = () => { try { return fs.readFileSync(out, 'utf8'); } catch { return ''; } };
  const log = () => { try { return fs.readFileSync(path.join(s.data, 'logs', 'rev.log'), 'utf8'); } catch { return ''; } };
  const count = re => (log().match(re) || []).length;
  const proc = () => s.api('GET', '/api/projects/rev');
  const asWho = (where, as, method, url, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(r => r.status);
  const hand = (id, as = 'Dev') => s.cli(['test', 'rev', id, 'Open it and click the thing.', '--as', as]);

  // 1. The setting: off by default, owner only.
  check('peerReview is off by default', !(await s.ok('GET', '/api/projects/rev')).peerReview);
  check('a team cannot switch peerReview', (await asWho('cli', 'Rev Lead', 'PATCH', '/api/projects/rev', { peerReview: true })) === 403 && !(await s.ok('GET', '/api/projects/rev')).peerReview);
  check('a background call cannot switch it either', (await asWho('background', '', 'PATCH', '/api/projects/rev', { peerReview: true })) === 403);

  // 2. Off: a handover starts no review run.
  const a = await mkCard(s, 'rev', 'off card', { status: 'doing', assignee: 'Dev' });
  require('../../../lib/platform').writeStub(fs, stub, 'log', out);
  const r0 = hand(a.id);
  check('the hand-over works', r0.code === 0 && (await getCard(s, 'rev', a.id)).status === 'verify', r0);
  await sleep(1200);
  check('switch off: no review run, no comment', count(/peer review/g) === 0 && claudeOut() === '' && codexOut() === '' && !(await getCard(s, 'rev', a.id)).comments.some(m => /Reviewer/.test(m.author)), log());

  // 3. On (the owner): the switch shows in the project and the summary.
  const sw = await s.ok('PATCH', '/api/projects/rev', { peerReview: true });
  check('the owner switches it on', sw.peerReview === true && (await s.ok('GET', '/api/projects')).find(p => p.slug === 'rev').peerReview === true);

  // 4. On, Claude's card: exactly one run, by Codex.
  const b = await mkCard(s, 'rev', 'claude card', { status: 'doing', assignee: 'Dev' });
  hand(b.id);
  check('Claude card: one Codex review run starts', !!(await until(() => /exec/.test(codexOut()), 8000)), codexOut());
  const got = codexOut().replace(/\r/g, '').replace(/"/g, '');
  check('the reviewer is Codex, read-only, with the card, commits and the 🔁 rule', / ?exec --json/.test(got) && got.includes(`aigile show rev ${b.id}`) && got.includes(`--grep ${b.id}`) && /Reviewer \(Codex\)/.test(got) && /read-only/.test(got) && got.includes('U+1F501'), got);
  check('Claude did not run', claudeOut() === '');
  check('the run is hidden background work (a worker, no window) and logged once', count(/handed over: Codex reviews it/g) === 1, log());
  const hasWorker = (await s.ok('GET', '/api/projects/rev')).presence.workers.some(w => w.id === 'review-' + b.id);
  check('it shows as a worker of the project while it runs', hasWorker);
  // The same card handed over again while the review runs: still one run.
  hand(b.id);
  await sleep(800);
  check('a second hand-over while it runs starts no second run', count(/handed over: Codex reviews it/g) === 1, log());

  // 5. Codex's card: the reviewer is Claude.
  for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/rev')).presence.workers.length; i++) await sleep(250);
  const c = await mkCard(s, 'rev', 'codex card', { status: 'doing', assignee: 'Cody' });
  hand(c.id, 'Cody');
  check('Codex card: a Claude review run starts', !!(await until(() => /-p/.test(claudeOut()), 8000)), claudeOut());
  const cl = claudeOut().replace(/\r/g, '').replace(/"/g, '');
  check('the Claude reviewer is read-only and no push', /Reviewer \(Claude\)/.test(cl) && /disallowedTools/.test(cl) && /Edit Write/.test(cl) && /git push/.test(cl), cl);
  check('exactly one Claude run for it', count(/handed over: Claude reviews it/g) === 1 && count(/peer review/g) === 2, log());

  // 6. Not installed: a one-line skipped comment, no run.
  for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/rev')).presence.workers.length; i++) await sleep(250);
  fs.rmSync(stub);
  const d = await mkCard(s, 'rev', 'no codex card', { status: 'doing', assignee: 'Dev' });
  const before = count(/peer review/g);
  hand(d.id);
  const sk = await until(async () => (await getCard(s, 'rev', d.id)).comments.find(m => /Review skipped/.test(m.text)), 6000);
  check('Codex not installed: a one-line skipped comment from Reviewer (Codex)', !!sk && sk.author === 'Reviewer (Codex)' && /^- Review skipped: Codex is not installed\.$/.test(sk.text), sk);
  check('...and no run started', count(/peer review/g) === before && (await s.ok('GET', '/api/projects/rev')).presence.workers.length === 0);
  check('the card stayed in verify', (await getCard(s, 'rev', d.id)).status === 'verify');
  require('../../../lib/platform').writeStub(fs, stub, 'log', out);

  // AIG-1409: five handovers fill two slots; queued cards follow in order.
  const platform = require('../../../lib/platform');
  fs.writeFileSync(stub, platform.stubBody('log', out).replace('ping -n 4', 'ping -n 12').replace('sleep 3', 'sleep 11'));
  const burst = [];
  for (let i = 0; i < 5; i++) burst.push(await mkCard(s, 'rev', 'Queue review ' + (i + 1), { status: 'doing', assignee: 'Dev' }));
  const start = count(/handed over/g);
  for (const card of burst) hand(card.id);
  hand(burst[2].id); // A duplicate waiting handover must not add another review.
  check('five handovers start only two reviews', count(/handed over/g) === start + 2 && (await proc()).body.presence.workers.length === 2, log());
  const page = await openPage(ctx, '#/p/rev');
  await page.waitForSelector('.column');
  if (process.env.QA_SHOTS) await page.screenshot({ path: process.env.QA_SHOTS + '/AIG-1409.png', fullPage: true });
  let peak = 2;
  check('all five reviews eventually start', !!await until(async () => {
    peak = Math.max(peak, (await s.ok('GET', '/api/projects/rev')).presence.workers.length);
    return count(/handed over/g) === start + 5;
  }, 60000), log());
  check('the queue never exceeds two concurrent reviews', peak === 2, peak);
  const order = [...log().matchAll(/peer review: (\S+) handed over/g)].slice(-5).map(m => m[1]);
  check('waiting reviews start in FIFO order, once each', JSON.stringify(order) === JSON.stringify(burst.map(c => c.id)), order);
  await until(async () => !(await s.ok('GET', '/api/projects/rev')).presence.workers.length, 30000);

  // A queued card that moved on is dropped; a local cap of one is respected.
  const local = path.join(s.dir, 'aigile.local.json');
  const settings = JSON.parse(fs.readFileSync(local, 'utf8'));
  fs.writeFileSync(local, JSON.stringify({ ...settings, peerReviewMax: 1 }));
  const dropped = [];
  for (let i = 0; i < 3; i++) dropped.push(await mkCard(s, 'rev', 'Drop queue ' + i, { status: 'doing', assignee: 'Dev' }));
  const one = count(/handed over/g);
  for (const card of dropped) hand(card.id);
  check('local peerReviewMax of one limits running reviews', count(/handed over/g) === one + 1);
  await s.ok('PATCH', '/api/projects/rev/cards/' + dropped[1].id, { status: 'todo' });
  check('the next eligible queued review starts', !!await until(() => count(/handed over/g) === one + 2, 30000));
  check('a queued card moved out of verify/review never starts', !log().includes(dropped[1].id + ' handed over:') && log().includes(dropped[2].id + ' handed over:'));
  await until(async () => !(await s.ok('GET', '/api/projects/rev')).presence.workers.length, 30000);
  fs.writeFileSync(local, JSON.stringify(settings));
  platform.writeStub(fs, stub, 'log', out);

  // 7. No Token Mode: no review run.
  await s.ok('POST', '/api/notokens', { on: true }).catch(() => {});
  const nt = await s.api('GET', '/api/notokens');
  const e = await mkCard(s, 'rev', 'no tokens card', { status: 'doing', assignee: 'Dev' });
  const n0 = count(/handed over/g);
  hand(e.id);
  await sleep(1200);
  check('No Token Mode: no review run', count(/handed over/g) === n0 && /not reviewed/.test(log()), { nt: nt.body, log: log() });
  await s.api('POST', '/api/notokens', { on: false });

  // 8. Switched off again: nothing more.
  await s.ok('PATCH', '/api/projects/rev', { peerReview: false });
  check('switching off clears it', !(await s.ok('GET', '/api/projects/rev')).peerReview);
  const f = await mkCard(s, 'rev', 'late card', { status: 'doing', assignee: 'Dev' });
  const n1 = count(/handed over/g);
  hand(f.id);
  await sleep(1000);
  check('off again: no run', count(/handed over/g) === n1);
}, true, { AIGILE_ENGINE_STUB: stub });
