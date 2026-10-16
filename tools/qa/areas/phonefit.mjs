// QA area: phonefit (AIG-1391..1399). Phone fixes checked upright (390x844) and on its side (844x390), with touch.
// QA_SHOTS=<folder> saves a screenshot of each fixed screen as <card>.png (upright) and <card>-landscape.png.
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, openPage, BASE, def } from '../lib.mjs';
import { stubLivekit } from './calls.mjs';

const SIZES = [{ name: '390x844', viewport: { width: 390, height: 844 } }, { name: '844x390', viewport: { width: 844, height: 390 }, land: true }];
const shot = async (page, card, size) => { if (process.env.QA_SHOTS) await page.screenshot({ path: path.join(process.env.QA_SHOTS, card + (size.land ? '-landscape' : '') + '.png') }); };

def('phonefit', '📱 phone fixes upright and on its side (390x844, 844x390): labels, layout, pills, call panel, Setup, tap targets (AIG-1391..1399)', async (s, ctx0) => {
  const browser = ctx0.browser();
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('alpha'), team: true });
  await mkCard(s, 'alpha', 'Tidy the settings page', { status: 'backlog' });
  await mkCard(s, 'alpha', 'Check the login page', { status: 'verify', testSteps: '1. Open it' });
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const D = size.name;
    try {
      /* ---------- AIG-1396: top bar tick boxes read "Show Help" ---------- */
      const page = await openPage(ctx, '#/setup');
      await page.waitForSelector('#tbList .tb-row', { timeout: 10000 });
      const al = await page.evaluate(() => [...document.querySelectorAll('#tbList .tb-on, #tbList .tb-up, #tbList .tb-down')].map(e => e.getAttribute('aria-label')));
      check(D + ': Setup top bar tick boxes read "Show Help", no {brackets} (AIG-1396)', al.length > 30 && al.includes('Show Help') && al.every(a => a && !/[{}]/.test(a)), al.filter(a => !a || /[{}]/.test(a)).slice(0, 3));
      await page.evaluate(() => document.getElementById('tbList').scrollIntoView({ block: 'start' }));
      await sleep(200); await shot(page, 'AIG-1396', size);

      /* ---------- AIG-1395: Setup's top bar box on a phone ---------- */
      const su = await page.evaluate(() => {
        const r = e => e.getBoundingClientRect(), shown = e => !!e && r(e).width > 0 && r(e).height > 0;
        const ticks = [...document.querySelectorAll('#tbList .tb-on')].map(e => ({ w: r(e).width, lab: r(e.closest('label')).height }));
        const dots = [...document.querySelectorAll('#tbList .tb-sw')].map(e => ({ w: r(e).width, h: r(e).height, br: getComputedStyle(e).borderRadius }));
        const arrows = [...document.querySelectorAll('#tbList .tb-up, #tbList .tb-down')].map(e => ({ w: r(e).width, h: r(e).height }));
        const vis = q => [...document.querySelectorAll(q)].some(shown);
        return { tick: ticks.every(x => x.w >= 22 && x.lab >= 43.5), dot: dots.every(x => x.w >= 43.5 && Math.abs(x.w - x.h) < 1 && x.br === '50%'), arrow: arrows.every(x => x.w >= 43.5 && x.h >= 43.5),
          side: vis('#topbarBox .tb-side'), pins: vis('#tbPins'), note: shown(document.getElementById('tbPhoneNote')),
          intro: [...document.querySelectorAll('.setup > p.muted span')].filter(shown).map(e => e.textContent).join('|'), theme: [...document.querySelectorAll('#sec-look .on-phone, #sec-look .off-phone')].filter(shown).map(e => e.textContent).join('|'),
          d0: dots[0], t0: ticks[0], a0: arrows[0] };
      });
      check(D + ': Setup top bar: tick boxes 22px+ in a 44px row, round 44px colour dots, 44px arrows (AIG-1395)', su.tick && su.dot && su.arrow, su);
      check(D + ': Left/Right and Show in top bar are hidden, a note says the bar is Inbox and ☰ on a phone', !su.side && !su.pins && su.note, su);
      check(D + ': the Setup intro and theme help talk about the phone, not "this computer"', /computer it runs on/.test(su.intro) && !/settings on this computer/.test(su.intro) && /☰ menu/.test(su.theme) && !/🖥️ button/.test(su.theme), su);
      await page.evaluate(() => { document.getElementById('topbarBox').scrollIntoView({ block: 'start' }); scrollBy(0, -70); }); await sleep(200);
      await shot(page, 'AIG-1395', size);
      await page.close();

      /* ---------- AIG-1391: a phone on its side keeps the phone layout ---------- */
      const bp = await openPage(ctx, '#/p/alpha');
      await bp.waitForSelector('.board .card', { timeout: 10000 }); await sleep(400);
      const lay = await bp.evaluate(() => {
        const h = document.querySelector('body > header').getBoundingClientRect(), rail = document.getElementById('dmRail').getBoundingClientRect();
        const vis = [...document.querySelectorAll('header > *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).map(e => e.id || e.className);
        const card = [...document.querySelectorAll('.board .card')].some(c => { const r = c.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight - 70 && r.bottom > 0 && r.left < innerWidth && r.right > 0; });
        return { hdr: Math.round(h.height), railLeft: Math.round(rail.left), railTop: Math.round(rail.top), railW: Math.round(rail.width), vis, card, H: innerHeight };
      });
      check(D + ': board top bar is one row (AIG-1391)', lay.hdr <= 64, lay);
      check(D + ': the rail is the bottom bar, not a left column', lay.railW > 200 && lay.railTop > lay.H / 2, lay);
      check(D + ': a card is on screen without scrolling', lay.card, lay);
      await shot(bp, 'AIG-1391', size);
      for (const [hash, label] of [['#/glossary', 'glossary'], ['#/p/alpha', 'new card']]) {
        await bp.goto(BASE + '/' + hash); await sleep(800);
        if (label === 'new card') { await bp.evaluate(() => newCard()); await bp.waitForSelector('#f-title', { timeout: 8000 }).catch(() => {}); await sleep(300); await shot(bp, 'AIG-1391-newcard', size); }
        const pops = await bp.evaluate(() => [...document.querySelectorAll('.dlg-pop, #pagePop')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length);
        check(D + ': no Pop out button on the ' + label, pops === 0, pops);
      }
      await bp.close();

      /* ---------- AIG-1392: the Restart pill never covers the open card, Messages or a dialog ---------- */
      const rp = await openPage(ctx, '#/p/alpha');
      await rp.waitForSelector('.board .card', { timeout: 10000 });
      const pill = () => rp.evaluate(() => { const u = document.getElementById('upRestart'); if (!u.querySelector('button')) u.innerHTML = '<button class="primary">🔄 Restart the app</button>'; });
      const covered = (sel) => rp.evaluate(q => {   // the pill's middle is under something else, or the pill sits clear of q
        const b = document.querySelector('#upRestart button').getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        const top = document.elementFromPoint(x, y), t = q && document.querySelector(q);
        const r = t && t.getBoundingClientRect(), clear = !r || b.bottom <= r.top || b.top >= r.bottom || b.right <= r.left || b.left >= r.right;
        return { under: !document.getElementById('updateTop').contains(top), clear, pill: [Math.round(b.top), Math.round(b.bottom)], q: r && [Math.round(r.top), Math.round(r.bottom)] };
      }, sel);
      await pill(); await sleep(100);
      const onBoard = await rp.evaluate(() => { const b = document.querySelector('#upRestart button').getBoundingClientRect(), h = document.querySelector('body > header').getBoundingClientRect(), s = document.querySelector('#filterbar input[type=search]').getBoundingClientRect(); return { below: b.top >= h.bottom - 1, clear: b.bottom <= s.top + 1 || b.top >= s.bottom - 1 }; });
      check(D + ': on the board the Restart strip sits under the top bar and pushes the search down (AIG-1392)', onBoard.below && onBoard.clear, onBoard);
      await shot(rp, 'AIG-1392-board', size);
      await rp.goto(BASE + '/#/p/alpha/ALP-2'); await rp.waitForSelector('.panel', { timeout: 8000 }); await pill(); await sleep(300);
      const oc = await covered('.panel h2, .panel .title, .panel h1');
      check(D + ': the open card covers the Restart strip, not the other way round', oc.under, oc);
      await shot(rp, 'AIG-1392', size);
      await rp.goto(BASE + '/#/p/alpha'); await rp.waitForSelector('.board .card'); await pill();
      await rp.evaluate(() => newCard()); await rp.waitForSelector('#f-title', { timeout: 8000 }); await sleep(300);
      const nc = await covered('#f-title');
      check(D + ': the New card dialog covers the Restart strip', nc.under, nc);
      await rp.keyboard.press('Escape'); await sleep(200);
      await rp.goto(BASE + '/?launch=messages'); await rp.waitForSelector('#dmPanel:not([hidden])', { timeout: 10000 }).catch(() => {}); await pill(); await sleep(300);
      const dm = await covered('#dmPanel input[type=search], #dmPanel input');
      check(D + ': Messages covers the Restart strip, its search box is free', dm.under, dm);
      await rp.close();

      /* ---------- AIG-1394: the call panel on a phone ---------- */
      const cp = await openPage(ctx, '#/');
      await cp.evaluate(stubLivekit);
      await cp.evaluate(() => Dms.show('grp:meeting-alpha'));
      await cp.waitForSelector('#dmMeetBtn', { timeout: 10000 });
      await cp.evaluate(() => Call.join({ title: 'Meeting Room: AI-gile Messenger - Android', key: 'meet:alpha', getToken: async () => ({ url: 'wss://x', token: 'a.b.c', room: 'r1' }) }));
      await cp.waitForSelector('#callTime', { timeout: 8000 }); await sleep(300);
      const call = await cp.evaluate(() => {
        const box = q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; };
        const st = box('#callState'), ti = box('.call-title'), tm = box('#callTime');
        const lh = parseFloat(getComputedStyle(document.getElementById('callState')).lineHeight) || 20;
        const comp = document.querySelector('#dmPanel .dm-compose textarea, #dmPanel .dm-compose input'), cb = comp && comp.getBoundingClientRect();
        // the message box is free: some point on it is not under the call panel
        const free = !!cb && [0.15, 0.5, 0.85].some(f => { const x = cb.left + cb.width * f, y = cb.top + Math.min(cb.height / 2, 20); const top = document.elementFromPoint(x, y); return top && !document.getElementById('callPanel').contains(top); });
        const meet = document.getElementById('dmMeetBtn');
        return { stateLines: Math.round(st.h / lh), titleOne: ti.h < 34, timeBeside: Math.abs(tm.top - st.top) < 4, free, screen: !!document.getElementById('callScreen'), meet: meet.textContent.trim(), meetIn: meet.classList.contains('incall') };
      });
      check(D + ': call head: the title is one line, "1 in the call" one line with the timer beside it (AIG-1394)', call.titleOne && call.stateLines === 1 && call.timeBeside, call);
      check(D + ': the chat\'s message box stays free to tap during a call', call.free, call);
      check(D + ': no Share screen on a phone', !call.screen, call);
      check(D + ': the room\'s Join call button reads In the call while you are in it', call.meetIn && /In the call/.test(call.meet), call);
      await shot(cp, 'AIG-1394', size);
      await cp.evaluate(() => document.getElementById('dmMeetBtn').click()); await sleep(200);   // under the panel in portrait: a script click
      check(D + ': tapping In the call keeps the one call (no second join)', await cp.evaluate(() => lkLog.connects.length === 1 && Call.active()));
      await cp.evaluate(() => Call.leave()); await sleep(200);
      check(D + ': after Leave the button is Join call again', await cp.evaluate(() => { const b = document.getElementById('dmMeetBtn'); return /Join call/.test(b.textContent) && !b.classList.contains('incall'); }));
      await cp.close();
    } finally { await ctx.close().catch(() => {}); }
  }
  { // a short desktop window (no touch) keeps the desktop bar
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    try {
      const bp = await openPage(ctx, '#/p/alpha'); await bp.waitForSelector('.board .card', { timeout: 10000 });
      const r = await bp.evaluate(() => { const b = document.getElementById('dmRail').getBoundingClientRect(); return { w: Math.round(b.width), left: Math.round(b.left) }; });
      check('844x390 mouse window: the rail stays a left column (AIG-1391 is touch only)', r.w <= 80 && r.left <= 1, r);
    } finally { await ctx.close().catch(() => {}); }
  }
}, true);
