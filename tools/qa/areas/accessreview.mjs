// QA area: accessreview (AIG-1127, lib/accessreview.js): every 90 days (data/accessreview.stub stands in for today) ONE card lists live
// share links, friends' change roles and kept secrets by name with Keep / Remove; Remove ends the link / deletes the secret; no value shows.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

const SECDIR = tmp('accessreview-secrets');
const VALUE = 'hunter2-QA-AccessReview-Value';
const LINK = 'AbCdEfGhIjKlMnOpQrSt_-';

def('accessreview', '🔐 every 90 days one card lists share links, friends\' roles and kept secrets by name with Keep / Remove; Remove ends the link and deletes the secret; no secret value appears (AIG-1127)', async (s, ctx) => {
  await mkProject(s, 'Arview', 'ARV');
  await mkProject(s, 'Shared', 'SHD');
  fs.mkdirSync(path.join(s.data, 'shares'), { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(s.data, 'shares', LINK + '.json'), JSON.stringify({ id: LINK, contact: 'c-friend', friend: 'Fiona Friend', slug: 'shared', state: 'live', created: now, since: now, exp: Date.now() + 864e5, on: true, role: 'member',
    mine: { send: true, take: true, comments: true, status: true, files: true }, theirs: { send: true, take: true, comments: true, status: true, files: true } }));
  const card0 = await mkCard(s, 'arview', 'Deploy the thing', { type: 'task' });
  s.cli(['secret', 'ask', 'arview', card0.id, 'QA_TOKEN', 'to call the deploy API', '--as', 'Forge']);
  const tok = (await s.ok('GET', '/api/secrets/token')).token;
  await s.ok('POST', '/api/secrets/save', { token: tok, slug: 'arview', name: 'QA_TOKEN', value: VALUE });

  // The 90-day timer, with a date stub
  const stub = d => fs.writeFileSync(path.join(s.data, 'accessreview.stub'), d);
  stub('2026-01-01');
  const r0 = await s.ok('POST', '/api/accessreview/check', {});
  check('the first check only starts the count (no card)', r0.due === false && r0.started === true && !(await s.ok('GET', '/api/projects/arview')).cards.some(c => c.from === 'access review'), r0);
  stub('2026-03-01');
  check('59 days later nothing is due', (await s.ok('POST', '/api/accessreview/check', {})).due === false);
  stub('2026-04-02');
  const r1 = await s.ok('POST', '/api/accessreview/check', {});
  check('after 90 days the card is made, once', r1.due === true && r1.created === true && r1.items >= 2, r1);
  check('the same day again is not due', (await s.ok('POST', '/api/accessreview/check', {})).due === false);
  const r2 = await s.ok('POST', '/api/accessreview/run', {});
  check('Run now refreshes the open card, never a second one', r2.card === r1.card && r2.created === false && (await s.ok('GET', '/api/projects/arview')).cards.filter(c => c.from === 'access review').length === 1, r2);

  const card = (await s.ok('GET', '/api/projects/arview')).cards.find(c => c.id === r1.card);
  check('the card is for the owner and lists the link and the secret name', card.needsYou && /Fiona Friend/.test(card.description) && /Shared/.test(card.description) && /member/.test(card.description) && /QA_TOKEN/.test(card.description), card.description);
  check('no value in the card or any answer', !JSON.stringify([card, await s.ok('GET', '/api/secrets'), await s.ok('GET', `/api/projects/arview/accessreview/${card.id}`)]).includes(VALUE));
  const asTeam = await fetch(BASE + `/api/projects/arview/accessreview/${card.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-As': 'Forge', 'X-Aigile-Where': 'terminal' }, body: JSON.stringify({ item: 0, action: 'remove' }) });
  check('owner only: a team agent is refused', asTeam.status === 403, asTeam.status);

  const page = await openPage(ctx, `#/p/arview/${card.id}`);
  await page.waitForSelector('#accrev-' + card.id + ' li');
  const li = await page.$$eval('#accrev-' + card.id + ' li', els => els.map(e => e.textContent));
  check('the page lists the link and the secret with Keep and Remove', li.some(x => /Fiona Friend/.test(x)) && li.some(x => /QA_TOKEN/.test(x)) && (await page.$$('.accrev-keep')).length === li.length && (await page.$$('.accrev-remove')).length === li.length, li);
  check('the page never shows the value', !(await page.content()).includes(VALUE));

  await page.click('.accrev-list li:has-text("Fiona Friend") .accrev-remove');
  await page.waitForSelector('.accrev-list li:has-text("Fiona Friend") .accrev-done');
  const links = await s.ok('GET', '/api/shares');
  check('Remove ended that link', links.find(l => l.id === LINK).state === 'ended', links);
  await page.click('.accrev-list li:has-text("QA_TOKEN") .accrev-keep');
  await page.waitForSelector('.accrev-list li:has-text("QA_TOKEN") .accrev-done');
  check('Keep leaves the secret where it is', (await s.ok('GET', '/api/secrets')).items.some(x => x.name === 'QA_TOKEN' && x.stored));
  noErrors(page);
  await page.close();

  // Remove the secret through the API (the second round)
  await s.ok('POST', '/api/accessreview/run', {});
  const c2 = (await s.ok('GET', '/api/projects/arview')).cards.filter(c => c.from === 'access review').pop();
  const v = await s.ok('GET', `/api/projects/arview/accessreview/${c2.id}`);
  const sec = v.items.find(x => x.name === 'QA_TOKEN');
  await s.ok('POST', `/api/projects/arview/accessreview/${c2.id}`, { item: sec.n, action: 'remove' });
  check('Remove deleted the secret', !(await s.ok('GET', '/api/secrets')).items.some(x => x.name === 'QA_TOKEN'));
  check('the value is in no file under data', !JSON.stringify(fs.readdirSync(s.data)).includes(VALUE));
}, true, { AIGILE_SECRETS_DIR: SECDIR, AIGILE_ACCESS_PROJECT: 'arview', AIGILE_NO_ACCESS_REVIEW: '1' });
