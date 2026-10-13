// QA area features (AIG-847): personal builds. The owner makes a switch (example key qa-example, QA only), ticks it for one
// friend in Friends; that friend's board gets only their own keys over the share link (Features.on('qa-example') is true,
// html[data-feat] set), another friend's board does not; team calls get 403; a card can carry featureKey; phone width and dark.
import { freePort, check, startServer, mkProject, mkCard, openPage, noErrors, def } from '../lib.mjs';
import { startRelay, pair, until } from './share.mjs';

def('features', 'personal builds: an owner-only switch list, tick a switch for one friend in Friends, that friend alone gets it over the share link (Features.on), team 403, featureKey on a card, phone + dark (AIG-847)', async (a, ctx) => {
  const relay = await startRelay(await freePort());
  const b = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  const c = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort());
  try {
    const { cb } = await pair(a, b, relay);
    await c.ok('POST', '/api/dms/settings', { on: true, relay: relay.base });
    const inv = await a.ok('POST', '/api/dms/invites', { name: 'Carla' });
    await c.ok('POST', '/api/dms/accept', { code: inv.code, name: 'Alberto' });
    const cc = await until(async () => (await a.ok('GET', '/api/dms/contacts')).find(x => x.id !== cb.id));
    const ca = (await c.ok('GET', '/api/dms/contacts'))[0], ba = (await b.ok('GET', '/api/dms/contacts'))[0];
    for (const [s, id] of [[a, cb.id], [a, cc.id], [b, ba.id], [c, ca.id]]) await s.ok('PATCH', `/api/dms/contacts/${id}`, { checked: true });
    await mkProject(a, 'Lima', 'LIM'); await mkProject(a, 'Lena', 'LEN'); await mkProject(b, 'Mike', 'MIK'); await mkProject(c, 'Nora', 'NOR');
    let live = 0;
    for (const [s, ct, slug, mine] of [[b, cb, 'mike', 'lima'], [c, cc, 'nora', 'lena']]) {
      const off = await a.ok('POST', '/api/shares', { slug: mine, contact: ct.id });
      await until(async () => (await s.ok('GET', '/api/shares')).find(l => l.id === off.id && l.state === 'incoming'));
      await s.ok('POST', `/api/shares/${off.id}/accept`, { slug });
      live++;
      await until(async () => (await a.ok('GET', '/api/shares')).filter(l => l.state === 'live').length >= live);
    }
    const asWho = (where, as, method, url, body) => fetch(a.base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': where, ...(as ? { 'X-Aigile-As': encodeURIComponent(as) } : {}) }, body: body && JSON.stringify(body) }).then(r => r.status);
    const owner = (await a.ok('GET', '/api/meta')).owner;
    const mineOf = s => s.ok('GET', '/api/features/mine').then(r => r.keys);

    // the list
    check('no switches to start with', (await a.ok('GET', '/api/features')).switches.length === 0);
    check('a bad key is refused', (await a.api('POST', '/api/features', { key: 'Bad Key' })).status === 400);
    const sw = await a.ok('POST', '/api/features', { key: 'qa-example', label: 'QA example' });
    check('a switch starts with nobody', sw.who === 'nobody' && sw.friends.length === 0, sw);

    // owner only
    check('a team call is 403 (list)', await asWho('background', 'Dev', 'GET', '/api/features') === 403);
    check('a team call is 403 (make)', await asWho('cli', 'Dev', 'POST', '/api/features', { key: 'x-team' }) === 403);
    check('a team call is 403 (give)', await asWho('cli', 'Dev', 'POST', `/api/features/qa-example/friends/${cb.id}`, { on: true }) === 403);
    check('a team call is 403 (remove)', await asWho('background', owner, 'DELETE', '/api/features/qa-example') === 403);
    check('the owner on the CLI is let in', await asWho('cli', owner, 'GET', '/api/features') === 200);
    check('no such friend is 404, no such switch is 404', (await a.api('POST', '/api/features/qa-example/friends/aaaaaaaaaaaa', { on: true })).status === 404 && (await a.api('POST', `/api/features/nope/friends/${cb.id}`, { on: true })).status === 404);

    // give it to one friend
    const g = await a.ok('POST', `/api/features/qa-example/friends/${cb.id}`, { on: true });
    check('the switch is now with one friend and was sent', g.who === 'some' && g.friends.length === 1 && g.pushed === true, g);
    await until(async () => (await mineOf(b)).includes('qa-example'));
    check("that friend's board has it", (await mineOf(b)).join() === 'qa-example');
    await new Promise(r => setTimeout(r, 1200));
    check('the other friend does not', (await mineOf(c)).length === 0);
    const lst = await a.ok('GET', '/api/features');
    check('the owner list shows who has what', lst.friends.find(f => f.id === cb.id).keys.join() === 'qa-example' && lst.friends.find(f => f.id === cc.id).keys.length === 0);

    // the page side
    const mk = async s => {
      const p = await ctx.newPage(); p.errors = [];
      await p.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
      p.on('pageerror', e => p.errors.push(e.message));
      await p.goto(s.base + '/'); await p.waitForSelector('#app > *');
      return p;
    };
    const pb = await mk(b);
    await pb.waitForFunction(() => typeof Features !== 'undefined' && Features.on('qa-example'));
    check("Features.on is true on the friend's page and html[data-feat] is set", (await pb.evaluate(() => [Features.on('qa-example'), Features.on('other'), document.documentElement.getAttribute('data-feat')])).join() === 'true,false,qa-example');
    const pc = await mk(c);
    check("Features.on is false on the other friend's page", await pc.evaluate(() => Features.on('qa-example') === false && !document.documentElement.getAttribute('data-feat')));
    check('no page errors on the friends\' pages', pb.errors.length === 0 && pc.errors.length === 0, [...pb.errors, ...pc.errors]);
    await pb.close(); await pc.close();

    // Friends: tick boxes
    const pg = await openPage(ctx, '#/setup');
    await pg.waitForSelector(`.dmf-c[data-cid="${cc.id}"] .feat-tick`);
    check('Friends shows a tick per friend, ticked for the one who has it', await pg.locator('.feat-tick').count() === 2 && await pg.locator(`.dmf-c[data-cid="${cb.id}"] .feat-tick`).isChecked() && !(await pg.locator(`.dmf-c[data-cid="${cc.id}"] .feat-tick`).isChecked()));
    await pg.check(`.dmf-c[data-cid="${cc.id}"] .feat-tick`);
    await until(async () => (await mineOf(c)).includes('qa-example'));
    check('ticking gives it to that friend', true);
    await pg.waitForSelector(`.dmf-c[data-cid="${cb.id}"] .feat-tick:checked`);
    await pg.uncheck(`.dmf-c[data-cid="${cb.id}"] .feat-tick`);
    await until(async () => !(await mineOf(b)).includes('qa-example'));
    check('unticking takes it away (the other friend keeps it)', (await mineOf(c)).includes('qa-example'));

    // a card for a friend carries a featureKey
    const proj = await mkProject(a, 'Card Test', 'CRD'); const slug = proj.slug || (proj.project && proj.project.slug);
    const card = await mkCard(a, slug, 'Custom for Carla', { featureKey: 'qa-example' });
    check('a card keeps featureKey', card.featureKey === 'qa-example', card);
    check('a bad featureKey is refused; empty clears it', (await a.api('PATCH', `/api/projects/${slug}/cards/${card.id}`, { featureKey: 'No Good' })).status === 400 && (await a.ok('PATCH', `/api/projects/${slug}/cards/${card.id}`, { featureKey: '' })).featureKey === undefined);

    // phone width and dark
    const ph = await ctx.browser().newContext({ viewport: { width: 390, height: 800 }, colorScheme: 'dark' });
    await ph.addInitScript(() => { try { localStorage.setItem('aigile.theme', 'dark'); localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
    const pp = await openPage(ph, '#/setup');
    await pp.waitForSelector('#featSec');
    const fit = await pp.evaluate(() => ({ w: document.documentElement.scrollWidth, iw: window.innerWidth, bg: getComputedStyle(document.body).backgroundColor, r: Math.max(...[...document.querySelectorAll('#featSec *, .dmf-feat *')].map(e => e.getBoundingClientRect().right)) }));
    check('phone width: nothing sticks out', fit.w <= fit.iw && fit.r <= fit.iw, JSON.stringify(fit));
    check('dark: the page is dark', fit.bg !== 'rgb(255, 255, 255)', fit.bg);
    noErrors(pp); await ph.close();
    check('no page errors', pg.errors.length === 0, pg.errors);
    await a.ok('DELETE', '/api/features/qa-example');
    check('a switch can be removed', (await a.ok('GET', '/api/features')).switches.length === 0);
  } finally { b.stop(); c.stop(); relay.stop(); }
}, true, { AIGILE_DM_POLL_MS: '300' });
