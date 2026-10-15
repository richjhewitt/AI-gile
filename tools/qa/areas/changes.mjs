// QA area: changes (AIG-857): a 🔀 change card. API (GET/POST/PATCH), CLI (list, add, set), risk link, the slot, problems that point at it,
// the open card showing its fields, and the Raise a change form (also from an incident).
import { check, mkProject, mkCard, getCard, def, openPage, noErrors } from '../lib.mjs';

def('changes', '🔀 change card: API + CLI add/set, fields on the card, risk from the register, slot, problems link, Raise a change form (AIG-857)', async (s, ctx) => {
  await mkProject(s, 'Chg', 'CHG');
  const inc = await mkCard(s, 'chg', 'Site down', { type: 'incident', status: 'todo' });
  const task = await mkCard(s, 'chg', 'A task', { type: 'task', status: 'todo' });
  const rk = await s.ok('POST', '/api/projects/chg/risks', { risk: 'Deploy may break login', impact: 3 });
  check('change is a card type', (await mkCard(s, 'chg', 'x', { type: 'change' })).type === 'change');
  check('no changes yet is a list, unknown project is a 404', Array.isArray((await s.ok('GET', '/api/projects/chg/changes')).changes) && (await s.api('GET', '/api/projects/nope/changes')).status === 404);

  check('a change needs its title', (await s.api('POST', '/api/projects/chg/changes', { what: 'x' })).status === 400);
  check('a bad kind is refused', (await s.api('POST', '/api/projects/chg/changes', { title: 'T', kind: 'wish' })).status === 400);
  check('an unknown risk is a 404', (await s.api('POST', '/api/projects/chg/changes', { title: 'T', riskId: 'R-99' })).status === 404);
  check('a half slot is refused', (await s.api('POST', '/api/projects/chg/changes', { title: 'T', when: { from: '2026-11-03T20:00' } })).status === 400);
  check('a slot ending before it starts is refused', (await s.api('POST', '/api/projects/chg/changes', { title: 'T', when: { from: '2026-11-03T22:00', to: '2026-11-03T20:00' } })).status === 400);
  check('from must be an incident or a problem', (await s.api('POST', '/api/projects/chg/changes', { title: 'T', from: task.id })).status === 400);
  check('nothing was made by the refused ones', (await s.ok('GET', '/api/projects/chg/changes')).changes.length === 1);

  const ch = await s.ok('POST', '/api/projects/chg/changes', { title: 'New deploy script', kind: 'fix', what: 'swap the script', why: 'it skips tests', undo: 'put the old one back', riskId: rk.id,
    when: { from: '2026-11-03T20:00:00Z', to: '2026-11-03T22:00:00Z' }, from: inc.id });
  check('add: a change with all its fields', ch.id && ch.kind === 'fix' && ch.what === 'swap the script' && ch.why === 'it skips tests' && ch.undo === 'put the old one back' && ch.riskId === rk.id && ch.from === inc.id && ch.when.from.startsWith('2026-11-03T20:00'), ch);
  const card = await getCard(s, 'chg', ch.id);
  check('it is a change-type card on the board with c.change', card.type === 'change' && /New deploy script/.test(card.title) && card.change.kind === 'fix' && card.change.riskId === rk.id, card);
  const up = await s.ok('PATCH', `/api/projects/chg/changes/${ch.id}`, { undo: 'restore the backup', riskId: '', kind: 'other' });
  check('PATCH changes the undo, clears the risk, keeps the rest', up.undo === 'restore the backup' && up.kind === 'other' && !up.riskId && up.what === 'swap the script', up);
  check('PATCH a card that is not a change is refused', (await s.api('PATCH', `/api/projects/chg/changes/${task.id}`, { what: 'x' })).status === 400);
  check('PATCH an unknown card is a 404', (await s.api('PATCH', '/api/projects/chg/changes/CHG-99', { what: 'x' })).status === 404);
  const long = await s.ok('PATCH', `/api/projects/chg/changes/${ch.id}`, { what: 'x'.repeat(2000) });
  check('text is cut at 600 characters', long.what.length === 600);
  await s.ok('PATCH', `/api/projects/chg/changes/${ch.id}`, { what: 'swap the script' });

  // problems point at a change card
  const pr = await s.ok('POST', '/api/projects/chg/problems', { title: 'Deploys break the site', incidents: [inc.id] });
  check('a problem cannot take a plain card as its change request', (await s.api('PATCH', `/api/projects/chg/problems/${pr.id}`, { change: task.id })).status === 400);
  const link = await s.ok('PATCH', `/api/projects/chg/problems/${pr.id}`, { change: ch.id });
  check('a problem takes a change card', link.changeId === ch.id, link);
  check('the change lists the problems that point at it', (await s.ok('GET', '/api/projects/chg/changes')).changes.find(c => c.id === ch.id).problems.join() === pr.id);

  // CLI
  const add = s.cli(['change', 'chg', 'add', 'Move the database', '--kind', 'change', '--what', 'new host', '--why', 'old one is full', '--undo', 'point back', '--risk', rk.id, '--when', '2026-12-01T20:00..2026-12-01T21:00', '--as', 'Lead']);
  check('CLI add with fields', add.code === 0 && /added CHG-\d+/.test(add.out) && /undo: point back/.test(add.out) && add.out.includes('risk ' + rk.id) && /when: /.test(add.out), add);
  const id = (add.out.match(/CHG-\d+/) || [])[0];
  const set = s.cli(['change', 'chg', id, '--kind', 'feature', '--risk', 'none', '--why', 'it is full']);
  check('CLI set kind, clear the risk', set.code === 0 && /\(feature\)/.test(set.out) && /no risk logged/.test(set.out) && /why: it is full/.test(set.out), set);
  check('CLI with nothing to set shows usage', s.cli(['change', 'chg', id]).code !== 0);
  check('CLI bad kind fails', s.cli(['change', 'chg', id, '--kind', 'wish']).code !== 0);
  const ls = s.cli(['change', 'chg']);
  check('CLI list shows the changes', ls.code === 0 && /New deploy script/.test(ls.out) && /Move the database/.test(ls.out), ls);

  // old data: a change-type card with no c.change still reads and lists
  const bare = await mkCard(s, 'chg', 'Bare change', { type: 'change' });
  check('a change card without fields still lists', (await s.ok('GET', '/api/projects/chg/changes')).changes.some(c => c.id === bare.id));

  // Page
  const page = await openPage(ctx, `#/p/chg/${ch.id}`);
  await page.waitForSelector('.change');
  const txt = await page.innerText('.change');
  check('the open change card shows what, why, undo, no-risk and the problem', /swap the script/.test(txt) && /restore the backup/.test(txt) && /No risk logged/i.test(txt) && txt.includes(pr.id) && txt.includes(inc.id), txt);
  const ip = await openPage(ctx, `#/p/chg/${inc.id}`);
  await ip.waitForSelector('.chg-raise button');
  await ip.click('.chg-raise button');
  await ip.waitForSelector('#chg-form');
  check('Raise a change from an incident fills the title', (await ip.inputValue('#chg-title')).includes('Site down'));
  check('the risk picker lists the register', (await ip.locator('#chg-risk option').count()) === 2);
  await ip.fill('#chg-what', 'patch it'); await ip.fill('#chg-undo', 'revert'); await ip.selectOption('#chg-risk', rk.id); await ip.selectOption('#chg-kind', 'fix');
  await ip.click('#chg-form button.primary');
  await ip.waitForSelector('.change');
  const made = (await s.ok('GET', '/api/projects/chg/changes')).changes.find(c => c.what === 'patch it');
  check('the form made a change card from the incident', made && made.from === inc.id && made.kind === 'fix' && made.riskId === rk.id && made.undo === 'revert', made);
  const bp = await openPage(ctx, '#/p/chg');
  await bp.waitForSelector('.toolbar');
  check('the board has a Raise a change button', (await bp.locator('.toolbar button', { hasText: 'Raise a change' }).count()) === 1);
  await noErrors(page); await noErrors(ip); await noErrors(bp);
}, true);
