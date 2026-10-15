// QA area: a team card whose latest comment is the lead's waits on the owner: no "stuck" need, no poke or wake (AIG-767).
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, getCard, say, def } from '../lib.mjs';

def('stuckwake', 'a For the team card the lead answered last does not wake or poke the lead; a newer owner comment does (AIG-767)', async (s) => {
  const slug = 'stuckwake', attention = async () => (await s.ok('GET', '/api/projects')).find(p => p.slug === slug).attention;
  const settle = async () => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/' + slug)).presence.running; i++) await sleep(250); };
  const stale = () => {   // the owner's comments are an hour old
    const f = path.join(s.data, slug + '.json'), p = JSON.parse(fs.readFileSync(f, 'utf8')), old = new Date(Date.now() - 3600e3).toISOString();
    for (const c of p.cards) { for (const m of c.comments) m.at = old; if (c.createdBy === 'Owner') c.created = old; c.updated = old; }
    fs.writeFileSync(f, JSON.stringify(p, null, 1));
  };
  await mkProject(s, 'Stuckwake', 'STW', { path: tmp('STW') });
  const c = await mkCard(s, slug, 'Waiting', { status: 'doing' });
  await say(s, slug, c.id, 'Owner', 'status?');
  await settle(); stale(); await s.ok('GET', `/api/projects/${slug}/updates`);   // the session is around
  check('an owner comment left unanswered is stuck', (await attention())?.kind === 'stuck', await attention());
  await say(s, slug, c.id, 'Stuckwake lead', 'on it, here is the answer');
  await settle(); stale(); await s.ok('GET', `/api/projects/${slug}/updates`);
  check('the lead answered last: card is still for the team', (await getCard(s, slug, c.id)).status === 'team');
  check('the lead answered last: no stuck need, so no wake or poke', !(await attention()), await attention());
  await say(s, slug, c.id, 'Owner', 'one more thing');
  await settle(); stale(); await s.ok('GET', `/api/projects/${slug}/updates`);
  check('a newer owner comment makes it stuck again', (await attention())?.kind === 'stuck', await attention());
});
