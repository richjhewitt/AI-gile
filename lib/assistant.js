// 💚 Personal assistant (AIG-1021, AIG-1034): its own agent, separate from the 🧭 Lead Scrum Master. Plain rules first, free:
// "remind me at 3 to ..." makes a 🏡 reminder (leadchat.remind), "start my day" / "today" opens the Start my day check-in,
// "help" says what it does. Anything else starts the assistant's OWN hidden run (Sonnet, folder data/assistant with its brief as
// CLAUDE.md, notes in data/assistant/NOTES.md) that answers with `aigile pasay "..."`. Never via the Scrum Master.
// Same guards as the Scrum Master's runs: No AI, No Token Mode, token budget, usage saver, and its own daily cap.
// State (name, session, day's run count) in data/assistant.conf (not .json: every .json in data/ is a project). Messages in data/_assistant.chat.
const fs = require('fs');
const path = require('path');
const LC = require('./leadchat');
const { DATA, ROOT, owner, now, localSettings } = require('./store');
const ID = '_assistant', CARD = '_lead';   // the page groups a card-free chat under '_lead'
const tr = (k, v) => require('./i18n').t(k, v);
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const FILE = path.join(DATA, 'assistant.conf'), FOLDER = path.join(DATA, 'assistant');
const LOG = path.join(DATA, 'logs', '_assistant.log'), RAW = path.join(DATA, 'logs', '_assistant.raw');
const IDLE_MS = 60 * 60e3;
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {} };
const today = () => new Date().toLocaleDateString('sv');

// Its name: "💚 Personal assistant" until it (or Rich) picks one (aigile paname "Name").
const name = () => { const n = (read().name || '').trim(); return n ? '💚 ' + n : tr('pa.name'); };
function setName(n) {
  n = String(n || '').replace(/^\s*💚\s*/, '').trim().slice(0, 40); if (!n) throw bad('name is required');
  const s = read(); s.name = n; write(s); return { ok: true, name: name() };
}

function thread() {
  const s = LC.read(ID), nm = name();
  return { slug: ID, name: nm, lead: nm, emoji: '💚', assistant: true, busy: busy(), open: [], cards: { [CARD]: { title: tr('pa.tagline'), kind: 'other' } }, team: [], unread: 0,
    messages: s.msgs.map(m => ({ card: CARD, title: tr('pa.tagline'), author: m.author, text: m.text, at: m.at, mine: !!m.mine })) };
}
const say = text => LC.add(ID, name(), text, null, { board: true });

/* ---------- its brief and folder ---------- */
function role() {
  const me = owner(), cli = `node "${path.join(ROOT, 'aigile.js')}"`;
  return [
    `You are ${me}'s personal assistant (${name()}), a friendly helper for life admin, ${me}'s day, reminders, self-care and, if it is set up, a summary of their mail. You are NOT the Lead Scrum Master and you do not manage teams, projects or cards: that is the Lead Scrum Master's job. If ${me} asks for that, say so in one line.`,
    `Be friendly and short: one to three plain sentences. Each run starts with what ${me} just wrote to you. Answer it now.`,
    `Answer ${me} ONLY with ${cli} pasay "your answer" (it lands in your own chat). Then stop.`,
    `You MAY read the board with ${cli} list / brief <project> / show, and use the life-admin reminders (${cli} help lists them). You MAY NOT write code, push, change settings, or touch cards and teams.`,
    `If ${me} asks you to pick a name for yourself, choose one and set it with ${cli} paname "Name".`,
    `Keep things worth remembering about ${me} (preferences, routines, what helps them) in NOTES.md in this folder: read it at the start of a run, add short lines when you learn something.`,
  ].join(' ');
}
function folder() {
  fs.mkdirSync(path.join(FOLDER, '.claude'), { recursive: true });
  const md = path.join(FOLDER, 'CLAUDE.md'), text = `# 💚 Personal assistant\n\n${role()}\n`;
  let old = ''; try { old = fs.readFileSync(md, 'utf8'); } catch {}
  if (old !== text) fs.writeFileSync(md, text);
  const notes = path.join(FOLDER, 'NOTES.md'); if (!fs.existsSync(notes)) fs.writeFileSync(notes, `# Notes about ${owner()}\n\n`);
  const st = path.join(FOLDER, '.claude', 'settings.local.json');
  if (!fs.existsSync(st)) fs.writeFileSync(st, JSON.stringify({ permissions: { allow: ['Bash(node:*)'] } }, null, 2));
  return FOLDER;
}

/* ---------- guards: the plain reason an AI run may not start, or null ---------- */
const cap = () => { const n = parseInt((localSettings().assistant || {}).aiRunsPerDay, 10); return Number.isFinite(n) && n >= 0 && n <= 200 ? n : 30; };
function blocked() {
  if (require('./noai').isOn()) return tr('srv.pa.off.noai');
  if (require('./notokens').isOn()) return tr('srv.pa.off.notokens');
  try { const over = require('./budget').overBudget(); if (over) return tr('srv.pa.off.budget', { why: over }); } catch {}
  try { if (require('./budget').saving()) return tr('srv.pa.off.saver'); } catch {}
  const s = read(); if (s.day === today() && (s.runs || 0) >= cap()) return tr('srv.pa.off.capped', { cap: cap() });
  return null;
}

/* ---------- the run (the Scrum Master's machinery: presence's hidden spawn, hang watchdog, usage log) ---------- */
let run = null, pending = [];
const busy = () => !!run || pending.length > 0;
function session() {
  const s = read(), resume = !!(s.session && Date.now() - Date.parse(s.session.at) < IDLE_MS);
  if (!resume) s.session = { id: require('crypto').randomUUID(), at: now() };
  write(s); return { resume, id: s.session.id };
}
function start() {
  if (run || !pending.length) return;
  const asks = pending; pending = [];
  const why = blocked(); if (why) { say(why); return; }
  const P = require('./presence'), s = read();
  if (s.day !== today()) { s.day = today(); s.runs = 0; }
  s.runs = (s.runs || 0) + 1; write(s);
  const sess = session(), me = owner();
  const recent = LC.read(ID).msgs.slice(-8).map(m => `${m.mine ? me : name()}: ${m.text}`).join(' / ');
  const prompt = `${me} wrote: ${asks.map(a => '"' + a + '"').join(' ')}` + (sess.resume ? '' : ` The chat so far: ${recent}`);
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `=== ${new Date().toISOString()} started (sonnet, ${sess.resume ? 'resumed' : 'fresh'}) ===\n`); fs.writeFileSync(RAW, '');
  const args = ['--model', 'sonnet', '-p', prompt.replace(/\s*\n+\s*/g, ' / '), '--output-format', 'stream-json', '--verbose', ...(sess.resume ? ['--resume', sess.id] : ['--session-id', sess.id])];
  const env = { ...process.env, AIGILE_BACKGROUND: '1', AIGILE_AS: name(), AIGILE_ROLE: 'assistant' };
  const r = run = { off: 0, startedAt: Date.now() };
  const tail = all => {
    try {
      const size = fs.statSync(RAW).size; if (size <= r.off) return;
      const b = Buffer.alloc(size - r.off), fd = fs.openSync(RAW, 'r'); try { fs.readSync(fd, b, 0, b.length, r.off); } finally { fs.closeSync(fd); }
      const str = b.toString('utf8'), end = all ? str.length : str.lastIndexOf('\n') + 1; if (!end) return;
      const txt = str.slice(0, end).split(/\r?\n/).flatMap(l => P.readable(l)).join('\n'); if (txt) fs.appendFileSync(LOG, txt + '\n');
      r.off += Buffer.byteLength(str.slice(0, end));
    } catch {}
  };
  const done = why => {
    if (run !== r) return; run = null; clearInterval(r.timer); tail(true);
    try { const q = read(); if (q.session) { q.session.at = now(); write(q); } } catch {}
    try { fs.appendFileSync(LOG, `=== exited${why ? ' ' + why : ''} ===\n`); } catch {}
    try { require('./usage').logRun('assistant', ID, { folder: FOLDER, start: r.startedAt, log: LOG }); } catch {}
    if (pending.length) start();
  };
  r.timer = setInterval(() => {   // hang watchdog: no new log line for too long, so it is stopped
    tail();
    if (!r.pid || !P.silent(RAW, r)) return;
    r.stopped = true; P.killTree(r.pid);
    try { fs.appendFileSync(LOG, `=== hung: no new log lines for ${Math.round(P.HANG_MS / 60e3)} min ===\n`); } catch {}
    done('hung'); try { say(tr('srv.pa.hung')); } catch {}
  }, 1000);
  r.timer.unref();
  const failed = e => { done('error'); try { say(tr('srv.pa.failed', { why: e.message || String(e) })); } catch {} };
  try {
    const cwd = folder();
    if (process.platform === 'win32') P.spawnHidden(P.agentCommand(), args, { cwd, env, out: RAW, err: RAW }).then(pid => { r.pid = pid; if (r.stopped) P.killTree(pid); P.whenGone(pid, () => done()); }, failed);
    else {
      const out = fs.openSync(RAW, 'a'), child = P.spawnAgent(P.agentCommand(), args, { cwd, detached: true, stdio: ['ignore', out, out], env });
      fs.closeSync(out); r.pid = child.pid; child.unref(); child.on('exit', () => done()); child.on('error', failed);
    }
  } catch (e) { failed(e); }
}
// No Token Mode ends its run too (lib/notokens.js).
function stop() { pending = []; if (run) { run.stopped = true; if (run.pid) require('./presence').killTree(run.pid); } }

function handle(text) {
  text = String(text || '').trim(); if (!text) throw bad('text is required');
  const me = owner();
  LC.add(ID, me, text);
  if (LC.remind(ID, me, text)) return { ok: true };   // the reminder's confirmation is in the chat
  if (/^\W*(start (of )?my day|today)\W*$/i.test(text)) { say(tr('srv.pa.day')); return { ok: true, openDay: true }; }
  if (/^\W*help\W*$/i.test(text)) { say(tr('srv.pa.help')); return { ok: true }; }
  const why = blocked(); if (why) { say(why); return { ok: true, auto: true }; }
  pending.push(text); start();
  return { ok: true, working: true };
}
// The assistant's own answer (aigile pasay).
function reply(text) {
  text = String(text || '').trim(); if (!text) throw bad('text is required');
  say(text); return { ok: true };
}
module.exports = { ID, thread, handle, reply, name, setName, stop, busy, folder, role };
