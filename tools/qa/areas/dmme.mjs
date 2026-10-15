// QA area: dmme (AIG-684). The card's "DM me about this" button: pick the lead / a teammate / a named team, a DM opens with the card linked,
// the (stubbed) agent is started with the card id in its prompt; hidden in No AI mode.
import fs from 'node:fs';
import { check, sleep, tmp, mkProject, mkCard, openPage, def } from '../lib.mjs';

const stubText = s => { try { return fs.readFileSync(s.wakeOut, 'utf8'); } catch { return ''; } };

def('dmme', 'DM me about this: ask the lead, a teammate or a named team to DM you about a card; chat opens with the card linked, the agent is woken with the card id; hidden in No AI mode (AIG-684)', async (s, ctx) => {
  await mkProject(s, 'Dmm', 'DMM', { path: tmp('dmme') });
  await s.ok('POST', '/api/projects/dmm/team', { name: 'Boss', role: 'Lead' });
  await s.ok('POST', '/api/projects/dmm/team', { name: 'Pixel', role: 'Frontend' });
  const c = await mkCard(s, 'dmm', 'Make the thing faster');
  await sleep(500);
  const page = await openPage(ctx, '#/p/dmm/' + c.id);
  await page.waitForSelector('#dmmeBtn');
  check('the card has a DM me about this button', /DM me/.test(await page.textContent('#dmmeBtn')));
  await page.click('#dmmeBtn');
  await page.waitForSelector('#dmmeLead');
  check('it offers the lead, the teammate and a team box', /Boss/.test(await page.textContent('#dmmeLead')) && (await page.locator('#dmmeWho [data-who="Pixel"]').count()) === 1 && (await page.locator('#dmmeTeam').count()) === 1);
  const before = stubText(s).length;
  await page.click('#dmmeLead');
  await page.waitForSelector('#dmList .dm-msg', { timeout: 8000 });
  const shown = await page.textContent('#dmList');
  check('a DM opens with "About <card>: <title>" at the top', new RegExp(`About ${c.id}: Make the thing faster`).test(shown), shown);
  check('the card is linked in the chat', (await page.locator(`#dmList a[href="#/p/dmm/${c.id}"]`).count()) >= 1);
  const dmCard = (await s.ok('GET', '/api/projects/dmm')).cards.find(x => x.dmAbout === c.id);
  check('the DM card exists, quick, from the owner, for the lead', dmCard && dmCard.quick && dmCard.dmWith === 'Boss' && dmCard.createdBy === 'Owner', dmCard);
  let out = '';
  for (let i = 0; i < 60 && !(out = stubText(s)).includes('aigile show'); i++) await sleep(250);
  check('the stubbed agent was started with the card id in its prompt', out.length > before && out.includes(`aigile show dmm ${c.id}`) && out.includes(dmCard.id), out.slice(-600));
  // The agent answers into the DM with the usual comment command
  const r = s.cli(['comment', 'dmm', dmCard.id, 'Hi! Here is what I think about the speed.', '--as', 'Boss']);
  check('the agent can reply into the DM with aigile comment', r.code === 0, r);
  await page.waitForFunction(() => /what I think about the speed/.test(document.getElementById('dmList').textContent), null, { timeout: 8000 }).catch(() => {});
  check('the reply shows in the chat', /what I think about the speed/.test(await page.textContent('#dmList')));

  // A named team the owner types
  const p2 = await openPage(ctx, '#/p/dmm/' + c.id);
  await p2.waitForSelector('#dmmeBtn');
  await p2.click('#dmmeBtn');
  await p2.fill('#dmmeTeam', 'Comedy (Opus)');
  await p2.click('#dmmeTeamGo');
  await p2.waitForSelector('#dmList .dm-msg', { timeout: 8000 });
  const named = (await s.ok('GET', '/api/projects/dmm')).cards.filter(x => x.dmAbout === c.id).find(x => x.dmWith === 'Comedy (Opus)');
  check('a named team gets its own DM', !!named, named);
  for (let i = 0; i < 40 && !stubText(s).includes('Comedy (Opus)'); i++) await sleep(250);
  check('the prompt names the team', stubText(s).includes('Comedy (Opus)'));

  // No AI mode: the button is gone and the server refuses
  await s.ok('POST', '/api/setup', { prefs: { noAi: true } });
  const p3 = await openPage(ctx, '#/p/dmm/' + c.id);
  await p3.waitForSelector('body.noai');
  await p3.waitForSelector('.panel h2');
  check('in No AI mode the button is hidden', await p3.evaluate(() => { const e = document.getElementById('dmmeBtn'); return !e || getComputedStyle(e).display === 'none'; }));
  check('in No AI mode the server refuses', (await s.api('POST', `/api/projects/dmm/cards/${c.id}/dmme`, { who: '' })).status === 409);
}, true);
