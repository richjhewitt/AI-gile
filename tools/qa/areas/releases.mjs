// QA area: releases (AIG-1154): "New release" gathers the done cards since the previous release into plain-code notes grouped by type,
// "Roll back" files a checklist card of the change cards' undo steps, the page #/releases/<slug> (also phone width, dark), CLI `release`,
// owner and lead can create (others are refused), texts in en / nl / nl-BE.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { check, mkProject, mkCard, getCard, def, openPage, noErrors, until, ROOT } from '../lib.mjs';

const rel = createRequire(import.meta.url)(ROOT + '/lib/releases.js');
const OWN = { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' };   // the owner at a terminal, not a background run
const wait = ms => new Promise(r => setTimeout(r, ms));

def('releases', '🚀 releases: notes from done cards, roll-back checklist card, page, CLI, owner and lead only, language files (AIG-1154)', async (s, ctx) => {
  // who may act
  check('owner may act, a stranger may not', rel.canAct({}, '') && !rel.canAct({ team: [{ name: 'Bob', role: 'dev' }] }, 'Bob'));
  check('a lead by role or name may act', rel.canAct({ team: [{ name: 'Bob', role: 'Lead dev' }] }, 'bob') && rel.canAct({ team: [{ name: 'Team Lead' }] }, 'Team Lead'));

  await mkProject(s, 'Rel', 'REL');
  const empty = await s.ok('GET', '/api/projects/rel/releases');
  check('a new project has no releases and nothing waiting', empty.releases.length === 0 && empty.next === 0);
  check('an unknown project is a 404', (await s.api('GET', '/api/projects/nope/releases')).status === 404);
  check('a release needs a name', (await s.api('POST', '/api/projects/rel/releases', { name: '  ' })).status === 400);

  const f1 = await mkCard(s, 'rel', 'Shiny new thing', { type: 'feature', status: 'todo' });
  const b1 = await mkCard(s, 'rel', 'Crash on start', { type: 'bug', status: 'todo' });
  const c1 = await s.ok('POST', '/api/projects/rel/changes', { title: 'Move the database', undo: 'restore the old connection string' });
  const c2 = await s.ok('POST', '/api/projects/rel/changes', { title: 'Swap the proxy', undo: 'point DNS back at the old proxy' });
  const t1 = await mkCard(s, 'rel', 'Tidy the shed', { type: 'task', status: 'todo' });
  const open = await mkCard(s, 'rel', 'Not done yet', { type: 'feature', status: 'todo' });
  const chore = await mkCard(s, 'rel', '🧹 Housekeeping', { type: 'task', status: 'todo' });
  for (const c of [f1, b1, t1, chore]) await s.ok('PATCH', `/api/projects/rel/cards/${c.id}`, { status: 'done' });
  const waiting = (await s.ok('GET', '/api/projects/rel/releases')).next;
  check('done cards wait for the next release (a change card needs go / no go, chores are skipped)', waiting === 3, waiting);

  const v1 = await s.ok('POST', '/api/projects/rel/releases', { name: 'v1.0' });
  check('the release has its name and date', v1.name === 'v1.0' && !isNaN(Date.parse(v1.at)));
  check('notes group by type with titles and ids', /New \(1\)\n- Shiny new thing \(REL-\d+\)/.test(v1.notes) && /Fixed \(1\)\n- Crash on start/.test(v1.notes) && /Other \(1\)\n- Tidy the shed/.test(v1.notes), v1.notes);
  check('chores and open cards are not in the notes', !/Housekeeping|Not done yet/.test(v1.notes) && !v1.cards.includes(open.id) && !v1.cards.includes(chore.id));
  const stored = await s.ok('GET', '/api/projects/rel');
  check('stored on the project as releases', Array.isArray(stored.releases) && stored.releases[0].name === 'v1.0' && Array.isArray(stored.releases[0].cards), stored.releases);
  check('the same name again is refused (any case)', (await s.api('POST', '/api/projects/rel/releases', { name: 'V1.0' })).status === 400);
  check('nothing waits right after a release', (await s.ok('GET', '/api/projects/rel/releases')).next === 0);

  // the second release only has what is new
  await wait(30);
  const f2 = await mkCard(s, 'rel', 'Second thing', { type: 'feature', status: 'todo' });
  await s.ok('PATCH', `/api/projects/rel/cards/${f2.id}`, { status: 'done' });
  const second = s.cli(['release', 'rel', 'v1.1', '--as', 'Owner'], OWN);
  check('CLI release makes v1.1 with only the new card', second.code === 0 && /1 card/.test(second.out) && /Second thing/.test(second.out) && !/Shiny new thing/.test(second.out), second);
  check('CLI release lists both, newest first', /v1\.1[\s\S]*v1\.0/.test(s.cli(['release', 'rel']).out));
  check('CLI release by a stranger is refused', s.cli(['release', 'rel', 'v9', '--as', 'Stranger'], OWN).code !== 0);

  // roll back
  const none = await s.api('POST', '/api/projects/rel/releases/v1.1/rollback', {});
  check('rolling back a release with no change cards is refused', none.status === 400);
  // a change card in a release: the go / no-go guard needs an approved card, so put them in v1.2 by finishing them as owner "go anyway"
  const before = (await s.ok('GET', '/api/projects/rel/releases')).releases.length;
  const stash = await s.ok('GET', '/api/projects/rel');
  check('v1.0 has no change cards (they were not approved, so not done)', before === 2 && stash.releases[0].cards.every(id => id !== c1.id));
  for (const c of [c1, c2]) { await s.ok('POST', `/api/projects/rel/changes/${c.id}/submit`, {}); await s.ok('POST', `/api/projects/rel/changes/${c.id}/go-anyway`, { note: 'qa' }); await s.ok('PATCH', `/api/projects/rel/cards/${c.id}`, { status: 'done' }); }
  const r3 = await s.ok('POST', '/api/projects/rel/releases', { name: 'v1.2' });
  check('v1.2 holds both change cards under Changes', r3.cards.includes(c1.id) && r3.cards.includes(c2.id) && /Changes \(2\)/.test(r3.notes) && !/🔀/.test(r3.notes), r3);
  const cards0 = (await s.ok('GET', '/api/projects/rel?full=1')).cards.length;
  const rb = s.cli(['release', 'rel', 'v1.2', 'rollback', '--as', 'Owner'], OWN);
  check('CLI rollback files a card with 2 undo steps', rb.code === 0 && /2 undo step/.test(rb.out) && /nothing was changed in git/.test(rb.out), rb);
  const full = (await s.ok('GET', '/api/projects/rel?full=1')).cards;
  const rbCard = full.find(c => /Roll back v1\.2/.test(c.title));
  check('one new card, a checklist of the undo steps, newest change first', full.length === cards0 + 1 && rbCard && rbCard.checklist.length === 2 && rbCard.checklist[0].text === `${c2.id}: point DNS back at the old proxy` && rbCard.checklist[1].text === `${c1.id}: restore the old connection string`, rbCard);
  check('the release remembers its roll-back card', (await s.ok('GET', '/api/projects/rel/releases')).releases[0].rollback === rbCard.id);
  check('a second roll back is refused, no second card', (await s.api('POST', '/api/projects/rel/releases/v1.2/rollback', {})).status === 400 && (await s.ok('GET', '/api/projects/rel?full=1')).cards.length === cards0 + 1);
  check('an unknown release is a 404', (await s.api('POST', '/api/projects/rel/releases/v7/rollback', {})).status === 404);

  // language files
  for (const f of ['en', 'nl', 'nl-BE']) {
    const d = JSON.parse(fs.readFileSync(ROOT + `/public/lang/${f}.json`, 'utf8'));
    check(`${f}.json has the release texts`, ['rel.title', 'rel.new', 'rel.rb', 'srv.rel.new', 'srv.rel.rb.title', 'srv.rel.rb.desc'].every(k => d[k]));
  }

  // the page
  const page = await openPage(ctx, '#/releases/rel');
  await page.waitForLoadState('load');
  check('the page lists the releases with notes', !!(await until(() => page.$('.rel-row'), 10000)) && (await page.$$('.rel-row')).length === 3 && /Second thing/.test(await page.$eval('.rel-list', e => e.textContent)));
  check('the release with a roll-back card links to it, others with changes have none', (await page.$$('.rel-rbcard')).length === 1 && (await page.$$('.rel-rb')).length === 0);
  await page.fill('#relName', 'v2.0');
  await page.click('.rel-new');
  check('New release on the page adds the release', !!(await until(async () => (await page.$$('.rel-row')).length === 4, 8000)) && (await s.ok('GET', '/api/projects/rel/releases')).releases[0].name === 'v2.0');
  await page.fill('#relName', 'v2.0'); await page.click('.rel-new');
  check('a repeated name shows the error on the page', !!(await until(() => page.$('.rel-err'), 8000)));

  const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
  try {
    const pp = await ph.newPage(); await pp.goto(page.url());
    await pp.waitForSelector('.rel-row', { timeout: 10000 });
    const fit = await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.rel-page *')].every(e => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= 0 && r.right <= innerWidth + 1); }));
    check('phone width, dark: the page fits the screen', fit);
  } finally { await ph.close(); }
  page.errors = page.errors.filter(e => !/status of 400/.test(e));   // the refused repeated name is the one expected 400
  await noErrors(page);
}, true);
