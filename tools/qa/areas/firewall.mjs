// QA area: firewall (AIG-839): duplicates, "Original:" copies and empty pokes from the team are kept in data/firewall.conf, not the card.
import { check, tmp, mkProject, mkCard, getCard, say, def } from '../lib.mjs';

def('firewall', 'message firewall: same text twice, Original: copies, empty pokes are kept out and listed in GET /api/firewall; owner and real replies pass (AIG-839)', async s => {
  await mkProject(s, 'Wall', 'WAL', { path: tmp('fw') });
  const a = await mkCard(s, 'wall', 'First'), b = await mkCard(s, 'wall', 'Second');
  const url = id => `/api/projects/wall/cards/${id}/comments`;

  await say(s, 'wall', a.id, 'Dev', 'Build is green');
  const r = await s.ok('POST', url(a.id), { author: 'Dev', text: 'Build   is green\n' });
  check('the same text again (whitespace aside) is caught with a clear result', r.firewalled && r.reason === 'duplicate' && /kept out by the firewall: duplicate/.test(r.message), r);
  check('the card did not get the copy', (await getCard(s, 'wall', a.id)).comments.length === 1);
  await say(s, 'wall', b.id, 'Dev', 'Build is green');
  check('the same text on another card is fine', (await getCard(s, 'wall', b.id)).comments.length === 1);

  const o1 = await s.ok('POST', url(a.id), { author: 'Lead', text: 'Original: make it faster' });
  const o = await s.ok('POST', url(a.id), { author: 'Lead', text: 'Original: make it quicker' });
  check('the first "Original:" note passes, a second one is caught', !o1.firewalled && o.firewalled && o.reason === 'original', [o1, o]);
  const e = await s.ok('POST', url(a.id), { author: 'Dev', text: ' 👉 ... ' });
  check('an empty poke is caught', e.firewalled && e.reason === 'empty', e);
  const own = await s.ok('POST', url(a.id), { author: 'Owner', text: 'Build is green' });
  check('the owner is never caught', !own.firewalled, own);
  const again = await s.ok('POST', url(a.id), { author: 'Dev', text: 'Build is green' });
  check('after the owner has replied the same words are a new message', !again.firewalled, again);

  await s.ok('POST', url(b.id), { author: 'Lead', text: 'Which colour?', needsYou: true, mark: 'ask' });
  const bump = await s.ok('POST', url(b.id), { author: 'Lead', text: 'Which colour?', needsYou: true, mark: 'ask' });
  check('a re-sent ask is still a bump, not a catch', bump.bumped && !bump.firewalled, bump);

  const c1 = await s.ok('POST', '/api/projects/wall/leadchat', { author: 'Lead', text: 'Morning' });
  const c2 = await s.ok('POST', '/api/projects/wall/leadchat', { author: 'Lead', text: 'Morning' });
  check('Lead chat: a repeated reply is caught', !c1.firewalled && c2.firewalled && c2.reason === 'duplicate', [c1, c2]);
  check('Lead chat holds only one', (await s.ok('GET', '/api/projects/wall/leadchat')).messages.length === 1);

  const list = await s.ok('GET', '/api/firewall');
  check('GET /api/firewall lists the catches newest first with time, project, card, author, kind, text', list.items.length === 4 && list.items[0].kind === 'chat' && list.items.every(x => x.at && x.project === 'wall' && x.author && x.kind && x.text !== undefined) && list.items.some(x => x.card === a.id), list);
  check('the project filter works', (await s.ok('GET', '/api/firewall?project=nothere')).items.length === 0);

  const cli = s.cli(['comment', 'wall', b.id, 'Build is green', '--as', 'Dev']);
  check('the CLI says it was kept out', /kept out by the firewall: duplicate/.test(cli.out), cli);
});
