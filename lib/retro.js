// 🔁 Retros (AIG-865): an agent suggests a change to WAYS-OF-WORKING; the owner approves it on a card. `add` makes one card per suggestion
// (type task, kind plan, an open "Go?" ask, so it lands in 🚦 Ready for go). Go: `answer` appends the suggestion as a bullet under its
// section of WAYS-OF-WORKING.md (end of the file under "## Retros" if the section is missing), tagged "(retro AIG-x, date)", and comments
// what was added. Not yet: the card closes and nothing changes. The card keeps `retro {text, why, section, done?}`, so old cards are untouched.
// `due` is the one-line prompt after a sprint go/no-go or a closed incident: p.retroDue, cleared when a retro is filed. No card is made by itself.
const fs = require('fs');
const path = require('path');
const { now, load, save, bad, writeAtomic } = require('./store');
const { t: tr } = require('./i18n');

const DEFAULT_SECTION = 'Retros';
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
// The file (AIGILE_WOW overrides it, so QA never touches the real one).
const file = () => process.env.AIGILE_WOW || path.join(__dirname, '..', 'WAYS-OF-WORKING.md');
const short = s => { const w = s.length > 60 ? s.slice(0, 59).replace(/\s+\S*$/, '') + '…' : s; return w; };

// The text with `bullet` added under the heading `section` (case-insensitive), after that section's last line; else at the end under "## Retros".
function insert(src, section, bullet) {
  const eol = /\r\n/.test(src) ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const head = l => /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
  const find = name => lines.findIndex(l => { const m = head(l); return m && m[2].replace(/[*_`]/g, '').toLowerCase() === name.toLowerCase(); });
  let at = find(section), found = at >= 0;
  if (!found) {
    at = find(DEFAULT_SECTION);
    if (at < 0) { if (lines.length && lines[lines.length - 1].trim()) lines.push(''); lines.push('## ' + DEFAULT_SECTION); at = lines.length - 1; }
  }
  const level = head(lines[at])[1].length;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) { const m = head(lines[i]); if (m && m[1].length <= level) { end = i; break; } }
  while (end - 1 > at && !lines[end - 1].trim()) end--;
  if (end - 1 === at) lines.splice(end, 0, '', bullet);   // an empty section: a blank line after the heading
  else lines.splice(end, 0, bullet);
  return { text: lines.join(eol) + eol, found };
}

function add(slug, b) {
  const p = load(slug); if (!p) throw bad('project not found', 404);
  const text = str(b.text, 600), why = str(b.why, 600), section = str(b.section, 80), author = str(b.author, 60);
  if (!text) throw bad('a retro needs the suggested change');
  if (!why) throw bad('a retro needs why: what happened');
  const ref = str(b.card, 20).toUpperCase();
  if (ref && !/^[A-Z]{1,6}-\d+$/.test(ref)) throw bad('card must be a card id like AIG-12');
  const sec = section || DEFAULT_SECTION;
  const c = { id: p.key + '-' + p.nextId++, title: tr('srv.retro.title', { short: short(text) }), type: 'task', kind: 'plan', status: 'backlog', priority: 'normal',
    description: tr('srv.retro.desc', { text, why, section: sec }) + (ref ? '\n\n' + tr('srv.retro.card', { card: ref }) : ''),
    testSteps: '', assignee: '', sprint: '', blocked: false, needsYou: true, asked: true, createdBy: author, created: now(), updated: now(), retro: { text, why, section, ...(ref ? { card: ref } : {}) },
    comments: [{ author: author || 'Lead', text: tr('srv.retro.ask', { section: sec, text }), at: now(), mark: 'ask' }] };
  p.cards.push(c);
  delete p.retroDue;
  save(p);
  return c;
}

// The owner's reply on a retro card: Go (or yes/ok) adds it, Not yet (or no) closes it. Anything else is left to the normal comment flow (returns false).
const GO = /^\s*(go|yes|ja|ok|okay)\b/i;
function answer(p, c, text) {
  if (!c.retro || c.retro.done) return false;
  const say = tr('act.notyet.say').trim().replace(/[:：]\s*$/, '');
  const no = new RegExp('^\\s*(not yet|no|nee|nog niet)\\b', 'i').test(text) || (say && text.toLowerCase().startsWith(say.toLowerCase()));
  const go = GO.test(text);
  if (!go && !no) return false;
  c.retro.done = go ? 'added' : 'declined';
  let msg;
  if (go) {
    const sec = c.retro.section || DEFAULT_SECTION, f = file();
    const bullet = `- ${c.retro.text} (retro ${c.id}, ${now().slice(0, 10)})`;
    let src = ''; try { src = fs.readFileSync(f, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }   // only a missing file is empty
    const r = insert(src, sec, bullet);
    writeAtomic(f, r.text);
    msg = tr(r.found ? 'srv.retro.added' : 'srv.retro.addedEnd', { section: r.found ? sec : DEFAULT_SECTION, wanted: sec, line: bullet });
  } else msg = tr('srv.retro.declined');
  c.comments.push({ author: 'AI-gile', text: msg, at: now() });
  c.status = 'done'; c.needsYou = false; c.blocked = false;
  return true;
}

// Mark that a retro is worth running (after a sprint go/no-go, or a closed incident). Shown as one line until a retro is filed.
function due(p, why, card) { p.retroDue = { why, card, at: now() }; }
const dueOf = p => (p && p.retroDue && Date.now() - Date.parse(p.retroDue.at || 0) < 7 * 86400e3 ? p.retroDue : null);
const line = slug => `Run a retro: aigile retro ${slug} "suggested change to WAYS-OF-WORKING" --why "what happened" --as NAME`;

module.exports = { add, answer, due, dueOf, line, insert, file };
