// QA area: moveproject (AIG-438): a card moves to another project with a link back and a link forward.
import { check, tmp, mkProject, mkCard, getCard, def } from '../lib.mjs';

def('moveproject', 'move a card to another project: copy with comments and link back, original closed with link forward (AIG-438)', async (s) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('mp1') });
  await mkProject(s, 'Beta', 'BET', { path: tmp('mp2') });
  const a = await mkCard(s, 'alpha', 'Move me');
  await s.ok('POST', `/api/projects/alpha/cards/${a.id}/comments`, { author: 'Lead', text: 'first note' });
  const r = await s.ok('POST', `/api/projects/alpha/cards/${a.id}/moveproject`, { to: 'beta' });
  const copy = await getCard(s, 'beta', r.id), old = await getCard(s, 'alpha', a.id);
  check('the copy has a new Beta id and the title', r.id.startsWith('BET-') && copy.title === 'Move me', r);
  check('comments came across and a link back was added', copy.comments.length === 2 && /Moved here from Alpha ALP-/.test(copy.comments[1].text), copy.comments);
  check('the original is done with a link forward', old.status === 'done' && old.movedTo && old.movedTo.id === r.id && /Moved to Beta/.test(old.comments.slice(-1)[0].text), old);
  const same = await s.api('POST', `/api/projects/beta/cards/${r.id}/moveproject`, { to: 'beta' });
  check('same project is refused', same.status === 400, same);
  const doneMove = await s.api('POST', `/api/projects/alpha/cards/${a.id}/moveproject`, { to: 'beta' });
  check('a done card is refused', doneMove.status === 400, doneMove);

  // AIG-863/887: board-local links do not travel, and the old board's cards stop pointing at the moved one
  const inc = await mkCard(s, 'alpha', 'Down', { type: 'incident', status: 'todo' });
  const pb = await s.ok('POST', '/api/projects/alpha/problems', { title: 'Cause', incidents: [inc.id] });
  const mv = await s.ok('POST', `/api/projects/alpha/cards/${inc.id}/moveproject`, { to: 'beta' });
  const mcopy = await getCard(s, 'beta', mv.id);
  check('the moved copy has no board-local links', !mcopy.problemId && !mcopy.incidents && !mcopy.changeId && !mcopy.riskId, mcopy);
  check('the problem on the old board no longer lists the moved incident', !(await getCard(s, 'alpha', pb.id)).incidents.includes(inc.id));
  const mv2 = await s.ok('POST', `/api/projects/alpha/cards/${pb.id}/moveproject`, { to: 'beta' });
  check('a moved problem leaves its incidents list behind', !(await getCard(s, 'beta', mv2.id)).incidents);
});
