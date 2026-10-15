// 🛎️ Service desk sorting (AIG-1104, docs/SERVICE-MGMT-PLAN.md phase 2, card 6): a card that comes in from the public feedback form or
// from a friend (the friend lane, an approved request) on a project where the service is on gets a desk kind, c.desk = { kind, auto }:
// incident (something is broken), request (please add / could you) or idea (anything else), by plain word rules, no AI. An incident
// also becomes an incident card (c.desk.was remembers the type it had). The owner can change the kind on the card (setKind).
const S = require('./store');

const KINDS = ['request', 'incident', 'idea'];
const INCIDENT = /\b(broken|breaks?|down|outage|errors?|crash(?:es|ed|ing)?|fails?|failed|failing|failure|not working|doesn[’']?t work|does not work|won[’']?t (?:load|open|work|start)|can[’']?t|cannot|unable to|offline|unreachable|stuck|kapot|werkt niet|storing|fout|foutmelding)\b|\b50[0-4]\b/i;
const REQUEST = /\b(please (?:add|make|allow|support|build|create|change)|could you|can you|would you|would it be possible|feature|i[’']?d like|i would like|i want|add support|wish|graag|kunnen jullie|zou je)\b/i;

// The kind for a piece of text: a broken thing wins over a wish.
function classify(text) {
  const t = String(text == null ? '' : text);
  return INCIDENT.test(t) ? 'incident' : REQUEST.test(t) ? 'request' : 'idea';
}
// A new desk card: sorted only where the service is on. Mutates the card (before it is saved); returns the kind or null.
function sort(p, c, text) {
  if (!require('./service').of(p)) return null;
  const kind = classify(text);
  c.desk = { kind, auto: true };
  if (kind === 'incident' && c.type !== 'incident') { c.desk.was = c.type; c.type = 'incident'; if (c.priority === 'normal') c.priority = 'high'; }
  dupCheck(p, c);   // AIG-1105
  return kind;
}
// The owner changes the kind: an incident becomes an incident card, leaving incident gives the old type back.
function setKind(p, c, kind) {
  kind = String(kind || '');
  if (!KINDS.includes(kind)) throw S.bad('the desk kind must be request, incident or idea');
  const d = c.desk = { ...(c.desk || {}), kind, auto: false };
  if (kind === 'incident' && c.type !== 'incident') { d.was = c.type; c.type = 'incident'; }
  else if (kind !== 'incident' && c.type === 'incident' && d.was) { c.type = d.was; delete d.was; }
  c.updated = S.now();
  return d;
}

// ---- 🔎 Duplicate hint (AIG-1105): one cheap check per new desk card against the project's open cards. First plain word overlap (no AI):
// a close match is "looks like AIG-x" at once; a middling one is "unsure", and then (only if AI is allowed) ONE tiny Haiku call decides,
// the same call the Scrum Master uses for its idea sorting. Never more than one AI call per card (c.desk.ai is set before the call).
const STOP = new Set('the and for are but not you your with this that have has had was were what when where why how from into out can its our they them then than too very just also about there their would could should will any all one get got did does don page language went wrong happened friend text untrusted website visitor please'.split(' '));
const words = s => new Set((String(s == null ? '' : s).toLowerCase().replace(/<<\/?friend-text[^>]*>>/g, ' ').match(/[\p{L}\p{N}]{3,}/gu) || []).filter(w => !STOP.has(w)));
const textOf = c => (c.title || '') + ' ' + (c.description || '');
function overlap(a, b) { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n); }
const SURE = 0.6, MAYBE = 0.25;
// Score the open cards against card c: { sure: id } | { maybe: [ids] } | {}.
function similar(p, c) {
  const mine = words(textOf(c)); if (mine.size < 2) return {};
  const scored = (p.cards || []).filter(x => x.id !== c.id && x.status !== 'done' && !x.dm && !x.lifeType).map(x => ({ id: x.id, n: overlap(mine, words(textOf(x))) })).sort((a, b) => b.n - a.n);
  if (!scored.length || scored[0].n < MAYBE) return {};
  return scored[0].n >= SURE ? { sure: scored[0].id } : { maybe: scored.filter(x => x.n >= 0.15).slice(0, 4).map(x => x.id) };
}
// Called at the end of sort(): the sure answer is kept now; an unsure one waits in c.desk.cand for settle().
function dupCheck(p, c) {
  const r = similar(p, c);
  if (r.sure) c.desk.dup = { id: r.sure, how: 'text' }; else if (r.maybe) c.desk.cand = r.maybe;
}
const askHaiku = prompt => require('./scrummaster').haikuText(prompt);
const aiAllowed = () => require('./scrummaster').aiAllowed();
// After a save: settle the unsure cards of the project. The wish for a call is written down first (one per card, ever).
async function settle(slug) {
  const p = S.load(slug); if (!p) return;
  const todo = (p.cards || []).filter(c => c.desk && c.desk.cand).map(c => ({ id: c.id, cand: c.desk.cand, title: c.title, text: textOf(c) }));
  if (!todo.length) return;
  const ok = aiAllowed();
  for (const c of p.cards) if (c.desk && c.desk.cand) { delete c.desk.cand; if (ok) c.desk.ai = true; }
  S.save(p);
  if (!ok) return;
  for (const t of todo) {
    const list = t.cand.map(id => { const x = p.cards.find(y => y.id === id); return x ? id + ': "' + String(x.title).replace(/<<[^>]*>>/g, '').slice(0, 100) + '"' : ''; }).filter(Boolean).join('; ');
    const prompt = `A new report: "${t.text.replace(/<<[^>]*>>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)}". Open cards: ${list}. Is the new report about the same thing as one of these cards? Reply with only its id, or none.`;
    const out = await askHaiku(prompt).catch(() => null);
    const hit = out && t.cand.find(id => new RegExp('(^|[^\\w-])' + id.replace(/[^\w-]/g, '') + '([^\\w-]|$)', 'i').test(out));
    if (!hit) continue;
    const q = S.load(slug), cc = q && q.cards.find(x => x.id === t.id);
    if (cc && cc.desk && !cc.desk.dup && !cc.desk.linked) { cc.desk.dup = { id: hit, how: 'ai' }; S.save(q); }
  }
}
const after = slug => { setImmediate(() => settle(slug).catch(() => {})); };
// 🔗 The owner presses Link on "looks like AIG-x": the card remembers it and both cards get a plain note.
function link(p, c) {
  const d = c.desk && c.desk.dup; if (!d) throw S.bad('no duplicate hint on this card', 409);
  const other = p.cards.find(x => x.id === d.id), at = S.now(), tr = require('./i18n').t;
  c.desk.linked = d.id; delete c.desk.dup; c.updated = at;
  c.comments.push({ author: 'AI-gile', at, text: tr('srv.desk.linked', { id: d.id }) });
  if (other) { other.comments.push({ author: 'AI-gile', at, text: tr('srv.desk.linked', { id: c.id }) }); other.desk = { ...(other.desk || {}), linked: c.id }; other.updated = at; }
  return c.desk;
}
module.exports = { KINDS, classify, sort, setKind, similar, settle, after, link };
