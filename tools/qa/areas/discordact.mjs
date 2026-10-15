// QA area: discordact (AIG-642): Setup > 🎮 Discord activity saves on / application ID / project tick; the activity Discord would
// get (a stub file stands in for the Discord pipe) says Using AI-gile, adds only a 🌍 Public project on screen, never a Private
// or Personal one, and is cleared when switched off.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, tmp, until, mkProject, openPage, noErrors, def } from '../lib.mjs';

const STUB = path.join(tmp('discordact'), 'activity.json');
const act = () => { try { return JSON.parse(fs.readFileSync(STUB, 'utf8')); } catch { return undefined; } };

def('discordact', '🎮 Discord activity: Setup box, Using AI-gile, only a Public project on screen goes out (AIG-642)', async (s, ctx) => {
  await mkProject(s, 'Show Board', 'SHW');
  await mkProject(s, 'Hush Board', 'HSH');
  await mkProject(s, 'Home Life', 'HOM');
  await s.ok('PATCH', '/api/projects/show-board', { public: true });
  await s.ok('PATCH', '/api/projects/hush-board', { private: true });
  await s.ok('PATCH', '/api/projects/home-life', { personal: true });
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#presOn');
  check('Setup has the Discord activity box, off by default', !(await page.isChecked('#presOn')));
  await page.fill('#presId', 'abc 1234567890'); await page.press('#presId', 'Tab');
  await until(async () => (await s.ok('GET', '/api/presence')).clientId === '1234567890');
  check('the application ID keeps only its digits', (await s.ok('GET', '/api/presence')).clientId === '1234567890');
  await page.click('#presOn');
  await until(() => act() && act().details === 'Using AI-gile');
  check('switched on: Discord gets Using AI-gile', act().details === 'Using AI-gile' && !act().state, act());
  await page.click('#presProj');
  await page.goto(`${BASE}/#/p/show-board`);
  await until(() => act() && act().state);
  check('a Public project on screen shows as Working on', act().state === 'Working on Show Board', act());
  await page.goto(`${BASE}/#/p/hush-board`);
  await until(() => act() && !act().state);
  check('a Private project never goes out', !act().state, act());
  await page.goto(`${BASE}/#/p/home-life`);
  await until(async () => { await s.ok('POST', '/api/presence/open', { slug: 'home-life' }); return act() && !act().state; });
  check('a Personal project never goes out', !(act() || {}).state, act());
  await s.ok('POST', '/api/presence', { on: false });
  check('switched off: the activity is cleared', act() === null, act());
  noErrors(page);
}, true, { AIGILE_PRESENCE_STUB: STUB });
