// 🎥 Streamer mode, the auto part (AIG-592): every 30 s the board looks at the running programs (tasklist on Windows, ps elsewhere)
// for OBS or Streamlabs. The page asks GET /api/streamer and turns streamer mode on by itself when one runs (and off again when it
// stops), if the Setup switch "turn on by itself" is on (data/streamer.conf, default on). The page does the hiding and masking
// (public/js/streamer.js); this file only knows whether a streaming program is running.
// Tests: AIGILE_STREAM_STUB = a file path; when that file exists a program "runs" (its text is the name). AIGILE_STREAM_MS = the interval.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { DATA } = require('./store');

const FILE = () => path.join(DATA, 'streamer.conf');
const PROGRAM = /^(obs|obs32|obs64|obs-studio|streamlabs[ \w.-]*)(\.exe)?$/i;
let running = '', checkedAt = 0, timer = null;

function scan() {
  const stub = process.env.AIGILE_STREAM_STUB;
  if (stub) { try { return fs.readFileSync(stub, 'utf8').trim() || 'OBS'; } catch { return ''; } }
  let names = [];
  if (process.platform === 'win32') {
    const r = cp.spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    if (r.status === 0) names = r.stdout.split(/\r?\n/).map(l => (l.match(/^"([^"]+)"/) || [])[1]).filter(Boolean);
  } else {
    const r = cp.spawnSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8', timeout: 8000 });
    if (r.status === 0) names = r.stdout.split('\n').map(l => path.basename(l.trim())).filter(Boolean);
  }
  return names.find(n => PROGRAM.test(n)) || '';
}
function check() { try { running = scan(); } catch { running = ''; } checkedAt = Date.now(); }
function start() {
  if (timer) return;
  check();
  timer = setInterval(check, Number(process.env.AIGILE_STREAM_MS) || 30e3); timer.unref();
}
const auto = () => { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')).auto !== false; } catch { return true; } };
function setAuto(on) { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify({ auto: !!on })); return status(); }
function status() { start(); return { auto: auto(), running: !!running, program: running, checkedAt }; }

module.exports = { start, status, setAuto, PROGRAM };
