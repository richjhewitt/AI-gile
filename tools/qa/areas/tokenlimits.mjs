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

  // #10 Blind spots: non-team runs are logged with a kind, lead sessions are told apart by folder, cache reads show on the Usage page.
  const src = f => fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8');
  check('the Scrum Master, the tester, ask and pack all log their run with a kind', /logRun\('scrummaster', '_scrummaster'/.test(src('watchman.js')) && /logRun\('tester', '_tester'/.test(src('tester.js')) && /slug: '_ask', kind: 'ask'/.test(src('ask.js')) && /slug: '_pack', kind: 'pack'/.test(src('pack.js')));
  const U = JSON.stringify(path.join(ROOT, 'lib', 'usage.js')), testerDir = tmp('tester-folder');
  const msg = (id, u) => JSON.stringify({ type: 'assistant', requestId: 'q' + id, timestamp: new Date().toISOString(), message: { id: 'n' + id, model: 'claude-sonnet-4', usage: u, content: [] } }) + '\n';
  const tsess = path.join(s.usageDir, folderOf(testerDir)); fs.mkdirSync(tsess, { recursive: true });
  fs.writeFileSync(path.join(tsess, 't.jsonl'), msg(1, { input_tokens: 100, cache_creation_input_tokens: 900, output_tokens: 300, cache_read_input_tokens: 40000 }));
  fs.writeFileSync(path.join(s.data, 'logs', '_runs.jsonl'), '');
  const lg = JSON.parse(node(`const u = require(${U}); const log = ${JSON.stringify(path.join(s.data, 'logs', '_t.log'))}; const row = u.logRun('tester', '_tester', { folder: ${JSON.stringify(testerDir)}, start: Date.now() - 60e3, log }); const miss = u.logRun('tester', '_tester', { folder: ${JSON.stringify(testerDir + '-nope')}, start: Date.now() - 60e3 }); console.log(JSON.stringify({ row, miss }));`).out || '{}');
  const rows = fs.readFileSync(path.join(s.data, 'logs', '_runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  check('a tester run row has the team-run fields plus kind', rows.length === 1 && rows[0].kind === 'tester' && rows[0].slug === '_tester' && rows[0].in === 1000 && rows[0].out === 300 && rows[0].cache === 40000 && rows[0].fresh === 100 && rows[0].cw === 900 && Array.isArray(rows[0].cards) && (rows[0].models || []).length === 1, rows);
  check('nothing found, nothing logged', lg.miss === null && rows.length === 1);
  check('the tester log gets the tokens line', /=== tokens: 1k in · 300 out · 40k cache read ===/.test(fs.readFileSync(path.join(s.data, 'logs', '_t.log'), 'utf8')));
  // A lead session: messages in the project's folder and in one of its helper worktrees, none of them in a team run.
  const ldir = tmp('lead'); await mkProject(s, 'Lead', 'LED', { path: ldir });
  const lsess = path.join(s.usageDir, folderOf(ldir)), wsess = path.join(s.usageDir, folderOf(ldir) + '--claude-worktrees-agent-1');
  fs.mkdirSync(lsess, { recursive: true }); fs.mkdirSync(wsess, { recursive: true });
  fs.writeFileSync(path.join(lsess, 'l.jsonl'), msg(2, { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 5000 }));
  fs.writeFileSync(path.join(wsess, 'w.jsonl'), msg(3, { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 7000 }));
  const runsApi = await s.ok('GET', '/api/usage/runs');
  const lead = runsApi.find(r => r.kind === 'lead' && r.slug === 'lead');
  check('VS Code lead sessions are attributed by folder, helper worktrees included', lead && lead.cache === 12000 && lead.out === 100, runsApi);
  check('a kind row is listed with the team runs', runsApi.some(r => r.kind === 'tester' && r.cache === 40000), runsApi);
  const upage = await openPage(ctx, '#/usage');
  await upage.waitForSelector('.uz-runtotal', { timeout: 8000 });
  const utext = await upage.textContent('.uz-runtotal'), table = await upage.textContent('.uz-tablewrap');
  check('the Usage page totals the cache reads', /cache read/.test(utext) && /52k/.test(utext), utext);
  check('and names the AI tester and the lead sessions', /AI tester/.test(table) && /Lead session \(VS Code\): Lead/.test(table), table.slice(0, 300));
  noErrors(upage);

  // #9 aigile i18n missing <lang>: only the English keys a language file lacks, as JSON.
  const lang = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', f + '.json'), 'utf8'));
  const en = lang('en'), fr = lang('fr'), wantFr = Object.keys(en).filter(k => !(k in fr));
  const m = s.cli(['i18n', 'missing', 'fr']);
  let got = {}; try { got = JSON.parse(m.out); } catch {}
  check('i18n missing prints JSON of exactly the missing keys with their English text', m.code === 0 && Object.keys(got).join() === wantFr.join() && wantFr.every(k => JSON.stringify(got[k]) === JSON.stringify(en[k])), m.out.slice(0, 200));
  check('and it is much smaller than en.json', m.out.length < JSON.stringify(en).length / 5 && wantFr.length > 0);
  check('a complete language prints {}', s.cli(['i18n', 'missing', 'nl']).out === '{}');
  check('English itself has nothing missing', s.cli(['i18n', 'missing', 'en']).out === '{}');
  check('a language that does not exist is refused', s.cli(['i18n', 'missing', 'zz-nope']).code !== 0);
  check('no language given is refused with usage', /usage: aigile i18n missing/.test(s.cli(['i18n', 'missing']).err));
}, true);
