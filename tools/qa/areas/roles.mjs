// QA area: roles (AIG-676, AIG-677), Setup > Roles: who can make projects, and who gets into the owner's servers.
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, until, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('roles', 'Setup > Roles: Can make projects (defaults, tick on/off, refused create names who can) and server access levels (saved, ▶ Run hidden for none) (AIG-676/677)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const local = path.join(s.dir, 'aigile.local.json');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead', model: 'opus' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Bob', role: 'Developer', model: 'sonnet' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Hana', role: 'Helper', model: 'haiku' });
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Fran', kind: 'person', role: 'Friend' });

  // 1. defaults: the owner and leads on; developers, helpers and people off (old data has no field)
  const r0 = await s.ok('GET', '/api/roles'), can = n => (r0.people.find(p => p.name === n) || {}).canMake;
  check('defaults: owner and the lead can make projects', can('Owner') === true && can('Lead') === true, r0.people);
  check('defaults: a developer, a helper and a person cannot', can('Bob') === false && can('Hana') === false && can('Fran') === false, r0.people);
  check('no canMake field is written until a tick is changed', !('canMake' in JSON.parse(fs.readFileSync(local, 'utf8'))));

  // 2. making a project checks the caller
  const no = s.cli(['new-project', 'Beta', '--key', 'BET', '--as', 'Bob']);
  check('Bob (no tick) is refused with a short message naming who can', no.code !== 0 && /ask someone who can/.test(no.err) && /Lead/.test(no.err) && /Owner/.test(no.err), no);
  check('the refused project was not made', !(await s.ok('GET', '/api/projects')).some(p => p.slug === 'beta'));
  check('the lead can make a project', s.cli(['new-project', 'Gamma', '--key', 'GAM', '--as', 'Lead']).code === 0);
  check('the owner and a nameless caller can', s.cli(['new-project', 'Delta', '--key', 'DEL', '--as', 'Owner']).code === 0 && s.cli(['new-project', 'Eps', '--key', 'EPS']).code === 0);

  // 3. tick on, then off, on the page
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#rolesBox .roles-make[data-who="Bob"] input');
  check('the page shows the owner ticked and locked, Bob unticked', await page.isChecked('#rolesBox .roles-make[data-who="Owner"] input') && await page.isDisabled('#rolesBox .roles-make[data-who="Owner"] input') && !(await page.isChecked('#rolesBox .roles-make[data-who="Bob"] input')));
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/roles') && r.request().method() === 'POST'), page.click('#rolesBox .roles-make[data-who="Bob"] input')]);
  check('ticking Bob is saved', (JSON.parse(fs.readFileSync(local, 'utf8')).canMake || {}).bob === true);
  check('Bob can now make a project', s.cli(['new-project', 'Beta', '--key', 'BET', '--as', 'Bob']).code === 0);
  await page.waitForSelector('#rolesBox .roles-make[data-who="Bob"] input:checked');
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/roles') && r.request().method() === 'POST'), page.click('#rolesBox .roles-make[data-who="Bob"] input')]);
  check('unticking Bob is saved and he is refused again', s.cli(['new-project', 'Zeta', '--key', 'ZET', '--as', 'Bob']).code !== 0 && (JSON.parse(fs.readFileSync(local, 'utf8')).canMake || {}).bob === false);
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/roles') && r.request().method() === 'POST'), page.click('#rolesBox .roles-make[data-who="Lead"] input')]);
  check('a lead can be switched off too', s.cli(['new-project', 'Eta', '--key', 'ETA', '--as', 'Lead']).code !== 0);
  check('the owner cannot be switched off', (await s.api('POST', '/api/roles', { name: 'Owner', canMake: false })).status === 400);

  // 4. servers: an old entry (no access field) is owner only; levels are chosen per person on the page
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'QA Box', kind: 'ssh', value: 'qa@127.0.0.1' }] } });
  check('an old server entry reads as owner only', JSON.stringify((await s.ok('GET', '/api/meta')).srvAccess) === JSON.stringify({ 'QA Box': {} }));
  const page2 = await openPage(ctx, '#/setup');
  await page2.waitForSelector('#rolesBox select[data-who="Bob"]');
  check('every level is offered, none selected by default', (await page2.$$eval('#rolesBox select[data-who="Bob"] option', o => o.map(x => x.value))).join() === 'none,run,admin' && (await page2.inputValue('#rolesBox select[data-who="Bob"]')) === 'none');
  await Promise.all([page2.waitForResponse(r => r.url().endsWith('/api/setup') && r.request().method() === 'POST'), page2.selectOption('#rolesBox select[data-who="Bob"]', 'run')]);
  await Promise.all([page2.waitForResponse(r => r.url().endsWith('/api/setup') && r.request().method() === 'POST'), page2.selectOption('#rolesBox select[data-who="Hana"]', 'admin')]);
  const srv = JSON.parse(fs.readFileSync(local, 'utf8')).servers;
  check('the levels are saved on the server entry', srv && srv[0].access && srv[0].access.Bob === 'run' && srv[0].access.Hana === 'admin' && srv[0].value === 'qa@127.0.0.1', srv);
  await page2.waitForFunction(() => /ssh key on the server yourself/.test(document.querySelector('#rolesBox').textContent), null, { timeout: 5000 }).catch(() => {});
  check('the full admin note says to add the ssh key yourself', /ssh key on the server yourself/.test(await page2.textContent('#rolesBox')));
  const acc = (await s.ok('GET', '/api/meta')).srvAccess['QA Box'];
  check('meta carries the access', acc && acc.Bob === 'run' && acc.Hana === 'admin', acc);
  check('a bad level is dropped, not stored', !JSON.stringify((await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'QA Box', kind: 'ssh', value: 'qa@127.0.0.1', access: { Bob: 'run', Evil: 'root' } }] } })).prefs.servers).includes('Evil'));
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'QA Box', kind: 'ssh', value: 'qa@127.0.0.1', access: { Bob: 'run', Hana: 'admin' } }] } });

  // 5. ▶ Run buttons on a server task: owner and "run" see them, "none" does not
  const task = await mkCard(s, 'alpha', 'Restart it', { description: 'Run:\n```\necho one\n```' });
  s.cli(['task', 'alpha', task.id, 'run this on the server', '--server', '--as', 'Lead']);
  const card = '#/p/alpha/' + task.id, runs = p => p.$$eval('.codebox button.run', b => b.length);
  const owner = await openPage(ctx, card);
  await owner.waitForSelector('[data-term] .codebox.runs', { timeout: 8000 }).catch(() => {});
  check('the owner sees ▶ Run', (await runs(owner)) >= 1);
  const view = async who => { const p = await ctx.newPage(); p.errors = []; await p.addInitScript(w => { try { localStorage.setItem('aigile.viewAs', w); localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} }, who); p.on('pageerror', e => p.errors.push(e.message)); await p.goto(s.base + '/' + card); await p.waitForSelector('[data-term] .codebox[data-runs]', { timeout: 8000 }).catch(() => {}); await sleep(300); return p; };
  const bob = await view('Bob'), fran = await view('Fran');
  check('a person at "run tasks" sees ▶ Run', (await runs(bob)) >= 1);
  check('a person at "none" does not see ▶ Run', (await runs(fran)) === 0);
  check('the code block is still shown to them', (await fran.$$('.codebox')).length >= 1);
  noErrors(page); noErrors(page2); noErrors(owner);
  check('no errors for the viewers', bob.errors.length === 0 && fran.errors.length === 0, [...bob.errors, ...fran.errors]);
  void until;
}, true);
