// QA area: supill (AIG-1372): the "Call stand-ups?" pill never covers a button, a field or a card: not the Messages chat box and
// Send, not the bottom of a board column, not an open card. It came back twice (AIG-967, AIG-1139), so this sweeps every control.
import { check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('supill', 'the Call stand-ups? pill never covers Send in a Messages chat, a board card or an open card (AIG-1372)', async (s, ctx) => {
  await mkProject(s, 'Pill Board', 'PB');
  await s.ok('POST', '/api/projects/pill-board/team', { name: 'Lead', role: 'Lead' });
  await s.ok('POST', '/api/projects/pill-board/leadchat', { text: 'hello there', author: 'Lead' });
  for (let i = 0; i < 14; i++) await mkCard(s, 'pill-board', 'Backlog card ' + i, { status: 'backlog', description: 'some words' });
  const page = await openPage(ctx, '#/p/pill-board');
  await page.waitForSelector('a.card[data-id]');
  const pill = () => page.evaluate(() => { const e = document.createElement('div'); e.id = 'suPrompt'; e.innerHTML = '<div class="su-pill"><b>📣 Call stand-ups?</b><button class="primary">All projects</button><button>Pick…</button><button>Not today</button></div>'; document.body.appendChild(e); });
  // Every visible control or board card under the pill (the pill hidden counts as covering nothing).
  const covered = () => page.evaluate(() => {
    const p = document.querySelector('#suPrompt .su-pill'); if (!p || !p.getClientRects().length) return [];
    const r = p.getBoundingClientRect(), wrap = document.getElementById('suPrompt');
    wrap.style.visibility = 'hidden';   // look under the pill: only what is really on screen there (not clipped by a column's edge)
    const out = [...document.querySelectorAll('button, textarea, input, select, a.card')].filter(el => !el.closest('#suPrompt') && el.getClientRects().length).filter(el => {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return false;
      const x = Math.max(b.left, r.left), y = Math.max(b.top, r.top), x2 = Math.min(b.right, r.right), y2 = Math.min(b.bottom, r.bottom);
      if (x2 <= x || y2 <= y) return false;
      const t = document.elementFromPoint((x + x2) / 2, (y + y2) / 2);
      return !!t && (t === el || el.contains(t));
    }).map(el => el.tagName + (el.id ? '#' + el.id : '') + ' ' + (el.textContent || el.placeholder || '').trim().slice(0, 30));
    wrap.style.visibility = '';
    return out;
  });
  await pill();
  // A desktop column scrolls inside itself and ends at the window bottom (AIG-1217): with the page at rest, and scrolled to its end
  // (a short window keeps a column at least 360px tall, so the page scrolls; the room under #app clears the pill there).
  for (const [w, h, end] of [[1920, 1080, false], [1920, 1080, true], [1366, 768, true], [390, 844, true]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(300);
    await page.evaluate(() => boardFit()); await sleep(100);
    await page.evaluate(end => { window.scrollTo(0, end ? document.documentElement.scrollHeight : 0); document.querySelectorAll('.board .column').forEach(c => { c.scrollTop = 0; }); }, end);
    await sleep(100);
    const c = await covered();
    check(`board at ${w}px${end ? ', scrolled to the end' : ''}: the pill covers no card or button`, !c.length, c);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  // A lead chat in Messages: the chat box, Send, Attach and GIF stay free.
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('#dmPanel [data-dm="pill-board"]');
  await page.click('#dmPanel [data-dm="pill-board"]');
  await page.waitForSelector('#dmPanel textarea');
  for (const [w, h] of [[1920, 1080], [1366, 768], [800, 700], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await sleep(300);
    const c = await covered();
    check(`Messages chat at ${w}px: the pill covers no button or field`, !c.length, c);
  }
  check('the pill still shows beside an open Messages panel when there is room', await page.setViewportSize({ width: 1920, height: 1080 }).then(() => sleep(200)).then(() => page.locator('#suPrompt .su-pill').isVisible()));
  await page.click('#dmPanel button[onclick="Dms.close()"]').catch(() => page.evaluate(() => Dms.close && Dms.close()));
  await sleep(200);
  // An open card: the pill keeps out of it entirely.
  const id = await page.evaluate(() => document.querySelector('a.card[data-id]').dataset.id);
  await page.evaluate(i => { location.hash = '#/p/pill-board/' + i; }, id);
  await page.waitForSelector('#modal .panel');
  await pill();   // the hash change took the first one away (AIG-1139); a new day's prompt can still land over a card
  await sleep(100);
  check('an open card: the pill is out of the way', !(await page.locator('#suPrompt .su-pill').isVisible()) && !(await covered()).length);
  await noErrors(page);
  await page.close();
}, true);
