// The chat follows the lead to the next card (AIG-426): when a lead closes a card and carries on in another one
// ("Next step (SMI-19): ..."), the closed card remembers it as followUp, so the owner's chat can go there too.
const { isRich, bad } = require('./store');

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CLOSING = ['done', 'verify'];

// The card the lead's last comment on `c` points at: a card of the same project, never itself, never the owner's words.
function find(p, c) {
  const last = [...c.comments].reverse().find(m => !isRich(m.author) && m.from !== 'outside');
  if (!last || !p.key) return '';
  const ids = new Set(p.cards.map(x => x.id)), text = String(last.text || '');
  const id = esc(p.key) + '-\\d+';
  const all = (text.match(new RegExp('\\b' + id + '\\b', 'g')) || []).filter(x => x !== c.id && ids.has(x));
  if (!all.length) return '';
  const nxt = text.match(new RegExp('next[^\\n]{0,60}?(\\b' + id + '\\b)', 'i'));
  return nxt && all.includes(nxt[1]) ? nxt[1] : all.at(-1);
}

// Call after a comment or a status change, before saving: a closing card gets (or drops) its followUp.
function track(p, c) {
  if (!CLOSING.includes(c.status)) return;
  const to = find(p, c);
  if (to) c.followUp = to; else if (c.followUp && !c.followSet) delete c.followUp;
}

// aigile next-card: set it on purpose.
function set(p, c, to) {
  const t = p.cards.find(x => x.id === String(to || '').trim().toUpperCase());
  if (!t) throw bad('no such card: ' + to);
  if (t.id === c.id) throw bad('a card cannot follow itself');
  c.followUp = t.id; c.followSet = true;
  return c;
}

module.exports = { find, track, set };
