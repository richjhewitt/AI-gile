// OBS connection (AIG-643..645): talks to OBS Studio's built-in WebSocket server (obs-websocket v5, Tools > WebSocket Server Settings)
// with Node's global WebSocket. Hello (op 0) -> Identify (op 1, auth = base64(sha256(base64(sha256(password + salt)) + challenge)))
// -> Identified (op 2). Once identified it keeps the connection, asks GetStreamStatus and follows StreamStateChanged events, so
// lib/streamer.js can say "streaming" from the real stream. If the connection drops it retries quietly (AIGILE_OBS_RETRY_MS, default 5 s),
// except after a wrong password, which waits for new settings. Tests: tools/qa/areas/streamer.mjs runs a small fake OBS server.
const crypto = require('crypto');

const sha = s => crypto.createHash('sha256').update(s).digest('base64');
let ws = null, creds = null, timer = null, gen = 0, seq = 0, streaming = false, waiters = [];
let state = 'off', reason = '';   // state: off | connecting | connected | error; reason (when error): badpassword | refused
const pending = new Map();

function settle() { const w = waiters; waiters = []; for (const f of w) f(); }
function set(s, r) { state = s; if (s !== 'connecting') reason = r || ''; if (s !== 'connecting') settle(); }
function drop() {
  const old = ws; ws = null;
  if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(); } catch {} }
  for (const [, p] of pending) p.reject(new Error('OBS closed the connection')); pending.clear();
  streaming = false;
}
function retry(my) {
  clearTimeout(timer);
  timer = setTimeout(() => { if (my === gen && creds) open(); }, Number(process.env.AIGILE_OBS_RETRY_MS) || 5000); timer.unref();
}
function open() {
  drop(); const my = gen;
  set('connecting');
  let sock;
  try { sock = new WebSocket('ws://127.0.0.1:' + creds.port); } catch { set('error', 'refused'); return retry(my); }
  ws = sock;
  // Windows can take a couple of seconds to refuse a connection: give up on a silent socket after 2.5 s.
  const giveUp = setTimeout(() => { if (my === gen && ws === sock && state === 'connecting') { drop(); set('error', 'refused'); retry(my); } }, 2500); giveUp.unref();
  sock.onerror = () => {};
  sock.onclose = e => {
    if (my !== gen || ws !== sock) return;
    ws = null; streaming = false;
    for (const [, p] of pending) p.reject(new Error('OBS closed the connection')); pending.clear();
    if (e && e.code === 4009) return set('error', 'badpassword');   // authentication failed: wait for new settings
    set('error', 'refused'); retry(my);
  };
  sock.onmessage = ev => {
    if (my !== gen) return;
    let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
    const d = m.d || {};
    if (m.op === 0) {
      const id = { rpcVersion: 1, eventSubscriptions: 64 };   // 64 = the Outputs events (stream started / stopped)
      if (d.authentication) id.authentication = sha(sha(creds.password + d.authentication.salt) + d.authentication.challenge);
      sock.send(JSON.stringify({ op: 1, d: id }));
    } else if (m.op === 2) {
      set('connected');
      request('GetStreamStatus').then(r => { if (my === gen) streaming = !!(r && r.outputActive); }).catch(() => {});
    } else if (m.op === 5 && d.eventType === 'StreamStateChanged') {
      streaming = !!(d.eventData && d.eventData.outputActive);
    } else if (m.op === 7 && pending.has(d.requestId)) {
      const p = pending.get(d.requestId); pending.delete(d.requestId);
      if (d.requestStatus && d.requestStatus.result) p.resolve(d.responseData || {}); else p.reject(new Error((d.requestStatus && d.requestStatus.comment) || 'OBS said no'));
    }
  };
}
// Send one request (StartStream, StopStream, GetStreamStatus ...); resolves with OBS's responseData.
function request(type) {
  return new Promise((resolve, reject) => {
    if (state !== 'connected' || !ws) return reject(new Error('Not connected to OBS'));
    const requestId = 'r' + (++seq), t = setTimeout(() => { pending.delete(requestId); reject(new Error('OBS did not answer')); }, 8000);
    pending.set(requestId, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
    ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId } }));
  });
}
// (Re)connect with these settings, if they changed or the link is down. Pass null to hang up.
function connect(port, password, force) {
  if (!port) { gen++; creds = null; clearTimeout(timer); drop(); return set('off'); }
  if (!force && creds && creds.port === port && creds.password === (password || '')) return;   // already on it (a retry timer runs after a failure)
  gen++; creds = { port, password: password || '' }; reason = ''; open();
}
// Resolves once the current attempt has ended (connected or failed), at most ms later.
function whenSettled(ms = 4000) {
  if (state !== 'connecting') return Promise.resolve();
  return new Promise(r => { const t = setTimeout(r, ms); waiters.push(() => { clearTimeout(t); r(); }); });
}
const info = () => ({ state, reason, streaming: state === 'connected' && streaming });

module.exports = { connect, request, whenSettled, info };
