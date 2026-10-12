// QA areas: quietinbox, poke, wakenews, runtokens (split from team-quiet.mjs, AIG-297).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';
const require = createRequire(import.meta.url);

def('quietinbox', 'going quiet hides tests and tasks and caps questions at 3; I\'m back restores them', async (s, ctx) => {
  await mkProject(s, 'Qi', 'QIX');
  for (let i = 1; i <= 5; i++) {
    await mkCard(s, 'qi', 'Ask ' + i, { status: 'doing', assignee: 'Forge' });
    await say(s, 'qi', 'QIX-' + i, 'Forge', 'question ' + i, { needsYou: true });
    await sleep(15);
  }
  await mkCard(s, 'qi', 'Qi task', { status: 'doing', assignee: 'Pixel' });
  await s.ok('PATCH', '/api/projects/qi/cards/QIX-6', { assignee: 'Owner' });
  await say(s, 'qi', 'QIX-6', 'Pixel', 'do this');
  await mkCard(s, 'qi', 'Qi test', { status: 'verify', testSteps: 'try it' });
  const page = await openPage(ctx, '#/inbox');
  page.on('dialog', d => d.accept());
  await page.waitForSelector('.ib-item');
  check('awake: 5 questions, task and test show', (await page.locator('.ib-item.q').count()) === 5 && (await page.locator('.ib-item.k').count()) === 1 && (await page.locator('.ib-item.t').count()) === 1);
  await s.ok('POST', '/api/quiet', { on: true });
  await page.waitForSelector('html[data-night]', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(500);
  check('quiet: 3 newest questions, no task or test', (await page.locator('.ib-item.q').count()) === 3 && (await page.locator('.ib-item.k, .ib-item.t').count()) === 0);
  check('quiet: newest question is shown, oldest is not', (await page.locator('.ib-item[data-id="QIX-5"]').count()) === 1 && (await page.locator('.ib-item[data-id="QIX-1"]').count()) === 0);
  check('quiet: more waiting line', /2 waiting for the morning/.test(await page.textContent('#ibMore')));
  const top = await page.textContent('#inboxTop .ib-btn');
  check('quiet: top bar hides tasks and tests', /3 questions/.test(top) && !/to do|to test/.test(top), top);
  await page.click('text=☀️ I\'m back');
  await page.waitForTimeout(500);
  check('back: everything shows again', (await page.locator('.ib-item.q').count()) === 5 && (await page.locator('.ib-item.k').count()) === 1 && (await page.locator('.ib-item.t').count()) === 1 && await page.isHidden('#ibMore'));
  noErrors(page);
}, true);

def('poke', 'asleep teams with work and stuck teams show as needing a poke', async (s, ctx) => {
  await mkProject(s, 'Sleepy', 'SLP', { path: tmp('sleepy') });
  await s.ok('POST', '/api/projects/sleepy/cards', { title: 'work', status: 'todo' });
  await mkProject(s, 'Empty', 'EMP');
  const ps = await s.ok('GET', '/api/projects');
  check('asleep with work needs a poke', ps.find(p => p.slug === 'sleepy').attention?.kind === 'asleep');
  check('no work, no poke', ps.find(p => p.slug === 'empty').attention === null);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#pokeTop .pokebadge', { timeout: 7000 }).catch(() => {});
  check('top-bar badge shows', /1 team needs a poke/.test(await page.textContent('#pokeTop')), await page.textContent('#pokeTop'));
  check('home tile says why, with a Wake button', /Needs a poke/.test(await page.textContent('.proj.needs-poke')) && !!(await page.$('.proj.needs-poke button.primary')));
  await page.click('#pokeTop .pokebadge');
  await new Promise(r => setTimeout(r, 1500));
  check('tapping the badge wakes the asleep team', /started/.test((await s.ok('GET', '/api/projects/sleepy/agentlog')).text));
  await s.ok('GET', '/api/projects/sleepy/updates');
  check('online clears it', (await s.ok('GET', '/api/projects/sleepy')).cards && (await s.ok('GET', '/api/projects')).find(p => p.slug === 'sleepy').attention === null);
  const { attention } = require('../../../lib/store.js');
  const old = new Date(Date.now() - 11 * 60e3).toISOString(), fresh = new Date().toISOString();
  const proj = at => ({ cards: [{ status: 'team', createdBy: '', created: old, updated: old, comments: [{ author: 'Owner', text: 'x', at }] }] });
  check('online, comment unanswered 10+ min = stuck', attention(proj(old), { online: true })?.kind === 'stuck');
  check('online, fresh comment = fine', attention(proj(fresh), { online: true }) === null);
  noErrors(page);
}, true);

// AIG-272: a background run only starts for unseen owner news, not for agent comments, card moves or news already seen.
def('wakenews', 'agent comments and card moves start no run; an owner comment does; news already seen does not (AIG-272)', async s => {
  await mkProject(s, 'Newsy', 'NWS', { path: tmp('wn') });
  const c = await mkCard(s, 'newsy', 'news card');
  const log = path.join(s.data, 'logs', 'newsy.log');
  const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  const idle = async () => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/newsy')).presence.running; i++) await sleep(250); };
  await say(s, 'newsy', c.id, 'Smizzy', 'agent comment');
  await s.ok('PATCH', `/api/projects/newsy/cards/${c.id}`, { status: 'doing' });
  await s.ok('PATCH', `/api/projects/newsy/cards/${c.id}`, { status: 'review' });
  await sleep(600);
  check('agent comment and card moves start no run', starts() === 0, starts());
  await say(s, 'newsy', c.id, 'Owner', 'real news');
  await sleep(600);
  check('owner comment starts a run', starts() === 1, starts());
  await idle();
  await s.ok('GET', '/api/projects/newsy/updates?mark=1');
  await say(s, 'newsy', c.id, 'Smizzy', 'agent again');
  await sleep(600);
  check('news already marked seen starts no run', starts() === 1, starts());
  check('updates agrees there is nothing new', (await s.ok('GET', '/api/projects/newsy/updates')).cards.length === 0);
}, false);

def('runtokens', 'a background run logs the tokens its session used (fake session file), none when nothing is found; Usage page table (AIG-266)', async (s, ctx) => {
  const folder = tmp('tok');
  await mkProject(s, 'Tokk', 'TOK', { path: folder });
  fs.mkdirSync(folder + '-n');
  await mkProject(s, 'Nada', 'NAD', { path: folder + '-n' });
  // The agent's session log: one message in the run (written twice), one an hour old. Written just before the wake
  // (the stand-in agent is gone in a second or two); the sum allows a second either side of the run.
  const sess = path.join(s.usageDir, folder.replace(/[^A-Za-z0-9]/g, '-').toLowerCase());
  fs.mkdirSync(sess, { recursive: true });
  const msg = (id, ago, u, tools) => JSON.stringify({ type: 'assistant', requestId: 'r' + id, timestamp: new Date(Date.now() - ago).toISOString(), message: { id: 'm' + id, model: 'sonnet', usage: u, content: tools } });
  const a = msg(1, 0, { input_tokens: 1000, cache_creation_input_tokens: 500, output_tokens: 400, cache_read_input_tokens: 20000 }, [{ type: 'tool_use', id: 'tu1', name: 'Read' }, { type: 'tool_use', id: 'tu2', name: 'Read' }, { type: 'tool_use', id: 'tu3', name: 'Grep' }, { type: 'text', text: 'x' }]);
  const res = JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'a'.repeat(300) }, { type: 'tool_result', tool_use_id: 'tu2', content: [{ type: 'text', text: 'b'.repeat(200) }] }, { type: 'tool_result', tool_use_id: 'tu3', content: 'c'.repeat(5000) }] } });
  fs.writeFileSync(path.join(sess, 's1.jsonl'), [a, a, res, msg(2, 3600e3, { input_tokens: 99999, output_tokens: 99999 })].join('\n') + '\n');
  const work = await mkCard(s, 'tokk', 'Worked in the run');
  await mkCard(s, 'tokk', 'Untouched card', { status: 'done' });
  await say(s, 'tokk', work.id, 'Smizzy', 'on it');
  const wake = await s.ok('POST', '/api/projects/tokk/wake');
  check('wake starts a run', wake.running === true, wake);
  await s.ok('POST', '/api/projects/nada/wake');
  const logPath = path.join(s.data, 'logs', 'tokk.log'), nadaLog = path.join(s.data, 'logs', 'nada.log');
  let log = '';
  for (let i = 0; i < 360; i++) { await sleep(250); log = fs.readFileSync(logPath, 'utf8'); if (/=== exited/.test(log)) break; }
  await sleep(300);
  log = fs.readFileSync(logPath, 'utf8');
  check('tokens line follows the exit line', /=== exited \w+ ===\r?\n=== tokens: 1\.5k in · 400 out · 20k cache read ===/.test(log), log);
  for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/nada')).presence.running; i++) await sleep(250);
  const nl = fs.readFileSync(nadaLog, 'utf8');
  check('no session found, no tokens line', /=== exited/.test(nl) && !/tokens/.test(nl), nl);
  // The hour-old message is outside every run: it comes back as the project's own 'lead' row (AIG-522), apart from the runs.
  const all = await s.ok('GET', '/api/usage/runs');
  const lead = all.filter(r => r.kind === 'lead'), runs = all.filter(r => r.kind !== 'lead');
  check('the work outside any run is one lead row (AIG-522)', lead.length === 1 && lead[0].slug === 'tokk' && lead[0].in === 99999, lead);
  check('runs api lists the run', runs.length === 1 && runs[0].slug === 'tokk' && runs[0].in === 1500 && runs[0].out === 400 && runs[0].cache === 20000, runs);
  const r0 = runs[0] || {};
  check('run row has the split, model, read and grep counts (AIG-299)', r0.fresh === 1000 && r0.cw === 500 && (r0.models || []).join() === 'sonnet' && r0.reads === 2 && r0.readChars === 500 && r0.greps === 1, r0);
  check('run row names the card the team worked on', (r0.cards || []).includes(work.id), r0);
  const page = await openPage(ctx, '#/usage');
  await page.waitForTimeout(1000);
  const txt = await page.textContent('#app');
  check('usage page shows the run table', /Background runs/.test(txt) && /Tokk/.test(txt) && /1\.5k/.test(txt), txt.slice(0, 200));
  noErrors(page);
}, true);
