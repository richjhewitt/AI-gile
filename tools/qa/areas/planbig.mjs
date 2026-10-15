// QA area: planbig (AIG-480): with the 🧩 switch on, a night with nothing to refill puts the biggest ready backlog card up
// for planning (To do + a note); off by default; one card a night per project.
import { check, sleep, until, tmp, def, mkProject, mkCard, getCard } from '../lib.mjs';

def('planbig', '🧩 nights plan one big backlog card when nothing is ready to refill: off by default, one a night (AIG-480)', async s => {
  await mkProject(s, 'Big', 'BIG', { path: tmp('big') });
  const small = await mkCard(s, 'big', 'Tiny thing', { status: 'backlog', description: 'one line', testSteps: '- look' });
  const big = await mkCard(s, 'big', 'Whole new area', { status: 'backlog', description: 'A big piece of work. '.repeat(30) });
  const round = async () => { await s.ok('POST', '/api/quiet', { on: true, watch: ['big'] }); await sleep(4500); await s.ok('POST', '/api/watchman/round'); await sleep(1500); };
  check('the switch is off by default', (await s.ok('GET', '/api/setup')).prefs.planBig === false);
  await round();
  check('off: nothing is put up', (await getCard(s, 'big', big.id)).status === 'backlog' && (await getCard(s, 'big', small.id)).status === 'backlog');
  await s.ok('POST', '/api/quiet', { on: false });
  await s.ok('POST', '/api/setup', { prefs: { planBig: true } });
  await round();
  const up = await until(async () => (await getCard(s, 'big', big.id)).status === 'todo', 8000);
  const c = await getCard(s, 'big', big.id);
  check('on: the biggest card goes to To do with a note to plan it', up && c.comments.some(m => m.mark === 'assume' && /small cards/.test(m.text)), c);
  check('only one card', (await getCard(s, 'big', small.id)).status === 'backlog');
  await s.ok('PATCH', `/api/projects/big/cards/${big.id}`, { status: 'backlog' });
  await s.ok('POST', '/api/quiet', { on: false });
  await round();
  check('one a night: nothing more tonight', (await getCard(s, 'big', small.id)).status === 'backlog' && (await getCard(s, 'big', big.id)).status === 'backlog');
  await s.ok('POST', '/api/quiet', { on: false });
});
