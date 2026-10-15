// QA area: risk (AIG-612): a risk label on cards; risky = plan first.
import { check, sleep, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('risk', '⚠️ risk label: set by CLI and card page, chip on the board, brief note, risky card cannot go to doing without an approved plan (AIG-612)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const a = await mkCard(s, 'alpha', 'Plain card', { status: 'todo' });
  const b = await mkCard(s, 'alpha', 'Dangerous change', { status: 'todo' });
  const c = await mkCard(s, 'alpha', 'Tiny tweak', { status: 'todo' });
  const d = await mkCard(s, 'alpha', 'Born risky', { status: 'todo', risk: 'risky' });
  check('a card with no risk reads as normal', !a.risk);
  check('a card can be created risky', d.risk === 'risky');
  check('a bad risk is refused', (await s.api('PATCH', `/api/projects/alpha/cards/${a.id}`, { risk: 'huge' })).status === 400);

  // CLI
  const set = s.cli(['risk', 'alpha', b.id, 'risky', '--as', 'Lead']);
  check('risk risky via the CLI', set.code === 0 && (await getCard(s, 'alpha', b.id)).risk === 'risky', set);
  s.cli(['risk', 'alpha', c.id, 'small', '--as', 'Lead']);
  check('risk small via the CLI', (await getCard(s, 'alpha', c.id)).risk === 'small');
  check('a bad risk is refused in the CLI', s.cli(['risk', 'alpha', a.id, 'huge']).code !== 0);
  const add = s.cli(['add', 'alpha', 'Added risky', '--risk', 'risky', '--json']);
  check('add --risk risky', add.code === 0 && JSON.parse(add.out).risk === 'risky', add);

  // Brief and next
  const br = s.cli(['brief', 'alpha']).out;
  const riskyLine = br.split('\n').find(l => l.includes('Dangerous change')) || '';
  check('the brief marks the risky card: plan first', /risky: post the plan with aigile ask/.test(riskyLine) && /reviewer one model up/.test(riskyLine), riskyLine);
  check('the brief does not mark the plain card', !(br.split('\n').find(l => l.includes('Plain card')) || '').includes('risky'));
  check('next marks it too', /Dangerous change.*risky: post the plan/.test(s.cli(['next', 'alpha']).out));

  // Move to doing is refused until the plan is approved
  const no = s.cli(['move', 'alpha', b.id, 'doing', '--as', 'Backend']);
  const txt = no.out + (no.err || '');
  check('moving a risky card to doing is refused', no.code !== 0 && /risky: post the plan first/.test(txt), no);
  check('and it stayed in todo', (await getCard(s, 'alpha', b.id)).status === 'todo');
  const owner = (txt.match(/wait for (.+?)'s OK/) || [])[1] || 'Owner';
  await say(s, 'alpha', b.id, owner, 'ok go');   // owner comment, but no Lead plan before it
  check('an owner comment alone is not enough', s.cli(['move', 'alpha', b.id, 'doing', '--as', 'Backend']).code !== 0);
  await say(s, 'alpha', b.id, 'Lead', 'Plan: change the loader, then the tests');
  check('a Lead plan alone is not enough', s.cli(['move', 'alpha', b.id, 'doing', '--as', 'Backend']).code !== 0);
  await say(s, 'alpha', b.id, owner, 'Looks good, go');
  const yes = s.cli(['move', 'alpha', b.id, 'doing', '--as', 'Backend']);
  check('a Lead plan then an owner comment lets it move', yes.code === 0 && (await getCard(s, 'alpha', b.id)).status === 'doing', yes);
  // --planned
  const pl = s.cli(['move', 'alpha', d.id, 'doing', '--planned', '--as', 'Lead']);
  const dd = await getCard(s, 'alpha', d.id);
  check('--planned moves it and logs the approval', pl.code === 0 && dd.status === 'doing' && dd.comments.some(m => /Plan approved by .+ \(risky card\)/.test(m.text)), pl);
  check('a small card moves freely', s.cli(['move', 'alpha', c.id, 'doing', '--as', 'Backend']).code === 0);

  // Page
  const board = await openPage(ctx, '#/p/alpha');
  await board.waitForSelector('.card');
  check('the risky card shows a ⚠️ chip on the board', (await board.locator(`.card[data-id="${b.id}"] .pill.risky`).count()) === 1);
  check('the small and plain cards show none', (await board.locator(`.card[data-id="${c.id}"] .pill.risky, .card[data-id="${a.id}"] .pill.risky`).count()) === 0);
  const page = await openPage(ctx, `#/p/alpha/${a.id}`);
  await page.evaluate(() => editCard());
  await page.waitForSelector('#f-risk');
  check('the card page offers the risk choice, normal by default', (await page.inputValue('#f-risk')) === 'normal');
  await page.selectOption('#f-risk', 'risky');
  await page.click('form[onsubmit] button[type=submit]');
  await sleep(800);
  check('setting risky on the card page saves', (await getCard(s, 'alpha', a.id)).risk === 'risky');
  await noErrors(page);
}, true);
