// QA area: bugreports (AIG-561): on the 🧪 Live channel, Raise bug offers "Also send it to the AI-gile team"; the report goes to the
// relay; the owner's board (feedback project set) files it as a bug card in To do and acks it, so it is filed once.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { startRelay, check, tmp, def, mkProject, openPage, noErrors, until } from '../lib.mjs';

def('bugreports', '🐞 Live testers\' bug reports: tick in Raise bug on Live, POST /bug at the relay, filed once as a card on the owner\'s board (AIG-561)', async (s, ctx) => {
  const key = (await s.ok('GET', '/api/licences')).key;
  const relay = await startRelay({ RELAY_STATS_KEY: key });
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    await mkProject(s, 'Tester', 'TST');
    await mkProject(s, 'Inbox', 'INB');
    check('the list is not readable without the operator key', (await fetch(relay.base + '/bug')).status === 401);
    const page = await openPage(ctx, '#/p/tester');
    await page.click('#bugBtn');
    await page.waitForSelector('#nc-send', { timeout: 8000 });
    check('on Live the tick is there and on', await page.isChecked('#nc-send'));
    await page.fill('#f-title', 'Save button does nothing');
    await page.fill('#f-description', 'Clicked Save on Setup, nothing happened.');
    await page.click('#dialog button[type=submit]');
    await until(async () => fs.existsSync(path.join(relay.data, 'bugs')) && fs.readdirSync(path.join(relay.data, 'bugs')).length > 0, 8000);
    check('the report reached the relay', fs.existsSync(path.join(relay.data, 'bugs')) && fs.readdirSync(path.join(relay.data, 'bugs')).length === 1);
    noErrors(page); await page.close();
    let r = await s.ok('POST', '/api/bugreports/collect');
    const card = (await s.ok('GET', '/api/projects/inbox')).cards.find(c => c.from === 'bug report');
    check('the owner\'s board files it once as a bug card in To do', r.filed === 1 && card && card.type === 'bug' && card.status === 'todo' && /Save button does nothing/.test(card.title) && /Live tester/.test(card.description), { r, card });
    r = await s.ok('POST', '/api/bugreports/collect');
    check('acked: not filed twice, gone from the relay', r.filed === 0 && fs.readdirSync(path.join(relay.data, 'bugs')).length === 0, r);
  } finally { relay.stop(); }
}, true, (() => {
  // A plain clone on main = the 🧪 Live channel.
  const g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  const dir = tmp('bugs'), origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'install');
  g(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  g(dir, 'clone', '-q', origin, repo);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'v1'); g(repo, 'add', '.'); g(repo, '-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', 'v1'); g(repo, 'push', '-q', '-u', 'origin', 'HEAD:main');
  return { AIGILE_REPO: repo, AIGILE_NO_RESTART: '1', AIGILE_NO_BUG_FETCH: '1', AIGILE_FEEDBACK_PROJECT: 'inbox' };
})());
