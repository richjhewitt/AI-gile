// QA area: testerfix: fixes for what the Opus tester found (2026-10-14): the ? row of the shortcuts sheet (AIG-867), the incidents
// guide in ❓ Help (AIG-863), and No AI hiding 🚨 Swarm and the For the team lane (AIG-821).
import { check, openPage, mkProject, noErrors, def } from '../lib.mjs';

def('testerfix', 'shortcuts ? row text, 🔥 Incidents and problems in ❓ Help, No AI hides Swarm and For the team (AIG-867, AIG-863, AIG-821)', async (s, ctx) => {
  await mkProject(s, 'Fix Board', 'FIX');
  const page = await openPage(ctx, '#/p/fix-board');
  await page.waitForSelector('.column[data-status="team"]', { state: 'attached' });
  await page.keyboard.press('?');
  await page.waitForSelector('#dialog .dialog.sc .window-close');
  const sheet = await page.textContent('#dialog');
  check('shortcuts: the ? row says it shows or hides the list, not the self-care help', /Show or hide this list/.test(sheet) && !/Small nudges/.test(sheet));
  // AIG-967: the 📣 Call stand-ups? nudge never lies over a dialog (AIG-1372: it sits in the page flow, so an open dialog is on top of it)
  const nudge = await page.evaluate(() => { suPromptShow(); const p = document.querySelector('#suPrompt .su-pill').getBoundingClientRect(), on = () => !!(document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2) || { closest: () => null }).closest('#suPrompt');
    const open = on(); closeDialog(); const shut = on(); suPromptGone(); return { open, shut }; });
  check('the stand-up nudge stays under an open dialog and shows again after', !nudge.open && nudge.shut, nudge);
  await page.keyboard.press('?');
  await page.waitForSelector('#dialog .dialog.sc .window-close');
  await page.click('#dialog .dialog.sc .window-close');
  await page.click('#helpBtn');
  await page.click('#hmIncidents');
  await page.waitForSelector('#incGuide');
  check('❓ Help → 🔥 Incidents and problems opens the guide', /incident/i.test(await page.textContent('#incGuide')) && !/^---/.test(await page.textContent('#incGuide')));
  await page.evaluate(() => { document.body.classList.add('noai'); closeDialog(); });
  const hidden = await page.evaluate(() => {
    const vis = el => !!el && getComputedStyle(el).display !== 'none';
    const sw = document.querySelector('[onclick^="Swarm.toggleFor"]');
    return { team: !vis(document.querySelector('.column[data-status="team"]')), swarm: !sw || !vis(sw) };
  });
  check('No AI: the For the team lane and 🚨 Swarm this are hidden', hidden.team && hidden.swarm, hidden);
  noErrors(page);
}, true);
