// QA area: swarm (AIG-822): aigile swarm <proj> holds other projects' background runs, lifts the helper cap in the swarm
// project's brief, tells the others to stop at a safe point; swarm off wakes the held teams.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

// A fake agent that just waits a while (AIG-827), so a team is "running" while the swarm button is pressed.
const stubDir = tmp('swarmbtn'), win = process.platform === 'win32';
const stub = path.join(stubDir, 'wait-stub' + (win ? '.bat' : '.sh'));
fs.writeFileSync(stub, win ? ['@echo off', 'ping -n 40 127.0.0.1 >nul', ''].join('\r\n') : ['#!/bin/sh', 'sleep 20', ''].join('\n'));
if (!win) fs.chmodSync(stub, 0o755);

def('swarm', '🚨 swarm: other projects wait, the swarm project gets no helper cap, off wakes the held teams; the Swarm this button (AIG-822, AIG-827)', async (s, ctx) => {
  await mkProject(s, 'Hive', 'HIV', { path: tmp('sw1') });
  await mkProject(s, 'Other', 'OTH', { path: tmp('sw2') });
  const c = await mkCard(s, 'other', 'held card');
  const log = path.join(s.data, 'logs', 'other.log');
  const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  const r = s.cli(['swarm', 'hive', '--as', 'Lead']);
  check('the CLI starts it', /Swarm on Hive/.test(r.out), r);
  check('the swarm project has no helper cap', /Swarm on this project/.test(s.cli(['brief', 'hive']).out) && !/Helpers: at most/.test(s.cli(['brief', 'hive']).out));
  check('other projects are told to stop at a safe point', /Swarm on Hive: finish your current step/.test(s.cli(['brief', 'other']).out));
  await s.ok('POST', '/api/projects/other/bye');   // the brief marked a lead as in a session (AIG-447); a closed window lets the background run be held instead
  await say(s, 'other', c.id, 'Owner', 'news while swarming');
  await sleep(600);
  check('an owner comment elsewhere starts no run', starts() === 0 && /swarm on another project/.test(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''), starts());
  const st = await s.ok('GET', '/api/swarm');
  check('the held team is listed', st.on && st.paused.includes('other'), st);
  await s.ok('POST', '/api/swarm', { off: true });
  await sleep(600);
  check('off wakes the held team', starts() === 1 && !(await s.ok('GET', '/api/swarm')).on, starts());

  // 🚨 The Swarm this button (AIG-827): on the board and in the Scrum Master panel; confirm; bar; running teams get a plain note.
  await mkProject(s, 'Busy', 'BSY', { path: tmp('sw3') });
  await mkProject(s, 'Quiet', 'QUI', { path: tmp('sw4') });
  await mkCard(s, 'busy', 'busy card', { status: 'doing', assignee: 'Forge' });
  await s.ok('POST', '/api/projects/busy/wake');
  check('the busy team is running', await until(async () => (await s.ok('GET', '/api/projects/busy')).presence.running, 6000));
  const page = await openPage(ctx, '#/p/hive');
  const asked = [];
  page.on('dialog', d => { asked.push(d.message()); d.accept(); });
  await page.waitForSelector('#swarmBtn');
  check('the board toolbar has the button', /Swarm this/.test(await page.textContent('#swarmBtn')), await page.textContent('#swarmBtn'));
  await page.click('#swarmBtn');
  await until(async () => (await s.ok('GET', '/api/swarm')).slug === 'hive', 6000);
  check('it asked first', asked.length === 1 && /Swarm Hive/.test(asked[0]), asked);
  await page.waitForSelector('#swarmBar:not([hidden])');
  check('the red bar shows', /Hive/.test(await page.textContent('#swarmBar')), await page.textContent('#swarmBar'));
  await page.waitForFunction(() => /Turn off swarm/.test(document.getElementById('swarmBtn').textContent));
  check('the button now reads Turn off swarm', /Turn off swarm/.test(await page.textContent('#swarmBtn')));
  const busy = await s.ok('GET', '/api/projects/busy');
  check('the running team got the safe-stop note, not a kill', (busy.agentMsgs || []).some(m => /Swarm on Hive: finish your current step, commit, then stop/.test(m.text)) && (await s.ok('GET', '/api/projects/busy')).presence.running, busy.agentMsgs);
  check('the idle project got no note', !((await s.ok('GET', '/api/projects/quiet')).agentMsgs || []).length);
  await page.click('#swarmBtn');
  await until(async () => !(await s.ok('GET', '/api/swarm')).on, 6000);
  await page.waitForFunction(() => /Swarm this/.test(document.getElementById('swarmBtn').textContent));
  check('Turn off swarm ends it with no confirm', asked.length === 1);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  if (await page.isVisible('#tbDots') && !(await page.isVisible('#swarmBtn'))) await page.click('#tbDots');   // the toolbar is behind ⋯ on a phone (AIG-933)
  const box = await page.$eval('#swarmBtn', e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1; });
  check('the button fits a phone width', box);
  await page.setViewportSize({ width: 1280, height: 800 });
  // The Scrum Master panel (the Lead Scrum Master chat) has it too.
  await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]'); await page.click('#dmPanel [data-dm="_watchman"]');
  await page.waitForSelector('#smSwarm', { timeout: 8000 });
  check('the Scrum Master panel has the button', /Swarm this/.test(await page.textContent('#smSwarm')), await page.textContent('#smSwarm'));
  await page.click('#smSwarm');
  await until(async () => (await s.ok('GET', '/api/swarm')).slug === 'hive', 6000);
  await page.waitForFunction(() => /Turn off swarm/.test(document.getElementById('smSwarm').textContent));
  check('the panel button turns into Turn off swarm', /Turn off swarm/.test(await page.textContent('#smSwarm')));
  await page.click('#smSwarm');
  await until(async () => !(await s.ok('GET', '/api/swarm')).on, 6000);
  check('and turns it off', !(await s.ok('GET', '/api/swarm')).on);
  noErrors(page); await page.close();
}, true, { AIGILE_AGENT_COMMAND: stub });
