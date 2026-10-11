// QA areas: popout, owner, setup (split from look-setup.mjs, AIG-297).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('popout', '⧉ Pop out opens a card on its own in a new window (AIG-122)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Follow these steps', { status: 'verify', testSteps: '1. Do the thing\n2. See the result' });
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.waitForSelector('button:has-text("Pop out")');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('button:has-text("Pop out")')]);
  await pop.waitForSelector('.panel h2');
  check('pop-out shows the card', (await pop.textContent('.panel h2')) === 'Follow these steps' && /\/pop\/alpha\//.test(pop.url()), pop.url());
  check('no header or board behind it', !(await pop.isVisible('header')) && (await pop.locator('.board').count()) === 0);
  check('pop-out has no Pop out button of its own', (await pop.locator('button:has-text("Pop out")').count()) === 0);
  check('main window goes back to the board', await page.waitForFunction(() => location.hash === '#/p/alpha').then(() => true).catch(() => false));
  await pop.click('.verdict button:has-text("Accept")');
  await sleep(500);
  check('accepting in the pop-out works', (await getCard(s, 'alpha', c.id)).status === 'done');
  noErrors(page);
}, true);

def('popchat', '⧉ a pop-out stays open after Send and new team messages land at the bottom, like a chat (AIG-313)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const c = await mkCard(s, 'alpha', 'Server steps', { status: 'doing', assignee: 'Forge' });
  s.cli(['comment', 'alpha', c.id, 'Step 1: run the setup', '--as', 'Forge']);
  const main = await openPage(ctx, '#/p/alpha');
  const popP = ctx.waitForEvent('page');
  await main.evaluate(id => window.open('#/pop/alpha/' + id, 'aigile-alpha-' + id, 'width=560,height=780'), c.id);
  const pop = await popP;
  await pop.waitForSelector('#r-text');
  await s.ok('GET', '/api/projects/alpha/updates');   // the team is heard from: online
  await pop.waitForSelector('#typing', { timeout: 5000 });
  check('typing line while the team works on the card', /typing|typen/.test(await pop.textContent('#typing')));
  let closed = false; pop.on('close', () => { closed = true; });
  await pop.fill('#r-text', 'Done step 1');
  await pop.click('.reply .actions .primary');
  await pop.waitForFunction(() => document.querySelector('.chat').textContent.includes('Done step 1'), null, { timeout: 5000 });
  await sleep(500);
  check('the pop-out stays open after Send', !closed && !pop.isClosed());
  check('the reply box is empty again', (await pop.inputValue('#r-text')) === '');
  await pop.fill('#r-text', 'half a draft');
  s.cli(['comment', 'alpha', c.id, 'Step 2: restart it', '--as', 'Forge']);
  await pop.waitForFunction(() => document.querySelector('.chat').textContent.includes('Step 2: restart it'), null, { timeout: 5000 });
  const order = await pop.$$eval('.chat .comment .body', els => els.map(e => e.textContent.trim()));
  check('messages run oldest to newest, the new one at the bottom', order.at(-1) === 'Step 2: restart it' && order[0] === 'Step 1: run the setup', order);
  check('a draft survives a new message', (await pop.inputValue('#r-text')) === 'half a draft');
  check('the newest message is in view', await pop.evaluate(() => { const r = [...document.querySelectorAll('.chat .comment')].at(-1).getBoundingClientRect(); return r.bottom <= window.innerHeight + 1; }));
  noErrors(main);
}, true);

def('owner', 'the board works for any owner name, not just the default name (AIG-103)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  check('meta tells the page the owner', (await s.ok('GET', '/api/meta')).owner === 'Sam');
  const c = await mkCard(s, 'alpha', 'Question');
  s.cli(['ask', 'alpha', c.id, 'Go?', '--as', 'Lead']);
  const inbox = s.cli(['inbox']);
  check('CLI speaks of the owner', /asked Sam|Sam/.test(s.cli(['help']).out) && !/\bRich\b/.test(s.cli(['help']).out));
  const page = await openPage(ctx, '#/p/alpha/' + c.id);
  await page.click('[data-ctab="reply"]');
  check('reply box says Sam', /Reply as Sam/.test(await page.getAttribute('#r-text', 'placeholder')));
  await page.click('.reply button:has-text("Go")');
  await sleep(500);
  const card = await getCard(s, 'alpha', c.id);
  check('owner reply is from Sam and counts as the owner', card.comments.at(-1).author === 'Sam' && card.status === 'team' && !card.needsYou, card);
  const up = s.cli(['updates', 'alpha']);
  check('team sees Sam in updates', /new from Sam/.test(up.out) && /Sam \(/.test(up.out), up.out);
  s.cli(['task', 'alpha', c.id, 'log in', '--as', 'Lead']);
  check('tasks go to Sam', (await getCard(s, 'alpha', c.id)).assignee === 'Sam' && (await s.ok('GET', '/api/inbox')).some(x => x.id === c.id));
  noErrors(page);
}, true, { AIGILE_OWNER: 'Sam' });

def('setup', 'a new install opens Setup; saving writes the local settings file (AIG-91)', async (s, ctx) => {
  const file = process.env.QA_SETUP_FILE;
  check('new install needs setup', (await s.ok('GET', '/api/meta')).setupNeeded === true);
  const page = await openPage(ctx, '#/');
  await page.waitForFunction(() => location.hash === '#/setup', null, { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('#setupForm');
  check('board opens Setup first', page.url().endsWith('#/setup'));
  await page.click('#wzNo'); await page.waitForSelector('#wzNo', { state: 'detached' });   // AIG-354: the wizard offer, waved off
  check('name is required', (await s.api('POST', '/api/setup', { owner: '' })).status === 400);
  await page.fill('input[data-key="owner"]', 'Sam');
  // AIG-334: a guessed agent program is only a suggestion; typing just a name must not save it.
  check('the agent program box starts empty', (await page.inputValue('input[data-key="agent.command"]')) === '');
  await page.click('#setupForm button[type=submit]');
  await page.waitForSelector('#setup-done:has-text("Saved")');
  const first = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('saving only a name saves no guessed agent program or file names', first.owner === 'Sam' && !Object.keys(first.agent || {}).length, first);

  await page.evaluate(() => closeDialog());
  const useSel = '#setupForm label:has(input[data-key="agent.notesFile"]) .usesuggest';
  if (await page.$(useSel)) {
    const sug = await page.getAttribute('input[data-key="agent.notesFile"]', 'data-suggest');
    await page.evaluate(sel => document.querySelector(sel).click(), useSel);
    check('"Use this" puts the suggestion in the box', (await page.inputValue('input[data-key="agent.notesFile"]')) === sug);
  }
  await page.fill('input[data-key="agent.command"]', 'C:/tools/agent.exe');
  await page.fill('input[data-key="agent.notesFile"]', 'NOTES.local.md');
  await page.fill('input[data-key="agent.settingsFile"]', '.agent/settings.local.json');
  await page.click('#setupForm button[type=submit]');
  await page.waitForSelector('#setup-done:has-text("ready")');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('saved to the local settings file', saved.owner === 'Sam' && saved.agent.command === 'C:/tools/agent.exe' && saved.agent.settingsFile === '.agent/settings.local.json', saved);
  const m = await s.ok('GET', '/api/meta');
  check('setup done and the name is used at once', m.setupNeeded === false && m.owner === 'Sam', m);
  // AIG-335: a repaint of the board part while Setup is open and no project is loaded must not throw (it read p.presence of null).
  check('repainting the board on Setup with no project does not throw', await page.evaluate(() => { try { state.route = { view: 'setup' }; state.project = null; renderBoardOnly(); return true; } catch (e) { return false; } }));
  noErrors(page);
}, true, { AIGILE_OWNER: '', AIGILE_LOCAL: (process.env.QA_SETUP_FILE = path.join(tmp('setup'), 'aigile.local.json')) });
