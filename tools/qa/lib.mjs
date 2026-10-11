// Shared QA helpers: the test server, seed helpers, page opener, check(), and the area registry (def).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
// port: a second board for the dms area runs on another port.
export async function startServer(extraEnv = {}, port = PORT) {
  const BASE = `http://127.0.0.1:${port}`;
  const dir = tmp('run'), data = path.join(dir, 'data'), usageDir = path.join(dir, 'usage');
  fs.mkdirSync(usageDir);
  const out = path.join(dir, 'wake-out.txt');
  const stub = path.join(dir, 'agent-stub.bat');
  fs.writeFileSync(stub, `@echo off\r\ncd > "${out}"\r\necho %* >> "${out}"\r\nping -n 4 127.0.0.1 >nul\r\nexit\r\n`);
  const env = { ...process.env, AIGILE_PORT: String(port), AIGILE_DATA: data, AIGILE_AGENT_COMMAND: stub, AIGILE_USAGE_DIR: usageDir, AIGILE_OWNER: 'Owner', ...extraEnv };   // tests speak to "Owner", whatever your own name is
  delete env.AIGILE_DEV; delete env.AIGILE_ALLOW_DONE; delete env.AIGILE_AS;
  const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: 'ignore', cwd: ROOT });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/meta')).ok) break; } catch {}
    await sleep(100);
  }
  const api = async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  };
  const ok = async (method, url, body) => { const r = await api(method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.body)}`); return r.body; };
  const cli = (args, extraEnv = {}) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'aigile.js'), ...args], { env: { ...env, AIGILE_URL: BASE, ...extraEnv }, encoding: 'utf8' });
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
