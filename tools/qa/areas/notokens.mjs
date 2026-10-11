// QA area: notokens (AIG-337..339), ⛔ No Token Mode: one switch stops all AI, turns on at the usage limit, glows when usage is back.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, sleep, until, tmp, mkProject, mkCard, say, openPage, noErrors, def } from '../lib.mjs';

def('notokens', 'No Token Mode: kills runs, refuses wakes/nudges/tests/usage checks, hides AI buttons, turns on at the limit, glows when usage is back, never turns back on by itself (AIG-337..339)', async (s, ctx) => {
  const folder = tmp('nt');
  await mkProject(s, 'Nova', 'NOV', { path: folder });
  const st = () => s.ok('GET', '/api/notokens');
  check('off at first', (await st()).on === false);

  // A run that is going gets killed.
  await s.ok('POST', '/api/projects/nova/wake');
  check('a team run is going', (await s.ok('GET', '/api/projects/nova')).presence.running === true);
  const on = await s.ok('POST', '/api/notokens', { on: true });
  check('switching on', on.on === true && on.reason === 'user');
  check('the running team was stopped', (await until(async () => !(await s.ok('GET', '/api/projects/nova')).presence.running, 4000)) === true);

  // Nothing starts.
  await sleep(1500); fs.rmSync(s.wakeOut, { force: true });
  const w = await s.api('POST', '/api/projects/nova/wake');
  check('a wake is refused', w.status === 409 && /No Token Mode/.test(w.body.error || ''), w);
  const c = await mkCard(s, 'nova', 'hello'); await say(s, 'nova', c.id, 'Owner', 'please do it');
  await sleep(800);
  check('a comment starts no run', !(await s.ok('GET', '/api/projects/nova')).presence.running && !fs.existsSync(s.wakeOut), { running: (await s.ok('GET', '/api/projects/nova')).presence.running, out: fs.existsSync(s.wakeOut) && fs.readFileSync(s.wakeOut, 'utf8') });
  check('the tester is refused', (await s.api('POST', '/api/tester', {})).status === 409);
  check('check usage now is refused', (await s.api('POST', '/api/usage/check')).status === 409);
  await s.ok('POST', '/api/quiet', { on: true, watch: ['nova'] });
  await s.ok('POST', '/api/watchman/round'); await s.ok('POST', '/api/watchman/quick');
  await sleep(600);
  check('the night watchman wakes nothing', !fs.existsSync(s.wakeOut) && !(await s.ok('GET', '/api/projects/nova')).presence.running);
  await s.ok('POST', '/api/quiet', { on: false });
  const cli = s.cli(['wake', 'nova']);
  check('the CLI wake is refused too', cli.code !== 0, cli);

  // The board still works as normal.
  const edited = await s.ok('PATCH', `/api/projects/nova/cards/${c.id}`, { title: 'still editable' });
  check('cards still work', edited.title === 'still editable');

  // The page: switch glows red, AI buttons are gone.
  const page = await openPage(ctx, '#/p/nova');
  await page.waitForFunction(() => document.body.classList.contains('notokens'), null, { timeout: 5000 }).catch(() => {});
  check('body has the notokens class', await page.evaluate(() => document.body.classList.contains('notokens')));
  await page.waitForFunction(() => document.querySelector('#ugBars .ug-nt'), null, { timeout: 5000 }).catch(() => {});
  check('the Usage link shows the ⛔ too (AIG-356)', (await page.locator('#ugBars .ug-nt').count()) === 1);
  check('the switch says it is on', /No tokens/.test(await page.textContent('#ntBtn')), await page.textContent('#ntBtn'));
  await page.evaluate(() => { document.getElementById('teamTop').insertAdjacentHTML('beforeend', '<button id="qaW" onclick="wakeTeam(event, \'nova\')">w</button><button id="qaT" onclick="testForMe(\'nova\')">t</button><button id="qaOk" onclick="void 0">ok</button>'); });
  check('wake and AI tester buttons are hidden', !(await page.isVisible('#qaW')) && !(await page.isVisible('#qaT')));
  check('other buttons still show', await page.isVisible('#qaOk'));
  check('no Wake button in the team bar', (await page.$$('#teamTop button.primary:visible')).length === 0);

  // Off again by hand.
  await s.ok('POST', '/api/notokens', { on: false });
  await page.waitForFunction(() => !document.body.classList.contains('notokens'), null, { timeout: 5000 });
  check('off: AI buttons are back', await page.isVisible('#qaW'));
  check('off: a wake works again', (await s.ok('POST', '/api/projects/nova/wake')).running === true);
  await sleep(3800);

  // The usage limit turns it on by itself, with the reset time.
  const reset = Math.floor(Date.now() / 1000) + 3600;
  await s.ok('POST', '/api/limits', { cwd: folder, rate_limits: { five_hour: { used_percentage: 100, resets_at: reset } } });
  const lim = await until(async () => (await st()).on && await st(), 6000);
  check('the limit hit turns it on', lim && lim.reason === 'limit', lim);
  check('it names the reset time', lim && lim.until && Math.abs(Date.parse(lim.until) - (reset * 1000 + 60e3)) < 1000, lim);
  check('and nothing says usage is back yet', lim && lim.back === false);
  await page.waitForFunction(() => /\d{1,2}[:.]\d{2}/.test(document.getElementById('ntBtn').textContent), null, { timeout: 5000 }).catch(() => {});
  check('the switch shows the reset time', /\d{1,2}[:.]\d{2}/.test(await page.textContent('#ntBtn')), await page.textContent('#ntBtn'));

  // Usage back: a new reading below the limit. It glows, but stays on.
  await sleep(50);
  await s.ok('POST', '/api/limits', { cwd: folder, rate_limits: { five_hour: { used_percentage: 12, resets_at: reset + 18000 } } });
  const back = await until(async () => (await st()).back && await st(), 4000);
  check('usage back is reported', back && back.on === true && back.back === true, back);
  await page.waitForFunction(() => document.getElementById('ntBtn').classList.contains('back'), null, { timeout: 5000 }).catch(() => {});
  check('the switch glows Turn AI back on', await page.evaluate(() => document.getElementById('ntBtn').classList.contains('back')) && /back on/i.test(await page.textContent('#ntBtn')), await page.textContent('#ntBtn'));
  await sleep(1500);
  check('it does not turn back on by itself', (await st()).on === true && (await s.api('POST', '/api/projects/nova/wake')).status === 409);
  await page.click('#ntBtn');
  await page.waitForFunction(() => !document.body.classList.contains('notokens'), null, { timeout: 5000 });
  check('clicking it turns AI back on', (await st()).on === false && (await s.ok('POST', '/api/projects/nova/wake')).ok === true);

  // Survives a restart, and the CLI.
  check('CLI on', s.cli(['notokens', 'on']).out.includes('ON') && (await st()).on === true);
  check('state is in a file (survives a restart)', JSON.parse(fs.readFileSync(path.join(s.data, 'notokens.conf'), 'utf8')).on === true);
  check('CLI status', s.cli(['notokens']).out.includes('ON'));
  check('CLI off', s.cli(['notokens', 'off']).out.includes('off') && (await st()).on === false);
  noErrors(page);
}, true, { AIGILE_NOTOKENS_MS: '400' });
