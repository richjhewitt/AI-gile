// QA area: 🌙 night watch pokes stuck teams itself, on the Scrum Master's push scale (AIG-516).
import fs from 'node:fs';
import path from 'node:path';
import { check, sleep, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

def('autopoke', '🔔 night watch pokes the teams that would show "needs a poke" itself: only with night watch on, frequency and cap follow the push scale, never over a lead in a session (AIG-516)', async (s, ctx) => {
  const pokes = async (slug, id) => (await getCard(s, slug, id)).comments.filter(m => m.poke && m.author !== 'Owner').length;
  const attention = async slug => (await s.ok('GET', '/api/projects')).find(p => p.slug === slug).attention;
  const settle = async slug => { for (let i = 0; i < 60 && (await s.ok('GET', '/api/projects/' + slug)).presence.running; i++) await sleep(250); };
  // A team whose comment from the owner went unanswered for an hour, and whose session is around (online): the "stuck" pill.
  const mk = async (name, key) => {
    const slug = name.toLowerCase(); await mkProject(s, name, key, { path: tmp(key) });
    const c = await mkCard(s, slug, 'Waiting', { status: 'doing' }); await say(s, slug, c.id, 'Owner', 'status?');
    return { slug, id: c.id };
  };
  const stale = ts => {   // call after the runs have ended
    for (const { slug } of ts) {
      const f = path.join(s.data, slug + '.json'), p = JSON.parse(fs.readFileSync(f, 'utf8')), old = new Date(Date.now() - 3600e3).toISOString();
      for (const c of p.cards) { for (const m of c.comments) if (m.author === 'Owner') m.at = old; if (c.createdBy === 'Owner') c.created = old; }
      fs.writeFileSync(f, JSON.stringify(p, null, 1));
    }
  };
  const online = ts => Promise.all(ts.map(t => s.ok('GET', `/api/projects/${t.slug}/updates`)));
  const round = () => s.ok('POST', '/api/watchman/round');
  const fast = await mk('Fast', 'FST'), slow = await mk('Slow', 'SLW'), capd = await mk('Capd', 'CAP'), lead = await mk('Lead', 'LED');
  const all = [fast, slow, capd, lead];
  for (const t of all) await settle(t.slug);
  stale(all); await online(all);
  await s.ok('POST', '/api/scrummaster/push', { level: 5 });
  check('the stuck pill is there', (await attention('fast'))?.kind === 'stuck', await attention('fast'));
  // 1. night watch off: nothing pokes, the pill stays as it was
  await round(); await sleep(300);
  check('with night watch off nothing is poked', (await pokes('fast', fast.id)) === 0 && !(await attention('fast')).auto);
  // 2. night watch on, crack the whip: poked at once, and the pill goes
  await s.ok('POST', '/api/quiet', { on: true, watch: ['fast', 'slow', 'capd', 'lead'] });
  await sleep(4500);   // going quiet messages and wakes the teams; let those runs end
  for (const t of all) await settle(t.slug);
  stale(all); await online(all);
  await s.ok('POST', '/api/scrummaster/push', { level: 5 });
  s.cli(['show', 'lead', lead.id], { VSCODE_PID: '1', AIGILE_BACKGROUND: '' });   // its lead sits in a session from now on
  const lead0 = await pokes('lead', lead.id);
  // 3. gentle: the frequency and the cap follow the scale
  await s.ok('POST', '/api/scrummaster/push', { level: 1 });
  const slow0 = await pokes('slow', slow.id);
  await round();
  check('gentle waits for its first poke', (await pokes('slow', slow.id)) === slow0);
  await sleep(300); await round();
  check('gentle still waits (60 min on the scale)', (await pokes('slow', slow.id)) === slow0);
  await sleep(500); await round();
  check('then gentle pokes once', (await pokes('slow', slow.id)) === slow0 + 1, await pokes('slow', slow.id));
  await round();
  check('and does not poke again at once (re-poke after 3 h on the scale)', (await pokes('slow', slow.id)) === slow0 + 1);
  // the cap: gentle allows 2 a night, then the pill comes back with a note
  await sleep(1900); await round();
  check('gentle\'s second poke is its last', (await pokes('slow', slow.id)) === slow0 + 2);
  await sleep(1900); await round();
  check('past the cap nothing more is poked', (await pokes('slow', slow.id)) === slow0 + 2);
  const held = await attention('slow');
  check('past the cap the pill shows, with the reason', held?.held?.why === 'cap' && !held.auto && held.held.cap === 2, held);
  const page = await openPage(ctx, '#/');
  await page.waitForSelector('#pokeTop .pokebadge');
  const title = await page.getAttribute('#pokeTop .pokebadge', 'title');
  check('the top bar shows it, saying why', /Slow/.test(title) && /most is 2/.test(title), title);
  await s.ok('POST', '/api/scrummaster/push', { level: 5 });
  const base = await pokes('fast', fast.id);
  await round();
  check('with night watch on and the whip cracked, a stuck team is poked at once', (await pokes('fast', fast.id)) === base + 1, await pokes('fast', fast.id));
  check('the poke is the 👉 comment of the owner\'s own route', (await getCard(s, 'fast', fast.id)).comments.filter(m => m.poke).at(-1).text === '👉 any update?');
  check('a poke on its way hides the pill (it says so)', (await attention('fast'))?.auto === true, await attention('fast'));
  await page.reload(); await page.waitForSelector('#pokeTop', { state: 'attached' }); await sleep(2500);   // the whip lifted the cap, so the badge may be gone altogether
  const topTitle = (await page.getAttribute('#pokeTop .pokebadge', 'title', { timeout: 500 }).catch(() => '')) || '';
  check('the top bar does not list it', !/Fast/.test(topTitle), topTitle);
  // 4. crack the whip
  await round(); await sleep(60);
  await round();
  check('crack the whip pokes again soon (10 min on the scale)', (await pokes('fast', fast.id)) >= base + 2, await pokes('fast', fast.id));
  for (let i = 0; i < 12; i++) { await sleep(120); await round(); }
  check('crack the whip is capped too (8 a night)', (await pokes('capd', capd.id)) === 8, await pokes('capd', capd.id));
  check('the cap is per team', (await attention('capd'))?.held?.why === 'cap');
  // 5. one lead: a team whose lead sits in a session is never poked
  check('a lead working in a session is not poked', (await pokes('lead', lead.id)) === lead0, await pokes('lead', lead.id));
  check('no pill and no poke for a lead in a session: it hears the comment there', (await attention('lead'))?.auto === true && !(await attention('lead')).held, await attention('lead'));
  check('the top bar does not list the lead either', !/Lead/.test((await page.getAttribute('#pokeTop .pokebadge', 'title', { timeout: 500 }).catch(() => '')) || ''));
  // 6. a project left off the watch list (the owner's choice) shows no pill either
  const off = await mk('Offlist', 'OFF'); await settle(off.slug); stale([off]); await online([off]);
  check('a project off the watch list shows no pill', (await attention('offlist'))?.auto === true && !(await attention('offlist')).held, await attention('offlist'));
  const off0 = await pokes('offlist', off.id); await round();
  check('and is not poked', (await pokes('offlist', off.id)) === off0);
  noErrors(page);
  await s.ok('POST', '/api/quiet', { on: false });
}, true, { AIGILE_POKE_MS: '10', AIGILE_ACTIVE_MS: '60000', AIGILE_ONLINE_MS: '60000' });
