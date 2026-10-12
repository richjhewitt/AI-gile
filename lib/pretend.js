// 🧪 Pretend friend (AIG-322/323): try sharing on this one machine. One click starts a local relay and a second board,
// "Davy" (own port, own data folder, own keys, Flemish), points both boards' DMs at that relay and, if asked,
// runs the invite exchange so Davy is already a checked contact. Nothing of the real DM identity is touched except
// one contact marked pretend; stopping removes that contact and puts the DM settings back.
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ROOT, owner } = require('./store');
const dm = require('./dm');
const { t: tr } = require('./i18n');
const { codeDir, releaseError } = require('./trial');

const NAME = 'Davy', LANG = 'nl-BE';
const DIR = path.join(os.tmpdir(), 'aigile-pretend-davy');   // Davy's data lives here, kept between runs unless wiped
let run = null;   // { relay: {proc, port, url, data}, board: {proc, port}, mailbox, prior: {on, relay} }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const kill = proc => { if (!proc) return; if (process.platform === 'win32') require('./platform').killTree(proc.pid); else try { process.kill(-proc.pid, 'SIGKILL'); } catch { try { proc.kill(); } catch {} } };
async function waitFor(url) { for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) return true; } catch {} await sleep(100); } return false; }
async function davy(method, p, body) {
  const r = await fetch(`http://127.0.0.1:${run.board.port}${p}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Davy's board said ${r.status}`);
  return j;
}
// Davy's contacts on the owner's board are found by mailbox, so a name the owner typed never matters.
const mine = () => run && run.mailbox ? dm.status().contacts.filter(c => c.mailbox === run.mailbox) : [];

async function start(b = {}) {
  await stop({ wipe: false, quiet: true });
  const auto = b.auto !== false, root = codeDir(b.code), code = root === ROOT ? 'today' : 'release';   // AIG-468: today's build or the last release
  const relayPort = await freePort(), boardPort = await freePort();
  const data = path.join(DIR, 'data'), local = path.join(DIR, 'aigile.local.json'), projects = path.join(DIR, 'Projects'), stub = path.join(DIR, 'pretend-team' + require('./platform').stubExt());
  fs.mkdirSync(data, { recursive: true }); fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(local, JSON.stringify({ owner: NAME, lang: LANG }));   // Davy's board and his pretend team speak Flemish (AIG-488)
  require('./platform').writeStub(fs, stub, 'run', `"${process.execPath}" "${path.join(ROOT, 'tools', 'trial', 'pretend-team.js')}"`);
  const relayData = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-pretend-relay-'));
  const relay = spawn(process.execPath, [path.join(ROOT, 'relay', 'relay.js')], { env: { ...process.env, RELAY_PORT: String(relayPort), RELAY_HOST: '127.0.0.1', RELAY_DATA: relayData, RELAY_RATE: '100000' }, stdio: 'ignore', windowsHide: true, ...require('./platform').groupOpts() });
  const env = { ...process.env, AIGILE_PORT: String(boardPort), AIGILE_DATA: data, AIGILE_LOCAL: local, AIGILE_HOME: projects, AIGILE_URL: `http://localhost:${boardPort}`,
    AIGILE_AGENT_COMMAND: stub, AIGILE_NO_RESTART: '1', AIGILE_NO_USAGE_AUTO: '1', AIGILE_OWNER: NAME, AIGILE_PRETEND: NAME, AIGILE_DM_POLL_MS: '1500', AIGILE_RELAY: '', AIGILE_NO_TERMINAL: '1' };   // no terminal on the pretend friend's board (AIG-471)
  delete env.AIGILE_AS;
  const board = spawn(process.execPath, [path.join(root, 'server.js')], { cwd: root, env, stdio: 'ignore', windowsHide: true, ...require('./platform').groupOpts() });
  const relayUrl = `http://127.0.0.1:${relayPort}`;
  run = { code, dir: root, relay: { proc: relay, port: relayPort, url: relayUrl, data: relayData }, board: { proc: board, port: boardPort }, mailbox: '', prior: null };
  try {
    if (!(await waitFor(relayUrl + '/health'))) throw new Error(tr('srv.err.relay'));
    if (!(await waitFor(`http://127.0.0.1:${boardPort}/api/meta`))) throw new Error(releaseError(root, tr('srv.err.davystart')));
    const prior = dm.status();
    run.prior = { on: prior.on, relay: prior.relay };
    // Davy first: his own DM settings at the local relay, and a project so there is something to share.
    await davy('POST', '/api/dms/settings', { on: true, relay: relayUrl });
    run.mailbox = (await davy('GET', '/api/dms')).mailbox;
    const have = await davy('GET', '/api/projects').catch(() => []);
    if (!Array.isArray(have) || !have.length) await davy('POST', '/api/projects', { name: tr('pf.garden', null, LANG), key: 'DVY' }).catch(() => {});
    // Kept data from an earlier run: forget the old copy of the owner there, it is added again below.
    const ownerBox = prior.mailbox;
    for (const c of await davy('GET', '/api/dms/contacts')) if (c.mailbox === ownerBox) await davy('DELETE', '/api/dms/contacts/' + c.id);
    await dm.setSettings({ on: true, relay: relayUrl });
    for (const c of mine()) dm.removeContact(c.id);
    if (auto) await exchange();
  } catch (e) { await stop({ wipe: false, quiet: true }); throw Object.assign(new Error(e.message), { status: 500 }); }
  return status();
}

// Davy makes an invite, the owner accepts it, Davy collects the hello; both sides then count the safety words as matched.
async function exchange() {
  const { code } = await davy('POST', '/api/dms/invites', { name: owner() });
  const c = await dm.acceptInvite({ code, name: NAME });
  dm.patchContact(c.id, { checked: true, pretend: true });
  const ownerBox = dm.status().mailbox;
  for (let i = 0; i < 40; i++) {
    await davy('POST', '/api/dms/poll', {}).catch(() => {});
    const theirs = (await davy('GET', '/api/dms/contacts')).find(x => x.mailbox === ownerBox);
    if (theirs) { await davy('PATCH', '/api/dms/contacts/' + theirs.id, { checked: true }); return; }
    await sleep(250);
  }
  throw new Error(tr('srv.err.hello'));
}
// Manual option: Davy's one-off invite code, for practising "Add a friend".
async function invite() {
  if (!run) throw Object.assign(new Error(tr('srv.err.notrunning')), { status: 409 });
  return davy('POST', '/api/dms/invites', { name: owner() });
}

// { wipe? }: stop both, remove the pretend contact, put the DM settings back; keep or wipe Davy's data.
async function stop(b = {}) {
  const r = run;
  if (r) {
    try { for (const c of mine()) dm.removeContact(c.id); } catch {}
    run = null;
    kill(r.board.proc); kill(r.relay.proc);
    try { fs.rmSync(r.relay.data, { recursive: true, force: true }); } catch {}
    if (r.prior) try {
      await dm.setSettings({ on: false, relay: r.prior.relay });
      if (r.prior.on) await dm.setSettings({ on: true });
    } catch {}
  }
  if (b.wipe) { await sleep(300); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} }
  return b.quiet ? undefined : status();
}

function status() {
  // Contacts that are Davy get the pretend mark, even when the owner added him by hand.
  for (const c of mine()) if (!c.pretend) try { dm.patchContact(c.id, { pretend: true }); } catch {}
  const me = process.env.AIGILE_PRETEND || null;
  return { me, lang: me ? LANG : null, running: !!run, code: run ? run.code : null, dir: run ? run.dir : null, name: NAME, kept: fs.existsSync(path.join(DIR, 'data')),
    url: run ? `http://localhost:${run.board.port}/` : null, relay: run ? run.relay.url : null };
}
process.on('exit', () => { if (run) { kill(run.board.proc); kill(run.relay.proc); } });

module.exports = { start, stop, status, invite };
