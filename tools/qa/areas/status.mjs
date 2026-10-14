// QA area: status (AIG-983/984/985/986). The top bar status button and menu, the brief line per status, and 🛌 Rest day:
// quiet on with a 🛌 card per team, only urgent asks in the inbox, a lead's DM refused, and quiet off again when it ends.
import { check, sleep, openPage, noErrors, def, mkProject, mkCard } from '../lib.mjs';

def('status', '🟢 Your status: Online / Idle / DND / Offline, and 🛌 Rest day (night watch on, only urgent asks, leads go via the Lead Scrum Master) (AIG-983)', async (s, ctx) => {
  const setup = () => s.ok('GET', '/api/setup');
  check('old data without it = online', (await setup()).status === 'online');
  await mkProject(s, 'Resty', 'RST');
  const brief = () => s.cli(['brief', 'resty']).out;
  check('brief: no status line when online', !/is (idle|on Do not disturb|offline|on a 🛌 rest day)/.test(brief()));

  // The top bar menu
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#statusBtn');
  check('the top bar shows 🟢 when online', (await page.textContent('#statusBtn')).trim() === '🟢');
  await page.click('#statusBtn'); await page.waitForSelector('#statusMenu');
  check('the menu has 5 choices', await page.locator('#statusMenu button').count() === 5);
  await page.click('#st-dnd'); await sleep(400);
  check('Do not disturb: saved, and the button shows ⛔', (await setup()).status === 'dnd' && (await page.textContent('#statusBtn')).trim() === '⛔');
  check('brief: the DND line', /is on Do not disturb: no questions, tasks, pokes or DMs/.test(brief()), brief().slice(0, 1200));
  for (const [k, re] of [['idle', /is idle \(away for a bit\)/], ['offline', /is offline: nothing reaches/]]) {
    await s.ok('POST', '/api/setup', { prefs: { status: k } });
    check(`brief: the ${k} line`, re.test(brief()));
  }
  const bad = await s.api('POST', '/api/setup', { prefs: { status: 'asleep' } });
  check('a bad status is refused', bad.status === 400, bad.status);

  // 🛌 Rest day
  const n1 = await mkCard(s, 'resty', 'Normal ask', { status: 'todo' }), n2 = await mkCard(s, 'resty', 'Showstopper ask', { status: 'todo', priority: 'urgent' });
  for (const c of [n1, n2]) s.cli(['ask', 'resty', c.id, 'Which one? I assume A.', '--as', 'Lead']);
  const inbox = async () => (await s.ok('GET', '/api/inbox')).filter(x => x.project === 'resty').map(x => x.id);
  check('online: both asks in the inbox', (await inbox()).length === 2, await inbox());
  await s.ok('POST', '/api/setup', { prefs: { status: 'online' } });
  page.once('dialog', () => check('rest day: no browser confirm box (AIG-992)', false));
  await page.click('#statusBtn'); await page.waitForSelector('#statusMenu'); await page.click('#st-rest');
  await page.waitForSelector('.dialog.sure #sureOk'); check("rest day: asks in the app's own dialog (AIG-992)", true); await page.click('#sureOk'); await sleep(800);
  const meta = await s.ok('GET', '/api/meta');
  check('rest day: saved, 🛌 on the button, and quiet (night watch) is on', (await setup()).status === 'rest' && (await page.textContent('#statusBtn')).trim() === '🛌' && !!meta.quiet, JSON.stringify({ q: meta.quiet }));
  const p = await s.ok('GET', '/api/projects/resty');
  const card = p.cards.find(c => c.title === '🛌 Rest day');
  check('each team gets a 🛌 Rest day card that sends them to the Lead Scrum Master', !!card && /aigile msg resty "Scrum Master"/.test(card.description) && !p.cards.some(c => c.title === '📣 Going quiet'), card && card.description);
  const ib = await inbox();
  check('rest day: only the urgent ask is in the inbox', ib.includes(n2.id) && !ib.includes(n1.id), ib);
  check('brief: the rest day line names the Lead Scrum Master', /is on a 🛌 rest day: never ask, task or DM .*\(aigile msg resty "Scrum Master"/.test(brief()));
  await s.ok('PATCH', '/api/projects/resty', { chatty: true });
  const dm = await s.api('POST', '/api/projects/resty/dm', { text: 'Quick one', author: 'Lead' });
  check("rest day: a lead's DM is refused and points at the Lead Scrum Master", dm.status === 409 && /Lead Scrum Master/.test(JSON.stringify(dm.body || dm)), dm.status);

  // Back online
  await page.click('#statusBtn'); await page.waitForSelector('#statusMenu'); await page.click('#st-online'); await sleep(800);
  check('back online: quiet is off and both asks are back', (await setup()).status === 'online' && !(await s.ok('GET', '/api/meta')).quiet && (await inbox()).length === 2, await inbox());
  // Quiet ended some other way (the 🌙 button): rest day ends with it
  await s.ok('POST', '/api/setup', { prefs: { status: 'rest' } });
  await s.ok('POST', '/api/quiet', { on: false });
  check('quiet ended from the 🌙 button: online again', (await setup()).status === 'online');
  noErrors(page);
  await page.close();
}, true);
