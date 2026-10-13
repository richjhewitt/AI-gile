// QA area: problems (AIG-887): a 🧩 problem card groups repeat incidents. API (GET/POST/PATCH/link), CLI (add, set, link), links both ways,
// the fix as a change request card, and the open card showing root cause, workaround and incidents.
import { check, mkProject, mkCard, getCard, def, openPage, noErrors } from '../lib.mjs';

def('problems', '🧩 problem card: API + CLI add/set/link, incidents linked both ways, change request link, open card shows cause/workaround/incidents (AIG-887)', async (s, ctx) => {
  await mkProject(s, 'Prob', 'PRB');
  const i1 = await mkCard(s, 'prob', 'Site down monday', { type: 'incident', status: 'todo' });
  const i2 = await mkCard(s, 'prob', 'Site down friday', { type: 'incident', status: 'todo' });
  const i3 = await mkCard(s, 'prob', 'Login slow', { type: 'incident', status: 'todo' });
  const i4 = await mkCard(s, 'prob', 'Cache full a', { type: 'incident', status: 'todo' });
  const i5 = await mkCard(s, 'prob', 'Cache full b', { type: 'incident', status: 'todo' });
  const bug = await mkCard(s, 'prob', 'A bug', { type: 'bug', status: 'todo' });
  const chg = await mkCard(s, 'prob', 'Change: new deploy script', { status: 'todo' });
  check('problem is a card type', (await mkCard(s, 'prob', 'x', { type: 'problem' })).type === 'problem');
  check('no problems yet is an empty list, and an unknown project is a 404', (await s.ok('GET', '/api/projects/prob/problems')).problems.length === 1 && (await s.api('GET', '/api/projects/nope/problems')).status === 404);

  check('a problem needs its title', (await s.api('POST', '/api/projects/prob/problems', { rootCause: 'x' })).status === 400);
  check('only incident cards can be linked', (await s.api('POST', '/api/projects/prob/problems', { title: 'P', incidents: [bug.id] })).status === 400);
  check('an unknown incident is a 404', (await s.api('POST', '/api/projects/prob/problems', { title: 'P', incidents: ['PRB-99'] })).status === 404);
  const pr = await s.ok('POST', '/api/projects/prob/problems', { title: 'Deploys break the site', incidents: [i1.id, i2.id], rootCause: 'no smoke test', workaround: 'roll back by hand' });
  check('add: a 🧩 problem card with cause, workaround and incidents', pr.id && pr.rootCause === 'no smoke test' && pr.workaround === 'roll back by hand' && pr.incidents.join() === [i1.id, i2.id].join(), pr);
  const card = await getCard(s, 'prob', pr.id);
  check('it is a problem-type card on the board', card.type === 'problem' && /Deploys break/.test(card.title), card);
  check('each incident points back at the problem', (await getCard(s, 'prob', i1.id)).problemId === pr.id && (await getCard(s, 'prob', i2.id)).problemId === pr.id);

  // link / patch
  const lk = await s.ok('POST', `/api/projects/prob/problems/${pr.id}/link`, { incident: i3.id });
  check('link adds a third incident, both ways', lk.incidents.length === 3 && (await getCard(s, 'prob', i3.id)).problemId === pr.id, lk);
  check('linking twice does not repeat it', (await s.ok('POST', `/api/projects/prob/problems/${pr.id}/link`, { incident: i3.id })).incidents.length === 3);
  check('link refuses a non-incident', (await s.api('POST', `/api/projects/prob/problems/${pr.id}/link`, { incident: bug.id })).status === 400);
  check('link on a card that is not a problem is refused', (await s.api('POST', `/api/projects/prob/problems/${bug.id}/link`, { incident: i1.id })).status === 400);
  const up = await s.ok('PATCH', `/api/projects/prob/problems/${pr.id}`, { rootCause: 'the deploy script skips tests', change: chg.id });
  check('PATCH sets the cause and the change request link', up.rootCause === 'the deploy script skips tests' && up.changeId === chg.id, up);
  check('PATCH a change card that does not exist is a 404', (await s.api('PATCH', `/api/projects/prob/problems/${pr.id}`, { change: 'PRB-99' })).status === 404);
  check('PATCH an unknown card is a 404', (await s.api('PATCH', '/api/projects/prob/problems/PRB-99', { rootCause: 'x' })).status === 404);
  const other = await s.ok('POST', '/api/projects/prob/problems', { title: 'Second problem' });
  await s.ok('POST', `/api/projects/prob/problems/${other.id}/link`, { incident: i3.id });
  check('an incident moved to another problem leaves the first', !(await s.ok('GET', '/api/projects/prob/problems')).problems.find(p => p.id === pr.id).incidents.includes(i3.id) && (await getCard(s, 'prob', i3.id)).problemId === other.id);

  // AIG-887: ids with digits in the key work, bad ids are refused with a clear error, a problem waits for its change request
  await mkProject(s, 'Ab Two', 'AB2');
  const di = await mkCard(s, 'ab-two', 'Down', { type: 'incident', status: 'todo' });
  const dp = await s.ok('POST', '/api/projects/ab-two/problems', { title: 'Digit key', incidents: [di.id] });
  check('a key with digits (AB2-5) links its incidents', di.id.startsWith('AB2-') && dp.incidents.join() === di.id, [di.id, dp]);
  const badId = await s.api('POST', '/api/projects/prob/problems', { title: 'P', incidents: [i1.id, 'not an id!'] });
  check('a bad incident id is refused with a clear error, not dropped', badId.status === 400 && /not a card id/.test(JSON.stringify(badId)), badId);
  check('a bad change id is refused too', (await s.api('PATCH', `/api/projects/prob/problems/${other.id}`, { change: 'x y' })).status === 400);
  const chg2 = await mkCard(s, 'prob', 'Change: second', { status: 'todo' });
  await s.ok('PATCH', `/api/projects/prob/problems/${other.id}`, { change: chg2.id });
  const early = await s.api('PATCH', `/api/projects/prob/cards/${other.id}`, { status: 'done' });
  check('a problem cannot be done while its change request is not', early.status === 400 && /change request/.test(JSON.stringify(early)) && (await getCard(s, 'prob', other.id)).status !== 'done', early);
  await s.ok('PATCH', `/api/projects/prob/cards/${chg2.id}`, { status: 'done' });
  check('once the change request is done the problem can be done', (await s.api('PATCH', `/api/projects/prob/cards/${other.id}`, { status: 'done' })).status === 200);

  // CLI
  const add = s.cli(['problem', 'prob', 'add', 'Cache keeps filling', '--incidents', `${i4.id},${i5.id}`, '--cause', 'no expiry', '--as', 'Lead']);
  check('CLI add with --incidents', add.code === 0 && /added PRB-\d+/.test(add.out) && /cause: no expiry/.test(add.out), add);
  const id = (add.out.match(/PRB-\d+/) || [])[0];
  const set = s.cli(['problem', 'prob', id, '--cause', 'no expiry set', '--workaround', 'restart nightly', '--change', chg.id]);
  check('CLI set cause, workaround and change', set.code === 0 && /workaround: restart nightly/.test(set.out) && new RegExp('fix ' + chg.id).test(set.out), set);
  const ln = s.cli(['problem', 'prob', id, 'link', i3.id]);
  check('CLI link', ln.code === 0 && ln.out.includes(i3.id), ln);
  check('CLI link with no id shows usage', s.cli(['problem', 'prob', id, 'link']).code !== 0);
  const ls = s.cli(['problem', 'prob']);
  check('CLI list shows the problems', ls.code === 0 && /Deploys break the site/.test(ls.out) && /Cache keeps filling/.test(ls.out), ls);
  check('CLI with nothing to set shows usage', s.cli(['problem', 'prob', id]).code !== 0);

  // Page
  const page = await openPage(ctx, `#/p/prob/${pr.id}`);
  await page.waitForSelector('.problem');
  const txt = await page.innerText('.problem');
  check('the open problem shows root cause, workaround, incidents and the change request', /deploy script skips tests/.test(txt) && /roll back by hand/.test(txt) && txt.includes(i1.id) && txt.includes(i2.id) && txt.includes(chg.id), txt);
  check('the incident ids are links', (await page.locator(`.problem a[href$="/${i1.id}"]`).count()) === 1);
  const ip = await openPage(ctx, `#/p/prob/${i1.id}`);
  await ip.waitForSelector('.problem');
  check('an incident card shows its problem', (await ip.innerText('.problem')).includes(pr.id));
  await noErrors(page); await noErrors(ip);
}, true);
