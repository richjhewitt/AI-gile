// QA area: tokencap (AIG-1156, lib/tokencap.js): a monthly token cap per service project (p.service.tokenCap). Usage is stubbed with
// rows in data/logs/_runs.jsonl. At 80% the brief gets a warning line; at 100% a background start is refused with a board comment;
// last month's rows do not count; raising the cap lets it start again.
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, def, openPage, noErrors } from '../lib.mjs';

def('tokencap', '🧮 token cap per service: Look field saves, 80% brief line, 100% refuses background starts + one board comment, last month ignored, raised cap lets it run (AIG-1156)', async (s, ctx) => {
  await s.ok('POST', '/api/setup', { owner: 'Rich', 'agent.command': 'echo', 'agent.notesFile': 'CLAUDE.md', 'agent.settingsFile': '.claude/settings.json' });
  await mkProject(s, 'Cap', 'CAP', { path: tmp('tokencap') });
  await s.ok('POST', '/api/projects/cap/team', { name: 'Cap Lead', role: 'Lead', model: 'sonnet' });
  const rows = f => { fs.mkdirSync(path.join(s.data, 'logs'), { recursive: true }); fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), f.map(r => JSON.stringify({ slug: 'cap', start: r.end - 1000, cards: [], cache: 0, ...r })).join('\n') + '\n'); };
  const lastMonth = new Date(); lastMonth.setDate(1); lastMonth.setHours(0, 0, 0, 0); lastMonth.setTime(lastMonth.getTime() - 86400e3);

  check('refuses a cap that is not a number', (await s.api('PATCH', '/api/projects/cap', { service: { on: true, tokenCap: 'lots' } })).status === 400);
  const set = await s.ok('PATCH', '/api/projects/cap', { service: { on: true, offers: 'Radio', tokenCap: '1,000,000' } });
  check('the cap saves as a number', set.service.tokenCap === 1000000, set.service);
  const card = await s.ok('POST', '/api/projects/cap/cards', { title: 'Doing it', status: 'doing' });

  rows([{ end: Date.now() - 5000, in: 300000, out: 100000 }, { end: lastMonth.getTime(), in: 9e6, out: 9e6 }]);
  const b0 = s.cli(['brief', 'cap']);
  check('40% used (last month ignored): no warning line', b0.code === 0 && !/token cap/.test(b0.out), b0.out.slice(0, 300));

  rows([{ end: Date.now() - 5000, in: 700000, out: 120000 }]);
  const b1 = s.cli(['brief', 'cap']);
  check('82% used: the brief has the 80% line', /⚠️ 80% of this month's token cap used/.test(b1.out), b1.out.slice(0, 300));
  const w1 = await s.api('POST', '/api/projects/cap/wake', { sprint: true });
  check('82% used: a background start is not held by the cap', !/token cap/.test(JSON.stringify(w1.body || w1.data || '')), w1);

  rows([{ end: Date.now() - 5000, in: 900000, out: 150000 }]);
  const w2 = await s.api('POST', '/api/projects/cap/wake', { sprint: true });
  check('105% used: a background start is refused with the reason', w2.status === 409 && /monthly token cap/.test(JSON.stringify(w2.body || w2.data || '')), w2);
  await s.api('POST', '/api/projects/cap/wake', { sprint: true });
  const cm = (await s.ok('GET', '/api/projects/cap')).cards.find(c => c.id === card.id).comments.filter(c => /monthly token cap/.test(c.text));
  check('one board comment says why (not two)', cm.length === 1, cm);
  const b2 = s.cli(['brief', 'cap']);
  check('the brief says the cap is used up', /100% of this month's token cap used/.test(b2.out), b2.out.slice(0, 300));

  await s.ok('PATCH', '/api/projects/cap', { service: { tokenCap: '5000000' } });
  const w3 = await s.api('POST', '/api/projects/cap/wake', { sprint: true });
  check('raising the cap lets background runs start again', w3.status !== 409 || !/token cap/.test(JSON.stringify(w3.body || w3.data || '')), w3);
  await s.ok('PATCH', '/api/projects/cap', { service: { tokenCap: '' } });
  check('empty clears the cap', !(await s.ok('GET', '/api/projects/cap')).service.tokenCap);

  const page = await openPage(ctx, "#/p/cap");
  await page.waitForFunction(() => typeof lookDialog === "function" && typeof state !== "undefined" && state.project && state.project.slug === "cap", null, { timeout: 15000 });
  await page.evaluate(() => lookDialog());
  await page.waitForSelector("#look-svc-cap");
  check("Look → Service has the monthly token cap field", await page.isVisible("#look-svc-cap"));
  await page.fill("#look-svc-cap", "2500000");
  await page.evaluate(() => saveLook());
  await page.waitForFunction(() => !document.querySelector("#look-svc-cap"), null, { timeout: 8000 });
  check("saving Look stores the cap", (await s.ok("GET", "/api/projects/cap")).service.tokenCap === 2500000);
  await noErrors(page);
}, true);
