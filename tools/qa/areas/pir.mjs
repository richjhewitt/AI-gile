// QA area: pir (AIG-1108, AIG-1109): post-incident review on a closed MAJOR incident, and a runbook proposed from it.
// Stub agent only. Done on a major incident orders the on-call agent and wakes it (card comment + a stub run); the review is posted with
// the CLI; the owner ticks actions and presses "Make a card"; a plain incident gets no review; with No Token Mode on, a plain
// "write it yourself" prompt and no wake.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('pir', '📝 post-incident review of a closed major incident: on-call agent ordered + woken, review with action ticks and Make a card, plain prompt with AI off (AIG-1108)', async (s, ctx) => {
  const folder = tmp('pir'), log = path.join(s.data, 'logs', 'pir.log');
  const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
  await mkProject(s, 'Pir', 'PIR', { path: folder });
  await s.ok('POST', '/api/projects/pir/team', { name: 'Lead', role: 'lead' });
  await s.ok('POST', '/api/projects/pir/team', { name: 'Pager', role: 'Backend' });
  await s.ok('PATCH', '/api/projects/pir', { service: { on: true, onCall: 'Pager' } });
  const pm = { happened: 'down', why: 'bug', change: 'fix' };
  const finish = id => s.ok('PATCH', `/api/projects/pir/cards/${id}`, { status: 'done', postmortem: pm });

  // a plain (not major) incident: no review
  const plain = await mkCard(s, 'pir', 'Slow page', { type: 'incident', status: 'doing', assignee: 'Lead' });
  await finish(plain.id);
  check('a plain incident gets no review', !(await getCard(s, 'pir', plain.id)).review);

  // a major incident
  const inc = await mkCard(s, 'pir', 'Site down', { type: 'incident', status: 'doing', assignee: 'Lead' });
  await s.ok('POST', `/api/projects/pir/cards/${inc.id}/major`, {});
  await until(() => starts() > 0, 6000);
  await sleep(500);
  const before = starts();
  check('a review needs a done incident', (await s.api('POST', `/api/projects/pir/cards/${inc.id}/review`, { timeline: 'x', helped: 'y', actions: 'z' })).status === 400);
  await finish(inc.id);
  let card = await getCard(s, 'pir', inc.id);
  check('the card has a review asked of the on-call agent', card.review && card.review.state === 'asked' && card.review.by === 'Pager', card.review);
  check('an order comment names the on-call agent and the command', card.comments.some(c => /REVIEW DUE/.test(c.text) && /Pager/.test(c.text) && /aigile pir pir /.test(c.text)), card.comments.map(c => c.text));
  check('the on-call agent was woken (stub run started)', !!(await until(() => starts() > before, 6000)), starts());
  check('major is over', !card.major);

  // the review
  check('a review needs the timeline, helped and actions', (await s.api('POST', `/api/projects/pir/cards/${inc.id}/review`, { timeline: 'x' })).status === 400);
  const r = s.cli(['pir', 'pir', inc.id, '--timeline', '10:00 down; 10:20 rolled back', '--helped', 'the status page', '--actions', 'Add an alert | Write a rollback note | Test the backup', '--as', 'Pager']);
  check('the CLI posts the review', r.code === 0 && /3 action/.test(r.out), r);
  card = await getCard(s, 'pir', inc.id);
  check('review posted with three actions, none ticked', card.review.state === 'posted' && card.review.actions.length === 3 && !card.review.actions.some(a => a.ok) && card.review.by === 'Pager', card.review);
  check('the review is also a card comment', card.comments.some(c => /Post-incident review/.test(c.text) && /Add an alert/.test(c.text)));
  check('a second review is refused', (await s.api('POST', `/api/projects/pir/cards/${inc.id}/review`, { timeline: 'x', helped: 'y', actions: 'z' })).status === 409);
  const team = (url, body) => fetch(s.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'cli', 'x-aigile-as': 'Dev' }, body: JSON.stringify(body) }).then(r => r.status);
  check('a team member cannot tick or make cards (403)', await team(`/api/projects/pir/cards/${inc.id}/review/tick`, { i: 0 }) === 403 && await team(`/api/projects/pir/cards/${inc.id}/review/card`, { i: 0 }) === 403);

  // ticks and Make a card, in the page
  const pg = await openPage(ctx, `#/p/pir/${inc.id}`);
  await pg.waitForSelector('.pir-action', { timeout: 8000 }).catch(async e => { throw e; });
  check('three action items with a tick and Make a card each', (await pg.$$('.pir-action input[type=checkbox]')).length === 3 && (await pg.$$('.pir-make')).length === 3);
  await pg.click('.pir-action:nth-child(1) input[type=checkbox]');
  check('ticking is saved', !!(await until(async () => (await getCard(s, 'pir', inc.id)).review.actions[0].ok === true, 4000)));
  const n0 = (await s.ok('GET', '/api/projects/pir')).cards.length;
  await pg.click('.pir-action:nth-child(2) .pir-make');
  check('Make a card links a new card to the action', !!(await until(async () => (await getCard(s, 'pir', inc.id)).review.actions[1].card, 4000)));
  const act = (await getCard(s, 'pir', inc.id)).review.actions[1];
  const mk = await getCard(s, 'pir', act.card);
  check('the new card is a backlog task pointing back at the incident', mk.status === 'backlog' && mk.type === 'task' && /Write a rollback note/.test(mk.description) && mk.description.includes(inc.id), mk);
  check('exactly one card was added', (await s.ok('GET', '/api/projects/pir')).cards.length === n0 + 1);
  await pg.waitForFunction(() => document.querySelectorAll('.pir-make').length === 2, null, { timeout: 5000 });
  const again = await s.ok('POST', `/api/projects/pir/cards/${inc.id}/review/card`, { i: 1 });
  check('pressing again makes no second card', again.existing && again.card === act.card && (await s.ok('GET', '/api/projects/pir')).cards.length === n0 + 1);
  noErrors(pg); await pg.close();

  // AI off: plain prompt, no wake
  const inc2 = await mkCard(s, 'pir', 'Mail down', { type: 'incident', status: 'doing', assignee: 'Lead' });
  await s.ok('POST', `/api/projects/pir/cards/${inc2.id}/major`, {});
  await sleep(500);
  await s.ok('POST', '/api/notokens', { on: true });
  const b2 = starts();
  await finish(inc2.id);
  const c2 = await getCard(s, 'pir', inc2.id);
  check('with AI off the card gets a plain "write it yourself" prompt', c2.review && c2.review.state === 'manual' && c2.comments.some(c => /write it yourself/.test(c.text) && !/REVIEW DUE/.test(c.text)), c2.comments.map(c => c.text));
  await sleep(800);
  check('nobody was woken', starts() === b2);
  await s.ok('POST', '/api/notokens', { on: false });
  const r2 = s.cli(['pir', 'pir', inc2.id, '--timeline', 'a', '--helped', 'b', '--actions', 'c', '--as', 'Owner']);
  check('the owner can still post it by hand', r2.code === 0 && (await getCard(s, 'pir', inc2.id)).review.state === 'posted', r2);
}, true);
