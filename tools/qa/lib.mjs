// Shared QA helpers: the test server, seed helpers, page opener, check(), and the area registry (def).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
// Tests speak to "Owner" whatever your own name is, here and in the servers they start (setup clears it to test naming).
process.env.AIGILE_OWNER = 'Owner';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PORT = Number(process.env.QA_PORT) || 4390;
export const BASE = `http://127.0.0.1:${PORT}`;
// Machine-specific paths come from env (or a local install via npm i in tools/qa); none live in the repo.
export const CHROME = process.env.QA_CHROME || undefined;   // undefined = playwright's own bundled browser
const PW_FALLBACK = process.env.QA_PLAYWRIGHT;   // path to a playwright package, if not installed here
const require = createRequire(import.meta.url);
export const loadPw = () => { try { return require('playwright'); } catch (e) { if (PW_FALLBACK) return require(PW_FALLBACK); throw new Error('playwright not found: run npm i in tools/qa, or set QA_PLAYWRIGHT'); } };

// Shared mutable state: other modules use these functions, never assign to the bindings.
let failures = 0, area = '';
export const setArea = name => { area = name; };
export const getFailures = () => failures;
export const check = (name, ok, extra) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${area}: ${name}${!ok && extra !== undefined ? '  -> ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`);
  if (!ok) failures++;
};
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-qa-' + p + '-'));

/* ---------- server and helpers ---------- */
// A free port from the OS (listen on 0), so two QA runs on one machine never pick the same second-board or relay port.
export const freePort = () => new Promise((res, rej) => { const srv = net.createServer(); srv.once('error', rej); srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => res(port)); }); });
// Is a port free right now on the loopback address the QA server uses? A busy port means another process owns it.
export const portFree = port => new Promise(res => { const srv = net.createServer(); srv.once('error', () => res(false)); srv.listen(port, '127.0.0.1', () => srv.close(() => res(true))); });
// A local relay on a free port and a temp data folder of its own.
export async function startRelay(extraEnv = {}) {
  const port = await freePort();
  const data = path.join(tmp('relay'), 'data');
  const proc = spawn(process.execPath, [path.join(ROOT, 'relay', 'relay.js')], { env: { ...process.env, RELAY_PORT: String(port), RELAY_HOST: '127.0.0.1', RELAY_DATA: data, RELAY_RATE: '100000', ...extraEnv }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(100); }
  return { base, port, data, stop: () => { try { proc.kill(); } catch {} } };
}
// Wait for a condition (polled), up to ms.
export const until = async (fn, ms = 8000) => { const end = Date.now() + ms; let v; while (!(v = await fn()) && Date.now() < end) await sleep(100); return v; };

// port: a second board for the dms area runs on another port.
export async function startServer(extraEnv = {}, port = PORT) {   // a second board passes await freePort()
  // A busy QA_PORT means another process (a board, a relay, an old run) would answer our calls: stop the run at once.
  if (!(await portFree(port))) {
    if (port === PORT) { console.error(`QA_PORT ${port} is in use by another process: pick another QA_PORT`); process.exit(3); }
    throw new Error(`port ${port} is in use by another process`);
  }
  const BASE = `http://127.0.0.1:${port}`;
  // A random token the server must hand back on /api/meta: proves the server that answers is this run's own.
  const token = crypto.randomBytes(16).toString('hex');
  const dir = tmp('run'), data = path.join(dir, 'data'), usageDir = path.join(dir, 'usage');
  fs.mkdirSync(usageDir);
  const out = path.join(dir, 'wake-out.txt');
  const platform = require('../../lib/platform'), stub = path.join(dir, 'agent-stub' + platform.stubExt());
  platform.writeStub(fs, stub, 'log', out);
  // The test server gets its own settings file (AIG-401): never the owner's aigile.local.json, which tests
  // that save settings (wizard, budget, setup) used to change. Only the machine bits are carried over.
  const local = path.join(dir, 'aigile.local.json');
  let ownerLocal = {}; try { ownerLocal = JSON.parse(fs.readFileSync(path.join(ROOT, 'aigile.local.json'), 'utf8')); } catch {}
  fs.writeFileSync(local, JSON.stringify(Object.fromEntries(['usageDir', 'globalSettingsFile', 'agent', 'avatarsDir'].filter(k => k in ownerLocal).map(k => [k, ownerLocal[k]])), null, 2));
  const env = { ...process.env, AIGILE_LOCAL: local, AIGILE_PORT: String(port), AIGILE_DATA: data, AIGILE_AGENT_COMMAND: stub, AIGILE_USAGE_DIR: usageDir, AIGILE_OWNER: 'Owner', AIGILE_UNDO_WAKE_MS: '0', AIGILE_QA_TOKEN: token, ...extraEnv };   // tests speak to "Owner", whatever your own name is
  delete env.AIGILE_DEV; delete env.AIGILE_ALLOW_DONE; delete env.AIGILE_AS;
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: 'ignore', cwd: ROOT });
  let mine = false;
  for (let i = 0; i < 100 && !mine; i++) {
    if (proc.exitCode !== null) break;   // it died (port taken?): do not mistake another run's server for ours
    try { mine = (await (await fetch(BASE + '/api/meta')).json()).qaToken === token; } catch {}
    if (!mine) await sleep(100);
  }
  if (!mine) { try { proc.kill(); } catch {} throw new Error(`the server on port ${port} is not this QA run's (no matching token): another process holds it`); }
  const api = async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  };
  const ok = async (method, url, body) => { const r = await api(method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.body)}`); return r.body; };
  const cli = (args, extraEnv = {}, cwd) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'aigile.js'), ...args], { env: { ...env, AIGILE_URL: BASE, ...extraEnv }, encoding: 'utf8', ...(cwd ? { cwd } : {}) });
    return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
  };
  const stop = () => { try { proc.kill(); } catch {} };
  return { dir, data, usageDir, wakeOut: out, api, ok, cli, stop, proc, base: BASE };
}

// Seed helpers (through the API).
export const mkProject = (s, name, key, extra = {}) => s.ok('POST', '/api/projects', { name, key, ...extra });
export const mkCard = (s, slug, title, extra = {}) => s.ok('POST', `/api/projects/${slug}/cards`, { title, ...extra });
export const getCard = async (s, slug, id) => (await s.ok('GET', `/api/projects/${slug}`)).cards.find(c => c.id === id);
export const say = (s, slug, id, author, text, extra = {}) => s.ok('POST', `/api/projects/${slug}/cards/${id}/comments`, { author, text, ...extra });

// A browser page that records page errors.
export async function openPage(ctx, hash) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  // The morning "Call stand-ups?" pill (AIG-136) would sit over other areas' clicks: mark today as asked, except in the standup area.
  if (!openPage.morning) await page.addInitScript(() => { try { localStorage.setItem('aigile.standupAsked', new Date().toLocaleDateString('sv')); } catch {} });
  await page.goto(BASE + '/' + (hash || ''));
  await page.waitForSelector('#app > *', { timeout: 8000 });
  return page;
}
export const noErrors = page => check('no page errors', page.errors.length === 0, page.errors);


/* ---------- area registry ---------- */
export const areas = {};
export const def = (name, doc, fn, needsBrowser = false, env = {}) => { areas[name] = { doc, fn, needsBrowser, env }; };
