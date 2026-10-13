// QA area: swarm (AIG-822): aigile swarm <proj> holds other projects' background runs, lifts the helper cap in the swarm
// project's brief, tells the others to stop at a safe point; swarm off wakes the held teams.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, say, def } from '../lib.mjs';

def('swarm', '🚨 swarm: other projects wait, the swarm project gets no helper cap, off wakes the held teams (AIG-822)', async s => {
  await mkProject(s, 'Hive', 'HIV', { path: tmp('sw1') });
  await mkProject(s, 'Other', 'OTH', { path: tmp('sw2') });
  const c = await mkCard(s, 'other', 'held card');
  const log = path.join(s.data, 'logs', 'other.log');
  const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  const r = s.cli(['swarm', 'hive', '--as', 'Lead']);
  check('the CLI starts it', /Swarm on Hive/.test(r.out), r);
  check('the swarm project has no helper cap', /Swarm on this project/.test(s.cli(['brief', 'hive']).out) && !/Helpers: at most/.test(s.cli(['brief', 'hive']).out));
  check('other projects are told to stop at a safe point', /Swarm on Hive: finish your current step/.test(s.cli(['brief', 'other']).out));
  await say(s, 'other', c.id, 'Owner', 'news while swarming');
  await sleep(600);
  check('an owner comment elsewhere starts no run', starts() === 0 && /swarm on another project/.test(fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''), starts());
  const st = await s.ok('GET', '/api/swarm');
  check('the held team is listed', st.on && st.paused.includes('other'), st);
  await s.ok('POST', '/api/swarm', { off: true });
  await sleep(600);
  check('off wakes the held team', starts() === 1 && !(await s.ok('GET', '/api/swarm')).on, starts());
}, false);
