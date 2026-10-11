// 🌙 Night watchman (AIG-199): while the owner is "going quiet", the board itself (no AI, no tokens) checks the
// projects they picked every 10 minutes:
//   - a team that stopped with a card still in progress (a cut-off run) is started again, with a note on the card;
//     the third time for the same card it stops trying and puts the card in the owner's pile as stuck
//   - a team asleep with open work is woken
// Everything it does is kept, and "back from quiet" returns a summary per project.
// State lives in data/watchman.conf (not .json: every .json in data/ is a project).
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs, attention, owner, bad } = require('./store');
const { presenceOf, startTeam, logTail, agentCommand, spawnAgent } = require('./presence');
const { standupReport } = require('./standup');

const FILE = path.join(DATA, 'watchman.conf');
const EVERY_MS = +process.env.AIGILE_WATCH_MS || 10 * 60e3, MAX_RESTARTS = 3, NAME = '🌙 Watchman';
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; } };
const write = s => fs.writeFileSync(FILE, JSON.stringify(s, null, 1));
const active = () => listSlugs().map(load).filter(p => p && !p.archived);

// Start watching (called when the owner goes quiet). watch: the slugs to watch; none given = every active project.
// An empty list means none (AIG-235: quiet nights, nothing ticked).
function startWatch(watch, until) {
  const all = active().map(p => p.slug), list = Array.isArray(watch) ? watch.filter(s => all.includes(s)) : all;
  write({ since: now(), watch: list, restarts: {}, events: [], lastRound: null, ...(until ? { until } : {}) });
  setTimeout(() => { try { round(); } catch {} }, 30e3).unref();   // first check straight away, not in 10 minutes (AIG-222)
  return list;
}
// Stop watching and say what happened, per project.
function stopWatch() {
  const s = read(); if (!s) return null;
  try { fs.unlinkSync(FILE); } catch {}
  return summary(s);
}
function summary(s) {
  return s.watch.map(slug => {
    const p = load(slug); if (!p) return null;
    const ev = s.events.filter(e => e.project === slug), count = k => ev.filter(e => e.kind === k).length;
    const after = c => (c.updated || '') > s.since;
    return { project: slug, name: p.name, handedOver: p.cards.filter(c => c.status === 'verify' && after(c)).length, done: p.cards.filter(c => c.status === 'done' && after(c)).length,
      woke: count('woke'), restarted: [...new Set(ev.filter(e => e.kind === 'restarted').map(e => e.card))], stuck: [...new Set(ev.filter(e => e.kind === 'stuck').map(e => e.card))] };
  }).filter(Boolean);
}
const status = () => { const s = read(); return s ? { since: s.since, until: s.until || null, watch: s.watch, lastRound: s.lastRound, summary: summary(s) } : null; };

// New board code while the owner sleeps (AIG-224): restart the board, checked every minute (AIG-241), as soon as no team
// is mid-run; at most 20 minutes later even if one is (AIG-242: restarting at once cut every team off mid-run). The teams that were running are woken again by the new board's first round.
let isStale = () => false;
const STALE_WAIT_MS = 20 * 60e3;
function restartIfStale(s) {
  if (!isStale()) { delete s.staleSince; return false; }
  s.staleSince = s.staleSince || now();
  const running = listSlugs().filter(x => presenceOf(x).running);
  if (running.length && Date.now() - Date.parse(s.staleSince) < STALE_WAIT_MS) return false;
  s.wake = [...new Set([...(s.wake || []), ...running])]; delete s.staleSince;
  s.events.push({ at: now(), project: '', kind: 'board-restarted' });
  write(s);
  require('./update').restartBoard();
  return true;
}

// One round: what a careful person would do every few minutes.
function round() {
  const s = read(); if (!s) return null;
  const log = (project, kind, card) => s.events.push({ at: now(), project, kind, ...(card ? { card } : {}) });
  if (restartIfStale(s)) return status();
  // After a restart: the teams that were at work carry on.
  for (const slug of s.wake || []) { const p = load(slug); if (p) try { startTeam(p, true, false, true); log(slug, 'woke'); } catch {} }
  delete s.wake;
  for (const slug of s.watch) {
    const p = load(slug); if (!p || p.archived || !p.path) continue;
    const pr = presenceOf(slug); if (pr.online) continue;   // working: leave them be
    // A cut-off run: the team is gone but a card is still in progress.
    const mid = p.cards.filter(c => c.status === 'doing').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
    if (mid) {
      if ((s.restarts[slug + '/' + mid.id] || 0) >= MAX_RESTARTS) continue;   // already flagged stuck: leave it for the owner
      const n = (s.restarts[slug + '/' + mid.id] || 0) + 1;
      s.restarts[slug + '/' + mid.id] = n;
      if (n >= MAX_RESTARTS) {
        const tail = logTail(slug, 6).split('\n').slice(-6).join('\n');
        mid.comments.push({ author: NAME, text: `- 🌙 **Stuck**: the team stopped on this card ${n} times tonight, so I stopped restarting it\n- Last lines of their log:\n\`\`\`\n${tail || '(empty)'}\n\`\`\``, at: now() });
        mid.needsYou = true; mid.updated = now(); save(p);
        log(slug, 'stuck', mid.id);
        tell(s, `🔴 **${p.name}**: ${mid.id} "${mid.title}" is stuck. The team stopped on it ${n} times, so I stopped restarting it. It's in your pile.`);
        continue;
      }
      mid.comments.push({ author: NAME, text: '- 🌙 Picked back up: this card was in progress when the team stopped. Carry on where you left off', at: now() });
      mid.updated = now(); save(p);
      try { startTeam(p, true, false, true); log(slug, 'restarted', mid.id); } catch {}
      continue;
    }
    // Asleep with open work: wake them.
    const at = attention(p, pr);
    if (at && at.kind === 'asleep') { try { startTeam(p, true, false, true); log(slug, 'woke'); } catch {} continue; }
    // Nobody sleeps but the owner (AIG-261): a team with only backlog left is woken too, to pick some up or plan
    // ahead; at most every 30 minutes, so a team that finds nothing it may do isn't woken over and over.
    const lastWoke = s.events.filter(e => e.project === slug && e.kind === 'woke').map(e => e.at).pop();
    if (!pr.online && p.cards.some(c => c.status === 'backlog') && (!lastWoke || Date.now() - Date.parse(lastWoke) > 30 * 60e3))
      try { startTeam(p, true, false, true); log(slug, 'woke'); } catch {}
  }
  // A real 🚧 stand-up blocker in a watched project: worth one message.
  try { for (const b of standupReport().blockers.filter(b => s.watch.includes(b.project))) tell(s, `🚧 **${b.projectName}**: ${b.name} is blocked: ${b.text}`); } catch {}
  flush(s);
  s.lastRound = now();
  write(s);
  return status();
}
// The watchman's DM (AIG-211): a message only for something critical, and never the same one twice.
// At most one an hour (AIG-230): critical things wait in a queue and go out together as one message.
const ALERT_EVERY_MS = 60 * 60e3;
function tell(s, text) { s.msgs = s.msgs || []; s.queue = s.queue || []; if (!s.msgs.some(m => (m.lines || [m.text]).includes(text)) && !s.queue.includes(text)) s.queue.push(text); }
function flush(s) {
  if (!(s.queue || []).length) return;
  const last = (s.msgs || []).filter(m => m.alert).map(m => m.at).sort().pop();
  if (last && Date.now() - Date.parse(last) < ALERT_EVERY_MS) return;
  s.msgs.push({ at: now(), alert: true, lines: s.queue, text: s.queue.join('\n\n') }); s.queue = [];
}
// The watchman's chat: its own messages and the owner's. The teams' replies to passed-on messages wait in their lead's
// chat for the morning (AIG-255: only something critical should reach the owner at night).
function messages() { const s = read(); return s ? s.msgs || [] : null; }

// 🌙 The owner's one contact while quiet (AIG-262): an Opus agent in charge of every team lead. Each message starts a
// run in the AI-gile folder that makes it happen with the board's commands (wake teams, give leads orders, check),
// then answers in one short line (aigile watchsay). One run at a time: messages that arrive meanwhile go in the next.
// "Clear our chat" (AIG-256) stays instant and needs no run.
const ROOT = path.dirname(__dirname), WLOG = path.join(DATA, 'logs', '_watchman.log');
let wrun = null, pending = [];
function relay(text) {
  const s = read(); if (!s) throw bad('the watchman is only on while you are going quiet');
  text = String(text || '').trim(); if (!text) throw bad('text is required');
  s.msgs = s.msgs || [];
  if (/^\W*(clear|wipe|empty)\b.*\b(chat|messages?|history)\W*$/i.test(text)) { s.msgs = []; write(s); return { ok: true }; }
  s.msgs.push({ at: now(), author: owner(), mine: true, text }); write(s);
  pending.push(text);
  if (!wrun) watchAgent();
  return { ok: true, working: true };
}
function watchAgent() {
  const s = read(); if (!s || !pending.length) return;
  const asks = pending; pending = [];
  const me = owner(), cli = `node "${path.join(ROOT, 'aigile.js')}"`, recent = (s.msgs || []).slice(-8).map(m => `${m.author || NAME}: ${m.text}`).join('\n');
  const prompt = `You are the 🌙 Night watchman on ${me}'s AI-gile board. While ${me} sleeps you are in charge of every team lead. ${me} just wrote to you:\n${asks.map(a => '"' + a + '"').join('\n')}\n\nThe chat so far:\n${recent}\n\n`
    + `Make it happen now; don't just acknowledge it. Use the board commands: ${cli} brief <project> (see a project), ${cli} wake <project> --sprint (start its team working through To do), ${cli} add / comment ... --as "🌙 Watchman" (give a lead an order or new work), ${cli} list / show (check). `
    + `Projects: ${listSlugs().map(load).filter(p => p && !p.archived).map(p => p.slug).join(', ')}. The leads write the code, not you. Never push, never restart the board. `
    + `When done, answer ${me} in ONE short plain line: ${cli} watchsay "what you did, or what only ${me} can unblock". Then stop.`;
  fs.mkdirSync(path.dirname(WLOG), { recursive: true });
  const fd = fs.openSync(WLOG, 'a'); fs.writeSync(fd, `=== ${new Date().toISOString()} started ===\n`);
  try {
    // One line: a .cmd agent program goes through cmd.exe, where a line break ends the command.
    const child = spawnAgent(agentCommand(), ['-p', prompt.replace(/\s*\n+\s*/g, ' | '), '--model', 'opus'], { cwd: ROOT, windowsHide: true, stdio: ['ignore', fd, fd], env: { ...process.env, AIGILE_BACKGROUND: '1', AIGILE_AS: NAME } });
    wrun = child;
    const done = () => { if (wrun !== child) return; wrun = null; try { fs.appendFileSync(WLOG, '=== exited ===\n'); } catch {} if (pending.length) watchAgent(); };
    child.on('exit', done); child.on('error', done);
  } catch (e) { say(`⚠️ I couldn't start: ${e.message}`); }
  fs.closeSync(fd);
}
// A line from the watchman agent into the chat (aigile watchsay).
function say(text) { const s = read(); if (!s) throw bad('the watchman is only on while you are going quiet'); s.msgs = s.msgs || []; s.msgs.push({ at: now(), author: NAME, text: String(text || '').trim() }); write(s); return { ok: true }; }
const watchBusy = () => !!wrun || pending.length > 0;
// First round soon after the board starts (AIG-222): a restart mustn't push it back another 10 minutes.
function startWatchman(stale) {
  if (stale) isStale = stale;
  // Every minute, only the new-code check (AIG-241); the full round stays every 10 minutes.
  setInterval(() => { try { const s = read(); if (s && s.until && Date.now() >= Date.parse(s.until)) { require('./quiet').setQuiet(false, null, null, true); return; }   // wake-up time (AIG-232)
    if (s) { const was = JSON.stringify(s); if (!restartIfStale(s) && JSON.stringify(s) !== was) write(s); } } catch {} }, 60e3).unref(); setTimeout(() => { try { round(); } catch {} }, 30e3).unref(); setInterval(() => { try { round(); } catch {} }, EVERY_MS).unref(); }

module.exports = { startWatch, stopWatch, round, status, startWatchman, messages, relay, say, watchBusy };
