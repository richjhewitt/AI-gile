// QA area: major (AIG-1049): the 🚨 Major button on an incident card. Pressing it turns the project's swarm on, wakes the on-call agent
// (stub agent) with an order comment, sends exactly one Discord DM (stub API), a "Status line due" nudge comes after AIGILE_MAJOR_MS
// unless a "Status:" comment was added, and done (or pressing again) ends it: swarm off, timer stopped. Also the CLI and the card button.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { check, sleep, until, tmp, mkProject, mkCard, getCard, say, openPage, noErrors, def } from '../lib.mjs';

const DPORT = 4399, MS = 2500;
def('major', '🚨 major incident: swarm on, on-call woken, one Discord DM, status nudge on a timer, done ends it (AIG-1049)', async (s, ctx) => {
  const dms = [];
  const stub = http.createServer((req, res) => {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/users/@me/channels') return res.end(JSON.stringify({ id: 'CH1' }));
      if (/\/channels\/CH1\/messages$/.test(req.url)) { try { dms.push(JSON.parse(b).content); } catch {} return res.end('{}'); }
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise(r => stub.listen(DPORT, '127.0.0.1', r));
  try {
    const folder = tmp('major'), log = path.join(s.data, 'logs', 'maj.log');
    const starts = () => { try { return (fs.readFileSync(log, 'utf8').match(/started/g) || []).length; } catch { return 0; } };
    await mkProject(s, 'Maj', 'MAJ', { path: folder });
    await s.ok('POST', '/api/projects/maj/team', { name: 'Lead', role: 'lead' });
    await s.ok('POST', '/api/projects/maj/team', { name: 'Pager', role: 'Backend' });
    await s.ok('PATCH', '/api/projects/maj', { service: { on: true, onCall: 'Pager' } });
    const task = await mkCard(s, 'maj', 'plain task', { type: 'task', status: 'doing', assignee: 'Lead' });
    const inc = await mkCard(s, 'maj', 'Site down', { type: 'incident', status: 'doing', assignee: 'Lead' });
    check('only incident cards can be major', (await s.api('POST', `/api/projects/maj/cards/${task.id}/major`, {})).status === 400);

    // no Discord bot linked: no DM, still works
    const none = await s.ok('POST', `/api/projects/maj/cards/${inc.id}/major`, {});
    check('pressing sets major with a time', none.major && none.major.at, none);
    check('swarm is on for the project', !!(await until(async () => (await s.ok('GET', '/api/swarm')).slug === 'maj', 4000)));
    await sleep(300);
    check('with no Discord bot nothing is sent', dms.length === 0, dms);
    await s.ok('POST', `/api/projects/maj/cards/${inc.id}/major`, {});   // end it, then try again with a bot linked
    check('pressing again ends it and turns the swarm off', !(await s.ok('GET', '/api/swarm')).on && !(await getCard(s, 'maj', inc.id)).major);

    // link a bot (the test board's own settings file) and press
    const local = path.join(s.dir, 'aigile.local.json');
    const cfg = JSON.parse(fs.readFileSync(local, 'utf8')); cfg.discord = { bots: [{ name: 'QA', token: 'TKN', users: ['123456789'], target: 'maj' }] };
    fs.writeFileSync(local, JSON.stringify(cfg));
    const r = s.cli(['major', 'maj', inc.id, '--as', 'Owner']);
    check('CLI major presses it', /Major incident on/.test(r.out), r);
    check('swarm on', !!(await until(async () => (await s.ok('GET', '/api/swarm')).slug === 'maj', 4000)));
    const card = await getCard(s, 'maj', inc.id);
    check('card has major {at, by}', card.major && card.major.at && card.major.by, card.major);
    check('an order comment names the on-call agent', card.comments.some(c => /MAJOR INCIDENT/.test(c.text) && /Pager/.test(c.text)), card.comments);
    check('the on-call agent was woken (stub agent started)', !!(await until(() => starts() > 0, 6000)), starts());
    check('exactly one Discord DM to the first user', !!(await until(() => dms.length === 1, 4000)) && /Major incident on Maj: Site down/.test(dms[0]), dms);
    await sleep(600);
    check('never more than one alert per major', dms.length === 1, dms);

    // the card button
    const pg = await openPage(ctx, `#/p/maj/${inc.id}`);
    await pg.waitForSelector('.major button', { timeout: 8000 });
    check('the card shows major is on with an end button', /Major incident, started/.test(await pg.textContent('.major')) && /End major/.test(await pg.textContent('.major button')));
    noErrors(pg); await pg.close();

    // nudge: no Status: comment within the interval
    check('a "Status line due" nudge to the on-call agent comes after the interval', !!(await until(async () => (await getCard(s, 'maj', inc.id)).comments.some(c => /Status line due/.test(c.text) && /@Pager/.test(c.text)), MS + 8000)));
    const n1 = (await getCard(s, 'maj', inc.id)).comments.filter(c => /Status line due/.test(c.text)).length;
    await say(s, 'maj', inc.id, 'Pager', 'Status: found it, fixing');
    await sleep(MS * 0.6);
    check('a Status: comment holds the next nudge back', (await getCard(s, 'maj', inc.id)).comments.filter(c => /Status line due/.test(c.text)).length === n1);

    // done ends it
    await s.ok('PATCH', `/api/projects/maj/cards/${inc.id}`, { status: 'done', postmortem: { happened: 'down', why: 'bug', change: 'fix' } });
    const done = await getCard(s, 'maj', inc.id);
    check('done clears major and turns the swarm off', !done.major && !(await s.ok('GET', '/api/swarm')).on, done.major);
    const nn = done.comments.filter(c => /Status line due/.test(c.text)).length;
    await sleep(MS + 1200);
    check('the timer stops once it is done', (await getCard(s, 'maj', inc.id)).comments.filter(c => /Status line due/.test(c.text)).length === nn);

    // a swarm someone else turned on stays on
    const inc2 = await mkCard(s, 'maj', 'Second', { type: 'incident', status: 'doing', assignee: 'Lead' });
    await s.ok('POST', '/api/swarm', { slug: 'maj', by: 'Owner' });
    await s.ok('POST', `/api/projects/maj/cards/${inc2.id}/major`, {});
    await s.ok('POST', `/api/projects/maj/cards/${inc2.id}/major`, {});
    check('ending a major keeps a swarm this card did not turn on', (await s.ok('GET', '/api/swarm')).on);
    await s.ok('POST', '/api/swarm', { off: true });
  } finally { stub.close(); }
}, true, { AIGILE_MAJOR_MS: String(MS), AIGILE_DISCORD_API: `http://127.0.0.1:${DPORT}` });
