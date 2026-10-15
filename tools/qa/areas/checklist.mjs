// QA area: checklist (AIG-406): a ☑ checklist on any card (CLI, API, card panel, chips, Accept asks first) and ⏳ Waits for (greyed, out of next/For you, pops back).
import { check, mkProject, mkCard, getCard, openPage, noErrors, sleep, until, def, BASE } from '../lib.mjs';

def('checklist', 'checklist on a card (set/tick/chip/Accept asks) and waits for (grey, hidden, pops back) (AIG-406)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const cli = (...args) => s.cli(args);
  const a = await mkCard(s, 'alpha', 'Test on every platform', { status: 'doing' });

  // CLI: set, tick, untick, keep ticks, clear
  const set = cli('check', 'alpha', a.id, 'Windows,Mac,Android,iPhone', '--as', 'Forge');
  check('check sets a checklist', set.code === 0 && /0\/4/.test(set.out), set);
  const tk = cli('check', 'alpha', a.id, '--tick', '1,3', '--as', 'Forge');
  check('--tick ticks items (1-based)', tk.code === 0 && /2\/4/.test(tk.out) && /1\. \[x\] Windows/.test(tk.out) && /2\. \[ \] Mac/.test(tk.out), tk);
  let c = await getCard(s, 'alpha', a.id);
  check('a tick remembers who and when', c.checklist[0].done && c.checklist[0].by === 'Forge' && !!c.checklist[0].at, c.checklist);
  cli('check', 'alpha', a.id, 'Windows,Mac,Android,iPhone,Linux', '--as', 'Forge');
  c = await getCard(s, 'alpha', a.id);
  check('setting the list again keeps the ticks of same-named items', c.checklist.length === 5 && c.checklist[0].done && c.checklist[2].done && !c.checklist[4].done, c.checklist);
  const un = cli('check', 'alpha', a.id, '--untick', '1', '--as', 'Forge');
  check('--untick unticks', un.code === 0 && /1\/5/.test(un.out), un);
  check('a bad number is refused', cli('check', 'alpha', a.id, '--tick', '9', '--as', 'Forge').code !== 0);
  check('show lists the checklist', /Checklist:/.test(cli('show', 'alpha', a.id).out));
  check('list/line shows ☑1/5', /☑1\/5/.test(cli('list', 'alpha').out));

  // ticking wakes nobody and leaves the card where it is
  const before = await getCard(s, 'alpha', a.id);
  await s.ok('POST', `/api/projects/alpha/cards/${a.id}/check`, { tick: [1] });
  const after = await getCard(s, 'alpha', a.id);
  check('ticking changes no status and adds no comment', after.status === before.status && after.comments.length === before.comments.length);

  // test --check hands over with a checklist
  const t = cli('test', 'alpha', a.id, '1. Try it on each platform\n2. It works', '--check', 'Windows,Mac', '--as', 'Forge');
  c = await getCard(s, 'alpha', a.id);
  check('test --check hands over with a fresh checklist', t.code === 0 && c.status === 'verify' && c.checklist.length === 2 && c.checklist[0].done, { t, cl: c.checklist });
  check('the inbox API carries the checklist', (await s.ok('GET', '/api/inbox')).find(x => x.id === a.id).checklist.length === 2);

  // page: chip on the board tile, the card panel, Accept asks first
  const bp = await openPage(ctx, '#/p/alpha');
  await bp.waitForSelector('.card');
  check('board tile shows the chip 1/2', (await bp.$$eval('.card .pill.chk', es => es.map(e => e.textContent.trim()))).some(x => /1\/2/.test(x)));
  await bp.goto(`${BASE}/#/p/alpha/${a.id}`);
  await bp.waitForSelector('#chk-box');
  check('the card shows both items, one ticked', (await bp.$$eval('#chk-box input[type=checkbox]', es => es.map(e => e.checked))).join() === 'true,false');
  await bp.click('#chk-box input[data-chk-i="1"]');
  await until(async () => (await getCard(s, 'alpha', a.id)).checklist[1].done);
  check('ticking on the card is saved', (await getCard(s, 'alpha', a.id)).checklist[1].done);
  await bp.click('#chk-box input[data-chk-i="1"]');
  await until(async () => !(await getCard(s, 'alpha', a.id)).checklist[1].done);
  await sleep(700);
  await bp.fill('#chk-new', 'Linux, iPad');
  await bp.click('#chk-add-btn');
  await until(async () => (await getCard(s, 'alpha', a.id)).checklist.length === 4);
  check('Add puts several items on (commas)', (await getCard(s, 'alpha', a.id)).checklist.map(x => x.text).join() === 'Windows,Mac,Linux,iPad', (await getCard(s, 'alpha', a.id)).checklist);
  await bp.waitForSelector('#chk-box li:nth-child(4)');
  await bp.click('#chk-box li:nth-child(4) button[title]:nth-of-type(1)');   // move the last one up
  await until(async () => (await getCard(s, 'alpha', a.id)).checklist[2].text === 'iPad');
  check('an item can be moved up', (await getCard(s, 'alpha', a.id)).checklist.map(x => x.text).join() === 'Windows,Mac,iPad,Linux');
  await bp.click('#chk-box li:nth-child(3) .chk-acts button:nth-of-type(3)');   // remove iPad
  await until(async () => (await getCard(s, 'alpha', a.id)).checklist.length === 3);
  check('an item can be removed', (await getCard(s, 'alpha', a.id)).checklist.map(x => x.text).join() === 'Windows,Mac,Linux');
  await bp.waitForSelector('button.good[onclick^="verdict(true"]');
  await bp.click('.ctab[data-ctab="test"]').catch(() => {});
  await bp.click('button.good[onclick^="verdict(true"]');
  const txt = await bp.$eval('button.good[onclick^="verdict(true"]', e => e.textContent);
  check('Accept first asks "2 of 3 left: accept anyway?"', /2.*3/.test(txt) && /\?/.test(txt), txt);
  check('and nothing was accepted yet', (await getCard(s, 'alpha', a.id)).status === 'verify');
  await bp.click('button.good[onclick^="verdict(true"]');
  await until(async () => (await getCard(s, 'alpha', a.id)).status === 'done');
  check('the second click accepts', (await getCard(s, 'alpha', a.id)).status === 'done');
  noErrors(bp);
  await bp.close();

  // inbox: chip, and Accept asks first; a finished checklist accepts at once
  const b = await mkCard(s, 'alpha', 'Inbox one', { status: 'doing' }), d = await mkCard(s, 'alpha', 'Inbox two', { status: 'doing' });
  cli('test', 'alpha', b.id, '1. Click it', '--check', 'One,Two,Three,Four', '--as', 'Forge');
  cli('test', 'alpha', d.id, '1. Click it too', '--check', 'Solo', '--as', 'Forge');
  cli('check', 'alpha', d.id, '--tick', '1', '--as', 'Forge');
  const ip = await openPage(ctx, '#/inbox');
  await ip.waitForSelector('#ibT .ib-item');
  const chips = await ip.$$eval('#ibT .ib-item', es => es.map(e => e.dataset.id + ':' + (e.querySelector('.pill.chk') || {}).textContent));
  check('inbox items carry the chip', chips.some(x => x === b.id + ':☑ 0/4') && chips.some(x => x === d.id + ':☑ 1/1'), chips);
  await ip.click(`#ibT .ib-item[data-id="${b.id}"] [data-act="accept"]`);
  const lbl = await ip.$eval(`#ibT .ib-item[data-id="${b.id}"] [data-act="accept"]`, e => e.textContent);
  check('inbox Accept asks "4 of 4 left: accept anyway?"', /4.*4/.test(lbl) && /\?/.test(lbl), lbl);
  check('and waits', (await getCard(s, 'alpha', b.id)).status === 'verify');
  await ip.click(`#ibT .ib-item[data-id="${d.id}"] [data-act="accept"]`);
  await until(async () => (await getCard(s, 'alpha', d.id)).status === 'done');
  check('a finished checklist accepts with one click', (await getCard(s, 'alpha', d.id)).status === 'done');
  await ip.click(`#ibT .ib-item[data-id="${b.id}"] [data-act="accept"]`);
  await until(async () => (await getCard(s, 'alpha', b.id)).status === 'done');
  check('the second click accepts anyway', (await getCard(s, 'alpha', b.id)).status === 'done');
  noErrors(ip);
  await ip.close();

  // ⏳ Waits for
  const sp = await mkCard(s, 'alpha', 'Spare', { status: 'todo' });
  const x = await mkCard(s, 'alpha', 'Blocker', { status: 'doing' }), w = await mkCard(s, 'alpha', 'Follow-up', { status: 'todo' });
  const wf = cli('wait-for', 'alpha', w.id, x.id);
  check('wait-for sets it', wf.code === 0 && /waits for/.test(wf.out), wf);
  let wc = await getCard(s, 'alpha', w.id);
  check('the card knows what it waits for', wc.waiting.join() === x.id && wc.waitsFor.join() === x.id, wc);
  check('the blocker now holds it up (holds linked)', (await getCard(s, 'alpha', x.id)).holds.includes(w.id));
  check('it is left out of next', !/Follow-up/.test(cli('next', 'alpha').out.split('Waiting (not yours')[0]), cli('next', 'alpha').out);
  check('line shows WAITS-FOR', /WAITS-FOR:/.test(cli('list', 'alpha').out));
  check('a card cannot wait for itself', cli('wait-for', 'alpha', w.id, w.id).code !== 0);
  check('no two cards wait for each other', cli('wait-for', 'alpha', x.id, w.id).code !== 0);
  check('a card that is not there is refused', cli('wait-for', 'alpha', w.id, 'ALP-999').code !== 0);
  const wp = await openPage(ctx, '#/p/alpha');
  await wp.waitForSelector('.card');
  check('the board shows a ⏳ chip with the blocker, greyed', await wp.$eval(`.card[data-id="${w.id}"]`, (e, id) => e.classList.contains('is-waiting') && !!e.querySelector('.pill.waits') && e.querySelector('.pill.waits').textContent.includes(id), x.id));
  await wp.goto(`${BASE}/#/p/alpha/${w.id}`);
  await wp.waitForSelector('#wf-box .pill.waits');
  check('the card has the ⏳ Waits for box with a picker', !!(await wp.$('#wf-box')) && (await wp.focus('#wf-add'), (await wp.$$('#wf-add option')).length > 1));
  await wp.selectOption('#wf-add', sp.id);
  await until(async () => (await getCard(s, 'alpha', w.id)).waitsFor.includes(sp.id));
  check('the picker adds a card to wait for', (await getCard(s, 'alpha', w.id)).waitsFor.length === 2);
  await s.ok('PATCH', `/api/projects/alpha/cards/${w.id}`, { waitsFor: [x.id] });
  noErrors(wp);
  await wp.close();

  // a waiting test stays out of the inbox and For you; it pops back when the blocker is done
  const tw = await mkCard(s, 'alpha', 'Waiting test', { status: 'doing' });
  cli('test', 'alpha', tw.id, '1. Try it', '--as', 'Forge');
  check('before waiting, the test is in the inbox', (await s.ok('GET', '/api/inbox')).some(i => i.id === tw.id));
  cli('wait-for', 'alpha', tw.id, x.id);
  check('waiting, it leaves the inbox', !(await s.ok('GET', '/api/inbox')).some(i => i.id === tw.id));
  const tm = await mkCard(s, 'alpha', 'Waiting team card', { status: 'team' });
  cli('wait-for', 'alpha', tm.id, x.id);
  await s.ok('PATCH', `/api/projects/alpha/cards/${x.id}`, { status: 'done' });
  await sleep(200);
  check('when the blocker is done, nothing waits any more', !(await getCard(s, 'alpha', w.id)).waiting && !(await getCard(s, 'alpha', tw.id)).waiting);
  check('it appears in the inbox again, top of its pile', (await s.ok('GET', '/api/inbox'))[0].id === tw.id);
  const popped = await getCard(s, 'alpha', tm.id);
  check('a team card gets a wake-up note', popped.comments.some(m => m.wake && /⏳/.test(m.text)), popped.comments);
  check('and the follow-up is back in next', /Follow-up/.test(cli('next', 'alpha').out));
  check('clearing a wait works', cli('wait-for', 'alpha', w.id, '--clear').code === 0 && !(await getCard(s, 'alpha', w.id)).waitsFor);
}, true);
