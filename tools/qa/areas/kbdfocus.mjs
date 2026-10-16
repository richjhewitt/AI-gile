// QA area: kbdfocus (AIG-1423..1432): keyboard only (page.keyboard, document.activeElement, the accessibility tree): the open card is a
// named dialog that takes and keeps focus, Home keeps focus over its redraws, the card fits the window, the top bar menus work by keys,
// closing gives focus back, the Messages panel and page changes move focus, the card tabs say which is open, Send back says why it can't.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('kbdfocus', 'keyboard focus: card dialog, Home redraws, card fits, Help/Status menus, focus back on close, Messages and page focus, card tabs, Send back error (AIG-1423..1432)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Plain card', { status: 'todo', description: 'Some words' });
  await mkCard(s, 'alpha', 'Verify me', { status: 'verify', testSteps: 'Step one\n'.repeat(20) });
  for (let i = 0; i < 6; i++) await mkCard(s, 'alpha', 'More ' + i, { status: 'todo' });
  await mkCard(s, 'alpha', 'Done one', { status: 'done', description: 'Finished' });   // ALP-9
  const page = await openPage(ctx, '#/p/alpha');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForSelector('a.card[data-id]');
  const act = () => page.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, id: a && a.id, card: a && a.dataset && a.dataset.id, inPanel: !!(a && a.closest('#modal .panel')), body: a === document.body, text: a && (a.textContent || '').trim().slice(0, 40) }; });

  // AIG-1423: Enter on a board card opens it as a named modal dialog with focus inside; Tab never leaves it.
  await page.focus('a.card[data-id="ALP-1"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#modal .panel'); await sleep(300);
  const dlg = await page.evaluate(() => { const p = document.querySelector('#modal .panel'), l = p.getAttribute('aria-labelledby'); return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'), name: l && document.getElementById(l) ? document.getElementById(l).textContent : '' }; });
  check('the open card is a modal dialog named by its title (AIG-1423)', dlg.role === 'dialog' && dlg.modal === 'true' && dlg.name === 'Plain card', dlg);
  check('focus moves into the card when it opens (AIG-1423)', (await act()).inPanel, await act());
  check('the accessibility tree has one dialog named Plain card (AIG-1423)', (await page.getByRole('dialog', { name: 'Plain card' }).count()) === 1);
  let out = 0;
  for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); if (!(await act()).inPanel) out++; }
  check('Tab 60 times stays inside the card (AIG-1423)', out === 0, out);
  out = 0;
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Shift+Tab'); if (!(await act()).inPanel) out++; }
  check('Shift+Tab stays inside the card too (AIG-1423)', out === 0, out);
  await page.keyboard.press('Escape'); await sleep(400);
  check('Esc closes the card and focus is back on its board card (AIG-1423)', (await page.locator('#modal .panel').count()) === 0 && (await act()).card === 'ALP-1', await act());

  // AIG-1424: Home redraws (the poll, a refresh) keep the focused control and the scroll.
  await page.goto(page.url().split('#')[0] + '#/');
  await page.waitForSelector('#app [data-pslug]');
  await page.setViewportSize({ width: 1280, height: 500 });
  const homeKeep = async (sel, what) => {
    await page.focus(sel);
    const was = await page.evaluate(() => { const a = document.activeElement; return a.outerHTML.slice(0, 120); });
    await page.evaluate(() => window.scrollTo(0, 120)); const y = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 3; i++) { await page.evaluate(() => render()); await sleep(150); }
    const now = await page.evaluate(() => ({ html: document.activeElement.outerHTML.slice(0, 120), y: window.scrollY, fresh: !document.activeElement.isConnected }));
    check('Home redrawn 3 times: focus stays on ' + what + ' (AIG-1424)', now.html === was, [was, now.html]);
    check('Home redrawn: the scroll stays put on ' + what + ' (AIG-1424)', now.y === y, [y, now.y]);
  };
  await homeKeep('#app [data-pslug] a, #app a[data-pslug], #app [data-pslug]', 'a project');
  await homeKeep('#app button', 'a button');
  let lost = 0; await page.focus('#app button');
  for (let i = 0; i < 12; i++) { await sleep(1000); if (await page.evaluate(() => document.activeElement === document.body)) { lost++; await page.focus('#app button'); } }
  check('Home: focus is never lost to the page over 12 s (AIG-1424)', lost === 0, lost);
  await page.setViewportSize({ width: 1280, height: 800 });

  // AIG-1425: the card panel ends inside the window, so a focused Accept / Send back can be seen.
  for (const [w, h] of [[1280, 800], [1280, 720], [1400, 1000], [390, 760]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(page.url().split('#')[0] + '#/p/alpha/ALP-2');
    await page.waitForSelector('#modal .panel .verdict'); await sleep(300);
    const r = await page.evaluate(() => { const b = document.querySelector('#modal .panel').getBoundingClientRect(); return { bottom: Math.round(b.bottom), vh: innerHeight }; });
    check(`card panel ends inside a ${w}x${h} window (AIG-1425)`, r.bottom <= r.vh, r);
    await page.focus('#v-text');
    let i = 0; for (; i < 15; i++) { await page.keyboard.press('Tab'); if (/Accept/.test((await act()).text)) break; }
    const seen = await page.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight }; });
    check(`Tab to Accept: it is in sight at ${w}x${h} (AIG-1425)`, i < 15 && seen.top >= 0 && seen.bottom <= seen.vh, seen);
    await page.keyboard.press('Tab');
    const sb = await page.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return { t: document.activeElement.textContent, bottom: Math.round(b.bottom), vh: innerHeight }; });
    check(`Send back after it is in sight too at ${w}x${h} (AIG-1425)`, /Send back/.test(sb.t) && sb.bottom <= sb.vh, sb);
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // AIG-1426: ❓ Help and the status menu by keyboard: focus in on open, arrows, End, Esc back to the button, aria-expanded.
  await page.goto(page.url().split('#')[0] + '#/p/alpha');
  await page.waitForSelector('a.card[data-id]');
  const exp = sel => page.evaluate(s => document.querySelector(s).getAttribute('aria-expanded'), sel);
  check('Help says it is closed (AIG-1426)', (await exp('#helpBtn')) === 'false');
  await page.focus('#helpBtn'); await page.keyboard.press('Enter'); await page.waitForSelector('#helpMenu'); await sleep(100);
  check('Enter on Help: focus on its first item, aria-expanded true (AIG-1426)', (await act()).id === 'hmStart' && (await exp('#helpBtn')) === 'true', await act());
  await page.keyboard.press('ArrowDown');
  check('ArrowDown moves to the next Help item (AIG-1426)', (await act()).id === 'hmIntro', await act());
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  check('ArrowUp from the first goes round to the last (AIG-1426)', /^hmLevel/.test((await act()).id), await act());
  await page.keyboard.press('Home');
  check('Home goes back to the first item (AIG-1426)', (await act()).id === 'hmStart');
  await page.keyboard.press('Escape'); await sleep(100);
  check('Esc closes Help and focus is back on ❓ Help (AIG-1426)', (await page.locator('#helpMenu').count()) === 0 && (await act()).id === 'helpBtn' && (await exp('#helpBtn')) === 'false', await act());
  await page.keyboard.press('Enter'); await page.waitForSelector('#helpMenu');
  await page.keyboard.press('Tab'); await sleep(100);
  check('Tab out of Help closes it (AIG-1426)', (await page.locator('#helpMenu').count()) === 0 && !(await act()).body, await act());
  await page.focus('#helpBtn'); await page.keyboard.press('Enter'); await page.waitForSelector('#helpMenu');
  await page.keyboard.press('Enter'); await page.waitForSelector('#dialog .dialog'); await sleep(100);
  check('Enter on Getting started opens it (AIG-1426)', (await page.locator('#dialog #gettingStarted').count()) === 1);
  await page.keyboard.press('Escape'); await sleep(200);
  check('closing Getting started gives focus back to ❓ Help (AIG-1426)', (await act()).id === 'helpBtn', await act());
  await page.focus('#statusBtn'); await page.keyboard.press('Enter'); await page.waitForSelector('#statusMenu'); await sleep(100);
  check('Enter on the status button: focus on the status you have (AIG-1426)', (await act()).id === 'st-online' && (await exp('#statusBtn')) === 'true', await act());
  await page.keyboard.press('ArrowDown');
  check('ArrowDown moves to the next status (AIG-1426)', (await act()).id === 'st-idle', await act());
  await page.keyboard.press('Escape'); await sleep(100);
  check('Esc closes the status menu, focus back on its button (AIG-1426)', (await page.locator('#statusMenu').count()) === 0 && (await act()).id === 'statusBtn' && (await exp('#statusBtn')) === 'false', await act());
  // The board ⋯ More (a phone-width board shows it): Enter opens it with focus on its first tool, arrows move, Esc back to ⋯.
  await page.setViewportSize({ width: 390, height: 760 }); await sleep(300);
  await page.evaluate(() => render()); await sleep(200);
  if (await page.locator('#tbDots').isVisible()) {
    await page.focus('#tbDots'); await page.keyboard.press('Enter'); await sleep(150);
    const inMore = () => page.evaluate(() => !!document.activeElement.closest('#boardTbMore'));
    check('Enter on ⋯ More: focus on its first tool (AIG-1426)', await inMore(), await act());
    const a1 = (await act()).text; await page.keyboard.press('ArrowDown'); await sleep(100);
    check('ArrowDown in ⋯ More moves to the next tool, not the page (AIG-1426)', await inMore() && (await act()).text !== a1, await act());
    await page.keyboard.press('Escape'); await sleep(100);
    check('Esc closes ⋯ More, focus back on it (AIG-1426)', (await act()).id === 'tbDots' && (await exp('#tbDots')) === 'false', await act());
  } else check('⋯ More is shown at phone width', false);
  await page.setViewportSize({ width: 1280, height: 800 });

  // AIG-1427: closing a card (✕ by keyboard, also a done card) or the ? sheet puts focus back on what opened it, never the page top.
  await page.goto(page.url().split('#')[0] + '#/p/alpha');
  await page.waitForSelector('a.card[data-id="ALP-3"]');
  const closeBack = async (id, what) => {
    await page.focus(`a.card[data-id="${id}"]`); await page.keyboard.press('Enter');
    await page.waitForSelector('#modal .panel'); await sleep(400);
    await page.focus('#modal .window-close'); await page.keyboard.press('Enter'); await sleep(600);
    check(`✕ Close on ${what}: focus is back on its board card (AIG-1427)`, (await act()).card === id, await act());
  };
  await closeBack('ALP-3', 'a to do card');
  await closeBack('ALP-9', 'a done card');
  await page.focus('a.card[data-id="ALP-4"]'); await page.keyboard.press('j'); await page.keyboard.press('j');
  const jd = (await act()).card;
  await page.keyboard.press('?'); await page.waitForSelector('#dialog .dialog.sc');
  await page.keyboard.press('Escape'); await sleep(200);
  check('? sheet then Esc: focus is back on the card j moved to (AIG-1427)', !!jd && (await act()).card === jd, [jd, await act()]);
  await page.keyboard.press('?'); await page.waitForSelector('#dialog .dialog.sc');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await sleep(200);
  check('? sheet closed with its Close button: focus back on the card too (AIG-1427)', (await page.locator('#dialog .dialog').count()) === 0 && (await act()).card === jd, await act());
  // A card opened from elsewhere (its link from Home): closing lands on the board card, as that is where it goes back to.
  await page.goto(page.url().split('#')[0] + '#/p/alpha/ALP-5');
  await page.waitForSelector('#modal .panel'); await sleep(400);
  await page.keyboard.press('Escape'); await sleep(500);
  check('a card opened by its link: Esc puts focus on its board card (AIG-1427)', (await act()).card === 'ALP-5', await act());
  // Its board card filtered out of sight: focus goes back to what opened it (here the search box), not the page top.
  await page.focus('#f-q'); await page.keyboard.type('zzz-none'); await sleep(400);
  await page.evaluate(() => { location.hash = '#/p/alpha/ALP-6'; });
  await page.waitForSelector('#modal .panel'); await sleep(400);
  await page.keyboard.press('Escape'); await sleep(500);
  check('board card filtered away: closing gives focus back to the search box that was in use (AIG-1427)', (await act()).id === 'f-q', await act());
  await page.fill('#f-q', ''); await sleep(300);

  // AIG-1428: g m opens Messages with focus in it; it is a named dialog, Tab stays in it, Esc closes it back to the 💬 rail button.
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('g'); await page.keyboard.press('m');
  await page.waitForSelector('#dmPanel:not([hidden])'); await sleep(400);
  const inDm = () => page.evaluate(() => !!document.activeElement.closest('#dmPanel'));
  const dmRole = await page.evaluate(() => { const p = document.getElementById('dmPanel'); return [p.getAttribute('role'), p.getAttribute('aria-label')]; });
  check('Messages panel is a named dialog (AIG-1428)', dmRole[0] === 'dialog' && /messages/i.test(dmRole[1] || ''), dmRole);
  check('g m puts focus in the Messages panel, on its search box (AIG-1428)', (await act()).id === 'dmSearch', await act());
  let dmOut = 0;
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); if (!(await inDm())) dmOut++; }
  check('Tab stays in the Messages panel, never the top bar behind it (AIG-1428)', dmOut === 0, dmOut);
  await page.keyboard.press('Escape'); await sleep(300);
  check('Esc closes Messages, focus on the 💬 rail button (AIG-1428)', await page.locator('#dmPanel').isHidden() && await page.evaluate(() => !!document.activeElement.closest('#dmRail [data-dms]')), await act());
  await page.keyboard.press('Enter'); await page.waitForSelector('#dmPanel:not([hidden])'); await sleep(300);
  check('Enter on the 💬 rail button opens Messages with focus inside (AIG-1428)', await inDm(), await act());
  await page.keyboard.press('Escape'); await sleep(300);
  check('...and Esc gives focus back to that button (AIG-1428)', await page.evaluate(() => !!document.activeElement.closest('#dmRail [data-dms]')), await act());
  // A page change puts focus on the new page's heading.
  const onHeading = () => page.evaluate(() => { const a = document.activeElement; return !!a && !!a.closest('#app') && (/^H[12]$/.test(a.tagName) || a.id === 'app'); });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('g'); await page.keyboard.press('i'); await page.waitForSelector('#ib'); await sleep(900);
  check('g i: focus is on the Inbox page, not the page top (AIG-1428)', await onHeading(), await act());
  await page.keyboard.press('g'); await page.keyboard.press('h'); await page.waitForSelector('#app [data-pslug]'); await sleep(900);
  check('g h: focus is on the Home page heading (AIG-1428)', await onHeading(), await act());
  await page.focus('#app a[data-pslug="alpha"]'); await page.keyboard.press('Enter'); await page.waitForSelector('.board .column'); await sleep(900);
  const bh = await act();
  check('Enter on a project: focus on the board heading (AIG-1428)', await onHeading() && /Alpha/.test(bh.text), bh);

  await noErrors(page);
  await page.close();
}, true);
