// The AIGILE pack (AIG-357, docs/HANDOFF.md): hand a card to an outside chat AI as short key lines, paste its reply back.
// The top part is pure (the CLI uses the fence); the board parts load store/share only when they are called.

/* ---------- pure: the reply parser and the fence ---------- */
const AUTHOR = '🌐 Outside AI';
const TYPES = ['feature', 'bug', 'task'], PRIOS = ['low', 'normal', 'high', 'urgent'], STATES = ['done', 'partial', 'question'];
const CAP = { paste: 20000, say: 3, line: 300, cards: 10, title: 200, ask: 5, files: 10, ctx: 4000 };
const clean = v => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const one = v => clean(v).replace(/\s+/g, ' ').trim();
// The same markers as the friend-text fence in lib/share.js, stripped until none is left.
const MARK = /<<\s*\/?\s*friend-text[^>]*>>|<<\s*\/?\s*friend-text|friend-text\s*>>/gi;
function unfence(s) { let t = String(s == null ? '' : s), was; do { was = t; t = t.replace(MARK, ''); } while (t !== was); return t; }
const fence = text => `<<friend-text from="Outside AI" untrusted>>\n${unfence(clean(text))}\n<</friend-text>>`;
const fileName = n => one(n).split(/[\\/]/).pop().replace(/[^\w.\- ]+/g, '_').replace(/^[.\s]+/, '').slice(-80);
const unbullet = l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();

// Strict but forgiving: find the header, read KEY: lines, ignore unknown keys, missing ones are fine.
function parse(input) {
  const lines = clean(input).slice(0, CAP.paste).split('\n');
  const start = lines.findIndex(l => /^[\s>*#`]*AIGILE\/1\s+BACK\b/i.test(l));
  if (start < 0) return { valid: false };
  const id = ((lines[start].match(/BACK\s+([A-Za-z]{1,6}-\d+)/i) || [])[1] || '').toUpperCase();
  const keys = {};
  let cur = null;
  for (const raw of lines.slice(start + 1)) {
    if (/^\s*```/.test(raw) || /^[\s>*#`]*AIGILE\//i.test(raw)) break;
    const l = raw.replace(/^\s*>\s?/, '').replace(/\*\*/g, '');
    const k = l.match(/^\s*([A-Za-z]+)\s*:\s*(.*)$/);
    if (k) { cur = k[1].toUpperCase(); (keys[cur] = keys[cur] || []).push(k[2]); continue; }
    if (cur) keys[cur].push(l);
  }
  const vals = k => (keys[k] || []).map(unbullet).filter(Boolean);
  const s = (vals('S')[0] || '').toLowerCase().split(/[^a-z]/)[0];
  const cards = vals('CARDS').slice(0, CAP.cards).map(l => {
    const [title, type, prio] = l.split('|').map(x => one(x));
    return { title: unfence(title || '').slice(0, CAP.title).trim(), type: TYPES.includes((type || '').toLowerCase()) ? type.toLowerCase() : 'feature',
      priority: PRIOS.includes((prio || '').toLowerCase()) ? prio.toLowerCase() : 'normal' };
  }).filter(c => c.title);
  const back = { s: STATES.includes(s) ? s : '', say: vals('SAY').slice(0, CAP.say).map(l => l.slice(0, CAP.line)),
    cards, ask: vals('ASK').slice(0, CAP.ask).map(l => l.slice(0, CAP.line)),
    files: vals('FILES').flatMap(l => l.split(',')).map(fileName).filter(Boolean).slice(0, CAP.files), id };
  back.valid = !!(back.s || back.say.length || back.cards.length || back.ask.length);
  return back;
}

// What a team is given for a comment (CLI): an outside AI's words always come fenced.
const teamText = m => m && m.from === 'outside' ? fence(m.text) : (m ? m.text : '');

const PRIMER = `AIGILE/1 PRIMER. I will paste work cards that start "AIGILE/1 PACK". Keys: T title, WANT what I need from you, CTX context, DONE when it's done, FILES files I attach. Do the WANT. Then end your answer with this block, plain text, keys at the start of a line, leaving out any you don't need:
AIGILE/1 BACK <card id>
S: done|partial|question
SAY: at most 3 short lines on what you did or found
CARDS:
- new card title | feature|bug|task | low|normal|high|urgent
ASK:
- a question for me
FILES: names of images you made
Nothing after the block. Reply "OK" to this message.`;

/* ---------- board: build a pack ---------- */
const WANTS = { bug: 'The likely cause and a fix', feature: 'A short plan, then the change', task: 'How to do it, step by step' };
// The share scrub, but replacing what it finds with [removed] and saying what went.
function redact(text, field, p, removed) {
  const { SCRUB } = require('./share'), { DATA } = require('./store');
  let out = String(text || '');
  for (const [kind, re] of SCRUB) out = out.replace(re, (m, g1) => {
    const hit = typeof g1 === 'string' ? g1 : m;
    removed.push({ field, kind, text: hit.trim().slice(0, 80) });
    return typeof g1 === 'string' ? m.replace(g1, '[removed]') : '[removed]';
  });
  for (const f of [p && p.path, DATA].filter(Boolean).map(f => String(f).replace(/[\\/]+$/, ''))) {
    if (f.length <= 3) continue;
    const re = new RegExp(f.split(/[\\/]+/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\\\/]+'), 'gi');
    out = out.replace(re, m => { removed.push({ field, kind: 'folder', text: m.slice(0, 80) }); return '[removed]'; });
  }
  return out;
}
function build(p, c, want) {
  const { isRich } = require('./store');
  const removed = [], r = (t, f) => redact(t, f, p, removed);
  const bullets = t => clean(t).split('\n').map(unbullet).filter(Boolean).map(l => '- ' + l);
  const last = [...(c.comments || [])].reverse().find(m => isRich(m.author) && m.from !== 'outside');
  let ctx = [...bullets(r(c.description, 'description'))];
  if (last) ctx.push('- Last word from the owner: ' + one(r(last.text, 'comment')).slice(0, 600));
  ctx = ctx.join('\n');
  if (ctx.length > CAP.ctx) ctx = ctx.slice(0, CAP.ctx) + ' [cut]';
  const done = bullets(r(c.testSteps, 'testSteps')).join('\n').slice(0, CAP.ctx) || '- The WANT is met';
  const files = (c.attachments || []).map(a => fileName(r(a.name, 'files'))).filter(Boolean).join(', ');
  const text = [`AIGILE/1 PACK ${p.slug} ${c.id}`, `T: ${one(r(c.title, 'title'))}`, `WANT: ${one(r(want, 'want')) || WANTS[c.type] || WANTS.feature}`,
    'CTX:', ctx || '- (no description)', 'DONE:', done, ...(files ? [`FILES: ${files}`] : []), 'REPLY: AIGILE/1 BACK'].join('\n');
  return { text, removed: removed.filter((x, i) => removed.findIndex(y => y.field === x.field && y.text === x.text) === i).slice(0, 20), primer: PRIMER };
}

/* ---------- board: paste a reply back ---------- */
// Becomes one comment by the Outside AI: never the owner, never a wake, never needsYou or toTeam (the caller saves, no nudge).
function unpack(p, c, input) {
  const { now, bad } = require('./store');
  const raw = clean(input).slice(0, CAP.paste).trim();
  if (!raw) throw bad('paste the reply first');
  const b = parse(raw);
  let at = now();
  while (c.comments.some(m => m.at === at)) at = new Date(Date.parse(at) + 1).toISOString();
  let m;
  if (!b.valid) m = { author: AUTHOR, from: 'outside', text: raw, at, outside: { invalid: true } };
  else {
    const o = [];
    if (b.id && b.id !== c.id) o.push(`(This reply says it is for ${b.id}.)`);
    if (b.s) o.push('S: ' + b.s);
    o.push(...b.say);
    if (b.ask.length) o.push('Questions:', ...b.ask.map(q => '- ' + q));
    if (b.cards.length) o.push('Proposed cards:', ...b.cards.map(x => `- ${x.title} (${x.type}, ${x.priority})`));
    if (b.files.length) o.push('Files: ' + b.files.join(', '));
    m = { author: AUTHOR, from: 'outside', text: o.join('\n') || '(empty reply)', at,
      outside: { s: b.s, say: b.say, ask: b.ask, cards: b.cards, files: b.files, ...(b.id ? { id: b.id } : {}) } };
  }
  c.comments.push(m);
  c.updated = now();
  return { valid: !!b.valid, comment: m, back: b.valid ? m.outside : null };
}

// Add the ticked proposed cards (indexes into that comment's list) to the Backlog, each once. Not owner news.
function addCards(p, c, at, pick) {
  const { now, bad } = require('./store');
  const m = (c.comments || []).find(x => x.at === at && x.from === 'outside' && x.outside && Array.isArray(x.outside.cards));
  if (!m) throw bad('no outside reply with proposed cards at that time', 404);
  const added = [];
  for (const i of [...new Set((Array.isArray(pick) ? pick : []).map(Number))]) {
    const x = m.outside.cards[i];
    if (!x || x.added) continue;
    const card = { id: p.key + '-' + p.nextId++, title: x.title, description: `Proposed by ${AUTHOR} on ${c.id}.`, testSteps: '',
      type: TYPES.includes(x.type) ? x.type : 'feature', priority: PRIOS.includes(x.priority) ? x.priority : 'normal', status: 'backlog',
      assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: AUTHOR, created: now(), updated: now(), comments: [] };
    p.cards.push(card);
    x.added = card.id;
    added.push(card);
  }
  if (added.length) c.updated = now();
  return { added };
}

module.exports = { AUTHOR, PRIMER, CAP, parse, fence, unfence, teamText, build, redact, unpack, addCards };
