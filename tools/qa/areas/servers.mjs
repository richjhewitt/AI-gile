// QA area: servers (AIG-374), Setup > My servers and the Open button on 🖥️ tasks.
// A fake Desktop folder and a stub opener (AIGILE_OPEN_STUB) so nothing really launches.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

const dir = tmp('servers'), desktop = path.join(dir, 'Desktop'), stub = path.join(dir, 'opened.log'), local = path.join(dir, 'local.json');
fs.mkdirSync(desktop);
for (const f of ['My Server.lnk', 'Other Server.lnk', 'Notes.lnk', 'server.txt']) fs.writeFileSync(path.join(desktop, f), '');
fs.writeFileSync(local, JSON.stringify({ owner: 'Owner', agent: { command: 'x', notesFile: 'CLAUDE.local.md', settingsFile: '.claude/settings.local.json' } }));
const opened = () => { try { return fs.readFileSync(stub, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };

def('servers', 'My servers in Setup (Desktop shortcut finder), 🖥️ tasks show Open <name>, click opens only the saved value (AIG-374)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const found = await s.ok('GET', '/api/servers/shortcuts');
  check('Desktop finder lists only .lnk files with "server" in the name', found.length === 2 && found.every(f => /Server\.lnk$/.test(f.path)), found);

  // no servers saved: the task links to Setup, opening is refused
  const a = await mkCard(s, 'alpha', 'Deploy it');
  s.cli(['task', 'alpha', a.id, 'on the server, run the migration', '--server', '--as', 'Lead']);
  const page0 = await openPage(ctx, '#/inbox');
  await page0.waitForSelector('#ibK .ib-item');
  await page0.waitForSelector('#ibK a.srv-open', { timeout: 5000 }).catch(() => {});
  check('no server saved: a "Set up your server in Setup" link', /Set up your server in Setup/.test(await page0.textContent('#ibK')), await page0.textContent('#ibK'));
  check('opening an unknown server is refused', (await s.api('POST', '/api/servers/open', { name: 'Nope' })).status === 404);

  // save a server through the Setup page
  const setup = await openPage(ctx, '#/setup');
  await setup.waitForSelector('#serversBox');
  await setup.click('#srvFind');
  await setup.waitForSelector('.srv-found');
  check('Setup offers the shortcuts it found', (await setup.$$('.srv-found')).length === 2);
  await setup.click('.srv-found[data-name="My Server"]');
  await setup.waitForFunction(() => document.querySelector('#serversBox input[data-srv="name"]')?.value === 'My Server');
  await sleep(500);
  const saved = JSON.parse(fs.readFileSync(local, 'utf8')).servers;
  check('the server is saved in the local settings file', saved && saved.length === 1 && saved[0].name === 'My Server' && /My Server\.lnk$/.test(saved[0].value), saved);
  check('a path with shell characters is refused', (await s.api('POST', '/api/setup', { prefs: { servers: [{ name: 'x', kind: 'path', value: 'C:/a%PATH%.lnk' }] } })).status === 400);

  // the task shows Open <name>; clicking calls the opener with the saved path only
  const page = await openPage(ctx, '#/inbox');
  await page.waitForSelector('#ibK [data-open-server]', { timeout: 6000 });
  check('the task shows "Open My Server"', (await page.textContent('#ibK [data-open-server]')).trim() === 'Open My Server');
  await page.click('#ibK [data-open-server]');
  await sleep(600);
  const o = opened();
  check('click opens the saved path, once', o.length === 1 && o[0].kind === 'path' && o[0].value === saved[0].value, o);

  // a path in card text is never opened
  const b = await mkCard(s, 'alpha', 'Sneaky');
  s.cli(['task', 'alpha', b.id, 'open C:/Windows/System32/calc.exe and "C:/evil.lnk"', '--server', '--as', 'Lead']);
  check('a name that is not saved is refused', (await s.api('POST', '/api/servers/open', { name: 'C:/Windows/System32/calc.exe' })).status === 404);
  check('no extra open happened', opened().length === 1, opened());

  // several servers: the card may name one, else a picker
  await s.ok('POST', '/api/setup', { prefs: { servers: [...saved, { name: 'Build Box', kind: 'cmd', value: 'ssh-placeholder' }] } });
  const c = await mkCard(s, 'alpha', 'Named');
  s.cli(['task', 'alpha', c.id, 'restart it', '--server', 'Build Box', '--as', 'Lead']);
  check('--server NAME stores the name', (await getCard(s, 'alpha', c.id)).serverName === 'Build Box');
  const page2 = await openPage(ctx, '#/inbox');
  await page2.waitForSelector('#ibK [data-open-server="Build Box"]', { timeout: 6000 });
  check('a named server shows its own button', true);
  check('an unnamed task with several servers shows a picker', (await page2.$$('#ibK [data-pick-server]')).length >= 1);
  await page2.click('#ibK [data-open-server="Build Box"]');
  await sleep(600);
  const o2 = opened();
  check('a command server opens by its saved command', o2.length === 2 && o2[1].kind === 'cmd' && o2[1].value === 'ssh-placeholder', o2);
  // AIG-701: May use sudo over ssh (default off, per-agent list), the brief line and aigile sudo-ok
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'Prod', kind: 'ssh', value: 'admin@example.test' }] } });
  const sv = async () => (await s.ok('GET', '/api/setup')).prefs.servers.find(x => x.name === 'Prod');
  check('sudo is off by default (no field saved)', (await sv()).sudo === undefined);
  const brief = () => s.cli(['brief', 'alpha', '--as', 'Lead']).out;
  check('brief says sudo: not allowed and points to a --server task', /Prod: sudo: not allowed: hand Owner a --server task/.test(brief()), brief());
  const ok1 = s.cli(['sudo-ok', 'alpha', 'Prod', '--as', 'Lead']);
  check('sudo-ok prints no and exits 1 when off', ok1.out === 'no' && ok1.code === 1, ok1);
  const sp = await openPage(ctx, '#/setup');
  await sp.waitForSelector('#serversBox input[data-srv="sudo"]');
  check('the switch shows, unticked, with its label', !(await sp.isChecked('#serversBox input[data-srv="sudo"]')) && /May use sudo over ssh/.test(await sp.textContent('#serversBox .srv-sudo')));
  await sp.check('#serversBox input[data-srv="sudo"]');
  await sleep(600);
  check('ticking the switch saves sudo: true', (await sv()).sudo === true, await sv());
  check('brief says sudo: allowed', /Prod: sudo: allowed/.test(brief()), brief());
  const ok2 = s.cli(['sudo-ok', 'alpha', 'Prod', '--as', 'Lead']);
  check('sudo-ok prints yes and exits 0 when on', ok2.out === 'yes' && ok2.code === 0, ok2);
  await sp.fill('#serversBox input[data-srv="sudoWho"]', 'Backend, Ops');
  await sp.press('#serversBox input[data-srv="sudoWho"]', 'Tab');
  await sleep(600);
  check('the per-agent list saves as names', JSON.stringify((await sv()).sudo) === '["Backend","Ops"]', await sv());
  check('a listed agent may (case-insensitive)', s.cli(['sudo-ok', 'alpha', 'prod', '--as', 'backend']).out === 'yes');
  const ok3 = s.cli(['sudo-ok', 'alpha', 'Prod', '--as', 'Lead']);
  check('an agent not on the list is told no (exit 1)', ok3.out === 'no' && ok3.code === 1, ok3);
  check('brief follows the list per agent', /Prod: sudo: allowed/.test(s.cli(['brief', 'alpha', '--as', 'Ops']).out) && /Prod: sudo: not allowed/.test(brief()));
  check('an unknown server is no', s.cli(['sudo-ok', 'alpha', 'Nope', '--as', 'Ops']).code === 1);
  await sp.uncheck('#serversBox input[data-srv="sudo"]');
  await sleep(600);
  check('unticking turns it off again', (await sv()).sudo === undefined && s.cli(['sudo-ok', 'alpha', 'Prod', '--as', 'Ops']).code === 1);
  // AIG-773: an ssh server keeps host, user, port, key file and default folder (old entries have none and still work)
  for (const [k, v] of [['host', 'example.test'], ['user', 'deploy'], ['port', '2222'], ['key', 'C:/keys/id_prod'], ['folder', '/var/www/my app']]) {
    await sp.fill('#serversBox input[data-srv="' + k + '"]', v);
    await sp.press('#serversBox input[data-srv="' + k + '"]', 'Tab');
    await sleep(500);   // each change saves and redraws the box
  }
  const pv = await sv();
  check('Setup saves host+user as the address, plus port, key and folder', pv && pv.value === 'deploy@example.test' && pv.port === 2222 && pv.key === 'C:/keys/id_prod' && pv.folder === '/var/www/my app', pv);
  check('an old entry (no extra fields) is still listed as it was', (await s.ok('GET', '/api/setup')).prefs.servers.length === 1);
  check('a bad port is dropped, not saved', (await (async () => { await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'Prod', kind: 'ssh', value: 'a@b.test', port: 99999 }] } }); return sv(); })()).port === undefined);
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'Prod', kind: 'ssh', value: 'deploy@example.test', port: 2222, key: 'C:/keys/id_prod', folder: "/var/www/it's" }, { name: 'Stage', kind: 'ssh', value: 'ssh://web@stage.test:2200' }] } });
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const keepData = process.env.AIGILE_DATA; process.env.AIGILE_DATA = path.join(dir, 'unit-data');   // the libs make their data folder on load: keep it in the temp folder
  const T = req(path.join(root, 'lib/terminal.js')), SV = req(path.join(root, 'lib/servers.js'));
  if (keepData === undefined) delete process.env.AIGILE_DATA; else process.env.AIGILE_DATA = keepData;
  const base = { name: 'Prod', target: 'deploy@example.test', port: 2222, key: 'C:/keys/id_prod', folder: "/var/www/it's" };
  const sp1 = T.spec(base);
  check('the ssh command carries -p, -i, -t, the address and a quoted cd', sp1.args.slice(0, 6).join(' ') === '-p 2222 -i C:/keys/id_prod -t deploy@example.test' && sp1.args[6] === "cd '/var/www/it'\\''s' && exec \"$SHELL\" -l", sp1.args);
  check('no extras: the command is just the address', T.spec({ name: 'x', target: 'a@b.test' }).args.join(' ') === 'a@b.test');
  check('a project user replaces the server user', SV.withOverrides(base, { user: 'ops' }).target === 'ops@example.test' && SV.withOverrides({ target: 'web@stage.test' }, { user: 'ops' }).target === 'ops@stage.test' && SV.withOverrides({ target: 'host.test' }, { user: 'ops' }).target === 'ops@host.test');
  check('a project user keeps an ssh:// address and port', SV.withOverrides({ target: 'ssh://web@stage.test:2200' }, { user: 'ops' }).target === 'ssh://ops@stage.test:2200');
  check('a project folder replaces the default folder', SV.withOverrides(base, { folder: '/srv/x' }).folder === '/srv/x' && SV.withOverrides(base, {}).folder === base.folder);
  check('a user with shell characters is not used', SV.withOverrides(base, { user: 'a;rm -rf' }).target === base.target);

  // AIG-774: the project's Server dropdown (project settings) with user and folder of its own
  const pr = await s.ok('PATCH', '/api/projects/alpha', { srv: { name: 'Stage', user: 'ops', folder: '/srv/alpha' } });
  check('the project saves its server, user and folder', JSON.stringify((await s.ok('GET', '/api/projects/alpha')).srv) === '{"name":"Stage","user":"ops","folder":"/srv/alpha"}', pr);
  check('a bad user on the project is refused', (await s.api('PATCH', '/api/projects/alpha', { srv: { name: 'Stage', user: 'a b;c' } })).status === 400);
  const look = await openPage(ctx, '#/p/alpha');
  await look.waitForSelector('text=Look', { timeout: 6000 }).catch(() => {});
  await look.evaluate(() => lookDialog());
  await look.waitForSelector('#look-srv');
  check('the dropdown lists the My servers names and shows the saved one', (await look.$$eval('#look-srv option', o => o.map(x => x.textContent))).join() === 'No server chosen,Prod,Stage' && (await look.inputValue('#look-srv')) === 'Stage' && (await look.inputValue('#look-srv-user')) === 'ops');
  await look.selectOption('#look-srv', 'Prod');
  await look.fill('#look-srv-user', '');
  await look.fill('#look-srv-folder', '/srv/p');
  await look.evaluate(() => saveLook());
  await sleep(700);
  check('choosing another server in the dialog saves it', JSON.stringify((await s.ok('GET', '/api/projects/alpha')).srv) === '{"name":"Prod","folder":"/srv/p"}', (await s.ok('GET', '/api/projects/alpha')).srv);
  const d = await mkCard(s, 'alpha', 'Project server');
  s.cli(['task', 'alpha', d.id, 'check the logs', '--server', '--as', 'Lead']);
  const page3 = await openPage(ctx, '#/inbox');
  await page3.waitForSelector('#ibK [data-open-server="Prod"]', { timeout: 6000 });
  check('a server task with no named server opens the project server (not a picker for that card)', (await page3.$$('#ibK [data-open-server="Prod"]')).length >= 1);
  await s.ok('PATCH', '/api/projects/alpha', { srv: { name: '' } });
  check('clearing the dropdown removes the project server', (await s.ok('GET', '/api/projects/alpha')).srv === undefined);
  noErrors(look); noErrors(page3);
  noErrors(sp);
  noErrors(page0); noErrors(setup); noErrors(page); noErrors(page2);
}, true, { AIGILE_LOCAL: local, AIGILE_DESKTOP: desktop, AIGILE_OPEN_STUB: stub });
