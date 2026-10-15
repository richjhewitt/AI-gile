// QA area: sudo (AIG-1023), an ssh server's optional sudo password in Setup > My servers and `aigile sudo`.
// A stub ssh (AIGILE_SSH_STUB, a node script) records its argv and stdin, so nothing really connects anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, check, sleep, tmp, mkProject, mkCard, getCard, openPage, noErrors, def } from '../lib.mjs';

const dir = tmp('sudo'), local = path.join(dir, 'local.json'), log = path.join(dir, 'ssh.log'), stub = path.join(dir, 'ssh-stub.js');
const PW = 'Sud0-QA-pa55word', SEC = tmp('sudo-sec');
fs.writeFileSync(local, JSON.stringify({ owner: 'Owner', agent: { command: 'x', notesFile: 'CLAUDE.local.md', settingsFile: '.claude/settings.local.json' } }));
// The stub: logs { argv, stdin }, prints 70 lines and then what it read (so the masking is tested), exits 7.
fs.writeFileSync(stub, `let i = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => i += d); process.stdin.on('end', () => {
  require('fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2), stdin: i }) + '\\n');
  for (let n = 1; n <= 70; n++) console.log('line ' + n);
  console.log('read on stdin: ' + i.trim());
  process.exitCode = 7; });`);
const runs = () => { try { return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };

def('sudo', 'aigile sudo: the ssh server\'s sudo password (Setup > My servers, masked, Saved / Not set) goes to ssh on stdin only, never in argv, a GET answer or the output; refused when sudo is not allowed; no password = sudo -n (AIG-1023)', async (s, ctx) => {
  await mkProject(s, 'Alpha', 'ALP');
  const card = await mkCard(s, 'alpha', 'Install the test site');
  const srv = extra => ({ name: 'Prod', kind: 'ssh', value: 'deploy@example.test', port: 2222, key: 'C:/keys/id_prod', ...extra });
  await s.ok('POST', '/api/setup', { prefs: { servers: [srv()] } });
  const sudo = (cmd, as = 'Lead', more = []) => s.cli(['sudo', 'alpha', 'Prod', cmd, ...more, '--as', as]);

  // not allowed: refused before ssh starts
  const no = sudo('whoami');
  check('sudo off: refused, ssh never started', no.code !== 0 && /not allowed/.test(no.err) && runs().length === 0, no);

  // allowed, no password saved: sudo -n, nothing on stdin
  await s.ok('POST', '/api/setup', { prefs: { servers: [srv({ sudo: true })] } });
  const n1 = sudo('whoami');
  const r1 = runs()[0] || {};
  check('no password: says so and runs sudo -n with empty stdin', /no sudo password saved: Setup → My servers/.test(n1.err) && r1.stdin === '' && /^sudo -n bash -lc '/.test(r1.argv.at(-1)), { n1, r1 });
  check('the brief says no sudo password is saved', /Prod: sudo: allowed, no sudo password saved/.test(s.cli(['brief', 'alpha', '--as', 'Lead']).out));

  // the fences on the password routes
  check('saving without the page token is refused', (await s.api('POST', '/api/servers/sudo-pw', { name: 'Prod', password: PW })).status === 403);
  check('the CLI may not save it', (await fetch(BASE + '/api/servers/sudo-pw', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Aigile-Where': 'terminal' }, body: JSON.stringify({ name: 'Prod', password: PW }) })).status === 403);
  check('the grant route refuses anything but the CLI', (await s.api('POST', '/api/servers/sudo-grant', { name: 'Prod', by: 'Lead' })).status === 403);

  // save it through the Setup page (masked box)
  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#serversBox input[data-srv-pw="0"]');
  check('the box is masked and says Not set', (await page.getAttribute('#serversBox input[data-srv-pw="0"]', 'type')) === 'password' && (await page.textContent('#serversBox [data-srv-pw-state="0"]')).trim() === 'Not set');
  await page.fill('#serversBox input[data-srv-pw="0"]', PW);
  await page.click('#serversBox [data-srv-pw-save="0"]');
  await page.waitForFunction(() => document.querySelector('#serversBox [data-srv-pw-state="0"]')?.textContent.trim() === 'Saved');
  check('after Save it says Saved and the password is gone from the page', !(await page.content()).includes(PW));
  const gets = JSON.stringify([await s.ok('GET', '/api/setup'), await s.ok('GET', '/api/meta'), await s.ok('GET', '/api/secrets')]);
  check('GET answers say sudoPw, never the password', gets.includes('"sudoPw":true') && !gets.includes(PW));
  const kept = path.join(SEC, 'secrets', 'kept.json');
  check('stored encrypted, not in aigile.local.json', !fs.readFileSync(local, 'utf8').includes(PW) && fs.existsSync(kept) && !fs.readFileSync(kept, 'utf8').includes(PW) && fs.readFileSync(kept, 'utf8').includes('server:prod:sudo'));
  check('the brief says a sudo password is saved and names aigile sudo', /Prod: sudo: allowed, sudo password saved: run it yourself with aigile sudo/.test(s.cli(['brief', 'alpha', '--as', 'Lead']).out));
  const token = (await s.ok('GET', '/api/secrets/token')).token;
  check('a password with a line break is refused', (await s.api('POST', '/api/servers/sudo-pw', { name: 'Prod', password: PW + '\nx', token })).status === 400);

  // run with it
  const cmd = "bash install-site.sh test.aigile.lol && echo 'done'";
  const r = sudo(cmd, 'Lead', ['--card', card.id]), last = runs().at(-1);
  const remote = "sudo -k -S -p '' bash -lc 'exec </dev/null; bash install-site.sh test.aigile.lol && echo '\\''done'\\'''";
  check('ssh argv: BatchMode, -T, port, key, --, the address, the sudo -S command', JSON.stringify(last.argv) === JSON.stringify(['-o', 'BatchMode=yes', '-T', '-p', '2222', '-i', 'C:/keys/id_prod', '--', 'deploy@example.test', remote]), last.argv);
  check('the password is on stdin (one line) and nowhere in argv', last.stdin === PW + '\n' && !JSON.stringify(last.argv).includes(PW), last);
  check('output is masked', !(r.out + r.err).includes(PW) && /read on stdin: \*\*\*\*/.test(r.out), r);
  check('only the last 60 lines are printed, then the exit code', !/\bline 10\b/.test(r.out) && /line 70/.test(r.out) && /exit 7$/.test(r.out) && r.code === 7, r.out);
  const c = await getCard(s, 'alpha', card.id), cm = (c.comments || []).at(-1) || {};
  check('--card leaves a short comment', cm.author === 'Lead' && cm.text === `ran sudo on Prod: ${cmd}, exit 7`, cm);

  // only listed agents
  await s.ok('POST', '/api/setup', { prefs: { servers: [srv({ sudo: ['Ops'] })] } });
  const before = runs().length, nope = sudo('id');
  check('an agent not on the sudo list is refused, even with a password saved', nope.code !== 0 && /not allowed/.test(nope.err) && runs().length === before, nope);
  check('a listed agent may', sudo('id', 'ops').code === 7 && runs().at(-1).stdin === PW + '\n');

  // Remove, and a removed server takes its password along
  const p2 = await openPage(ctx, '#/setup');
  await p2.waitForSelector('#serversBox [data-srv-pw-remove="0"]');
  await p2.click('#serversBox [data-srv-pw-remove="0"]');
  await p2.waitForFunction(() => document.querySelector('#serversBox [data-srv-pw-state="0"]')?.textContent.trim() === 'Not set');
  check('Remove deletes it', !JSON.stringify(await s.ok('GET', '/api/setup')).includes('sudoPw'));
  await p2.evaluate(async pw => api('POST', '/api/servers/sudo-pw', { name: 'Prod', password: pw, token: await secToken() }), PW);
  await s.ok('POST', '/api/setup', { prefs: { servers: [] } });
  check('removing the server deletes its password', !fs.readFileSync(kept, 'utf8').includes('server:prod:sudo'));
  noErrors(page); noErrors(p2);
  await sleep(50);
}, true, { AIGILE_LOCAL: local, AIGILE_SSH_STUB: stub, AIGILE_SECRETS_DIR: SEC });
