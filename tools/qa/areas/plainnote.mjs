// QA area: plainnote (AIG-375): only a real ask makes a question; a plain comment never does; start clears a stale needsYou.
import { check, tmp, mkProject, mkCard, getCard, def } from '../lib.mjs';

def('plainnote', 'a plain team comment never flags needs-owner (even on a quick card); aigile start clears a stale needsYou unless an ask is open (AIG-375)', async (s) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('pn') });
  const say = (id, text) => s.ok('POST', `/api/projects/alpha/cards/${id}/comments`, { author: 'Lead', text });
  const quick = await mkCard(s, 'alpha', '💬 raised by the owner', { quick: true, createdBy: 'Owner', status: 'team' });
  await say(quick.id, 'Already being built');
  let c;
  const chat = await s.ok('GET', '/api/chats/alpha');
  check('a plain lead comment on a quick card is no question: kind idea, not open, no Go', chat.cards[quick.id].kind === 'idea' && !chat.open.some(o => o.id === quick.id) && !chat.cards[quick.id].waiting, chat);
  const real = await mkCard(s, 'alpha', 'Real ask');
  s.cli(['ask', 'alpha', real.id, 'Which one?', '--as', 'Lead']);
  const chat2 = await s.ok('GET', '/api/chats/alpha');
  check('a real ask is a question and open', chat2.cards[real.id].kind === 'question' && chat2.open.some(o => o.id === real.id), chat2.cards);

  const later = await mkCard(s, 'alpha', '💬 later idea', { quick: true, needsYou: true, status: 'backlog', createdBy: 'Ideas' });
  s.cli(['start', 'alpha', later.id, '--as', 'Lead']);
  c = await getCard(s, 'alpha', later.id);
  check('start clears a stale needsYou', c.status === 'doing' && !c.needsYou, c);

  const asked = await mkCard(s, 'alpha', 'Real question');
  s.cli(['ask', 'alpha', asked.id, 'Which one?', '--as', 'Lead']);
  s.cli(['start', 'alpha', asked.id, '--as', 'Lead']);
  c = await getCard(s, 'alpha', asked.id);
  check('start keeps needsYou while a real ask is open', c.needsYou, c);
});
