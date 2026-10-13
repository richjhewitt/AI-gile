// QA area: homeux (AIG-937, AIG-940). Home cards show % done and only the non-zero counts; the toolbar is one + New project button and
// a More menu holding the rest; the usage strip is hidden without a reading. First run: one dialog on a blank page with Wizard, Tour and
// Just let me in, each leading where the old flow led, and no second popup.
import path from 'node:path';
import { check, sleep, tmp, openPage, noErrors, mkProject, mkCard, def } from '../lib.mjs';

def('homeux', 'Home: counts hide zeros and show % done, More holds the moved buttons, no empty usage strip; first run is one dialog with three choices that each work (AIG-937, AIG-940)', async (s, ctx) => {
  const setup = () => s.ok('GET', '/api/setup');
  check('fresh data: a first run', (await setup()).needed === true && (await setup()).prefs.wizardSeen === false);

  const shot = async (pg, f) => { if (process.env.QA_SHOTS) await pg.screenshot({ path: process.env.QA_SHOTS + '/' + f }); };
  // ---- first run (AIG-940)
  const choose = async () => {
    await s.ok('POST', '/api/setup', { prefs: { wizardSeen: false } });
    const pg = await openPage(ctx, '#/setup');
    await pg.waitForSelector('#wzYes');
    return pg;
  };
  let page = await choose();
  check('one dialog with three choices', (await page.locator('#dialog .wz-choice').count()) === 3 && await page.isVisible('#wzYes') && await page.isVisible('#wzTour') && await page.isVisible('#wzNo'));
  check('the page behind is blank (an opaque backdrop)', await page.evaluate(() => { const o = document.querySelector('#dialog .overlay'); const c = getComputedStyle(o).backgroundColor; return !c.includes("0.35") && o.getBoundingClientRect().width >= innerWidth - 1; }));
  check('the choices are named Wizard, Tour and Just let me in', /Wizard/.test(await page.textContent('#wzYes')) && /Tour/.test(await page.textContent('#wzTour')) && /Just let me in/.test(await page.textContent('#wzNo')));
  await shot(page, 'shot-firstrun-desk.png');
  await page.click('#wzYes'); await page.waitForSelector('.wz-dots');
  check('Wizard opens the wizard', (await page.locator('.wz-dot').count()) === 5);
  await page.evaluate(() => closeDialog()); await sleep(600);
  check('closing it any other way still shows the page', await page.isVisible('#setupForm') && (await page.locator('#dialog > *').count()) === 0);
  await page.close();

  page = await choose();
  await page.click('#wzTour');
  await page.waitForSelector('#tourLayer, .tour-bubble, #tourBox', { timeout: 5000 }).catch(() => {});
  check('Tour starts the tour', await page.evaluate(() => typeof tour !== 'undefined' && !!tour));
  check('Tour: no second popup and the answer is saved', (await page.locator('#helpNo, #helpGoTour, #wzYes').count()) === 0 && (await setup()).prefs.wizardSeen === true);
  await page.close();

  page = await choose();
  await page.click("#wzNo"); await sleep(1500);
  check('Just let me in: Setup shows, no dialog and no second popup', await page.isVisible('#setupForm') && (await page.locator('#dialog .dialog, #dialog > *').count()) === 0 && (await setup()).prefs.wizardSeen === true, [await page.isVisible("#setupForm"), await page.locator("#dialog > *").count(), (await setup()).prefs.wizardSeen].join());
  await page.reload(); await page.waitForSelector('#setupForm'); await sleep(500);
  check('it does not come back', (await page.locator('#wzYes').count()) === 0);
  noErrors(page); await page.close();

  // ---- home (AIG-937)
  await s.ok('POST', '/api/setup', { owner: 'Rich', 'agent.command': 'echo', 'agent.notesFile': 'CLAUDE.md', 'agent.settingsFile': '.claude/settings.json' });   // set up: home, not Setup
  const al = await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, al.slug, 'One', { status: 'doing' });
  await mkCard(s, al.slug, 'Two', { status: 'done' });
  openPage.homeMore = true;
  try { page = await openPage(ctx, '#/'); } finally { openPage.homeMore = false; }
  await page.evaluate(() => localStorage.removeItem('aigile.homeMoreOpen')); await page.reload();   // leave the More menu as a user finds it: closed
  await page.waitForSelector('a.proj .counts');
  const counts = await page.$$eval('a.proj .counts span', e => e.map(x => x.textContent.trim()));
  check('counts show no zero columns', counts.length > 0 && counts.every(x => !/\b0$/.test(x)), counts.join('|'));
  check('the card says % done', /\d+%/.test(await page.textContent('a.proj .counts b')));
  const vis = await page.$$eval('.toolbar > button', b => b.filter(x => x.getClientRects().length).map(x => x.id || x.className));
  check('the toolbar shows New project and More only', vis.length === 2 && vis.includes('homeMoreBtn'), vis.join());
  check('More starts closed', await page.locator('#homeMenu').isHidden());
  await page.click('#homeMoreBtn');
  check('More opens', await page.locator('#homeMenu').isVisible() && (await page.getAttribute('#homeMoreBtn', 'aria-expanded')) === 'true');
  const moved = ['refactorOffer', 'newProject({ space', 'openFileDialog', 'findProjectsDialog', 'tourDialog', 'goQuiet', 'callStandup', 'Break.menu', "Break.start('shower')", 'MyDay.open'];
  const have = await page.$$eval('#homeMenu button', b => b.map(x => x.getAttribute('onclick')));
  check('More holds the moved buttons', moved.every(m => have.some(h => h.includes(m))), have.join('|'));
  check('More holds the Today, Life and Stand-ups links', (await page.locator('#homeMenu a.navlink').count()) === 3);
  await page.click('#homeMenu [onclick^="tourDialog"]');
  check('a button in More works (the Tour dialog opens)', await page.isVisible('.tour-lvls'));
  await page.evaluate(() => closeDialog());
  await page.click('#homeMoreBtn');
  check('More closes again', await page.locator('#homeMenu').isHidden());
  check('no usage strip without a reading', await page.locator('#homeUsage:visible').count() === 0);
  // With a reading, the strip shows the same % left as the Usage page.
  const resets = Math.floor(Date.now() / 1000) + 3600;
  await s.ok('POST', '/api/limits', { rate_limits: { five_hour: { used_percentage: 42, resets_at: resets }, seven_day: { used_percentage: 61, resets_at: resets + 86400 } } });
  await page.evaluate(() => UsageGlance.poll()); await sleep(2500);
  check('with a reading the strip shows 58% and 39% left', /58% left/.test(await page.textContent('#homeUsage')) && /39% left/.test(await page.textContent('#homeUsage')), await page.textContent('#homeUsage'));
  await page.click('#homeMoreBtn'); await shot(page, 'shot-home-desk.png');
  noErrors(page);

  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 } });
  openPage.homeMore = true;
  let pp; try { pp = await openPage(ph, '#/'); } finally { openPage.homeMore = false; }
  await pp.waitForSelector('a.proj');
  check('phone: no sideways scroll', await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await pp.click('#homeMoreBtn');
  check('phone: More opens and fits', await pp.evaluate(() => { const r = document.getElementById('homeMenu').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await pp.evaluate(() => { document.documentElement.dataset.theme = 'dark'; try { localStorage.setItem('aigile.theme', 'dark'); } catch {} }); await sleep(300); await shot(pp, 'shot-home-phone-dark.png');
  noErrors(pp);
}, true, { AIGILE_LOCAL: path.join(tmp('homeux'), 'aigile.local.json') });
