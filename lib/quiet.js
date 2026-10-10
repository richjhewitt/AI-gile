// "Going quiet": Rich's one-tap message to every team with work before he switches off, and the night theme it turns on.
const fs = require('fs');
const path = require('path');
const { DATA, now, load, save, listSlugs } = require('./store');
const { presenceOf, wakeTeam } = require('./presence');

/* ---------- night mode state ---------- */
// Stored as a plain file (not .json, so it never shows up as a project): the time Rich went quiet.
const FILE = path.join(DATA, 'quiet.state');
function quietSince() { try { return fs.readFileSync(FILE, 'utf8').trim() || null; } catch { return null; } }

/* ---------- the message ---------- */
const MESSAGE = [
  '- 📣 **Rich is going quiet** for a few hours',
  '- Ask any questions **now**, on the board',
  '- Line up enough work for the next few hours',
  '- Decide small things yourselves and log them (`log --decision`)',
  '- Reply with one line (what you will be doing), then move this card to done',
].join('\n\n');
const OPEN = ['todo', 'doing', 'review', 'team'];

// { on: true } sends the message to every team with open work (waking sleeping ones) and turns night mode on.
// { on: false } turns night mode off.
function setQuiet(on) {
  if (!on) { try { fs.unlinkSync(FILE); } catch {} return { quiet: null, sent: [], woke: [] }; }
  const sent = [], woke = [], failed = [];
  for (const p of listSlugs().map(load)) {
    if (!p || p.archived || !p.cards.some(c => OPEN.includes(c.status))) continue;
    p.cards.push({
      id: p.key + '-' + p.nextId++, title: '📣 Going quiet', description: MESSAGE, testSteps: '',
      type: 'task', priority: 'urgent', status: 'team', assignee: '', sprint: '', blocked: false, needsYou: false,
      createdBy: 'Rich', created: now(), updated: now(), comments: [],
    });
    save(p);
    sent.push(p.name);
    if (!presenceOf(p.slug).online && p.path) {
      try { wakeTeam(p); woke.push(p.name); } catch (e) { failed.push(p.name + ': ' + e.message); }
    }
  }
  const since = now();
  fs.writeFileSync(FILE, since);
  return { quiet: since, sent, woke, failed };
}

module.exports = { quietSince, setQuiet };
