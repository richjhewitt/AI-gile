// QA area: uptime (AIG-1047): the board checks service projects (AIGILE_UPTIME_STUB fakes the answers). 3 down polls make exactly one
// incident assigned to the on-call agent; the 4th makes no new card; back up gives one "Up again" comment; a non-service project is not polled.
import fs from 'node:fs';
import path from 'node:path';
import { check, tmp, mkProject, def, openPage, noErrors } from '../lib.mjs';

const dir = tmp('uptime'), stub = path.join(dir, 'stub.json');
const put = o => fs.writeFileSync(stub, JSON.stringify(o));
const URL1 = 'https://up.example.com/live', URL2 = 'https://plain.example.com/';
put({});

def('uptime', '🟢 Uptime checks: 3 down polls open one incident for the on-call agent, none after, "Up again" comment, non-service not polled (AIG-1047)', async (s, ctx) => {
  await s.ok('POST', '/api/setup', { owner: 'Rich', 'agent.command': 'echo', 'agent.notesFile': 'CLAUDE.md', 'agent.settingsFile': '.claude/settings.json' });
  await mkProject(s, 'Up', 'UPT', { path: tmp('uptime-p') });
  await mkProject(s, 'Plain', 'PLN', { path: tmp('uptime-q') });
  await s.ok('POST', '/api/projects/up/team', { name: 'Up Lead', role: 'Lead', model: 'sonnet' });
  await s.ok('POST', '/api/projects/up/team', { name: 'Up Night', role: 'Developer', model: 'sonnet' });
  await s.ok('PATCH', '/api/projects/up', { service: { on: true, offers: 'Streaming', url: URL1, onCall: 'Up Night' } });
  await s.ok('PATCH', '/api/projects/plain', { service: { on: false, url: URL2 } });
  const inc = async () => ((await s.ok('GET', '/api/projects/up')).cards || []).filter(c => c.type === 'incident');
  const poll = () => s.ok('POST', '/api/uptime/poll');

  await poll();
  let u = await s.ok('GET', '/api/uptime');
  check('up service is reported up with 0 fails; non-service is not listed', u.up && u.up.up === true && u.up.fails === 0 && u.up.url === URL1 && !u.plain, u);
  put({ [URL1]: 'down', [URL2]: 'down' });
  await poll(); await poll();
  check('2 down polls make no incident', (await inc()).length === 0);
  await Promise.all([poll(), poll()]);   // AIG-1121: two polls at once at fail 2 = one poll, one incident
  let cs = await inc();
  check('3 down polls make exactly one incident, assigned to on-call, error in the description', cs.length === 1 && cs[0].title === 'Down: ' + URL1 && cs[0].assignee === 'Up Night' && /stub: down/.test(cs[0].description), cs);
  u = await s.ok('GET', '/api/uptime');
  check('/api/uptime says down with 3 fails', u.up.up === false && u.up.fails >= 3 && !!u.up.since, u);
  await poll();
  check('the 4th poll makes no new card', (await inc()).length === 1);
  check('a non-service project is never polled (no card, not listed)', ((await s.ok('GET', '/api/projects/plain')).cards || []).length === 0 && !(await s.ok('GET', '/api/uptime')).plain);
  const mid = await openPage(ctx, '#/');
  await mid.waitForSelector('.svc-line', { timeout: 8000 });
  check('home line shows a red dot while down', /🔴/.test(await mid.textContent('.svc-line')));
  noErrors(mid); await mid.close();
  put({});
  await poll(); await poll();
  cs = await inc();
  const ups = cs[0].comments.filter(c => /^Up again after \d+ min$/.test(c.text));
  check('back up: exactly one "Up again" comment, incident left open', cs.length === 1 && ups.length === 1 && cs[0].status !== 'done', cs[0]);
  u = await s.ok('GET', '/api/uptime');
  check('/api/uptime says up again', u.up.up === true && u.up.fails === 0, u);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('.svc-line', { timeout: 8000 });
  check('home line shows a green dot when up', /🟢/.test(await page.textContent('.svc-line')));
  noErrors(page); await page.close();
}, true, { AIGILE_UPTIME_STUB: stub, AIGILE_NO_UPTIME_POLL: '1' });
