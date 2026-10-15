// QA area: spacewatch (AIG-437): a night watching a space watches the projects inside it too; an idea that names a space and a
// project inside it lands in that project.
import { createRequire } from 'module';
import path from 'path';
import { check, def, mkProject, ROOT } from '../lib.mjs';

def('spacewatch', '🪐 watching a space watches its children (any depth); ideas naming a space and its child land in the child (AIG-437)', async s => {
  await mkProject(s, 'Fleet', 'FLT');
  await mkProject(s, 'Ship', 'SHP', { parent: 'fleet' });
  await mkProject(s, 'Hull', 'HUL', { parent: 'ship' });
  await mkProject(s, 'Harbour', 'HAR');
  await s.ok('POST', '/api/quiet', { on: true, watch: ['fleet'] });
  const w = (await s.ok('GET', '/api/watchman')).watch || [];
  check('watching the space watches everything inside it, nothing else', ['fleet', 'ship', 'hull'].every(x => w.includes(x)) && !w.includes('harbour'), w);
  await s.ok('POST', '/api/quiet', { on: false });
  // Idea sorting is plain code: check it straight on the module.
  const { byRules } = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'scrummaster.js'));
  const ps = [{ slug: 'fleet', name: 'Fleet', key: 'FLT' }, { slug: 'ship', name: 'Ship', key: 'SHP', parent: 'fleet' }, { slug: 'hull', name: 'Hull', key: 'HUL', parent: 'ship' }, { slug: 'harbour', name: 'Harbour', key: 'HAR' }];
  check('space + child named: the child wins', (byRules('the fleet ship needs new sails', ps) || {}).slug === 'ship');
  check('space + grandchild named: the grandchild wins', (byRules('fleet hull is leaking', ps) || {}).slug === 'hull');
  check('only the space named: the space', (byRules('fleet plans for next year', ps) || {}).slug === 'fleet');
  check('two unrelated projects tie: no guess', byRules('harbour and fleet both', ps) === null);
});
