// QA area: freeze (AIG-1405). The app froze while many hand-overs, peer reviews and pop-outs hit one busy board: every run's log
// tail copied the whole board each second, a hand-over with --commit ran git synchronously, and each window loaded with a
// synchronous request (so a window could not even close). Checks: the board cache stays right (saves, polls, a hand edit), the
// stall log writes down slow calls, the page makes no synchronous request, a timed-out read says "busy", the desktop app closes a stuck window.
import fs from 'node:fs';
import path from 'node:path';
import { check, def, mkProject, mkCard, openPage, until, noErrors, ROOT } from '../lib.mjs';

def('freeze', 'a busy board: the board cache stays right, slow calls are written to the stall log (AIG-1405)', async s => {
  await mkProject(s, 'Frost', 'FRO');
  const c = await mkCard(s, 'frost', 'First title');
  const card = async () => (await s.ok('GET', '/api/projects/frost?full=1')).cards.find(x => x.id === c.id);
  check('a card reads back after it is made', (await card()).title === 'First title');
  await s.ok('PATCH', `/api/projects/frost/cards/${c.id}`, { title: 'Second title' });
  check('a save is seen by the next read at once', (await card()).title === 'Second title');
  const file = path.join(s.data, 'frost.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('what the board answers is what is on disk', disk.cards.find(x => x.id === c.id).title === 'Second title');
  // A change made outside the board (a put-back backup, an edit by hand) is still picked up.
  disk.cards.find(x => x.id === c.id).title = 'Edited by hand, longer title';
  fs.writeFileSync(file, JSON.stringify(disk));
  check('a file changed by hand is read again', !!(await until(async () => (await card()).title === 'Edited by hand, longer title', 3000)));
  // Two writes in a row both land (each write works on its own fresh copy, not a shared one).
  await s.ok('POST', `/api/projects/frost/cards/${c.id}/comments`, { author: 'Lead', text: 'one' });
  await s.ok('POST', `/api/projects/frost/cards/${c.id}/comments`, { author: 'Lead', text: 'two' });
  const cm = (await card()).comments.map(m => m.text);
  check('two writes in a row both land', cm.includes('one') && cm.includes('two'), cm);
  // The stall log: this server writes down every call that takes 1 ms or more (AIGILE_LAG_MS=1), so one shows up.
  const log = path.join(s.data, 'logs', '_lag.log');
  for (let i = 0; i < 3; i++) await s.ok('GET', '/api/projects/frost?full=1');
  const line = await until(async () => { try { return fs.readFileSync(log, 'utf8'); } catch { return ''; } }, 5000);
  check('slow calls are written to data/logs/_lag.log', /slow call \d+ ms: GET \/api\//.test(line || '') || /board stalled/.test(line || ''), line);
  // The proof route waits for git without holding the board: another call answers while it runs.
  const p = s.api('POST', `/api/projects/frost/cards/${c.id}/proof`, { commit: 'abcd1234' });
  const meta = await s.api('GET', '/api/meta');
  const pr = await p;
  check('the board answers while a proof is asked for (no folder: refused, not stuck)', meta.status === 200 && pr.status === 400, pr.status + ' ' + JSON.stringify(pr.body));
}, false, { AIGILE_LAG_MS: '1', AIGILE_LAG_GAP_MS: '1' });

def('freezepage', 'the page makes no synchronous request, a timed-out read says the board is busy, the desktop app closes a stuck window (AIG-1405)', async (s, ctx) => {
  const js = path.join(ROOT, 'public', 'js'), sync = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js') && /\.open\([^)]*,\s*false\s*\)/.test(fs.readFileSync(p, 'utf8'))) sync.push(f.name); } };
  walk(js);
  check('no page script opens a synchronous request', sync.length === 0, sync);
  const main = fs.readFileSync(path.join(ROOT, 'desktop', 'main.js'), 'utf8');
  check('the desktop app destroys a window whose page does not let it close', /w\.on\('close'[^\n]*w\.destroy\(\)/.test(main));
  const page = await openPage(ctx, '#/');
  await page.waitForFunction(() => typeof i18n !== 'undefined' && i18n.ready);
  const words = await page.evaluate(() => [liveError({ kind: 'slow', unreachable: true }), liveError({ kind: 'unreachable', unreachable: true }), t('live.slow'), t('live.cantreach')]);
  check('a read that timed out says the board is busy, not gone', words[0] === words[2] && words[1] === words[3] && words[0] !== words[1], words);
  check('the pretend check is asked in the background and done (no pretend board here)', (await page.evaluate(() => window.PretendReady && window.PretendReady.then(me => me === null))) === true);
  noErrors(page);
  await page.close();
}, true);
