// QA area: supill (AIG-1372): the "Call stand-ups?" pill never covers a button, a field or a card: not the Messages chat box and
// Send, not the bottom of a board column, not the Team box and its Badge maker under the columns, not an open card. As a floating
// pill it came back three times (AIG-967, AIG-1139, AIG-1372), so it now sits in the page flow and this sweeps every control.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

const SHOT = process.env.QA_SHOT_1372 || '';

def('supill', 'the Call stand-ups? pill never covers Send in a Messages chat, a board card, the Team box and Badge maker under the columns, or an open card (AIG-1372)', async (s, ctx) => {
  await mkProject(s, 'Pill Board', 'PB');
  await s.ok('POST', '/api/projects/pill-board/team', { name: 'Lead', role: 'Lead' });
  await s.ok('POST', '/api/projects/pill-board/leadchat', { text: 'hello there', author: 'Lead' });
  for (let i = 0; i < 14; i++) await mkCard(s, 'pill-board', 'Backlog card ' + i, { status: 'backlog', description: 'some words' });
  // A short board with a team: the Team box (with 🎨 Badge maker) and the log sit right under the columns, low on the screen.
  await mkProject(s, 'Team Board', 'TB');
  for (const [name, role] of [['Lead', 'Lead'], ['Forge', 'Backend'], ['Pixel', 'Frontend'], ['Scout', 'QA']]) await s.ok('POST', '/api/projects/team-board/team', { name, role, status: '🔄 working', task: name + ' task' });
  await s.ok('POST', '/api/projects/team-board/leadchat', { text: 'morning', author: 'Lead' });
  for (let i = 0; i < 2; i++) await mkCard(s, 'team-board', 'Short card ' + i, { status: 'todo' });
  const page = await openPage(ctx, '#/p/pill-board');
  await page.waitForSelector('a.card[data-id]');
  const pill = () => page.evaluate(() => suPromptShow());   // the page's own pill, put where the page puts it
  // Every visible control or board card the pill lies on top of: where they overlap, the pill is what is on screen, and under it
  // (pill hidden) is the control. A pill under an open card or the Messages panel covers nothing.
  const covered = () => page.evaluate(() => {
    const p = document.querySelector('#suPrompt .su-pill'); if (!p || !p.getClientRects().length) return [];
    const r = p.getBoundingClientRect(), wrap = document.getElementById('suPrompt');
    const hits = [...document.querySelectorAll('button, textarea, input, select, a.card')].filter(el => !el.closest('#suPrompt') && el.getClientRects().length).map(el => {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return null;
      const x = Math.max(b.left, r.left), y = Math.max(b.top, r.top), x2 = Math.min(b.right, r.right), y2 = Math.min(b.bottom, r.bottom);
      if (x2 <= x || y2 <= y) return null;
      const cx = (x + x2) / 2, cy = (y + y2) / 2, top = document.elementFromPoint(cx, cy);
      return top && top.closest('#suPrompt') ? { el, cx, cy } : null;
    }).filter(Boolean);
    wrap.style.visibility = 'hidden';   // look under the pill: only what is really on screen there (not clipped by a column's edge)
    const out = hits.filter(({ el, cx, cy }) => { const t = document.elementFromPoint(cx, cy); return !!t && (t === el || el.contains(t)); })
      .map(({ el }) => el.tagName + (el.id ? '#' + el.id : '') + ' ' + (el.textContent || el.placeholder || '').trim().slice(0, 30));
    wrap.style.visibility = '';
    return out;
  });
  // Is a control fully clickable: its centre on screen is itself, not the pill.
  const free = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return 'missing'; const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === e || e.contains(t)) ? true : (t ? t.tagName + ' ' + (t.className || '') + ' ' + (t.closest('#suPrompt') ? '(the pill)' : '') : 'nothing'); }, sel);
  const sweep = async (label, sizes) => {
    for (const [w, h, end] of sizes) {
      await page.setViewportSize({ width: w, height: h }); await sleep(300);
      await page.evaluate(() => typeof boardFit === 'function' && document.querySelector('.board') && boardFit()); await sleep(100);
      await page.evaluate(end => { window.scrollTo(0, end ? document.documentElement.scrollHeight : 0); document.querySelectorAll('.board .column').forEach(c => { c.scrollTop = 0; }); }, end);
      await sleep(100);
      const c = await covered();
      check(`${label} at ${w}x${h}${end ? ', scrolled to the end' : ''}: the pill covers no card, button or field`, !c.length, c);
    }
  };
  const SIZES = [[1920, 1080, false], [1920, 1080, true], [1366, 768, false], [1366, 768, true], [390, 844, false], [390, 844, true]];
  await pill();
  check('the pill sits in the page flow above the search row (never floating over the page)', await page.evaluate(() => { const e = document.getElementById('suPrompt'), f = document.getElementById('filterbar'); return getComputedStyle(e).position === 'static' && e.nextElementSibling === f && e.getBoundingClientRect().bottom <= f.getBoundingClientRect().top + 1; }));
  check('only one pill at a time', await page.evaluate(() => { suPromptShow(); return document.querySelectorAll('#suPrompt').length === 1; }));
  await sweep('board', SIZES);
  // A lead chat in Messages: the chat box, Send, Attach and GIF stay free.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dm="pill-board"]');
  await page.click('#dmPanel [data-dm="pill-board"]');
  await page.waitForSelector('#dmPanel textarea');
  await sweep('Messages chat', [[1920, 1080], [1366, 768], [800, 700], [390, 844]]);
  for (const sel of ['#dmPanel textarea']) check(`Messages chat: ${sel} is free`, (await free(sel)) === true, await free(sel));
  await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(200);
  check('the pill still shows beside an open Messages panel when there is room', await page.evaluate(() => { const p = document.querySelector('#suPrompt .su-pill').getBoundingClientRect(), d = document.getElementById('dmPanel').getBoundingClientRect(); return p.width > 0 && p.left >= d.right; }));

  // The board of the failed test (AIG-1372): the Team box and 🎨 Badge maker under short columns, Messages open and closed.
  await page.evaluate(() => { location.hash = '#/p/team-board'; });
  await page.waitForSelector('.bm-btn');
  await pill();   // the hash change took the first one away (AIG-1139)
  await page.waitForSelector('#dmPanel textarea').catch(() => {});
  await sweep('team board with Messages open', SIZES.slice(0, 4));
  for (const [w, h] of [[1920, 1080], [1366, 768]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(300);
    check(`team board with Messages open at ${w}x${h}: 🎨 Badge maker is free`, (await free('.bm-btn')) === true, await free('.bm-btn'));
  }
  if (SHOT) { await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(200); await page.screenshot({ path: SHOT }); }
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(200);
  check('dark mode: the pill takes the panel colour', await page.evaluate(() => getComputedStyle(document.querySelector('#suPrompt .su-pill')).backgroundColor !== 'rgba(0, 0, 0, 0)'));
  if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/, '-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.click('#dmPanel button[onclick="Dms.close()"]').catch(() => page.evaluate(() => Dms.close && Dms.close()));
  await sleep(200);
  await sweep('team board', SIZES);
  for (const [w, h] of [[1920, 1080], [1366, 768], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(300);
    await page.locator('.bm-btn').scrollIntoViewIfNeeded();
    check(`team board at ${w}x${h}: 🎨 Badge maker is free`, (await free('.bm-btn')) === true, await free('.bm-btn'));
  }
  check('phone: no sideways scroll with the pill', await page.evaluate(() => document.documentElement.scrollWidth <= 392));

  // An open card lies over the pill, never under it.
  await page.setViewportSize({ width: 1920, height: 1080 });
  const id = await page.evaluate(() => document.querySelector('a.card[data-id]').dataset.id);
  await page.evaluate(i => { location.hash = '#/p/team-board/' + i; }, id);
  await page.waitForSelector('#modal .panel');
  await pill();   // a new day's prompt can still land while a card is open
  await sleep(100);
  check('an open card: the pill covers nothing of it', !(await covered()).length, await covered());
  await noErrors(page);
  await page.close();
}, true);
