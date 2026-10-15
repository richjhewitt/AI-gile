// QA area: inforead (AIG-392): info-only hand-overs are 📖 To read: 👍 Got it / 💬 Reply instead of Accept / Send back / Wait and see.
import { BASE, check, sleep, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

def('inforead', '📖 To read: test --info / auto-detect, Got it + Reply on the card, inbox, For you and ⚡ Decide; the AI tester skips them (AIG-392)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Read me'), b = await mkCard(s, 'alpha', 'Also read'), n = await mkCard(s, 'alpha', 'Dutch note'), r = await mkCard(s, 'alpha', 'Real test'), d = await mkCard(s, 'alpha', 'Decide read');
  s.cli(['test', 'alpha', a.id, 'Anything at all, just read the note', '--info', '--as', 'Lead']);
  s.cli(['test', 'alpha', b.id, 'Nothing to click: the fix is live, read and accept', '--as', 'Lead']);
  s.cli(['test', 'alpha', n.id, 'Niets om te klikken: lees het briefje', '--as', 'Lead']);
  s.cli(['test', 'alpha', r.id, '1. Click **Go**\n2. It works', '--as', 'Lead']);
  s.cli(['test', 'alpha', d.id, 'Nothing to click: for Decide', '--as', 'Lead']);
  const get = id => getCard(s, 'alpha', id);
  check('--info marks the hand-over, steps starting "Nothing to click" (en / nl) are detected, real steps are not',
    (await get(a.id)).info === true && (await get(b.id)).info === true && (await get(n.id)).info === true && !(await get(r.id)).info);
  s.cli(['test', 'alpha', b.id, '1. Click **Go**', '--as', 'Lead']);
  check('handing the same card over again with real steps clears the mark', !(await get(b.id)).info);
  s.cli(['test', 'alpha', b.id, 'Nothing to click: read this instead', '--as', 'Lead']);
  const tests = s.cli(['tests', 'alpha']);
  check('the AI tester list leaves info-only cards out', tests.code === 0 && tests.out.includes(r.id) && !tests.out.includes(a.id) && !tests.out.includes(b.id) && !tests.out.includes(n.id), tests.out);

  // The For you column.
  const fp = await openPage(ctx, '#/p/alpha');
  await fp.waitForSelector('.column.foryou .fy-chip');
  const chip = (await fp.locator('.fy-chip', { hasText: '📖' }).first().textContent()).replace(/\s+/g, ' ').trim();
  check('For you has a 📖 To read chip with the count (4)', chip === '📖 To read 4', chip);
  const tchip = (await fp.locator('.fy-chip', { hasText: '🧪' }).first().textContent()).replace(/\s+/g, ' ').trim();
  check('the 🧪 Tests chip counts only the real test', tchip === '🧪 Tests 1', tchip);
  const robot = fp.locator('.column.foryou [id^="fyTester-"]');
  check('the 🤖 button counts only the real test', (await robot.count()) === 1 && /1/.test(await robot.textContent()), await robot.textContent());

  // The card panel: Got it + Reply, no Accept / Send back / Wait and see.
  await fp.goto(BASE + `/#/p/alpha/${a.id}`);
  await fp.waitForSelector('.verdict');
  const btns = await fp.$$eval('.verdict .actions button', bs => bs.map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  check('the card shows 👍 Got it and 💬 Reply, not Accept / Send back / Wait and see', btns.includes('👍 Got it') && btns.includes('💬 Reply') && !btns.some(x => /Accept|Send back|Wait and see/.test(x)), btns);
  await fp.click('.verdict button:has-text("Reply")');
  await fp.waitForSelector('#v-err:not(:empty)');
  check('Reply with nothing typed asks for a reply', /reply/i.test(await fp.textContent('#v-err')));
  await fp.fill('#v-text', 'Thanks, one question: is Dutch covered?');
  await fp.click('.verdict button:has-text("Reply")');
  await sleep(900);
  let ca = await get(a.id);
  check('Reply sends the note to the team and keeps it in verify', ca.status === 'verify' && ca.comments.at(-1).text === 'Thanks, one question: is Dutch covered?' && ca.comments.at(-1).author !== 'Lead', ca.comments.at(-1));
  await fp.waitForSelector('.verdict');
  await fp.click('.verdict button:has-text("Got it")');
  await sleep(900);
  ca = await get(a.id);
  check('Got it accepts: the card is done', ca.status === 'done' && ca.comments.at(-1).verdict === 'accept', ca.status);
  const bad = await fetch(BASE + `/api/projects/alpha/cards/${r.id}/verdict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: true, text: 'x' }) });
  check('a reply on a card that is not info-only is refused', bad.status === 400);

  // The inbox.
  const ip = await openPage(ctx, '#/inbox');
  await ip.waitForSelector('.ib-item.t');
  const kinds = (await ip.$$eval('.ib-kind', bs => bs.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join('|');
  check('the inbox has a 📖 To read chip with the count (3 left)', /📖 To read 3/.test(kinds) && /🧪 Test 1/.test(kinds), kinds);
  const item = ip.locator(`.ib-item[data-id="${n.id}"]`);
  const ib = (await item.locator('.actions button').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  check('the inbox item has 👍 Got it and 💬 Reply and no Accept / Wait and see', ib.includes('👍 Got it') && ib.includes('💬 Reply') && !ib.some(x => /Accept|Wait and see/.test(x)), ib);
  check('the real test keeps Accept', (await ip.locator(`.ib-item[data-id="${r.id}"] button[data-act="accept"]`).count()) === 1);
  check('the tester button counts 1 test', /1/.test(await ip.textContent('#ibTester')), await ip.textContent('#ibTester'));
  await item.locator('textarea').fill('Ok, but why?');
  await item.locator('button[data-act="inforeply"]').click();
  await sleep(900);
  check('Reply from the inbox keeps the card in verify and posts the note', (await get(n.id)).status === 'verify' && (await get(n.id)).comments.at(-1).text === 'Ok, but why?');
  // Review fix: Enter in the note is the same Reply (it used to send a plain comment and drop the item from the list).
  await item.locator('textarea').fill('And Enter?');
  await item.locator('textarea').press('Enter');
  await sleep(900);
  check('Enter in a To read note replies and the item stays', (await get(n.id)).status === 'verify' && (await get(n.id)).comments.at(-1).text === 'And Enter?' && (await item.count()) === 1);
  await item.locator('button[data-act="gotit"]').click();
  await sleep(900);
  check('Got it from the inbox moves it to done', (await get(n.id)).status === 'done');

  // ⚡ Decide.
  await ip.waitForSelector('.ib-decide');
  await ip.click('.ib-decide');
  await ip.waitForSelector('#ibDc:not([hidden]) .dc-btns');
  const dc = (await ip.$$eval('#ibDc .dc-btns button', bs => bs.map(x => x.textContent.replace(/\s+/g, ' ').trim())));
  check('⚡ Decide offers 👍 Got it on a card to read', dc.some(x => /Got it/.test(x)), dc);
  await ip.keyboard.press('1');
  await sleep(1200);
  const done = [(await get(b.id)).status, (await get(d.id)).status].filter(x => x === 'done').length;
  check('key 1 in Decide says Got it (one more card done)', done === 1, done);
  noErrors(ip); noErrors(fp);
}, true);
