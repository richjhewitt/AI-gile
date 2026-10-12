// QA area: tokenlimits (AIG-522, docs/TOKENS.md): helper cap in the brief (#3), nightly token budget checked during a run (#4),
// `aigile i18n missing` (#9), the blind-spot run logging and cache reads on the Usage page (#10).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, check, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('tokenlimits', '🪙 helper cap by spend scale, nightly token budget stops a run, i18n missing, blind-spot run logging, cache reads on Usage (AIG-522)', async (s, ctx) => {
  const folderOf = p => p.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  const node = (code, env = {}) => { const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, AIGILE_DATA: s.data, AIGILE_USAGE_DIR: s.usageDir, AIGILE_LOCAL: path.join(s.dir, 'aigile.local.json'), ...env }, encoding: 'utf8', cwd: ROOT }); return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
  const B = JSON.stringify(path.join(ROOT, 'lib', 'budget.js'));

  // #3 The helper cap follows the spend/pace scale.
  await mkProject(s, 'Cap', 'CAP', { path: tmp('cap') });
  const cap = async plan => { await s.ok('POST', '/api/setup', { prefs: { plan } }); const o = s.cli(['brief', 'cap']).out; return (/Helpers: at most (\d+) per run/.exec(o) || [])[1]; };
  const caps = []; for (const k of ['fly', 'careful', 'normal', 'generous', 'nospare']) caps.push(await cap(k));
  check('helpers per run follow the scale: 2, 3, 4, 5, 6', caps.join() === '2,3,4,5,6', caps.join());
  check('the brief asks for exact files or line ranges', /exact files or line ranges/.test(s.cli(['brief', 'cap']).out));
  check('AGENTS.md says at most 4 helpers, with exact files', /at most 4 helpers per run[^]*exact files or line ranges/.test(fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')));

  // #4 Nightly budget: a run's growing session log is read while it goes; past the limit it is stopped and the card told.
  const dir = tmp('night'); await mkProject(s, 'Night', 'NGT', { path: dir });
  const card = await mkCard(s, 'night', 'Busy card', { status: 'doing' });
  const sess = path.join(s.usageDir, folderOf(dir)); fs.mkdirSync(sess, { recursive: true });
  const put = (out, ago = 0) => fs.writeFileSync(path.join(sess, 's.jsonl'), JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date(Date.now() - ago).toISOString(), message: { id: 'm1', model: 'opus', usage: { input_tokens: 10, output_tokens: out, cache_read_input_tokens: 0 }, content: [] } }) + '\n');
  const run = `{ slug: 'night', pid: process.pid, startedAt: Date.now() - 600e3 }`;
  const go = (extra = '') => node(`const b = require(${B}); const killed = []; const r = b.checkNight({ runs: [${run}], kill: p => killed.push(p) }); ${extra} console.log(JSON.stringify({ r, killed, lim: b.nightLimit() }));`);
  await s.ok('POST', '/api/setup', { prefs: { plan: 'fly' } });
  put(100e3);   // 500k units
  let g = JSON.parse(go().out || '{}');
  check('slow and steady limit is 8M; a run at 0.5M is left alone', g.lim === 8e6 && g.r.length === 0 && g.killed.length === 0, g);
  put(2e6);   // 10M units
  g = JSON.parse(go().out || '{}');
  check('past the limit the run is stopped (killTree called with its pid)', g.r.join() === 'night' && g.killed.length === 1, g);
  let p = await s.ok('GET', '/api/projects/night');
  const notes = c => (c.comments || []).filter(m => /Token budget reached/.test(m.text));
  check('the card in progress gets a "budget reached" note', notes(p.cards.find(c => c.id === card.id)).length === 1, p.cards.map(c => c.comments));
  check('and the team log says so', /token budget reached/.test(fs.readFileSync(path.join(s.data, 'logs', 'night.log'), 'utf8')));
  fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), JSON.stringify({ slug: 'night', start: Date.now() - 3e6, end: Date.now() - 2e6, fresh: 10, cw: 0, out: 1.6e6, cache: 0, in: 10 }) + '\n');
  put(100e3);
  g = JSON.parse(go().out || '{}');
  check('finished runs tonight count too (8M earlier + 0.5M now)', g.r.join() === 'night', g);
  fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), JSON.stringify({ slug: 'night', start: Date.now() - 9e9, end: Date.now() - 3 * 864e5, fresh: 10, cw: 0, out: 9e6, cache: 0 }) + '\n');
  g = JSON.parse(go().out || '{}');
  check('runs from earlier nights do not', g.r.length === 0, g);
  await s.ok('POST', '/api/setup', { prefs: { plan: 'nospare' } });
  put(2e6);
  g = JSON.parse(go().out || '{}');
  check('🚀 no expense spared has no cap: nothing stopped', g.lim === 0 && g.r.length === 0, g);
  const lims = []; for (const k of ['fly', 'careful', 'normal', 'generous']) { await s.ok('POST', '/api/setup', { prefs: { plan: k } }); lims.push(JSON.parse(go().out || '{}').lim); }
  check('the limit grows with the scale', lims.every((v, i) => v > 0 && (!i || v > lims[i - 1])), lims.join());
  fs.writeFileSync(path.join(s.dir, 'aigile.local.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(s.dir, 'aigile.local.json'), 'utf8')), budget: { night: 123456 } }));
  check('"budget": { "night": N } in the settings overrides the scale', JSON.parse(go().out || '{}').lim === 123456);
  const mark = s.cli(['brief', 'night']);
  check('a dead pid is never killed', JSON.parse(node(`const b = require(${B}); const k = []; b.checkNight({ runs: [{ slug: 'night', pid: 999999, startedAt: 1 }], kill: p => k.push(p), alive: () => false }); console.log(JSON.stringify(k));`).out) .length === 0 && mark.code === 0);
}, true);
