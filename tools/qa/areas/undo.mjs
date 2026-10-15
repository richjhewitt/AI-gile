// QA area: undo (AIG-403): ↩ Undo after a click that moves a card (bar + Ctrl+Z), no wake if undone in time, ↩ Reopen, ⋯ Move to.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('undo', '↩ Undo: Accept / Send back / Done put back exactly, auto-comment gone, no wake when undone in time; bar + Ctrl+Z; ↩ Reopen; ⋯ Move to (AIG-403)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('un') });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  const log = path.join(s.data, 'logs', 'alpha.log');
  const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  const idle = async () => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/alpha')).presence.running; i++) await sleep(250); };
  const post = (id, what, body = {}) => s.ok('POST', `/api/projects/alpha/cards/${id}/${what}`, body);
  const get = id => getCard(s, 'alpha', id);
  const test = async title => { const c = await mkCard(s, 'alpha', title); await s.ok('PATCH', `/api/projects/alpha/cards/${c.id}`, { status: 'verify', testSteps: '1. Click **Go**\n2. It works' }); return c; };   // via the API: CLI calls would count as the team being at work

  // Server: accept, then undo.
  const a = await test('Accept me');
  const b4 = await get(a.id);
  const r = await post(a.id, 'verdict', { accept: true });
  check('accept answers with an undo note and the card is done', r.undo && r.undo.id === a.id && (await get(a.id)).status === 'done' && (await get(a.id)).comments.some(m => m.verdict === 'accept'));
  const u = await post(a.id, 'undo');
  const af = await get(a.id);
  check('undo puts the column and flags back and removes the ✅ Accepted comment', af.status === b4.status && af.needsYou === b4.needsYou && af.comments.length === b4.comments.length && !af.comments.some(m => m.verdict) && u.status === b4.status, { was: b4.status, now: af.status });
  const again = await fetch(BASE + `/api/projects/alpha/cards/${a.id}/undo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('a second undo of the same move is refused (409)', again.status === 409);

  // Send back: the wake is held for the undo window, so an undo costs no run.
  const c = await test('Send me back');
  await idle();
  const n0 = starts();
  await post(c.id, 'verdict', { accept: false, text: 'not quite' });
  check('send back moves the card to the team', (await get(c.id)).status === 'team');
  await post(c.id, 'undo');
  const cf = await get(c.id);
  check('undo of a send back restores verify and removes the 🔁 comment', cf.status === 'verify' && !cf.comments.some(m => /Sent back/.test(m.text)), cf.status);
  await sleep(4000);
  check('no team run started after an undone send back', starts() === n0, [n0, starts()]);
  const d = await test('Really send back');
  await idle();
  const n1 = starts();
  await post(d.id, 'verdict', { accept: false, text: 'still wrong' });
  await sleep(800);
  check('a send back that is not undone does not wake at once (held for the window)', starts() === n1);
  for (let i = 0; i < 40 && starts() === n1; i++) await sleep(250);
  check('...then the team is woken once the window has passed', starts() === n1 + 1, [n1, starts()]);
  await idle();

  // Task done by the owner, and a life task.
  const k = await mkCard(s, 'alpha', 'Owner task', { assignee: 'Owner' });
  await post(k.id, 'taskdone', {});
  await post(k.id, 'undo');
  const kf = await get(k.id);
  check('undo of ✅ Done on a task gives it back to the owner and removes the Done comment', kf.assignee === 'Owner' && !kf.comments.some(m => /^✅ Done/.test(m.text)), { a: kf.assignee, s: kf.status });
  const life = await mkCard(s, 'alpha', 'Hoover', { lifeType: 'housework', assignee: 'Owner' });
  await post(life.id, 'lifedone');
  check('a life task ticked is done', (await get(life.id)).status === 'done');
  await post(life.id, 'undo');
  check('undo of a life ✅ reopens it', (await get(life.id)).status !== 'done');

  // Page: the bar, the Undo button and Ctrl+Z.
  const e = await test('Page accept'), f = await test('Key accept');
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('.ib-item');
  const item = id => page.locator(`.ib-item[data-id="${id}"]`);
  await item(e.id).locator('[data-act="accept"]').click();
  await page.waitForSelector('#undoBar:not([hidden])');
  const msg = (await page.textContent('#undoBar')).replace(/\s+/g, ' ').trim();
  check('the bar reads "Moved ID to Done · ↩ Undo"', msg.includes('Moved ' + e.id + ' to ') && /Done/.test(msg) && msg.includes('↩ Undo'), msg);
  await page.click('#undoBtn');
  for (let i = 0; i < 20 && (await get(e.id)).status === 'done'; i++) await sleep(150);
  check('clicking ↩ Undo puts the card back to verify', (await get(e.id)).status === 'verify');
  await page.waitForSelector(`.ib-item[data-id="${e.id}"]`);
  await item(f.id).locator('[data-act="accept"]').click();
  await page.waitForSelector('#undoBar:not([hidden])');
  await sleep(300);
  await page.keyboard.press('Control+z');
  for (let i = 0; i < 20 && (await get(f.id)).status === 'done'; i++) await sleep(150);
  check('Ctrl+Z undoes the last move', (await get(f.id)).status === 'verify');
  await page.waitForFunction(() => document.getElementById('undoBar').hidden, null, { timeout: 8000 });
  check('the bar goes away by itself', true);
  noErrors(page);

  // ↩ Reopen and ⋯ Move to on the card.
  const g = await mkCard(s, 'alpha', 'Reopen me', { status: 'doing' });
  await s.ok('PATCH', `/api/projects/alpha/cards/${g.id}`, { status: 'done' });
  const cp = await openPage(ctx, `#/p/alpha/${g.id}`);
  await cp.waitForSelector('[data-reopen]');
  await cp.click('[data-reopen]');
  for (let i = 0; i < 20 && (await get(g.id)).status === 'done'; i++) await sleep(150);
  check('↩ Reopen puts a done card back in the column it came from (doing)', (await get(g.id)).status === 'doing', (await get(g.id)).status);
  await cp.waitForSelector('[data-moveto]');
  await cp.waitForSelector('[data-reopen]', { state: 'detached' }).catch(() => {}); check('a card that is not done has no Reopen button', (await cp.$('[data-reopen]')) === null);
  await cp.selectOption('[data-moveto]', 'review');
  for (let i = 0; i < 20 && (await get(g.id)).status !== 'review'; i++) await sleep(150);
  check('⋯ Move to moves the card to the chosen column', (await get(g.id)).status === 'review');
  noErrors(cp);
}, true, { AIGILE_UNDO_WAKE_MS: '2500' });
