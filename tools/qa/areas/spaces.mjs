// QA area: spaces (AIG-433/434/464). A project can sit inside another (parent link, no loops); each stays a full project.
import { check, mkProject, mkCard, def } from '../lib.mjs';

def('spaces', '🪐 spaces: parent link, loops refused, the CLI --parent (AIG-433)', async (s) => {
  await mkProject(s, 'Idea Playground', 'IDE');
  await mkProject(s, 'JointPassingBot', 'JPB');
  await mkProject(s, 'Deep', 'DEE', { parent: 'jointpassingbot' });
  await mkCard(s, 'jointpassingbot', 'Import the bot');

  /* ---------- the parent link (AIG-433) ---------- */
  const mv = await s.api('PATCH', '/api/projects/jointpassingbot', { parent: 'idea-playground' });
  check('PATCH parent puts a project inside another', mv.status === 200 && mv.body.parent === 'idea-playground', mv);
  const list = await s.ok('GET', '/api/projects');
  check('the project list carries parent', list.find(p => p.slug === 'jointpassingbot').parent === 'idea-playground' && !list.find(p => p.slug === 'idea-playground').parent);
  check('a new project can start inside a space', list.find(p => p.slug === 'deep').parent === 'jointpassingbot');
  const jp = await s.ok('GET', '/api/projects/jointpassingbot');
  check('a child is still a full project: its own cards and key', jp.key === 'JPB' && jp.cards.length === 1);
  check('GET a project lists the spaces it sits in and its own projects', jp.space.up.map(u => u.slug).join() === 'idea-playground' && jp.space.kids.map(k => k.slug).join() === 'deep', jp.space);
  const ip = await s.ok('GET', '/api/projects/idea-playground');
  check('a space lists its projects with how many sit inside each', ip.space.kids.length === 1 && ip.space.kids[0].slug === 'jointpassingbot' && ip.space.kids[0].kids === 1 && ip.cards.length === 0, ip.space);
  const deep = await s.ok('GET', '/api/projects/deep');
  check('the path goes outermost first', deep.space.up.map(u => u.slug).join() === 'idea-playground,jointpassingbot', deep.space.up);

  /* ---------- refused ---------- */
  const self = await s.api('PATCH', '/api/projects/idea-playground', { parent: 'idea-playground' });
  check('a project cannot sit inside itself', self.status === 400 && /itself/.test(self.body.error || JSON.stringify(self.body)), self);
  const loop = await s.api('PATCH', '/api/projects/idea-playground', { parent: 'deep' });
  check('a loop is refused (a space cannot go inside its own project)', loop.status === 400 && /inside/.test(JSON.stringify(loop.body)), loop);
  check('the refused move changed nothing', !(await s.ok('GET', '/api/projects/idea-playground')).parent);
  const none = await s.api('PATCH', '/api/projects/deep', { parent: 'nope' });
  check('a parent that does not exist is refused', none.status === 400, none);
  const badNew = await s.api('POST', '/api/projects', { name: 'Orphan', parent: 'nope' });
  check('a new project with an unknown parent is refused (and not made)', badNew.status === 400 && !(await s.ok('GET', '/api/projects')).some(p => p.slug === 'orphan'), badNew);

  /* ---------- take out ---------- */
  const out = await s.ok('PATCH', '/api/projects/deep', { parent: '' });
  check('an empty parent takes it out to the top level', !out.parent && !(await s.ok('GET', '/api/projects/deep')).parent);
  const cli = s.cli(['new-project', 'Side Quest', '--key', 'SQ', '--parent', 'idea-playground']);
  check('aigile new-project --parent makes it inside the space', cli.code === 0 && (await s.ok('GET', '/api/projects/side-quest')).parent === 'idea-playground', cli);
});
