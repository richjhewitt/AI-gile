// QA area: projtypes (AIG-442). A project picks its type; the team's own numbers follow, with a "what changed" line and Undo; one role can load another template.
import { check, mkProject, openPage, noErrors, def, until } from '../lib.mjs';

def('projtypes', 'Project types: pick web app, the team\'s scales change, Undo, load another template into one role and only that role changes (AIG-442)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const roles = async () => Object.fromEntries((await s.ok('GET', '/api/projects/alpha/profiles')).roles.map(r => [r.id, r.project || {}]));
  const types = await s.ok('GET', '/api/project-types');
  check('the eight types are there', ['webapp', 'mobile', 'server', 'data', 'game', 'docs', 'life', 'custom'].every(id => types.some(t => t.id === id)) && types.length === 8, types.map(t => t.id));
  check('nothing is set before a type is picked', Object.values(await roles()).every(p => !Object.keys(p).length));
  check('a bad type is refused', (await s.api('POST', '/api/projects/alpha/project-type', { type: 'nope' })).status === 404);

  const page = await openPage(ctx, '#/p/alpha');
  await page.evaluate(() => teamDialog());
  await page.waitForSelector('#tm-type');
  check('Undo starts disabled', await page.locator('#tm-type-undo').isDisabled());
  await page.selectOption('#tm-type', 'webapp');
  await page.waitForFunction(() => /Web app/.test(document.getElementById('tm-msg').textContent));
  const web = await roles();
  check('web app: frontend, backend and QA numbers changed', web['frontend-mid'].tests === 4 && web['backend-mid'].tests === 4 && web['qa-junior'].tests === 5, JSON.stringify(web));
  check('web app: the lead (no tweak) is untouched', !Object.keys(web['lead-principal'] || {}).length);
  const msg = await page.textContent('#tm-msg');
  check('a "what changed" line names the roles and scales', /changed/.test(msg) && /Frontend/.test(msg), msg);
  check('the type shows as picked and Undo is on', (await page.inputValue('#tm-type')) === 'webapp' && await page.locator('#tm-type-undo').isEnabled());

  await page.click('#tm-type-undo');
  await page.waitForFunction(() => /before/.test(document.getElementById('tm-msg').textContent));
  const back = await roles();
  check('Undo puts every role back', Object.values(back).every(p => !Object.keys(p).length) && (await s.ok('GET', '/api/projects/alpha')).projectType === undefined);
  check('and Undo is disabled again', !!(await until(() => page.locator('#tm-type-undo').isDisabled())));   // repainted a moment after the message (AIG-920)

  // One role loads another template: only that role changes
  await page.selectOption('#tm-type', 'webapp'); await page.waitForFunction(() => /Web app/.test(document.getElementById('tm-msg').textContent));
  const before = await roles();
  await page.selectOption('.tm-loadtpl[data-role="frontend-mid"]', 'security-senior');
  await page.waitForFunction(() => /now works like/.test(document.getElementById('tm-msg').textContent));
  const after = await roles();
  const tpl = (await s.ok('GET', '/api/profiles')).roles.find(r => r.id === 'security-senior');
  check('the frontend role has the loaded template\'s numbers', JSON.stringify(after['frontend-mid']) === JSON.stringify(Object.fromEntries(Object.entries(tpl.scales).filter(([k]) => k !== 'go'))) && JSON.stringify(after['frontend-mid']) !== JSON.stringify(before['frontend-mid']), JSON.stringify([before['frontend-mid'], after['frontend-mid'], tpl.scales]));
  check('every other role is exactly as it was', Object.keys(before).filter(id => id !== 'frontend-mid').every(id => JSON.stringify(before[id]) === JSON.stringify(after[id])));
  check('a bad template is refused', (await s.api('POST', '/api/projects/alpha/profiles/frontend-mid/load-template', { template: 'nope' })).status === 404);

  // Life: no tests, plain words
  const life = await s.ok('POST', '/api/projects/alpha/project-type', { type: 'life' });
  const l = await roles();
  check('life: tests 1 and plain words for every role, and the owner talk is plain', l['frontend-mid'].tests === 1 && l['frontend-mid'].words === 1 && (await s.ok('GET', '/api/projects/alpha/profiles')).owner.words === 1 && life.canUndo);
  const custom = await s.ok('POST', '/api/projects/alpha/project-type', { type: 'custom' });
  check('custom clears the type\'s numbers', Object.values(await roles()).every(p => !Object.keys(p).length) && custom.projectType === 'custom');
  noErrors(page);
}, true);
