// QA area: noteam (AIG-1298). A new project or space starts with the default team (a Lead) unless the owner unticks it or No AI is on;
// a project made after the morning pick is in today's focus on Normal; a board with nobody on it says so with "Start a team", an AI
// team without a folder asks for one ("Choose a folder"), a team of people only is not nagged; the Home card shows "No team yet".
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('noteam', 'New projects and spaces start with a Lead; made after the pick = Normal today; no-team board line with Start a team / Choose a folder; Home "No team yet" (AIG-1298)', async (s, ctx) => {
  const get = slug => s.ok('GET', '/api/projects/' + slug);
  const sum = async slug => (await s.ok('GET', '/api/projects')).find(p => p.slug === slug);
  const lead = p => (p.team || []).some(m => m.name === 'Lead' && m.role === 'Lead');

  // 1. Every create path through POST /api/projects gets a Lead (team: true here: the QA seed helper sends team: false); { team: false } and No AI leave the team empty.
  await mkProject(s, 'Plain', 'PLN', { team: true, path: tmp('noteam-plain') });
  check('a new project starts with a Lead', lead(await get('plain')), (await get('plain')).team);
  check('and is not marked as without a team', !(await sum('plain')).noTeam);
  await mkProject(s, 'Messenger', 'MSG', { team: true });
  await mkProject(s, 'iPhone', 'IPH', { team: true, parent: 'messenger' });
  check('a new space gets a Lead', lead(await get('messenger')));
  check('a new project inside a space gets a Lead', lead(await get('iphone')), (await get('iphone')).team);
  await mkProject(s, 'Bare', 'BAR', { team: false });
  check('team: false (the owner unticked it) leaves the team empty', !(await get('bare')).team.length && (await sum('bare')).noTeam === true);
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  await mkProject(s, 'Quiet', 'QUI', { team: true });
  check('No AI mode: a new project gets no team', !(await get('quiet')).team.length);
  check('No AI mode: Start a team is refused', (await s.api('POST', '/api/projects/quiet/start-team')).status === 409);
  await s.ok('POST', '/api/noai/off');

  // 2. Today: the morning pick rests the unticked ones; a project made after it is on Normal and never left out.
  const today = () => s.ok('GET', '/api/today'), row = (d, slug) => d.projects.find(p => p.slug === slug);
  let d = await s.ok('POST', '/api/today/pick', { slugs: ['plain'] });
  check('the pick rests an unticked project and leaves it out', row(d, 'bare').weight === 'rest' && d.left.includes('bare'), d.left);
  await mkProject(s, 'Web', 'WEB', { team: true, parent: 'messenger' });
  d = await today();
  check('a project made after the pick is on Normal today', row(d, 'web') && row(d, 'web').weight === 'normal' && !row(d, 'web').resting, row(d, 'web'));
  check('and is not left out (Home and the rail show it)', !d.left.includes('web'), d.left);
  check('and the picker shown later would have it ticked', row(d, 'web').pickDefault !== 'rest', row(d, 'web').pickDefault);
  // Exact percentages set before it was made: not held to a 0% share it never had.
  const lf = path.join(s.dir, 'aigile.local.json'), loc = JSON.parse(fs.readFileSync(lf, 'utf8'));
  fs.writeFileSync(lf, JSON.stringify({ ...loc, budget: { ...(loc.budget || {}), day: 1000000 } }));
  const live = (await today()).projects.map(p => p.slug);
  await s.ok('POST', '/api/today/shares', { pct: Object.fromEntries(live.map((x, i) => [x, i ? 0 : 100])) });
  await mkProject(s, 'Android', 'AND', { team: true, parent: 'messenger' });
  fs.mkdirSync(path.join(s.data, 'logs'), { recursive: true });
  const now = Date.now();
  fs.appendFileSync(path.join(s.data, 'logs', '_runs.jsonl'), JSON.stringify({ slug: 'android', start: now - 6e4, end: now - 3e4, fresh: 1000, cw: 0, out: 1000, cache: 0 }) + '\n');
  d = await today();
  check('with exact percentages a project made later is not slowed as over its share', row(d, 'android') && row(d, 'android').over === false && row(d, 'android').weight === 'normal', row(d, 'android'));
  await s.ok('POST', '/api/today/shares', {});
  fs.writeFileSync(lf, JSON.stringify(loc));

  // 3. Start a team: the default team, once.
  let r = await s.ok('POST', '/api/projects/bare/start-team');
  check('Start a team adds the Lead and says a folder is needed', r.added === true && r.needsFolder === true && lead(await get('bare')), r);
  r = await s.ok('POST', '/api/projects/bare/start-team');
  check('a second click adds nobody', r.added === false && (await get('bare')).team.length === 1);
  await mkProject(s, 'Empty', 'EMP', { team: false });
  await mkProject(s, 'People', 'PPL', { team: false });
  await s.ok('POST', '/api/projects/people/team', { name: 'Sam', kind: 'person' });

  // The page: the board line, the button, the folder line, no nag for people only, the Home card.
  const page = await openPage(ctx, '#/p/empty');
  await page.waitForSelector('#noTeamLine', { timeout: 8000 });
  check('a board with no team says so at the top', /No team here yet, so nothing gets worked on\./.test(await page.textContent('#noTeamLine')));
  check('with one Start a team button, and Choose a folder since it has no folder', !!(await page.$('#noTeamStart')) && !!(await page.$('#noTeamFolder')));
  await page.click('#noTeamStart');
  await page.waitForFunction(() => !document.querySelector('#noTeamStart') && /The team needs a folder/.test((document.querySelector('#noTeamLine') || {}).textContent || ''), null, { timeout: 8000 });
  const emp = await get('empty'), startGone = !(await page.$('#noTeamStart'));
  check('after Start a team the Lead is there and the line asks for a folder', lead(emp) && startGone, [lead(emp), startGone, emp.team]);
  await page.click('#noTeamFolder');
  await page.waitForSelector('#c-path', { timeout: 5000 });
  check('Choose a folder opens the Connect folder dialog', !!(await page.$('#c-path')));
  await page.keyboard.press('Escape');
  check('and the line also offers Make one for me', !!(await page.$('#noTeamMake')));
  await page.click('#noTeamMake');
  await page.waitForFunction(() => !document.querySelector('#noTeamLine'), null, { timeout: 10000 });
  const made = await get('empty');
  check('Make one for me makes and links a folder under the projects folder, and the line goes', made.path === path.join(s.dir, 'projects').replace(/\\/g, '/') + '/Empty' && fs.existsSync(made.path), made.path);
  await page.goto(page.url().replace(/#.*$/, '#/p/plain')); await page.waitForFunction(h => location.hash === h && document.querySelector('#app .toolbar'), page.url().replace(/^[^#]*/, ''), { timeout: 8000 }); await page.waitForTimeout(400);
  check('a board with a team and a folder has no line', !(await page.$('#noTeamLine')));
  await page.goto(page.url().replace(/#.*$/, '#/p/people')); await page.waitForFunction(h => location.hash === h && document.querySelector('#app .toolbar'), page.url().replace(/^[^#]*/, ''), { timeout: 8000 }); await page.waitForTimeout(400);
  check('a team of people only (cards only) is not asked for a folder', !(await page.$('#noTeamLine')));

  await mkProject(s, 'Lonely', 'LON', { team: false });
  await page.goto(page.url().replace(/#.*$/, '#/')); await page.waitForSelector('a.proj', { timeout: 8000 });
  const card = page.locator('a.proj[href="#/p/lonely"]');
  check('the Home card shows No team yet', /No team yet/.test(await card.textContent()) && /nothing gets worked on/.test(await card.textContent()));
  check('a card with a team and a folder does not', !/No team yet|No folder yet/.test(await page.locator('a.proj[href="#/p/plain"]').textContent()));

  // The new-project dialog: the team tick, on by default.
  await page.evaluate(() => newProject());
  await page.waitForSelector('#p-team', { state: 'attached', timeout: 5000 });
  check('the new-project dialog has "Start with a team", ticked', await page.$eval('#p-team', el => el.checked));
  await page.fill('#p-name', 'Dialog made'); await page.evaluate(() => { const f = document.getElementById('p-path'); f.value = ''; f.dataset.touched = 1; document.getElementById('p-kids').value = ''; });
  await page.evaluate(() => { document.getElementById('p-kids').value = 'Kid one'; });
  await page.evaluate(() => document.querySelector('#p-name').form.requestSubmit());
  await page.waitForFunction(() => /Kid one/.test((document.querySelector('#p-done') || {}).textContent || ''), null, { timeout: 15000 });
  const dm = await get('dialog-made'), kid = await get('kid-one'), home = path.join(s.dir, 'projects').replace(/\\/g, '/');
  check('a space made in the new-project dialog starts with a Lead', lead(dm), dm.team);
  check('and, with the folder box empty, gets a folder made under the projects folder', dm.path === home + '/Dialog made' && fs.existsSync(dm.path), [dm.path, home]);
  check('its project inside gets a Lead and a folder inside the space folder', lead(kid) && kid.path === dm.path + '/Kid one', [kid.path, kid.team]);
  await page.keyboard.press('Escape');
  // Unticked: a cards-only project, no team and no folder.
  await page.evaluate(() => newProject());
  await page.waitForSelector('#p-team', { state: 'attached', timeout: 5000 });
  await page.fill('#p-name', 'Cards only'); await page.evaluate(() => { document.getElementById('p-more').open = true; });
  await page.uncheck('#p-team');
  await page.evaluate(() => document.querySelector('#p-name').form.requestSubmit());
  await page.waitForFunction(() => location.hash === '#/p/cards-only', null, { timeout: 8000 });
  const co = await get('cards-only');
  check('unticked: a cards-only project, no team and no folder', !co.team.length && !co.path, [co.team, co.path]);
  await page.waitForSelector('#app .toolbar', { timeout: 8000 }); await page.waitForTimeout(400);
  check('and its board does not nag for a team (cards only on purpose)', co.teamless === true && !(await page.$('#noTeamLine')));

  // Phone width and dark mode.
  await page.goto(page.url().replace(/#.*$/, '#/p/lonely')); await page.waitForSelector('#noTeamLine', { timeout: 8000 });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  check('phone width: the line fits', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('#noTeamLine').getBoundingClientRect().right <= window.innerWidth + 1));
  const shot = path.join(process.env.QA_SHOTS || s.dir, 'noteam-board-phone-dark.png');
  await page.screenshot({ path: shot }); console.log('screenshot: ' + shot);
  await page.goto(page.url().replace(/#.*$/, '#/')); await page.waitForSelector('a.proj', { timeout: 8000 });
  const shot2 = path.join(process.env.QA_SHOTS || s.dir, 'noteam-home-phone-dark.png');
  await page.screenshot({ path: shot2 }); console.log('screenshot: ' + shot2);
  await page.emulateMedia({ colorScheme: 'light' }); await page.setViewportSize({ width: 1280, height: 900 });
  noErrors(page);
  await page.close();
}, true);
