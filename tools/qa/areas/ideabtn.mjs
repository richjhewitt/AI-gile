// QA area: ideabtn (AIG-351), the idea button in the top bar.
import { check, sleep, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('ideabtn', 'idea button: on home and board; one project makes a card in For the team; All projects one each; Decide later waits in the inbox (AIG-351)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  await mkProject(s, 'Beta', 'BET');
  const cards = async slug => (await s.ok('GET', `/api/projects/${slug}`)).cards;
  const send = async (page, to, text) => {
    await page.click('#ideaBtn');
    await page.waitForSelector('#idea-text');
    await page.selectOption('#idea-to', to);
    await page.fill('#idea-text', text);
    await page.press('#idea-text', 'Control+Enter');
    await page.waitForSelector('#idea-text', { state: 'detached' });
    await sleep(300);
  };
  const home = await openPage(ctx, '#/');
  check('idea button is on the home page', await home.isVisible('#ideaBtn'));
  check('idea button has the tooltip', (await home.getAttribute('#ideaBtn', 'title')) === 'Got an idea? Jot it down');
  await home.click('#ideaBtn'); await home.waitForSelector('#idea-text');
  await home.type('#idea-text', 'kept draft');
  await home.evaluate(() => closeDialog());
  await home.click('#ideaBtn'); await home.waitForSelector('#idea-text');
  check('a closed draft comes back', (await home.inputValue('#idea-text')) === 'kept draft');
  check('on home the picker defaults to Decide later', (await home.inputValue('#idea-to')) === '_later');
  await home.evaluate(() => { document.getElementById('idea-text').value = ''; document.getElementById('idea-text').dispatchEvent(new Event('input', { bubbles: true })); closeDialog(); });
  const board = await openPage(ctx, '#/p/alpha');
  check('idea button is on the board', await board.isVisible('#ideaBtn'));
  await board.click('#ideaBtn'); await board.waitForSelector('#idea-text');
  check('on a board the picker defaults to that project', (await board.inputValue('#idea-to')) === 'alpha');
  await board.evaluate(() => closeDialog());
  await send(board, 'beta', 'Idea for beta only');
  const b1 = (await cards('beta')).filter(c => c.title.includes('Idea for beta only'));
  check('one project: a card in For the team there', b1.length === 1 && b1[0].title.startsWith('💬') && b1[0].status === 'team' && b1[0].quick, JSON.stringify(b1));
  check('and none in the other project', !(await cards('alpha')).some(c => c.title.includes('beta only')));
  await send(board, '_all', 'Idea for everyone');
  check('All projects: one card in each', (await cards('alpha')).filter(c => c.title.includes('for everyone')).length === 1 && (await cards('beta')).filter(c => c.title.includes('for everyone')).length === 1);
  await send(board, '_later', 'Idea for later');
  const l = (await cards('alpha')).filter(c => c.title.includes('for later'));
  check('Decide later: a card waiting on you, not in For the team, nobody woken', l.length === 1 && l[0].needsYou && l[0].status === 'backlog' && l[0].createdBy === 'Ideas', JSON.stringify(l));
  noErrors(home); noErrors(board);
}, true);
