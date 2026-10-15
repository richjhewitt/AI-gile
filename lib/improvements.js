// 📈 Improvement list (AIG-1157): read-only aggregation of what the team decided to get better at, across all projects (not archived).
// Retro suggestion cards (AIG-865: open / go / notyet), post-incident review action items (AIG-1108: ticked, made into a card, open)
// and problem cards with a fix, a change card (AIG-887, AIG-857). Nothing is stored; the page links to the cards.
const store = require('./store');

const status = (p, id) => { const c = (p.cards || []).find(x => x.id === id); return c ? c.status : ''; };

function of(p) {
  const out = [], base = c => ({ slug: p.slug, project: p.name, id: c.id });
  for (const c of p.cards || []) {
    if (c.retro) out.push({ ...base(c), kind: 'retro', title: c.retro.text, why: c.retro.why || '', state: c.retro.done === 'added' ? 'go' : c.retro.done === 'declined' ? 'notyet' : 'open' });
    if (c.review && Array.isArray(c.review.actions)) c.review.actions.forEach((a, i) => out.push({ ...base(c), kind: 'review', title: a.text, why: c.title, n: i,
      state: a.card ? 'card' : a.ok ? 'ticked' : 'open', ...(a.card ? { card: a.card, cardStatus: status(p, a.card) } : {}) }));
    if (c.type === 'problem' && c.changeId) out.push({ ...base(c), kind: 'problem', title: c.title, why: c.rootCause || '', state: 'fix', card: c.changeId, cardStatus: status(p, c.changeId) });
  }
  return out;
}

function all() {
  const out = [];
  for (const s of store.listSlugs()) { const p = store.load(s); if (p && !p.archived) out.push(...of(p)); }
  return out;
}

module.exports = { all, of };
