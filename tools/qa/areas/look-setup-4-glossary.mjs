// QA areas: glossary, tour, trial, restartpill, pretend, restartqueue (split from look-setup.mjs, AIG-297).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT, BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def, until } from '../lib.mjs';

def('glossary', '📖 dev words explained: searchable glossary page, and tooltips when the switch is on (AIG-102)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Refactor the inbox', { status: 'backlog' });
  const page = await openPage(ctx, '#/glossary');
  await page.waitForSelector('.gloss-item');
  check('the glossary lists the words', (await page.locator('.gloss-item').count()) >= 15 && /Commit/.test(await page.textContent('.gloss-group[data-group=build] .gloss-list')));
  await page.fill('#glossQ', 'branch');
  check('search narrows it down (a handful of the 400+ words)', (await page.locator('.gloss-item[data-id=branch]:not([hidden])').count()) === 1 && (await page.locator('.gloss-item:not([hidden])').count()) < 10);
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  check('no tooltips while the switch is off', (await page.locator('abbr.devw').count()) === 0);
  await page.goto(BASE + '/#/setup'); await page.waitForSelector('#explainWords');
  await page.check('#explainWords');
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  await page.waitForSelector('abbr.devw', { timeout: 5000 }).catch(() => {});
  const tip = await page.getAttribute('abbr.devw', 'title').catch(() => '');
  check('with the switch on, dev words get a plain explanation', !!tip && tip.length > 20, tip);
  check('typing boxes are left alone', (await page.locator('input abbr, textarea abbr').count()) === 0);
  // AIG-1296: service, incident, problem and change words, in groups
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'lang', 'en.json'), 'utf8'));
  await mkCard(s, 'alpha', 'Major incident: the status page shows red after the backup', { status: 'todo' });
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  await page.waitForFunction(() => [...document.querySelectorAll('abbr.devw')].some(a => /status page/i.test(a.textContent)), null, { timeout: 5000 }).catch(() => {});
  const marked = await page.$$eval('abbr.devw', e => e.filter(x => /shows red after/.test(x.parentElement.textContent)).map(x => x.textContent.replace(/\s+/g, ' ').toLowerCase()));
  check('multi-word terms are underlined as one, the longest wins ("Major incident", not just "incident"; "status page")', marked.join() === 'major incident,status page,backup', marked);
  check('...with the plain explanation of the longer term', (await page.$$eval('abbr.devw', e => (e.find(x => /^major\s+incident$/i.test(x.textContent)) || {}).title)) === en['gloss.major.text']);
  // AIG-1335: the newer service words get a tip too
  await mkCard(s, 'alpha', 'Tidy the service desk before the access review', { status: 'todo' });
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  await page.waitForFunction(() => [...document.querySelectorAll('abbr.devw')].some(a => /access review/i.test(a.textContent)), null, { timeout: 5000 }).catch(() => {});
  const svc = await page.$$eval('abbr.devw', e => e.filter(x => /before the/.test(x.parentElement.textContent)).map(x => [x.textContent.replace(/\s+/g, ' ').toLowerCase(), x.title]));
  check('newer service words (service desk, access review) are underlined with their plain explanation', svc.map(x => x[0]).join() === 'service desk,access review' && svc[0][1] === en['gloss.desk.text'] && svc[1][1] === en['gloss.accessreview.text'], svc);
  // AIG-1408: Agile itself, and the new lifecycle words, are underlined too
  await mkCard(s, 'alpha', 'Agile: fix the CI/CD pipeline before the SLA talk', { status: 'todo' });
  await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.board');
  await page.waitForFunction(() => [...document.querySelectorAll('abbr.devw')].some(a => /^agile$/i.test(a.textContent)), null, { timeout: 5000 }).catch(() => {});
  const life = await page.$$eval('abbr.devw', e => e.filter(x => /pipeline before/.test(x.parentElement.textContent)).map(x => [x.textContent.toLowerCase(), x.title]));
  check('AIG-1408: Agile, CI/CD, pipeline and SLA are underlined with their plain explanation', life.map(x => x[0]).join() === 'agile,ci/cd,pipeline,sla' && life[0][1] === en['gloss.agile.text'] && life[1][1] === en['gloss.cicd.text'] && life[3][1] === en['gloss.sla.text'], life.map(x => x[0]));
  await page.goto(BASE + '/#/glossary'); await page.waitForSelector('.gloss-item');
  const g = await page.evaluate(() => ({
    hs: [...document.querySelectorAll('.gloss h2, .gloss h3')].map(h => h.tagName + ':' + h.textContent),
    groups: [...document.querySelectorAll('.gloss-group')].map(x => x.dataset.group),
    loose: document.querySelectorAll('.gloss-item').length - document.querySelectorAll('.gloss-group .gloss-item').length,
    n: document.querySelectorAll('.gloss-item').length,
    labelled: [...document.querySelectorAll('.gloss-group')].every(x => document.getElementById(x.getAttribute('aria-labelledby'))?.tagName === 'H3'),
    status: document.getElementById('glossCount')?.getAttribute('role'),
    count: document.getElementById('glossCount')?.textContent,
  }));
  check('the glossary has 400+ words in eleven groups along a project\'s life (the board words first, AIG-1363, AIG-1408), each under its own h3 after the page h2', g.n >= 400 && g.loose === 0 && g.groups.join() === 'board,idea,plan,agile,build,test,change,run,sec,ai,money' && g.labelled && g.hs[0] === 'H2:' + en['gloss.title'] && g.hs.slice(1).every(h => h.startsWith('H3:')) && g.hs.length === 12, g);
  // AIG-1408: free training from idea to managed service: the core words are in and found by name or abbreviation
  for (const [q, id] of [['Agile', 'agile'], ['Scrum', 'scrum'], ['CI/CD', 'cicd'], ['SLA', 'sla'], ['Hallucination', 'hallucination'], ['continuous integration', 'cicd'], ['service level agreement', 'sla']]) {
    await page.fill('#glossQ', q); await page.dispatchEvent('#glossQ', 'input');
    const ids = await page.$$eval('.gloss-item:not([hidden])', e => e.map(x => x.dataset.id));
    check(`AIG-1408: "${q}" is in the glossary and the search finds it`, ids.includes(id) && en['gloss.' + id + '.text'].length > 20, ids.slice(0, 8));
  }
  await page.fill('#glossQ', ''); await page.dispatchEvent('#glossQ', 'input');
  const board = await page.$$eval('.gloss-group[data-group=board] .gloss-item', e => e.map(x => x.dataset.id + ':' + x.querySelector('dt').textContent));
  check('AIG-1363: the first group explains the board words, card and project first: Lead, Dispatcher, space, playground, hyperfocus, For the team, agent program', board.join() === 'card:Card,project:Project,forteam:For the team,lead:Lead,agentprog:Agent program,dispatcher:Dispatcher,space:Space,playground:Playground,hyperfocus:Hyperfocus', board);
  check('a status line says how many words there are', g.status === 'status' && g.count === g.n + ' words', g);
  for (const id of ['service', 'uptime', 'statuspage', 'incident', 'major', 'problem', 'change', 'risk', 'oncall', 'replyby', 'postmortem', 'backup', 'restore', 'release', 'rollback', 'live', 'swarm', 'peerreview', 'retro', 'dod', 'testpile', 'ci', 'desk', 'svcrequest', 'svcreview', 'accessreview', 'improvements', 'expiry', 'tokencap'])
    if (!(await page.locator(`.gloss-item[data-id="${id}"]`).count())) check('the word ' + id + ' is in the glossary', false);
  await page.focus('#glossQ'); await page.keyboard.type('incident');
  const hit = await page.evaluate(() => ({ ids: [...document.querySelectorAll('.gloss-item:not([hidden])')].map(x => x.dataset.id), groups: [...document.querySelectorAll('.gloss-group:not([hidden])')].map(x => x.dataset.group), count: document.getElementById('glossCount').textContent }));
  check('search runs across every group (typed from the keyboard), empty groups fold away, and the count follows', hit.ids.includes('incident') && hit.ids.includes('major') && hit.ids.includes('postmortem') && !hit.groups.includes('build') && hit.count === hit.ids.length + (hit.ids.length === 1 ? ' word' : ' words'), hit);
  await page.fill('#glossQ', 'production'); await page.dispatchEvent('#glossQ', 'input');
  check('search finds a word by its other names too ("production": Live)', (await page.$$eval('.gloss-item:not([hidden])', e => e.map(x => x.dataset.id))).includes('live'));
  await page.fill('#glossQ', 'zzqx'); await page.dispatchEvent('#glossQ', 'input');
  check('no match: it says so, once on screen and once to screen readers', !(await page.$eval('#glossNone', e => e.hidden)) && (await page.textContent('#glossCount')) === en['gloss.none'] && (await page.$eval('#glossCount', e => e.getBoundingClientRect().width <= 1)));
  const noai = await page.evaluate(() => { NoAi.apply(true); const h = renderGlossary(); NoAi.apply(false); return h; });
  check('No AI mode leaves out the words about AI agents (Agent, Token, Hook, Peer review) and the whole 🤖 AI group (AIG-1408)', !/data-id="(agent|token|hook|peerreview|hallucination|prompt)"/.test(noai) && !/data-group="ai"/.test(noai) && /data-id="incident"/.test(noai) && /data-id="agile"/.test(noai));
  // phone width, dark mode, right to left
  await page.setViewportSize({ width: 390, height: 800 }); await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; $('app').innerHTML = renderGlossary(); });
  const look = await page.evaluate(() => { const h = document.querySelector('.gloss-group h3'), r = document.querySelector('.gloss').getBoundingClientRect(); return { scroll: document.documentElement.scrollWidth <= innerWidth, fits: r.right <= innerWidth + 1 && r.left >= -1, dir: getComputedStyle(h).direction, bg: getComputedStyle(document.body).backgroundColor }; });
  check('phone width (390px), dark, right to left: the glossary fits, no sideways scroll, headings read right to left', look.scroll && look.fits && look.dir === 'rtl' && (look.bg.match(/\d+/g) || []).slice(0, 3).every(n => +n < 80), look);
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  noErrors(page);
}, true);

def('tour', '🎓 guided tour: three levels, eight stops from First steps to Help, keyboard, focus, phone, dark, RTL, No AI (AIG-95, AIG-1299)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('button:has-text("🎓")');
  await page.click('button:has-text("🎓")');
  await page.waitForSelector('.tour-lvl');
  check('three levels to pick from', (await page.locator('.tour-lvl').count()) === 3);
  await page.click('.tour-lvl >> nth=0');   // new to this
  await page.waitForSelector('.tour-bubble');
  check('it starts with a welcome and says how many stops', /Welcome/.test(await page.textContent('.tour-bubble')) && /Stop 1 of 8/.test(await page.textContent('.tour-step')));
  check('new to this also switches the dev words on', (await page.evaluate(() => localStorage.getItem('aigile.explain'))) === '1');
  // AIG-1299: the stops in order, at most eight, the last one pointing at Help.
  check('the stops: welcome, First steps, rail, inbox, For you, Messages, Setup, Help', (await page.evaluate(() => tour.steps.map(s => s.id).join())) === 'welcome,firststeps,rail,inbox,foryou,chat,setup,help', await page.evaluate(() => tour.steps.map(s => s.id).join()));
  const foc = () => page.evaluate(() => { const a = document.activeElement, b = document.querySelector('.tour-bubble'); return { on: a === b, inside: !!b && b.contains(a), name: b && document.getElementById(b.getAttribute('aria-labelledby'))?.textContent, desc: b && b.getAttribute('aria-describedby'), role: b && b.getAttribute('role') }; });
  let f = await foc();
  check('focus moves to the stop\'s text, named by its title for screen readers', f.on && /Welcome/.test(f.name) && f.role === 'dialog' && /tourP/.test(f.desc || ''), f);
  await page.click('.tour-bubble .primary');
  check('the next stop puts a spotlight on First steps', /First steps/.test(await page.textContent('.tour-bubble h3')) && await page.locator('.tour-spot').isVisible());
  check('...and focus moved with it', (await foc()).on && /First steps/.test((await foc()).name));
  await page.keyboard.press('ArrowRight'); await sleep(150);
  check('the right arrow goes on to the rail', /Your projects/.test(await page.textContent('.tour-bubble h3')));
  await page.keyboard.press('ArrowLeft'); await sleep(150);
  check('the left arrow goes back', /First steps/.test(await page.textContent('.tour-bubble h3')));
  for (let k = 0; k < 5; k++) await page.keyboard.press('Tab');
  check('Tab stays inside the bubble', (await foc()).inside);
  await page.focus('.tour-bubble .primary'); await page.keyboard.press('Enter'); await sleep(150);
  check('Enter on Next goes on', /Your projects/.test(await page.textContent('.tour-bubble h3')));
  // A stop with nothing to point at is skipped in the direction you go: Back from the rail past a gone First steps lands on the welcome.
  await page.evaluate(() => { tour.steps[1] = { ...tour.steps[1], sel: '#noSuchThing' }; });
  await page.click('.tour-bubble button:not(.primary):not(.tour-skip)'); await sleep(300);
  check('Back skips a stop that is not on screen and lands on the one before', await page.evaluate(() => tour && tour.i === 0) && /Welcome/.test(await page.textContent('.tour-bubble h3')));
  for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await sleep(300); }   // past the gone First steps: rail, inbox, For you
  await page.waitForFunction(() => /For you/.test(document.querySelector('.tour-bubble h3')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
  check('a board stop opens a board on its own', /#\/p\/alpha/.test(page.url()) && /For you/.test(await page.textContent('.tour-bubble h3')));
  await page.keyboard.press('Escape');
  check('Esc ends it', (await page.locator('#tourLayer').count()) === 0 && await page.evaluate(() => tour === null));
  await page.evaluate(() => startTour('anyway')); await page.waitForSelector('.tour-bubble');
  await page.click('.tour-skip');
  check('Skip ends it', (await page.locator('#tourLayer').count()) === 0);
  await page.evaluate(() => startTour('refresh')); await page.waitForSelector('.tour-bubble');
  check('the quick refresher keeps the main stops only', (await page.evaluate(() => tour.steps.map(s => s.id).join())) === 'welcome,rail,inbox,foryou,chat,help');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/#/'); await page.waitForSelector('#app .space-tree');
  await page.evaluate(() => localStorage.setItem('aigile.firstSteps', 'hide'));
  await page.evaluate(() => startTour('new')); await page.waitForSelector('.tour-bubble');
  check('with First steps hidden the tour leaves that stop out', !(await page.evaluate(() => tour.steps.some(s => s.id === 'firststeps'))) && /Stop 1 of 7/.test(await page.textContent('.tour-step')));
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.removeItem('aigile.firstSteps'));
  // The last stop: ❓ Help, pointing at the Help button, naming the glossary; its button says Done and ends the tour.
  await page.evaluate(() => startTour('anyway')); await page.waitForSelector('.tour-bubble');
  await page.evaluate(() => { tour.i = tour.steps.length - 1; showStop(); }); await sleep(300);
  const hb = await page.evaluate(() => { const r = document.querySelector('#helpBtn').getBoundingClientRect(), s = document.querySelector('.tour-spot').getBoundingClientRect(); return { h: document.querySelector('.tour-bubble h3').textContent, p: document.querySelector('#tourP').textContent, spot: Math.abs(r.left - 6 - s.left) < 2, btn: document.querySelector('.tour-bubble .primary').textContent }; });
  check('the last stop is Help, spotlights the Help button and names the 📖 glossary', /Help/.test(hb.h) && hb.spot && /📖/.test(hb.p) && /Done/.test(hb.btn), hb);
  await page.click('.tour-bubble .primary');
  check('Done ends the tour', (await page.locator('#tourLayer').count()) === 0);
  // Reduced motion: the bubble does not fade in.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => startTour('anyway')); await page.waitForSelector('.tour-bubble');
  check('with reduced motion the bubble keeps still', (await page.evaluate(() => getComputedStyle(document.querySelector('.tour-bubble')).animationName)) === 'none');
  await page.keyboard.press('Escape'); await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Right to left: the right arrow steps back, the left arrow on, and every bubble stays on screen.
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; startTour('anyway'); }); await page.waitForSelector('.tour-bubble');
  await page.keyboard.press('ArrowLeft'); await sleep(200);
  check('right to left: the left arrow goes on', await page.evaluate(() => tour && tour.i === 1));
  const rtlIn = [];
  for (let k = 0; k < 4; k++) { await sleep(250); rtlIn.push(await page.evaluate(() => { const r = document.querySelector('.tour-bubble').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0; })); await page.keyboard.press('ArrowLeft'); }
  check('right to left: every bubble stays on screen', rtlIn.every(Boolean), rtlIn);
  await page.keyboard.press('Escape'); await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  noErrors(page);
  // No AI mode: the welcome and Messages stops speak of you, your team and your friends, not of AI leads.
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  await page.goto(BASE + '/#/'); await page.reload(); await page.waitForSelector('#app .space-tree'); await page.waitForSelector('#dmRail [data-dms]');   // the rail can land after the home page now that the page loads as one bundle (AIG-1393)
  await page.evaluate(() => startTour('new')); await page.waitForSelector('.tour-bubble');
  const welNo = await page.textContent('#tourP');
  await page.evaluate(() => { tour.i = tour.steps.findIndex(s => s.id === 'chat'); showStop(); }); await sleep(400);
  // With no friends, Messages can be absent and the tour correctly skips it. Its No AI copy must still be plain.
  const chatNo = await page.evaluate(() => t('tour.chat.text'));
  check('No AI mode: the welcome says you and your team', /you and your team/.test(welNo), welNo);
  check('No AI mode: Messages speaks of friends only', !!chatNo && /friends/.test(chatNo) && !/lead/i.test(chatNo), chatNo);
  await page.keyboard.press('Escape');
  await s.ok('POST', '/api/setup', { prefs: { noAi: false } });
  noErrors(page);
  // AIG-1201: every stop points at something visible now, on a desktop and on a phone (menus opened by the tour itself).
  for (const [w, h] of [[1280, 800], [390, 800]]) {
    const c = await ctx.browser().newContext({ viewport: { width: w, height: h }, colorScheme: w < 600 ? 'dark' : 'light' });   // the phone run is in dark mode too
    await c.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    const p = await c.newPage();
    await p.goto(BASE + '/#/'); await p.waitForSelector('#app > *');
    await p.evaluate(() => startTour('anyway')); await p.waitForSelector('.tour-bubble');
    const n = await p.evaluate(() => tour.steps.length);
    const seen = [];
    for (let i = 0; i < n; i++) {
      await p.waitForFunction(k => tour && tour.i >= k, i, { timeout: 8000 }).catch(() => {});
      await sleep(250);
      const st = await p.evaluate(() => {
        if (!tour) return null;
        const s = tour.steps[tour.i], bub = document.querySelector('.tour-bubble'), b = bub.getBoundingClientRect();
        const look = { bubbleIn: b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1, bg: getComputedStyle(bub).backgroundColor };
        if (!s.sel) return { id: s.id, ok: true, ...look };
        const e = document.querySelector(s.sel), r = e && e.getBoundingClientRect(), sp = document.querySelector('.tour-spot').getBoundingClientRect();
        const cs = e && getComputedStyle(e);
        const vis = !!e && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
        const cx = r.left + r.width / 2, cy = Math.min(r.top + r.height / 2, innerHeight - 2), top = vis && document.elementFromPoint(cx, cy);
        return { id: s.id, ok: vis && !!top && (e === top || e.contains(top) || top.contains(e)) && sp.width > 0 && sp.height > 0, ...look };
      });
      if (!st) break;
      seen.push(st.id);
      check(`tour stop "${st.id}" points at a visible target at ${w}px`, st.ok, st);
      check(`tour stop "${st.id}": the bubble fits on screen at ${w}px`, st.bubbleIn, st);
      if (w < 600) check(`tour stop "${st.id}": the bubble is dark in dark mode`, (m => !!m && (+m[1] + +m[2] + +m[3]) < 200)(/rgba?\((\d+), (\d+), (\d+)/.exec(st.bg)), st.bg);
      await p.click('.tour-bubble .primary').catch(() => {});
    }
    check(`the tour at ${w}px keeps its main stops`, ['welcome', 'firststeps', 'rail', 'inbox', 'foryou', 'chat', 'setup', 'help'].every(x => seen.includes(x)), seen);
    check(`...and closes the More menu when done at ${w}px`, await p.evaluate(() => { const m = document.getElementById('tbMoreMenu'); return !m || m.hidden; }));
    await c.close();
  }
}, true);

def('trial', '🧪 try it as a new user: a fresh empty board with made-up projects on its own port (AIG-201..203)', async (s, ctx) => {
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#trialBtn');
  const popP = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await page.click('#trialBtn');
  const pop = await popP;
  check('the button opens the fresh board in a new window', !!pop && /localhost:4400/.test(pop.url()), pop && pop.url());
  const meta = await (await fetch('http://127.0.0.1:4400/api/meta')).json();
  check('it is a first run: Setup needed, no projects', meta.setupNeeded === true && (await (await fetch('http://127.0.0.1:4400/api/projects')).json()).length === 0, meta);
  const found = await (await fetch('http://127.0.0.1:4400/api/discover', { headers: { 'Content-Type': 'application/json' } })).json().catch(() => null);
  check('Find my projects finds the three made-up projects, nothing real', Array.isArray(found) && found.length === 3 && found.some(f => f.name === 'Pancake Shop'), found && found.map ? found.map(f => f.name) : found);
  check('the real board is untouched', (await s.ok('GET', '/api/projects')).length === 0);
  await s.api('DELETE', '/api/trial');
  await sleep(500);
  check('stopping it frees the port', await fetch('http://127.0.0.1:4400/api/meta').then(() => false).catch(() => true));
  noErrors(page);
}, true);

def('restartpill', '🔄 new server code shows a Restart the board pill; it asks the server to restart (AIG-206)', async (s, ctx) => {
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#upRestart', { state: 'attached' });
  check('no pill while the server is up to date', (await page.locator('#upRestart button').count()) === 0);
  const f = path.join(ROOT, 'lib', 'store.js'), t = new Date();
  fs.utimesSync(f, t, t);   // server code changed after the server started
  check('meta says the server is stale', await until(async () => (await s.ok('GET', '/api/meta')).stale === true, 16000));   // outside dev the server rescans on an ask after 10 s of quiet (AIG-1090)
  await page.waitForSelector('#upRestart button', { timeout: 10000 });
  // AIG-295: one pill only, and in the desktop app it is clickable, not part of the draggable title bar.
  check('the pill has one place on the page', (await page.locator('#upRestart').count()) === 1);
  // AIG-346: it says Restart the app, and no Refresh pill shows next to it (the restart reloads the page anyway).
  check('the pill says Restart the app', /Restart the app/.test(await page.textContent('#upRestart')));
  check('no Refresh pill beside it', (await page.locator('#upRefresh button').count()) === 0);
  const region = await page.evaluate(() => { document.body.classList.add('desktop'); const st = getComputedStyle(document.querySelector('#upRestart button')); const r = st.webkitAppRegion || st.getPropertyValue('-webkit-app-region'); document.body.classList.remove('desktop'); return r; });
  check('in the app the pill is clickable (no-drag)', region === 'no-drag', region);
  page.once('dialog', d => d.accept());
  await page.click('#upRestart button');
  await sleep(400);
  check('clicking it asks for a restart (switched off in tests)', /Restarting/.test(await page.textContent('#upRestart')));
  noErrors(page);
}, true, { AIGILE_NO_RESTART: '1' });

def('pretend', '🧪 the trial\'s pretend team: fills a new project, answers an idea with a plan, hands work over after Go (AIG-205)', async (s) => {
  const T = 'http://127.0.0.1:4400', H = { 'Content-Type': 'application/json' };
  const tj = async (m, u, b) => (await fetch(T + u, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined })).json();
  const until = async (fn, ms = 20000) => { for (let t = Date.now(); Date.now() - t < ms; await sleep(400)) { const v = await fn(); if (v) return v; } return null; };
  const trial = await s.ok('POST', '/api/trial');
  await tj('POST', '/api/projects', { name: 'Pancake Shop', key: 'PAN', path: path.join(trial.projects, 'Pancake Shop') });
  await tj('POST', '/api/projects/pancake-shop/wake');
  const seeded = await until(async () => { const p = await tj('GET', '/api/projects/pancake-shop'); return (p.team || []).some(m => m.name === 'Lead (pretend)') && p.cards.some(c => c.status === 'verify') && p; });
  check('a new project gets a pretend lead and cards in every column, one to test', !!seeded && seeded.cards.length >= 5);
  const who = (await tj('GET', '/api/meta')).owner;   // a fresh trial board has the default owner name, not the real owner's
  const idea = await tj('POST', '/api/projects/pancake-shop/cards', { title: '💬 Gift cards', description: 'Gift cards', status: 'team', type: 'task', quick: true, createdBy: who });
  const planned = await until(async () => { const c = (await tj('GET', '/api/projects/pancake-shop')).cards.find(x => x.id === idea.id); return c && c.comments.some(m => /GO\?/.test(m.text)) && c; });
  check('an idea gets two cards and a plan with GO?', !!planned && planned.needsYou === true);
  const before = seeded.cards.filter(c => c.status === 'verify').length;
  await tj('POST', `/api/projects/pancake-shop/cards/${idea.id}/comments`, { author: who, text: 'GO' });
  const built = await until(async () => { const p = await tj('GET', '/api/projects/pancake-shop'); return p.cards.filter(c => c.status === 'verify').length > before && p; });
  check('after Go, the first card lands in For you with test steps', !!built && built.cards.some(c => c.status === 'verify' && /Gift cards/.test(c.title) && c.testSteps));
  // AIG-488: with the owner's language on nl, a fresh trial has Dutch projects and a Dutch pretend team
  await s.ok('POST', '/api/setup', { prefs: { lang: 'nl' } });
  const nlTrial = await s.ok('POST', '/api/trial');
  const names = fs.readdirSync(nlTrial.projects).sort();
  check('the made-up projects are named in Dutch', names.join() === 'Bandwebsite,Pannenkoekenwinkel,Tuinplanner' && /Een webwinkel voor pannenkoekenmix/.test(fs.readFileSync(path.join(nlTrial.projects, 'Pannenkoekenwinkel', 'README.md'), 'utf8')), names);
  await tj('POST', '/api/projects', { name: 'Pannenkoekenwinkel', key: 'PAN', path: path.join(nlTrial.projects, 'Pannenkoekenwinkel') });
  await tj('POST', '/api/projects/pannenkoekenwinkel/wake');
  const nlSeed = await until(async () => { const p = await tj('GET', '/api/projects/pannenkoekenwinkel'); return (p.team || []).some(m => m.name === 'Lead (pretend)') && p.cards.some(c => c.status === 'verify') && p; });
  check('and the pretend team makes Dutch cards', !!nlSeed && nlSeed.cards.some(c => c.title === 'Donkere modus') && nlSeed.cards.some(c => c.title === 'Een contactpagina' && /Open de pagina \*\*Contact\*\*/.test(c.testSteps)), nlSeed && nlSeed.cards.map(c => c.title));
  await s.ok('POST', '/api/setup', { prefs: { lang: 'en' } });
  await s.api('DELETE', '/api/trial');
}, false);

def('restartqueue', '🔄 restart while a team is busy: it restarts straight away (AIG-214)', async (s) => {
  await mkProject(s, 'Busy', 'BSY', { path: tmp('busy') });
  await s.ok('POST', '/api/projects/busy/wake');
  const r = await s.ok('POST', '/api/restart');
  check('it restarts straight away, even with a busy team (no queue)', r.ok === true && !r.queued && !r.waitingFor, r);
}, false, { AIGILE_NO_RESTART: '1' });

def('tourproject', 'tour returns to its starting project (AIG-1417)', async (s, ctx) => {
  await mkProject(s, 'First', 'FIR'); await mkProject(s, 'Garden', 'GAR');
  const page = await openPage(ctx, '#/p/garden'); await page.waitForSelector('.board');
  await page.evaluate(() => startTour('new'));
  for(let n=0;n<8;n++) { if(await page.getAttribute('.tour-bubble','data-stop') === 'foryou') break; await page.click('.tour-bubble .primary'); await sleep(350); }
  check('For you is on the original project (AIG-1417)', await page.evaluate(() => location.hash === '#/p/garden' && document.querySelector('.tour-bubble').dataset.stop === 'foryou'));
  await page.screenshot({path:'C:/Users/rich/AppData/Local/Temp/claude/c--Users-rich-Desktop-Bots--n--Code-Stuff-AI-gile/3ae79815-0113-49a9-aff9-9783dd343aa6/scratchpad/shots/AIG-1417.png'});
}, true);
