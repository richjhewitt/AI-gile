// QA area: spaces (AIG-433/434/464). A project can sit inside another (parent link, no loops); each stays a full project.
// The page: the tree on home and the rail with fold arrows, a space's grid on its board, drag in and out, the ⋯ menu, phone width.
import fs from 'fs';
import path from 'path';
import { check, sleep, mkProject, mkCard, openPage, noErrors, BASE, def, tmp } from '../lib.mjs';

def('spaces', '🪐 spaces: parent link, loops refused, CLI --parent; tree on home and rail, a space\'s grid, drag in/out, ⋯ menu, phone width (AIG-433/434/464)', async (s, ctx) => {
  await mkProject(s, 'Idea Playground', 'IDE');
  await mkProject(s, 'JointPassingBot', 'JPB');
  await mkProject(s, 'Deep', 'DEE', { parent: 'jointpassingbot' });
  await mkCard(s, 'jointpassingbot', 'Import the bot');

  /* ---------- the parent link (AIG-433) ---------- */
  const mv = await s.api('PATCH', '/api/projects/jointpassingbot', { parent: 'idea-playground' });
  check('PATCH parent puts a project inside another', mv.status === 200 && mv.body.parent === 'idea-playground', mv);
  const list = await s.ok('GET', '/api/projects');
  check('the project list carries parent', list.find(p => p.slug === 'jointpassingbot').parent === 'idea-playground' && !list.find(p => p.slug === 'idea-playground').parent);
  check('a new project can start inside a space', list.find(p => p.slug === 'deep').parent === 'jointpassingbot');
  const jp = await s.ok('GET', '/api/projects/jointpassingbot');
  check('a child is still a full project: its own cards and key', jp.key === 'JPB' && jp.cards.length === 1);
  check('GET a project lists the spaces it sits in and its own projects', jp.space.up.map(u => u.slug).join() === 'idea-playground' && jp.space.kids.map(k => k.slug).join() === 'deep', jp.space);
  const ip = await s.ok('GET', '/api/projects/idea-playground');
  check('a space lists its projects with how many sit inside each', ip.space.kids.length === 1 && ip.space.kids[0].slug === 'jointpassingbot' && ip.space.kids[0].kids === 1 && ip.cards.length === 0, ip.space);
  const deep = await s.ok('GET', '/api/projects/deep');
  check('the path goes outermost first', deep.space.up.map(u => u.slug).join() === 'idea-playground,jointpassingbot', deep.space.up);

  /* ---------- refused ---------- */
  const self = await s.api('PATCH', '/api/projects/idea-playground', { parent: 'idea-playground' });
  check('a project cannot sit inside itself', self.status === 400 && /itself/.test(self.body.error || JSON.stringify(self.body)), self);
  const loop = await s.api('PATCH', '/api/projects/idea-playground', { parent: 'deep' });
  check('a loop is refused (a space cannot go inside its own project)', loop.status === 400 && /inside/.test(JSON.stringify(loop.body)), loop);
  check('the refused move changed nothing', !(await s.ok('GET', '/api/projects/idea-playground')).parent);
  const none = await s.api('PATCH', '/api/projects/deep', { parent: 'nope' });
  check('a parent that does not exist is refused', none.status === 400, none);
  const badNew = await s.api('POST', '/api/projects', { name: 'Orphan', parent: 'nope' });
  check('a new project with an unknown parent is refused (and not made)', badNew.status === 400 && !(await s.ok('GET', '/api/projects')).some(p => p.slug === 'orphan'), badNew);

  /* ---------- take out ---------- */
  const out = await s.ok('PATCH', '/api/projects/deep', { parent: '' });
  check('an empty parent takes it out to the top level', !out.parent && !(await s.ok('GET', '/api/projects/deep')).parent);
  const cli = s.cli(['new-project', 'Side Quest', '--key', 'SQ', '--parent', 'idea-playground']);
  check('aigile new-project --parent makes it inside the space', cli.code === 0 && (await s.ok('GET', '/api/projects/side-quest')).parent === 'idea-playground', cli);
  const dir = path.join(tmp('newfolder'), 'Side Two'), cli2 = s.cli(['new-project', 'Side Two', '--folder', dir]);
  check('aigile new-project --folder makes and connects its folder (AIG-706)', cli2.code === 0 && fs.existsSync(dir) && (await s.ok('GET', '/api/projects/side-two')).path === dir.replace(/\\/g, '/'), cli2);

  /* ---------- the page (AIG-434/464) ---------- */
  await mkProject(s, 'Other', 'OTH');
  for (const [n, k, par] of [['Lvl One', 'LA', ''], ['Lvl Two', 'LB', 'lvl-one'], ['Lvl Three', 'LC', 'lvl-two'], ['Lvl Four', 'LD', 'lvl-three']]) await mkProject(s, n, k, { parent: par });
  const parentOf = async slug => (await s.ok('GET', '/api/projects/' + slug)).parent || '';
  const page = await openPage(ctx, '#/');
  let alerted = '';
  page.on('dialog', d => { alerted = d.message(); d.dismiss().catch(() => {}); });
  await page.waitForSelector('#app .proj[data-pslug="idea-playground"]');
  const inKids = (space, slug) => page.$(`#app .proj[data-pslug="${space}"] + .space-kids .proj[data-pslug="${slug}"]`).then(Boolean);
  check('home: a space\'s projects sit in an indented row under it', await inKids('idea-playground', 'jointpassingbot') && await inKids('idea-playground', 'side-quest'));
  check('home: the space shows a fold arrow and "2 inside"', !!(await page.$('#app .proj[data-pslug="idea-playground"] [data-spacefold]')) && /2/.test(await page.textContent('#app .proj[data-pslug="idea-playground"] .space-pill')));
  check('home: nested 3 levels deep, the 4th opens from its space', await inKids('lvl-two', 'lvl-three') && !(await page.$('#app .proj[data-pslug="lvl-four"]')) && !(await page.$('#app .proj[data-pslug="lvl-three"] [data-spacefold]')) && !!(await page.$('#app .proj[data-pslug="lvl-three"] .space-pill')));
  await page.click('#app .proj[data-pslug="idea-playground"] [data-spacefold]');
  await page.waitForFunction(() => !document.querySelector('#app .proj[data-pslug="jointpassingbot"]'), null, { timeout: 4000 }).catch(() => {});
  check('home: the fold arrow hides the projects inside (and does not open the board)', !(await page.$('#app .proj[data-pslug="jointpassingbot"]')) && (await page.evaluate(() => location.hash)) === '#/');
  await page.waitForFunction(() => !document.querySelector('#dmRail [data-slug="jointpassingbot"]'), null, { timeout: 5000 }).catch(() => {});
  check('rail: folding is shared with the rail, with the count inside', !(await page.$('#dmRail [data-slug="jointpassingbot"]')) && !!(await page.$('#dmRail .dm-space [data-slug="idea-playground"]')));
  await page.click('#dmRail [data-spacefold="idea-playground"]');
  await page.waitForSelector('#dmRail .dm-space [data-slug="jointpassingbot"]', { timeout: 5000 }).catch(() => {});
  check('rail: its own fold arrow opens the space again, as a folder', !!(await page.$('#dmRail .dm-space [data-slug="jointpassingbot"][data-parent="idea-playground"]')) && !!(await page.$('#app .proj[data-pslug="jointpassingbot"]')));

  // ⋯ The menu fallback: Move into… and Take out; a project's own projects are not offered (no loops).
  await page.click('#app .proj[data-pslug="idea-playground"] [data-spacemenu]');
  await page.waitForSelector('#spInto');
  const offered = await page.$$eval('#spInto option', os => os.map(o => o.value));
  check('menu: never offers itself or a project inside it', !offered.includes('idea-playground') && !offered.includes('jointpassingbot') && !offered.includes('side-quest') && offered.includes('other'), offered);
  await page.keyboard.press('Escape');
  await page.click('#app .proj[data-pslug="deep"] [data-spacemenu]');
  await page.waitForSelector('#spInto');
  await page.selectOption('#spInto', 'idea-playground'); await page.click('#spMove');
  await page.waitForSelector('#app .proj[data-pslug="idea-playground"] + .space-kids .proj[data-pslug="deep"]', { timeout: 5000 }).catch(() => {});
  check('menu: Move into puts it inside', (await parentOf('deep')) === 'idea-playground' && await inKids('idea-playground', 'deep'));
  await page.click('#app .proj[data-pslug="deep"] [data-spacemenu]');
  await page.waitForSelector('#spOut'); await page.click('#spOut');
  await page.waitForFunction(() => !document.querySelector('.space-kids .proj[data-pslug="deep"]'), null, { timeout: 5000 }).catch(() => {});
  check('menu: Take out moves it one level up', (await parentOf('deep')) === '');

  // Drag on the home page: onto a card = inside it; onto the strip = out, one level up.
  await page.dragAndDrop('#app .proj[data-pslug="deep"]', '#app .proj[data-pslug="other"]');
  await page.waitForSelector('#app .proj[data-pslug="other"] + .space-kids .proj[data-pslug="deep"]', { timeout: 5000 }).catch(() => {});
  check('home: dragging a project onto another puts it inside', (await parentOf('deep')) === 'other' && await inKids('other', 'deep'));
  // The strip only shows once a drag has started, so this drag is played as the browser's own events.
  const strip = await page.evaluate(() => {
    const dt = new DataTransfer(), src = document.querySelector('#app .proj[data-pslug="deep"]'), ev = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    ev(src, 'dragstart');
    const out = document.querySelector('#app .space-out'), shown = !!out.getBoundingClientRect().height;
    ev(out, 'dragover'); ev(out, 'drop'); ev(src, 'dragend');
    return shown;
  });
  await page.waitForFunction(() => !document.querySelector('.space-kids .proj[data-pslug="deep"]'), null, { timeout: 5000 }).catch(() => {});
  check('home: the "take out" strip shows while dragging; dropping on it moves the project out', strip && (await parentOf('deep')) === '', strip);

  // Drag on the rail: the middle of an icon (42px, so 21,21) = inside; above or below a top-level icon = out.
  await page.dragAndDrop('#dmRail [data-slug="deep"]', '#dmRail [data-slug="other"]', { targetPosition: { x: 21, y: 21 } });
  await page.waitForSelector('#dmRail [data-slug="deep"][data-parent="other"]', { timeout: 5000 }).catch(() => {});
  check('rail: dropping on the middle of an icon puts it inside', (await parentOf('deep')) === 'other');
  await page.dragAndDrop('#dmRail [data-slug="deep"]', '#dmRail [data-slug="idea-playground"]', { targetPosition: { x: 10, y: 3 } });
  await page.waitForSelector('#dmRail [data-slug="deep"][data-parent=""]', { timeout: 5000 }).catch(() => {});
  check('rail: dropping above a top-level icon takes it out', (await parentOf('deep')) === '');
  await page.dragAndDrop('#dmRail [data-slug="idea-playground"]', '#dmRail [data-slug="jointpassingbot"]', { targetPosition: { x: 21, y: 21 } });
  await sleep(800);
  check('rail: a space dropped into its own project is refused (no loop)', (await parentOf('idea-playground')) === '' && /inside/.test(alerted), alerted);
  page.errors = page.errors.filter(e => !/status of 400/.test(e));   // that refusal is the 400 the browser logs

  // A space's board: a home-style grid of its projects above its own cards; the crumb shows where a project sits.
  await page.goto(BASE + '/#/p/idea-playground'); await page.waitForSelector('.board');
  check('space board: a grid of its projects above its own board', !!(await page.$('.space-box[open] .proj[data-pslug="jointpassingbot"]')) && !!(await page.$('.space-box + .emptyhint, .space-box ~ .board')));
  check('space board: the 🪐 Space button is on the toolbar', (await page.$$eval('.toolbar button', bs => bs.some(b => b.getAttribute('onclick') === "Spaces.menu('idea-playground')"))));
  await page.click('.space-box .proj[data-pslug="jointpassingbot"] h2');
  await page.waitForSelector('.board'); await page.waitForFunction(() => /Idea Playground \//.test(document.getElementById('crumb').textContent), null, { timeout: 4000 }).catch(() => {});
  check('a child opens as its own full board, the crumb shows its space', /jointpassingbot/.test(await page.evaluate(() => location.hash)) && /Idea Playground \/.*JointPassingBot/.test(await page.textContent('#crumb')) && !(await page.$('.space-box')), await page.textContent('#crumb'));
  noErrors(page);

  /* ---------- phone width ---------- */
  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try {
    const pp = await openPage(ph, '#/');
    await pp.waitForSelector('#app .space-kids'); await pp.waitForSelector('#dmRail .dm-space', { timeout: 5000 }).catch(() => {}); await sleep(300);
    const wide = () => pp.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    check('phone: home with the tree has no sideways scroll', await wide());
    const m = await (await pp.$('#app .proj[data-pslug="idea-playground"] [data-spacemenu]')).boundingBox();
    check('phone: ⋯ and the fold arrow are big enough to tap', m.height >= 39.5 && m.width >= 39.5, m);
    check('phone: the rail folder runs along the bottom bar', !!(await pp.$('#dmRail .dm-space [data-slug="jointpassingbot"]')));
    await pp.click('#app .proj[data-pslug="idea-playground"] [data-spacemenu]'); await pp.waitForSelector('#spInto');
    check('phone: the menu fits', await wide());
    await pp.keyboard.press('Escape');
    await pp.goto(BASE + '/#/p/idea-playground'); await pp.waitForSelector('.space-box'); await sleep(300);
    check('phone: a space\'s board and grid have no sideways scroll', await wide());
    noErrors(pp);
  } finally { await ph.close().catch(() => {}); }
}, true);
