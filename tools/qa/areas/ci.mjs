// QA area: ci (AIG-1122): configuration items per project. API add/patch/remove/list (p.ci only when set), validation (kind, date, backup,
// key = a Secrets name never a value), CLI list/add/set/rm, and the page #/ci/<slug> with add, edit and remove.
import { check, mkProject, def, openPage, noErrors } from '../lib.mjs';

const getProject = (s, slug) => s.ok('GET', '/api/projects/' + slug + '?full=1');

def('ci', '🗂️ configuration items: per project list, add/edit/remove, key names only, CLI, page #/ci/<slug> (AIG-1122)', async (s, ctx) => {
  await mkProject(s, 'Cfg', 'CFG');
  const d0 = await s.ok('GET', '/api/projects/cfg/ci');
  check('a new project has no items and the picks are there', d0.items.length === 0 && d0.kinds.length === 7 && Array.isArray(d0.servers) && Array.isArray(d0.keys), d0);
  check('p.ci is absent while empty', (await getProject(s, 'cfg')).ci === undefined);

  const a = await s.ok('POST', '/api/projects/cfg/ci', { kind: 'server', name: 'prod-1', detail: 'main box', expires: '2027-01-31', backup: { where: 'S3 bucket', everyDays: 7 }, links: ['CFG-1', 'https://example.com'] });
  check('add gives the exact item shape', a.id === 'ci-1' && a.kind === 'server' && a.name === 'prod-1' && a.detail === 'main box' && a.expires === '2027-01-31' && a.backup.where === 'S3 bucket' && a.backup.everyDays === 7 && a.links.join() === 'CFG-1,https://example.com', a);
  const b = await s.ok('POST', '/api/projects/cfg/ci', { kind: 'domain', name: 'example.com' });
  check('a bare item has no expires or backup, empty links', b.id === 'ci-2' && !('expires' in b) && !('backup' in b) && b.links.length === 0 && b.detail === '', b);
  check('stored on the project as p.ci', (await getProject(s, 'cfg')).ci.length === 2);
  check('bad kind, bad date, bad backup, no name are refused', (await s.api('POST', '/api/projects/cfg/ci', { kind: 'cloud', name: 'x' })).status === 400
    && (await s.api('POST', '/api/projects/cfg/ci', { kind: 'domain', name: 'x', expires: '2027-02-30' })).status === 400
    && (await s.api('POST', '/api/projects/cfg/ci', { kind: 'domain', name: 'x', backup: { where: 'w', everyDays: 0 } })).status === 400
    && (await s.api('POST', '/api/projects/cfg/ci', { kind: 'domain', name: '  ' })).status === 400);
  const k = await s.ok('POST', '/api/projects/cfg/ci', { kind: 'key', name: 'GITHUB_TOKEN', detail: 'deploy' });
  check('a key item is a Secrets name', k.name === 'GITHUB_TOKEN', k);
  check('a key item holding something that is not a name is refused', (await s.api('POST', '/api/projects/cfg/ci', { kind: 'key', name: 'ghp_abc123secretvalue' })).status === 400);

  const u = await s.ok('PATCH', '/api/projects/cfg/ci/ci-2', { detail: 'registrar: X', expires: '2027-05-01' });
  check('patch keeps other fields and changes the given ones', u.name === 'example.com' && u.detail === 'registrar: X' && u.expires === '2027-05-01' && u.id === 'ci-2', u);
  const u2 = await s.ok('PATCH', '/api/projects/cfg/ci/ci-1', { expires: '', backup: null });
  check('empty expires and null backup are cleared', !('expires' in u2) && !('backup' in u2) && u2.name === 'prod-1', u2);
  check('unknown id is 404', (await s.api('PATCH', '/api/projects/cfg/ci/ci-99', { name: 'x' })).status === 404 && (await s.api('DELETE', '/api/projects/cfg/ci/ci-99')).status === 404);

  // CLI
  const ls = s.cli(['ci', 'cfg']);
  check('CLI lists the items', ls.code === 0 && /ci-1 \[server\] prod-1/.test(ls.out) && /ci-2 \[domain\] example.com/.test(ls.out), ls);
  const ad = s.cli(['ci', 'cfg', 'add', 'certificate', 'example.com TLS', '--expires', '2027-03-01', '--backup-where', 'vault', '--backup-days', '30', '--links', 'CFG-2,CFG-3', '--as', 'Owner'], { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' });
  check('CLI add makes an item', ad.code === 0 && /\[certificate\] example.com TLS/.test(ad.out) && /expires 2027-03-01/.test(ad.out) && /every 30d/.test(ad.out), ad);
  const st = s.cli(['ci', 'cfg', 'set', 'ci-4', '--detail', 'wildcard', '--as', 'Owner'], { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' });
  check('CLI set changes one', st.code === 0 && /wildcard/.test(st.out), st);
  check('CLI add with a bad kind fails', s.cli(['ci', 'cfg', 'add', 'cloud', 'x', '--as', 'Owner'], { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' }).code !== 0);
  const rm = s.cli(['ci', 'cfg', 'rm', 'ci-4', '--as', 'Owner'], { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' });
  check('CLI rm removes it', rm.code === 0 && (await s.ok('GET', '/api/projects/cfg/ci')).items.length === 3, rm);

  // Page
  const page = await openPage(ctx, '#/ci/cfg');
  await page.waitForSelector('li[data-ci="ci-1"]');
  check('the page lists the items', (await page.locator('li.ci-row').count()) === 3 && /prod-1/.test(await page.innerText('li[data-ci="ci-1"]')));
  await page.click('#ci-add');
  await page.selectOption('#ci-kind', 'supplier');
  await page.fill('#ci-name', 'Hetzner');
  await page.fill('#ci-detail', 'hosting');
  await page.fill('#ci-bwhere', 'offsite');
  await page.fill('#ci-bdays', '3');
  await page.click('#ci-save');
  await page.waitForSelector('li.ci-row:has-text("Hetzner")');
  const added = (await s.ok('GET', '/api/projects/cfg/ci')).items.find(x => x.name === 'Hetzner');
  check('adding on the page saves the item', added && added.kind === 'supplier' && added.backup.everyDays === 3 && added.detail === 'hosting', added);
  await page.click('li[data-ci="ci-2"] button[data-edit]');
  await page.fill('#ci-detail', 'edited on page');
  await page.click('#ci-save');
  await page.waitForSelector('li[data-ci="ci-2"]:has-text("edited on page")');
  await page.click('#ci-add');
  await page.selectOption('#ci-kind', 'key');
  await page.fill('#ci-name', 'not a name');
  await page.click('#ci-save');
  await page.waitForFunction(() => document.getElementById('ci-err') && document.getElementById('ci-err').textContent.length > 0);
  check('a key that is not a Secrets name shows the error', /Secrets name/.test(await page.innerText('#ci-err')));
  page.errors = [];   // the 400 above was on purpose
  await page.click('.ci-form button[type=button]');
  page.once('dialog', dlg => dlg.accept());
  await page.click('li[data-ci="ci-2"] button[data-rm]');
  await page.waitForFunction(() => !document.querySelector('li[data-ci="ci-2"]'));
  check('remove on the page deletes it', !(await s.ok('GET', '/api/projects/cfg/ci')).items.some(x => x.id === 'ci-2'));
  await noErrors(page);
}, true);
