// QA area: nudge (AIG-593): the 👉 by the typing line in a card chat lights up when your last message is still unseen after
// 3 min, a click is the normal poke, and it goes quiet again once poked or answered.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, getCard, say, def, BASE } from '../lib.mjs';

const open = async (ctx, hash, aheadMs) => {
  const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  if (aheadMs) await page.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, aheadMs);
  await page.goto(BASE + '/' + hash);
  return page;
};

def('nudge', '👉 nudge in the card chat: lit after 3 min unseen, click pokes, quiet once poked or answered (AIG-593)', async (s, ctx) => {
  await mkProject(s, 'Nudge', 'NDG');
  const owner = (await s.ok('GET', '/api/meta')).owner;
  const c = await mkCard(s, 'nudge', 'Stuck job', { status: 'doing' });
  await say(s, 'nudge', c.id, owner, 'how is it going?');
  let page = await open(ctx, `#/pop/nudge/${c.id}`, 0);
  await page.waitForSelector('#modal .chat', { timeout: 8000 });
  await sleep(1200);
  check('fresh message: no nudge yet', !(await page.$('#nudgeBtn.lit')));
  await page.close();
  page = await open(ctx, `#/pop/nudge/${c.id}`, 4 * 60e3);
  await page.waitForSelector('#modal .chat', { timeout: 8000 });
  const lit = await page.waitForSelector('#nudgeBtn.lit', { timeout: 6000 }).catch(() => null);
  check('after 3 min unseen the 👉 lights up', !!lit);
  const before = (await getCard(s, 'nudge', c.id)).status;
  if (lit) await lit.click();
  await sleep(1500);
  const after = await getCard(s, 'nudge', c.id);
  check('a click pokes the card (one 👉 comment), card stays put', after.comments.filter(m => m.poke).length === 1 && after.status === before, [before, after.status]);
  check('once poked it goes quiet', !(await page.$('#nudgeBtn.lit')));
  check('no page errors', page.errors.length === 0, page.errors);
  await page.close();
  await say(s, 'nudge', c.id, owner, 'still there?');
  await say(s, 'nudge', c.id, 'Lead', 'yes, nearly done');
  page = await open(ctx, `#/pop/nudge/${c.id}`, 4 * 60e3);
  await page.waitForSelector('#modal .chat', { timeout: 8000 }); await sleep(1200);
  check('answered by the team: not lit', !(await page.$('#nudgeBtn.lit')));
  await page.close();
}, true);

// AIG-636: the chat's state line says thinking / working / waiting on a command, with how long, and warns when the run's log has been silent 15 min.
def('busystate', '🔄 card chat state line: thinking, working, waiting on a command, with minutes; no sign of life after 15 min silent (AIG-636)', async (s, ctx) => {
  await mkProject(s, 'Busy', 'BSY', { path: tmp('busy') });
  await s.ok('PATCH', '/api/projects/busy', { verbose: true });
  const c = await mkCard(s, 'busy', 'Long job', { status: 'doing' });
  await say(s, 'busy', c.id, 'Lead', 'starting the build');   // a card with messages opens on its chat
  check('no run, no activity', (await s.ok('GET', '/api/projects/busy')).presence.activity === null);
  await s.ok('POST', '/api/projects/busy/wake');
  const act = async () => (await s.ok('GET', '/api/projects/busy')).presence.activity;
  check('a fresh run is thinking', await until(async () => (await act() || {}).state === 'thinking', 6000));
  const a0 = await act();
  check('with since, signAt and a watched log', a0 && !!Date.parse(a0.since) && !!Date.parse(a0.signAt) && a0.watch === true, a0);
  check('then a long shell command is waiting on a command', await until(async () => (await act() || {}).state === 'command', 15000), await act());
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  await page.setViewportSize({ width: 390, height: 800 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(BASE + '/#/pop/busy/' + c.id);
  await page.waitForSelector('#typing .act', { timeout: 8000 });
  const txt = await page.textContent('#typing .act');
  check('the line says what and how long', /waiting on a command · \d+ min|wacht op een commando · \d+ min/.test(txt), txt);
  check('still got its 👉 button', !!(await page.$('#typing #nudgeBtn')));
  check('recent log: no warning', !(await page.$('#typing .act-stale')));
  check('phone width: nothing sticks out sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.close();
  const late = await ctx.newPage(); late.errors = []; late.on('pageerror', e => late.errors.push(String(e)));
  await late.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, 20 * 60e3);
  await late.setViewportSize({ width: 390, height: 800 }); await late.emulateMedia({ colorScheme: 'dark' });
  await late.goto(BASE + '/#/pop/busy/' + c.id);
  const st = await late.waitForSelector('#typing .act-stale', { timeout: 8000 }).catch(() => null);
  check('15+ min silent: "no sign of life for N min"', !!st && /(no sign of life for|geen teken van leven sinds) (19|20|21) min/.test(await st.textContent()), st && await st.textContent());
  check('in the warning colour, not the muted one', st && await late.evaluate(() => getComputedStyle(document.querySelector('#typing .act-stale')).color !== getComputedStyle(document.querySelector('#typing .act')).color));
  check('phone width, dark: still fits', await late.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('no page errors', late.errors.length === 0, late.errors);
  await late.close();
  await s.ok('POST', '/api/notokens', { on: true });   // stop the stub run
  // A session at work (no log to read): working, no stale watch.
  await s.ok('POST', '/api/notokens', { on: false });
  await mkProject(s, 'Sess', 'SES');
  const c2 = await mkCard(s, 'sess', 'In a session', { status: 'doing' });
  await say(s, 'sess', c2.id, 'Lead', 'on it');
  await fetch(s.base + '/api/projects/sess/updates', { headers: { 'X-Aigile-Where': 'vscode' } });
  const a2 = (await s.ok('GET', '/api/projects/sess')).presence.activity;
  check('a session at work: working, not watched', a2 && a2.state === 'working' && a2.watch === false, a2);
  const p2 = await ctx.newPage(); await p2.addInitScript(ms => { const n = Date.now; Date.now = () => n() + ms; }, 20 * 60e3);
  await p2.goto(BASE + '/#/pop/sess/' + c2.id);
  await p2.waitForSelector('#typing .act', { timeout: 8000 });
  check('a session never shows the stale warning', !(await p2.$('#typing .act-stale')) && /working|bezig/.test(await p2.textContent('#typing')));
  await p2.close();
}, true, (() => {
  // A stand-in verbose agent: a thought, then a long shell command (JSON events, one per line).
  const bat = path.join(tmp('busyagent'), 'agent.bat');
  const ev = o => 'echo ' + JSON.stringify(o);
  fs.writeFileSync(bat, ['@echo off', ev({ type: 'assistant', message: { content: [{ type: 'text', text: 'on it' }] } }), 'ping -n 6 127.0.0.1 >nul', ev({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm run build' } }] } }), 'ping -n 120 127.0.0.1 >nul', ''].join('\r\n'));
  return { AIGILE_AGENT_COMMAND: bat, AIGILE_CMD_MS: '1500' };
})());
