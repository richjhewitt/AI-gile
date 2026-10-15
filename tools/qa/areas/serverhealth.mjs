// QA area: serverhealth (AIG-660): the relay's signed GET /health, the board's poll with fake readings (AIGILE_HEALTH_STUB),
// fine readings make no card, high ones make ONE card, polling again makes no second card, and Setup shows the latest line.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { startRelay, check, tmp, def, mkProject, openPage, noErrors } from '../lib.mjs';

const dir = tmp('health'), stub = path.join(dir, 'reading.json'), local = path.join(dir, 'local.json'), sshStub = path.join(dir, 'ssh-stub.js'), sshOut = path.join(dir, 'ssh.out'), sshLog = path.join(dir, 'ssh.log');
const put = o => fs.writeFileSync(stub, JSON.stringify(o));
put({ cpu: 10, mem: 40, disk: 30, storage: 5e6, uptime: 86400 * 3 });

// AIG-1125: a stub ssh (AIGILE_SSH_STUB) logs its arguments and prints what is in ssh.out, like uptime; nproc; free -m; df -P /
fs.writeFileSync(local, JSON.stringify({ owner: 'Owner', agent: { command: 'x', notesFile: 'CLAUDE.local.md', settingsFile: '.claude/settings.local.json' } }));
fs.writeFileSync(sshStub, `require('fs').appendFileSync(${JSON.stringify(sshLog)}, JSON.stringify(process.argv.slice(2)) + '\\n'); process.stdout.write(require('fs').readFileSync(${JSON.stringify(sshOut)}, 'utf8'));`);
const fake = disk => ` 10:00:01 up 12 days,  3:02,  1 user,  load average: 0.40, 0.50, 0.60
cores 2
               total        used        free      shared  buff/cache   available
Mem:            1000         400         100           0         500         600
Swap:              0           0           0
Filesystem     1024-blocks    Used Available Capacity Mounted on
/dev/sda1         10000000 ${disk * 100000} 1600000 ${disk}% /
`;

def('serverhealth', 'Server health (AIG-660, AIG-1125): relay /health is signed, fine readings make no card, high readings make one card (never two), Setup > My servers shows the numbers', async (s, ctx) => {
  // relay side: a signed request gets numbers, an unsigned one only ok
  const kp = crypto.generateKeyPairSync('ed25519'), x = kp.publicKey.export({ format: 'jwk' }).x;
  const relay = await startRelay({ RELAY_STATS_KEY: x });
  try {
    const plain = await (await fetch(relay.base + '/health')).json();
    check('unsigned /health says only ok', plain.ok === true && plain.cpu === undefined, plain);
    const sign = () => {
      const ts = String(Date.now()), nonce = crypto.randomBytes(12).toString('base64url');
      const msg = ['aigile-relay-v1', 'GET', '/health', ts, nonce, crypto.createHash('sha256').update('').digest('hex')].join('\n');
      return { 'x-relay-key': x, 'x-relay-ts': ts, 'x-relay-nonce': nonce, 'x-relay-sig': crypto.sign(null, Buffer.from(msg), kp.privateKey).toString('base64url') };
    };
    const r = await fetch(relay.base + '/health', { headers: sign() });
    const j = await r.json();
    check('signed /health gives cpu, memory, disk, storage and uptime', r.ok && ['cpu', 'mem', 'disk', 'storage', 'uptime'].every(k => typeof j[k] === 'number'), j);
    const other = crypto.generateKeyPairSync('ed25519'), ox = other.publicKey.export({ format: 'jwk' }).x;
    const h = sign(); h['x-relay-key'] = ox;
    check('signed by another key is refused', (await fetch(relay.base + '/health', { headers: h })).status === 401);
  } finally { relay.stop(); }

  // board side
  await mkProject(s, 'AI-gile', 'AIG');
  const cards = async () => ((await s.ok('GET', '/api/projects/ai-gile')).cards || []).filter(c => c.from === 'server health');
  for (let i = 0; i < 4; i++) await s.ok('POST', '/api/serverhealth/poll');
  check('fine readings make no card', (await cards()).length === 0);
  put({ cpu: 20, mem: 50, disk: 84, storage: 9e9, uptime: 86400 * 3 });
  await s.ok('POST', '/api/serverhealth/poll'); await s.ok('POST', '/api/serverhealth/poll');
  check('high for only 2 polls makes no card', (await cards()).length === 0);
  const p3 = await s.ok('POST', '/api/serverhealth/poll');
  let cs = await cards();
  check('high for 3 polls makes one task card for the owner', cs.length === 1 && cs[0].type === 'task' && cs[0].title === 'Server: time to upgrade (disk 84%)' && cs[0].status === 'todo' && p3.created === true, { cs, p3 });
  await s.ok('POST', '/api/serverhealth/poll'); const again = await s.ok('POST', '/api/serverhealth/poll');
  cs = await cards();
  check('polling again makes no second card', cs.length === 1 && again.card === cs[0].id, { cs, again });
  put({ cpu: 20, mem: 50, disk: 88, storage: 9e9, uptime: 86400 * 3 });
  await s.ok('POST', '/api/serverhealth/poll');
  cs = await cards();
  check('worse numbers bump the open card and change its title', cs.length === 1 && cs[0].title === 'Server: time to upgrade (disk 88%)' && cs[0].bumps === 1, cs);
  const hist = await s.ok('GET', '/api/serverhealth');
  check('history is kept and the latest is served', hist.readings.length === 10 && hist.latest.disk === 88, hist.latest);
  check('a reading with nothing in it is refused', (put({}), (await s.ok('POST', '/api/serverhealth/poll')).ok === false));
  put({ cpu: 20, mem: 50, disk: 88, storage: 9e9, uptime: 86400 * 3 });

  const page = await openPage(ctx, '#/setup');
  await page.waitForSelector('#srv-health', { timeout: 8000 });
  const line = await page.textContent('#srv-health');
  check('Setup > My servers shows the latest numbers', /CPU 20%/.test(line) && /memory 50%/.test(line) && /disk 88%/.test(line), line);
  noErrors(page); await page.close();

  // AIG-1125: a second server (ssh) is read through the stub ssh: a line in Setup, and a card of its own after 3 high polls
  fs.writeFileSync(sshOut, fake(50));
  await s.ok('POST', '/api/setup', { prefs: { servers: [{ name: 'Web', kind: 'ssh', value: 'deploy@web.example.test', port: 2222 }, { name: 'Shortcut', kind: 'path', value: 'C:/x/y.lnk' }] } });
  const webCards = async () => ((await s.ok('GET', '/api/projects/ai-gile')).cards || []).filter(c => c.from === 'server health: web');
  const q1 = await s.ok('POST', '/api/serverhealth/poll');
  const run = (() => { try { return fs.readFileSync(sshLog, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } })();
  check('only the ssh server is read, with BatchMode, its port and no sudo', run.length === 1 && run[0].includes('BatchMode=yes') && run[0].includes('2222') && run[0].includes('deploy@web.example.test') && !/sudo/.test(run[0].at(-1)), run);
  check('its numbers are parsed (CPU by cores, memory without cache, disk)', q1.servers.length === 1 && q1.servers[0].reading.cpu === 20 && q1.servers[0].reading.mem === 40 && q1.servers[0].reading.disk === 50, q1.servers);
  check('fine numbers make no card for it', (await webCards()).length === 0);
  fs.writeFileSync(sshOut, fake(84));
  await s.ok('POST', '/api/serverhealth/poll'); await s.ok('POST', '/api/serverhealth/poll');
  check('high for 2 polls makes no card for it', (await webCards()).length === 0);
  await s.ok('POST', '/api/serverhealth/poll');
  const wc = await webCards();
  check('high for 3 polls makes one card naming the server', wc.length === 1 && wc[0].title === 'Web: time to upgrade (disk 84%)', wc);
  await s.ok('POST', '/api/serverhealth/poll');
  check('polling again makes no second card', (await webCards()).length === 1);
  check('the relay card is untouched', (await cards()).length === 1);
  const page2 = await openPage(ctx, '#/setup');
  await page2.waitForSelector('#srv-health-0', { timeout: 8000 });
  const l2 = await page2.textContent('#srv-health-0');
  check('Setup > My servers shows the second server CPU and disk', /^Web: CPU 20%/.test(l2) && /memory 40%/.test(l2) && /disk 84%/.test(l2) && /up 12 days/.test(l2), l2);
  noErrors(page2); await page2.close();
}, true, { AIGILE_HEALTH_STUB: stub, AIGILE_NO_HEALTH_POLL: '1', AIGILE_LOCAL: local, AIGILE_SSH_STUB: sshStub });
