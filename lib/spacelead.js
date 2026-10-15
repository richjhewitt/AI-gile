// 🪐 Space lead (AIG-439): a space (a project with projects inside it) may name one lead, off by default. `p.spaceLead` is the
// slug of the project whose lead leads the space: the space itself, or one of its own (direct, not archived) child projects.
// With a child named, the space's owner news (new cards, comments, 💬 Lead chat, stand-ups) goes to that child's lead: it is
// added to the child's ownerNews and /updates, and a nudge on the space wakes the child's team. No field (or a stale one,
// e.g. the child moved out) = today's behaviour: each project keeps its own lead.
const { peek, listSlugs, bad } = require('./store');

// The slug of the project that leads this space, or '' (off, or no longer valid).
// `all` (optional): the projects the caller already read this request, so no project is read twice (AIG-1103).
function of(p, all) {
  const v = p && p.spaceLead;
  if (!v) return '';
  if (v === p.slug) return v;
  const k = all ? all.find(x => x.slug === v) : peek(v);
  return k && k.parent === p.slug && !k.archived ? v : '';
}
// The lead lives in another project: the space's news goes there.
const elsewhere = p => { const v = of(p); return v && v !== p.slug ? v : ''; };
// The spaces this project leads (its own space included), live ones only.
const spacesOf = (slug, all) => (all || listSlugs().map(peek)).filter(s => s && !s.archived && s.spaceLead && of(s, all) === slug);
// Only the spaces led from another project: their news is this project's news too.
const ledFrom = slug => spacesOf(slug).filter(s => s.slug !== slug);

// PATCH value: '' / null = off; else the space's own slug or a child's slug.
function set(p, v) {
  v = v == null ? '' : String(v).trim();
  if (!v) { p.spaceLead = undefined; return; }
  if (v !== p.slug) { const k = peek(v); if (!k || k.parent !== p.slug || k.archived) throw bad('the space lead must be this space or one of its own projects'); }
  p.spaceLead = v;
}

// For the lead's brief: each space it leads, with its child projects and their To do.
function brief(slug, all) {
  all = all || listSlugs().map(peek).filter(Boolean);
  return spacesOf(slug, all).map(s => ({ slug: s.slug, name: s.name,
    kids: all.filter(k => k.parent === s.slug && !k.archived).map(k => ({ slug: k.slug, name: k.name,
      todo: (k.cards || []).filter(c => c.status === 'todo').map(c => ({ id: c.id, title: c.title, priority: c.priority })) })) }));
}

module.exports = { of, elsewhere, spacesOf, ledFrom, set, brief };
