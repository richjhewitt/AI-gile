// QA area: donefolds (AIG-1025): in a project's chat in Messages, folds of done/accepted cards sit under a collapsed "Done (N)" toggle;
// a card still waiting on you stays in the list.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('donefolds', 'Messages: a project chat lists only unread / in-progress card folds; done ones are under a collapsed Done (N) toggle (AIG-1025)', async (s, ctx) => {
  await mkProject(s, 'Fold Test', 'FT'); await s.ok('POST', '/api/projects/fold-test/team', { name: 'Lead', role: 'Lead' });
  const a = await mkCard(s, 'fold-test', 'Finished thing', { status: 'team' });
  await say(s, 'fold-test', a.id, 'Lead', 'Shall I build it?', { needsYou: true, mark: 'ask' }); await say(s, 'fold-test', a.id, 'Owner', 'Yes, go.');
  await s.ok('PATCH', `/api/projects/fold-test/cards/${a.id}`, { status: 'done' });
  const b = await mkCard(s, 'fold-test', 'Open question', { status: 'team' });
  await say(s, 'fold-test', b.id, 'Lead', 'Which colour?', { needsYou: true, mark: 'ask' });
  // AIG-1116: only current folds show: an agent-to-agent card never; an answered GO plan and an old idea with nothing new go under Done; an unread (the lead's note, never answered) one stays.
  const plan = await mkCard(s, 'fold-test', 'Plan to answer', { status: 'team' });
  await say(s, 'fold-test', plan.id, 'Lead', 'Plan: A then B. GO?', { needsYou: true, mark: 'ask' }); await say(s, 'fold-test', plan.id, 'Owner', 'GO');
  const idea = await mkCard(s, 'fold-test', '💬 Old idea', { status: 'team', quick: true, createdBy: 'Owner', description: 'what if' });
  await say(s, 'fold-test', idea.id, 'Lead', 'Noted.');
  const note = await mkCard(s, 'fold-test', '💬 Lead note', { status: 'team', quick: true, createdBy: 'Lead', description: 'FYI from the lead' });
  const fresh = await mkCard(s, 'fold-test', '💬 Fresh idea', { status: 'team', quick: true, createdBy: 'Owner', description: 'new thought' });
  await say(s, 'fold-test', fresh.id, 'Lead', 'On it.');
  const am = await s.ok('POST', '/api/projects/fold-test/agentmsg', { from: 'Builder', to: 'Lead', text: 'psst, agent to agent' });
  const amId = am.id || am.card || (await s.ok('GET', '/api/projects/fold-test?full=1')).cards.find(c => c.agentMsg).id;
  const file = path.join(s.data, 'fold-test.json'), pj = JSON.parse(fs.readFileSync(file, 'utf8')), old = new Date(Date.now() - 30 * 3600e3).toISOString();
  for (const c of pj.cards) if ([plan.id, idea.id, note.id, amId].includes(c.id)) { c.created = c.updated = old; for (const m of c.comments || []) m.at = old; }
  fs.writeFileSync(file, JSON.stringify(pj));
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]'); await page.click('#dmRail [data-dms]');
  await page.click('#dmPanel [data-dm="fold-test"]');
  await page.waitForSelector('#dmList .dm-fold');
  const folds = async () => await page.locator('#dmList .dm-fold-h').evaluateAll(a => a.map(x => x.dataset.fold));
  check('the open question is listed, the done card is not', (await folds()).includes(b.id) && !(await folds()).includes(a.id), await folds());
  const tog = page.locator('[data-dmshowdone]');
  check('a Done (3) toggle is there', /Done \(3\)/.test(await tog.textContent()), await tog.textContent());
  check('an agent-to-agent card is never listed', !(await folds()).includes(amId), await folds());
  check('an unread note and a recent idea stay', (await folds()).includes(note.id) && (await folds()).includes(fresh.id), await folds());
  check('an answered GO plan and an old idea are not listed', !(await folds()).includes(plan.id) && !(await folds()).includes(idea.id), await folds());
  await tog.click();
  check('the toggle lists the done card, the GO plan and the old idea, still not the agent card', (await folds()).includes(a.id) && (await folds()).includes(plan.id) && (await folds()).includes(idea.id) && !(await folds()).includes(amId) && /Hide done/.test(await tog.textContent()), await folds());
  await tog.click();
  check('and hides it again', !(await folds()).includes(a.id));
  noErrors(page);
}, true);
