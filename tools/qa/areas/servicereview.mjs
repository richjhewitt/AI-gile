// QA area: servicereview (AIG-1155): the monthly service review. A seeded service project (fixed month 2025-06): incidents opened and closed,
// average time to fix, reply targets met, uptime % from the uptime incident's down time, tokens from the run log, server peaks; a previous
// month; bad month and non-service project refused; the page #/review/<slug>?month= with month buttons; the ✍️ Summary button (stubbed
// agent text, never a real call) and off again in No Token Mode.
import fs from 'node:fs';
import path from 'node:path';
import { until, check, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('servicereview', '📆 monthly service review: seeded month numbers (incidents, time to fix, reply targets, uptime, tokens, servers), previous months, page, stubbed Summary and No Token Mode (AIG-1155)', async (s, ctx) => {
  await mkProject(s, 'Rev Svc', 'RVS'); await mkProject(s, 'Plain', 'PLN');
  await s.ok('PATCH', '/api/projects/rev-svc', { service: { on: true, url: 'https://example.com' } });
  await s.ok('POST', '/api/projects/rev-svc/ci', { kind: 'server', name: 'prod-1' });
  const i1 = await mkCard(s, 'rev-svc', 'Site is down', { type: 'incident', status: 'todo' });
  const i2 = await mkCard(s, 'rev-svc', 'Login slow', { type: 'incident', status: 'todo' });
  const i3 = await mkCard(s, 'rev-svc', 'Mail bounces', { type: 'incident', status: 'todo' });
  // Back-date by editing the project file (the same way the stats area does).
  const file = path.join(s.data, 'rev-svc.json'), p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const set = (id, o) => Object.assign(p.cards.find(c => c.id === id), o);
  const T = (d, hm) => `2025-06-${d}T${hm}:00`;
  set(i1.id, { from: 'uptime', createdBy: 'Uptime', status: 'done', created: T('03', '10:00'), updated: T('03', '12:00'),
    comments: [{ author: 'Uptime', text: 'down', at: T('03', '10:00') }, { author: 'Uptime', text: 'Up again after 60 min', at: T('03', '11:00') }, { author: 'Owner', text: 'on it', at: T('03', '10:30') }] });
  set(i2.id, { createdBy: 'Owner', status: 'done', created: T('10', '08:00'), updated: T('10', '09:00'), comments: [{ author: 'Dev', text: 'looking', at: T('10', '08:30') }] });
  set(i3.id, { createdBy: 'Owner', status: 'todo', created: T('20', '08:00'), updated: T('20', '21:00'), comments: [{ author: 'Dev', text: 'later', at: T('20', '21:00') }] });
  fs.writeFileSync(file, JSON.stringify(p));
  fs.mkdirSync(path.join(s.data, 'logs'), { recursive: true });
  const end = d => new Date(2025, 5, d, 12).getTime(), row = (slug, e, i, o) => JSON.stringify({ slug, kind: 'team', start: e - 1000, end: e, cards: [], in: i, out: o, cache: 9 });
  fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), [row('rev-svc', end(4), 1000, 500), row('rev-svc', end(15), 2000, 300), row('rev-svc', new Date(2025, 4, 15).getTime(), 77, 77), row('plain', end(4), 5, 5)].join('\n') + '\n');
  fs.writeFileSync(path.join(s.data, 'serverhealth.conf'), JSON.stringify({ readings: [], servers: { 'prod-1': [{ at: T('05', '10:00'), cpu: 40, mem: 30, disk: 60 }, { at: T('06', '10:00'), cpu: 72, mem: 30, disk: 65 }, { at: '2025-05-20T10:00:00', cpu: 99, mem: 1, disk: 99 }] } }));
  // The server may save a copy it read just before the edit: write again until it sees the back-dated cards.
  await until(async () => (await s.ok('GET', '/api/projects/rev-svc/review?month=2025-06')).incidents.opened === 3 || (fs.writeFileSync(file, JSON.stringify(p)), false), 5000);

  const r = await s.ok('GET', '/api/projects/rev-svc/review?month=2025-06');
  check('incidents opened, closed, still open, average time to fix', r.incidents.opened === 3 && r.incidents.closed === 2 && r.incidents.still === 1 && r.incidents.avgFixMin === 90, r.incidents);
  check('reply targets: two of three incidents were answered within the hour', r.replies.met === 2 && r.replies.of === 3, r.replies);
  check('uptime from the uptime incident (60 min down in 30 days)', r.uptime === 99.86 && r.downMin === 60, [r.uptime, r.downMin]);
  check('tokens of this month only, this project only', r.tokens.in === 3000 && r.tokens.out === 800 && r.tokens.runs === 2, r.tokens);
  check('server peaks of the month only', r.servers.length === 1 && r.servers[0].cpu === 72 && r.servers[0].disk === 65 && r.servers[0].readings === 2, r.servers);
  check('the last 12 months are listed, 2025-06 is not the current one', r.month === '2025-06' && r.months.length === 12 && !r.current, r.months);
  const m = await s.ok('GET', '/api/projects/rev-svc/review?month=2025-05');
  check('another month has its own numbers', m.incidents.opened === 0 && m.incidents.closed === 0 && m.tokens.in === 77 && m.servers[0].cpu === 99, m);
  check('a bad month and a project without the service are refused', (await s.api('GET', '/api/projects/rev-svc/review?month=June')).status === 400 && (await s.api('GET', '/api/projects/plain/review?month=2025-06')).status === 400);
  const cur = await s.ok('GET', '/api/projects/rev-svc/review');
  check('no month = this month', cur.current === true && cur.months[0] === cur.month);

  const page = await openPage(ctx, '#/review/rev-svc?month=2025-06');
  await page.waitForSelector('[data-rev="opened"]');
  const tx = sel => page.innerText(sel);
  check('the page shows the numbers', (await tx('[data-rev="opened"]')).startsWith('3') && (await tx('[data-rev="closed"]')).startsWith('2') && /1.5 h/.test(await tx('[data-rev="fix"]')) && /^2 \/ 3/.test(await tx('[data-rev="replies"]'))
    && /99\.86%/.test(await tx('[data-rev="uptime"]')) && /3.?800/.test(await tx('[data-rev="tokens"]')) && /72%/.test(await tx('#rev-servers')) && /Site is down/.test(await tx('#rev-incidents')));
  await page.click('#rev-prev');
  await page.waitForFunction(() => location.hash.endsWith('month=2025-05'));
  await page.waitForFunction(() => document.querySelector('#rev-month') && document.querySelector('#rev-month').value === '2025-05' && /^0/.test(document.querySelector('[data-rev="opened"]').innerText));
  check('Earlier moves to the month before', /^0/.test(await tx('[data-rev="opened"]')));
  await page.selectOption('#rev-month', '2026-09');
  await page.waitForFunction(() => location.hash.endsWith('month=2026-09') && document.querySelector('#rev-month').value === '2026-09');
  await page.evaluate(() => { location.hash = '#/review/rev-svc?month=2025-06'; });
  await page.waitForFunction(() => /^3/.test((document.querySelector('[data-rev="opened"]') || { innerText: '' }).innerText));
  await page.click('#rev-sum');
  await page.waitForSelector('pre#rev-summary');
  check('the Summary button shows the stubbed two lines', /Stub line one\.\nStub line two\./.test(await tx('pre#rev-summary')));

  await s.ok('POST', '/api/notokens', { on: true });
  await page.reload();
  await page.waitForSelector('#rev-sum');
  check('Summary is off in No Token Mode and the API says so', await page.locator('#rev-sum').isDisabled() && (await s.ok('POST', '/api/projects/rev-svc/review/summary', { month: '2025-06' })).why === 'noai');
  await s.ok('POST', '/api/notokens', { on: false });

  const board = await openPage(ctx, '#/p/rev-svc');
  await board.waitForSelector('#boardTbMore button[onclick*="#/review/rev-svc"]', { state: 'attached' });
  check('the board ⋯ More has the Review button for a service', (await board.locator('#boardTbMore button[onclick*="#/review/rev-svc"]').count()) === 1);
  const plain = await openPage(ctx, '#/p/plain');
  await plain.waitForSelector('#boardTbMore', { state: 'attached' });
  check('a project without the service has no Review button', (await plain.locator('#boardTbMore button[onclick*="#/review/"]').count()) === 0);
  await noErrors(page);
}, true, { AIGILE_REVIEW_STUB: 'Stub line one.\nStub line two.' });
