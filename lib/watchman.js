// 🌙 Night watchman (AIG-199): while the owner is "going quiet", the board itself (no AI, no tokens) checks the
// projects they picked every 10 minutes:
//   - a team that stopped with a card still in progress (a cut-off run) is started again, with a note on the card;
//     the third time for the same card it stops trying and puts the card in the owner's pile as stuck
//   - a team asleep with open work is woken
// Everything it does is kept, and "back from quiet" returns a summary per project.
// State lives in data/watchman.conf (not .json: every .json in data/ is a project).
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs, attention, owner, bad, waitingOnRich } = require('./store');
const { expireLead, presenceOf, killTree, leadActive, startTeam, logTail, agentCommand, spawnAgent, spawnHidden, whenGone } = require('./presence');
const { standupReport } = require('./standup');
const noTokens = require('./notokens');
const dmrules = require('./dmrules');
const { t: tr } = require('./i18n');

const FILE = path.join(DATA, 'watchman.conf');
const EVERY_MS = +process.env.AIGILE_WATCH_MS || 0, MAX_RESTARTS = 3, NAME = '🧭 Lead Scrum Master';   // the night watchman grew into it (AIG-359); EVERY_MS: tests only (the round follows the push scale, AIG-1446)
const TICK_MS = +process.env.AIGILE_WATCH_TICK_MS || 60e3;   // the every-minute look (tests: shorter)
// AIG-1446: a failure in the watchman is written down (data/logs/_watchman.log, and the glance) instead of vanishing in a catch {}.
const WMLOG = path.join(DATA, 'logs', '_watchman.log');
function logErr(where, e) {
  try { fs.mkdirSync(path.dirname(WMLOG), { recursive: true }); fs.appendFileSync(WMLOG, `=== ${new Date().toISOString()} ${where}: ${(e && (e.stack || e.message)) || e} ===\n`); } catch {}
}
function failed(where, e) {
  logErr(where, e);
  try { const s = read(); if (s) { s.lastError = { at: now(), where, msg: String((e && e.message) || e).slice(0, 200) }; write(s); } } catch {}
}
// AIG-1170: this file and watchman.last hold the Lead Scrum Master's chat, so both are sealed on disk (lib/atrest.js): old plaintext
// still reads and is sealed on the next write; a file that cannot be opened (the key is missing) is refused, never read as empty.
const A = require('./atrest');
const read = () => A.readJson(FILE, null);
const write = s => A.writeText(FILE, JSON.stringify(s));
const active = () => listSlugs().map(load).filter(p => p && !p.archived);

// Start watching (called when the owner goes quiet). watch: the slugs to watch; none given = every active project.
// An empty list means none (AIG-235: quiet nights, nothing ticked).
function startWatch(watch, until) {
  const act = active(), all = act.map(p => p.slug);
  // 🪐 Watching a space watches the projects inside it too (AIG-437), at any depth.
  const inside = s => act.filter(p => p.parent === s).flatMap(p => [p.slug, ...inside(p.slug)]);
  const list = Array.isArray(watch) ? [...new Set(watch.filter(s => all.includes(s)).flatMap(s => [s, ...inside(s)]))] : all;
  const day = readLast() || {};   // one chat by day and by night (AIG-359): the day's messages carry on into the night
  write({ since: now(), watch: list, restarts: {}, events: [], lastRound: null, msgs: day.msgs || [], readAt: day.readAt || '', ...(until ? { until } : {}) });
  try { fs.unlinkSync(LAST); } catch {}
  setTimeout(() => { try { round(); } catch (e) { failed('round', e); } }, 30e3).unref();   // first check straight away, not in 10 minutes (AIG-222)
  return list;
}
// Stop watching and say what happened, per project.
// The night's chat stays, with what got done added as one last message, until the owner clears it (AIG-283).
const LAST = path.join(DATA, 'watchman.last');
const readLast = () => A.readJson(LAST, null);
function stopWatch(plain) {   // plain (AIG-395): focus mode ended, so the chat stays but no "The night" message is added
  const s = read(); if (!s) return null;
  const sum = summary(s);
  // AIG-1051: only projects picked for today (not in Today's left-out list), and only those where something happened
  let left = []; try { left = require('./today').view().left || []; } catch {}
  const lines = sum.filter(x => !left.includes(x.project) && (x.handedOver || x.done || x.stuck.length)).map(x => tr('srv.night.line', { name: x.name, handed: x.handedOver, done: x.done }) + (x.stuck.length ? tr('srv.night.stuck', { list: x.stuck.join(', ') }) : ''));
  const msgs = plain ? (s.msgs || []) : [...(s.msgs || []), { at: now(), author: NAME, text: tr('srv.night.head', { time: hhmm(s.since), lines: lines.join('\n\n') || tr('srv.night.none') }) }];
  try { A.writeText(LAST, JSON.stringify({ since: s.since, ended: now(), msgs, readAt: s.readAt || '' })); } catch (e) { if (e.atrest) throw e; }   // AIG-1170: refused (no key): the night's chat stays where it is
  try { fs.unlinkSync(FILE); } catch {}
  return sum;
}
function summary(s) {
  return s.watch.map(slug => {
    const p = load(slug); if (!p) return null;
    const ev = s.events.filter(e => e.project === slug), count = k => ev.filter(e => e.kind === k).length;
    const after = c => (c.updated || '') > s.since;
    return { project: slug, name: p.name, handedOver: p.cards.filter(c => c.status === 'verify' && after(c)).length, done: p.cards.filter(c => c.status === 'done' && after(c)).length,
      woke: count('woke'), poked: count('poked'), refilled: count('refilled'), restarted: [...new Set(ev.filter(e => e.kind === 'restarted').map(e => e.card))], stuck: [...new Set(ev.filter(e => e.kind === 'stuck').map(e => e.card))].filter(id => (p.cards.find(c => c.id === id) || {}).status !== 'done') };   // AIG-989
  }).filter(Boolean);
}
// AIG-1446: lastCheck is the last real look (the every-minute one included); everyMin the pace it keeps; last what it last did;
// why per project: a team that wasn't woken, and why (its lead is in a session, out of usage until, it chose to wait...).
const lastDone = s => { const e = (s.events || []).filter(e => ['woke', 'restarted', 'poked', 'nudged', 'stuck', 'refilled', 'limit', 'board-restarted'].includes(e.kind)).pop(); return e || null; };
function view(s) {
  return { since: s.since, until: s.until || null, watch: s.watch, lastRound: s.lastRound, lastCheck: s.lastCheck || s.lastRound || null, everyMin: everyMin(),
    last: lastDone(s), lastError: s.lastError || null, why: s.why || {}, limitUntil: s.limitUntil && ago(s.limitUntil) < 0 ? s.limitUntil : null, summary: summary(s) };
}
const status = () => { let s; try { s = read(); } catch (e) { if (e.atrest) return null; throw e; } return s ? view(s) : null; };
// For the project payloads (the top bar): is it watched tonight, and if its team isn't running, why. Read at most every 2 s.
let memo = { at: 0, s: null };
function nightOf(slug) {
  if (Date.now() - memo.at > 2000) { let s = null; try { s = read(); } catch {} memo = { at: Date.now(), s }; }
  const s = memo.s; if (!s || !(s.watch || []).includes(slug)) return null;
  const w = (s.why || {})[slug];
  return { watched: true, lastCheck: s.lastCheck || s.lastRound || null, everyMin: everyMin(), ...(w ? { why: w } : {}), ...(s.limitUntil && ago(s.limitUntil) < 0 ? { limitUntil: s.limitUntil } : {}) };
}

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
function round(timed) {   // timed (AIG-1446): from the tick, so a team woken only just now is not woken again on top of its last words
  const s = read(); if (!s) return null;
  const log = (project, kind, card) => s.events.push({ at: now(), project, kind, ...(card ? { card } : {}) });
  if (restartIfStale(s)) return status();
  if (noTokens.isOn()) { s.lastRound = s.lastCheck = now(); s.why = Object.fromEntries(s.watch.map(x => [x, { at: now(), why: 'notokens' }])); write(s); return status(); }   // ⛔ nothing wakes, nudges or starts (AIG-337)
  // After a restart: the teams that were at work carry on.
  for (const slug of s.wake || []) { const p = load(slug); if (p) wake(s, p, log, 'woke'); }
  delete s.wake;
  limitFromReadings(s);
  // AIG-1446: one project's failure is written down and the others still get their look (it used to end the whole round)
  for (const slug of require('./today').order(s.watch)) { if (timed && ago(lastEvent(s, slug, ['woke', 'restarted'])) < wakeGapMs()) continue; try { checkTeam(s, slug, log); } catch (e) { logErr('check ' + slug, e); (s.why = s.why || {})[slug] = { at: now(), why: 'error', msg: String(e.message || e).slice(0, 200) }; } }   // AIG-596: 🔥 projects first
  for (const slug of require('./today').order(s.watch)) { try { if (refill(s, slug, log)) wake(s, load(slug), log, 'woke'); } catch (e) { logErr('refill ' + slug, e); } }   // AIG-478
  try { autoPoke(s, log); } catch (e) { logErr('autopoke', e); }
  // 🤖 Night tests (AIG-292): once teams have handed work over, the AI tester checks it, at most every 3 hours, so in the
  // morning the passes wait with a 🤖 and the fails are already back with their team.
  try {
    const T = require('./tester');
    if (!(s.limitUntil && ago(s.limitUntil) < 0) && ago(lastEvent(s, '', ['tested'])) > 3 * 3600e3 && T.testsWaiting(s.watch).length && !T.testerStatus().running) { T.startTester(s.watch); log('', 'tested'); }
  } catch (e) { logErr('tester', e); }
  // A real 🚧 stand-up blocker in a watched project: worth one message.
  try { for (const b of standupReport().blockers.filter(b => s.watch.includes(b.project))) tell(s, tr('srv.blocked', { project: b.projectName, name: b.name, text: b.text })); } catch (e) { logErr('blockers', e); }
  flush(s);
  s.lastRound = s.lastCheck = now(); delete s.lastError;
  write(s);
  return status();
}
// 🌙 Keep the flow going (AIG-478): a watched team whose To do and Doing are both empty pulls its next ready backlog cards
// (urgent and high first, at most REFILL of them) and says so as an assumption, so the owner can plug any wrong guess.
// Ready = nothing waits on the owner, not blocked, not waiting on other cards, not the owner's own or a real-life task.
const REFILL = 2, PR = { urgent: 0, high: 1, normal: 2, low: 3 };
function refill(s, slug, log) {
  const p = load(slug); if (!p || p.archived) return 0;
  const cards = p.cards || [];
  if (cards.some(c => (c.status === 'todo' || c.status === 'doing') && c.approval !== 'waiting')) return 0;
  const ok = c => c.status === 'backlog' && c.approval !== 'waiting' && !c.needsYou && !c.blocked && !(c.waiting && c.waiting.length) && !c.lifeType && !c.outside && !c.server
    && !(c.assignee && String(c.assignee).trim().toLowerCase() === String(owner()).toLowerCase()) && (c.priority === 'urgent' || c.priority === 'high');
  const pick = cards.filter(ok).sort((a, b) => (PR[a.priority] ?? 2) - (PR[b.priority] ?? 2)).slice(0, REFILL);
  for (const c of pick) {
    c.status = 'todo'; c.updated = now();
    (c.comments = c.comments || []).push({ author: NAME, mark: 'assume', at: now(), text: tr('srv.assume.refill', { priority: tr('priority.' + c.priority) }) });
    log(slug, 'refilled', c.id);
  }
  if (pick.length) save(p);
  if (!pick.length && (require('./store').localSettings().night || {}).planBig) return planBig(p, slug, log);
  return pick.length;
}
// 🧩 Plan a big card (AIG-480; a switch in Setup, off by default, since it costs tokens). Nothing ready to refill: the biggest
// backlog card that needs no answer from the owner goes to To do with a note asking the lead to break it into small cards
// with test steps. One per night per project; a card is only put up once.
function planBig(p, slug, log) {
  const today = new Date().toISOString().slice(0, 10);
  if (p.plannedNight === today) return 0;
  const size = c => String(c.description || '').length + (c.testSteps ? 0 : 200);
  const c = (p.cards || []).filter(c => c.status === 'backlog' && !c.needsYou && !c.blocked && !c.lifeType && !c.outside && !c.server && !c.planAsked
    && !(c.waiting && c.waiting.length) && !(c.assignee && String(c.assignee).trim().toLowerCase() === String(owner()).toLowerCase()))
    .sort((a, b) => (PR[a.priority] ?? 2) - (PR[b.priority] ?? 2) || size(b) - size(a))[0];
  if (!c) return 0;
  c.status = 'todo'; c.planAsked = true; c.updated = now(); p.plannedNight = today;
  (c.comments = c.comments || []).push({ author: NAME, mark: 'assume', at: now(), text: tr('srv.assume.planbig') });
  log(slug, 'planbig', c.id);
  save(p);
  return 1;
}
// One look at one team: what round() does for each watched project, and quickWake() every minute (AIG-277).
// A session idle in 'aigile wait' this long with work it can do gets a 🌙 nudge on the board, which ends its wait.
const IDLE_MS = +process.env.AIGILE_IDLE_MS || 5 * 60e3;
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
    tell(s, tr('srv.limit', { time: hhmm(until) }));
  }
}
const hhmm = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
// AIG-1446: the pace follows the Scrum Master's push scale (lib/scrummaster.js PUSH, the one table): everyMin is how often a
// watched team is looked at and woken (Crack the whip: 2 min). Env overrides are for tests.
const everyMin = () => { try { const sm = require('./scrummaster'); return sm.PUSH[sm.pushLevel()].everyMin; } catch { return 10; } };
const roundMs = () => EVERY_MS || everyMin() * 60e3;   // the full round (tester, blockers, refill)
const wakeGapMs = () => +process.env.AIGILE_QUICK_GAP_MS || Math.min(3, everyMin()) * 60e3;   // at most this often per team
const nudgeGapMs = () => Math.max(IDLE_MS, Math.min(15, everyMin()) * 60e3);   // an idle session: nudged again after this long
// A team that ran IDLE_RUNS times in a row and moved no card has decided to wait (the glance says so, with its own words):
// it is still woken, but at the steady pace (10 min), so a team that found nothing it may do doesn't spend all night on it.
const IDLE_RUNS = 3, IDLE_GAP_MS = +process.env.AIGILE_IDLE_GAP_MS || 10 * 60e3;
const shape = p => (p.cards || []).map(c => c.id + ':' + c.status).sort().join(',');
// What the team said at the end of its last run (its first plain line), for "ran and chose to wait".
function lastWords(slug) {
  try {
    const lines = logTail(slug, 40).split('\n'), i = lines.map(l => /^=== \S+ started/.test(l)).lastIndexOf(true);
    if (i < 0) return '';
    return (lines.slice(i + 1).find(l => l.trim() && !/^(===|▶|🔧|📖|🔍|✏️|🌐|🤖|📝|💬|\s)/u.test(l)) || '').trim().slice(0, 200);
  } catch { return ''; }
}
// Start a team for the watchman and keep what came of it (AIG-1446): a wake that didn't happen says why, on the glance and
// the project's top bar, instead of a try/catch {} that hid it. Returns true when a run is on its way.
function wake(s, p, log, kind, card) {
  const slug = p.slug, why = s.why = s.why || {};
  let r;
  try { r = startTeam(p, true, false, true, true); }
  catch (e) { why[slug] = { at: now(), why: 'error', msg: String(e.message || e).slice(0, 200) }; logErr('wake ' + slug, e); return false; }
  if (r && (r.running || r.queued)) {
    const ran = s.ran = s.ran || {}, was = ran[slug], sh = shape(p);
    ran[slug] = { at: now(), shape: sh, idle: was && was.shape === sh ? (was.idle || 0) + 1 : 0 };
    delete why[slug]; log(slug, kind, card); return true;
  }
  why[slug] = { at: now(), why: r && r.leadActive ? 'lead' : r && r.swarmPaused ? 'swarm' : r && r.nothingNew ? 'nothing' : r && r.terminal ? 'session' : r && r.engineMissing ? 'engine' : 'other' };
  return false;
}
function checkTeam(s, slug, log) {
  const p = load(slug); if (!p || p.archived) return;
  const why = s.why = s.why || {};
  if (!p.path) { why[slug] = { at: now(), why: 'folder' }; return; }
  if (!fs.existsSync(p.path)) { why[slug] = { at: now(), why: 'foldermissing', path: p.path }; return; }   // moved or deleted: said, not silently skipped
  if (s.limitUntil && ago(s.limitUntil) < 0) { why[slug] = { at: now(), why: 'limit', until: s.limitUntil }; return; }   // out of usage: everyone waits for the reset
  if (p.cards.some(c => ['todo', 'doing'].includes(c.status)) && expireLead(p)) {
    (p.log = p.log || []).push({ at: now(), author: NAME, kind: 'log', text: tr('srv.lead.expired') });
    save(p);
  }
  const pr = presenceOf(slug);
  const lim = !pr.online && limitHit(slug);
  if (lim && ago(lim.until) < 0) {
    s.limitUntil = lim.until; log(slug, 'limit'); why[slug] = { at: now(), why: 'limit', until: lim.until };
    tell(s, tr('srv.limit', { time: hhmm(lim.until) }));
    return;
  }
  if (pr.online) {   // working: leave them be, unless the session is only sitting in its wait
    if (!pr.running) why[slug] = { at: now(), why: 'lead' }; else delete why[slug];
    const at = attention(p, { online: false });
    // A lead waiting on its own helpers isn't idle: a teammate marked working in the last 30 min counts as work going on.
    const helping = (p.team || []).some(t => /working/i.test(t.status || '') && !/not working/i.test(t.status || '') && t.updated && ago(t.updated) < 30 * 60e3);
    if (!helping && pr.waitingMs >= IDLE_MS && at && at.kind === 'asleep' && ago(lastEvent(s, slug, ['nudged'])) > nudgeGapMs()) {
      const c = p.cards.filter(c => ['doing', 'todo'].includes(c.status) && !c.blocked && !waitingOnRich(c) && !(c.timedUntil && c.timedUntil > now()) && !(c.waiting && c.waiting.length)).sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority))[0];
      if (!c) return;
      c.comments.push({ author: NAME, wake: true, at: now(), text: `- 🌙 **Keep going**: you're idle with cards you can do\n\n- Work through To do, then backlog you can do without ${owner()}\n\n- Stop only for what truly needs ${owner()}` });
      c.updated = now(); save(p); log(slug, 'nudged', c.id);
    }
    return;
  }
  if (leadActive(p)) { why[slug] = { at: now(), why: 'lead' }; return; }   // no restart attempts or stuck warnings while a live lead owns the folder
  // Ran and moved nothing, IDLE_RUNS times in a row: it chose to wait. Woken again at the steady pace, never left for the night.
  const ran = (s.ran || {})[slug];
  if (ran && ran.idle >= IDLE_RUNS && shape(p) === ran.shape && ago(ran.at) < IDLE_GAP_MS) { why[slug] = { at: now(), why: 'waits', said: lastWords(slug), next: new Date(Date.parse(ran.at) + IDLE_GAP_MS).toISOString() }; return; }
  // A cut-off run: the team is gone but a card is still in progress.
  // A card already flagged stuck stops only itself (AIG-283): the team is still woken below for its other work.
  const mid = p.cards.filter(c => c.status === 'doing' && (s.restarts[slug + '/' + c.id] || 0) < MAX_RESTARTS).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
  if (mid && lim) { wake(s, p, log, 'restarted', mid.id); return; }   // cut off by the usage limit, which has reset now: carry on, without counting it as a try
  if (mid) {
    const n = (s.restarts[slug + '/' + mid.id] || 0) + 1;
    s.restarts[slug + '/' + mid.id] = n;
    if (n >= MAX_RESTARTS) {
      const tail = logTail(slug, 6).split('\n').slice(-6).join('\n');
      mid.comments.push({ author: NAME, text: tr('srv.stuck.note', { n, tail: tail || tr('srv.empty') }), at: now() });
      mid.needsYou = true; mid.updated = now(); save(p);
      log(slug, 'stuck', mid.id);
      tell(s, tr('srv.stuck.tell', { project: p.name, id: mid.id, title: mid.title, n }));
      return;
    }
    mid.comments.push({ author: NAME, text: '- 🌙 Picked back up: this card was in progress when the team stopped. Carry on where you left off', at: now() });
    mid.updated = now(); save(p);
    wake(s, p, log, 'restarted', mid.id);
    return;
  }
  // Asleep with open work: wake them.
  const at = attention(p, pr);
  if (at && at.kind === 'asleep') { wake(s, p, log, 'woke'); return; }
  // Nobody sleeps but the owner (AIG-261): a team with only backlog left is woken too, to pick some up or plan
  // ahead; AIG-516: how soon follows the Scrum Master's diligence scale (crack the whip 2 min, steady 10, gentle 30).
  if (p.cards.some(c => c.status === 'backlog') && ago(lastEvent(s, slug, ['woke'])) > Math.max(2, everyMin()) * 60e3) { wake(s, p, log, 'woke'); return; }
  if (!at) delete why[slug];   // nothing to do: nothing to explain
}
const PRIO = ['urgent', 'high', 'normal', 'low'];

// 🔔 Auto-poke (AIG-516): while the owner is quiet he never has to tap "X teams need a poke". A watched team that would show
// it (asleep with To do, an owner comment unanswered) is poked by the board itself, through the owner's own poke path (a
// 👉 comment, then nudge): the one-lead rule, the budget, the pace guard and No Token Mode still apply. How soon and how
// often follows the Scrum Master's push scale: the one table. firstMin: how long the need has stood before the first poke;
// againMin: the next poke if it still stands; cap: the most pokes per team per night, so a broken team can't loop on tokens.
// A pill that stays (no folder, cap reached, budget, a lead in a session) says why; a poke that is on its way hides the pill.
const POKE = {
  1: { firstMin: 60, againMin: 180, cap: 2 },
  2: { firstMin: 30, againMin: 90, cap: 3 },
  3: { firstMin: 15, againMin: 45, cap: 4 },
  4: { firstMin: 5, againMin: 20, cap: 6 },
  5: { firstMin: 0, againMin: 10, cap: 8 },
};
const POKE_UNIT_MS = +process.env.AIGILE_POKE_MS || 60e3;   // tests: a short "minute"
const pokeScale = () => POKE[SM().pushLevel()];
// Why a poke can't go out for this team, or null.
function pokeHeld(s, p) {
  const n = ((s.poke || {})[p.slug] || {}).n || 0, cap = pokeScale().cap;
  if (!p.path) return { why: 'folder' };
  if (!fs.existsSync(p.path)) return { why: 'foldermissing', path: p.path };   // AIG-740
  if (n >= cap) return { why: 'cap', n, cap };
  if (noTokens.isOn()) return { why: 'notokens' };
  if (s.limitUntil && ago(s.limitUntil) < 0) return { why: 'limit' };
  if (require('./budget').overBudget()) return { why: 'budget' };
  if (leadActive(p)) return { why: 'lead' };
  return null;
}
// For the project list: the need, marked auto (a poke is on its way: no pill) or held (the pill stays, with the reason).
function pokeView(p, at) {
  const s = read(); if (!s) return at;
  if (!s.watch.includes(p.slug)) return { ...at, auto: true };   // left off the watch list: the owner's choice, no pill
  const held = pokeHeld(s, p);
  if (held && held.why === 'lead') return { ...at, auto: true };   // its lead hears the comment in the session
  return { ...at, ...(held ? { held } : { auto: true }) };
}
function autoPoke(s, log) {
  s.poke = s.poke || {};
  const T = pokeScale();
  for (const slug of s.watch) {
    const p = load(slug); if (!p || p.archived) continue;
    const st = s.poke[slug] = s.poke[slug] || { n: 0 };
    const at = attention(p, presenceOf(slug));
    if (!at) { delete st.since; delete st.last; continue; }   // it moved on: the next need waits its first time again
    st.since = st.since || now();
    if (pokeHeld(s, p)) continue;
    if (ago(st.last || st.since) < (st.last ? T.againMin : T.firstMin) * POKE_UNIT_MS) continue;
    const open = p.cards.filter(c => !waitingOnRich(c)), team = open.filter(c => c.status === 'team' && require('./store').teamOwes(c));
    const c = at.kind === 'stuck' ? team[0] : ['doing', 'todo'].flatMap(k => open.filter(x => x.status === k).sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority)))[0];
    if (!c) continue;
    c.comments.push({ author: NAME, text: '👉 any update?', at: now(), poke: true, wake: true });
    c.updated = now(); save(p);
    st.n++; st.last = now(); log(slug, 'poked', c.id);
    require('./presence').nudge(slug);
  }
}
/// Checked every minute (AIG-269, AIG-277): every watched team gets the same look as in the full round, so a team that
// stopped with work (a card left in progress too) is started again within a minute or two. At most once every wakeGapMs()
// per team (3 min, or the push level's pace when shorter: Crack the whip 2), so a run that has only just ended isn't started
// again on top of its last words. AIG-1446: every look counts as a check (lastCheck), so the glance shows the real last one.
function quickWake(s) {
  if (noTokens.isOn()) { s.lastCheck = now(); return false; }
  const n = s.events.length, log = (project, kind, card) => s.events.push({ at: now(), project, kind, ...(card ? { card } : {}) });
  limitFromReadings(s);
  for (const slug of s.watch) {
    if (ago(lastEvent(s, slug, ['woke', 'restarted'])) < wakeGapMs()) continue;
    try { checkTeam(s, slug, log); } catch (e) { logErr('check ' + slug, e); (s.why = s.why || {})[slug] = { at: now(), why: 'error', msg: String(e.message || e).slice(0, 200) }; }
  }
  try { autoPoke(s, log); } catch (e) { logErr('autopoke', e); }
  s.lastCheck = now(); delete s.lastError;
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
// The 🧭 Lead Scrum Master's chat (AIG-211, AIG-359): its own messages and the owner's, one thread by day and by night.
// While quiet it lives in watchman.conf (the teams' replies to passed-on messages wait in their lead's chat for the
// morning, AIG-255); by day in watchman.last, which also keeps the night's messages until the owner clears them (AIG-283).
function messages() { const s = read(); return s ? s.msgs || [] : null; }
// The day chat (last night's messages included) while not quiet, else null.
function lastNight() { if (read()) return null; const l = readLast(); return l ? l.msgs || [] : []; }
// Read up to (AIG-278): opening the chat marks its messages read, so the unread badge goes away.
const readAt = () => { let s; try { s = read() || readLast(); } catch (e) { if (e.atrest) return ''; throw e; } return (s && s.readAt) || ''; };   // for the chats list: never breaks it (AIG-1170)
function markRead() {
  const s = read(); if (s) { s.readAt = now(); write(s); return; }
  const l = readLast(); if (l) { l.readAt = now(); writeLast(l); }
}
const writeLast = l => { try { fs.mkdirSync(DATA, { recursive: true }); } catch {} try { A.writeText(LAST, JSON.stringify(l)); } catch (e) { if (e.atrest) throw e; } };   // AIG-1170: a refused write (no key) is said, not swallowed
// Add one message to whichever chat is current.
function post(m) {
  const s = read();
  if (s) { s.msgs = s.msgs || []; s.msgs.push(m); write(s); return; }
  const l = readLast() || { msgs: [] }; l.msgs = l.msgs || []; l.msgs.push(m); writeLast(l);
}

// The owner's one contact (AIG-262, AIG-359): an agent in charge of every team lead, by night and now by day. Each message
// starts a hidden run in its own folder (data/scrummaster) that makes it happen with the board's commands (wake teams,
// give leads orders, check), then answers in one short line (aigile watchsay). One run at a time: messages that arrive
// meanwhile go in the next. While a window session is around (aigile smwait, AIG-456) it gets them instead, queued
// until its next wait: never a second run beside it. The runs share one session (AIG-457). "Clear our chat" (AIG-256) stays instant and needs no run.
const WLOG = path.join(DATA, 'logs', '_scrummaster.log'), WRAW = path.join(DATA, 'logs', '_scrummaster.raw');
let wrun = null, lastRunAt = null, pending = [];   // pending: [{ text, routine }]
// Files attached to a message (AIG-474): their saved paths, so the agent can read an image.
const filesNote = m => (m.attachments || []).length ? ` [attached: ${m.attachments.map(a => a.path).join(', ')}]` : '';
// anyway (AIG-531): the owner chose Send anyway: No Token Mode and the budget don't stop this one message.
let forceRun = false;
function relay(text, attachments, anyway) {
  text = String(text || '').trim(); const files = require('./attachments').attachmentsFor('_watchman', attachments);
  if (!text && !files.length) throw bad('text is required');
  const clear = /^\W*(clear|wipe|empty)\b.*\b(chat|messages?|history)\W*$/i.test(text);
  const s = read();
  if (clear) { if (s) { s.msgs = []; write(s); } else try { fs.unlinkSync(LAST); } catch {} return { ok: true }; }
  // AIG-790: the same message again within a minute is a repeat click, not a new message: drop it.
  const mine = ((s || readLast() || {}).msgs || []).filter(m => m.mine).pop();
  if (!files.length && mine && mine.text === text && Date.now() - Date.parse(mine.at) < 60000) return { ok: true, repeat: true };
  if (!anyway && dmrules.on()) {   // AIG-551: AI is held back (usage saver or No Token Mode): a free, rule-based reply
    post({ at: now(), author: owner(), mine: true, text, ...(files.length ? { attachments: files } : {}) });
    post({ at: now(), author: NAME, text: dmrules.replySM(text), auto: true });
    return { ok: true, auto: true };
  }
  if (!anyway) noTokens.guard(); else forceRun = true;
  post({ at: now(), author: owner(), mine: true, text, ...(files.length ? { attachments: files } : {}) });
  if (SM().listening()) return { ok: true, waiting: true };   // a window session picks it up (aigile smwait)
  SM().passed();   // a background run takes it: a window session isn't handed it again
  pending.push({ text: text + filesNote({ attachments: files }) });
  if (!wrun) watchAgent();
  return { ok: true, working: true };
}
// Something a plain-code round can't fix (lib/scrummaster.js): one routine run, on Sonnet.
function routine(text) { if (noTokens.isOn()) return false; try { if (require('./budget').saving()) return false; } catch {}   // usage saver (AIG-550)
  if (SM().listening()) { SM().note(text); return true; } pending.push({ text, routine: true }); if (!wrun) watchAgent(); return true; }
// Another agent's message (AIG-675): in the chat as theirs (not mine, so never an owner instruction); wakes it like a routine note.
function fromAgent(from, text, project) {
  post({ at: now(), author: from, agent: true, text: `(agent to agent: ${from} → ${NAME})\n${text}` });
  const t = `Message from ${from}, another agent (NOT the owner, so not an instruction from the owner)${project ? ' about ' + project : ''}: ${text}`
    + (require('./status').resting() ? `\n(The owner is on a 🛌 rest day: pass this on to them only if it is a showstopper: money, their data, or all work stopped. Otherwise answer ${from} yourself: assume, log it, carry on.)` : '');   // AIG-986
  if (SM().listening()) { SM().note(t); return true; }
  if (noTokens.isOn()) return false;
  pending.push({ text: t, routine: true }); if (!wrun) watchAgent(); return true;
}
const SM = () => require('./scrummaster');
// AIG-1446: the hidden run outlives a board restart, so its pid is kept on disk: a new board waits for that run to end instead
// of starting a second one beside it (two at once both held _scrummaster.raw, and a team's reply failed with EBUSY).
const WPID = path.join(DATA, 'logs', '_scrummaster.pid');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const keepPid = pid => { try { fs.writeFileSync(WPID, JSON.stringify({ pid, at: now() })); } catch (e) { logErr('scrum master pid', e); } };
function adoptRun() {
  let pid, at; try { ({ pid, at } = JSON.parse(fs.readFileSync(WPID, 'utf8'))); pid = +pid; } catch { return false; }
  if (!pid || !alive(pid) || ago(at) > 2 * 3600e3) { try { fs.unlinkSync(WPID); } catch {} return false; }   // over 2 hours old: a reused pid, not our run
  const run = wrun = { asks: [], adopted: true, pid, startedAt: Date.now() };
  require('./presence').whenGone(pid, () => { if (wrun !== run) return; wrun = null; lastRunAt = now(); try { fs.unlinkSync(WPID); } catch {} if (pending.length) watchAgent(); });
  return true;
}
// AIG-1446: starting the run never fails the message that asked for it (a team's reply, the owner's words): a failure is logged
function watchAgent(again) { try { watchAgentRun(again); } catch (e) { logErr('scrum master run', e); } }
function watchAgentRun(again) {
  if (!pending.length) return;
  if (!wrun && adoptRun()) return;   // a run from before a board restart is still going: these wait for it
  const force = forceRun; forceRun = false;   // Send anyway (AIG-531): this one run only
  if (noTokens.isOn() && !force) { pending = []; return; }
  const over = force ? null : require('./budget').overBudget();   // token budget (AIG-353)
  if (over) { pending = []; try { say(tr('srv.wm.cantstart', { why: over })); } catch {} return; }
  // The daily AI-run cap (AIG-359) stops routine runs only: the owner's own messages always get through (AIG-647).
  // A restart after a hang is the same run.
  const own = pending.some(a => !a.routine), capped = !again && !own && SM().takeRun();
  if (capped) { pending = []; return; }
  const asks = pending; pending = [];
  const s = read(), mine = asks.filter(a => !a.routine).map(a => a.text);
  const chat = (s ? s.msgs : lastNight()) || [];
  // AIG-988: the owner's last message with no reply after it rides along with a routine run, which answers it first
  const last = chat[chat.length - 1], unanswered = !mine.length && last && last.mine ? last.text : '';
  const model = mine.length || unanswered ? 'opus' : 'sonnet';   // owner messages on Opus, routine on Sonnet
  const sess = SM().session(!!again);   // one conversation for every run; a fresh one after an hour idle or a hang
  const prompt = SM().brief({ night: !!s, watch: s ? s.watch : SM().watchList(), asks: mine, routine: asks.filter(a => a.routine).map(a => a.text), recent: chat.slice(-8).map(m => `${m.author || NAME}: ${m.text}`).join(' / '), fresh: !sess.resume, unanswered });
  try { fs.mkdirSync(path.dirname(WLOG), { recursive: true }); fs.appendFileSync(WLOG, `=== ${new Date().toISOString()} started (${model}${mine.length ? '' : ', routine'}${sess.resume ? ', resumed' : ', fresh'}) ===\n`); } catch (e) { logErr('scrum master log', e); }
  // AIG-1446: a raw file still held by another program (EBUSY on Windows) gets a fresh name for this run, never a failed message
  let raw = WRAW; try { fs.writeFileSync(raw, ''); } catch (e) { raw = WRAW.replace(/\.raw$/, `-${Date.now()}.raw`); logErr('scrum master raw busy, using ' + path.basename(raw), e); }
  // One line: a .cmd agent program goes through cmd.exe, where a line break ends the command. Verbose, so the hang
  // watchdog sees it working, and the log gets readable lines.
  const args = ['--model', model, '-p', prompt.replace(/\s*\n+\s*/g, ' / '), '--output-format', 'stream-json', '--verbose', ...(sess.resume ? ['--resume', sess.id] : ['--session-id', sess.id])], env = { ...process.env, AIGILE_BACKGROUND: '1', AIGILE_AS: NAME, AIGILE_ROLE: 'scrummaster' };
  const run = wrun = { asks, verbose: true, off: 0, again: !!again, startedAt: Date.now() };
  const { readable, silent } = require('./presence');
  const tailRaw = all => {
    try {
      const size = fs.statSync(raw).size; if (size <= run.off) return;
      const b = Buffer.alloc(size - run.off), fd = fs.openSync(raw, 'r'); try { fs.readSync(fd, b, 0, b.length, run.off); } finally { fs.closeSync(fd); }
      const str = b.toString('utf8'), end = all ? str.length : str.lastIndexOf('\n') + 1; if (!end) return;
      const txt = str.slice(0, end).split(/\r?\n/).flatMap(l => readable(l)).join('\n');
      if (txt) fs.appendFileSync(WLOG, txt + '\n');
      run.off += Buffer.byteLength(str.slice(0, end));
    } catch {}
  };
  const done = why => {
    if (wrun !== run) return; wrun = null; lastRunAt = now(); SM().sessionUsed(); clearInterval(run.timer); tailRaw(true); try { fs.unlinkSync(WPID); } catch {} if (raw !== WRAW) try { fs.unlinkSync(raw); } catch {}
    try { fs.appendFileSync(WLOG, `=== exited${why ? ' ' + why : ''} ===\n`); } catch {}
    require('./usage').logRun('scrummaster', '_scrummaster', { folder: SM().folder(), start: run.startedAt, log: WLOG });   // AIG-522 #10
    if (pending.length) watchAgent();
  };
  // Hang watchdog (AIG-359): no new line for 15 minutes, so it is killed and started once more with the same messages.
  run.timer = setInterval(() => {
    tailRaw();
    if (!run.pid || !silent(raw, run)) return;
    run.stopped = true; killTree(run.pid);
    try { fs.appendFileSync(WLOG, `=== hung: no new log lines for ${Math.round(require('./presence').HANG_MS / 60e3)} min ===\n`); } catch {}
    done('hung');
    if (!run.again) { pending.unshift(...run.asks); try { say(tr('srv.wm.silent1')); } catch {} if (!wrun) watchAgent(true); }
    else try { say(tr('srv.wm.silent2')); } catch {}
  }, 1000);
  run.timer.unref();
  const failed = e => { done('error'); try { say(tr('srv.wm.failed', { msg: e.message })); } catch {} };
  try {
    const cwd = SM().folder();
    // Hidden, and outliving a board restart (AIG-270, AIG-275); elsewhere detached does both.
    if (process.platform === 'win32') spawnHidden(agentCommand(), args, { cwd, env, out: raw, err: raw }).then(pid => { run.pid = pid; keepPid(pid); if (run.stopped) killTree(pid); whenGone(pid, () => done()); }, failed);
    else {
      const out = fs.openSync(raw, 'a'), child = spawnAgent(agentCommand(), args, { cwd, detached: true, stdio: ['ignore', out, out], env });
      fs.closeSync(out); run.pid = child.pid; keepPid(child.pid); child.unref(); child.on('exit', () => done()); child.on('error', failed);
    }
  } catch (e) { failed(e); }
}
// A line from the agent into the chat (aigile watchsay), by day or by night.
// options (AIG-388): up to 4 quick-answer buttons under the message; a click sends that text back to it.
function say(text, options) {
  text = String(text || '').trim(); if (!text) throw bad('text is required');
  const opts = (Array.isArray(options) ? options : String(options || '').split(',')).map(o => String(o).trim()).filter(Boolean).slice(0, 4);
  post({ at: now(), author: NAME, text, ...(opts.length ? { pick: opts.map(o => ({ label: o, text: o })) } : {}) }); return { ok: true };
}
// ⛔ No Token Mode: end the agent's run and drop what was waiting for it.
function stopAgent() { pending = []; if (wrun) { wrun.stopped = true; wrun.again = true; if (wrun.pid) killTree(wrun.pid); } }
const watchBusy = () => !!wrun || pending.length > 0;
const runState = () => ({ running: !!wrun, lastRunAt });   // for the home screen line (AIG-463)
/// First round soon after the board starts (AIG-222): a restart mustn't push it back.
// AIG-1446: one tick a minute does everything: the wake-up time, the new-code check (AIG-241), the full round when it is due
// (at the push level's pace: Crack the whip every 2 min, not a fixed 10) and the every-minute look otherwise. It reschedules
// itself after each tick whatever happened, and a failure is logged and shown on the glance, never swallowed.
function tick() {
  const s = read(); if (!s) return;
  if (s.until && Date.now() >= Date.parse(s.until)) { require('./quiet').setQuiet(false, null, null, true); return; }   // wake-up time (AIG-232)
  if (ago(s.lastRound) >= roundMs() - TICK_MS / 2) { round(true); return; }
  const was = JSON.stringify(s);
  if (restartIfStale(s)) return;
  quickWake(s);
  if (JSON.stringify(s) !== was) write(s);
}
let tickTimer = null;
function startWatchman(stale) {
  if (stale) isStale = stale;
  const next = ms => { clearTimeout(tickTimer); tickTimer = setTimeout(() => { try { tick(); } catch (e) { failed('tick', e); } next(TICK_MS); }, ms); tickTimer.unref(); };
  setTimeout(() => { try { round(); } catch (e) { failed('round', e); } }, 30e3).unref();
  next(TICK_MS);
}
module.exports = { POKE, pokeView, nightOf, everyMin, refill, filesNote, routine, NAME, startWatch, stopWatch, round, quickWake: () => { const s = read(); if (!s) return null; const w = quickWake(s); write(s); return w; }, status, startWatchman, limitUntilNow, stopAgent, messages, lastNight, readAt, markRead, relay, fromAgent, say, watchBusy, runState };
