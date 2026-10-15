// QA area: hyperfocus (AIG-871): the 🎯 Hyperfocus button on a board shows only that project (rail, home, inbox) and the DMs;
// the top-bar chip turns it off; the swarm still works on top of it.
import { check, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('hyperfocus', '🎯 Hyperfocus: rail, home and inbox show only that project; the chip turns it off; swarm still works (AIG-871)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  await mkCard(s, 'alpha', 'Alpha question', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', 'ALP-1', 'Forge', 'which colour?', { needsYou: true });
  await mkCard(s, 'beta', 'Beta question', { status: 'doing', assignee: 'Forge' });
  await say(s, 'beta', 'BET-1', 'Forge', 'beta ask?', { needsYou: true });
  const rail = page => page.$$eval('#dmRail [data-slug]', els => els.map(e => e.dataset.slug).filter((v, i, a) => a.indexOf(v) === i).sort());
  const homeCards = page => page.$$eval('#app .proj[data-pslug]', els => els.map(e => e.dataset.pslug).sort());
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('#dmRail [data-slug=beta]');
  check('both projects in the rail at first', JSON.stringify(await rail(page)) === '["alpha","beta"]', await rail(page));
  check('no chip at first', !(await page.$('#hfTop .hf-chip')));
  await page.click('#hfBtn');
  await page.waitForSelector('#hfTop .hf-chip');
  check('the chip names the project', /Hyperfocus: Alpha/.test(await page.textContent('#hfTop .hf-chip')), await page.textContent('#hfTop'));
  await page.waitForFunction(() => !document.querySelector('#dmRail [data-slug=beta]'));
  check('rail shows only alpha', JSON.stringify(await rail(page)) === '["alpha"]', await rail(page));
  check('DMs, home and inbox buttons stay', !!(await page.$('#dmRail [data-dms]')) && !!(await page.$('#dmRail [data-go="#/"]')) && !!(await page.$('#dmRail [data-go="#/inbox"]')));
  check('server keeps it', (await s.ok('GET', '/api/hyperfocus')).slug === 'alpha');
  await page.click('#dmRail [data-go="#/"]');
  await page.waitForSelector('#app .proj[data-pslug=alpha]');
  check('home shows only alpha', JSON.stringify(await homeCards(page)) === '["alpha"]', await homeCards(page));
  await page.click('#dmRail [data-go="#/inbox"]');
  await page.waitForSelector('#ibTabs button');
  const tabs = await page.$$eval('#ibTabs button', els => els.map(e => e.dataset.tab));
  check('inbox has no beta tab', !tabs.includes('beta') && tabs.includes('alpha'), tabs);
  // swarm on top of it still works, and ends back into hyperfocus
  await s.ok('POST', '/api/swarm', { slug: 'beta', by: 'Lead' });
  await page.waitForSelector('#swarmBar:not([hidden])');
  await page.waitForFunction(() => !document.querySelector('#dmRail [data-slug=alpha]') && document.querySelector('#dmRail [data-slug=beta]'));
  check('swarm shows its own project', JSON.stringify(await rail(page)) === '["beta"]', await rail(page));
  await s.ok('POST', '/api/swarm', { off: true });
  await page.waitForFunction(() => document.querySelector('#dmRail [data-slug=alpha]') && !document.querySelector('#dmRail [data-slug=beta]'));
  check('after the swarm, hyperfocus is still on', JSON.stringify(await rail(page)) === '["alpha"]', await rail(page));
  await page.click('#hfTop .hf-chip button');
  await page.waitForSelector('#dmRail [data-slug=beta]');
  check('off: the chip is gone and the rail is back', !(await page.$('#hfTop .hf-chip')) && JSON.stringify(await rail(page)) === '["alpha","beta"]', await rail(page));
  check('server is off', !(await s.ok('GET', '/api/hyperfocus')).on);
  await page.click('#dmRail [data-go="#/"]');
  await page.waitForSelector('#app .proj[data-pslug=beta]');
  check('home shows both again', JSON.stringify(await homeCards(page)) === '["alpha","beta"]', await homeCards(page));
  noErrors(page);
}, true);
