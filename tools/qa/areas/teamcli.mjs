// QA area: teamcli (AIG-1434): a named helper's CLI write (node aigile.js comment ... --as <Name>) counts as working for a while
// after its last write (15 minutes; AIGILE_CLI_LIVE_MS here), by the one rule in lib/teamlive.js: in the board's Team panel, on Home and
// in the public snapshot's team. A helper not on the team shows as a guest row. The owner never counts, nor a page write.
import path from 'path';
import os from 'os';
import { startRelay, until, check, sleep, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';

def('teamcli', 'a CLI write --as Helper makes Helper show as working in the Team panel, on Home and in the public snapshot, and drops off after the window; the owner never counts (AIG-1434)', async (s, ctx) => {
  const relay = await startRelay();
  try {
    await s.ok('POST', '/api/dms/settings', { relay: relay.base });
    await mkProject(s, 'Cli Team', 'CLT');
    const c = await mkCard(s, 'cli-team', 'Something to build');
    await s.ok('POST', '/api/projects/cli-team/team', { name: 'Bob', role: 'Backend', status: '💤 idle' });
    await s.ok('PATCH', '/api/projects/cli-team', { public: true, publicName: 'qa-cli-team' });
    const json = async () => { const r = await fetch(relay.base + '/b/qa-cli-team.json'); return r.ok ? r.json() : {}; };
    check('the public board is out, with nobody at work yet', !!(await until(async () => Array.isArray((await json()).team), 10000)) && !(await json()).team.length, await json());
    const owner = 'Owner';   // the QA board's owner (AIGILE_OWNER)

    const page = await openPage(ctx, '#/p/cli-team');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForSelector('.side .box');
    const rows = () => page.$$eval('.side .box:first-child tr', trs => trs.slice(1).map(tr => [tr.querySelector('b').textContent, tr.lastElementChild.textContent]));
    check('before: the Team panel shows nobody working', !(await rows()).length, await rows());

    // The writes: a guest helper and a team member on the CLI; the owner on the CLI and a page comment do not count.
    for (const [as, text] of [['Helper', '- on it'], ['Bob', '- checking'], [owner, '- owner note']]) {
      const r = s.cli(['comment', 'cli-team', c.id, text, '--as', as]);
      check(`CLI comment --as ${as} works`, r.code === 0, r.err || r.out);
    }
    await s.ok('POST', `/api/projects/cli-team/cards/${c.id}/comments`, { author: 'Pagey', text: 'from the page' });
    const pr = (await s.ok('GET', '/api/projects/cli-team')).presence;
    check('presence.cli lists the two helpers, not the owner or a page write', JSON.stringify((pr.cli || []).map(w => w.name).sort()) === JSON.stringify(['Bob', 'Helper']) && pr.cli.every(w => Date.parse(w.until) > Date.now()), pr.cli);
    const home = (await s.ok('GET', '/api/projects')).find(p => p.slug === 'cli-team');
    check('Home: both count as working', JSON.stringify(home.team.map(m => m.name).sort()) === JSON.stringify(['Bob', 'Helper']), home.team.map(m => m.name));
    await page.reload(); await page.waitForSelector('.side table');
    const r = await rows();
    check('Team panel: Helper (a guest) and Bob show working (command line)', r.length === 2 && r.every(([, st]) => st === '⚡ working (command line)') && r.some(([n]) => n === 'Helper') && r.some(([n]) => n === 'Bob'), r);
    check('Team panel: the owner is not listed', !r.some(([n]) => n === owner));
    check('public snapshot: the team has Helper and Bob', !!(await until(async () => JSON.stringify(((await json()).team || []).map(m => m.name).sort()) === JSON.stringify(['Bob', 'Helper']), 10000)), (await json()).team);
    await page.screenshot({ path: process.env.QA_SHOT_1434 || path.join(os.tmpdir(), 'qa-teamcli.png') }).catch(() => {});
    // Phone width and dark mode: the rows still fit.
    await page.setViewportSize({ width: 390, height: 800 }); await sleep(300);
    check('phone: the Team panel fits the width', await page.evaluate(() => document.documentElement.scrollWidth <= 392));
    await page.setViewportSize({ width: 1280, height: 800 });

    // The window ends: nobody is working any more, on the page (no reload needed) and on the public board.
    // (the page polls its project's stamp every few seconds; the stamp moves when a window ends)
    check('after the window: the Team panel shows nobody working, without a reload', !!(await until(async () => !(await rows()).length, 12000)), await rows());
    check('after the window: presence.cli is empty', !((await s.ok('GET', '/api/projects/cli-team')).presence.cli || []).length);
    check('after the window: the public snapshot team is empty again', !!(await until(async () => !((await json()).team || []).length, 10000)), (await json()).team);
    noErrors(page);
  } finally { relay.stop(); }
}, true, { AIGILE_CLI_LIVE_MS: '4000', AIGILE_PUBLIC_MS: '300' });
