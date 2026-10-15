// QA area: xwaits (AIG-450): a card waits for a card of another project in the same space; refused outside the space; it pops
// when that card is done; the space board shows the chain.
import { check, def, mkProject, mkCard, getCard, openPage, noErrors } from '../lib.mjs';

def('xwaits', '🪐 waits for across projects in one space: allowed only inside the space, pops when done, chain on the space board (AIG-450)', async (s, ctx) => {
  await mkProject(s, 'Prog', 'PRG');
  await mkProject(s, 'Web', 'WEB', { parent: 'prog' });
  await mkProject(s, 'App', 'APP', { parent: 'prog' });
  await mkProject(s, 'Other', 'OTH');
  const w = await mkCard(s, 'web', 'Login API', { status: 'doing' });
  const a = await mkCard(s, 'app', 'Login screen', { status: 'todo' });
  const o = await mkCard(s, 'other', 'Unrelated');
  check('a card outside the space is refused', (await s.api('PATCH', `/api/projects/app/cards/${a.id}`, { waitsFor: [o.id] })).status === 400);
  await s.ok('PATCH', `/api/projects/app/cards/${a.id}`, { waitsFor: [w.id] });
  let c = await getCard(s, 'app', a.id);
  check('it waits for the sibling project card', JSON.stringify(c.waiting) === JSON.stringify([w.id]), c);
  let sp = await s.ok('GET', '/api/projects/prog');
  check('the space shows the chain with how far it is', sp.space.chain.length === 1 && sp.space.chain[0].id === a.id && sp.space.chain[0].waits[0].status === 'doing', sp.space.chain);
  const page = await openPage(ctx, '#/p/prog');
  await page.waitForSelector('.space-chain', { timeout: 8000 });
  const txt = await page.textContent('.space-chain');
  check('the space board lists it', txt.includes(a.id) && txt.includes(w.id), txt);
  noErrors(page); await page.close();
  await s.ok('PATCH', `/api/projects/web/cards/${w.id}`, { status: 'done' });
  c = await getCard(s, 'app', a.id);
  check('when the blocker is done the card pops (no longer waiting, bumped)', !(c.waiting || []).length && !c.waitHeld && c.bumps === 1, c);
  sp = await s.ok('GET', '/api/projects/prog');
  check('the chain shows it done', sp.space.chain[0].waits[0].status === 'done', sp.space.chain);
}, true);
