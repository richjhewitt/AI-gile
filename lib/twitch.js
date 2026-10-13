// 🟣 Twitch chat (AIG-628): read your own channel's chat in the Twitch tab of the DM window. Read-only, so no login:
// Twitch IRC over WebSocket with an anonymous justinfan nick. Optional, off until a channel name is saved in Setup.
// Config in aigile.local.json: "twitch": { "channel": "<name>" }. The last 200 messages are kept in memory.
// Env for tests: AIGILE_TWITCH_IRC (websocket url), AIGILE_TWITCH_STUB (no network; a test route injects messages).
const fs = require('fs');
const { LOCAL_FILE, now, localSettings, bad } = require('./store');

const IRC = () => process.env.AIGILE_TWITCH_IRC || 'wss://irc-ws.chat.twitch.tv:443';
const MAX = 200;
let msgs = [], sent = [], seq = 0, link = { connected: false, error: '' }, cur = null;

const channel = () => String((localSettings().twitch || {}).channel || '').trim().replace(/^#/, '').toLowerCase();
// The chat login (optional): { login, token } in aigile.local.json, kept on the server and never sent to the page.
const creds = () => { const t = localSettings().twitch || {}; return t.login && t.token ? { login: String(t.login), token: String(t.token) } : null; };
const config = () => { const c = creds(); return { channel: channel(), connected: !!link.connected, error: link.error || '', canReply: !!c, login: c ? c.login : '' }; };

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
  st.send = s => { try { if (ws.readyState !== 1) return false; ws.send(s); return true; } catch { return false; } };
  ws.onopen = () => {
    const c = creds(); send('CAP REQ :twitch.tv/tags');
    if (c) { send('PASS oauth:' + c.token); send('NICK ' + c.login); } else send('NICK justinfan' + (10000 + Math.floor(Math.random() * 89999)));
    send('JOIN #' + ch);
  };
  ws.onmessage = ev => {
    for (const line of String(ev.data).split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith('PING')) send('PONG' + line.slice(4));
      else if (/ NOTICE \* :Login/i.test(line)) link.error = 'Twitch refused the login token';
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
  if (ch) s.twitch = { ...(s.twitch || {}), channel: ch }; else if (creds()) s.twitch = { ...s.twitch, channel: '' }; else delete s.twitch;
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2));
  if (ch !== old) msgs = [];
  restart();
  return config();
}
// Messages newer than `after` (an id), oldest first. Nothing at all while no channel is set.
// Sign in to reply (or sign out with an empty token): the chat token (scopes chat:read chat:edit) and the login it belongs to.
function saveToken(b) {
  const login = String((b && b.login) || '').trim().replace(/^#/, '').toLowerCase(), token = String((b && b.token) || '').trim().replace(/^oauth:/i, '');
  const s = localSettings(), t = { ...(s.twitch || {}) };
  if (!login && !token) { delete t.login; delete t.token; }
  else {
    if (!/^[a-z0-9_]{3,25}$/.test(login)) throw bad('your Twitch login is 3 to 25 letters, numbers or underscores');
    if (!/^[a-z0-9]{20,60}$/i.test(token)) throw bad('that does not look like a Twitch chat token');
    t.login = login; t.token = token;
  }
  if (Object.keys(t).some(k => t[k])) s.twitch = t; else delete s.twitch;
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2));
  restart();
  return config();
}
// Say something in the channel as the signed-in user. Twitch does not echo it back, so it is added to the list here.
function send(b) {
  const c = creds(), text = String((b && b.text) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
  if (!channel()) throw bad('set a Twitch channel first');
  if (!c) throw bad('sign in to reply first (Setup > Twitch)');
  if (!text) throw bad('type something to say');
  if (process.env.AIGILE_TWITCH_STUB) sent.push({ channel: channel(), login: c.login, text });
  else if (!(cur && cur.send && cur.send('PRIVMSG #' + channel() + ' :' + text))) throw bad('not connected to Twitch yet, try again in a moment', 503);
  add(c.login, '', text); msgs[msgs.length - 1].mine = true;
  return { ok: true, id: seq };
}
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

// Tests only: what send() would have said.
const stubSent = () => { if (!process.env.AIGILE_TWITCH_STUB) throw bad('not available', 404); return sent; };

module.exports = { saveToken, send, stubSent, config, saveConfig, messages, stubMessage, start, restart, parse };
