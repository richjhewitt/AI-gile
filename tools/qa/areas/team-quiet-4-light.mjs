// QA areas: light, verbose, nightglance, watchdm (split from team-quiet.mjs, AIG-297).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

def('light', '🪶 Pro-friendly runs: comment runs on the smaller model, every 5th run a fresh conversation; off changes nothing (AIG-268)', async s => {
  await mkProject(s, 'Lite', 'LIT', { path: tmp('lite') });
  const wake = async () => { await s.ok('POST', '/api/projects/lite/wake'); for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/lite')).presence.running; i++) await sleep(250); return fs.readFileSync(s.wakeOut, 'utf8'); };
  let out = await wake();
  check('off: no model flag, a conversation of its own under an id (never --continue)', !/--model/.test(out) && /--session-id/.test(out) && !/--continue/.test(out), out);
  await s.ok('POST', '/api/setup', { prefs: { light: true } });
  check('the switch is saved', (await s.ok('GET', '/api/setup')).prefs.light === true);
  out = await wake();
  check('on: a comment run uses the smaller model', /--model"? "?sonnet/.test(out) && /--resume/.test(out), out);
  for (let i = 0; i < 3; i++) out = await wake();
  check('still carrying the conversation before the 5th run', /--resume/.test(out), out);
  out = await wake();
  check('after 5 runs, a fresh conversation (no --continue)', !/--resume/.test(out) && /--session-id/.test(out) && /\(fresh\)/.test(fs.readFileSync(path.join(s.data, 'logs', 'lite.log'), 'utf8')), out);
  out = await wake();
  check('then it carries on with that conversation', /--resume/.test(out), out);
}, false, (() => { const f = path.join(tmp('liteset'), 'local.json'); fs.writeFileSync(f, '{ "owner": "Owner" }'); return { AIGILE_LOCAL: f }; })());   // its own settings file: never the real one

def('tester', '🤖 Test these for me: the button starts one AI tester run over unchecked tests; the watchman starts one at night (AIG-291, AIG-292)', async (s, ctx) => {
  await mkProject(s, 'Tst', 'TST', { path: tmp('tst') });
  const c = await mkCard(s, 'tst', 'Try the thing');
  check('nothing to test: refused', (await s.api('POST', '/api/tester', {})).status === 400);
  s.cli(['test', 'tst', c.id, '- Click **Go**\n\n- It says done', '--as', 'Lead']);
  check('one test waits for the tester', (await s.ok('GET', '/api/tester')).waiting === 1);
  const page = await openPage(ctx, '#/inbox');
  await page.waitForFunction(() => /1 the AI can check/.test(document.getElementById('ibTester')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  check('the inbox offers the AI check button (1)', /1 the AI can check/.test(await page.textContent('#ibTester')));
  await page.click('#ibTester');
  await page.waitForFunction(() => /Testing/.test(document.getElementById('ibTester').textContent), null, { timeout: 5000 }).catch(() => {});
  check('it shows it is testing', /Testing/.test(await page.textContent('#ibTester')));
  check('a second start while it runs starts nothing new', (await s.ok('POST', '/api/tester', {})).already === true);
  for (let i = 0; i < 40 && !fs.existsSync(s.wakeOut); i++) await sleep(250);
  await sleep(300);
  check('the tester runs on the smaller model, in its own name, with the tester brief', /--model.*sonnet/.test(fs.readFileSync(s.wakeOut, 'utf8')) && /Tester \(Sonnet\)/.test(fs.readFileSync(s.wakeOut, 'utf8')) && /TESTER\.md/.test(fs.readFileSync(s.wakeOut, 'utf8')));
  for (let i = 0; i < 40 && (await s.ok('GET', '/api/tester')).running; i++) await sleep(250);
  // At night: the watchman starts it by itself.
  await s.ok('POST', '/api/quiet', { on: true, watch: ['tst'] });
  await sleep(4500);
  await s.ok('POST', '/api/watchman/round'); await sleep(300);
  const log = fs.readFileSync(path.join(s.data, 'logs', '_tester.log'), 'utf8');
  check('at night the watchman starts the tester', (log.match(/started:/g) || []).length === 2, log);
  await s.ok('POST', '/api/quiet', { on: false });
  noErrors(page);
}, true);

def('verbose', '👁 verbose runs: the team\'s steps land in its log as readable lines, also from a hidden run (AIG-154, AIG-275)', async s => {
  await mkProject(s, 'Loud', 'LOU', { path: tmp('loud') });
  await s.ok('PATCH', '/api/projects/loud', { verbose: true });
  check('wake starts a run', (await s.ok('POST', '/api/projects/loud/wake')).running === true);
  let r; for (let i = 0; i < 40; i++) { await sleep(250); r = await s.ok('GET', '/api/projects/loud/agentlog'); if (/=== exited/.test(r.text)) break; }
  check('its step shows as a readable line, then the run ends', r.verbose && /💬 hello from a verbose run/.test(r.text) && /=== exited/.test(r.text) && !/"type"/.test(r.text), r.text);
}, false, (() => {
  // A stand-in agent that talks like the real one in verbose mode: one JSON event per line on stdout.
  const bat = path.join(tmp('loudagent'), 'agent.bat');
  fs.writeFileSync(bat, `@echo off\r\necho {"type":"assistant","message":{"content":[{"type":"text","text":"hello from a verbose run"}]}}\r\nping -n 2 127.0.0.1 >nul\r\n`);
  return { AIGILE_AGENT_COMMAND: bat };
})());

def('nightglance', '🌙 night glance: a calm pop-out with the watchman per project; an amber glow only for real blockers (AIG-209)', async (s, ctx) => {
  await mkProject(s, 'Calm', 'CLM', { path: tmp('calm') });
  await mkProject(s, 'Trouble', 'TRB', { path: tmp('trouble') });
  const page = await openPage(ctx, '#/pop-night');
  await page.waitForSelector('.ng');
  check('when not going quiet it says the watchman is off', /watchman is off/.test(await page.textContent('.ng')));
  // AIG-1353: the first paint, before app.js loads: the glance is night-coloured with no top bar (saved light theme), and a start
  // while quiet is in night colours (saved black theme), not black first; a stale quiet is cleared once the board answers
  const early = async (hash, theme, nightBoot) => {
    const c2 = await ctx.browser().newContext({ serviceWorkers: 'block' }), p2 = await c2.newPage();
    await p2.addInitScript(([th, nb]) => { try { if (!sessionStorage.getItem('qaSeeded')) { sessionStorage.setItem('qaSeeded', '1'); localStorage.setItem('aigile.theme', th); if (nb) localStorage.setItem('aigile.nightBoot', nb); } } catch {} }, [theme, nightBoot]);
    let release; const held = new Promise(r => { release = r; });
    await p2.route('**/js/app.js*', async route => { await held; await route.continue(); });
    await p2.goto(page.url().split('#')[0] + hash, { waitUntil: 'commit' });
    await p2.waitForSelector('body', { state: 'attached' }); await sleep(500);
    const r = await p2.evaluate(() => ({ app: typeof setNight === 'function', pop: document.documentElement.hasAttribute('data-popnight'), night: document.documentElement.hasAttribute('data-night'), bg: getComputedStyle(document.body).backgroundColor, header: getComputedStyle(document.querySelector('body > header')).display }));
    release(); return { r, p2, c2 };
  };
  { const { r, c2 } = await early('#/pop-night', 'light'); await c2.close();
    check('night glance: night background and no top bar at the first paint, before app.js (AIG-1353)', !r.app && r.pop && r.bg === 'rgb(11, 6, 5)' && r.header === 'none', JSON.stringify(r)); }
  { const { r, p2, c2 } = await early('#/', 'black', JSON.stringify({ s: new Date().toISOString(), u: '' }));
    check('a start while quiet is in night colours from the first paint, not black first (AIG-1353)', !r.app && r.night && r.bg === 'rgb(13, 9, 6)', JSON.stringify(r));
    let gone = false; for (let i = 0; i < 40 && !gone; i++) { await sleep(250); gone = await p2.evaluate(() => !document.documentElement.hasAttribute('data-night') && !localStorage.getItem('aigile.nightBoot')); }
    check('not quiet any more: the board drops the remembered night mode', gone); await c2.close(); }
  await s.ok('POST', '/api/quiet', { on: true });
  await page.reload(); await page.waitForSelector('.ng-list li');
  { let nb = false; for (let i = 0; i < 40 && !nb; i++) { nb = await page.evaluate(() => { const n = JSON.parse(localStorage.getItem('aigile.nightBoot') || 'null'); return !!(n && n.s); }); if (!nb) await sleep(250); }
    check('quiet is remembered for the next start (aigile.nightBoot)', nb); }
  check('one quiet line per watched project, no top bar', (await page.locator('.ng-list li').count()) === 2 && await page.locator('header').isHidden());
  check('calm night: no glow', /All calm/.test(await page.textContent('.ng')) && !(await page.evaluate(() => document.body.classList.contains('ng-urgent'))));
  await page.evaluate(() => localStorage.removeItem('aigile.standupAsked')); await page.reload(); await page.waitForSelector('.ng-list li'); await page.waitForTimeout(2500);
  check('no "Call stand-ups?" box over the glance, even on a new day (AIG-281)', (await page.locator('#suPrompt').count()) === 0);
  await s.ok('POST', '/api/standup', { projects: ['trouble'] });
  s.cli(['standup', 'trouble', '--done', 'x', '--next', 'y', '--blockers', 'Server is down, nothing else can go on', '--as', 'Lead']);
  await page.reload(); await page.waitForSelector('.ng-urgent-line', { timeout: 6000 }).catch(() => {});
  check('a real blocker: the edge glows and one line says what', await page.evaluate(() => document.body.classList.contains('ng-urgent')) && /Server is down/.test(await page.textContent('.ng-urgent-line')));
  await s.ok('POST', '/api/quiet', { on: false });
  // AIG-1389: Home and rail use the glance's expanded list, including space children.
  await mkProject(s, 'Space', 'SPC');
  await mkProject(s, 'Child', 'CHD', { parent: 'space' });
  const home = await openPage(ctx, '#/');
  const visible = async (want) => {
    await home.evaluate(() => refresh(true));
    await home.waitForFunction(expected => {
      const slugs = sel => [...document.querySelectorAll(sel)].map(e => e.dataset.slug || e.getAttribute('href').split('/').pop()).sort().join(',');
      return slugs('#app a.proj') === expected && slugs('#dmRail [data-slug]') === expected;
    }, want.slice().sort().join(','));
    check('Home and rail show ' + (want.join(', ') || 'no unwatched projects'), true);
  };
  await s.ok('POST', '/api/quiet', { on: true, watch: ['space'] });
  await visible(['space', 'child']);
  await page.reload(); await page.waitForSelector('.ng-list li');
  check('glance and Home agree on watched space children', await page.locator('.ng-list li').count() === 2);
  await home.setViewportSize({ width: 390, height: 844 });
  await visible(['space', 'child']);
  check('phone night layout fits', await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await home.setViewportSize({ width: 1280, height: 900 });
  await home.evaluate(() => localStorage.setItem('aigile.theme', 'dark'));
  await home.reload(); await visible(['space', 'child']);
  const shots = 'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots';
  fs.mkdirSync(shots, { recursive: true });
  await home.screenshot({ path: path.join(shots, 'AIG-1389.png'), fullPage: true });
  await s.ok('POST', '/api/quiet', { on: true, watch: [] });
  await visible([]);
  await s.ok('POST', '/api/quiet', { on: false });
  await visible(['calm', 'trouble', 'space', 'child']);
  noErrors(home);
  noErrors(page);
}, true);

def('watchdm', '🌙 watchman DMs: while quiet only its chat is listed, one message per critical problem, you can write to it (AIG-211, AIG-221)', async (s, ctx) => {
  await mkProject(s, 'Calm', 'CLM', { path: tmp('calm2') });
  await mkProject(s, 'Trouble', 'TRB', { path: tmp('trouble2') });
  check('awake: the leads\' chats are listed', (await s.ok('GET', '/api/chats')).some(c => c.slug === 'calm'));
  await s.ok('POST', '/api/quiet', { on: true });
  let chats = await s.ok('GET', '/api/chats');
  check('quiet: only the watchman is listed, with nothing unread', chats.length === 1 && chats[0].slug === '_watchman' && chats[0].unread === 0);
  await s.ok('POST', '/api/standup', { projects: ['trouble'] });
  s.cli(['standup', 'trouble', '--done', 'x', '--next', 'y', '--blockers', 'Server is down, nothing else can go on', '--as', 'Lead']);
  await sleep(4500);   // let the wake-up runs finish
  await s.ok('POST', '/api/watchman/round'); await s.ok('POST', '/api/watchman/round');
  check('its message shows as unread', (await s.ok('GET', '/api/chats'))[0].unread === 1);
  const th = await s.ok('GET', '/api/chats/_watchman');
  check('a real blocker gives one message, not one per round', th.messages.length === 1 && /Server is down/.test(th.messages[0].text));
  check('opening the chat reads it: no unread badge left (AIG-278)', (await s.ok('GET', '/api/chats'))[0].unread === 0);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.click('#dmPanel [data-dm="_watchman"]');
  await page.waitForSelector('#dmList .dm-msg');
  check('its chat shows the message and has a typing box (AIG-221)', /Server is down/.test(await page.textContent('#dmList')) && await page.locator('#dmPanel .dm-compose').isVisible());
  await s.ok('POST', '/api/quiet', { on: false });
  check('back from quiet: the leads are back', (await s.ok('GET', '/api/chats')).some(c => c.slug === 'calm'));
  noErrors(page);
}, true);
