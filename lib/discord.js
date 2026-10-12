// 💬 Discord bridge (AIG-473, AIG-481): DM a bot in Discord and the message reaches an agent's chat on the board;
// what the agent says comes back in the same DM. Optional, off until a bot is set up.
// Config in aigile.local.json: "discord": { "bots": [{ "name", "token", "users": ["<your Discord user id>"], "target": "<project slug>" | "_watchman" }] }
// Safety: only the listed Discord user ids are heard (none listed = nobody); the token is never logged or sent to the page.
// Node's built-in WebSocket and fetch, no packages. DMs need only the DIRECT_MESSAGES intent (not a privileged one).
// Env for tests: AIGILE_DISCORD_API (REST base), AIGILE_DISCORD_GATEWAY (websocket url).
const fs = require('fs');
const path = require('path');
const { DATA, LOCAL_FILE, now, load, localSettings, owner, bad } = require('./store');

const API = () => process.env.AIGILE_DISCORD_API || 'https://discord.com/api/v10';
const GATEWAY = () => process.env.AIGILE_DISCORD_GATEWAY || 'wss://gateway.discord.gg/?v=10&encoding=json';
const FILE = path.join(DATA, 'discord.conf');   // not .json: every .json in data/ is a project
const INTENTS = 1 << 12;   // DIRECT_MESSAGES
const POLL_MS = +process.env.AIGILE_DISCORD_POLL_MS || 8000, MAX_IN = 4000, CHUNK = 1900;
const board = () => `http://localhost:${process.env.AIGILE_PORT || 4321}`;

const state = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { marks: {}, threads: {} }; } };
const keep = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); } catch {} };

// The configured bots, cleaned. Needs a name, a token and a target; users may be empty (then it hears nobody).
function bots() {
  const d = localSettings().discord || {};
  const list = Array.isArray(d.bots) ? d.bots : (d.token ? [d] : []);
  return list.map((b, i) => ({
    name: String(b.name || 'bot' + (i + 1)).trim().slice(0, 40),
    token: String(b.token || '').trim(),
    users: (Array.isArray(b.users) ? b.users : [b.users]).map(u => String(u || '').trim()).filter(u => /^\d{5,25}$/.test(u)),
    target: String(b.target || '_watchman').trim(),
  })).filter(b => b.token);
}

/* ---------- Discord REST ---------- */
async function rest(bot, method, url, body) {
  const r = await fetch(API() + url, { method, headers: { Authorization: 'Bot ' + bot.token, 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (https://github.com/richjhewitt/AI-gile, 1)' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('Discord said ' + r.status);
  return r.status === 204 ? null : r.json();
}
// Chop a long reply at line ends where it can, so each part fits Discord's 2000 characters.
function chunks(text) {
  const out = []; let rest = String(text || '').trim();
  while (rest.length > CHUNK) { let i = rest.lastIndexOf('\n', CHUNK); if (i < CHUNK / 2) i = CHUNK; out.push(rest.slice(0, i).trim()); rest = rest.slice(i).trim(); }
  if (rest) out.push(rest);
  return out;
}
async function dmUser(bot, userId, text) {
  const ch = await rest(bot, 'POST', '/users/@me/channels', { recipient_id: userId });
  for (const part of chunks(text)) await rest(bot, 'POST', `/channels/${ch.id}/messages`, { content: part });
}

/* ---------- Discord -> board ---------- */
async function boardCall(method, url, body) {
  const r = await fetch(board() + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('board said ' + r.status);
  return r.json();
}
// A DM from an allowed user: to the Scrum Master's chat, or to a project lead as an answer to the question waiting on the owner,
// else as a new quick chat card (the same as typing in that lead's chat).
async function incoming(bot, text) {
  text = String(text || '').trim().slice(0, MAX_IN); if (!text) return null;
  if (bot.target === '_watchman') { await boardCall('POST', '/api/chats/_watchman', { text }); return { to: '_watchman' }; }
  const p = load(bot.target); if (!p) throw new Error('no project ' + bot.target);
  const q = (p.cards || []).filter(c => c.needsYou && !c.blocked && c.status !== 'done').sort((a, b) => String(b.updated).localeCompare(String(a.updated)))[0];
  let card;
  if (q) card = await boardCall('POST', `/api/projects/${bot.target}/cards/${q.id}/comments`, { author: owner(), text });
  else card = await boardCall('POST', `/api/projects/${bot.target}/cards`, { title: '💬 ' + text.split('\n')[0].slice(0, 80), description: text, type: 'task', status: 'team', createdBy: owner(), quick: true });
  const s = state(); const t = (s.threads[bot.name] = s.threads[bot.name] || []);
  if (!t.includes(card.id)) t.push(card.id);
  s.threads[bot.name] = t.slice(-50); keep(s);
  return { to: bot.target, card: card.id };
}
function handleMessage(bot, m) {
  if (!m || !m.author || m.author.bot || m.guild_id) return null;   // DMs only, never other bots
  if (!bot.users.includes(String(m.author.id))) return null;       // only the people you listed
  return incoming(bot, m.content);
}

/* ---------- board -> Discord ---------- */
// New words from the agent since the last look: the Scrum Master's chat, or comments by anyone but the owner on the
// cards this bot has talked in. Returns the texts; the mark moves on so nothing is sent twice.
function newReplies(bot) {
  const s = state(); s.marks = s.marks || {}; s.threads = s.threads || {};
  const since = s.marks[bot.name];
  if (!since) { s.marks[bot.name] = now(); keep(s); return []; }   // first look: only what comes after now
  const out = [];
  if (bot.target === '_watchman') {
    const wm = require('./watchman'), list = wm.messages() || wm.lastNight() || [];
    for (const m of list) if (!m.mine && !m.alert && m.at > since && m.text) out.push({ at: m.at, text: m.text });
  } else {
    const p = load(bot.target);
    for (const id of s.threads[bot.name] || []) {
      const c = p && (p.cards || []).find(x => x.id === id); if (!c) continue;
      for (const m of c.comments || []) if (m.at > since && String(m.author).toLowerCase() !== String(owner()).toLowerCase() && m.text && !m.mark) out.push({ at: m.at, text: `**${m.author}** (${c.id})\n${m.text}` });
    }
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  if (out.length) { s.marks[bot.name] = out[out.length - 1].at; keep(s); }
  return out.map(o => o.text);
}
async function sendReplies(bot) {
  const texts = newReplies(bot);
  for (const t of texts) for (const u of bot.users.slice(0, 1)) await dmUser(bot, u, t);
  return texts.length;
}

/* ---------- gateway ---------- */
const live = new Map();   // bot name -> { connected, error }
function connect(bot) {
  const st = live.get(bot.name) || { connected: false, error: '' }; live.set(bot.name, st);
  let ws, hb, seq = null, acked = true, dead = false;
  const again = ms => { clearInterval(hb); st.connected = false; if (!dead) setTimeout(() => live.get(bot.name) === st && connect(bot), ms); };
  st.close = () => { dead = true; clearInterval(hb); st.connected = false; try { ws && ws.close(); } catch {} };
  try { ws = new WebSocket(GATEWAY()); } catch (e) { st.error = String(e.message || e); return again(30e3); }
  ws.onmessage = ev => {
    let f; try { f = JSON.parse(ev.data); } catch { return; }
    if (f.s != null) seq = f.s;
    if (f.op === 10) {
      acked = true; hb = setInterval(() => { if (!acked) { try { ws.close(); } catch {} return; } acked = false; try { ws.send(JSON.stringify({ op: 1, d: seq })); } catch {} }, f.d.heartbeat_interval);
      ws.send(JSON.stringify({ op: 2, d: { token: bot.token, intents: INTENTS, properties: { os: process.platform, browser: 'aigile', device: 'aigile' } } }));
    } else if (f.op === 11) acked = true;
    else if (f.op === 7 || f.op === 9) { try { ws.close(); } catch {} }
    else if (f.op === 0 && f.t === 'READY') { st.connected = true; st.error = ''; }
    else if (f.op === 0 && f.t === 'MESSAGE_CREATE') Promise.resolve(handleMessage(bot, f.d)).catch(e => { st.error = String(e.message || e); });
  };
  ws.onclose = ev => {
    if (ev.code === 4004 || ev.code === 4013 || ev.code === 4014) { st.error = ev.code === 4004 ? 'Discord refused the token' : 'Discord refused the intents'; dead = true; clearInterval(hb); st.connected = false; return; }
    again(10e3);
  };
  ws.onerror = () => { st.error = st.error || 'cannot reach Discord'; };
}

let timer = null;
function start() {
  if (timer) return;
  const list = bots(); if (!list.length) return;   // nothing set up: nothing runs
  for (const b of list) connect(b);
  timer = setInterval(() => { for (const b of bots()) sendReplies(b).catch(e => { const s = live.get(b.name); if (s) s.error = String(e.message || e); }); }, POLL_MS);
  if (timer.unref) timer.unref();
}
// What the page may see: names, targets and state. Never the token.
// Setup page (AIG-482, AIG-483): the saved bots without their tokens, and saving them. A blank token keeps the one already saved
// under that name. Saving restarts the connections.
const config = () => bots().map(b => ({ name: b.name, users: b.users.join(', '), target: b.target, hasToken: true }));
function saveConfig(list) {
  if (!Array.isArray(list)) throw bad('bots must be a list');
  const old = Object.fromEntries(bots().map(b => [b.name.toLowerCase(), b.token]));
  const out = list.slice(0, 10).map((b, i) => {
    const name = String((b && b.name) || 'bot' + (i + 1)).trim().slice(0, 40) || 'bot' + (i + 1);
    const token = String((b && b.token) || '').trim() || old[name.toLowerCase()] || '';
    const users = String((b && b.users) || '').split(/[\s,;]+/).filter(Boolean);
    if (users.some(u => !/^\d{5,25}$/.test(u))) throw bad('a Discord user id is a number, 17 to 19 digits (see the guide, step 5)');
    if (!token) throw bad(name + ': paste the bot token');
    return { name, token, users, target: String((b && b.target) || '_watchman').trim() };
  });
  const s = localSettings(); s.discord = { bots: out };
  if (!out.length) delete s.discord;
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(s, null, 2));
  restart();
  return config();
}
function restart() {
  for (const st of live.values()) if (st.close) st.close();
  live.clear(); if (timer) { clearInterval(timer); timer = null; }
  start();
}
const status = () => bots().map(b => ({ name: b.name, target: b.target, users: b.users.length, connected: !!(live.get(b.name) || {}).connected, error: (live.get(b.name) || {}).error || '' }));
async function test(name) {
  const b = bots().find(x => x.name.toLowerCase() === String(name || '').toLowerCase()) || bots()[0];
  if (!b) throw Object.assign(new Error('no Discord bot set up'), { code: 404 });
  if (!b.users.length) throw Object.assign(new Error('add your Discord user id first'), { code: 400 });
  await dmUser(b, b.users[0], '👋 AI-gile test message: if you can read this, the bot works.');
  return { ok: true };
}

module.exports = { start, restart, config, saveConfig, status, test, bots, handleMessage, incoming, newReplies, sendReplies, chunks };
