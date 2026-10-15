// QA area: runbooks (AIG-1107): markdown files in docs/runbooks of the project folder. API list/read/link, CLI list/print, brief line for a
// service project, and the incident card showing matching runbooks with an Open button.
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, mkCard, getCard, def, openPage, noErrors } from '../lib.mjs';

def('runbooks', '📖 runbooks: docs/runbooks/*.md list/read/link, CLI, brief line, incident card shows matches + Open (AIG-1107)', async (s, ctx) => {
  const dir = tmp('runbooks');
  await mkProject(s, 'Rbk', 'RBK', { path: dir });
  await mkProject(s, 'Nofolder', 'NFD');
  check('no runbook folder is an empty list', (await s.ok('GET', '/api/projects/rbk/runbooks')).runbooks.length === 0);
  check('a project without a folder has none', (await s.ok('GET', '/api/projects/nofolder/runbooks')).runbooks.length === 0);
  const rd = path.join(dir, 'docs', 'runbooks');
  fs.mkdirSync(rd, { recursive: true });
  fs.writeFileSync(path.join(rd, 'database-restore.md'), '# Restore the database\n\n1. Stop the app\n2. Run the restore script\n');
  fs.writeFileSync(path.join(rd, 'cache-flush.md'), '# Flush the cache\n\nStep one.\n');
  fs.writeFileSync(path.join(rd, 'notes.txt'), 'not a runbook');
  const list = (await s.ok('GET', '/api/projects/rbk/runbooks')).runbooks;
  check('lists the .md names, sorted, without the extension', list.join() === 'cache-flush,database-restore', list);
  const one = await s.ok('GET', '/api/projects/rbk/runbooks/database-restore');
  check('reads one runbook', /Run the restore script/.test(one.text), one);
  check('an unknown or path-tricking name is a 404', (await s.api('GET', '/api/projects/rbk/runbooks/nope')).status === 404 && (await s.api('GET', '/api/projects/rbk/runbooks/..%2F..%2Fpackage')).status === 404);

  const inc = await mkCard(s, 'rbk', 'Database is down', { type: 'incident', status: 'todo' });
  const other = await mkCard(s, 'rbk', 'Login slow', { type: 'incident', status: 'todo' });
  const bug = await mkCard(s, 'rbk', 'A bug', { type: 'bug', status: 'todo' });
  const m = await s.ok('GET', `/api/projects/rbk/cards/${inc.id}/runbooks`);
  check('the incident title matches the runbook name by a word', m.matches.length === 1 && m.matches[0].name === 'database-restore' && !m.matches[0].linked, m);
  check('a title with no matching word has no matches', (await s.ok('GET', `/api/projects/rbk/cards/${other.id}/runbooks`)).matches.length === 0);
  check('a bug card has no runbooks box', (await s.api('GET', `/api/projects/rbk/cards/${bug.id}/runbooks`)).status === 400 && (await s.api('POST', `/api/projects/rbk/cards/${bug.id}/runbook`, { runbook: 'cache-flush' })).status === 400);
  check('linking an unknown runbook is refused', (await s.api('POST', `/api/projects/rbk/cards/${other.id}/runbook`, { runbook: 'nope' })).status === 404);
  const lk = await s.ok('POST', `/api/projects/rbk/cards/${other.id}/runbook`, { runbook: 'cache-flush' });
  check('link sets the runbook on the card, shown first', lk.linked === 'cache-flush' && lk.matches[0].name === 'cache-flush' && lk.matches[0].linked && (await getCard(s, 'rbk', other.id)).runbook === 'cache-flush', lk);
  const prob = await s.ok('POST', '/api/projects/rbk/problems', { title: 'Repeat outages', incidents: [inc.id] });
  check('a problem card can link one too, and an empty name unlinks', (await s.ok('POST', `/api/projects/rbk/cards/${prob.id}/runbook`, { runbook: 'database-restore' })).linked === 'database-restore' && (await s.ok('POST', `/api/projects/rbk/cards/${prob.id}/runbook`, { runbook: '' })).linked === '');

  // CLI
  const cl = s.cli(['runbook', 'rbk']);
  check('CLI lists the names', cl.code === 0 && /cache-flush/.test(cl.out) && /database-restore/.test(cl.out), cl);
  const cp = s.cli(['runbook', 'rbk', 'database-restore']);
  check('CLI prints one', cp.code === 0 && /Stop the app/.test(cp.out), cp);
  check('CLI unknown name fails', s.cli(['runbook', 'rbk', 'nope']).code !== 0);
  check('CLI with no runbooks says so', /no runbooks/.test(s.cli(['runbook', 'nofolder']).out));

  // brief: one line for a service project only
  await s.ok('POST', '/api/projects/rbk/team', { name: 'Rbk Lead', role: 'Lead', model: 'sonnet' });
  const b0 = s.cli(['brief', 'rbk']);
  check('no Runbooks line when the project is not a service', b0.code === 0 && !/Runbooks:/.test(b0.out), b0.out.slice(0, 300));
  await s.ok('PATCH', '/api/projects/rbk', { service: { on: true, offers: 'Radio' } });
  const b1 = s.cli(['brief', 'rbk']);
  check('a service project brief lists its runbook names in one line', /Runbooks: cache-flush, database-restore/.test(b1.out), b1.out.slice(0, 400));

  // Page
  const page = await openPage(ctx, `#/p/rbk/${inc.id}`);
  await page.waitForSelector(`#runbooks-${inc.id}:not([hidden])`);
  await page.click('[data-ctab="details"]').catch(() => {});
  const txt = await page.innerText(`#runbooks-${inc.id}`);
  check('the incident card shows the matching runbook', /database-restore/.test(txt), txt);
  await page.click(`#runbooks-${inc.id} button[data-rb="database-restore"]`);
  await page.waitForSelector('.md');
  check('Open shows the runbook in the docs viewer', /Run the restore script/.test(await page.innerText('.md')));
  await noErrors(page);
}, true);
