// QA area: pir (AIG-1108, AIG-1109): post-incident review on a closed MAJOR incident, and a runbook proposed from it.
// Stub agent only. Done on a major incident orders the on-call agent and wakes it (card comment + a stub run); the review is posted with
// the CLI; the owner ticks actions and presses "Make a card"; a plain incident gets no review; with No Token Mode on, a plain
// "write it yourself" prompt and no wake. Then the runbook (AIG-1109): a 🚦 Go card, Go writes docs/runbooks/<name>.md, Not yet writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('pir', '📝 post-incident review of a closed major incident: on-call agent ordered + woken, review with action ticks and Make a card, plain prompt with AI off; runbook proposed from the review, Go writes docs/runbooks/<name>.md (AIG-1108, AIG-1109)', async (s, ctx) => {
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
  check('the on-call agent was woken (stub run started)', !!(await until(() => starts() > before, 15000)), starts());
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

  // AIG-1109: the runbook proposal
  check('after the review the agent is asked for a runbook', card.comments.some(c => /propose a runbook/.test(c.text) && /aigile pir-runbook pir /.test(c.text)));
  check('no runbook before a review exists', (await s.api('POST', `/api/projects/pir/cards/${plain.id}/review/runbook`, { name: 'x', text: 'y' })).status === 400);
  const rbDir = path.join(folder, 'docs', 'runbooks');
  check('a runbook needs a name and text', (await s.api('POST', `/api/projects/pir/cards/${inc.id}/review/runbook`, { name: 'x' })).status === 400 && (await s.api('POST', `/api/projects/pir/cards/${inc.id}/review/runbook`, { text: 'y' })).status === 400);
  const pr = s.cli(['pir-runbook', 'pir', inc.id, 'Restart The Relay!', '--text', '1. ssh in\n2. restart the relay\n3. check /status', '--as', 'Pager']);
  check('the CLI proposes a runbook', pr.code === 0 && /waiting for/.test(pr.out), pr);
  const rbc = (await s.ok('GET', '/api/projects/pir')).cards.find(c => c.runbookProposal);
  check('a 🚦 plan card waiting for Go, with the name cleaned', rbc && rbc.runbookProposal.name === 'restart-the-relay' && rbc.kind === 'plan' && rbc.needsYou === true && /restart the relay/.test(rbc.description) && /\bgo\s*\?/i.test(rbc.comments.find(m => m.mark === 'ask').text), rbc);
  check('the incident points at it', (await getCard(s, 'pir', inc.id)).review.runbook === rbc.id);
  check('nothing is written before Go', !fs.existsSync(rbDir));
  check('a second proposal while one is open is refused', (await s.api('POST', `/api/projects/pir/cards/${inc.id}/review/runbook`, { name: 'other', text: 'z' })).status === 409);
  const tg = await fetch(s.base + `/api/projects/pir/cards/${rbc.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'cli', 'x-aigile-as': 'Dev' }, body: JSON.stringify({ author: 'Owner', text: 'GO' }) });
  check('a team request cannot say Go (403)', tg.status === 403 && !fs.existsSync(rbDir));
  await s.ok('POST', `/api/projects/pir/cards/${rbc.id}/comments`, { author: 'Owner', text: 'GO' });
  const rbf = path.join(rbDir, 'restart-the-relay.md');
  check('Go writes docs/runbooks/<name>.md in the project folder', fs.existsSync(rbf) && /1\. ssh in\n2\. restart the relay/.test(fs.readFileSync(rbf, 'utf8').replace(/\r\n/g, '\n')), fs.existsSync(rbf));
  const rbd = await getCard(s, 'pir', rbc.id);
  check('the card is done with a comment naming the file', rbd.status === 'done' && !rbd.needsYou && rbd.comments.at(-1).text.includes('docs/runbooks/restart-the-relay.md'), rbd.comments.at(-1));
  const snap = fs.readFileSync(rbf, 'utf8');
  await s.ok('POST', `/api/projects/pir/cards/${rbc.id}/comments`, { author: 'Owner', text: 'go' });
  check('answering again changes nothing', fs.readFileSync(rbf, 'utf8') === snap);
  // Not yet writes nothing; the same name again never overwrites
  const rb2 = await s.ok('POST', `/api/projects/pir/cards/${inc.id}/review/runbook`, { name: 'dns-down', text: 'check the registrar', author: 'Pager' });
  await s.ok('POST', `/api/projects/pir/cards/${rb2.id}/comments`, { author: 'Owner', text: 'Not yet: later' });
  check('Not yet closes the card and writes no file', (await getCard(s, 'pir', rb2.id)).status === 'done' && !fs.existsSync(path.join(rbDir, 'dns-down.md')));
  const rb3 = await s.ok('POST', `/api/projects/pir/cards/${inc.id}/review/runbook`, { name: 'restart-the-relay', text: 'a newer version', author: 'Pager' });
  await s.ok('POST', `/api/projects/pir/cards/${rb3.id}/comments`, { author: 'Owner', text: 'Yes' });
  check('an existing runbook is never overwritten: the new one gets -2', fs.readFileSync(rbf, 'utf8') === snap && fs.existsSync(path.join(rbDir, 'restart-the-relay-2.md')));
  const rb4 = await s.ok('POST', `/api/projects/pir/cards/${inc.id}/review/runbook`, { name: 'question', text: 'x', author: 'Pager' });
  await s.ok('POST', `/api/projects/pir/cards/${rb4.id}/comments`, { author: 'Owner', text: 'What does this cover?' });
  check('a question back is a normal comment: card stays open', (await getCard(s, 'pir', rb4.id)).status !== 'done' && !fs.existsSync(path.join(rbDir, 'question.md')));
  const pg2 = await openPage(ctx, `#/p/pir/${inc.id}`);
  await pg2.waitForSelector('.pirbox', { timeout: 8000 });
  check('the review box links the runbook card', (await pg2.innerText('.pirbox')).includes(rb4.id));
  noErrors(pg2); await pg2.close();

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
