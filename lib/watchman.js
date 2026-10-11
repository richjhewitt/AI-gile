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
const { presenceOf, startTeam, logTail } = require('./presence');
const { standupReport } = require('./standup');

const FILE = path.join(DATA, 'watchman.conf');
const EVERY_MS = +process.env.AIGILE_WATCH_MS || 10 * 60e3, MAX_RESTARTS = 3, NAME = '🌙 Watchman';
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; } };
const write = s => fs.writeFileSync(FILE, JSON.stringify(s, null, 1));
const active = () => listSlugs().map(load).filter(p => p && !p.archived);

// Start watching (called when the owner goes quiet). watch: the slugs to watch; none given = every active project.
function startWatch(watch, until) {
  const all = active().map(p => p.slug), list = Array.isArray(watch) && watch.length ? watch.filter(s => all.includes(s)) : all;
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
    if (at && at.kind === 'asleep') { try { startTeam(p, true, false, true); log(slug, 'woke'); } catch {} }
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
// The watchman's chat: its own messages, the owner's relayed ones, and the teams' answers on relayed cards (AIG-221).
function messages() {
  const s = read(); if (!s) return null;
  const answers = (s.relayed || []).flatMap(r => { const p = load(r.project), c = p && p.cards.find(x => x.id === r.card);
    return c ? c.comments.filter(m => m.author !== owner() && m.author !== NAME).map(m => ({ at: m.at, author: `${m.author} · ${p.name}`, text: m.text })) : []; });
  return [...(s.msgs || []), ...answers].sort((a, b) => a.at.localeCompare(b.at));
}

// 🌙 The owner's one contact while quiet (AIG-221): "tunio: …" goes to that team's lead, "all: …" to every watched
// team, as a 💬 card for the team; no name and the watchman asks which, with a button per team. No AI involved.
function relay(text) {
  const s = read(); if (!s) throw bad('the watchman is only on while you are going quiet');
  text = String(text || '').trim(); if (!text) throw bad('text is required');
  s.msgs = s.msgs || []; s.relayed = s.relayed || [];
  const me = owner(), watched = s.watch.map(load).filter(Boolean), norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  s.msgs.push({ at: now(), author: me, mine: true, text });
  const m = text.match(/^\s*([^:\n]{1,40}):\s*([\s\S]+)$/), name = m && norm(m[1]);
  const forTeam = m && (name === 'all' || watched.some(p => [p.slug, p.name, p.key].some(x => norm(x) === name)));
  // Orders for the watchman itself (AIG-226), plain words, no AI. A team named anywhere narrows it; else all.
  const named = watched.filter(p => [p.slug, p.name].some(x => norm(text).includes(norm(x)))), who = named.length ? named : watched;
  const say = t => { s.msgs.push({ at: now(), author: NAME, text: t }); write(s); return { ok: true, order: true }; };
  if (!forTeam) {
  if (/\b(status|report|how('?s| is| are)\b.*\b(going|doing)|what('?s| is) happening)\b/i.test(text))
    return say(summary(s).map(x => `- **${x.name}**: ${presenceOf(x.project).running ? 'working' : 'asleep'} · ${x.handedOver} to test · ${x.done} done` + (x.stuck.length ? ` · 🔴 stuck ${x.stuck.join(', ')}` : '')).join('\n') || 'Nothing watched.');
  if (/\brestart\b.*\bboard\b/i.test(text)) { s.events.push({ at: now(), project: '', kind: 'board-restarted' }); say('👍'); s.wake = listSlugs().filter(x => presenceOf(x).running); write(s); require('./update').restartBoard(); return { ok: true, order: true }; }
  if (/\b(check|look)\b.*\b(now|again)\b/i.test(text)) { write(s); round(); const t = read(); t.msgs.push({ at: now(), author: NAME, text: '👍' }); write(t); return { ok: true, order: true }; }
  if (/\b(wake|sprint|keep\b.*\b(going|working|sprinting)|get\b.*\b(going|working)|carry on)\b/i.test(text)) {
    const woke = [];
    for (const p of who) if (p.path && !presenceOf(p.slug).running) try { startTeam(p, true, false, true); s.events.push({ at: now(), project: p.slug, kind: 'woke' }); woke.push(p.name); } catch {}
    // Just a 👍 (AIG-231): no chat to read back at night; status still answers in full.
    return say('👍');
  }
  }
  const to = !m ? [] : name === 'all' ? watched : watched.filter(p => [p.slug, p.name, p.key].some(x => norm(x) === name));
  if (!to.length) {
    s.msgs.push({ at: now(), author: NAME, text: 'Which team is this for? (Or give me an order: **wake everyone**, **status**, **check now**, **restart the board**.)', pick: [...watched.map(p => ({ label: p.name, text: `${p.slug}: ${text}` })), { label: 'All', text: `all: ${text}` }] });
    write(s); return { ok: true, sent: [] };
  }
  const body = m[2].trim();
  for (const p of to) {
    const c = { id: p.key + '-' + p.nextId++, title: '💬 ' + body.split('\n')[0].slice(0, 80), description: body + '\n\n- (passed on by the 🌙 watchman)', testSteps: '', type: 'task', priority: 'normal', status: 'team',
      assignee: '', sprint: '', blocked: false, needsYou: false, quick: true, createdBy: me, created: now(), updated: now(), comments: [] };
    p.cards.push(c); save(p);
    s.relayed.push({ project: p.slug, card: c.id });
    try { startTeam(p); } catch {}
  }
  s.msgs.push({ at: now(), author: NAME, text: '👍' });
  write(s);
  return { ok: true, sent: to.map(p => p.slug) };
}
// First round soon after the board starts (AIG-222): a restart mustn't push it back another 10 minutes.
function startWatchman(stale) {
  if (stale) isStale = stale;
  // Every minute, only the new-code check (AIG-241); the full round stays every 10 minutes.
  setInterval(() => { try { const s = read(); if (s && s.until && Date.now() >= Date.parse(s.until)) { require('./quiet').setQuiet(false, null, null, true); return; }   // wake-up time (AIG-232)
    if (s) { const was = JSON.stringify(s); if (!restartIfStale(s) && JSON.stringify(s) !== was) write(s); } } catch {} }, 60e3).unref(); setTimeout(() => { try { round(); } catch {} }, 30e3).unref(); setInterval(() => { try { round(); } catch {} }, EVERY_MS).unref(); }

module.exports = { startWatch, stopWatch, round, status, startWatchman, messages, relay };
