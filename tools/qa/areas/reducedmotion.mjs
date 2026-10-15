// QA area: reducedmotion (AIG-1256): with prefers-reduced-motion emulated, nothing in the app animates for longer than a blink.
import { check, sleep, mkProject, mkCard, openPage, def } from '../lib.mjs';

def('reducedmotion', 'with reduced motion on, no element has a running animation or transition longer than ~0.01s (AIG-1256)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { description: 'A test project' });
  await mkCard(s, 'alpha', 'Plain task');
  const page = await openPage(ctx, '#/p/alpha');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForSelector('.card');
  // provoke the flashes and the dots the app can show
  await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'newflash dm-dots tb-flash sc-pulse ib-item flash';
    d.innerHTML = '<span></span><span></span><span></span>'; document.body.appendChild(d);
    document.body.classList.add('ng-urgent');
  });
  await sleep(100);
  const long = await page.evaluate(() => document.getAnimations().filter(a => {
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
    return t && (t.duration > 10 || t.iterations > 1);
  }).map(a => (a.animationName || a.transitionProperty || '?') + ' ' + (a.effect.target && a.effect.target.className)));
  check('no running animation or transition longer than ~0.01s under reduced motion', long.length === 0, long);
  const sb = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  check('scroll-behavior is not smooth', sb !== 'smooth', sb);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await sleep(100);
  const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.newflash')).animationDuration);
  check('without the setting the flash keeps a normal duration', parseFloat(dur) >= 1, dur);
}, true);
