// QA area: offline (AIG-446): a project saved as one .aigile file and opened as a new project (page, API and CLI).
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, mkCard, say, openPage, noErrors, def, tbClick } from '../lib.mjs';

def('offline', '📦 share a project offline: save as .aigile and open it (round trip with a picture, no secrets in the file, bad files refused, slug clash, the page buttons, CLI export/import) (AIG-446)', async (s, ctx) => {
  // A project with a folder, a start command and a picture on a comment.
  await mkProject(s, 'Travel Plans', 'TRV', { path: 'C:\\Users\\secret\\Documents\\Travel Plans', description: 'trip' });
  const c1 = await mkCard(s, 'travel-plans', 'Book flights', { status: 'doing', testSteps: '1. Click it', openUrl: 'http://localhost:9999/x', startCmd: 'npm run secret-start', checklist: ['a', 'b'] });
  await mkCard(s, 'travel-plans', 'Pack bags', { waitsFor: [c1.id] });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
  const up = await s.ok('POST', '/api/projects/travel-plans/attachments', { name: 'map.png', type: 'image/png', data: png.toString('base64') });
  await say(s, 'travel-plans', c1.id, 'Owner', 'see the map', { attachments: [up.id] });

  const file = await s.ok('GET', '/api/projects/travel-plans/export');
  const text = JSON.stringify(file);
  check('file has a format and a version', file.format === 'aigile-project' && file.version === 1, [file.format, file.version]);
  check('file holds the cards and the picture', file.project.cards.length === 2 && file.project.cards[0].comments.some(m => (m.attachments || []).some(a => a.name === 'map.png' && a.data === png.toString('base64'))));
  check('no folder path in the file', !text.includes('secret') && !text.includes('Documents') && !/"path"/.test(text), text.slice(0, 200));
  check('no start command or open address in the file', !text.includes('secret-start') && !text.includes('localhost:9999') && !/startCmd|openUrl/.test(text));
  check('no settings, keys, DMs or share links in the file', !/aigile\.local|apiKey|token|relay|"share"|"friend|"dm|runSession|teamSeenAt|"team":|"log":/i.test(text), text.match(/aigile\.local|apiKey|token|relay|"share"|"friend|"dm|runSession|teamSeenAt|"team":|"log":/i));

  // Round trip: it opens as a new project, no folder, picture and cards back.
  const preview = await s.ok('POST', '/api/projects/import', { file, preview: true });
  check('preview names it and counts the cards', preview.name === 'Travel Plans' && preview.cards === 2 && preview.files === 1 && preview.renamed === true && preview.slug === 'travel-plans-2', preview);
  check('preview creates nothing', !(await s.ok('GET', '/api/projects')).some(p => p.slug === 'travel-plans-2'));
  const made = await s.ok('POST', '/api/projects/import', { file });
  check('slug clash gets a new slug', made.slug === 'travel-plans-2' && made.name === 'Travel Plans', made);
  const back = await s.ok('GET', '/api/projects/travel-plans-2');
  check('opened project has no folder and a fresh key', back.path === '' && back.key !== 'TRV' && back.key && back.cards.length === 2, [back.path, back.key]);
  check('cards are renumbered to the new key', back.cards.every(c => c.id.startsWith(back.key + '-')) && back.cards[1].waitsFor[0] === back.cards[0].id, back.cards.map(c => c.id));
  check('card text, steps and checklist come back', back.cards[0].title === 'Book flights' && back.cards[0].testSteps === '1. Click it' && back.cards[0].checklist.length === 2 && !back.cards[0].startCmd && !back.cards[0].openUrl);
  const att = back.cards[0].comments.flatMap(m => m.attachments || [])[0];
  check('picture is stored in the new project', att && att.name === 'map.png' && att.path.includes('travel-plans-2') && fs.readFileSync(att.path).equals(png), att);
  check('a card can be added with the next number', (await mkCard(s, 'travel-plans-2', 'Next')).id === back.key + '-3');

  // AIG-1160: configuration items, releases and the service fields on cards travel too, and card ids inside them follow a new key.
  const svc = { format: 'aigile-project', version: 1, project: { name: 'Service Pack', key: 'SVP', nextId: 3, ci: [{ id: 'ci-4', kind: 'server', name: 'db-1', detail: '', backup: { where: 'S3', everyDays: 7, since: '2026-09-01' }, links: ['SVP-1', { card: 'SVP-1', type: 'incident', at: '2026-09-02T00:00:00.000Z' }] }], ciN: 4,
    releases: [{ name: 'v1.0', at: '2026-09-03T00:00:00.000Z', by: 'owner', cards: ['SVP-1', 'SVP-2'], notes: 'n', rollback: 'SVP-2' }],
    cards: [{ id: 'SVP-1', title: 'Db down', status: 'done', type: 'incident', ci: ['ci-4'], major: { at: '2026-09-02T00:00:00.000Z', by: 'Owner', swarm: false, alerted: true },
      review: { state: 'posted', at: '2026-09-03T00:00:00.000Z', by: 'Lead', timeline: 't', helped: 'h', actions: [{ text: 'fix', card: 'SVP-2' }], runbook: 'SVP-2' }, runbook: 'db-restore', desk: { kind: 'incident', auto: true, dup: { id: 'SVP-2', how: 'text' } } },
      { id: 'SVP-2', title: 'Runbook', status: 'todo', runbookProposal: { name: 'db-restore', text: 'x', from: 'SVP-1', file: '/home/secret/x.md' } }] } };
  const sp = await s.ok('POST', '/api/projects/import', { file: svc }), sp2 = await s.ok('POST', '/api/projects/import', { file: svc });
  const g1 = await s.ok('GET', '/api/projects/' + sp.slug + '?full=1'), g2 = await s.ok('GET', '/api/projects/' + sp2.slug + '?full=1');
  const e1 = await s.ok('GET', '/api/projects/' + sp.slug + '/export'), a1 = e1.project.cards[0];
  check('items, the counter and releases come back, and go out again', g1.ci.length === 1 && g1.ciN === 4 && g1.ci[0].backup.since === '2026-09-01' && g1.releases.length === 1 && e1.project.ci.length === 1 && e1.project.releases[0].name === 'v1.0', [g1.ci, g1.releases]);
  check('card fields come back: review, runbook, ci, desk, major', a1.review.state === 'posted' && a1.review.actions[0].text === 'fix' && a1.runbook === 'db-restore' && a1.ci[0] === 'ci-4' && a1.desk.dup.id === 'SVP-2' && a1.major.alerted === true, a1);
  check('the runbook file path is left out', !JSON.stringify(e1).includes('secret') && !('file' in e1.project.cards[1].runbookProposal) && e1.project.cards[1].runbookProposal.name === 'db-restore');
  check('with a new key the card ids inside follow it', g2.key !== 'SVP' && g2.cards[0].review.actions[0].card === g2.key + '-2' && g2.cards[0].review.runbook === g2.key + '-2' && g2.cards[0].desk.dup.id === g2.key + '-2' && g2.cards[1].runbookProposal.from === g2.key + '-1'
    && g2.releases[0].cards.join() === g2.key + '-1,' + g2.key + '-2' && g2.releases[0].rollback === g2.key + '-2' && g2.ci[0].links[1].card === g2.key + '-1', [g2.key, g2.releases, g2.ci]);
  const bad2 = async (what, fn, re) => { const f = JSON.parse(JSON.stringify(svc)); fn(f); const r = await s.api('POST', '/api/projects/import', { file: f }); check('refused: ' + what, r.status >= 400 && re.test(r.body.error), [r.status, r.body.error]); };
  await bad2('a bad item kind', f => { f.project.ci[0].kind = 'cloud'; }, /kind/);
  await bad2('a bad backup interval', f => { f.project.ci[0].backup.everyDays = 0; }, /interval/);
  await bad2('a bad review state', f => { f.project.cards[0].review.state = 'x'; }, /state/);
  await bad2('a card item id that is not an item id', f => { f.project.cards[0].ci = ['../x']; }, /item id/);
  await bad2('a release card that is not a card id', f => { f.project.releases[0].cards = ['nope']; }, /card id/);

  // Bad files are refused and write nothing.
  const bad = async (what, f, re) => { const r = await s.api('POST', '/api/projects/import', { file: f }); check('refused: ' + what, r.status >= 400 && (!re || re.test(r.body.error)), [r.status, r.body.error]); };
  const mod = fn => { const f = JSON.parse(text); fn(f); return f; };
  await bad('not a project file', { hello: 1 }, /not an AI-gile project file/);
  await bad('a list instead of a file', [1, 2], /not an AI-gile/);
  await bad('newer version', mod(f => { f.version = 99; }), /newer AI-gile/);
  await bad('no project name', mod(f => { f.project.name = ''; }), /name/);
  await bad('bad card status', mod(f => { f.project.cards[0].status = 'zzz'; }), /status/);
  await bad('cards not a list', mod(f => { f.project.cards = 'x'; }), /list/);
  await bad('duplicate card id', mod(f => { f.project.cards[1].id = f.project.cards[0].id; }), /twice/);
  await bad('card id with path tricks', mod(f => { f.project.cards[0].id = '../../x-1'; }), /bad id/);
  for (const n of ['../evil.png', '..\\evil.png', 'a/b.png', 'C:evil.png', '..']) await bad('attachment name "' + n + '"', mod(f => { f.project.cards[0].comments.find(m => m.attachments).attachments[0].name = n; }), /safe file name/);
  await bad('picture data is not base64', mod(f => { f.project.cards[0].comments.find(m => m.attachments).attachments[0].data = '***'; }), /damaged/);
  await bad('picture size does not match', mod(f => { f.project.cards[0].comments.find(m => m.attachments).attachments[0].size = 5; }), /damaged/);
  await bad('title is a number', mod(f => { f.project.cards[0].title = 5; }), /text/);
  check('refused files made no project', (await s.ok('GET', '/api/projects')).length === 4);
  check('no attachment folder was left behind', fs.readdirSync(path.join(s.data, 'attachments')).sort().join() === 'travel-plans,travel-plans-2');

  // Over the cap: more than 20 MB of pictures cannot be saved, with a clear error.
  await mkProject(s, 'Heavy', 'HVY');
  const hv = await mkCard(s, 'heavy', 'Big files');
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await s.ok('POST', '/api/projects/heavy/attachments', { name: 'big' + i + '.bin', type: 'application/octet-stream', data: Buffer.alloc(8 * 1024 * 1024, i + 1).toString('base64') })).id);
  for (const id of ids) await say(s, 'heavy', hv.id, 'Owner', 'file', { attachments: [id] });
  const big = await s.api('GET', '/api/projects/heavy/export');
  check('over 20 MB of files is refused with a clear error', big.status === 413 && /20 MB/.test(big.body.error), [big.status, big.body.error]);

  // CLI twins.
  const f = path.join(tmp('offline'), 'trip.aigile');
  const ex = s.cli(['export', 'travel-plans', f]);
  check('cli export writes the file', ex.code === 0 && /saved travel-plans/.test(ex.out) && JSON.parse(fs.readFileSync(f, 'utf8')).format === 'aigile-project', ex);
  const im = s.cli(['import', f]);
  check('cli import makes another new project', im.code === 0 && /opened travel-plans-3 /.test(im.out) && /not linked to a folder/.test(im.out), im);
  const nf = s.cli(['import', path.join(path.dirname(f), 'nope.aigile')]);
  check('cli import of a missing file says so', nf.code !== 0 && /no such file/.test(nf.err), nf);
  fs.writeFileSync(f + '.bad', '{ not json');
  check('cli import of a broken file says so', /not valid JSON/.test(s.cli(['import', f + '.bad']).err));
  fs.writeFileSync(f + '.bad', JSON.stringify({ format: 'aigile-project', version: 1, project: { name: 'X', cards: [{ id: 'X-1', title: 't', status: 'nope' }] } }));
  check('cli import of a bad file is refused', /status/.test(s.cli(['import', f + '.bad']).err));

  // The page: Save as file downloads it; Open a project file previews, then opens.
  const page = await openPage(ctx, '#/p/travel-plans');
  const [dl] = await Promise.all([page.waitForEvent('download'), tbClick(page, 'button:has-text("Save as file")')]);   // under ⋯ More (AIG-1359)
  check('the page downloads <name>.aigile', dl.suggestedFilename() === 'Travel Plans.aigile', dl.suggestedFilename());
  const saved = path.join(tmp('offline'), 'dl.aigile');
  await dl.saveAs(saved);
  check('the downloaded file is the project', JSON.parse(fs.readFileSync(saved, 'utf8')).project.cards.length === 2);
  await page.goto(s.base + '/#/');
  await page.waitForSelector('#app .toolbar');
  await page.click('button:has-text("Open a project file")');
  await page.setInputFiles('#ofl-file', saved);
  await page.waitForSelector('#ofl-preview h3');
  const pv = await page.textContent('#ofl-preview');
  check('preview shows the name and card count', pv.includes('Travel Plans') && pv.includes('2 cards') && pv.includes('travel-plans-4'), pv);
  await page.click('#ofl-go');
  await page.waitForURL(/#\/p\/travel-plans-4$/);
  check('opened project shows its cards', await page.waitForSelector('text=Book flights', { timeout: 5000 }).then(() => true, () => false));
  await page.goto(s.base + '/#/');
  await page.click('button:has-text("Open a project file")');
  const junk = path.join(tmp('offline'), 'junk.aigile'); fs.writeFileSync(junk, 'hello');
  await page.setInputFiles('#ofl-file', junk);
  await page.waitForFunction(() => document.getElementById('d-err').textContent.length > 0);
  check('a bad file shows an error and stays closed', /not an AI-gile project file/.test(await page.textContent('#d-err')) && await page.isDisabled('#ofl-go'));
  noErrors(page);

  // AIG-887/863: problem fields and the risk register travel too, with card ids remapped
  await mkProject(s, 'Prob Pack', 'PPK');
  const ch = await mkCard(s, 'prob-pack', 'Change it', { type: 'change', status: 'todo' });
  const rinc = await mkCard(s, 'prob-pack', 'Flights down', { type: 'incident' });
  const prob = await s.ok('POST', '/api/projects/prob-pack/problems', { title: 'Airline API', incidents: [rinc.id], rootCause: 'rate limit', workaround: 'retry', change: ch.id });
  const rk = await s.ok('POST', '/api/projects/prob-pack/risks', { risk: 'Visa late', card: ch.id, likelihood: 3, impact: 2, mitigation: 'apply early' });
  const pf = await s.ok('GET', '/api/projects/prob-pack/export');
  check('file holds the problem fields and the risk register', pf.project.cards.find(c => c.id === prob.id).rootCause === 'rate limit' && pf.project.risks.length === 1 && pf.project.risks[0].card === ch.id, pf.project.risks);
  const pm = await s.ok('POST', '/api/projects/import', { file: pf });
  const pb = await s.ok('GET', '/api/projects/' + pm.slug), nk = pb.key, remap = id => nk + id.slice(id.indexOf('-'));
  const bp = pb.cards.find(c => c.type === 'problem'), bi = pb.cards.find(c => c.type === 'incident');
  check('imported problem keeps cause, workaround, links and remaps card ids', nk !== 'PPK' && bp.rootCause === 'rate limit' && bp.workaround === 'retry' && bp.incidents.join() === remap(rinc.id) && bp.changeId === remap(ch.id) && bi.problemId === bp.id, [bp, nk]);
  const br = await s.ok('GET', '/api/projects/' + pm.slug + '/risks');
  check('imported risk register is restored with the card ref remapped', br.risks.length === 1 && br.risks[0].id === rk.id && br.risks[0].card === remap(ch.id) && br.risks[0].mitigation === 'apply early' && br.risks[0].score === 6, br);
}, true);
