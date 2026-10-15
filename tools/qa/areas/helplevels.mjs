// QA area: helplevels (AIG-345, AIG-328), help levels, the ❓ Help menu and the Agile intro slides.
import path from 'node:path';
import { BASE, tmp, check, sleep, openPage, noErrors, def } from '../lib.mjs';

def('helplevels', '❓ help levels: each level\'s first run, the Help menu, the Agile intro slides (also in Flemish), the demo window, quick wizard consistency (AIG-345, AIG-328)', async (s, ctx) => {
  const setup = async () => await s.ok('GET', '/api/setup');
  const fresh = async (lang) => {
    const c = await ctx.browser().newContext({ viewport: { width: 1400, height: 900 } });
    if (lang) await c.addInitScript(l => { try { localStorage.setItem('aigile.lang', l); } catch {} }, lang);
    return c;
  };
  const offer = async page => { await page.evaluate(() => { localStorage.removeItem('aigile.helpOffered'); return helpMaybe(); }); await sleep(500); };

  // Some help (the default): after "I'll wing it" the tour is offered once, nothing else.
  check('the default is some help (nothing saved yet)', !(await setup()).prefs.helpLevel);
  let page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#wzNo');
  await page.click('#wzNo');
  await sleep(500);
  check('first run (Just let me in): no second popup', (await page.locator('#helpNo, #helpGoTour').count()) === 0);
  await offer(page);
  check('some help: the tour is offered', await page.isVisible('#helpGoTour'));
  check('some help: no intro or demo button in the offer', (await page.locator('#helpGoIntro, #helpGoDemo').count()) === 0);
  await page.click('#helpNo');
  await page.reload(); await page.waitForSelector('#setupForm'); await sleep(600);
  check('the offer is made once', (await page.locator('#helpNo').count()) === 0);
  await offer(page);
  check('...and not again by itself', (await page.locator('#helpNo').count()) === 1);
  await page.click('#helpNo');
  await s.ok('POST', '/api/setup', { owner: 'Sam' });

  // Help menu: everything is there, whatever the level.
  await page.goto(BASE + '/#/'); await page.waitForSelector('#helpBtn');
  await page.click('#helpBtn');
  await page.waitForSelector('#helpMenu');
  check('Help menu has the intro, tour, demo and glossary', (await page.locator('#hmIntro, #hmTour, #hmDemo, #hmGloss').count()) === 4);
  check('Help menu has the three levels, some help ticked', (await page.locator('#helpMenu [id^=hmLevel]').count()) === 3 && await page.locator('#hmLevel2.on').count() === 1);
  await page.click('#hmTour');
  await page.waitForSelector('.tour-lvl');
  check('Help > the tour opens it', (await page.locator('.tour-lvl').count()) === 3);
  await page.click('.dialog .actions button');
  await page.click('#helpBtn'); await page.click('#hmGloss');
  await page.waitForSelector('.gloss-item');
  check('Help > glossary opens it', page.url().endsWith('#/glossary'));

  // Intro slides in English.
  await page.goto(BASE + '/#/'); await page.waitForSelector('#helpBtn');
  await page.click('#helpBtn'); await page.click('#hmIntro');
  await page.waitForSelector('#introSlide');
  check('intro: first slide, one of eight', /1 of 8/.test(await page.textContent('#introStep')) && /small steps/i.test(await page.textContent('#introSlide')));
  check('intro: no Back on the first slide', (await page.locator('#introBack').count()) === 0);
  await page.click('#introNext');
  check('intro: Next shows slide 2 (lists and the italic note render)', /2 of 8/.test(await page.textContent('#introStep')) && (await page.locator('#introSlide li').count()) >= 2 && (await page.locator('#introSlide em').count()) === 1);
  await page.click('#introBack');
  check('intro: Back returns', /1 of 8/.test(await page.textContent('#introStep')));
  await page.keyboard.press('ArrowRight');
  check('intro: arrow keys move too', /2 of 8/.test(await page.textContent('#introStep')));
  await page.keyboard.press('Escape');
  check('intro: Esc closes', (await page.locator('#introSlide').count()) === 0);
  await page.click('#helpBtn'); await page.click('#hmIntro'); await page.waitForSelector('#introSlide');
  for (let i = 0; i < 7; i++) await page.click('#introNext');
  check('intro: the last slide ends with Done', /8 of 8/.test(await page.textContent('#introStep')) && (await page.textContent('#introNext')) === 'Done');
  await page.click('#introNext');
  check('intro: Done closes it', (await page.locator('#introSlide').count()) === 0);

  // The level switch in the menu: all the help turns the word tooltips on, no help turns them off.
  await page.click('#helpBtn'); await page.click('#hmLevel1');
  await sleep(300);
  check('switch to all the help: saved and word tips on', (await setup()).prefs.helpLevel === '1' && (await page.evaluate(() => localStorage.getItem('aigile.explain'))) === '1');
  await page.click('#helpBtn');
  await page.waitForSelector('#helpMenu');
  check('the menu now ticks all the help', await page.locator('#hmLevel1.on').count() === 1);
  await page.click('#hmLevel3'); await sleep(300);
  check('switch to no help: saved and word tips off', (await setup()).prefs.helpLevel === '3' && (await page.evaluate(() => localStorage.getItem('aigile.explain'))) === null);

  // No help: nothing pops up.
  await offer(page);
  check('no help: nothing pops up', (await page.locator('#dialog .dialog').count()) === 0);

  // All the help: intro, tour and demo on offer, word tips on.
  await s.ok('POST', '/api/setup', { prefs: { helpLevel: '1' } });
  let c1 = await fresh();
  let p1 = await openPage(c1, '#/');
  await p1.waitForSelector('#helpBtn'); await sleep(500);
  await offer(p1);
  check('all the help: intro, tour and demo are offered', (await p1.locator('#helpGoIntro, #helpGoTour, #helpGoDemo').count()) === 3);
  check('all the help: dev word tips are on', (await p1.evaluate(() => localStorage.getItem('aigile.explain'))) === '1');
  await p1.click('#helpGoIntro');
  await p1.waitForSelector('#introSlide');
  check('the offer opens the Agile intro', /1 of 8/.test(await p1.textContent('#introStep')));
  // Demo mode: with all the help the new window gets the intro and the language; without, a plain address.
  await p1.keyboard.press('Escape');
  await p1.route('**/api/trial', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"http://127.0.0.1:9/"}' }));
  await p1.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); }; });
  await p1.click('#helpBtn'); await p1.click('#hmDemo'); await sleep(500);
  const o1 = await p1.evaluate(() => window.__opened);
  check('demo mode with all the help starts with the intro', o1.length === 1 && /[?&]intro=1(&|$)/.test(o1[0]) && /[?&]lang=en(&|$)/.test(o1[0]), o1);   // ?lang= too since AIG-488
  await s.ok('POST', '/api/setup', { prefs: { helpLevel: '2' } });
  await p1.click('#helpBtn'); await sleep(300); await p1.keyboard.press('Escape');   // the menu re-reads the level
  await p1.click('#helpBtn'); await p1.click('#hmDemo'); await sleep(500);
  const o2 = await p1.evaluate(() => window.__opened);
  check('demo mode with some help is a plain window', o2.length === 2 && o2[1] === 'http://127.0.0.1:9/?lang=en', o2);   // no intro; the language still goes along (AIG-488)
  await p1.evaluate(() => { window.open = () => null; });   // a blocked window says so (AIG-1084)
  await p1.click('#helpBtn'); await p1.click('#hmDemo');
  await p1.waitForSelector('#trialNote', { timeout: 4000 }).catch(() => {});
  check('a blocked demo window says so in the page', /blocked/i.test(await p1.textContent('#trialNote').catch(() => '')));
  await p1.click('#helpBtn');
  check('Help menu starts with Getting started, which opens a short list', (await p1.locator('#helpMenu button').first().getAttribute('id')) === 'hmStart');
  await p1.click('#hmStart');
  check('Getting started lists four steps', (await p1.locator('#gettingStarted li').count()) === 4);
  // 🛎️ Service management guide (AIG-1158): each level opens by the Help level, Show more adds the next.
  await p1.keyboard.press('Escape');
  const svc = async () => { await p1.click('#helpBtn'); await p1.click('#hmService'); await p1.waitForSelector('#svcGuide h3'); return p1.textContent('#svcGuide'); };
  let g = await svc();
  check('service guide, some help: opens on Step by step, no raw front matter', /Step by step/.test(g) && /Open the project/.test(g) && !/^---/.test(g) && (await p1.locator('#svcAgents').count()) === 1);
  await p1.click('#svcMore');
  g = await p1.textContent('#svcGuide');
  check('service guide: Show more gives the Full course and hides the button', /Full course/.test(g) && /Uptime dot/.test(g) && await p1.locator('#svcMore').isHidden());
  check('service guide: the command line sits in the agents fold', /For agents [(]command line[)]/.test(await p1.textContent('#svcAgents summary')) && /aigile/.test(await p1.textContent('#svcAgents')));
  await p1.keyboard.press('Escape');
  await s.ok('POST', '/api/setup', { prefs: { helpLevel: '3' } });
  await p1.click('#helpBtn'); await sleep(300); await p1.keyboard.press('Escape');
  g = await svc();
  check('service guide, no help: Highlights, five lines, no fold', /Highlights/.test(g) && (await p1.locator('#svcGuide li').count()) === 5 && (await p1.locator('#svcAgents').count()) === 0);
  await p1.keyboard.press('Escape');
  await s.ok('POST', '/api/setup', { prefs: { helpLevel: '1' } });
  await p1.click('#helpBtn'); await sleep(300); await p1.keyboard.press('Escape');
  g = await svc();
  check('service guide, all the help: opens on the Full course', /Full course/.test(g) && await p1.locator('#svcMore').isHidden());
  await p1.keyboard.press('Escape');
  await s.ok('POST', '/api/setup', { prefs: { helpLevel: '2' } });   // back to some help for what follows
  noErrors(p1);
  await c1.close();

  // The demo window itself: ?intro=1&lang=nl-BE opens the Flemish intro by itself.
  const c2 = await fresh();
  const p2 = await openPage(c2, '?intro=1&lang=nl-BE');
  await p2.waitForSelector('#introSlide', { timeout: 8000 });
  check('demo window: the intro opens by itself, in Flemish', /Dia 1 van 8/.test(await p2.textContent('#introStep')) && /kleine stappen/i.test(await p2.textContent('#introSlide')), await p2.textContent('#introSlide'));
  check('...and the address is tidied', !p2.url().includes('intro=1'));
  await p2.keyboard.press('Escape');

  // Flemish: the menu and the slides.
  const c3 = await fresh('nl-BE');
  const p3 = await openPage(c3, '#/');
  await p3.waitForSelector('#helpBtn');
  check('Flemish: the button says Hulp', /Hulp/.test(await p3.textContent('#helpBtn')));
  await p3.click('#helpBtn');
  check('Flemish: menu items', /Agile in 2 minuten/.test(await p3.textContent('#hmIntro')) && /rondleiding/i.test(await p3.textContent('#hmTour')) && /Hoeveel hulp/.test(await p3.textContent('#helpMenu')));
  await p3.click('#hmIntro'); await p3.waitForSelector('#introSlide');
  check('Flemish: slide 1 of 8', /Dia 1 van 8/.test(await p3.textContent('#introStep')));
  await p3.click('#introNext');
  check('Flemish: the second slide is the columns', /Dia 2 van 8/.test(await p3.textContent('#introStep')) && /kolom|Backlog/i.test(await p3.textContent('#introSlide')));
  await p3.keyboard.press('Escape');
  noErrors(p3);
  await c3.close(); await c2.close();

  // Quick wizard and the advanced help screen agree on the same levels.
  const c4 = await fresh();
  const p4 = await openPage(c4, '#/setup');
  await p4.waitForSelector('#wzRun'); await sleep(400);
  await p4.click('#wzRun'); await p4.waitForSelector('.wz-dots');
  await p4.click('#wzNext'); await p4.waitForSelector('#wz-name'); await p4.click('#wzNext'); await p4.waitForSelector('[name=wz-style]');
  check('quick wizard: help level on the style screen, current level ticked', (await p4.locator('[name=wz-help]').count()) === 3 && await p4.isChecked('[name=wz-help][value="2"]'));
  await p4.check('[name=wz-help][value="3"]');
  await p4.click('#wzNext'); await p4.waitForSelector('[name=wz-plan]'); await p4.click('#wzNext'); await p4.waitForSelector('#wzDone');
  check('quick wizard: the level is saved', (await setup()).prefs.helpLevel === '3');
  await p4.click('#wzDone'); await sleep(300);
  await p4.click('#wzRun'); await p4.waitForSelector('#wzAdv'); await p4.click('#wzAdv');
  for (let i = 0; i < 6; i++) { await p4.click('#wzNext'); await sleep(250); }
  await p4.waitForSelector('[name=wa-help]');
  check('advanced wizard: same three levels, same words, current one ticked', await p4.isChecked('[name=wa-help][value="3"]') && /No help/.test(await p4.textContent('#wa-body')) && /All the help/.test(await p4.textContent('#wa-body')));
  await p4.check('[name=wa-help][value="1"]'); await p4.click('#wzNext'); await sleep(400);
  check('advanced wizard: choosing all the help saves it and turns word tips on', (await setup()).prefs.helpLevel === '1' && (await p4.evaluate(() => localStorage.getItem('aigile.explain'))) === '1');
  noErrors(p4);
  await c4.close();
}, true, { AIGILE_OWNER: '', AIGILE_LOCAL: path.join(tmp('helplevels'), 'aigile.local.json') });
