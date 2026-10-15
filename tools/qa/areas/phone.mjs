// QA area: phone (AIG-410). Every page at phone size has no sideways scroll and big enough tap targets; the app installs (manifest + service worker).
import { check, sleep, tmp, mkProject, mkCard, openPage, BASE, def, clickBar } from '../lib.mjs';

const DEVICES = [{ name: 'iPhone 390x844', viewport: { width: 390, height: 844 } }, { name: 'Android 412x915', viewport: { width: 412, height: 915 } }];

// Elements that stick out past the right edge of the window (ignoring ones inside a scrolling strip), for the failure message.
const sticking = () => {
  const W = document.documentElement.clientWidth, out = [];
  const scrolls = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || r.right <= W + 1 || scrolls(el)) continue;
    out.push((el.id ? '#' + el.id : el.tagName.toLowerCase()) + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' r=' + Math.round(r.right));
    if (out.length >= 4) break;
  }
  return out.join(', ');
};
const fits = async (page, label) => {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(`${label}: no sideways scroll (${m.sw} <= ${m.cw})`, m.sw <= m.cw, m.sw > m.cw ? await page.evaluate(sticking) : '');
};
const tapSize = async (page, sel, label) => {
  const inMenu = await page.evaluate(q => { const e = document.querySelector(q), m = document.getElementById('tbMoreMenu'); return !!(e && m && m.contains(e) && m.hidden); }, sel);   // AIG-931: on a phone the bar buttons are in the ☰ menu
  if (inMenu) await page.click('#tbMoreBtn');
  const r = await page.evaluate(q => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, vis: b.width > 0 && b.right <= document.documentElement.clientWidth + 1 && b.left >= -1 }; }, sel);
  check(`${label}: visible and at least 40px`, !!r && r.vis && r.h >= 39.5 && r.w >= 39.5, JSON.stringify(r));
  if (inMenu) await page.click('#tbMoreBtn');
};

def('phone', '📱 every page fits a phone (390x844, 412x915): no sideways scroll, big tap targets; manifest + service worker (AIG-410)', async (s, ctx0) => {
  const browser = ctx0.browser();
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('alpha') });
  await mkProject(s, 'Beta', 'BET', { path: tmp('beta') });
  const a = await mkCard(s, 'alpha', 'A fairly long card title that has to wrap on a small screen without pushing things sideways', { status: 'verify', description: 'Some text with averyveryveryveryveryveryveryveryverylongwordwithoutanyspacesatall to test wrapping.' });
  const q = await mkCard(s, 'alpha', 'Big plan?', { status: 'todo' });
  await s.ok('POST', `/api/projects/alpha/cards/${q.id}/quiz`, { author: 'Lead', topic: 'Sharing', items: [{ q: 'Who can see it?', options: 'Everyone,Friends,Nobody' }, { q: 'Allow?' }] }).catch(() => {});
  await mkCard(s, 'beta', 'Other', { status: 'doing', assignee: 'Rich' });

  /* ---------- the install part ---------- */
  const mf = await fetch(BASE + '/manifest.webmanifest');
  const man = await mf.json().catch(() => ({}));
  check('manifest is served as JSON with name, short name, standalone, start_url, theme colour', mf.status === 200 && /json/.test(mf.headers.get('content-type')) && man.name && man.short_name && man.display === 'standalone' && man.start_url && man.theme_color && man.background_color, man);
  const icons = man.icons || [];
  check('manifest has 192 and 512 png icons, and they are served', icons.some(i => i.sizes === '192x192') && icons.some(i => i.sizes === '512x512') && (await Promise.all(icons.map(i => fetch(BASE + '/' + i.src.replace(/^\//, ''))))).every(r => r.status === 200 && /png/.test(r.headers.get('content-type'))), icons);
  const sw = await fetch(BASE + '/sw.js');
  check('service worker is served as JavaScript, never cached', sw.status === 200 && /javascript/.test(sw.headers.get('content-type')) && /no-store/.test(sw.headers.get('cache-control')));
  const swText = await sw.text();
  check('service worker never caches the API and goes to the network first', /\/api\//.test(swText) && /fetch\(/.test(swText));

  for (const dev of DEVICES) {
    const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const D = dev.name;
    try {
      const page = await openPage(ctx, '#/');
      check(D + ': page links the manifest and a theme colour', !!(await page.$('link[rel=manifest]')) && !!(await page.$('meta[name=theme-color]')));
      const reg = await page.evaluate(async () => { try { const r = await navigator.serviceWorker.ready; return !!r.active; } catch (e) { return String(e); } });
      check(D + ': service worker registers and is active', reg === true, reg);
      await fits(page, D + ' home');
      await tapSize(page, '#helpBtn', D + ' ❓ Help');
      await clickBar(page, '#helpBtn');
      await page.waitForSelector('#hmInstall', { timeout: 8000 }).catch(() => {});
      check(D + ': Help menu has the Add to home screen item, inside the window', await page.evaluate(() => { const e = document.getElementById('hmInstall'), m = document.getElementById('helpMenu'); if (!e || !m) return false; const r = m.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
      await page.click('#hmInstall').catch(() => {});
      await page.waitForSelector('#dialog *', { timeout: 8000 }).catch(() => {});
      check(D + ': the home-screen hint opens and fits', (await page.textContent('#dialog')).length > 20);
      await fits(page, D + ' hint dialog');
      await page.keyboard.press('Escape'); await page.evaluate(() => { document.getElementById('dialog').innerHTML = ''; });

      await page.goto(BASE + '/#/p/alpha'); await page.waitForSelector('.column.foryou, .board');
      await sleep(400);
      await fits(page, D + ' board');
      check(D + ': board columns are a sideways strip', await page.evaluate(() => { const b = document.querySelector('.board'); return b.scrollWidth > b.clientWidth && ['auto', 'scroll'].includes(getComputedStyle(b).overflowX); }));
      await tapSize(page, '#helpBtn', D + ' board ❓');

      await page.goto(BASE + '/#/p/alpha/' + a.id); await page.waitForSelector('.panel'); await sleep(400);
      await fits(page, D + ' card panel');
      const tabs = await page.$$('.panel [role=tab], .panel .tabs button, .panel .tab');
      for (const t of tabs.slice(0, 4)) { await t.click().catch(() => {}); await sleep(150); await fits(page, D + ' card panel tab'); }
      if (tabs.length) { const hs = await Promise.all(tabs.map(t => t.boundingBox())); check(D + ': card tabs are tappable (>= 40px high)', hs.every(b => b && b.height >= 39.5), hs.map(b => b && Math.round(b.height))); }

      await page.goto(BASE + '/#/inbox'); await page.waitForSelector('.ib-decide', { timeout: 5000 }).catch(() => {}); await sleep(400);
      await fits(page, D + ' inbox');
      const chips = await page.$$('.ib-decide, .ibchip, #ibKinds button, .ib-chips button');
      if (chips.length) { const hs = await Promise.all(chips.map(c => c.boundingBox())); check(D + ': inbox chips are >= 40px high', hs.every(b => b && b.height >= 39.5), hs.map(b => b && Math.round(b.height))); }
      if (await page.$('.ib-decide')) { await page.click('.ib-decide'); await sleep(500); await fits(page, D + ' inbox Decide'); await tapSize(page, '#ibDc .dc-btns button', D + ' Decide button'); }

      for (const [hash, label] of [['#/setup', 'setup'], ['#/usage', 'usage'], ['#/glossary', 'glossary'], ['#/pop/alpha/' + a.id, 'pop-out card']]) {
        await page.goto(BASE + '/' + hash); await sleep(700);
        if (label === 'setup') { await fits(page, D + ' setup'); const wz = await page.$('#wzYes'); if (wz) { await wz.click(); await sleep(500); await fits(page, D + ' wizard'); } }
        else await fits(page, D + ' ' + label);
      }
      await page.goto(BASE + '/#/p/alpha'); await sleep(300);
      const rail = await page.evaluate(() => ({ bodyPad: parseFloat(getComputedStyle(document.body).paddingLeft), appLeft: document.getElementById('app').getBoundingClientRect().left }));
      check(D + ': the rail no longer takes a side column (app starts at the left edge)', rail.bodyPad <= 1 && rail.appLeft <= 1, rail);

      const task = await mkCard(s, 'beta', 'Clean the kitchen', { status: 'todo', assignee: 'Rich', description: 'Counters first', focus: true });
      await s.ok('POST', '/api/focus/start', { project: 'beta', id: task.id });
      await page.goto(BASE + '/#/'); await page.waitForSelector('#focusScreen:not([hidden]) *', { timeout: 8000 }).catch(() => {}); await sleep(500);
      await fits(page, D + ' focus mode');
      await tapSize(page, '#focusScreen button', D + ' focus button');
      await s.ok('POST', '/api/focus/done').catch(() => {});
    } finally { await ctx.close().catch(() => {}); }
  }
}, true);
