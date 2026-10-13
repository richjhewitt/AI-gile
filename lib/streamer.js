// 🎥 Streamer mode, the auto part (AIG-592): every 30 s the board looks at the running programs (tasklist on Windows, ps elsewhere)
// for OBS or Streamlabs. The page asks GET /api/streamer and turns streamer mode on by itself when one runs (and off again when it
// stops), if the Setup switch "turn on by itself" is on (data/streamer.conf, default on). The page does the hiding and masking
// (public/js/streamer.js); this file only knows whether a streaming program is running.
// Tests: AIGILE_STREAM_STUB = a file path; when that file exists a program "runs" (its text is the name). AIGILE_STREAM_MS = the interval.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { DATA, bad } = require('./store');
const obs = require('./obs');

const FILE = () => path.join(DATA, 'streamer.conf');
const PROGRAM = /^(obs|obs32|obs64|obs-studio|streamlabs[ \w.-]*)(\.exe)?$/i;
let running = '', checkedAt = 0, timer = null;

// AIG-920: the program list is read in the background. tasklist takes about half a second, and the old spawnSync held the whole
// server (every poll, every window) for that long every 30 s. The stub stays synchronous so tests see it at once.
const pick = names => names.find(n => PROGRAM.test(n)) || '';
let scanning = false;
function check() {
  const stub = process.env.AIGILE_STREAM_STUB;
  if (stub) { try { running = fs.readFileSync(stub, 'utf8').trim() || 'OBS'; } catch { running = ''; } checkedAt = Date.now(); return; }
  if (scanning) return;
  scanning = true;
  const win = process.platform === 'win32';
  cp.execFile(win ? 'tasklist' : 'ps', win ? ['/FO', 'CSV', '/NH'] : ['-A', '-o', 'comm='], { encoding: 'utf8', windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
    scanning = false; checkedAt = Date.now();
    if (err) { running = ''; return; }
    running = pick(win ? out.split(/\r?\n/).map(l => (l.match(/^"([^"]+)"/) || [])[1]).filter(Boolean) : out.split('\n').map(l => path.basename(l.trim())).filter(Boolean));
  });
}
function start() {
  if (timer) return;
  check();
  timer = setInterval(check, Number(process.env.AIGILE_STREAM_MS) || 30e3); timer.unref();
}
// What streamer mode hides (AIG-638): every part is on by default (today's behaviour); personal projects are always hidden.
const PARTS = ['private', 'dms', 'friends', 'life', 'secrets'];
const conf = () => { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')) || {}; } catch { return {}; } };
const auto = () => conf().auto !== false;
const hide = () => { const h = conf().hide || {}, o = { personal: true }; for (const k of PARTS) o[k] = h[k] !== false; return o; };
// body: { auto?, hide?: { private, dms, friends, life, secrets } }; only what is sent changes.
function save(b) {
  const c = conf(), out = { auto: 'auto' in b ? !!b.auto : c.auto !== false, hide: {} };
  const h = (b.hide && typeof b.hide === 'object') ? b.hide : {}, was = c.hide || {};
  for (const k of PARTS) out.hide[k] = k in h ? !!h[k] : was[k] !== false;
  if (c.obs) out.obs = c.obs;   // the OBS link (AIG-643) is kept whatever else is saved
  fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(out)); return status();
}
const setAuto = on => save({ auto: on });

// OBS link (AIG-643..645). data/streamer.conf: obs: { port, password }. The password never goes to the page, only hasPassword.
let wired = false;
function obsConf() { const o = conf().obs; return o && Number(o.port) > 0 ? { port: Number(o.port), password: String(o.password || '') } : null; }
function obsStatus() {
  const o = obsConf();
  if (o) { wired = true; obs.connect(o.port, o.password); } else if (wired) { wired = false; obs.connect(null); }
  const base = { port: o ? o.port : 4455, hasPassword: !!(o && o.password), saved: !!o };
  if (!o) return { ...base, state: 'off', reason: '', streaming: false };
  const j = obs.info();
  // A refused connection: OBS is not running, or it runs with its WebSocket server off (the process check tells which).
  const failed = j.state === 'error' || (j.state === 'connecting' && !!j.reason);   // a quiet retry after a failure still reads as the failure
  const reason = failed ? (j.reason === 'refused' ? (running ? 'serveroff' : 'notrunning') : j.reason) : '';
  return { ...base, state: failed ? 'error' : j.state, reason, streaming: j.streaming };
}
// body: { action: 'connect', port?, password? } saves and connects; { action: 'start' | 'stop' } sends StartStream / StopStream.
async function obsAction(b) {
  const act = b && b.action;
  if (act === 'connect') {
    const c = conf(), was = c.obs || {};
    const port = b.port === undefined || b.port === '' ? Number(was.port) || 4455 : Number(b.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad('port must be a number from 1 to 65535');
    const password = typeof b.password === 'string' ? b.password : String(was.password || '');
    c.obs = { port, password };
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(c));
    wired = true; obs.connect(port, password, true); await obs.whenSettled();
    return status();
  }
  if (act === 'start' || act === 'stop') {
    if (obs.info().state !== 'connected') throw bad('Not connected to OBS', 409);
    try { await obs.request(act === 'start' ? 'StartStream' : 'StopStream'); } catch (e) { throw bad(e.message, 502); }
    return status();
  }
  throw bad('action must be connect, start or stop');
}
// With OBS connected, "streaming" is the real stream (AIG-645); otherwise the process check decides, as before.
function status() {
  start();
  const o = obsStatus(), linked = o.state === 'connected';
  return { auto: auto(), hide: hide(), running: linked ? o.streaming : !!running, program: linked ? 'OBS' : running, checkedAt, obs: o, via: linked ? 'obs' : 'process' };
}

module.exports = { start, status, setAuto, save, obsAction, PROGRAM };
