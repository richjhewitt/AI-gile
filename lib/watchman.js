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
const { presenceOf, killTree, startTeam, logTail, agentCommand, spawnAgent, spawnHidden, whenGone } = require('./presence');
const { standupReport } = require('./standup');
const noTokens = require('./notokens');

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
  try { fs.unlinkSync(LAST); } catch {}   // a new night, a new chat
  setTimeout(() => { try { round(); } catch {} }, 30e3).unref();   // first check straight away, not in 10 minutes (AIG-222)
  return list;
}
// Stop watching and say what happened, per project.
// The night's chat stays, with what got done added as one last message, until the owner clears it (AIG-283).
const LAST = path.join(DATA, 'watchman.last');
const readLast = () => { try { return JSON.parse(fs.readFileSync(LAST, 'utf8')); } catch { return null; } };
function stopWatch() {
  const s = read(); if (!s) return null;
  const sum = summary(s);
  const lines = sum.map(x => `- **${x.name}**: ${x.handedOver} for you to test, ${x.done} done${x.stuck.length ? `, stuck: ${x.stuck.join(', ')}` : ''}`);
  const msgs = [...(s.msgs || []), { at: now(), author: NAME, text: `🌅 **The night** (since ${hhmm(s.since)})\n\n${lines.join('\n\n') || '- Nothing was watched'}` }];
  try { fs.writeFileSync(LAST, JSON.stringify({ since: s.since, ended: now(), msgs, readAt: s.readAt || '' })); } catch {}
  try { fs.unlinkSync(FILE); } catch {}
  return sum;
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
  if (noTokens.isOn()) { s.lastRound = now(); write(s); return status(); }   // ⛔ nothing wakes, nudges or starts (AIG-337)
  // After a restart: the teams that were at work carry on.
  for (const slug of s.wake || []) { const p = load(slug); if (p) try { startTeam(p, true, false, true, true); log(slug, 'woke'); } catch {} }
  delete s.wake;
  limitFromReadings(s);
  for (const slug of s.watch) checkTeam(s, slug, log);
  // 🤖 Night tests (AIG-292): once teams have handed work over, the AI tester checks it, at most every 3 hours, so in the
  // morning the passes wait with a 🤖 and the fails are already back with their team.
  try {
    const T = require('./tester');
    if (!(s.limitUntil && ago(s.limitUntil) < 0) && ago(lastEvent(s, '', ['tested'])) > 3 * 3600e3 && T.testsWaiting(s.watch).length && !T.testerStatus().running) { T.startTester(s.watch); log('', 'tested'); }
  } catch {}
  // A real 🚧 stand-up blocker in a watched project: worth one message.
  try { for (const b of standupReport().blockers.filter(b => s.watch.includes(b.project))) tell(s, `🚧 **${b.projectName}**: ${b.name} is blocked: ${b.text}`); } catch {}
  flush(s);
  s.lastRound = now();
  write(s);
  return status();
}
// One look at one team: what round() does for each watched project, and quickWake() every minute (AIG-277).
// A session idle in 'aigile wait' this long with work it can do gets a 🌙 nudge on the board, which ends its wait.
const IDLE_MS = +process.env.AIGILE_IDLE_MS || 5 * 60e3, NUDGE_GAP_MS = 15 * 60e3;
const lastEvent = (s, slug, kinds) => s.events.filter(e => e.project === slug && kinds.includes(e.kind)).map(e => e.at).pop();
const ago = at => at ? Date.now() - Date.parse(at) : Infinity;
// The plan's usage limit (AIG-283): a run that ends with "You've hit your session limit · resets 9:50am" isn't a failed
// try. The limit is the whole account's, so nobody is woken until the reset it names; then everyone carries on.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function limitHit(slug) {
  const lines = logTail(slug, 15).split('\n'), i = lines.map(l => /^=== \S+ started/.test(l)).lastIndexOf(true);
  if (i < 0) return null;
  const m = lines.slice(i + 1).join('\n').match(/hit your [\w-]*\s*limit[^\n]*?resets\s+([^\n(]+)/i); if (!m) return null;
  const start = new Date(lines[i].split(' ')[1]), t = m[1].match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i), mo = m[1].match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})\b/i);
  if (!t || isNaN(start)) return { until: new Date(Date.now() + 60 * 60e3).toISOString() };   // can't read it: look again in an hour
  const d = new Date(start), mi = mo ? MONTHS.indexOf(mo[1].toLowerCase()) : -1;
  if (mi >= 0) d.setMonth(mi, +mo[2]);
  d.setHours(+t[1] % 12 + (/pm/i.test(t[3]) ? 12 : 0), +(t[2] || 0) + 1, 0, 0);   // a minute after, to be safe
  if (mi < 0 && d <= start) d.setDate(d.getDate() + 1);
  return { until: d.toISOString() };
}
// From the plan's usage readings too (AIG-265): at 100% of the 5-hour or the weekly window, wait for its reset
// before a single run fails on it. Only a fresh reading counts.
function readingLimits() {
  let l; try { l = require('./limits').limitsHistory(1).latest; } catch { return []; }
  if (!l || ago(l.at) > 15 * 60e3) return [];
  const out = [];
  for (const w of [l.h5, l.wk]) {
    if (!w || w.pct < 100 || w.resets == null) continue;
    const r = new Date(typeof w.resets === 'number' && w.resets < 1e12 ? w.resets * 1000 : w.resets);
    if (isNaN(r) || r <= Date.now()) continue;
    out.push(new Date(+r + 60e3).toISOString());
  }
  return out;
}
// The reset time of the usage limit if it is hit right now (a fresh reading, or a team's run that ended on it), for No Token Mode (AIG-338).
function limitUntilNow() {
  const hits = readingLimits();
  for (const slug of listSlugs()) { if (presenceOf(slug).running) continue; const l = limitHit(slug); if (l && ago(l.until) < 0) hits.push(l.until); }
  return hits.sort().pop() || null;
}
function limitFromReadings(s) {
  for (const until of readingLimits()) {
    if (s.limitUntil && ago(s.limitUntil) < 0 && until <= s.limitUntil) continue;
    s.limitUntil = until; s.events.push({ at: now(), project: '', kind: 'limit' });
    tell(s, `⏳ The plan's usage limit is used up. Teams start again by themselves at ${hhmm(until)}.`);
  }
}
const hhmm = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function checkTeam(s, slug, log) {
  const p = load(slug); if (!p || p.archived || !p.path) return;
  if (s.limitUntil && ago(s.limitUntil) < 0) return;   // out of usage: everyone waits for the reset
  const pr = presenceOf(slug);
  const lim = !pr.online && limitHit(slug);
  if (lim && ago(lim.until) < 0) {
    s.limitUntil = lim.until; log(slug, 'limit');
    tell(s, `⏳ The plan's usage limit is used up. Teams start again by themselves at ${hhmm(lim.until)}.`);
    return;
  }
  if (pr.online) {   // working: leave them be, unless the session is only sitting in its wait
    const at = attention(p, { online: false });
    if (pr.waitingMs >= IDLE_MS && at && at.kind === 'asleep' && ago(lastEvent(s, slug, ['nudged'])) > NUDGE_GAP_MS) {
      const c = p.cards.filter(c => ['doing', 'todo'].includes(c.status)).sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority))[0];
      if (!c) return;
      c.comments.push({ author: NAME, wake: true, at: now(), text: `- 🌙 **Keep going**: you're idle with cards you can do\n\n- Work through To do, then backlog you can do without ${owner()}\n\n- Stop only for what truly needs ${owner()}` });
      c.updated = now(); save(p); log(slug, 'nudged', c.id);
    }
    return;
  }
  // A cut-off run: the team is gone but a card is still in progress.
  // A card already flagged stuck stops only itself (AIG-283): the team is still woken below for its other work.
  const mid = p.cards.filter(c => c.status === 'doing' && (s.restarts[slug + '/' + c.id] || 0) < MAX_RESTARTS).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
  if (mid && lim) {   // cut off by the usage limit, which has reset now: carry on, without counting it as a try
    try { startTeam(p, true, false, true, true); log(slug, 'restarted', mid.id); } catch {}
    return;
  }
  if (mid) {
    const n = (s.restarts[slug + '/' + mid.id] || 0) + 1;
    s.restarts[slug + '/' + mid.id] = n;
    if (n >= MAX_RESTARTS) {
      const tail = logTail(slug, 6).split('\n').slice(-6).join('\n');
      mid.comments.push({ author: NAME, text: `- 🌙 **Stuck**: the team stopped on this card ${n} times tonight, so I stopped restarting it\n- Last lines of their log:\n\`\`\`\n${tail || '(empty)'}\n\`\`\``, at: now() });
      mid.needsYou = true; mid.updated = now(); save(p);
      log(slug, 'stuck', mid.id);
      tell(s, `🔴 **${p.name}**: ${mid.id} "${mid.title}" is stuck. The team stopped on it ${n} times, so I stopped restarting it. It's in your pile.`);
      return;
    }
    mid.comments.push({ author: NAME, text: '- 🌙 Picked back up: this card was in progress when the team stopped. Carry on where you left off', at: now() });
    mid.updated = now(); save(p);
    try { startTeam(p, true, false, true, true); log(slug, 'restarted', mid.id); } catch {}
    return;
  }
  // Asleep with open work: wake them.
  const at = attention(p, pr);
  if (at && at.kind === 'asleep') { try { startTeam(p, true, false, true, true); log(slug, 'woke'); } catch {} return; }
  // Nobody sleeps but the owner (AIG-261): a team with only backlog left is woken too, to pick some up or plan
  // ahead; at most every 30 minutes, so a team that finds nothing it may do isn't woken over and over.
  if (p.cards.some(c => c.status === 'backlog') && ago(lastEvent(s, slug, ['woke'])) > 30 * 60e3)
    try { startTeam(p, true, false, true, true); log(slug, 'woke'); } catch {}
}
const PRIO = ['urgent', 'high', 'normal', 'low'];
// Checked every minute (AIG-269, AIG-277): every watched team gets the same look as in the 10-minute round, so a
// team that stopped with work (a card left in progress too) is started again within a minute or two. At most once
// every 3 minutes per team, so a run that has only just ended isn't started again on top of its last words.
const QUICK_GAP_MS = 3 * 60e3;
function quickWake(s) {
  if (noTokens.isOn()) return false;
  const n = s.events.length;
  limitFromReadings(s);
  for (const slug of s.watch) {
    if (ago(lastEvent(s, slug, ['woke', 'restarted'])) < QUICK_GAP_MS) continue;
    checkTeam(s, slug, (project, kind, card) => s.events.push({ at: now(), project, kind, ...(card ? { card } : {}) }));
  }
  return s.events.length > n;
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
// Last night's chat once quiet has ended (AIG-283), until cleared.
function lastNight() { if (read()) return null; const l = readLast(); return l && (l.msgs || []).length ? l.msgs : null; }
// Read up to (AIG-278): opening the chat marks its messages read, so the unread badge goes away.
const readAt = () => { const s = read() || readLast(); return (s && s.readAt) || ''; };
function markRead() {
  const s = read(); if (s) { s.readAt = now(); write(s); return; }
  const l = readLast(); if (l) { l.readAt = now(); try { fs.writeFileSync(LAST, JSON.stringify(l)); } catch {} }
}

// 🌙 The owner's one contact while quiet (AIG-262): an Opus agent in charge of every team lead. Each message starts a
// run in the AI-gile folder that makes it happen with the board's commands (wake teams, give leads orders, check),
// then answers in one short line (aigile watchsay). One run at a time: messages that arrive meanwhile go in the next.
// "Clear our chat" (AIG-256) stays instant and needs no run.
const ROOT = path.dirname(__dirname), WLOG = path.join(DATA, 'logs', '_watchman.log');
let wrun = null, pending = [];
function relay(text) {
  text = String(text || '').trim(); if (!text) throw bad('text is required');
  const clear = /^\W*(clear|wipe|empty)\b.*\b(chat|messages?|history)\W*$/i.test(text);
  const s = read();
  if (!s) { if (clear && readLast()) { try { fs.unlinkSync(LAST); } catch {} return { ok: true }; } throw bad('the watchman is only on while you are going quiet'); }
  s.msgs = s.msgs || [];
  if (clear) { s.msgs = []; write(s); return { ok: true }; }
  noTokens.guard();
  s.msgs.push({ at: now(), author: owner(), mine: true, text }); write(s);
  pending.push(text);
  if (!wrun) watchAgent();
  return { ok: true, working: true };
}
function watchAgent() {
  const s = read(); if (!s || !pending.length) return;
  if (noTokens.isOn()) { pending = []; return; }
  const asks = pending; pending = [];
  const me = owner(), cli = `node "${path.join(ROOT, 'aigile.js')}"`, recent = (s.msgs || []).slice(-8).map(m => `${m.author || NAME}: ${m.text}`).join('\n');
  const prompt = `You are the 🌙 Night watchman on ${me}'s AI-gile board. While ${me} sleeps you are in charge of every team lead. ${me} just wrote to you:\n${asks.map(a => '"' + a + '"').join('\n')}\n\nThe chat so far:\n${recent}\n\n`
    + `Make it happen now; don't just acknowledge it. Use the board commands: ${cli} brief <project> (see a project), ${cli} wake <project> --sprint (start its team working through To do), ${cli} add / comment ... --as "🌙 Watchman" (give a lead an order or new work), ${cli} list / show (check). `
    // Only the projects being watched (AIG-271): the others stay out of its brief, its actions and its replies.
    + `Projects you watch: ${s.watch.join(', ')}. Leave every other project alone and don't mention it. The leads write the code, not you. Never push, never restart the board. `
    // Quiet by default (AIG-273): the night glance shows what's working, so no routine reports.
    + `When done, answer ${me} in ONE short plain line with ${cli} watchsay "...": answer what ${me} asked, or name what only ${me} can unblock. Don't list who you woke or what is working: ${me} sees that on the night glance; for an order, a few words like "On it." are enough. Then stop.`;
  fs.mkdirSync(path.dirname(WLOG), { recursive: true });
  const fd = fs.openSync(WLOG, 'a'); fs.writeSync(fd, `=== ${new Date().toISOString()} started ===\n`);
  fs.closeSync(fd);
  // One line: a .cmd agent program goes through cmd.exe, where a line break ends the command.
  const args = ['--model', 'opus', '-p', prompt.replace(/\s*\n+\s*/g, ' / ')], env = { ...process.env, AIGILE_BACKGROUND: '1', AIGILE_AS: NAME };
  const run = wrun = {};
  const done = () => { if (wrun !== run) return; wrun = null; try { fs.appendFileSync(WLOG, '=== exited ===\n'); } catch {} if (pending.length) watchAgent(); };
  const failed = e => { done(); try { say(`⚠️ I couldn't start: ${e.message}`); } catch {} };
  try {
    // Hidden, and outliving a board restart (AIG-270, AIG-275); elsewhere detached does both.
    if (process.platform === 'win32') spawnHidden(agentCommand(), args, { cwd: ROOT, env, out: WLOG, err: WLOG }).then(pid => { run.pid = pid; if (run.stopped) killTree(pid); whenGone(pid, done); }, failed);
    else {
      const out = fs.openSync(WLOG, 'a'), child = spawnAgent(agentCommand(), args, { cwd: ROOT, detached: true, stdio: ['ignore', out, out], env });
      fs.closeSync(out); run.pid = child.pid; child.unref(); child.on('exit', done); child.on('error', failed);
    }
  } catch (e) { failed(e); }
}
// A line from the watchman agent into the chat (aigile watchsay).
function say(text) { const s = read(); if (!s) throw bad('the watchman is only on while you are going quiet'); s.msgs = s.msgs || []; s.msgs.push({ at: now(), author: NAME, text: String(text || '').trim() }); write(s); return { ok: true }; }
// ⛔ No Token Mode: end the watchman's agent run and drop what was waiting for it.
function stopAgent() { pending = []; if (wrun) { wrun.stopped = true; if (wrun.pid) killTree(wrun.pid); } }
const watchBusy = () => !!wrun || pending.length > 0;
// First round soon after the board starts (AIG-222): a restart mustn't push it back another 10 minutes.
function startWatchman(stale) {
  if (stale) isStale = stale;
  // Every minute, only the new-code check (AIG-241); the full round stays every 10 minutes.
  setInterval(() => { try { const s = read(); if (s && s.until && Date.now() >= Date.parse(s.until)) { require('./quiet').setQuiet(false, null, null, true); return; }   // wake-up time (AIG-232)
    if (s) { const was = JSON.stringify(s); if (!restartIfStale(s)) { quickWake(s); if (JSON.stringify(s) !== was) write(s); } } } catch {} }, 60e3).unref(); setTimeout(() => { try { round(); } catch {} }, 30e3).unref(); setInterval(() => { try { round(); } catch {} }, EVERY_MS).unref(); }

module.exports = { startWatch, stopWatch, round, quickWake: () => { const s = read(); if (!s) return null; const w = quickWake(s); write(s); return w; }, status, startWatchman, limitUntilNow, stopAgent, messages, lastNight, readAt, markRead, relay, say, watchBusy };
