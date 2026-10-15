// QA area: dialogs (AIG-1277): role=dialog, named by the heading, Tab trapped, Esc closes, focus returns to the opener.
import { check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('dialogs', 'dialogs: role/aria-modal/name, Tab trap, Esc, focus back (3 dialogs)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.toolbar button.primary');
  const cases = [
    ['new card', async () => { await page.focus('.toolbar button.primary'); await page.keyboard.press('Enter'); }, '.toolbar button.primary'],
    ['column +', async () => { await page.focus('.column[data-status=backlog] .colbtn'); await page.keyboard.press('Enter'); }, '.column[data-status=backlog] .colbtn'],
    ['are you sure', async () => { await page.focus('.toolbar button.primary'); await page.evaluate(() => { askSure('Really?', 'Sure about this?', 'Yes'); }); }, '.toolbar button.primary'],
  ];
  for (const [name, open, opener] of cases) {
    await open();
    await page.waitForSelector('#dialog .dialog');
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const d = document.querySelector('#dialog .dialog'), h = d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby'));
      return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), name: h ? h.textContent.trim() : '', h2: (d.querySelector('h2') || {}).textContent };
    });
    check(`${name}: role=dialog, aria-modal, named by its heading`, info.role === 'dialog' && info.modal === 'true' && info.name && info.name === (info.h2 || '').trim(), JSON.stringify(info));
    let inside = true;
    for (let i = 0; i < 40 && inside; i++) { await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab'); inside = await page.evaluate(() => !!document.activeElement.closest('#dialog')); }
    check(`${name}: Tab and Shift+Tab stay inside`, inside);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#dialog .dialog', { state: 'detached' });
    check(`${name}: Esc closes and focus goes back to the opener`, await page.evaluate(sel => document.activeElement === document.querySelector(sel), opener));
  }
  await noErrors(page);
}, true);
