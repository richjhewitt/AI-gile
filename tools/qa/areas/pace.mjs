// QA area: pace (AIG-466): usage forecast, burn-down chart, pace scale target and the pace guard.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, check, tmp, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('pace', '🐢 usage forecast maths, burn-down chart on the Usage page, pace target on the spend scale, pace guard slows the board and tells the owner once (AIG-466)', async (s, ctx) => {
  const { forecastWindow } = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'forecast.js'));

  // 1. The maths, no server: readings in the same window give a rate and a run-out.
  const H = 3600e3, t0 = Date.parse('2026-03-02T08:00:00Z'), resets = Math.floor((t0 + 10 * H) / 1000);
  const hist = (...pcts) => pcts.map((p, i) => ({ at: new Date(t0 + i * H).toISOString(), wk: { pct: p, resets } }));
  let f = forecastWindow(hist(10, 20, 30), 'wk', t0 + 2 * H);
  check('rate is 10% an hour', Math.abs(f.rate - 10) < 1e-9, JSON.stringify(f));
  check('runs out 7 hours after the last reading', Math.abs(f.runOut - (t0 + 9 * H)) < 1000, JSON.stringify(f));
  check('and that is before the reset', f.beforeReset === true && f.atReset > 100, JSON.stringify(f));
  f = forecastWindow(hist(10, 11, 12), 'wk', t0 + 2 * H);
  check('a slow burn lasts till the reset', f.beforeReset === false && f.atReset < 100 && Math.abs(f.rate - 1) < 1e-9, JSON.stringify(f));
  f = forecastWindow(hist(30, 30, 30), 'wk', t0 + 2 * H);
  check('a flat figure has no run-out', f.rate === 0 && f.runOut === null && !f.beforeReset);
  f = forecastWindow(hist(10), 'wk', t0);
  check('one reading is not enough for a rate', f.rate === 0 && f.runOut === null);
  const mixed = [{ at: new Date(t0).toISOString(), wk: { pct: 90, resets: resets - 7 * 24 * 3600 } }, ...hist(5, 6)];
  check('readings from the previous window are ignored', Math.abs(forecastWindow(mixed, 'wk', t0 + 2 * H).rate - 1) < 1e-9);
  check('a window that has reset is flagged', forecastWindow(hist(10, 20), 'wk', t0 + 20 * H).over === true);
  check('no readings gives null', forecastWindow([], 'h5') === null && forecastWindow(hist(1, 2), 'h5') === null);

  // 2. The scale carries a pace target; custom values use the weekly budget.
  const plans = (await s.ok('GET', '/api/setup')).plans;
  const paceOf = async k => { await s.ok('POST', '/api/setup', { prefs: { plan: k } }); return (await s.ok('GET', '/api/setup')).prefs.pace; };
  check('slow and steady aims at 70%, no expense spared at 100%', (await paceOf('fly')) === 70 && (await paceOf('nospare')) === 100);
  const steps = []; for (const k of Object.keys(plans)) steps.push(await paceOf(k));
  check('the scale only goes up', steps.every((v, i) => !i || v > steps[i - 1]), steps.join());
  await s.ok('POST', '/api/setup', { prefs: { plan: 'fly', budgetWk: 88 } });
  check('a custom mix aims at its weekly budget', (await s.ok('GET', '/api/setup')).prefs.pace === 88);

  // 3. A fast week: 10 hours of readings, weekly 50% to 60%, resets in a day.
  await mkProject(s, 'Pace', 'PAC', { path: tmp('pace') });
  const now = Date.now(), wkResets = Math.floor((now + 24 * H) / 1000), h5Resets = Math.floor((now + 4 * H) / 1000);
  const at = h => new Date(now - h * H).toISOString();
  const lines = [[10, 50, 20], [5, 55, 50], [0.1, 60, 80]].map(([h, wk, h5]) => JSON.stringify({ at: at(h), h5: { pct: h5, resets: h5Resets }, wk: { pct: wk, resets: wkResets } }));
  fs.writeFileSync(path.join(s.data, 'limits.log'), lines.join('\n') + '\n');
  const lim = await s.ok('GET', '/api/limits?days=30');
  check('the limits api carries the forecast', lim.forecast.wk && Math.abs(lim.forecast.wk.rate - 1) < 0.05 && lim.forecast.h5.beforeReset === true, JSON.stringify(lim.forecast));

  await s.ok('POST', '/api/setup', { prefs: { plan: 'fly' } });
  let g = await s.ok('GET', '/api/limits/latest');
  check('slow and steady (70%): at 60% and 1%/h the week ends near 84%, so the guard slows down', g.slow && g.slow.pace === 70 && g.slow.atReset >= 82 && g.slow.atReset <= 86, JSON.stringify(g));
  check('the brief tells the lead: no extra helpers, smaller models', /Pace guard.*no extra helpers.*smaller models/i.test(s.cli(['brief', 'pace']).out));
  check('it never stops a run: the wake is still allowed', (r => r.status === 200 || !/pace/i.test(JSON.stringify(r.body)))(await s.api('POST', '/api/projects/pace/wake')));
  const told = () => { try { return fs.readFileSync(path.join(s.data, 'pace.told'), 'utf8'); } catch { return ''; } };
  check('nothing told yet: the readings were not posted', told() === '');
  const post = wk => s.ok('POST', '/api/limits', { rate_limits: { seven_day: { used_percentage: wk, resets_at: wkResets } } });
  await post(60.5);
  check('a new reading past the pace tells the owner, once for this window', told() === String(wkResets * 1000), told());
  const m1 = fs.statSync(path.join(s.data, 'pace.told')).mtimeMs; await post(61);
  check('and not again in the same window', fs.statSync(path.join(s.data, 'pace.told')).mtimeMs === m1);
  await s.ok('POST', '/api/setup', { prefs: { plan: 'nospare' } });
  g = await s.ok('GET', '/api/limits/latest');
  check('no expense spared (100%): no slowing down', !g.slow, JSON.stringify(g));
  check('and no pace line in the brief', !/Pace guard/.test(s.cli(['brief', 'pace']).out));

  // 4. The pages.
  const page = await openPage(ctx, '#/usage');
  await page.waitForSelector('.uz-burn', { timeout: 8000 });
  const lines2 = await page.locator('.uz-burn-line').allTextContents();
  check('a burn-down card per window, with a plain line', lines2.length === 2 && lines2.every(x => /^At this rate: (runs out \w{3} \d\d:\d\d|lasts till the reset)$/.test(x.trim())), JSON.stringify(lines2));
  check('the 5-hour window runs out, the week does not (84% at reset)', /runs out/.test(lines2[0]) && /lasts till the reset/.test(lines2[1]), JSON.stringify(lines2));
  check('each chart has the used line, a dashed forecast and a reset mark', (await page.locator('.uz-burn svg polyline').count()) === 2 && (await page.locator('.uz-burn svg .uz-fc[stroke-dasharray]').count()) === 2);
  noErrors(page);
  const sp = await openPage(ctx, '#/setup');
  await sp.waitForSelector('#pf-pace', { timeout: 8000 });
  check('Setup shows the pace under the scale', /100%/.test(await sp.textContent('#pf-pace')), await sp.textContent('#pf-pace'));
  await sp.$eval('#sc-thrift', e => { e.value = 5; e.dispatchEvent(new Event('change', { bubbles: true })); });   // the thrift slider (AIG-422): 5 = slow and steady
  await sp.waitForFunction(() => /70%/.test(document.getElementById('pf-pace').textContent), null, { timeout: 5000 }).catch(() => {});
  check('picking slow and steady shows 70%', /70%/.test(await sp.textContent('#pf-pace')), await sp.textContent('#pf-pace'));
  noErrors(sp);
}, true, (() => { const f = path.join(tmp('pace'), 'aigile.local.json'); fs.writeFileSync(f, '{ "owner": "Owner", "agent": { "command": "x", "notesFile": "CLAUDE.local.md", "settingsFile": ".claude/settings.local.json" } }'); return { AIGILE_LOCAL: f }; })());
