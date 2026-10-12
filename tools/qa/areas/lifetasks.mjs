// QA area: lifetasks (AIG-394): real-life cards (housework, appointment, shopping...) are the owner's own, never wake a team,
// an appointment sets the ⏰ timer, they group as 🏡 Life in For you and the inbox, and ✅ Done ticks them quietly.
import { check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

const TYPES = ['housework', 'appointment', 'shopping', 'call', 'bills', 'errand', 'health', 'family', 'pets'];
const pad = n => String(n).padStart(2, '0');
const localInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

def('lifetasks', 'real-life cards: nine types, appointment timer, quiet for the team, 🏡 Life in For you and the inbox, one-click Done, New card switch (AIG-394)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP', { path: tmp('lf') });
  const ids = {};
  for (const ty of TYPES) {
    const c = await mkCard(s, 'alpha', 'Life ' + ty, { lifeType: ty, createdBy: 'Owner', status: 'team' });
    ids[ty] = c.id;
    check(`${ty}: owner's own todo task`, c.lifeType === ty && c.type === 'task' && c.assignee === 'Owner' && c.status === 'todo' && c.focus === false, c);
  }
  check('bad lifeType refused', (await s.api('POST', '/api/projects/alpha/cards', { title: 'x', lifeType: 'nope' })).status === 400);
  const team = await mkCard(s, 'alpha', 'Real dev work', { status: 'todo' });
  const nx = s.cli(['next', 'alpha']);
  check('team next never offers life cards to pick up', !/Life /.test(nx.out.split('Waiting')[0]) && nx.out.includes('Real dev work'), nx.out);
  const pr = (await s.ok('GET', '/api/projects')).find(x => x.slug === 'alpha');
  check('life cards count as waiting on you', pr.needsYou === TYPES.length, pr.needsYou);
  check('no team is poked about them', !pr.attention || !/Life/.test(JSON.stringify(pr.attention)), pr.attention);
  const woke = (await getCard(s, 'alpha', ids.housework)).comments.length === 0;
  check('no comment or wake on a life card', woke);

  // An appointment sets the timer: an hour before by default, configurable.
  const at = new Date(Date.now() + 5 * 3600e3);
  const ap = await mkCard(s, 'alpha', 'Dentist', { lifeType: 'appointment', apptAt: at.toISOString() });
  check('appointment timer is 1 hour before by default', ap.timedUntil && Math.abs(new Date(ap.timedUntil) - (at - 3600e3)) < 1000, ap);
  const ap2 = await mkCard(s, 'alpha', 'Doctor', { lifeType: 'appointment', apptAt: at.toISOString(), remindMins: 30 });
  check('reminder minutes are configurable', Math.abs(new Date(ap2.timedUntil) - (at - 1800e3)) < 1000, ap2);
  const moved = await s.ok('PATCH', `/api/projects/alpha/cards/${ap2.id}`, { apptAt: new Date(at.getTime() + 3600e3).toISOString() });
  check('moving the appointment moves the timer', Math.abs(new Date(moved.timedUntil) - (at.getTime() + 3600e3 - 1800e3)) < 1000, moved.timedUntil);
  const soon = await mkCard(s, 'alpha', 'Soon', { lifeType: 'appointment', apptAt: new Date(Date.now() + 600e3).toISOString() });
  check('an appointment inside the reminder time has no timer (shows now)', !soon.timedUntil);
  check('a timed appointment is out of the inbox', !(await s.ok('GET', '/api/inbox')).some(c => c.id === ap.id));
  check('a bad date is refused', (await s.api('POST', '/api/projects/alpha/cards', { title: 'x', lifeType: 'appointment', apptAt: 'whenever' })).status === 400);

  // A team member assigned on purpose does wake the usual way: it is a normal todo for them.
  const asg = await mkCard(s, 'alpha', 'Plan the party', { lifeType: 'family', assignee: 'Forge', status: 'todo' });
  check('explicitly assigned to a team member: stays theirs', asg.assignee === 'Forge' && asg.status === 'todo');
  // The focus flag is ready for focus mode.
  const fc = await s.ok('PATCH', `/api/projects/alpha/cards/${ids.pets}`, { focus: true });
  check('the focus flag can be set', fc.focus === true);
  // CLI.
  const cl = s.cli(['add', 'alpha', 'Buy milk', '--life', 'shopping']);
  check('CLI add --life makes a life card', cl.code === 0, cl);
  const cl2 = s.cli(['add', 'alpha', 'Vet', '--life', 'appointment', '--at', '+5h', '--remind', '30']);
  check('CLI add --life appointment --at', cl2.code === 0, cl2);
  const milk = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'Buy milk');
  check('and it is the owner\'s', milk && milk.lifeType === 'shopping' && milk.assignee === 'Owner');
  const vet = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'Vet');
  check('the CLI appointment has a timer', vet && !!vet.timedUntil, vet);

  // Done over the API: quiet.
  const d = await s.ok('POST', `/api/projects/alpha/cards/${ids.errand}/lifedone`);
  check('lifedone ticks it done with no comment', d.status === 'done' && d.comments.length === 0, d);
  check('lifedone refuses a normal card', (await s.api('POST', `/api/projects/alpha/cards/${team.id}/lifedone`)).status === 400);

  // The board: New card dialog.
  const page = await openPage(ctx, '#/p/alpha');
  await page.waitForSelector('.column.foryou .card');
  const fy = await page.textContent('.column.foryou');
  check('For you has a 🏡 Life chip', /🏡 Life/.test(await page.textContent('.fy-chips')), await page.textContent('.fy-chips'));
  const chipN = await page.locator(`.column.foryou .card[data-id="${ids.housework}"] .pill.life`).count();
  check('life cards show their type chip in For you', chipN === 1 && fy.includes('🧹'));
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #nc-life');
  check('the Real life switch is off by default', !(await page.isChecked('#nc-life')) && !(await page.isVisible('#nc-lifetype')));
  await page.check('#nc-life');
  const opts = await page.$$eval('#nc-lifetype option', os => os.map(o => o.textContent));
  check('nine life types with icons', opts.length === 9 && opts[0].includes('🧹') && opts[1].includes('📅') && opts[8].includes('🐾'), opts);
  await page.fill('#f-title', 'Bins out');
  await page.selectOption('#nc-lifetype', 'housework');
  check('housework asks for no date', !(await page.isVisible('#nc-apptat')));
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await sleep(300);
  const bins = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'Bins out');
  check('dialog: a housework life card', bins && bins.lifeType === 'housework' && bins.assignee === 'Owner' && bins.status === 'todo', bins);
  for (const ty of ['shopping', 'call', 'bills', 'errand', 'health', 'family', 'pets']) {
    await page.click('.toolbar button.primary');
    await page.waitForSelector('#dialog #nc-life');
    await page.check('#nc-life');
    await page.selectOption('#nc-lifetype', ty);
    await page.fill('#f-title', 'Dialog ' + ty);
    await page.click('#dialog button[type=submit]');
    await page.waitForSelector('#dialog .dialog', { state: 'detached' });
    await sleep(200);
  }
  const all = (await s.ok('GET', '/api/projects/alpha')).cards;
  check('each other type can be added in the dialog', ['shopping', 'call', 'bills', 'errand', 'health', 'family', 'pets'].every(ty => all.some(c => c.title === 'Dialog ' + ty && c.lifeType === ty)), all.filter(c => /^Dialog/.test(c.title)).map(c => c.lifeType));
  // Appointment in the dialog.
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #nc-life');
  await page.check('#nc-life');
  await page.selectOption('#nc-lifetype', 'appointment');
  check('appointment asks for a date and a reminder', (await page.isVisible('#nc-apptat')) && (await page.isVisible('#nc-remind')));
  await page.fill('#f-title', 'Hairdresser');
  await page.click('#dialog button[type=submit]');
  await sleep(300);
  check('appointment without a date is refused', (await page.isVisible('#dialog #d-err')) && /date/i.test(await page.textContent('#d-err')));
  const when = new Date(Date.now() + 26 * 3600e3); when.setSeconds(0, 0);
  await page.fill('#nc-apptat', localInput(when));
  await page.selectOption('#nc-remind', '120');
  await page.click('#dialog button[type=submit]');
  await page.waitForSelector('#dialog .dialog', { state: 'detached' });
  await sleep(300);
  const hair = (await s.ok('GET', '/api/projects/alpha')).cards.find(c => c.title === 'Hairdresser');
  check('dialog appointment sets the ⏰ timer 2 hours before', hair && hair.lifeType === 'appointment' && Math.abs(new Date(hair.timedUntil) - (when - 7200e3)) < 1000, hair);
  // Suggest a Life board; do not force it.
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #nc-life');
  check('the dialog suggests a Life board once the switch is on', (await page.locator('#nc-life-suggest').count()) === 1 && !(await page.isChecked('#nc-life')));
  await page.check('#nc-life');
  await page.click('#nc-life-suggest a');
  await sleep(500);
  check('clicking it marks the project a Life board', (await s.ok('GET', '/api/projects/alpha')).lifeBoard === true);
  await page.keyboard.press('Escape');
  await page.reload(); await page.waitForSelector('#app > *');
  await page.click('.toolbar button.primary');
  await page.waitForSelector('#dialog #nc-life');
  check('on a Life board the switch starts on', await page.isChecked('#nc-life'));
  await page.keyboard.press('Escape');

  // One-click Done on the board.
  await page.waitForSelector(`.column.foryou .card[data-id="${ids.shopping}"] .life-done`);
  await page.click(`.column.foryou .card[data-id="${ids.shopping}"] .life-done`);
  await sleep(1200);
  const sh = await getCard(s, 'alpha', ids.shopping);
  check('✅ Done on the card ticks it quietly', sh.status === 'done' && sh.comments.length === 0, sh);
  check('and it leaves For you', (await page.locator(`.column.foryou .card[data-id="${ids.shopping}"]`).count()) === 0);
  noErrors(page);
  await page.close();

  // The inbox: a 🏡 Life group with Done.
  const ip = await openPage(ctx, '#/inbox');
  await ip.waitForSelector('#ibKinds [data-kind="life"]');
  check('inbox has a 🏡 Life kind', /🏡 Life/.test(await ip.textContent('#ibKinds [data-kind="life"]')));
  await ip.click('#ibKinds [data-kind="life"]');
  await sleep(300);
  check('filtering shows only life tasks', (await ip.locator('.ib-item').count()) > 0 && (await ip.locator('.ib-item', { hasText: 'Real dev work' }).count()) === 0);
  await ip.click(`.ib-item[data-id="${ids.call}"] [data-act="lifedone"]`);
  await sleep(1000);
  const ca = await getCard(s, 'alpha', ids.call);
  check('inbox ✅ Done ticks it quietly', ca.status === 'done' && ca.comments.length === 0, ca);
  noErrors(ip);
  await ip.close();
}, true);
