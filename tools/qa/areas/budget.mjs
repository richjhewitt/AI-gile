// QA area: budget (AIG-353): token budget, parallel cap, helpers per model, usage checks off/by hand/auto.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('budget', '💰 token budget refuses a wake with a reason, the parallel cap queues the 2nd run, usage checks off hides the button, helpers rule in the brief, prefs saved (AIG-353)', async (s, ctx) => {
  const started = slug => { try { return (fs.readFileSync(path.join(s.data, 'logs', slug + '.log'), 'utf8').match(/=== .*started|--model|stream|\bexited\b/g) || []).length; } catch { return 0; } };
  const reading = (h5, wk) => s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: h5, resets_at: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { used_percentage: wk, resets_at: Math.floor(Date.now() / 1000) + 86400 } } });
  const idle = async slug => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/' + slug)).presence.running; i++) await sleep(250); };
  await mkProject(s, 'Cash', 'CSH', { path: tmp('cash') });
  await mkProject(s, 'Coin', 'COI', { path: tmp('coin') });

  // Prefs: defaults, saved, refused when out of range.
  let pr = (await s.ok('GET', '/api/setup')).prefs;
  check('defaults: budget 90 / 95, no run cap, no helper limits, usage checks by hand', pr.budgetH5 === 90 && pr.budgetWk === 95 && pr.maxRuns === 0 && pr.helpersOpus === '' && pr.usageChecks === 'hand', JSON.stringify(pr));
  check('a percentage over 100 is refused', (await s.api('POST', '/api/setup', { prefs: { budgetH5: 150 } })).status === 400);
  check('an unknown usage-check mode is refused', (await s.api('POST', '/api/setup', { prefs: { usageChecks: 'often' } })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { budgetH5: 80, budgetWk: 85, helpersOpus: 1, helpersSonnet: 3, helpersHaiku: 4 } });
  pr = (await s.ok('GET', '/api/setup')).prefs;
  check('budget and helpers are saved', pr.budgetH5 === 80 && pr.budgetWk === 85 && pr.helpersOpus === 1 && pr.helpersSonnet === 3 && pr.helpersHaiku === 4, JSON.stringify(pr));
  const saved = JSON.parse(fs.readFileSync(process.env.QA_BUDGET_FILE, 'utf8'));
  check('they land in the local settings file', saved.budget.h5 === 80 && saved.helpers.sonnet === 3, JSON.stringify(saved));
  check('the brief carries the helpers rule', /use at most Opus 1, Sonnet 3, Haiku 4 helpers at once/.test(s.cli(['brief', 'cash']).out), s.cli(['brief', 'cash']).out);
  await s.ok('POST', '/api/setup', { prefs: { helpersOpus: '', helpersSonnet: '', helpersHaiku: '' } });
  check('blank helpers: no rule line', !/helpers at once/.test(s.cli(['brief', 'cash']).out));

  // The 5-step scale sets everything at once.
  const plans = (await s.ok('GET', '/api/setup')).plans;
  for (const k of Object.keys(plans)) {
    await s.ok('POST', '/api/setup', { prefs: { plan: k } });
    pr = (await s.ok('GET', '/api/setup')).prefs;
    check(`step ${k} sets the values and is selected`, pr.plan === k && pr.budgetH5 === plans[k].budgetH5 && pr.maxRuns === plans[k].maxRuns && pr.usageChecks === plans[k].usageChecks && pr.helpersSonnet === plans[k].helpersSonnet, JSON.stringify(pr));
  }
  check('fly is the tightest, no-expense-spared the loosest', plans.fly.budgetH5 < plans.careful.budgetH5 && plans.generous.budgetH5 < plans.nospare.budgetH5 && plans.fly.usageChecks === 'off');
  check('an unknown step is refused', (await s.api('POST', '/api/setup', { prefs: { plan: 'lavish' } })).status === 400);
  await s.ok('POST', '/api/setup', { prefs: { plan: 'normal', budgetH5: 77 } });
  check('changing a single value afterwards leaves no step selected', (await s.ok('GET', '/api/setup')).prefs.plan === '');
  await s.ok('POST', '/api/setup', { prefs: { plan: 'nospare' } });
  await s.ok('POST', '/api/setup', { prefs: { budgetH5: 80, budgetWk: 85, usageChecks: 'hand', maxRuns: 0 } });

  // Over the budget: refused with the reason, then fine again.
  await reading(85, 10);
  let r = await s.api('POST', '/api/projects/cash/wake');
  check('5-hour at 85% with a cap of 80%: the wake is refused with a reason', r.status === 400 && /token budget.*5-hour.*85%.*80%/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  check('and nothing started', started('cash') === 0);
  await s.ok('POST', '/api/setup', { prefs: { budgetH5: 90 } });
  await reading(50, 90);
  r = await s.api('POST', '/api/projects/cash/wake');
  check('weekly at 90% with a cap of 85%: refused too', r.status === 400 && /weekly/.test(JSON.stringify(r.body)), JSON.stringify(r.body));
  check('the tester is held back as well', (await s.api('POST', '/api/tester', {})).status === 400);
  await reading(50, 50);
  check('under both caps the wake goes', (await s.api('POST', '/api/projects/cash/wake')).status === 200);
  await idle('cash');

  // Max parallel runs: the second wake waits for the first to end.
  await s.ok('POST', '/api/setup', { prefs: { maxRuns: 1 } });
  await s.ok('POST', '/api/projects/cash/wake');
  const q = await s.ok('POST', '/api/projects/coin/wake');
  check('cap 1: the second wake is queued', q.queued === true, JSON.stringify(q));
  check('presence says it waits', (await s.ok('GET', '/api/projects/coin')).presence.queued === true);
  check('the first is running, the second is not yet', (await s.ok('GET', '/api/projects/cash')).presence.running === true && (await s.ok('GET', '/api/projects/coin')).presence.running === false);
  check('the queued team starts when the first run ends', await until(async () => (await s.ok('GET', '/api/projects/coin')).presence.running, 15000));
  check('and is no longer queued', (await s.ok('GET', '/api/projects/coin')).presence.queued === false);
  await idle('cash'); await idle('coin');
  await s.ok('POST', '/api/setup', { prefs: { maxRuns: 0 } });

  // Usage checks off: no button, no check.
  const page = await openPage(ctx, '#/usage');
  await page.waitForSelector('#uzCheck', { timeout: 8000 }).catch(async () => console.log('PAGE:', (await page.textContent('body')).slice(0, 600)));
  check('by hand: the Check usage now button is there', !!(await page.$('#uzCheck')));
  await s.ok('POST', '/api/setup', { prefs: { usageChecks: 'off' } });
  check('off is saved', (await s.ok('GET', '/api/setup')).prefs.usageChecks === 'off' && (await s.ok('GET', '/api/usage/check')).mode === 'off');
  check('off: a check is refused', (await s.api('POST', '/api/usage/check')).status === 400);
  await page.reload();
  await page.waitForSelector('.uz', { timeout: 8000 });
  check('off: the button is hidden', !(await page.$('#uzCheck')));
  await s.ok('POST', '/api/setup', { prefs: { usageChecks: 'auto' } });
  check('auto is saved', (await s.ok('GET', '/api/usage/check')).auto === true);
  // The Setup page shows the controls.
  const sp = await openPage(ctx, '#/setup');
  await sp.waitForSelector('#pf-maxRuns', { timeout: 8000 });
  check('Setup shows the usage, budget, run cap and helper controls', (await sp.$$('#pf-usageChecks, #pf-budgetH5, #pf-budgetWk, #pf-maxRuns, #pf-helpersOpus, #pf-helpersSonnet, #pf-helpersHaiku')).length === 7);
  await sp.fill('#pf-maxRuns', '2'); await sp.press('#pf-maxRuns', 'Tab');
  await until(async () => (await s.ok('GET', '/api/setup')).prefs.maxRuns === 2, 4000);
  check('a control saves what is typed', (await s.ok('GET', '/api/setup')).prefs.maxRuns === 2);
  noErrors(page); noErrors(sp);
}, true, (() => { const f = process.env.QA_BUDGET_FILE = path.join(tmp('budget'), 'aigile.local.json'); fs.writeFileSync(f, '{ "owner": "Owner", "agent": { "command": "x", "notesFile": "CLAUDE.local.md", "settingsFile": ".claude/settings.local.json" } }'); return { AIGILE_LOCAL: f }; })());
