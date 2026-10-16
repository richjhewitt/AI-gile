// 🟣 Twitch chat (AIG-628): read your own channel's chat in the Twitch tab of the DM window. Read-only, so no login:
// Twitch IRC over WebSocket with an anonymous justinfan nick. Optional, off until a channel name is saved in Setup.
// Config in aigile.local.json: "twitch": { "channel": "<name>", "recent": [last 10], "clientId", "authLogin" }. The last 200 messages are kept in memory.
// Env for tests: AIGILE_TWITCH_IRC (websocket url), AIGILE_TWITCH_STUB (no network; a test route injects messages).
const fs = require('fs');
const S = require('./store');
const secrets = require('./secrets');
const { now, localSettings, writeSettings, bad } = S;

const IRC = () => process.env.AIGILE_TWITCH_IRC || 'wss://irc-ws.chat.twitch.tv:443';
const MAX = 200;
let msgs = [], sent = [], seq = 0, link = { connected: false, error: '' }, cur = null;

const NAME = /^[a-z0-9_]{3,25}$/;
const tw = () => localSettings().twitch || {};
const channel = () => String(tw().channel || '').trim().replace(/^#/, '').toLowerCase();
const recent = () => (Array.isArray(tw().recent) ? tw().recent : []).filter(c => NAME.test(c)).slice(0, 10);
// AIG-1404: AI-gile ships ONE public Twitch app, so everyone just signs in with their own Twitch account (the device code flow
// uses a public client, no secret). Its Client ID is BUILTIN_CLIENT_ID; AIGILE_TWITCH_CLIENT_ID or twitch.defaultClientId in
// aigile.local.json override it. twitch.clientId (Setup > Twitch > Other ways) is for people who want their own app; it wins when set.
const BUILTIN_CLIENT_ID = '';
const ID_RE = /^[a-z0-9]{20,40}$/i;
const builtInId = () => { const v = String(process.env.AIGILE_TWITCH_CLIENT_ID || tw().defaultClientId || BUILTIN_CLIENT_ID).trim(); return ID_RE.test(v) ? v : ''; };
const ownId = () => String(tw().clientId || '').trim();
const clientId = () => ownId() || builtInId();
// The chat login (optional). Two ways: 💜 Sign in with Twitch (AIG-1346, below: the tokens in the secret store, the login in
// settings as authLogin), or the older pasted { login, token } in aigile.local.json. Kept on the server, never sent to the page.
const pasted = () => { const t = tw(); return t.login && t.token ? { login: String(t.login), token: String(t.token) } : null; };
const signedIn = () => !!tw().authLogin && secrets.hasKept(KEY);
const who = () => signedIn() ? { login: String(tw().authLogin), via: 'twitch' } : pasted() ? { login: pasted().login, via: 'token' } : null;
async function creds() {
  if (signedIn()) return { login: String(tw().authLogin), token: await accessToken() };
  return pasted();
}
const config = () => { const c = who(); return { channel: channel(), connected: !!link.connected, error: link.error || '', canReply: !!c, login: c ? c.login : '', via: c ? c.via : '',
  clientId: ownId(), builtIn: !!builtInId(), ready: !!clientId(), recent: recent(), signedIn: signedIn(), hasPasted: !!pasted() }; };

/* ---------- 💜 Sign in with Twitch (AIG-1346): OAuth device code grant ---------- */
// Setup shows a short code and Twitch's activate page; you approve there and the board polls Twitch until it hands over an access
// and a refresh token (scopes chat:read chat:edit); helix/users says which login they belong to. Device flow needs a public client:
// AI-gile's built-in app (BUILTIN_CLIENT_ID above), or your own one ("Client type: Public") in settings twitch.clientId. The tokens: secrets.keep('twitch:oauth')
// as JSON {access, refresh, until} (the encryption of the board's other saved logins) plus a copy in memory. Never logged, never
// sent to the page. A run-out access token is swapped with the refresh token. Tests: with AIGILE_TWITCH_STUB only the QA fake
// Twitch (stubBase sets its address) is ever asked; without one there is no network at all.
// Scopes, only what is used: chat:read + chat:edit (read and send chat as you), user:read:moderated_channels and user:read:follows
// (the channel picker lists the channels you moderate, then the ones you follow; channels() below).
const KEY = 'twitch:oauth', SCOPES = 'chat:read chat:edit user:read:moderated_channels user:read:follows';
let base = null, flow = null, mem = null, busy = null;
const ID_URL = () => process.env.AIGILE_TWITCH_STUB ? (base && base.id) : 'https://id.twitch.tv';
const API_URL = () => process.env.AIGILE_TWITCH_STUB ? (base && base.api) : 'https://api.twitch.tv';
const twErr = j => String((j && (j.message || j.error_description || j.error)) || 'Twitch did not answer').split(/\r?\n/)[0].slice(0, 200);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function idPost(what, form) {
  const u = ID_URL(); if (!u) throw bad('no Twitch here (tests)', 503);
  let r;
  try { r = await fetch(u + '/oauth2/' + what, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('could not reach Twitch\'s sign-in server'); }
  try { return await r.json(); } catch { return {}; }
}
async function helix(access, what) {
  const u = API_URL(); if (!u) throw new Error('no Twitch here (tests)');
  let r; try { r = await fetch(u + '/helix/' + what, { headers: { Authorization: 'Bearer ' + access, 'Client-Id': clientId() }, signal: AbortSignal.timeout(20000) }); } catch { throw new Error('could not reach Twitch'); }
  let j = {}; try { j = await r.json(); } catch {}
  return j;
}
async function helixLogin(access) {
  const j = await helix(access, 'users'), d = (j.data && j.data[0]) || {};
  const login = String(d.login || '').toLowerCase();
  if (!NAME.test(login)) throw new Error('Twitch did not say who you are: ' + twErr(j));
  return { login, id: /^\d{1,20}$/.test(String(d.id || '')) ? String(d.id) : '' };
}
// The channel picker's groups (AIG-1346): your own channel, the ones you moderate, the ones you follow, then your recent ones;
// each name in its first group only. Moderated and followed come from Helix (first 100 each), kept 5 minutes; without the
// Twitch sign-in it is just the recent list (and the pasted login's own channel).
let chanCache = null;
async function channels(fresh) {
  const w = who(), own = w ? [w.login] : [];
  let mod = [], follows = [], error = '';
  if (signedIn()) {
    if (fresh || !chanCache || chanCache.login !== w.login || chanCache.until < Date.now()) {
      try {
        const tok = await accessToken(), uid = String(tw().authId || '');
        const names = (j, k) => (Array.isArray(j.data) ? j.data : []).map(x => String(x[k] || '').toLowerCase()).filter(n => NAME.test(n));
        if (!uid) throw new Error('sign in with Twitch again to list your channels');
        const [jm, jf] = await Promise.all([helix(tok, 'moderation/channels?first=100&user_id=' + uid), helix(tok, 'channels/followed?first=100&user_id=' + uid)]);
        chanCache = { login: w.login, until: Date.now() + 5 * 60e3, mod: names(jm, 'broadcaster_login'), follows: names(jf, 'broadcaster_login'), error: jm.data && jf.data ? '' : 'Twitch said: ' + twErr(jm.data ? jf : jm) };
      } catch (e) { chanCache = { login: w.login, until: Date.now() + 30e3, mod: [], follows: [], error: String(e.message || e) }; }
    }
    ({ mod, follows, error } = chanCache);
  }
  const seen = new Set(), only = l => l.filter(n => !seen.has(n) && seen.add(n));
  return { own: only(own), mod: only(mod), follows: only(follows), recent: only(recent()), error };
}
const store = j => {
  mem = { access: String(j.access_token), refresh: String(j.refresh_token || (mem && mem.refresh) || ''), until: Date.now() + Math.max(0, (Number(j.expires_in) || 3600) - 120) * 1000 };
  secrets.keep(KEY, JSON.stringify(mem));
};
const NO_ID = 'Sign in with Twitch is not ready yet in this version of AI-gile (or use your own Twitch app under Other ways: dev.twitch.tv/console, Client type Public)';
async function authStart() {
  const id = clientId(); if (!id) throw bad(NO_ID);
  const j = await idPost('device', { client_id: id, scopes: SCOPES });
  if (!j.device_code || !j.user_code) throw bad('Twitch said: ' + twErr(j));
  const f = { state: 'waiting', code: String(j.user_code).slice(0, 20), url: /^https:\/\//.test(j.verification_uri) ? String(j.verification_uri).slice(0, 300) : 'https://www.twitch.tv/activate',
    until: Date.now() + (Number(j.expires_in) || 1800) * 1000, error: '' };
  flow = f; authPoll(f, String(j.device_code), Math.max(1, Number(j.interval) || 5), id);
  return authStatus();
}
async function authPoll(f, device, wait, id) {
  while (flow === f && Date.now() < f.until) {
    await sleep(wait * (process.env.AIGILE_TWITCH_STUB ? 200 : 1000));
    if (flow !== f) return;
    let j; try { j = await idPost('token', { client_id: id, scopes: SCOPES, device_code: device, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }); } catch { continue; }
    if (flow !== f) return;
    if (j.access_token) {
      try {
        const me = await helixLogin(j.access_token);
        store(j); const s = localSettings(); s.twitch = { ...(s.twitch || {}), authLogin: me.login, authId: me.id }; writeSettings(s); chanCache = null;
        f.state = 'done'; restart();
      } catch (e) { f.state = 'error'; f.error = e.message; }
      return;
    }
    const m = twErr(j);
    if (/authorization_pending/i.test(m)) continue;
    if (/slow_down/i.test(m)) { wait += 5; continue; }
    f.state = 'error';
    f.error = /declin|denied/i.test(m) ? 'you said no on Twitch\'s page' : /invalid device code|expired/i.test(m) ? 'the code ran out: press Sign in with Twitch again' : 'Twitch said: ' + m;
    return;
  }
  if (flow === f && f.state === 'waiting') { f.state = 'error'; f.error = 'the code ran out: press Sign in with Twitch again'; }
}
const authStatus = () => ({ signedIn: signedIn(), login: signedIn() ? String(tw().authLogin) : '', state: flow ? flow.state : 'none',
  code: flow && flow.state === 'waiting' ? flow.code : '', url: flow && flow.state === 'waiting' ? flow.url : '', error: flow ? flow.error : '' });
// A fresh access token: the one in memory (or the store) while it lasts, else swapped with the refresh token (one swap at a time).
async function accessToken() {
  if (!mem) { try { mem = JSON.parse(secrets.kept(KEY) || 'null'); } catch { mem = null; } }
  if (!mem || !mem.refresh) throw bad('not signed in to Twitch: press Sign in with Twitch in Setup > Twitch');
  if (mem.access && mem.until > Date.now()) return mem.access;
  return busy = busy || (async () => {
    const j = await idPost('token', { client_id: clientId(), grant_type: 'refresh_token', refresh_token: mem.refresh });
    if (!j.access_token) {
      if (/invalid refresh token|invalid_grant|invalid client/i.test(twErr(j))) { forgetLogin(); throw bad('the Twitch sign-in has run out: press Sign in with Twitch in Setup > Twitch again'); }
      throw bad('Twitch said: ' + twErr(j), 502);
    }
    store(j); return mem.access;
  })().finally(() => { busy = null; });
}
function forgetLogin() {
  secrets.keep(KEY, null); mem = null;
  chanCache = null;
  const s = localSettings(); if (s.twitch && (s.twitch.authLogin || s.twitch.authId)) { delete s.twitch.authLogin; delete s.twitch.authId; writeSettings(s); }
}
function signOut() { forgetLogin(); flow = null; restart(); return config(); }
// Tests only: where the QA fake Twitch listens.
function stubBase(b) { if (!process.env.AIGILE_TWITCH_STUB) throw bad('not available', 404); base = { id: String((b && b.id) || ''), api: String((b && b.api) || '') }; mem = null; return { ok: true }; }

function add(name, color, text, at) {
  msgs.push({ id: ++seq, name: String(name || '').slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '', text: String(text || '').slice(0, 500), at: at || now() });
  if (msgs.length > MAX) msgs = msgs.slice(-MAX);
}
// 💡 !idea (AIG-630): a viewer types "!idea some text" and it lands as a backlog 💡 idea card (the same kind as Ideas > decide later:
// createdBy Ideas, quick, needsYou) in the owner's first open project, for the owner to keep or drop. Not in To do. Empty ideas are
// ignored, the text is cut at 200 characters, and each viewer gets one idea a minute. Streamer mode masks the card like any other text.
const IDEA_MAX = 200, IDEA_GAP = 60e3, lastIdea = new Map();
function ideaFrom(name, text) {
  const m = /^!idea(?:\s+([\s\S]*))?$/i.exec(String(text || '').trim()); if (!m) return false;
  const idea = String(m[1] || '').replace(/\s+/g, ' ').trim().slice(0, IDEA_MAX); if (!idea) return false;
  const who = String(name || '').toLowerCase(), t = Date.now();
  if (t - (lastIdea.get(who) || 0) < IDEA_GAP) return false;
  const ps = S.byOrder(S.listSlugs().map(S.load).filter(p => p && !p.archived && !p.personal && !p.private));
  if (!ps.length) return false;
  lastIdea.set(who, t); if (lastIdea.size > 500) for (const [k, v] of lastIdea) if (t - v > IDEA_GAP) lastIdea.delete(k);
  const p = ps[0];
  p.cards.push({ id: p.key + '-' + p.nextId++, title: '💬 ' + idea.slice(0, 80), description: idea + '\n\n_Twitch viewer: ' + String(name).slice(0, 40) + '_', testSteps: '', type: 'task', priority: 'normal', status: 'backlog',
    assignee: '', sprint: '', blocked: false, needsYou: true, createdBy: 'Ideas', quick: true, created: now(), updated: now(), comments: [] });
  S.save(p); return true;
}
// One IRC line with tags, e.g. "@color=#FF0000;display-name=Bob;tmi-sent-ts=1 :bob!bob@bob.tmi.twitch.tv PRIVMSG #chan :hello"
function parse(line) {
  const m = /^(?:@(\S+) )?:([^! ]+)(?:![^ ]*)? PRIVMSG #\S+ :(.*)$/.exec(line); if (!m) return null;
  const tags = {}; for (const kv of (m[1] || '').split(';')) { const i = kv.indexOf('='); if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1); }
  const ts = +tags['tmi-sent-ts'];
  return { name: tags['display-name'] || m[2], color: tags.color || '', text: m[3], at: ts ? new Date(ts).toISOString() : now() };
}

async function connect() {
  const ch = channel(); if (!ch || process.env.AIGILE_TWITCH_STUB) return;
  const st = { dead: false }; cur = st;
  st.close = () => { st.dead = true; link.connected = false; try { ws && ws.close(); } catch {} };
  let ws, c = null;
  const again = ms => { link.connected = false; if (!st.dead) setTimeout(() => cur === st && connect(), ms); };
  try { c = await creds(); } catch (e) { link.error = String(e.message || e); }   // signed in: a fresh token first (refreshed if it ran out)
  if (cur !== st || st.dead) return;
  try { ws = new WebSocket(IRC()); } catch (e) { link.error = String(e.message || e); return again(30e3); }
  const send = s => { try { ws.send(s); } catch {} };
  st.send = s => { try { if (ws.readyState !== 1) return false; ws.send(s); return true; } catch { return false; } };
  ws.onopen = () => {
    send('CAP REQ :twitch.tv/tags');
    if (c) { send('PASS oauth:' + c.token); send('NICK ' + c.login); } else send('NICK justinfan' + (10000 + Math.floor(Math.random() * 89999)));
    send('JOIN #' + ch);
  };
  ws.onmessage = ev => {
    for (const line of String(ev.data).split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith('PING')) send('PONG' + line.slice(4));
      else if (/ NOTICE \* :Login/i.test(line)) { link.error = 'Twitch refused the login token'; if (mem) mem.until = 0; }   // signed in: the next try refreshes it
      else if (/ 366 /.test(line)) { link.connected = true; link.error = ''; }
      else { const p = parse(line); if (p) { add(p.name, p.color, p.text, p.at); try { ideaFrom(p.name, p.text); } catch {} } }
    }
  };
  ws.onclose = () => again(10e3);
  ws.onerror = () => { link.error = link.error || 'cannot reach Twitch'; };
}
function restart() { if (cur) cur.close(); cur = null; link = { connected: false, error: '' }; connect(); }
function start() { if (!cur) connect(); }

// Saves what the body has (AIG-1346): channel (the one to join; it also goes first in the recent list, last 10 kept), clientId
// (your own Twitch app, optional; changing the ID in use signs you out), forget (drops a name from the recent list). Switching channel keeps the sign-in.
function saveConfig(b) {
  b = b || {};
  const s = localSettings(), t = { ...(s.twitch || {}) }, old = channel();
  if ('clientId' in b) {
    const id = String(b.clientId || '').trim();
    if (id && !ID_RE.test(id)) throw bad('a Twitch Client ID is about 30 letters and numbers (dev.twitch.tv/console > your app > Client ID)');
    if (id !== ownId()) { const was = clientId(); t.clientId = id; if (t.authLogin && (id || builtInId()) !== was) { secrets.keep(KEY, null); mem = null; chanCache = null; delete t.authLogin; delete t.authId; } flow = null; }
  }
  if ('channel' in b) {
    const ch = String(b.channel || '').trim().replace(/^#/, '').toLowerCase();
    if (ch && !NAME.test(ch)) throw bad('a Twitch channel name is 3 to 25 letters, numbers or underscores');
    t.channel = ch;
    if (ch) t.recent = [ch, ...recent().filter(x => x !== ch)].slice(0, 10);
  }
  if ('forget' in b) t.recent = recent().filter(x => x !== String(b.forget || '').toLowerCase());
  for (const k of Object.keys(t)) if (t[k] === '' || t[k] == null || (Array.isArray(t[k]) && !t[k].length)) delete t[k];
  if (Object.keys(t).length) s.twitch = t; else delete s.twitch;
  writeSettings(s);
  if (channel() !== old || 'clientId' in b) { if (channel() !== old) msgs = []; restart(); }
  return config();
}
// Messages newer than `after` (an id), oldest first. Nothing at all while no channel is set.
// Sign in to reply (or sign out with an empty token): the chat token (scopes chat:read chat:edit) and the login it belongs to.
function saveToken(b) {
  const login = String((b && b.login) || '').trim().replace(/^#/, '').toLowerCase(), token = String((b && b.token) || '').trim().replace(/^oauth:/i, '');
  const s = localSettings(), t = { ...(s.twitch || {}) };
  if (!login && !token) { delete t.login; delete t.token; }
  else {
    if (!NAME.test(login)) throw bad('your Twitch login is 3 to 25 letters, numbers or underscores');
    if (!/^[a-z0-9]{20,60}$/i.test(token)) throw bad('that does not look like a Twitch chat token');
    t.login = login; t.token = token;
  }
  if (Object.keys(t).some(k => t[k])) s.twitch = t; else delete s.twitch;
  writeSettings(s);
  restart();
  return config();
}
// Say something in the channel as the signed-in user. Twitch does not echo it back, so it is added to the list here.
async function send(b) {
  const text = String((b && b.text) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
  if (!channel()) throw bad('set a Twitch channel first');
  if (!who()) throw bad('sign in to reply first (Setup > Twitch)');
  if (!text) throw bad('type something to say');
  const c = await creds();
  if (process.env.AIGILE_TWITCH_STUB) sent.push({ channel: channel(), login: c.login, text, via: who().via });
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
  if (channel()) ideaFrom(b.name || 'Viewer', b.content);
  return { ok: true };
}

// Tests only: what send() would have said.
const stubSent = () => { if (!process.env.AIGILE_TWITCH_STUB) throw bad('not available', 404); return sent; };

module.exports = { channels, authStart, authStatus, signOut, stubBase, saveToken, send, stubSent, config, saveConfig, messages, stubMessage, start, restart, parse };
