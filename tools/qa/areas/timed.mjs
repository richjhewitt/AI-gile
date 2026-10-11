// QA area: timed (AIG-385): a card with a "come back at" time is out of the way until then, then returns on top (and wakes its team).
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('timed', 'aigile snooze (time parsing, --clear), hidden from inbox/next, ⏰ chip + picker, comes back on time and wakes the team (AIG-385)', async (s, ctx) => {
  const { parseWhen } = createRequire(import.meta.url)(path.join(ROOT, 'lib', 'timed.js'));
  // Fake clock: parse against a fixed Monday 12 Oct 2026, 10:00 local.
  const base = new Date(2026, 9, 12, 10, 0, 0), loc = iso => { const d = new Date(iso); return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].join('-'); };
  check('parses a full date and time (local)', loc(parseWhen('2026-10-12 14:00', base)) === '2026-10-12-14-0');
  check('parses +2h', new Date(parseWhen('+2h', base)) - base === 7200e3);
  check('parses tomorrow 9:00', loc(parseWhen('tomorrow 9:00', base)) === '2026-10-13-9-0');
  check('parses a weekday, never today', loc(parseWhen('mon 14:00', base)) === '2026-10-19-14-0');
  check('rubbish gives null', parseWhen('whenever') === null && parseWhen('2026-10-12 25:00') === null);

  await mkProject(s, 'Alpha', 'ALP', { path: tmp('tm') });
  const a = await mkCard(s, 'alpha', 'Needs a test', { status: 'verify', testSteps: 'x' });
  const b = await mkCard(s, 'alpha', 'Todo work', { status: 'todo' });
  const t = await mkCard(s, 'alpha', 'Team card', { status: 'doing', assignee: 'Forge' });
  await say(s, 'alpha', t.id, 'Owner', 'please look again');
  const future = ms => new Date(Date.now() + ms).toISOString();

  check('bad time is rejected', (await s.api('POST', `/api/projects/alpha/cards/${a.id}/timer`, { until: 'whenever' })).status === 400);
  check('a time in the past is rejected', (await s.api('POST', `/api/projects/alpha/cards/${a.id}/timer`, { until: '2020-01-01T00:00:00.000Z' })).status === 400);
  let inbox = await s.ok('GET', '/api/inbox');
  check('before: the test is in the inbox', inbox.some(c => c.id === a.id));
  const r = s.cli(['snooze', 'alpha', a.id, '+3h']);
  check('CLI snooze sets the time', r.code === 0 && /out of the way until/.test(r.out), r);
  let c = await getCard(s, 'alpha', a.id);
  check('timedUntil is about 3h ahead', c.timedUntil && Math.abs(new Date(c.timedUntil) - Date.now() - 3 * 3600e3) < 60e3, c.timedUntil);
  inbox = await s.ok('GET', '/api/inbox');
  check('timed card is out of the inbox', !inbox.some(x => x.id === a.id));
  const proj = (await s.ok('GET', '/api/projects')).find(x => x.slug === 'alpha');
  check('and not counted as waiting on you', proj.toTest === 0, [proj.needsYou, proj.toTest]);
  const tb = await s.ok('POST', `/api/projects/alpha/cards/${b.id}/timer`, { until: future(3600e3) });
  check('a todo card can be timed too', !!tb.timedUntil);
  const nx = s.cli(['next', 'alpha']);
  check('team next leaves out the timed todo card', !nx.out.includes('Todo work'), nx.out);
  check('team next still lists the untimed team card', nx.out.includes('Team card'), nx.out);
  check('a comment does not clear the timer', (await say(s, 'alpha', b.id, 'Forge', 'hello')).timedUntil === tb.timedUntil);
  const cl = s.cli(['snooze', 'alpha', b.id, '--clear']);
  c = await getCard(s, 'alpha', b.id);
  check('--clear removes it', cl.code === 0 && !c.timedUntil, cl);
  check('and next lists it again', s.cli(['next', 'alpha']).out.includes('Todo work'));
  check('snooze with a bad time fails in the CLI', s.cli(['snooze', 'alpha', b.id, 'whenever']).code !== 0);

  // The page: chip on the board, picker on the card.
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.card .pill.timed');
  check('board shows the ⏰ chip on the timed card', (await page.locator('.card[data-id="' + a.id + '"] .pill.timed').count()) === 1);
  check('the timed test waits at the bottom of For you, uncounted', (await page.locator('.column.foryou > .card:last-child').getAttribute('data-id')) === a.id && !/b1b/.test(await page.locator('.column.foryou h3 > span').nth(1).innerText()));
  await page.goto(page.url().split('#')[0] + `#/p/alpha/${a.id}`);
  await page.waitForSelector('#tm-btn');
  await page.click('#tm-btn');
  check('picker opens', await page.isVisible('#tm-box'));
  await page.selectOption('#tm-pre', 'tom');
  check('a preset fills the date and time', /T09:00$/.test(await page.inputValue('#tm-at')));
  await page.click('#tm-box .primary');
  await page.waitForTimeout(800);
  c = await getCard(s, 'alpha', a.id);
  check('picking tomorrow 9:00 saves it', c.timedUntil && new Date(c.timedUntil).getHours() === 9 && new Date(c.timedUntil) > Date.now(), c.timedUntil);
  await page.click('#tm-btn');
  await page.click('#tm-box button:not(.primary)');
  await page.waitForTimeout(800);
  check('Clear in the picker removes it', !(await getCard(s, 'alpha', a.id)).timedUntil);
  noErrors(page);
  await page.close();

  // Coming back: the server checks on a short beat in this test.
  await s.ok('POST', `/api/projects/alpha/cards/${a.id}/timer`, { until: future(2000) });
  await s.ok('POST', `/api/projects/alpha/cards/${t.id}/timer`, { until: future(2000) });
  const tc = await getCard(s, 'alpha', t.id);
  check('the team card is timed (still in the team column)', tc.status === 'team' && tc.timedUntil, tc.status);
  await sleep(3500);
  c = await getCard(s, 'alpha', a.id);
  check('time up: the timer is gone and the card is bumped', !c.timedUntil && c.bumpedAt, c);
  inbox = await s.ok('GET', '/api/inbox');
  check('it is back at the top of the inbox', inbox[0] && inbox[0].id === a.id, inbox.map(x => x.id));
  const tc2 = await getCard(s, 'alpha', t.id);
  check('a team-column card gets a wake comment', tc2.comments.some(m => m.author === 'Timer' && m.wake), tc2.comments.map(m => m.author));
}, true, { AIGILE_TIMED_MS: '500' });
