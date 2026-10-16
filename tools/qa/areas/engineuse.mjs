// QA area: engineuse (AIG-1340): usage of every engine, not only Claude. A Codex lead's run (a stub that prints Codex's JSON events)
// lands in _runs.jsonl with its tokens and engine; a Gemini and a Claude run row are faked beside it. Then: a card per engine with
// Codex's own rate limits (a fake Codex session log) and "No limit info from Gemini", "What each project used today" split by
// engine colour with a legend, the nav glance's engine bar, the compact view, at 390px in the black theme.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { check, sleep, tmp, mkProject, openPage, noErrors, def } from '../lib.mjs';

const require = createRequire(import.meta.url);
const dir = tmp('engineuse'), stub = path.join(dir, 'codex-stub' + require('../../../lib/platform').stubExt()), events = path.join(dir, 'events.js');
fs.writeFileSync(events, `console.log(JSON.stringify({ type: 'thread.started' }));
console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12000, cached_input_tokens: 2000, output_tokens: 800 } }));
console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 3000, cached_input_tokens: 0, output_tokens: 200 } }));`);
require('../../../lib/platform').writeStub(fs, stub, 'run', `"${process.execPath}" "${events}"`);

def('engineuse', 'engineuse: every engine counts on the Usage page: Codex run tokens recorded, a card per engine with its own limits or "no limit info", today bars split by engine (AIG-1340)', async (s, ctx) => {
  // Codex's own session log with its rate limits (the server reads AIGILE_CODEX_HOME, a temp folder in QA).
  const now = Date.now(), resets = Math.floor(now / 1000) + 2 * 86400;
  const sess = path.join(s.dir, 'codex', 'sessions', '2026', '10', '16');
  fs.mkdirSync(sess, { recursive: true });
  fs.writeFileSync(path.join(sess, 'rollout-qa.jsonl'), [
    { timestamp: new Date(now - 60e3).toISOString(), type: 'session_meta', payload: { cwd: dir } },
    { timestamp: new Date(now - 30e3).toISOString(), type: 'event_msg', payload: { type: 'token_count', info: {}, rate_limits: { primary: { used_percent: 46, window_minutes: 10080, resets_at: resets }, secondary: null, plan_type: 'plus' } } },
  ].map(x => JSON.stringify(x)).join('\n') + '\n');

  const pa = tmp('eu-alpha'), pb = tmp('eu-beta');
  await mkProject(s, 'Alpha', 'ALP', { path: pa });
  await mkProject(s, 'Beta', 'BET', { path: pb });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', engine: 'codex' });
  const runsFile = path.join(s.data, 'logs', '_runs.jsonl'), rows = () => { try { return fs.readFileSync(runsFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };
  await s.ok('POST', '/api/projects/alpha/wake');
  for (let i = 0; i < 80 && !rows().some(r => r.engine === 'codex'); i++) await sleep(250);
  const cx = rows().find(r => r.engine === 'codex');
  // 15000 input of which 2000 cached -> 13000 fresh; 1000 out.
  check('a Codex run is recorded with its engine and tokens from its JSON events', cx && cx.slug === 'alpha' && cx.in === 13000 && cx.out === 1000 && cx.cache === 2000, cx);
  const log = fs.readFileSync(path.join(s.data, 'logs', 'alpha.log'), 'utf8');
  check('the team log has the token line for the Codex run', /=== tokens: 13k in · 1k out · 2k cache read ===/.test(log), log.slice(-300));

  // A Claude run on Alpha and a Gemini run on Beta, today.
  fs.appendFileSync(runsFile, [
    { slug: 'alpha', engine: 'claude', start: now - 9e5, end: now - 6e5, cards: [], in: 20000, out: 2000, cache: 0, fresh: 20000, cw: 0, models: ['claude-sonnet'] },
    { slug: 'beta', engine: 'gemini', start: now - 9e5, end: now - 5e5, cards: [], in: 8000, out: 500, cache: 0, fresh: 8000, cw: 0, models: ['gemini-3.8-flash'] },
  ].map(x => JSON.stringify(x)).join('\n') + '\n');

  // No daily cap (as the owner runs it): the card is "What each project used today", bars as shares of all use.
  const lf = path.join(s.dir, 'aigile.local.json'); fs.writeFileSync(lf, JSON.stringify({ ...JSON.parse(fs.readFileSync(lf, 'utf8')), budget: { day: 0 } }));
  const eng = (await s.ok('GET', '/api/usage/engines')).engines, by = Object.fromEntries(eng.map(e => [e.engine, e]));
  check('a card per engine used: Claude, Codex, Gemini (not Copilot or Cursor)', by.claude && by.codex && by.gemini && !by.copilot && !by.cursor, eng.map(e => e.engine));
  check('Codex: today = its run, 1 run', by.codex && by.codex.today === 14000 && by.codex.runsToday === 1 && by.codex.runs7 === 1, by.codex);
  check('Codex: its rate limits from its own log (weekly, 46% used)', by.codex && by.codex.limits && by.codex.limits.windows[0].minutes === 10080 && by.codex.limits.windows[0].usedPct === 46 && by.codex.limits.plan === 'plus', by.codex && by.codex.limits);
  check('Gemini: tokens and no limit info', by.gemini && by.gemini.today === 8500 && by.gemini.limits === null, by.gemini);
  const u = await s.ok('GET', '/api/usage');
  check('per-project use counts Codex for Alpha and Gemini for Beta, engine known', u.enabled && u.projects.alpha && u.projects.alpha.eng.codex.today === 14000 && u.projects.beta && u.projects.beta.eng.gemini.d7 === 8500, u.projects);
  check('the 30-day bars know the engine of each day', u.daily.org[29].by.codex === 14000 && u.daily.org[29].by.gemini === 8500, u.daily.org[29]);
  const td = await s.ok('GET', '/api/today'), ta = td.projects.find(p => p.slug === 'alpha'), tb = td.projects.find(p => p.slug === 'beta');
  check('today: Alpha split into Claude and Codex, Beta all Gemini', ta.by.claude > 0 && ta.by.codex > 0 && tb.by.gemini > 0 && !tb.by.claude && ta.used === ta.by.claude + ta.by.codex, { a: ta.by, b: tb.by, used: ta.used });

  // The page, at phone width in the black theme.
  const page = await openPage(ctx, '#/');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => { try { localStorage.setItem('aigile.theme', 'black'); localStorage.removeItem('aigile.usageView'); } catch {} });
  await page.goto(s.base + '/#/usage'); await page.reload();
  await page.waitForSelector('.uz-eng[data-eng="codex"]', { timeout: 10000 });
  const cards = await page.locator('.uz-eng').evaluateAll(es => es.map(e => ({ eng: e.dataset.eng, text: e.innerText })));
  const card = k => (cards.find(c => c.eng === k) || {}).text || '';
  check('the page shows a card per engine', cards.map(c => c.eng).join() === 'claude,codex,gemini', cards.map(c => c.eng));
  check('Codex card: weekly window 46% used, from its own log', /Weekly window: 46% used/.test(card('codex')) && /From Codex's own log/.test(card('codex')) && /14k/.test(card('codex')), card('codex'));
  check('Gemini card says there is no limit info', /No limit info from Gemini/.test(card('gemini')) && /8\.5k/.test(card('gemini')), card('gemini'));
  check('Claude card: no plan reading yet (none posted)', /No plan reading yet/.test(card('claude')), card('claude'));
  const bars = await page.locator('.today-usage .today-bar').evaluateAll(es => es.map(e => ({ slug: e.dataset.slug, segs: [...e.querySelectorAll('.today-track i')].map(i => ({ eng: i.dataset.eng, w: parseFloat(i.style.width), bg: getComputedStyle(i).backgroundColor })) })));
  const ba = bars.find(b => b.slug === 'alpha'), bb = bars.find(b => b.slug === 'beta');
  check('today: Alpha bar split Claude + Codex in two colours, Beta one Gemini segment', ba && ba.segs.map(x => x.eng).join() === 'claude,codex' && ba.segs[0].bg !== ba.segs[1].bg && bb && bb.segs.map(x => x.eng).join() === 'gemini', bars);
  const ratio = ba && ba.segs[1].w / (ba.segs[0].w + ba.segs[1].w), want = ta.by.codex / ta.used;
  check('today: the split follows each engine\'s share', ba && Math.abs(ratio - want) < 0.02, { ratio, want, ba });
  const legend = await page.locator('.today-usage .eng-legend span').allInnerTexts();
  check('today: a small legend with the engines', legend.join() === 'Claude,Codex,Gemini', legend);
  check('black theme: the dark engine colours apply', await page.evaluate(() => document.documentElement.dataset.theme === 'black' && getComputedStyle(document.documentElement).getPropertyValue('--eng-codex').trim() === '#199e70'));
  if (process.env.QA_SHOTS) await page.screenshot({ path: path.join(process.env.QA_SHOTS, 'engineuse-390-black.png'), fullPage: true });
  check('390px: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth));
  // The nav glance: a third mini bar split by engine, and the tooltip names each engine.
  await page.evaluate(() => UsageGlance.poll()); await page.waitForTimeout(400);
  const g = await page.evaluate(() => ({ segs: [...document.querySelectorAll('#ugBars .ug-eng b')].map(b => b.dataset.eng), title: document.getElementById('usageNav').title, bars: document.querySelectorAll('#ugBars .ug-bar').length }));
  check('glance: an engine bar split Claude, Codex, Gemini; the 5h/week bars untouched', g.segs.join() === 'claude,codex,gemini' && g.bars === 0, g);
  check('glance: the tooltip lists each engine\'s board runs today', /Board runs today: Claude 22k · Codex 14k · Gemini 9k/.test(g.title), g.title);
  noErrors(page);
  // Compact view: a line per engine and today's projects split by engine.
  await page.click('.uz-viewtog button:nth-child(1)');
  await page.waitForSelector('.uz-engcompact', { timeout: 5000 });
  const ce = await page.textContent('.uz-engcompact'), cp = await page.textContent('.uz-projcompact');
  check('compact: one line per engine, Codex with its window, Gemini without limit info', /^Claude:/m.test(ce) && /^Codex: .*Weekly window 46% \[XXXX\.\.\.\.\]/m.test(ce) && /^Gemini: .*No limit info from Gemini/m.test(ce), ce);
  check('compact: what each project used today, split by engine', /Alpha: .*Claude .* · Codex /.test(cp) && /Beta: .*Gemini /.test(cp), cp);
  check('compact: the two plan lines are still first', (await page.locator('.uz-compact').first().textContent()).split('\n').length === 2);
  noErrors(page);
  await page.click('.uz-viewtog button:nth-child(2)');
  await page.waitForSelector('.uz-eng', { timeout: 5000 });
  // Dutch texts are there.
  await page.evaluate(() => localStorage.setItem('aigile.lang', 'nl'));
  await page.reload();
  await page.waitForSelector('.uz-eng[data-eng="gemini"]');
  check('nl: "Geen limietinfo van Gemini"', /Geen limietinfo van Gemini/.test(await page.locator('.uz-eng[data-eng="gemini"]').innerText()));
  await page.evaluate(() => localStorage.setItem('aigile.lang', 'en'));
  noErrors(page);
}, true, { AIGILE_ENGINE_STUB: stub });
