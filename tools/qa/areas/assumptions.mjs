// QA area: assumptions (AIG-477): aigile assume, the cross-project list (older "Assumption:" comments too), OK / change / card answers.
import { check, tmp, mkProject, mkCard, getCard, def } from '../lib.mjs';

def('assumptions', 'aigile assume lists on /api/assumptions across projects, picks up plain "Assumption:" comments, answers stick (AIG-477)', async (s) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('as1') });
  await mkProject(s, 'Beta', 'BET', { path: tmp('as2') });
  const a = await mkCard(s, 'alpha', 'Pick a colour'), b = await mkCard(s, 'beta', 'Old guess');
  const r = s.cli(['assume', 'alpha', a.id, 'Blue is fine, nobody objected', '--as', 'Lead']);
  check('the CLI logs it', /logged an assumption/.test(r.out), r);
  await s.ok('POST', `/api/projects/beta/cards/${b.id}/comments`, { author: 'Lead', text: 'Assumption: the API stays v1' });
  await s.ok('POST', `/api/projects/beta/cards/${b.id}/comments`, { author: 'Lead', text: 'just a normal comment' });
  let l = await s.ok('GET', '/api/assumptions');
  check('both projects, only the assumptions', l.length === 2 && new Set(l.map(x => x.slug)).size === 2, l);
  const x = l.find(y => y.slug === 'alpha');
  await s.ok('POST', '/api/assumptions/resolve', { slug: 'alpha', id: a.id, at: x.at, state: 'ok' });
  l = await s.ok('GET', '/api/assumptions');
  check('OK is remembered', l.find(y => y.slug === 'alpha').state === 'ok', l);
  const bad = await s.api('POST', '/api/assumptions/resolve', { slug: 'alpha', id: a.id, at: 'nope', state: 'ok' });
  check('an unknown assumption is refused', bad.status === 404 || bad.status === 400, bad);
  // AIG-781: 📋 Summarise without tokens: only the ones still to review, one bullet per card.
  const sum = await s.ok('GET', '/api/assumptions/summary');
  check('the plain summary lists what is left', sum.n === 1 && !sum.ai && sum.text.includes(b.id) && sum.text.includes('the API stays v1') && !sum.text.includes(a.id), sum);
});
