// 🌙 Night watchman (AIG-199): while the owner is "going quiet", the board itself (no AI, no tokens) checks the
// projects they picked every 10 minutes:
//   - a team that stopped with a card still in progress (a cut-off run) is started again, with a note on the card;
//     the third time for the same card it stops trying and puts the card in the owner's pile as stuck
//   - a team asleep with open work is woken
// Everything it does is kept, and "back from quiet" returns a summary per project.
// State lives in data/watchman.conf (not .json: every .json in data/ is a project).
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs, attention } = require('./store');
const { presenceOf, startTeam, logTail } = require('./presence');

const FILE = path.join(DATA, 'watchman.conf');
const EVERY_MS = +process.env.AIGILE_WATCH_MS || 10 * 60e3, MAX_RESTARTS = 3, NAME = '🌙 Watchman';
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; } };
const write = s => fs.writeFileSync(FILE, JSON.stringify(s, null, 1));
const active = () => listSlugs().map(load).filter(p => p && !p.archived);

// Start watching (called when the owner goes quiet). watch: the slugs to watch; none given = every active project.
function startWatch(watch) {
  const all = active().map(p => p.slug), list = Array.isArray(watch) && watch.length ? watch.filter(s => all.includes(s)) : all;
  write({ since: now(), watch: list, restarts: {}, events: [], lastRound: null });
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
const status = () => { const s = read(); return s ? { since: s.since, watch: s.watch, lastRound: s.lastRound, summary: summary(s) } : null; };

// One round: what a careful person would do every few minutes.
function round() {
  const s = read(); if (!s) return null;
  const log = (project, kind, card) => s.events.push({ at: now(), project, kind, ...(card ? { card } : {}) });
  for (const slug of s.watch) {
    const p = load(slug); if (!p || p.archived || !p.path) continue;
    const pr = presenceOf(slug); if (pr.online) continue;   // working: leave them be
    // A cut-off run: the team is gone but a card is still in progress.
    const mid = p.cards.filter(c => c.status === 'doing').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0];
    if (mid) {
      const n = (s.restarts[slug + '/' + mid.id] || 0) + 1;
      s.restarts[slug + '/' + mid.id] = n;
      if (n >= MAX_RESTARTS) {
        const tail = logTail(slug, 6).split('\n').slice(-6).join('\n');
        mid.comments.push({ author: NAME, text: `- 🌙 **Stuck**: the team stopped on this card ${n} times tonight, so I stopped restarting it\n- Last lines of their log:\n\`\`\`\n${tail || '(empty)'}\n\`\`\``, at: now() });
        mid.needsYou = true; mid.updated = now(); save(p);
        log(slug, 'stuck', mid.id);
        continue;
      }
      mid.comments.push({ author: NAME, text: '- 🌙 Picked back up: this card was in progress when the team stopped. Carry on where you left off', at: now() });
      mid.updated = now(); save(p);
      try { startTeam(p, true); log(slug, 'restarted', mid.id); } catch {}
      continue;
    }
    // Asleep with open work: wake them.
    const at = attention(p, pr);
    if (at && at.kind === 'asleep') { try { startTeam(p); log(slug, 'woke'); } catch {} }
  }
  s.lastRound = now();
  write(s);
  return status();
}
function startWatchman() { setInterval(() => { try { round(); } catch {} }, EVERY_MS).unref(); }

module.exports = { startWatch, stopWatch, round, status, startWatchman };
