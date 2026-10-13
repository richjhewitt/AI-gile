// QA area: remind (AIG-693): the ❓ Remind me button on a card shows what was asked, the plan and where it stands.
import { check, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('remind', '❓ Remind me: ask + plan + now from comments, bare card falls back to its description, phone width and dark mode (AIG-693)', async (s, ctx) => {
  await mkProject(s, 'Rem', 'REM');
  await mkCard(s, 'rem', 'Rich card', { status: 'verify', testSteps: 'Look', description: 'Some description line\n\n- desc bullet one\n- desc bullet two\n' });
  await say(s, 'rem', 'REM-1', '🧭 Lead Scrum Master', 'Original: make the export button work offline');
  await say(s, 'rem', 'REM-1', '🧭 Lead Scrum Master', '**Go on this plan?**\n- cache the file list\n- retry when back online\n- third bullet');
  await mkCard(s, 'rem', 'Bare card', { status: 'todo', description: 'Just a plain description\n\n- first bullet\n- second bullet\n- third bullet\n' });
  const page = await openPage(ctx, '#/p/rem/REM-1');
  await page.waitForSelector('#remind-btn');
  await page.click('#remind-btn');
  let txt = await page.innerText('#remind-box');
  check('ask line comes from the Original: comment, prefix stripped', /You asked: make the export button work offline/.test(txt) && !/Original:/.test(txt), txt);
  check('plan line has the first two bullets only', /Plan: cache the file list; retry when back online/.test(txt) && !/third bullet/.test(txt), txt);
  check('now line says waiting for you to test', /Now: waiting for you to test/.test(txt), txt);
  await page.setViewportSize({ width: 390, height: 844 });
  check('phone width: the box fits, no sideways scroll', await page.evaluate(() => { const b = document.getElementById('remind-box').getBoundingClientRect(); return b.right <= window.innerWidth + 1 && b.left >= -1 && document.documentElement.scrollWidth <= window.innerWidth + 1; }));
  await page.emulateMedia({ colorScheme: 'dark' });
  check('dark mode: the box has readable text', await page.evaluate(() => { const e = document.getElementById('remind-box'); return e.offsetHeight > 20 && getComputedStyle(e).color !== getComputedStyle(e).backgroundColor; }));
  await page.setViewportSize({ width: 1280, height: 800 }); await page.emulateMedia({ colorScheme: 'light' });
  await page.click('#remind-btn');
  check('a second click hides the box', (await page.locator('#remind-box').count()) === 0);

  await page.goto((await page.url()).replace('REM-1', 'REM-2'));
  await page.waitForSelector('#remind-btn');
  await page.click('#remind-btn');
  txt = await page.innerText('#remind-box');
  check('a bare card falls back to its description and first 2 bullets', /You asked: Just a plain description/.test(txt) && /Plan: first bullet; second bullet/.test(txt) && !/third bullet/.test(txt) && /Now: to do/.test(txt), txt);
  await noErrors(page);
}, true);
