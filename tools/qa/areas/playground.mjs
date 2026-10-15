// QA area: playground (AIG-818, AIG-819). New playground in the New project box: a friend's name makes "<Friend> playground" (folder under the
// projects folder, in the Playgrounds space, Playground type, approvals on) and shows the invite code with Copy; a team call gets 403; the CLI does the same.
import fs from 'fs';
import path from 'path';
import { freePort, startRelay, startServer, until, check, sleep, openPage, noErrors, def, tmp } from '../lib.mjs';

const HOME = tmp('playhome');   // the projects folder of this run: never the real one

def('playground', 'Playground: New playground button (friend name, folder, Playgrounds space, invite code + Copy, member role, approvals), team 403, CLI, phone width, dark (AIG-818/819)', async (s, ctx) => {
  const off = await s.api('POST', '/api/playgrounds', { name: 'Early' });
  check('with DMs off it says why and makes nothing', off.status === 409 && /DMs/.test(JSON.stringify(off.body)) && !fs.existsSync(path.join(HOME, 'Early playground')) && !(await s.ok('GET', '/api/projects')).length, off);
  const relay = await startRelay();
  await s.ok('POST', '/api/dms/settings', { relay: relay.base });
  await s.ok('POST', '/api/dms/settings', { on: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  const bad = await s.api('POST', '/api/playgrounds', { name: '  ' });
  check('an empty name is refused', bad.status === 400, bad);
  const raw = await fetch(s.base + '/api/playgrounds', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'background', 'X-Aigile-As': 'Someone' }, body: JSON.stringify({ name: 'Sneaky' }) });
  check('a team call gets 403 and makes nothing', raw.status === 403 && !fs.existsSync(path.join(HOME, 'Sneaky playground')), raw.status);

  /* ---------- the button ---------- */
  const page = await openPage(ctx, '#/');
  await page.evaluate(() => newProject());
  await page.waitForSelector('#p-play');
  check('the New project box keeps its form and adds a New playground button', await page.locator('#p-name').count() === 1 && /playground/i.test(await page.textContent('#p-play')));
  await page.click('#p-play');
  await page.waitForSelector('#pg-name');
  await page.click('#pg-go');
  check('Create without a name says so', (await page.textContent('#d-err')).trim().length > 0 && await page.locator('#pg-code').count() === 0);
  await page.fill('#pg-name', 'Ana');
  await page.click('#pg-go');
  await page.waitForSelector('#pg-code');
  const code = await page.inputValue('#pg-code');
  check('the invite code is shown', code.length > 40, code.length);
  await page.click('#pg-copy');
  await page.waitForFunction(() => document.getElementById('pg-msg').textContent.trim().length > 0);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => code);
  check('Copy puts the code on the clipboard', clip === code, clip.slice(0, 20));
  const dir = path.join(HOME, 'Ana playground');
  check('the project folder exists under the projects folder', fs.existsSync(dir), dir);
  const p = await s.ok('GET', '/api/projects/ana-playground');
  check('the project is in the Playgrounds space, Playground type, approvals on', p.parent === 'playgrounds' && p.projectType === 'playground' && p.approvals === true, JSON.stringify([p.parent, p.projectType, p.approvals]));
  const sp = await s.ok('GET', '/api/projects/playgrounds');
  check('the Playgrounds space was made and holds it', sp.space.kids.some(k => k.slug === 'ana-playground'));
  const inv = JSON.parse(fs.readFileSync(path.join(s.data, 'dms', 'invites.json'), 'utf8'));
  check('the invite is for Ana, on that project, as a Member (raise and comment, not admin)', inv.some(i => i.name === 'Ana' && i.play && i.play.slug === 'ana-playground' && i.play.role === 'member'), JSON.stringify(inv.map(i => i.play)));
  const types = await s.ok('GET', '/api/project-types');
  check('Playground is one of the project types', types.some(t => t.id === 'playground'));
  const dup = await s.api('POST', '/api/playgrounds', { name: 'Ana' });
  check('the same friend twice is refused (409)', dup.status === 409, dup);

  /* ---------- the CLI ---------- */
  const cli = s.cli(['playground', 'Ben Jones'], { AIGILE_BACKGROUND: '', AIGILE_ROLE: '' });
  const last = cli.out.split(/\r?\n/).pop().trim();
  check('aigile playground prints the invite code and makes the project', cli.code === 0 && last.length > 40 && fs.existsSync(path.join(HOME, 'Ben Jones playground')) && (await s.ok('GET', '/api/projects/ben-jones-playground')).parent === 'playgrounds', cli);
  const sp2 = await s.ok('GET', '/api/projects/playgrounds');
  check('both sit in the one Playgrounds space', sp2.space.kids.length === 2 && (await s.ok('GET', '/api/projects')).filter(x => x.slug === 'playgrounds').length === 1);
  noErrors(page);
  await page.close();

  /* ---------- review fixes: no minting from the public invite route; the safety check stays; known friends ---------- */
  const mint = await s.ok('POST', '/api/dms/invites', { name: 'Mallory', play: { slug: 'ana-playground', role: 'admin' } });
  const invs = JSON.parse(fs.readFileSync(path.join(s.data, 'dms', 'invites.json'), 'utf8'));
  check('a team call to the public invite route with play set gets a plain invite (no share)', mint.code && invs.filter(i => i.name === 'Mallory').every(i => !i.play), JSON.stringify(invs.map(i => i.play)));
  const boards = [];   // one friend's board each (a board takes one invite from this owner)
  const join = async code => { const x = await startServer({ AIGILE_DM_POLL_MS: '300' }, await freePort()); boards.push(x); await x.ok('POST', '/api/dms/settings', { relay: relay.base }); await x.ok('POST', '/api/dms/settings', { on: true }); await x.ok('POST', '/api/dms/accept', { code, name: 'Owner' }); };
  try {
    const cleo = await s.ok('POST', '/api/playgrounds', { name: 'Cleo' });
    await join(cleo.code);
    const find = async n => (await s.ok('GET', '/api/dms/contacts')).find(c => c.name === n);
    const cc = await until(() => find('Cleo'));
    check('the friend added the code: a contact, but no share yet (safety check not skipped)', !!cc && !cc.checked && (await s.ok('GET', '/api/shares?slug=cleo-playground')).length === 0);
    await s.ok('PATCH', '/api/dms/contacts/' + cc.id, { checked: true });
    const links = await until(async () => { const l = await s.ok('GET', '/api/shares?slug=cleo-playground'); return l.length ? l : null; });
    check('ticking They match offers the playground as a Member', !!links && /member/.test(JSON.stringify(links[0])) && !/admin/.test(JSON.stringify(links[0])), JSON.stringify(links));
    // a friend already known: no invite, the playground is offered (now if checked, after the check if not)
    const inv2 = await s.ok('POST', '/api/dms/invites', { name: 'Dora' });
    await join(inv2.code);
    const dora = await until(() => find('Dora'));
    const d1 = await s.ok('POST', '/api/playgrounds', { name: 'Dora' });
    check('a known unchecked friend: no invite code, told to check', !d1.code && d1.friend === 'unchecked' && (await s.ok('GET', '/api/shares?slug=dora-playground')).length === 0, JSON.stringify(d1));
    await s.ok('PATCH', '/api/dms/contacts/' + dora.id, { checked: true });
    check('after the check the playground is offered', !!(await until(async () => (await s.ok('GET', '/api/shares?slug=dora-playground')).length)));
    const inv3 = await s.ok('POST', '/api/dms/invites', { name: 'Eve' });
    await join(inv3.code);
    const eve = await until(() => find('Eve'));
    await s.ok('PATCH', '/api/dms/contacts/' + eve.id, { checked: true });
    const e1 = await s.ok('POST', '/api/playgrounds', { name: 'Eve' });
    const el = await s.ok('GET', '/api/shares?slug=eve-playground');
    check('a known checked friend: no invite code, offered straight away as a Member', !e1.code && e1.friend === 'checked' && el.length === 1 && /member/.test(JSON.stringify(el[0])), JSON.stringify([e1, el]));
  } finally { boards.forEach(x => x.stop()); }
  const lonely = await s.api('POST', '/api/playgrounds', { name: 'Ana' });
  check('a refused playground leaves no half project and no stray invite', lonely.status === 409 && !(await s.ok('GET', '/api/projects')).some(x => x.slug === 'early-playground'));

  /* ---------- phone width, dark ---------- */
  for (const [label, scheme] of [['phone', 'light'], ['phone, dark', 'dark']]) {
    const c = await ctx.browser().newContext({ viewport: { width: 375, height: 700 }, colorScheme: scheme });
    const pp = await openPage(c, '#/');
    await pp.evaluate(() => newProject()); await pp.waitForSelector('#p-play'); await pp.click('#p-play');
    await pp.fill('#pg-name', 'Phone Pal ' + scheme); await pp.click('#pg-go'); await pp.waitForSelector('#pg-code');
    const fit = await pp.evaluate(() => { const r = document.getElementById('pg-copy').getBoundingClientRect(), d = document.getElementById('pg-code').getBoundingClientRect(); return { w: document.documentElement.scrollWidth, copy: r.right, code: d.right, bg: getComputedStyle(document.getElementById('pg-code')).backgroundColor, fg: getComputedStyle(document.getElementById('pg-code')).color }; });
    check(label + ': no sideways scroll, code box and Copy fit', fit.w <= 375 && fit.copy <= 375 && fit.code <= 375, JSON.stringify(fit));
    if (scheme === 'dark') check('dark: the code box is not light on light', fit.bg !== fit.fg, JSON.stringify(fit));
    await c.close();
  }
  await relay.stop();
}, true, { AIGILE_HOME: HOME, AIGILE_DM_POLL_MS: '300' });
