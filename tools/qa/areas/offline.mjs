// QA area: offline (AIG-446): a project saved as one .aigile file and opened as a new project (page, API and CLI).
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

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
  check('refused files made no project', (await s.ok('GET', '/api/projects')).length === 2);
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
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Save as file")')]);
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
}, true);
