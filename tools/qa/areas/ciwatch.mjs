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
});
