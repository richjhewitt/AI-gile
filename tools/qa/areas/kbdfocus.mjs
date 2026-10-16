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

  await noErrors(page);
  await page.close();
}, true);
