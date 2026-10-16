// QA area: touch (AIG-1199): a phone used by finger only (iPhone 13 and Pixel 7, tap() and no mouse): add a card, move it, reply, accept a test, Inbox, Messages, a chat line.
import { BASE, check, sleep, mkProject, mkCard, loadPw, until, def } from '../lib.mjs';

def('touch', 'on a phone, by touch only: add, move, reply, accept, Inbox, Messages and a chat line work; targets are 40px, no sideways scroll, no errors (AIG-1199)', async (s, ctx) => {
  const pw = loadPw();
  await mkProject(s, 'Tunio', 'TUN');
  const cards = async () => (await s.ok('GET', '/api/projects/tunio')).cards;
  for (const dev of ['iPhone 13', 'Pixel 7']) {
    const tag = dev + ': ';
    const c = await ctx.browser().newContext({ ...pw.devices[dev] });
    await c.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    const page = await c.newPage(); page.errors = [];
    page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
    // Small targets (under 38px) and sideways scroll on what is on screen now; the 13px tick boxes sit in a label.
    const look = async what => {
      const r = await page.evaluate(() => {
        const small = [];
        for (const e of document.querySelectorAll('button,a,select,summary,textarea,input:not([type=checkbox]):not([type=radio]):not([type=hidden])')) {
          const b = e.getBoundingClientRect(); if (!b.width || !b.height || b.right < 0 || b.left > innerWidth || b.bottom < 0) continue;
          if (b.height < 38 || b.width < 38 && (e.textContent || '').trim().length < 3) small.push(e.tagName + '.' + (e.id || e.className) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
        }
        return { sx: document.documentElement.scrollWidth - innerWidth, small };
      });
      check(tag + what + ': no sideways scroll', r.sx <= 0, r.sx);
      check(tag + what + ': every target about 40px', r.small.length === 0, r.small.slice(0, 5));
    };
    const title = 'Touch ' + dev.replace(/\W/g, '');
    await page.goto(BASE + '/'); await page.waitForSelector('a.proj'); await look('home');
    await page.tap('a.proj'); await page.waitForSelector('.board'); await look('board');
    await page.tap('.toolbar button:has-text("New")'); await page.waitForSelector('#f-title'); await look('new card');
    const d = await page.evaluate(() => { const r = document.querySelector('.dialog').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    check(tag + 'the new card dialog fits the screen', d);
    await page.tap('#f-title'); await page.fill('#f-title', title);
    await page.tap('.dialog button[type=submit]'); await page.waitForSelector('#f-title', { state: 'detached' });
    check(tag + 'a tapped card is added', !!(await until(async () => (await cards()).find(x => x.title === title))));
    await page.tap(`.card:has-text("${title}")`); await page.waitForSelector('#cm-btn'); await look('open card');
    const was = (await cards()).find(x => x.title === title).status; await page.tap('#cm-btn'); await page.selectOption('#mv-to', { index: 1 });
    check(tag + 'Move to (in the ⋯ menu) moves it with a finger', !!(await until(async () => (await cards()).find(x => x.title === title && x.status !== was))));
    // AIG-1200: a long-press (~500 ms, finger held still) on a board card opens the Move to sheet; a tap still opens the card.
    await page.goto(BASE + '/#/p/tunio'); await page.waitForSelector(`.card:has-text("${title}")`);
    const cdp = await page.context().newCDPSession(page);
    await page.locator(`.card:has-text("${title}")`).first().scrollIntoViewIfNeeded(); const box = await page.locator(`.card:has-text("${title}")`).first().boundingBox();
    const fx = Math.round(box.x + box.width / 2), fy = Math.round(box.y + Math.min(box.height / 2, 30));
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await touch('touchStart', [{ x: fx, y: fy }]); await sleep(150); await touch('touchMove', [{ x: fx, y: fy + 30 }]); await sleep(600); await touch('touchEnd', []);
    await sleep(200);
    check(tag + 'moving the finger before 500 ms does not open the Move to sheet', !(await page.locator('[data-mvcol]').count()));
    await page.goto(BASE + '/#/p/tunio'); await page.waitForSelector(`.card:has-text("${title}")`);
    await page.locator(`.card:has-text("${title}")`).first().scrollIntoViewIfNeeded(); const b2 = await page.locator(`.card:has-text("${title}")`).first().boundingBox(); const gx = Math.round(b2.x + b2.width / 2), gy = Math.round(b2.y + Math.min(b2.height / 2, 30));
    const was2 = (await cards()).find(x => x.title === title).status;
    await touch('touchStart', [{ x: gx, y: gy }]); await sleep(700);
    check(tag + 'a long-press opens the Move to sheet', await page.locator('[data-mvcol]').first().isVisible().catch(() => false));
    if (dev === 'iPhone 13' && process.env.QA_SHOTS) { const sh = process.env.QA_SHOTS; try { await page.screenshot({ path: sh + '/move-sheet.png' }); } catch {} }
    await touch('touchEnd', []); await sleep(100);
    await page.tap('[data-mvcol]');
    check(tag + 'a column in the sheet moves the card', !!(await until(async () => (await cards()).find(x => x.title === title && x.status !== was2))));
    await page.goto(BASE + '/#/p/tunio/' + (await cards()).find(x => x.title === title).id); await page.waitForSelector('[data-ctab=reply]');
    await page.tap('[data-ctab=reply]'); await page.tap('#r-text'); await page.fill('#r-text', 'reply by thumb');
    await page.tap('.reply button.primary');
    check(tag + 'a reply is sent', !!(await until(async () => (await cards()).find(x => x.title === title && x.comments.some(m => m.text === 'reply by thumb')))));
    await page.waitForSelector('.panel', { state: 'detached' });   // the open card closes itself after a reply
    const t = await mkCard(s, 'tunio', 'Test ' + title, { status: 'verify', testSteps: 'Look' });
    await page.goto(BASE + '/#/p/tunio/' + t.id); await page.reload(); await page.waitForSelector('#v-text'); await look('test card');
    await page.tap('button.good:has-text("Accept")');
    check(tag + 'a test card is accepted', !!(await until(async () => (await cards()).find(x => x.id === t.id && x.status === 'done'))));
    await page.goto(BASE + '/#/'); await page.waitForSelector('#dmRail [data-go="#/inbox"]');
    await page.tap('#dmRail [data-go="#/inbox"]'); await page.waitForSelector('.ib-head'); await look('inbox');
    await page.tap('#dmRail [data-dms]'); await page.waitForSelector('.dm-row[data-dm="tunio"]'); await look('messages');
    await page.tap('.dm-row[data-dm="tunio"]'); await page.waitForSelector('#dmText'); await page.tap('#dmText'); await page.fill('#dmText', 'chat by thumb ' + dev.length);
    const inView = await page.evaluate(() => { const r = document.getElementById('dmText').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight - 58; });
    check(tag + 'the chat box sits above the bottom bar', inView);
    await page.tap('.dm-compose button.primary');
    check(tag + 'a chat line is sent', !!(await until(async () => (await page.locator('#dmPanel').innerText()).includes('chat by thumb'))));
    check(tag + 'no page errors', page.errors.length === 0, page.errors);
    await c.close();
  }
}, true);
