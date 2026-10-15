// QA area: starter (AIG-340), import without AI.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, openPage, noErrors, def } from '../lib.mjs';

def('starter', '📥 Import without AI: starter cards from README to-dos, TODO/FIXME, git history, branches; capped, scrubbed, opt-out, works in No Token Mode (AIG-340)', async (s, ctx) => {
  const root = tmp('starter'), g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  const commit = (cwd, m) => { g(cwd, 'add', '.'); g(cwd, '-c', 'user.name=qa', '-c', 'user.email=qa@x', 'commit', '-qm', m); };
  const repo = path.join(root, 'Starter Repo'); fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'README.md'), '# Starter Repo\n\nA thing.\n\n## To do\n\n- [ ] Add dark mode\n- [x] Already done thing\n- [ ] Write the manual\n\n## Roadmap\n\n- Offline support\n\n## About\n\n- not a plan item\n');
  fs.writeFileSync(path.join(repo, 'src', 'a.js'), '// TODO: cache the lookups\nconst x = 1;\n// FIXME: crash on empty list\n// TODO: use C:\\Users\\rich\\secret\\keys here\nconst api_key = "sk-abcdefghijklmnopqrstuvwxyz123456"; // TODO: remove\n');
  fs.writeFileSync(path.join(repo, '.env'), 'TODO: password=hunter2hunter2\n');
  g(repo, 'init', '-q'); commit(repo, 'first');
  for (let i = 2; i <= 5; i++) { fs.appendFileSync(path.join(repo, 'src', 'b.js'), `// c${i}\n`); commit(repo, 'change number ' + i); }
  g(repo, 'checkout', '-q', '-b', 'feature/login'); fs.writeFileSync(path.join(repo, 'l.txt'), 'x'); commit(repo, 'login wip'); g(repo, 'checkout', '-q', '-');
  const mk = async (name, key, dir) => { const p = await s.ok('POST', '/api/projects', { name, key }); await s.ok('PATCH', '/api/projects/' + p.slug, { path: dir }); return p.slug; };
  const slug = await mk('Starter One', 'STO', repo.replace(/\\/g, '/'));
  await s.ok('POST', '/api/notokens', { on: true });
  const r = await s.ok('POST', `/api/projects/${slug}/starter`, { lang: 'en' });
  await s.ok('POST', '/api/notokens', { on: false });
  const cards = (await s.ok('GET', '/api/projects/' + slug)).cards, titles = cards.map(c => c.title);
  check('starter cards made while No Token Mode is on, all marked from import', r.added === cards.length && cards.length > 5 && cards.every(c => c.from === 'import' && /^From import/.test(c.description) && c.title.startsWith('📥')), titles);
  const done = cards.find(c => /Recently done/.test(c.title));
  check('recent history is one done card with the commit subjects', done && done.status === 'done' && /change number 5/.test(done.description) && /- first/.test(done.description), done);
  check('README to-do and roadmap items come in, checked and other-section ones do not', titles.some(t => /Add dark mode/.test(t)) && titles.some(t => /Write the manual/.test(t)) && titles.some(t => /Offline support/.test(t)) && !titles.some(t => /Already done|not a plan item/.test(t)), titles);
  const fx = cards.find(c => /crash on empty/.test(c.title));
  check('TODO and FIXME lines come in with file and line only', titles.some(t => /cache the lookups/.test(t)) && fx && fx.type === 'bug' && /FIXME in src\/a\.js:3/.test(fx.description));
  check('an open branch and the Wake the team hint are there', titles.some(t => /Branch: feature\/login/.test(t)) && titles.some(t => /Wake the team/.test(t)));
  check('nothing secret imported (path, key, .env)', !JSON.stringify(cards).match(/sk-abc|hunter2|C:\\|secret\\keys|remove/), titles);
  check('a second import does nothing', (await s.ok('POST', `/api/projects/${slug}/starter`, { lang: 'en' })).added === 0);
  // cap + Dutch
  const big = path.join(root, 'Big'); fs.mkdirSync(big); g(big, 'init', '-q');
  fs.writeFileSync(path.join(big, 'README.md'), '# Big\n\n## TODO\n\n' + Array.from({ length: 40 }, (_, i) => `- [ ] Item number ${i} ` + 'x'.repeat(200)).join('\n') + '\n');
  fs.writeFileSync(path.join(big, 'c.js'), Array.from({ length: 40 }, (_, i) => `// TODO: later ${i}`).join('\n'));
  commit(big, 'init'); for (const b of 'abcdefgh') g(big, 'branch', 'br-' + b);
  g(big, 'checkout', '-q', '-b', 'side'); fs.writeFileSync(path.join(big, 'z'), '1'); commit(big, 'side'); g(big, 'checkout', '-q', '-');
  const s2 = await mk('Big One', 'BIG', big.replace(/\\/g, '/')); await s.ok('POST', `/api/projects/${s2}/starter`, { lang: 'nl-BE' });
  const bc = (await s.ok('GET', '/api/projects/' + s2)).cards;
  check('capped at 25 cards with short titles', bc.length <= 25 && bc.length >= 15 && bc.every(c => c.title.length <= 82), bc.length);
  check('Dutch texts for nl-BE', bc.some(c => /Wek het team/.test(c.title)) && bc.some(c => /Onlangs klaar/.test(c.title)) && bc.every(c => /^Uit import/.test(c.description)));
  const nl = await s.ok('POST', `/api/projects/${slug}/starter`, { lang: 'nl' });
  check('nl is a known language too', nl.already === true);
  // UI: opt-out tick
  const only = path.join(root, 'only'), off = path.join(root, 'off');
  for (const [parent, name] of [[only, 'AppA'], [off, 'AppB']]) {
    const d = path.join(parent, name); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'README.md'), '# ' + name + '\n\nHello there.\n\n- [ ] Do a thing\n'); g(d, 'init', '-q'); commit(d, 'start');
  }
  const page = await openPage(ctx, '#/');
  await page.evaluate(d => findProjectsDialog(d), only);
  await page.waitForSelector('.fprow');
  check('the import screen has the starter tick, on by default', await page.$eval('#fp-starter', i => i.checked));
  await page.uncheck('#fp-connect');
  await page.click('#dialog button:has-text("Add ticked projects")'); await page.waitForSelector('#fp-done li');
  const pa = (await s.ok('GET', '/api/projects')).find(x => x.name === 'AppA');
  check('ticked: the import screen made the starter cards', (await s.ok('GET', '/api/projects/' + pa.slug)).cards.some(c => c.from === 'import' && /Do a thing/.test(c.title)));
  await page.evaluate(d => findProjectsDialog(d), off);
  await page.waitForSelector('.fprow'); await page.uncheck('#fp-connect'); await page.uncheck('#fp-starter');
  await page.click('#dialog button:has-text("Add ticked projects")'); await page.waitForSelector('#fp-done li');
  const pb = (await s.ok('GET', '/api/projects')).find(x => x.name === 'AppB');
  check('unticked: no starter cards', (await s.ok('GET', '/api/projects/' + pb.slug)).cards.length === 0);
  noErrors(page);
}, true);
