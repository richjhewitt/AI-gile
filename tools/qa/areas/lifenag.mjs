// QA area: lifenag (AIG-813): a 🏡 life card with remindEvery comes back every N minutes until it is done
// (bump + one fresh ⏰ Reminder comment, so the inbox beeps again); an existing card can be turned into one.
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, check, tmp, mkProject, mkCard, getCard, def } from '../lib.mjs';

def('lifenag', 'life cards: remind every N minutes until done, turn a card into a life card (AIG-813)', async (s) => {
  const { repeat } = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'life.js'));
  // The rule itself, on a fake clock.
  const t0 = '2026-10-13T07:00:00.000Z', plus = m => new Date(Date.parse(t0) + m * 60e3).toISOString();
  const c = { title: 'Shower', lifeType: 'health', remindEvery: 60, status: 'todo', created: t0, comments: [] };
  check('not before the hour is up', !repeat(c, plus(59)));
  check('fires after an hour', repeat(c, plus(60)) && c.bumpedAt === plus(60) && c.comments.length === 1 && /Shower/.test(c.comments[0].text));
  check('waits a full hour again', !repeat(c, plus(119)) && repeat(c, plus(120)));
  check('keeps only the newest reminder comment', c.comments.length === 1 && c.comments[0].at === plus(120) && c.bumps === 2);
  check('stops once done', !repeat({ ...c, status: 'done' }, plus(500)));
  check('a card without it never fires', !repeat({ ...c, remindEvery: undefined }, plus(500)));

  // Over the API and CLI.
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('ln') });
  check('too short is refused', (await s.api('POST', '/api/projects/alpha/cards', { title: 'x', lifeType: 'health', remindEvery: 1 })).status === 400);
  const a = await mkCard(s, 'alpha', 'Drink water', { lifeType: 'health', remindEvery: 30 });
  check('remindEvery is saved', a.remindEvery === 30, a);
  const r = s.cli(['add', 'alpha', 'Stretch', '--life', 'health', '--every', '45']);
  check('CLI add --every', r.code === 0 && (await s.ok('GET', '/api/projects/alpha')).cards.some(x => x.title === 'Stretch' && x.remindEvery === 45), r);
  const team = await mkCard(s, 'alpha', 'Shower please', { status: 'team', assignee: 'Lead' });
  const e = s.cli(['edit', 'alpha', team.id, '--life', 'health', '--every', '60']);
  const conv = await getCard(s, 'alpha', team.id);
  check('CLI edit --life --every turns a card into the owner\'s life task', e.code === 0 && conv.lifeType === 'health' && conv.remindEvery === 60 && conv.assignee === 'Owner' && conv.status === 'todo' && conv.type === 'task', conv);
  const off = s.cli(['edit', 'alpha', team.id, '--every', '0']);
  check('--every 0 turns the reminders off', off.code === 0 && !(await getCard(s, 'alpha', team.id)).remindEvery);
}, false);
