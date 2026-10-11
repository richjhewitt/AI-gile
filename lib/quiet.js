// "Going quiet": the owner's one-tap message to every team with work before he switches off, and the night theme it turns on.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs, owner } = require('./store');
const { presenceOf, startTeam } = require('./presence');
const { startWatch, stopWatch } = require('./watchman');

/* ---------- night mode state ---------- */
// Stored as a plain file (not .json, so it never shows up as a project): the time the owner went quiet.
const FILE = path.join(DATA, 'quiet.state');
function quietSince() { try { return fs.readFileSync(FILE, 'utf8').trim() || null; } catch { return null; } }

/* ---------- the message ---------- */
const MESSAGE = [
  `- 📣 **${owner()} is going quiet** for a few hours`,
  '- Ask any questions **now**, on the board',
  '- Line up enough work for the next few hours',
  '- Decide small things yourselves and log them (`log --decision`)',
  '- Reply with one line (what you will be doing), then move this card to done',
].join('\n\n');
const OPEN = ['todo', 'doing', 'review', 'team'];

// { on: true } sends the message to every team with open work (waking sleeping ones), turns night mode on and starts
// the 🌙 night watchman on the chosen projects (AIG-199). { on: false } turns it all off and returns the watchman's summary.
// until (AIG-232): "HH:MM", the next time it's that o'clock quiet ends by itself (the watchman checks every minute).
// Ending by itself keeps the morning summary, so the page can show it when the owner is back.
const MORNING = path.join(DATA, 'morning.conf');
function setQuiet(on, watch, until, auto) {
  if (!on) {
    try { fs.unlinkSync(FILE); } catch {}
    const summary = stopWatch();
    if (auto) try { fs.writeFileSync(MORNING, JSON.stringify({ at: now(), summary })); } catch {}
    return { quiet: null, sent: [], woke: [], summary };
  }
  const sent = [], woke = [], failed = [];
  for (const p of listSlugs().map(load)) {
    if (!p || p.archived || !p.cards.some(c => OPEN.includes(c.status))) continue;
    p.cards.push({
      id: p.key + '-' + p.nextId++, title: '📣 Going quiet', description: MESSAGE, testSteps: '',
      type: 'task', priority: 'urgent', status: 'team', assignee: '', sprint: '', blocked: false, needsYou: false,
      createdBy: owner(), created: now(), updated: now(), comments: [],
    });
    save(p);
    sent.push(p.name);
    if (!presenceOf(p.slug).online && p.path) {
      try { startTeam(p, false, false, false, true); woke.push(p.name); } catch (e) { failed.push(p.name + ': ' + e.message); }
    }
  }
  const since = now();
  fs.writeFileSync(FILE, since);
  return { quiet: since, sent, woke, failed, watching: startWatch(watch, nextTime(until)), until: nextTime(until) };
}

// The next moment the clock says HH:MM (today or tomorrow), as an ISO time; null for no time.
function nextTime(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}
// The summary of a quiet that ended by itself, once (the page asks for it when it sees quiet has ended).
function takeMorning() { try { const m = JSON.parse(fs.readFileSync(MORNING, 'utf8')); fs.unlinkSync(MORNING); return m; } catch { return null; } }

module.exports = { quietSince, setQuiet, takeMorning };
