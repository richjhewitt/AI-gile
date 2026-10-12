// QA area: follow (AIG-426): the chat follows the lead to the next card.
import { check, sleep, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

const popOf = async (ctx, main, id) => { const w = ctx.waitForEvent('page'); await main.evaluate(i => window.open('#/pop/alpha/' + i, 'aigile-alpha-' + i, 'width=560,height=780'), id); const pop = await w; pop.errors = []; pop.on('pageerror', e => pop.errors.push(String(e))); return pop; };

def('follow', 'the chat follows the lead: followUp on the closed card, Go to button, auto-follow after 3 s unless you typed or stay (AIG-426)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await s.ok('POST', '/api/projects/alpha/team', { name: 'Lead', role: 'Lead' });
  await mkCard(s, 'alpha', 'First job', { status: 'doing', assignee: 'Lead' });
  await mkCard(s, 'alpha', 'Second job', { status: 'doing', assignee: 'Lead' });
  await mkCard(s, 'alpha', 'Third job', { status: 'doing', assignee: 'Lead' });
  // Server rule: the lead's last comment on a closing card that names another card of the project
  await say(s, 'alpha', 'ALP-1', 'Lead', 'All done. Next step (ALP-2): the second job');
  check('no followUp while the card is still open', !(await getCard(s, 'alpha', 'ALP-1')).followUp);
  await s.ok('PATCH', '/api/projects/alpha/cards/ALP-1', { status: 'done' });
  check('closing it records followUp: ALP-2', (await getCard(s, 'alpha', 'ALP-1')).followUp === 'ALP-2');
  await say(s, 'alpha', 'ALP-3', 'Lead', 'Finished, nothing else, see OTHER-9 and ALP-3');
  await s.ok('PATCH', '/api/projects/alpha/cards/ALP-3', { status: 'done' });
  check('naming itself or other projects is not a follow', !(await getCard(s, 'alpha', 'ALP-3')).followUp);
  s.cli(['next-card', 'alpha', 'ALP-3', 'ALP-2', '--as', 'Lead']);
  check('aigile next-card sets it explicitly', (await getCard(s, 'alpha', 'ALP-3')).followUp === 'ALP-2');
  const bad = await s.api('POST', '/api/projects/alpha/cards/ALP-3/followup', { to: 'ALP-99' });
  check('next-card to a card that does not exist is refused', bad.status === 400, bad.status);
  await say(s, 'alpha', 'ALP-1', 'Owner', 'ok, see ALP-3');
  check('the owner\'s words never change it', (await getCard(s, 'alpha', 'ALP-1')).followUp === 'ALP-2');

  // Page: auto-follow in a pop-out after 3 s
  const main = await openPage(ctx, '#/p/alpha');
  const page = await popOf(ctx, main, 'ALP-1');
  await page.waitForSelector('.follow-bar', { timeout: 6000 });
  check('shows → Go to ALP-2 and the stay link', /ALP-2/.test(await page.textContent('.follow-go')) && await page.locator('[data-follow-stay]').count() === 1);
  await sleep(1000);
  check('it does not jump straight away', /pop\/alpha\/ALP-1/.test(page.url()));
  await page.waitForFunction(() => location.hash === '#/pop/alpha/ALP-2', null, { timeout: 6000 }).catch(() => {});
  check('after 3 s the pop-out follows the lead to ALP-2', /pop\/alpha\/ALP-2/.test(page.url()), page.url());
  noErrors(page);

  // Typing keeps you here; the button still works
  const p2 = await popOf(ctx, main, 'ALP-3');
  await p2.waitForSelector('.follow-bar');
  await p2.fill('#r-text', 'half a thought');
  await sleep(4500);
  check('typed text stops the auto-follow', /pop\/alpha\/ALP-3/.test(p2.url()) && await p2.locator('.follow-go').count() === 1, p2.url());
  await p2.click('.follow-go');
  await p2.waitForFunction(() => location.hash === '#/pop/alpha/ALP-2', null, { timeout: 4000 }).catch(() => {});
  check('the button goes at once', /pop\/alpha\/ALP-2/.test(p2.url()));

  // Stay here cancels
  const p3 = await openPage(ctx, '#/p/alpha/ALP-1');
  await p3.waitForSelector('.follow-bar [data-follow-stay]');
  await p3.click('[data-follow-stay]');
  await sleep(4000);
  check('stay here cancels the auto-follow, the button stays', /p\/alpha\/ALP-1/.test(p3.url()) && await p3.locator('.follow-go').count() === 1 && await p3.locator('.follow-note').count() === 0, p3.url());

  // Setting: just show the button
  const p4 = await openPage(ctx, '#/setup');
  await p4.waitForSelector('#followMode');
  check('Setup has the follow setting, automatic by default', (await p4.inputValue('#followMode')) === 'auto');
  await p4.selectOption('#followMode', 'button');
  await p4.evaluate(() => { location.hash = '#/p/alpha/ALP-3'; });
  await p4.waitForSelector('.follow-bar');
  check('just-the-button mode has no countdown note', await p4.locator('.follow-note').count() === 0);
  await sleep(4000);
  check('and does not jump', /p\/alpha\/ALP-3/.test(p4.url()), p4.url());

  await p4.evaluate(() => localStorage.setItem('aigile.followMode', 'auto'));
  // Lead DM chat
  const q1 = await mkCard(s, 'alpha', '💬 first', { description: 'hello', status: 'team', createdBy: 'Owner', quick: true });
  const q2 = await mkCard(s, 'alpha', '💬 next', { description: 'carry on', status: 'team', createdBy: 'Owner', quick: true });
  await say(s, 'alpha', q1.id, 'Lead', `Done. Next step (${q2.id}): continuing there`);
  await s.ok('PATCH', `/api/projects/alpha/cards/${q1.id}`, { status: 'done' });
  await say(s, 'alpha', q2.id, 'Lead', 'On it');
  const p5 = await openPage(ctx, '#/');
  await p5.click('#dmRail [data-dms]');
  await p5.waitForSelector('#dmPanel [data-dm="alpha"]');
  await p5.click('#dmPanel [data-dm="alpha"]');
  await p5.waitForSelector('#dmList .dm-fold');
  await p5.click(`#dmList [data-fold="${q1.id}"]`);
  await p5.waitForSelector('#dmFollow .follow-bar', { timeout: 6000 });
  check('the lead chat shows the Go to button on the closed card', new RegExp(q2.id).test(await p5.textContent('#dmFollow .follow-go')));
  await p5.waitForFunction(id => document.querySelector(`#dmList .dm-fold.open [data-fold="${id}"]`), q2.id, { timeout: 7000 }).catch(() => {});
  check('after 3 s the chat opens the next card (button-only setting is per browser, so this page follows)', await p5.locator(`#dmList .dm-fold.open [data-fold="${q2.id}"]`).count() === 1);
  noErrors(p5);
}, true);
