// QA area: usageshare (AIG-685/686): token use shared with friends. Three boards on temp data and a local relay: A shares,
// B and C are A's friends. Off by default nothing is sent; on with nobody picked nothing is sent; one friend picked:
// only that friend sees the numbers; All friends: both; off again: both lose it. Only numbers cross. The Usage page's
// switch and friend picks, and the "Token use" glance in the friend's chat.
import fs from 'node:fs';
import path from 'node:path';
import { freePort, startRelay, until, check, sleep, tmp, startServer, mkProject, openPage, noErrors, def } from '../lib.mjs';
import { pair } from './share.mjs';

const folderOf = p => String(p).replace(/[^A-Za-z0-9]/g, '-').toLowerCase();

def('usageshare', 'token use shared with friends: a switch per project on the Usage page, off by default; All friends or one by one; the friend sees today and this week in their chat (AIG-685/686)', async (a, ctx) => {
  const relay = await startRelay();
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const c = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    // A's project has 100 tokens today in its session logs (written before the first usage read).
    const dir = tmp('usage-share');
    const sess = path.join(a.usageDir, folderOf(dir)); fs.mkdirSync(sess, { recursive: true });
    fs.writeFileSync(path.join(sess, 's.jsonl'), JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date().toISOString(), message: { id: 'm1', model: 'opus', usage: { input_tokens: 10, output_tokens: 90, cache_read_input_tokens: 5 }, content: [{ type: 'text', text: 'secret card text' }] } }) + '\n');
    await mkProject(a, 'Alpha', 'ALP', { path: dir, description: 'Private plans' });

    const { ca, cb } = await pair(a, b, relay);   // ca: B's contact for A; cb: A's contact for B ("Beatrix")
    await c.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await a.ok('POST', '/api/dms/invites', { name: 'Cosmo' });
    const cac = await c.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });   // C's contact for A
    const cc = await until(async () => (await a.ok('GET', '/api/dms/contacts')).find(x => x.name === 'Cosmo'));
    check('A has two friends, B and C', cb && cc && cb.id !== cc.id);
    const seenB = () => b.ok('GET', `/api/dms/contacts/${ca.id}/usage`), seenC = () => c.ok('GET', `/api/dms/contacts/${cac.id}/usage`);
    const sentFile = path.join(a.data, 'dms', 'usage-sent.json');
    const patch = body => a.api('PATCH', '/api/projects/alpha', body);

    // Off by default: nothing is sent.
    const st = await a.ok('GET', '/api/usage/shares');
    check('a project starts with sharing off and nobody picked', st.projects.alpha && st.projects.alpha.on === false && Array.isArray(st.projects.alpha.with) && !st.projects.alpha.with.length, st);
    check('the friends to pick are listed', st.friends.map(f => f.name).sort().join() === 'Beatrix,Cosmo', st.friends);
    await sleep(1500);
    check('off: nothing was sent to anyone', !fs.existsSync(sentFile) && !(await seenB()).projects.length && !(await seenC()).projects.length);

    // Only the owner: a team on the CLI can't switch it.
    const asTeam = await fetch(a.base + '/api/projects/alpha', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'cli', 'X-Aigile-As': 'Alpha Lead' }, body: JSON.stringify({ shareUsage: true, shareUsageWith: 'all' }) });
    check('a team cannot turn sharing on (403)', asTeam.status === 403);
    check('a bad friend list is refused', (await patch({ shareUsageWith: ['nope'] })).status === 400 && (await patch({ shareUsageWith: 'everyone' })).status === 400);

    // On, nobody picked yet: still nothing goes.
    check('switched on', (await patch({ shareUsage: true })).status === 200);
    const on = (await a.ok('GET', '/api/usage/shares')).projects.alpha;
    check('on with nobody picked at first', on.on === true && Array.isArray(on.with) && !on.with.length, on);
    await sleep(1500);
    check('on but nobody picked: nothing sent', !(await seenB()).projects.length && !(await seenC()).projects.length);

    // One friend picked: B sees the numbers, C doesn't.
    check('B picked', (await patch({ shareUsageWith: [cb.id] })).status === 200);
    const gotB = await until(async () => { const g = await seenB(); return g.projects.length && g; });
    check('B sees Alpha\'s tokens today and this week', gotB && gotB.projects.length === 1 && gotB.projects[0].name === 'Alpha' && gotB.projects[0].today === 100 && gotB.projects[0].week === 100 && !!gotB.at, gotB);
    check('only numbers cross: no card text, description or path', gotB && Object.keys(gotB.projects[0]).sort().join() === 'id,name,today,week' && !JSON.stringify(gotB).includes('secret') && !JSON.stringify(gotB).includes('Private') && !JSON.stringify(gotB).includes(dir.replace(/\\/g, '\\\\')), gotB);
    await sleep(1500);
    check('C, not picked, sees nothing', !(await seenC()).projects.length);
    check('the glance is not a chat line', !(await b.ok('GET', `/api/dms/contacts/${ca.id}/messages`)).some(m => /Alpha|usage/.test(JSON.stringify(m))));

    // The same numbers are not sent again.
    const sent1 = JSON.parse(fs.readFileSync(sentFile, 'utf8'));
    await patch({ shareUsageWith: [cb.id] });
    await sleep(800);
    check('nothing changed: nothing resent', JSON.parse(fs.readFileSync(sentFile, 'utf8'))[cb.id].seq === sent1[cb.id].seq);

    // All friends: both see it.
    check('All friends', (await patch({ shareUsageWith: 'all' })).status === 200);
    const gotC = await until(async () => { const g = await seenC(); return g.projects.length && g; });
    check('with All friends, C sees it too', gotC && gotC.projects[0].name === 'Alpha' && gotC.projects[0].today === 100, gotC);
    check('and B still does', (await seenB()).projects.length === 1);

    // Off again: both lose it.
    await patch({ shareUsage: false });
    check('off again: B and C no longer see it', !!(await until(async () => !(await seenB()).projects.length && !(await seenC()).projects.length)));
    check('the friend list is kept for next time', (await a.ok('GET', '/api/usage/shares')).projects.alpha.with === 'all');
    await patch({ shareUsageWith: [] });

    // The page: the Usage table's switch, then All friends.
    const page = await openPage(ctx, '#/usage');
    await page.waitForSelector('.uz-share input[data-uzshare="alpha"]', { timeout: 10000 }).catch(() => {});
    check('the by-project table has a share switch per project, off', await page.locator('.uz-share input[data-uzshare="alpha"]').count() === 1 && !(await page.isChecked('.uz-share input[data-uzshare="alpha"]')));
    check('no friend picks while off', await page.locator('.uz-share [data-uzall]').count() === 0);
    await page.click('.uz-share input[data-uzshare="alpha"]');
    await page.waitForSelector('.uz-share [data-uzall="alpha"]', { timeout: 5000 }).catch(() => {});
    const row = await page.textContent('.uz-share').catch(() => '');
    check('on: All friends and each friend to pick, nobody picked yet', /All friends/.test(row) && /Beatrix/.test(row) && /Cosmo/.test(row) && /Pick who sees it/.test(row) && !(await page.isChecked('.uz-share [data-uzall="alpha"]')), row);
    await page.click(`.uz-share [data-uzfriend="alpha"][value="${cc.id}"]`);
    check('picking Cosmo on the page sends to C', !!(await until(async () => (await seenC()).projects.length === 1)));
    check('the page saved the pick', JSON.stringify((await a.ok('GET', '/api/usage/shares')).projects.alpha.with) === JSON.stringify([cc.id]));
    await page.click('.uz-share [data-uzall="alpha"]');
    check('ticking All friends on the page sends to B as well', !!(await until(async () => (await seenB()).projects.length === 1)) && (await a.ok('GET', '/api/usage/shares')).projects.alpha.with === 'all');
    noErrors(page);

    // B's chat with A shows the small Token use glance.
    const pb = await openPage(ctx, '');
    await pb.goto(b.base + '/');
    await pb.waitForSelector('#app > *', { timeout: 8000 });
    await pb.click('#dmRail [data-dms]');
    await pb.click(`#dmPanel [data-dm="dm:${ca.id}"]`);
    await pb.waitForSelector('#dmUsage:not([hidden])', { timeout: 8000 }).catch(() => {});
    const glance = await pb.textContent('#dmUsage').catch(() => '');
    check('B\'s chat with A shows Token use: Alpha, today and this week', /Token use/.test(glance) && /Alpha/.test(glance) && /today\s*100/.test(glance) && /this week\s*100/.test(glance), glance);
    noErrors(pb);
  } finally { b.stop(); c.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
