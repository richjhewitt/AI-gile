// QA area: ciwatch (AIG-1124, AIG-1126, lib/ciwatch.js): an item expiring within 30 days makes ONE "Renew" card per run (data/ciwatch.stub
// stands in for today); a backup older than its limit makes one card; marking it backed up stops it; a monthly restore test card.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, def } from '../lib.mjs';

def('ciwatch', '👁️ items expiring in 30 days get one Renew card (not two); an old backup gets one card, "backed up" stops it; monthly restore test (AIG-1124, AIG-1126)', async (s) => {
  await mkProject(s, 'Watched', 'WTC');
  const stub = d => fs.writeFileSync(path.join(s.data, 'ciwatch.stub'), d);
  const cards = async from => (await s.ok('GET', '/api/projects/watched')).cards.filter(c => c.from === 'ci watch' && (!from || c.ciWatch.why === from));
  stub('2026-06-01');

  await s.ok('POST', '/api/projects/watched/ci', { kind: 'certificate', name: 'shop TLS', expires: '2026-06-21' });
  await s.ok('POST', '/api/projects/watched/ci', { kind: 'domain', name: 'far.example', expires: '2026-09-01' });
  const r1 = await s.ok('POST', '/api/ciwatch/check', {});
  const c1 = await cards('expiry');
  check('an item expiring in 20 days makes one card on the next run', r1.made.length === 1 && c1.length === 1, r1);
  check('the card is "Renew <name> by <date>", high, for the on-call agent or lead', c1[0].title === 'Renew shop TLS by 2026-06-21' && c1[0].priority === 'high' && !!c1[0].assignee && c1[0].status !== 'done', c1[0]);
  const r2 = await s.ok('POST', '/api/ciwatch/check', {});
  check('the next run does not make a second one', r2.made.length === 0 && (await cards('expiry')).length === 1, r2);
  check('an item far from expiring has no card', !(await cards('expiry')).some(c => /far.example/.test(c.title)));
  stub('2026-08-10');
  const r3 = await s.ok('POST', '/api/ciwatch/check', {});
  check('later the far item comes within 30 days and gets its own card', r3.made.length === 1 && (await cards('expiry')).length === 2, r3);

  stub('2026-09-01');
  await s.ok('POST', '/api/projects/watched/ci', { kind: 'server', name: 'db-1', backup: { where: 'S3', everyDays: 7, last: '2026-08-20' } });
  const b1 = await s.ok('POST', '/api/ciwatch/check', {});
  const bk = await cards('backup');
  check('a backup older than its limit makes one card', bk.length === 1 && bk[0].title === 'Backup of db-1 is 12 days old' && bk[0].priority === 'high', bk);
  await s.ok('POST', '/api/ciwatch/check', {});
  check('again: still just one', (await cards('backup')).length === 1);
  const ci = (await s.ok('GET', '/api/projects/watched/ci')).items.find(x => x.name === 'db-1');
  const done = await s.ok('POST', '/api/projects/watched/ci/' + ci.id + '/backed-up', {});
  check('Backed up today sets last', done.backup.last === '2026-09-01', done);
  await s.ok('PATCH', '/api/projects/watched/cards/' + bk[0].id, { status: 'done' });
  await s.ok('POST', '/api/ciwatch/check', {});
  check('marked backed up: no new card', (await cards('backup')).length === 1);
  const cli = s.cli(['ci', 'watched', 'backed-up', ci.id, '--as', 'Owner'], { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' });
  check('the CLI backed-up works', cli.code === 0 && /last 2026-09-01/.test(cli.out), cli);
  check('editing the item keeps last', (await s.ok('PATCH', '/api/projects/watched/ci/' + ci.id, { backup: { where: 'S3 eu', everyDays: 7 } })).backup.last === '2026-09-01');
  stub('2026-09-20');
  await s.ok('POST', '/api/ciwatch/check', {});
  check('12 days after the last backup: a new card (limit 7)', (await cards('backup')).filter(c => c.status !== 'done').length === 1);
  check('no restore test yet (the count only began)', (await cards('restore')).length === 0);
  stub('2026-11-01');
  await s.ok('POST', '/api/ciwatch/check', {});
  const rt = await cards('restore');
  check('a month on: one restore test task card', rt.length === 1 && rt[0].title === 'Restore test for db-1' && rt[0].type === 'task', rt);
  await s.ok('POST', '/api/ciwatch/check', {});
  check('not repeated', (await cards('restore')).length === 1);
});
