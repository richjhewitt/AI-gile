// QA area: stars (AIG-975): starred messages kept in step with the phone app. GET/POST /api/projects/:p/stars stars, unstars and
// replaces the list (no doubles, bad input refused, kept in data/<slug>.stars, not a project file); the chat shows a ★ on that message.
import fs from 'node:fs';
import path from 'node:path';
import { check, mkProject, openPage, noErrors, def } from '../lib.mjs';

def('stars', 'Stars: star, unstar and replace a project\'s starred messages for the phone app; ★ in the chat (AIG-975)', async (s, ctx) => {
  await mkProject(s, 'Starry', 'STR');
  await s.ok('POST', '/api/projects/starry/team', { name: 'Lead', role: 'Lead' });
  const a = await s.ok('POST', '/api/projects/starry/leadchat', { author: 'Lead', text: 'starred one' });
  await s.ok('POST', '/api/projects/starry/leadchat', { author: 'Lead', text: 'plain one' });
  check('no stars at first', (await s.ok('GET', '/api/projects/starry/stars')).stars.length === 0);
  await s.ok('POST', '/api/projects/starry/stars', { chat: '_lead', key: a.at });
  const twice = await s.ok('POST', '/api/projects/starry/stars', { chat: '_lead', key: a.at });
  check('starring twice keeps one star', twice.stars.length === 1 && twice.stars[0].key === a.at, twice);
  check('kept in data/starry.stars, not a .json project file', fs.existsSync(path.join(s.data, 'starry.stars')) && !fs.existsSync(path.join(s.data, 'starry.stars.json')));
  const bad = await s.api('POST', '/api/projects/starry/stars', { chat: '_lead' });
  check('a star with no key is refused', bad.status === 400, bad);
  check('an unknown project is refused', (await s.api('GET', '/api/projects/nope/stars')).status === 404);
  const chat = await s.ok('GET', '/api/chats/starry');
  check('the chat lists the star', chat.stars.includes('_lead|' + a.at), chat.stars);

  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#dmRail [data-dms]');
  await page.click('#dmRail [data-dms]');
  await page.click('#dmPanel [data-dm="starry"]');
  await page.waitForSelector('#dmList .dm-msg');
  const starred = await page.locator('#dmList .dm-msg').evaluateAll(a => a.map(x => [x.querySelector('.dm-bubble').textContent.trim(), !!x.querySelector('.dm-star')]));
  check('★ on the starred message only', JSON.stringify(starred) === JSON.stringify([['starred one', true], ['plain one', false]]), starred);
  await noErrors(page);
  await page.close();

  const off = await s.ok('POST', '/api/projects/starry/stars', { chat: '_lead', key: a.at, on: false });
  check('on: false unstars it', off.stars.length === 0, off);
  const rep = await s.ok('POST', '/api/projects/starry/stars', { stars: [{ chat: '_lead', key: 'k1' }, { chat: '_lead', key: 'k1' }, { chat: 'STR-1', key: 'k2' }, { chat: '', key: 'x' }] });
  check('replace keeps the phone\'s list: no doubles, empty ones dropped', rep.stars.map(x => x.chat + '|' + x.key).join() === '_lead|k1,STR-1|k2', rep);
  check('replace needs a list', (await s.api('POST', '/api/projects/starry/stars', { stars: 'all' })).status === 400);
}, true);
