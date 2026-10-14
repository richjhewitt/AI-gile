// QA area: spacelead (AIG-439). A space may name one lead (off by default): its own, or one of its child projects' leads. Off:
// the space's news wakes the space's own team as before. On (a child): the space's ideas, Lead chat and stand-ups go to the
// child's lead (dispatcher line and wake in the child, /updates of the child, marked seen together), and its brief lists the
// space's projects and their To do. Set in the 🎨 Look dialog of a space, owner only.
import fs from 'node:fs';
import { check, sleep, until, tmp, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('spacelead', '🪐 space lead: off = the space keeps its own lead; on = space ideas, Lead chat and stand-ups go to the named child lead, whose brief lists the child projects (AIG-439)', async (s, ctx) => {
  const fleetDir = tmp('sl-fleet'), shipDir = tmp('sl-ship');
  await mkProject(s, 'Fleet', 'FLT', { path: fleetDir });
  await mkProject(s, 'Ship', 'SHP', { path: shipDir, parent: 'fleet' });
  await mkProject(s, 'Dock', 'DCK', { parent: 'fleet' });
  await s.ok('POST', '/api/projects/fleet/team', { name: 'Admiral', role: 'Lead' });
  await s.ok('POST', '/api/projects/ship/team', { name: 'Skipper', role: 'Lead' });
  await mkCard(s, 'dock', 'Paint the dock', { status: 'todo' });
  const logOf = async slug => ((await s.ok('GET', '/api/projects/' + slug)).log || []).filter(e => e.author === 'Dispatcher').map(e => e.text);
  const idle = slug => until(async () => !(await s.ok('GET', '/api/projects/' + slug)).presence.running, 15000);
  const stub = () => { try { return fs.readFileSync(s.wakeOut, 'utf8'); } catch { return ''; } };
  await sleep(500); await idle('fleet'); await idle('ship');

  // Off (no field): unchanged, the space's own lead answers.
  check('a space has no lead set by default', !(await s.ok('GET', '/api/projects/fleet')).spaceLead);
  const idea0 = await mkCard(s, 'fleet', 'Idea: a lighthouse', { status: 'team', createdBy: 'Owner' });
  await until(async () => (await logOf('fleet')).some(t => t.startsWith(idea0.id + ' -> ')));
  check('off: a space idea goes to the space\'s own lead', (await logOf('fleet')).some(t => t.startsWith(idea0.id + ' -> Admiral')), await logOf('fleet'));
  check('off: nothing reaches the child\'s lead', !(await logOf('ship')).length, await logOf('ship'));
  await idle('fleet');

  // Setting it: owner only, only the space itself or one of its own projects.
  const team = (method, url, body) => fetch(s.base + url, { method, headers: { 'Content-Type': 'application/json', 'x-aigile-where': 'cli', 'x-aigile-as': 'Skipper' }, body: JSON.stringify(body) }).then(r => r.status);
  check('a team cannot set the space lead', (await team('PATCH', '/api/projects/fleet', { spaceLead: 'ship' })) === 403);
  check('a project outside the space is refused', (await s.api('PATCH', '/api/projects/fleet', { spaceLead: 'nowhere' })).status === 400);
  await s.ok('PATCH', '/api/projects/fleet', { spaceLead: 'fleet' });
  check('the space itself can lead (its own lead)', (await s.ok('GET', '/api/projects/fleet')).spaceLead === 'fleet');

  // The Look dialog of a space has the picker; pick Ship's lead and save.
  const page = await openPage(ctx, '#/p/fleet');
  await until(() => page.evaluate(() => typeof lookDialog === 'function' && !!state.project && !!state.project.space), 8000);
  await page.evaluate(() => lookDialog());
  await page.waitForSelector('#look-spacelead', { timeout: 8000 });
  const opts = await page.$$eval('#look-spacelead option', os => os.map(o => o.value));
  check('the picker offers off, the space itself and each child project', opts[0] === '' && opts[1] === 'fleet' && opts.slice(2).sort().join() === 'dock,ship', opts);
  check('it shows the saved choice', (await page.inputValue('#look-spacelead')) === 'fleet');
  await page.selectOption('#look-spacelead', 'ship');
  await page.click('dialog button.primary, .dialog button.primary');
  await until(async () => (await s.ok('GET', '/api/projects/fleet')).spaceLead === 'ship', 8000);
  check('saving the Look dialog sets Ship\'s lead as the space lead', (await s.ok('GET', '/api/projects/fleet')).spaceLead === 'ship');
  noErrors(page); await page.close();
  check('a plain project (no children) shows no picker data', !(await s.ok('GET', '/api/projects/dock')).space.kids.length);

  // On: a space DM (Lead chat) and a space idea reach the named lead.
  await idle('fleet'); await idle('ship');
  fs.rmSync(s.wakeOut, { force: true });
  await s.ok('POST', '/api/projects/fleet/leadchat', { author: 'Owner', text: 'Who is on watch tonight?' });
  await until(async () => (await logOf('ship')).some(t => t.startsWith('chat (space fleet) -> ')));
  check('on: a space DM goes to the named lead', (await logOf('ship')).some(t => t.startsWith('chat (space fleet) -> Skipper')), await logOf('ship'));
  let out = '';
  for (let i = 0; i < 60 && !(out = stub()).includes('Space Fleet (fleet)'); i++) await sleep(250);
  check('on: the child\'s team is woken in its own folder, told about the space', out.includes('Space Fleet (fleet) has news') && out.includes('project ship'), out.slice(0, 600));
  await idle('ship');
  const idea = await mkCard(s, 'fleet', 'Idea: a second mast', { status: 'team', createdBy: 'Owner' });
  await until(async () => (await logOf('ship')).some(t => t.startsWith(idea.id + ' (space fleet) -> ')));
  check('on: a space idea goes to the named lead', (await logOf('ship')).some(t => t.startsWith(idea.id + ' (space fleet) -> Skipper')), await logOf('ship'));
  check('on: the space\'s own lead is not woken for it', !(await logOf('fleet')).some(t => t.startsWith(idea.id + ' ')), await logOf('fleet'));
  await idle('ship');

  // Stand-up on the space: the named lead is woken and counts as a member of it.
  await idle('ship'); fs.rmSync(s.wakeOut, { force: true });
  const st = await s.ok('POST', '/api/standup', { projects: ['fleet'] });
  check('a space stand-up wakes the named lead', st.woke.includes('Fleet'), st);
  for (let i = 0; i < 60 && !stub().includes('project ship'); i++) await sleep(250);
  check('the woken run is the child\'s', stub().includes('project ship'), stub().slice(0, 400));
  const rep = (await s.ok('GET', '/api/standups')).projects.find(x => x.project === 'fleet');
  check('the space stand-up waits for the named lead too', rep && rep.people.some(x => x.name === 'Skipper' && x.waiting), rep);
  await idle('ship');

  // The named lead's updates list the space's news and mark the space seen too.
  const u = await s.ok('GET', '/api/projects/ship/updates?mark=1');
  check('the lead\'s updates carry the space news', u.cards.some(c => c.chat && c.space && c.space.slug === 'fleet') && u.cards.some(c => c.id === idea.id && c.space), u.cards);
  check('marking seen also marks the space', !(await s.ok('GET', '/api/projects/ship/updates')).cards.length && !!(await s.ok('GET', '/api/projects/fleet')).teamSeenAt);
  const cli = s.cli(['updates', 'fleet', '--peek']);
  check('the CLI still reads the space\'s own updates', cli.code === 0, cli);

  // The brief lists the child projects and their To do.
  const br = s.cli(['brief', 'ship']);
  check('the lead\'s brief says it leads the space', /🪐 You lead the space Fleet \(fleet\)/.test(br.out), br.out.slice(-800));
  check('the brief lists the space\'s projects with their To do', /Dock \(dock\): DCK-1 Paint the dock/.test(br.out) && /Ship \(ship\)/.test(br.out), br.out.slice(-800));
  check('the plain child\'s brief has no space lines', !/You lead the space/.test(s.cli(['brief', 'dock']).out));

  // Back off: old behaviour again; a child that leaves the space stops leading it.
  await s.ok('PATCH', '/api/projects/fleet', { spaceLead: '' });
  check('off again clears the field', !(await s.ok('GET', '/api/projects/fleet')).spaceLead);
  check('the brief no longer lists the space', !/You lead the space/.test(s.cli(['brief', 'ship']).out));
  await s.ok('PATCH', '/api/projects/fleet', { spaceLead: 'ship' });
  await s.ok('PATCH', '/api/projects/ship', { parent: '' });
  const idea2 = await mkCard(s, 'fleet', 'Idea: a flag', { status: 'team', createdBy: 'Owner' });
  await until(async () => (await logOf('fleet')).some(t => t.startsWith(idea2.id + ' -> ')));
  check('a lead that left the space no longer leads it (the space\'s own lead again)', (await logOf('fleet')).some(t => t.startsWith(idea2.id + ' -> Admiral')) && !(await logOf('ship')).some(t => t.startsWith(idea2.id)), [await logOf('fleet'), await logOf('ship')]);
}, true);
