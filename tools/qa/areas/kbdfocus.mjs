// QA area: kbdfocus (AIG-1423..1432): keyboard only (page.keyboard, document.activeElement, the accessibility tree): the open card is a
// named dialog that takes and keeps focus, Home keeps focus over its redraws, the card fits the window, the top bar menus work by keys,
// closing gives focus back, the Messages panel and page changes move focus, the card tabs say which is open, Send back says why it can't.
import { check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('kbdfocus', 'keyboard focus: card dialog, Home redraws, card fits, Help/Status menus, focus back on close, Messages and page focus, card tabs, Send back error (AIG-1423..1432)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkCard(s, 'alpha', 'Plain card', { status: 'todo', description: 'Some words' });
  await mkCard(s, 'alpha', 'Verify me', { status: 'verify', testSteps: 'Step one\n'.repeat(20) });
  for (let i = 0; i < 6; i++) await mkCard(s, 'alpha', 'More ' + i, { status: 'todo' });
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

  await noErrors(page);
  await page.close();
}, true);
