// QA area: servers (AIG-374), Setup > My servers and the Open button on 🖥️ tasks.
// A fake Desktop folder and a stub opener (AIGILE_OPEN_STUB) so nothing really launches.
import fs from 'node:fs';
import path from 'node:path';
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
  noErrors(sp);
  noErrors(page0); noErrors(setup); noErrors(page); noErrors(page2);
}, true, { AIGILE_LOCAL: local, AIGILE_DESKTOP: desktop, AIGILE_OPEN_STUB: stub });
