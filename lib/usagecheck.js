// Check usage now (AIG-151): the plan % only reaches the board from Claude's status line, which only runs in a
// terminal session. This starts Claude in a hidden window with one tiny message on the cheapest model (it only
// reports usage after a reply), waits for the status line to post /api/limits, then closes it.
// Auto mode: when on, a check runs if the last reading is over an hour old (so a terminal session that is
// already posting costs nothing). Settings live in data/usage-check.conf (JSON).
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DATA, bad, localSettings } = require('./store');
const { agentCommand } = require('./presence');
const noTokens = require('./notokens');

// Not .json: every .json file in data/ is a project.
const FILE = path.join(DATA, 'usage-check.conf'), LIMITS = path.join(DATA, 'limits.log');
const STALE_MS = 60 * 60e3, WAIT_MS = 60e3, MIN_GAP_MS = 2 * 60e3;
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => fs.writeFileSync(FILE, JSON.stringify(s, null, 1));
const size = () => { try { return fs.statSync(LIMITS).size; } catch { return 0; } };
const lastReading = () => { try { const l = fs.readFileSync(LIMITS, 'utf8').trim().split('\n').pop(); return JSON.parse(l).at; } catch { return null; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// PowerShell single-quoted string: a ' is written twice.
const psq = s => "'" + String(s).replace(/'/g, "''") + "'";

// Usage checks (AIG-353): 'off' (aigile.local.json usageChecks, no button, no auto), 'hand' or 'auto' (auto in the conf file).
const mode = () => localSettings().usageChecks === 'off' ? 'off' : read().auto ? 'auto' : 'hand';


let running = null, cur = 0;
// ⛔ No Token Mode: close a check that is going.
let stopped = false;   // AIG-920: stop() can land while PowerShell is still starting the check (no pid yet)
function stop() { stopped = true; if (cur) require('./platform').killTree(cur); cur = 0; }
async function checkUsage() {
  noTokens.guard();   // ⛔ (AIG-337)
  if (mode() === 'off') throw bad('usage checks are switched off in Setup');
  if (running) return running;
  const s = read();
  if (s.lastCheck && Date.now() - Date.parse(s.lastCheck) < MIN_GAP_MS) throw bad('checked less than 2 minutes ago');
  const exe = agentCommand();
  stopped = false;
  running = (async () => {
    write({ ...s, lastCheck: new Date().toISOString() });
    const dir = path.join(DATA, 'usagecheck'); fs.mkdirSync(dir, { recursive: true });   // its own folder, not AI-gile's (AIG-454)
    const before = size();
    // Only the user's settings (the status line), no project hooks, no MCP, one harmless tool, cheapest model.
    const args = '--model haiku --tools TodoWrite --setting-sources user --strict-mcp-config --disable-slash-commands "Reply with just: OK"';
    const ps = `$p = Start-Process -FilePath ${psq(exe)} -ArgumentList ${psq(args)} -WorkingDirectory ${psq(dir)} -WindowStyle Hidden -PassThru; $p.Id`;
    let pid, r = {};
    if (process.platform === 'win32') {
      r = await new Promise(res => require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, encoding: 'utf8', timeout: 20e3 },
        (error, stdout, stderr) => res({ error, stdout, stderr })));   // AIG-920: in the background, not holding the server
      pid = parseInt(r.stdout, 10);
    } else {   // Linux / macOS (AIG-408): detached in its own process group, so killTree closes it
      const c = spawn(exe, ['--model', 'haiku', '--tools', 'TodoWrite', '--setting-sources', 'user', '--strict-mcp-config', '--disable-slash-commands', 'Reply with just: OK'], { cwd: dir, detached: true, stdio: 'ignore' });
      c.on('error', e => { r = { error: e }; }); c.unref(); pid = c.pid;
    }
    if (stopped && pid) { require('./platform').killTree(pid); return { ok: false, reason: 'stopped' }; }
    cur = pid;
    if (!pid) throw bad('could not start Claude: ' + String(r.stderr || r.error || '').trim().slice(0, 200));
    try {
      for (let t = Date.now(); Date.now() - t < WAIT_MS; await sleep(500)) if (size() !== before) return { ok: true, at: lastReading() };
      return { ok: false, reason: 'no reading came back in time (is the status line set up?)' };
    } finally { require('./platform').killTree(pid); }
  })();
  try { return await running; } finally { running = null; }
}

function usageCheckStatus() { const s = read(); return { mode: mode(), auto: mode() === 'auto', lastCheck: s.lastCheck || null, lastReading: lastReading() }; }
function setUsageAuto(on) { write({ ...read(), auto: !!on }); return usageCheckStatus(); }

// Auto mode: every 10 minutes, check when the last reading is over an hour old.
function startAuto() {
  setInterval(() => {
    const s = read(), at = lastReading();
    if (mode() === 'auto' && (!at || Date.now() - Date.parse(at) > STALE_MS)) checkUsage().catch(() => {});
  }, 10 * 60e3).unref();
}

module.exports = { mode, stop, checkUsage, usageCheckStatus, setUsageAuto, startAuto };
