// QA area: firststeps (AIG-1270, AIG-1271). Home First steps ticks from real state, Hide sticks, a busy board never shows it;
// pasting a list into the new card title offers Make N cards (one card per line, bullets and numbers stripped) or keep as one.
import { check, sleep, openPage, noErrors, mkProject, mkCard, def } from '../lib.mjs';

def('firststeps', 'Home First steps ticks itself and can be hidden; pasted list in the new card title makes one card per line (AIG-1270, AIG-1271)', async (s, ctx) => {
  await s.ok('POST', '/api/setup', { owner: 'Rich', 'agent.command': 'echo', 'agent.notesFile': 'CLAUDE.md', 'agent.settingsFile': '.claude/settings.json', prefs: { wizardSeen: true } });
  const ticked = pg => pg.$$eval('#firstSteps li.done', l => l.map(x => x.dataset.step));
  let page = await openPage(ctx, '#/'); await page.waitForSelector('#homeWelcome'); await sleep(800);
  check('fresh: First steps shows, nothing ticked', await page.locator('#firstSteps').count() === 1 && (await ticked(page)).length === 0);
  const p = await mkProject(s, 'Steps', 'STP');
  await page.reload(); await page.waitForSelector('#firstSteps'); await sleep(500);
  check('a project ticks "project"', (await ticked(page)).join() === 'project', (await ticked(page)).join());
  await mkCard(s, p.slug, 'One'); await page.reload(); await page.waitForSelector('#firstSteps');
  check('a card ticks "card"', (await ticked(page)).join() === 'project,card');
  await mkCard(s, p.slug, 'Two', { status: 'done' }); await page.reload(); await page.waitForSelector('#firstSteps');
  check('a done card ticks "done"', (await ticked(page)).join() === 'project,card,done');
  // AIG-1357: Invite a friend lands on Setup's Friends section, with the make-a-link button in view
  await page.click('#firstSteps li[data-step="invite"] a'); await page.waitForSelector('#sec-friends #joinMake', { timeout: 8000 }); await sleep(1600);
  const inv = await page.evaluate(() => { const r = document.getElementById('joinMake').getBoundingClientRect(); return { hash: location.hash, top: r.top, bottom: r.bottom, ix: [...document.querySelectorAll('#setIndex a')].map(a => a.dataset.sec).includes('friends') }; });
  check('Invite a friend opens Setup at Friends, the invite button on screen (AIG-1357)', inv.hash === '#/setup/friends' && inv.ix && inv.top > 0 && inv.bottom < await page.evaluate(() => innerHeight), inv);
  await page.goto(s.base + '/#/'); await page.waitForSelector('#firstSteps');
  await page.click('#fsHide'); await page.reload(); await page.waitForSelector('a.proj'); await sleep(500);
  check('Hide stays hidden after a refresh', await page.locator('#firstSteps').count() === 0);
  await page.evaluate(() => localStorage.removeItem('aigile.firstSteps')); await page.reload(); await page.waitForSelector('#firstSteps');
  const q = await mkProject(s, 'Steps2', 'STQ'), r = await mkProject(s, 'Steps3', 'STR');
  await page.reload(); await page.waitForSelector('a.proj'); await sleep(500);
  check('a busy board (3 projects) never shows it', await page.locator('#firstSteps').count() === 0);

  // ---- AIG-1271 pasted list
  await page.goto(s.base + '/#/p/' + p.slug); await sleep(800);
  await page.evaluate(() => newCard()); await page.waitForSelector('#f-title');
  const paste = txt => page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text', t); $('f-title').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, txt);
  await paste('single line'); check('one line pastes as usual (no offer)', await page.locator('#nc-multi').count() === 0);
  const list = '- milk\n2) eggs\n\n* [ ] bread\n1. jam\n• tea';
  await paste(list);
  check('a list offers Make 5 cards', /5/.test(await page.textContent('#nc-multi-go')), await page.textContent('#nc-multi').catch(() => ''));
  await page.click('#nc-multi-one');
  check('keep as one: first line is the title, the rest the description', (await page.inputValue('#f-title')) === 'milk' && (await page.inputValue('#f-description')).split('\n').join() === 'eggs,bread,jam,tea');
  await page.evaluate(() => { $('f-title').value = ''; $('f-description').value = ''; });
  await paste(list); await page.click('#nc-multi-go');
  await page.waitForFunction(() => !document.querySelector('#f-title'), null, { timeout: 8000 });
  const titles = (await s.ok('GET', '/api/projects/' + p.slug)).cards.map(c => c.title);
  check('Make 5 cards: five cards with the stripped titles', ['milk', 'eggs', 'bread', 'jam', 'tea'].every(x => titles.includes(x)), titles.join('|'));
  noErrors(page); await page.close();

  await s.ok('PATCH', '/api/projects/' + q.slug, { archived: true }); await s.ok('PATCH', '/api/projects/' + r.slug, { archived: true });
  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 } });
  const pp = await openPage(ph, '#/'); await pp.evaluate(() => { localStorage.removeItem('aigile.firstSteps'); localStorage.setItem('aigile.theme', 'dark'); });
  await pp.reload(); await pp.waitForSelector('#firstSteps');
  check('phone, dark: First steps fits without sideways scroll', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('firstSteps').getBoundingClientRect().right <= innerWidth + 1));
  // AIG-1357, AIG-1365: Setup's Friends section and the New project dialog fit a phone in dark too
  await pp.click('#firstSteps li[data-step="invite"] a'); await pp.waitForSelector('#sec-friends #joinMake', { timeout: 8000 }); await sleep(600);
  check('phone, dark: Setup Friends fits, invite button inside the screen (AIG-1357)', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('joinMake').getBoundingClientRect().right <= innerWidth + 1));
  await pp.evaluate(() => newProject()); await pp.waitForSelector('#p-more'); await pp.evaluate(() => { $('p-more').open = true; $('p-space').open = true; });
  check('phone, dark: New project with everything open fits (AIG-1365)', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('#dialog button, #dialog input, #dialog select')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)));  await pp.close();
}, true);
