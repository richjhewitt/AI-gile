// QA area: calmpoll (AIG-1103): a hidden window polls at most every 30 s, and a pop-out skips the home-only polls.
import { check, sleep, mkProject, openPage, def } from '../lib.mjs';

def('calmpoll', 'A hidden window slows its polling to 30 s or pauses it; pop-outs skip the home polls (AIG-1103)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('header');
  const run = (hidden, hash, opts) => page.evaluate(async ([hidden, hash, opts]) => {
    const was = location.hash;
    if (hash) history.replaceState(null, '', hash);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    let n = 0;
    const stop = PagePoll.every(() => { n++; }, 40, opts);
    await new Promise(r => setTimeout(r, 700));
    stop();
    delete document.hidden;
    history.replaceState(null, '', was);
    return n;
  }, [hidden, hash, opts]);
  check('a visible window polls at its own pace', (await run(false, '', { immediate: true })) >= 5);
  check('a hidden window with no hidden pace pauses', (await run(true, '', { immediate: true })) === 0);
  check('a hidden pace of 5 ms is held to 30 s (the first tick only)', (await run(true, '', { hidden: 5, immediate: true })) <= 1);
  check('a home poll runs in the main window', (await run(false, '', { home: true, immediate: true })) >= 5);
  check('a home poll stays off in a pop-out', (await run(false, '#/pop/alpha/ALP-1', { home: true, immediate: true })) === 0);
  check('a card poll still runs in a pop-out', (await run(false, '#/pop/alpha/ALP-1', { immediate: true })) >= 5);
}, true);
