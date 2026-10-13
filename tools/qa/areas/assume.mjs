// QA area: assume (AIG-477, AIG-478): the assumptions log (aigile assume / comment --assume, the Assumptions page with its badge,
// 👍 fine and ✋ plug this) and the night watch refilling an empty To do from ready high-priority backlog cards.
import { check, sleep, until, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('assume', '🌙 assumptions log: assume + comment --assume, the page and its badge, 👍 fine, ✋ plug this wakes the card; empty To do refilled from ready high backlog (AIG-477, AIG-478)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('asm1') });
  await mkProject(s, 'Beta', 'BET', { path: tmp('asm2') });
  const a = await mkCard(s, 'alpha', 'Pick a colour'), b = await mkCard(s, 'beta', 'Old guess');
  s.cli(['assume', 'alpha', a.id, 'Blue is fine, nobody objected', '--as', 'Lead']);
  await sleep(1100);
  const r = s.cli(['comment', 'beta', b.id, 'API stays v1', '--assume', '--as', 'Lead']);
  check('comment --assume is logged', /commented/.test(r.out), r);
  s.cli(['comment', 'beta', b.id, 'just a normal comment', '--as', 'Lead']);
  const l = await s.ok('GET', '/api/assumptions');
  check('both stored with mark assume, the plain comment left out', l.length === 2 && (await getCard(s, 'beta', b.id)).comments.some(m => m.mark === 'assume' && /^Assumption: API stays v1/.test(m.text)), l);
  const bad = await s.api('POST', '/api/assumptions/resolve', { slug: 'alpha', id: a.id, at: l[0].at, state: 'card' });
  check('only ok and plug are answers', bad.status === 400, bad);

  const page = await openPage(ctx, '#/assumptions');
  await page.waitForSelector('.as-item');
  const heads = await page.$$eval('.uz h3', e => e.map(x => x.firstChild.textContent.trim()));
  check('newest first, grouped by project', heads.join() === 'Beta,Alpha', heads);
  check('the badge counts unreviewed entries', !!(await page.waitForFunction(() => document.getElementById('assumeBadge')?.textContent === '2', null, { timeout: 5000 }).catch(() => null)));
  await page.click('.as-item:has-text("Blue") .as-ok');
  await page.waitForFunction(() => document.getElementById('assumeBadge')?.textContent === '1', null, { timeout: 5000 });
  check('👍 fine marks it ok', (await s.ok('GET', '/api/assumptions')).find(x => x.slug === 'alpha').state === 'ok');
  await page.click('.as-item:has-text("API stays") .as-plug');
  await page.fill('.as-reply', 'Use v2 instead');
  await page.click('.as-send');
  await page.waitForFunction(() => document.getElementById('assumeBadge')?.hidden, null, { timeout: 5000 });
  const last = (await getCard(s, 'beta', b.id)).comments.at(-1);
  check('✋ plug this sends the reply to the card as the owner', /Use v2 instead/.test(last.text) && last.author === (await s.ok('GET', '/api/meta')).owner, last);
  check('and marks it plugged', (await s.ok('GET', '/api/assumptions')).find(x => x.slug === 'beta').state === 'plug');
  check('a just-marked entry keeps its undo for now (AIG-884)', (await page.locator('.as-item:has-text("API stays") button').count()) === 1);
  noErrors(page);

  // AIG-526: structured assumptions, grouped per card with a summary and an Open link.
  const sc = await mkCard(s, 'alpha', 'Holiday party lines', { description: 'Hourly party lines only for the holiday card.\nSecond line that stays out.' });
  const rs = s.cli(['assume', 'alpha', sc.id, '--decided', 'Which strains go on the card', '--options', 'all|hourly only', '--chose', 'Hourly only', '--why', 'Less clutter', '--if-plugged', 'Add the rest back', '--as', 'Lead']);
  check('structured assume is logged', /logged an assumption/.test(rs.out), rs);
  s.cli(['comment', 'alpha', sc.id, '--assume', '--chose', 'Keep v1', '--why', 'Nobody asked', '--as', 'Lead']);
  s.cli(['assume', 'alpha', sc.id, 'A plain old line', '--as', 'Lead']);
  const st = (await getCard(s, 'alpha', sc.id)).comments.filter(m => m.mark === 'assume');
  check('fields stored on the comment, plain form stored as chose', st.length === 3 && st[0].assume.decided === 'Which strains go on the card' && st[0].assume.options.join() === 'all,hourly only' && st[0].assume.ifNo === 'Add the rest back' && st[2].assume.chose === 'A plain old line', st);
  const p2 = await openPage(ctx, '#/assumptions');
  await p2.waitForSelector('.as-card');
  const cardEl = p2.locator('.as-card', { hasText: 'Holiday party lines' });
  check('entries marked before are gone once the undo window has passed (AIG-884)', (await p2.locator('.as-item', { hasText: /Blue is fine|API stays/ }).count()) === 0 && (await p2.$$eval('.uz h3', e => e.length)) === 2);
  check('one card group holds its three entries, with summary and Open link', (await cardEl.locator('.as-item').count()) === 3 && /Hourly party lines only for the holiday card\./.test(await cardEl.locator('.as-sum').textContent()) && !/Second line/.test(await cardEl.textContent()) && /#\/p\/alpha\//.test(await cardEl.locator('.as-open').getAttribute('href')));
  const ft = await cardEl.textContent();
  check('entries read Had to decide / Options / We chose / Why / If you plug it', ['Had to decide:', 'Options:', 'We chose:', 'Why:', 'If you plug it:', 'all / hourly only', 'Add the rest back', 'A plain old line'].every(x => ft.includes(x)), ft);
  check('👍 Fine and ✋ Plug this are still there', (await cardEl.locator('.as-ok').count()) === 3 && (await cardEl.locator('.as-plug').count()) === 3);
  noErrors(page);

  // AIG-478: a watched team with an empty To do pulls ready urgent/high backlog cards, and says why as an assumption.
  await mkProject(s, 'Dry', 'DRY', { path: tmp('asm3') });
  const hi = await mkCard(s, 'dry', 'Ready and high', { status: 'backlog', priority: 'high' });
  const lo = await mkCard(s, 'dry', 'Ready but normal', { status: 'backlog', priority: 'normal' });
  const ask = await mkCard(s, 'dry', 'Needs an answer', { status: 'backlog', priority: 'urgent' });
  s.cli(['ask', 'dry', ask.id, 'Which one?', '--as', 'Lead']);
  await s.ok('POST', '/api/quiet', { on: true, watch: ['dry'] });
  await sleep(4500);
  await s.ok('POST', '/api/watchman/round');
  const moved = await until(async () => (await getCard(s, 'dry', hi.id)).status !== 'backlog', 8000);
  check('the ready high card moved up with an assumption saying why', moved && (await getCard(s, 'dry', hi.id)).comments.some(m => m.mark === 'assume' && /ran dry/.test(m.text)), await getCard(s, 'dry', hi.id));
  check('a normal card and one waiting on the owner stay in backlog', (await getCard(s, 'dry', lo.id)).status === 'backlog' && (await getCard(s, 'dry', ask.id)).status === 'backlog');
  await s.ok('POST', '/api/quiet', { on: false });
}, true);
