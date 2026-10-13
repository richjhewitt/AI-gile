// AIG-794: one broadcast, one card per active project, replies in the chat.
import { check, mkProject, openPage, def, sleep } from '../lib.mjs';

def('allhands', 'All hands: broadcast to active projects, lock Send, show latest team replies and open cards', async (s, ctx) => {
  await mkProject(s, 'Hands One', 'HO');
  await mkProject(s, 'Hands Two', 'HT');
  await mkProject(s, 'Hands Archived', 'HA');
  await s.ok('PATCH', '/api/projects/hands-archived', { archived: true });
  const page = await openPage(ctx, '#/');
  await page.click('#dmRail [data-dms]');
  await page.waitForSelector('[data-dm="_allhands"]');
  check('All hands is the first chat', await page.locator('#dmPanel .dm-list [data-dm]').first().getAttribute('data-dm') === '_allhands');
  await page.click('[data-dm="_allhands"]');
  await page.fill('#dmText', '   ');
  await page.click('#allHandsSend');
  check('blank messages are refused', !!await page.textContent('#dmErr'));
  const text = 'Meeting ' + 'x'.repeat(90) + '\nBring your updates.';
  await page.fill('#dmText', text);
  let sends = 0, release;
  const held = new Promise(r => { release = r; });
  await page.route('**/api/allhands', async route => { sends++; await held; await route.continue(); });
  await page.click('#allHandsSend');
  check('Send asks first and sends nothing yet (AIG-943)', await page.locator('#allHandsAsk').isVisible() && /2/.test(await page.textContent('#allHandsAsk')) && sends === 0, sends);
  await page.click('#allHandsNo');
  check('Cancel sends nothing and keeps the text', sends === 0 && (await page.inputValue('#dmText')) === text);
  await page.press('#dmText', 'Enter');
  check('Enter asks too', await page.locator('#allHandsAsk').isVisible() && sends === 0);
  await page.click('#allHandsYes');
  check('Send locks immediately', await page.locator('#allHandsSend').isDisabled());
  await page.evaluate(() => { Dms.send(); Dms.send(); });
  release();
  await page.waitForFunction(() => !document.getElementById('allHandsSend').disabled);
  check('only one broadcast request was sent', sends === 1, sends);
  const active = await s.ok('GET', '/api/projects');
  const cards = [];
  for (const p of active) {
    const full = await s.ok('GET', '/api/projects/' + p.slug);
    const found = full.cards.filter(c => c.allhands);
    check('one owner team card in ' + p.slug, found.length === 1 && found[0].quick && found[0].status === 'team' && found[0].createdBy === 'Owner' && found[0].description === text && found[0].title === '📣 All hands: ' + text.split('\n')[0].slice(0, 70), found);
    cards.push({ slug: p.slug, card: found[0] });
  }
  check('archived project gets no broadcast', !(await s.ok('GET', '/api/projects/hands-archived')).cards.some(c => c.allhands));
  const one = cards.find(c => c.slug === 'hands-one'), two = cards.find(c => c.slug === 'hands-two');
  await s.ok('POST', '/api/projects/' + one.slug + '/cards/' + one.card.id + '/comments', { author: 'Lead', text: 'Earlier reply' });
  await sleep(20);
  await s.ok('POST', '/api/projects/' + two.slug + '/cards/' + two.card.id + '/comments', { author: 'Lead', text: 'Newest team reply' });
  await s.ok('POST', '/api/projects/' + two.slug + '/cards/' + two.card.id + '/comments', { author: 'Owner', text: 'Owner follow-up' });
  await page.evaluate(() => Dms.reload());
  await page.waitForFunction(() => document.getElementById('dmList').textContent.includes('Newest team reply'));
  check('latest team reply comes first, owner reply omitted', /Newest team reply/.test(await page.locator('#dmList a').first().textContent()) && !/Owner follow-up/.test(await page.textContent('#dmList')));
  await page.locator('#dmList a').first().click();
  await page.waitForURL('**/#/p/' + two.slug + '/' + two.card.id);
  check('clicking a result opens its card', page.url().endsWith('/' + two.card.id));
}, true);
