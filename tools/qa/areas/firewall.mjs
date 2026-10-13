// QA area: firewall (AIG-839): duplicates, "Original:" copies and empty pokes from the team are kept in data/firewall.conf, not the card.
import { check, tmp, mkProject, mkCard, getCard, say, def, openPage, noErrors, until } from '../lib.mjs';

def('firewall', 'message firewall: same text twice, Original: copies, empty pokes are kept out and listed in GET /api/firewall; owner and real replies pass (AIG-839)', async (s, ctx) => {
  await mkProject(s, 'Wall', 'WAL', { path: tmp('fw') });
  const a = await mkCard(s, 'wall', 'First'), b = await mkCard(s, 'wall', 'Second');
  const url = id => `/api/projects/wall/cards/${id}/comments`;

  await say(s, 'wall', a.id, 'Dev', 'Build is green');
  const r = await s.ok('POST', url(a.id), { author: 'Dev', text: 'Build   is green\n' });
  check('the same text again (whitespace aside) is caught with a clear result', r.firewalled && r.reason === 'duplicate' && /kept out by the firewall: duplicate/.test(r.message), r);
  check('the card did not get the copy', (await getCard(s, 'wall', a.id)).comments.length === 1);
  await say(s, 'wall', b.id, 'Dev', 'Build is green');
  check('the same text on another card is fine', (await getCard(s, 'wall', b.id)).comments.length === 1);

  const o1 = await s.ok('POST', url(a.id), { author: 'Lead', text: 'Original: make it faster' });
  const o = await s.ok('POST', url(a.id), { author: 'Lead', text: 'Original: make it quicker' });
  check('the first "Original:" note passes, a second one is caught', !o1.firewalled && o.firewalled && o.reason === 'original', [o1, o]);
  const e = await s.ok('POST', url(a.id), { author: 'Dev', text: ' 👉 ... ' });
  check('an empty poke is caught', e.firewalled && e.reason === 'empty', e);
  const own = await s.ok('POST', url(a.id), { author: 'Owner', text: 'Build is green' });
  check('the owner is never caught', !own.firewalled, own);
  const again = await s.ok('POST', url(a.id), { author: 'Dev', text: 'Build is green' });
  check('after the owner has replied the same words are a new message', !again.firewalled, again);

  await s.ok('POST', url(b.id), { author: 'Lead', text: 'Which colour?', needsYou: true, mark: 'ask' });
  const bump = await s.ok('POST', url(b.id), { author: 'Lead', text: 'Which colour?', needsYou: true, mark: 'ask' });
  check('a re-sent ask is still a bump, not a catch', bump.bumped && !bump.firewalled, bump);

  const c1 = await s.ok('POST', '/api/projects/wall/leadchat', { author: 'Lead', text: 'Morning' });
  const c2 = await s.ok('POST', '/api/projects/wall/leadchat', { author: 'Lead', text: 'Morning' });
  check('Lead chat: a repeated reply is caught', !c1.firewalled && c2.firewalled && c2.reason === 'duplicate', [c1, c2]);
  check('Lead chat holds only one', (await s.ok('GET', '/api/projects/wall/leadchat')).messages.length === 1);

  const list = await s.ok('GET', '/api/firewall');
  check('GET /api/firewall lists the catches newest first with time, project, card, author, kind, text', list.items.length === 4 && list.items[0].kind === 'chat' && list.items.every(x => x.at && x.project === 'wall' && x.author && x.kind && x.text !== undefined) && list.items.some(x => x.card === a.id), list);
  check('the project filter works', (await s.ok('GET', '/api/firewall?project=nothere')).items.length === 0);

  const cli = s.cli(['comment', 'wall', b.id, 'Build is green', '--as', 'Dev']);
  check('the CLI says it was kept out', /kept out by the firewall: duplicate/.test(cli.out), cli);

  // AIG-841: one card per cause (kind + agent) in the backlog, repeats bump a count, never for the owner's inbox.
  const fwCards = async () => (await s.ok('GET', '/api/projects/wall')).cards.filter(c => c.fwCause);
  let fc = await fwCards();
  const dupLead = fc.filter(c => c.fwCause === 'duplicate|Lead'), dupDev = fc.filter(c => c.fwCause === 'duplicate|Dev');
  check('one card per cause, not per message', dupLead.length === 1 && dupDev.length === 1 && fc.length === 4, fc.map(c => c.fwCause));
  check('card is a normal bug in the backlog with the plain title, not for the owner', dupLead[0].type === 'bug' && dupLead[0].priority === 'normal' && dupLead[0].status === 'backlog' && !dupLead[0].needsYou && dupLead[0].title === '🧱 Firewall: Lead sends duplicates', dupLead[0]);
  check('repeats bump the count on that card (Dev was caught twice)', dupDev[0].fwCount === 2 && /kept 2 messages from Dev/.test(dupDev[0].description), dupDev[0]);
  await s.ok('POST', '/api/projects/wall/leadchat', { author: 'Lead', text: 'Morning' });
  fc = await fwCards();
  check('a new repeat gives no new card', fc.length === 4 && fc.find(c => c.fwCause === 'duplicate|Lead').fwCount === 2, fc.map(c => [c.fwCause, c.fwCount]));

  // AIG-840: the bin counts, and "Let it through" posts the message once and takes it out of the bin.
  const bin = await s.ok('GET', '/api/firewall');
  check('the bin counts what was kept away, and today', bin.kept === bin.items.length && bin.kept >= 6 && bin.today === bin.kept, [bin.kept, bin.today]);
  const target = bin.items.find(x => x.kind === 'comment' && x.card === b.id && x.reason === 'duplicate');
  const before = (await getCard(s, 'wall', b.id)).comments.length;
  const rel = await s.ok('POST', `/api/firewall/${target.id}/release`);
  const after = await getCard(s, 'wall', b.id);
  check('Let it through posts it as sent, bypassing the firewall once', rel.released && after.comments.length === before + 1 && after.comments[after.comments.length - 1].text === target.text && after.comments[after.comments.length - 1].author === 'Dev', after.comments);
  check('and removes it from the bin', (await s.ok('GET', '/api/firewall')).items.every(x => x.id !== target.id) && (await s.ok('GET', '/api/firewall')).kept === bin.kept - 1);
  const twice = await s.api('POST', `/api/firewall/${target.id}/release`);
  check('releasing it twice is refused', twice.status === 404, twice.status);
  const chatMsg = bin.items.find(x => x.kind === 'chat');
  await s.ok('POST', `/api/firewall/${chatMsg.id}/release`);
  check('a Lead chat message is let through into the chat', (await s.ok('GET', '/api/projects/wall/leadchat')).messages.length === 2);

  // The bin page: reached from the inbox link, phone width, dark mode.
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibBin');
  await until(() => page.evaluate(() => /\(\d+\)/.test(document.getElementById('ibBin').textContent)));
  const link = await page.textContent('#ibBin');
  check('the inbox has a small Bin link with the count', /Bin \(\d+\)/.test(link), link);
  await page.click('#ibBin');
  await page.waitForSelector('.bin-item');
  const head = await page.textContent('.bin-count');
  check('the bin page shows "Kept away N (M today)"', /^Kept away \d+ \(\d+ today\)$/.test(head.trim()), head);
  const row = await page.textContent('.bin-item');
  check('each entry shows when, project, author and why', /wall/.test(row) && /(Lead|Dev)/.test(row) && /Why:/.test(row), row);
  await page.setViewportSize({ width: 390, height: 800 });
  check('phone width: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.emulateMedia({ colorScheme: 'dark' });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('dark mode: page is dark', bg.match(/\d+/g).slice(0, 3).every(n => Number(n) < 90), bg);
  const n0 = await page.locator('.bin-item').count();
  await page.click('.bin-let');
  await until(async () => (await page.locator('.bin-item').count()) === n0 - 1);
  check('clicking Let it through removes the entry', (await page.locator('.bin-item').count()) === n0 - 1);
  noErrors(page);
  await page.close();
}, true);
