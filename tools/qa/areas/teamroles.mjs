// QA area: teamroles (AIG-366): per-project AI roles on/off: brief rule, role picker, AI tester, count line.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('teamroles', '👥 switching a role off drops it from the brief rule and the role picker; Tester off skips the project; the count line follows', async (s, ctx) => {
  await mkProject(s, 'Crew', 'CRW');
  await mkProject(s, 'Rest', 'RST');
  for (const slug of ['crew', 'rest']) { const c = await mkCard(s, slug, 'Thing'); s.cli(['test', slug, c.id, '- Click **Go**: it works', '--as', 'Lead']); }
  check('all on by default: no delegate rule', !/delegate to/.test(s.cli(['brief', 'crew']).out));

  const all = ['Lead (Opus)', 'Reviewer (Opus)', 'Frontend (Sonnet)', 'Backend (Sonnet)', 'QA (Haiku)', 'Quick fix (Haiku)', 'Docs (Haiku)', 'Tester (Sonnet)'];
  const off = all.filter(r => !/^(Frontend|Tester)/.test(r));
  await s.ok('PATCH', '/api/projects/crew', { roles: off });
  const out = s.cli(['brief', 'crew']).out;
  check('brief lists only roles that are on', /You may delegate to: .*Backend \(Sonnet\)/.test(out) && !/delegate to:.*Frontend/.test(out), out);
  check('Lead cannot be switched off', (await s.ok('PATCH', '/api/projects/crew', { roles: ['Docs (Haiku)'] }), (await s.ok('GET', '/api/projects/crew')).roles.includes('Lead (Opus)')));
  await s.ok('PATCH', '/api/projects/crew', { roles: off });
  check('another project is untouched', !/delegate to/.test(s.cli(['brief', 'rest']).out));

  const r = await s.api('POST', '/api/tester', { projects: ['crew'] });
  check('Tester off: the tester has nothing to do for that project', r.status === 400, JSON.stringify(r.body));

  const page = await openPage(ctx, '#/p/crew');
  await page.waitForSelector('button:has-text("Look")');
  const opts = await page.evaluate(() => assigneeSelect(''));
  check('role picker hides Frontend, keeps Backend', !opts.includes('Frontend (Sonnet)') && opts.includes('Backend (Sonnet)'), opts.slice(0, 300));
  await page.click('button:has-text("Look")');
  await page.waitForSelector('#look-roles');
  check('dialog: Frontend unticked, Lead locked', (await page.$eval('#look-roles input[data-role="Frontend (Sonnet)"]', e => e.checked)) === false && (await page.$eval('#look-roles input[data-role^="Lead"]', e => e.disabled)));
  const line = await page.textContent('#look-rolecount');
  check('count line: Opus 2, Sonnet 1, Haiku 3', /up to 6 agents: Opus 2, Sonnet 1, Haiku 3/.test(line), line);
  await page.click('#look-roles input[data-role="Frontend (Sonnet)"]');
  check('count line follows a click', /Sonnet 2/.test(await page.textContent('#look-rolecount')), await page.textContent('#look-rolecount'));
  await page.click('#dialog button:has-text("Save")');
  await sleep(500);
  check('saved: Frontend back on', (await s.ok('GET', '/api/projects/crew')).roles.includes('Frontend (Sonnet)'));
  noErrors(page);
}, true);
