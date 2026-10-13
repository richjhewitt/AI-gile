// 🟣 Twitch chat (AIG-628): read your own channel's chat in the Twitch tab of the DM window. Read-only, so no login:
// Twitch IRC over WebSocket with an anonymous justinfan nick. Optional, off until a channel name is saved in Setup.
// Config in aigile.local.json: "twitch": { "channel": "<name>" }. The last 200 messages are kept in memory.
// Env for tests: AIGILE_TWITCH_IRC (websocket url), AIGILE_TWITCH_STUB (no network; a test route injects messages).
const fs = require('fs');
const { LOCAL_FILE, now, localSettings, bad } = require('./store');

const IRC = () => process.env.AIGILE_TWITCH_IRC || 'wss://irc-ws.chat.twitch.tv:443';
const MAX = 200;
let msgs = [], seq = 0, link = { connected: false, error: '' }, cur = null;

const channel = () => String((localSettings().twitch || {}).channel || '').trim().replace(/^#/, '').toLowerCase();
const config = () => ({ channel: channel(), connected: !!link.connected, error: link.error || '' });

function add(name, color, text, at) {
  msgs.push({ id: ++seq, name: String(name || '').slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '', text: String(text || '').slice(0, 500), at: at || now() });
  if (msgs.length > MAX) msgs = msgs.slice(-MAX);
}
// One IRC line with tags, e.g. "@color=#FF0000;display-name=Bob;tmi-sent-ts=1 :bob!bob@bob.tmi.twitch.tv PRIVMSG #chan :hello"
function parse(line) {
  const m = /^(?:@(\S+) )?:([^! ]+)(?:![^ ]*)? PRIVMSG #\S+ :(.*)$/.exec(line); if (!m) return null;
  const tags = {}; for (const kv of (m[1] || '').split(';')) { const i = kv.indexOf('='); if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1); }
  const ts = +tags['tmi-sent-ts'];
  return { name: tags['display-name'] || m[2], color: tags.color || '', text: m[3], at: ts ? new Date(ts).toISOString() : now() };
}

function connect() {
  const ch = channel(); if (!ch || process.env.AIGILE_TWITCH_STUB) return;
  const st = { dead: false }; cur = st;
  let ws;
  const again = ms => { link.connected = false; if (!st.dead) setTimeout(() => cur === st && connect(), ms); };
  st.close = () => { st.dead = true; link.connected = false; try { ws && ws.close(); } catch {} };
  try { ws = new WebSocket(IRC()); } catch (e) { link.error = String(e.message || e); return again(30e3); }
  const send = s => { try { ws.send(s); } catch {} };
  ws.onopen = () => { send('CAP REQ :twitch.tv/tags'); send('NICK justinfan' + (10000 + Math.floor(Math.random() * 89999))); send('JOIN #' + ch); };
  ws.onmessage = ev => {
    for (const line of String(ev.data).split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith('PING')) send('PONG' + line.slice(4));
      else if (/ 366 /.test(line)) { link.connected = true; link.error = ''; }
      else { const p = parse(line); if (p) add(p.name, p.color, p.text, p.at); }
    }
  };
  ws.onclose = () => again(10e3);
  ws.onerror = () => { link.error = link.error || 'cannot reach Twitch'; };
}
function restart() { if (cur) cur.close(); cur = null; link = { connected: false, error: '' }; connect(); }
function start() { if (!cur) connect(); }

function saveConfig(b) {
  const ch = String((b && b.channel) || '').trim().replace(/^#/, '').toLowerCase();
  if (ch && !/^[a-z0-9_]{3,25}$/.test(ch)) throw bad('a Twitch channel name is 3 to 25 letters, numbers or underscores');
  const s = localSettings(); const old = channel();
  if (ch) s.twitch = { channel: ch }; else delete s.twitch;
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2));
  if (ch !== old) msgs = [];
  restart();
  return config();
}
// Messages newer than `after` (an id), oldest first. Nothing at all while no channel is set.
function messages(after) {
  if (!channel()) return [];
  const a = +after || 0;
  return msgs.filter(m => m.id > a);
}
// Tests only: stands in for the chat (which a test can't reach).
function stubMessage(b) {
  if (!process.env.AIGILE_TWITCH_STUB) throw bad('not available', 404);
  add(b.name || 'Viewer', b.color || '', b.content || '', b.at);
  return { ok: true };
}

module.exports = { config, saveConfig, messages, stubMessage, start, restart, parse };
