// 🌙 Assumptions log (AIG-477): every guess a lead makes while the owner rests, across all projects, newest first.
// A comment counts when it has mark 'assume' (aigile assume) or starts with "Assumption:" (older comments are picked up too).
// The owner's answer sits on the comment itself: assumeState 'ok' (👍 fine) | 'plug' (✋ plug this).
const { listSlugs, load, save, now, bad } = require('./store');
const IS = m => m.mark === 'assume' || /^[\s>*_-]*Assumption:/i.test(m.text || '');

function list() {
  const out = [];
  for (const slug of listSlugs()) {
    let p; try { p = load(slug); } catch { continue; }
    if (!p) continue;
    for (const c of p.cards || []) for (const m of c.comments || []) {
      if (!IS(m)) continue;
      out.push({ project: p.name || slug, slug, id: c.id, title: c.title, summary: String(c.description || '').split('\n').map(s => s.trim()).find(Boolean) || '', ...(m.assume ? { assume: m.assume } : {}), author: m.author, at: m.at, text: m.text, state: m.assumeState || '' });
    }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// { slug, id, at, state } -> remembers the owner's answer ('' clears it).
function resolve(b) {
  if (!['ok', 'plug', ''].includes(b.state)) throw bad('state must be ok or plug');
  const p = load(b.slug), c = p && (p.cards || []).find(x => x.id === b.id);
  const m = c && c.comments.find(x => x.at === b.at && IS(x));
  if (!m) throw bad('assumption not found', 404);
  if (b.state) m.assumeState = b.state; else delete m.assumeState;
  c.updated = now(); save(p);
  return { ok: true };
}
module.exports = { list, resolve };
