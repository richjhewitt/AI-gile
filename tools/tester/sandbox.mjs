// AI tester's sandbox (AIG-163): a throwaway copy of the board, so testing can click anything safely.
// Copies data/ and aigile.local.json to a temp folder and runs this folder's server on it. Agents are never woken.
// Run it in the background; it prints the address, and everything it changes vanishes when it stops.
//
//   node tools/tester/sandbox.mjs [port]      (default 4399)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = +process.argv[2] || 4399, base = `http://127.0.0.1:${port}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-sandbox-')), data = path.join(dir, 'data');
fs.cpSync(path.join(ROOT, 'data'), data, { recursive: true });
const local = path.join(ROOT, 'aigile.local.json'), localCopy = path.join(dir, 'aigile.local.json');
if (fs.existsSync(local)) fs.copyFileSync(local, localCopy); else fs.writeFileSync(localCopy, '{}');
const stub = path.join(dir, 'no-agent.bat');   // "waking" a team does nothing here
fs.writeFileSync(stub, '@echo off\r\nexit\r\n');

const env = { ...process.env, AIGILE_PORT: String(port), AIGILE_DATA: data, AIGILE_LOCAL: localCopy, AIGILE_AGENT_COMMAND: stub, AIGILE_NO_RESTART: '1', AIGILE_NO_USAGE_AUTO: '1' };
delete env.AIGILE_AS;
const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, stdio: 'ignore', cwd: ROOT });
let up = false;
for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(base + '/api/meta')).ok; } catch {} if (!up) await new Promise(r => setTimeout(r, 100)); }
if (!up) { console.log('sandbox did not start (port ' + port + ' busy?)'); proc.kill(); process.exit(1); }
console.log(`SANDBOX ${base}  (a copy of your board: click anything, it all vanishes when this stops)`);
const stop = () => { proc.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
proc.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(0); });
