// ScrumGlance (AIG-688): plain-code counts and short lists for the live panel: in progress, to do, waiting for the
// owner to test, done today. One project, or every active one. No AI, no tokens.
const { load, listSlugs } = require('./store');
const SHOW = 6;   // titles listed per group; the count is always the full number
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function glance(slug) {
  const ps = (slug ? [load(slug)] : listSlugs().map(load)).filter(p => p && !p.archived);
  const out = { doing: [], todo: [], verify: [], done: [] }, since = startOfToday();
  for (const p of ps) for (const c of p.cards || []) {
    const g = c.status === 'doing' ? 'doing' : c.status === 'todo' ? 'todo' : c.status === 'verify' ? 'verify'
      : c.status === 'done' && Date.parse(c.updated) >= since ? 'done' : null;
    if (g) out[g].push({ project: p.slug, name: p.name, id: c.id, title: c.title, at: c.updated || '' });
  }
  const res = { project: slug || null };
  for (const g of ['doing', 'todo', 'verify', 'done']) {
    out[g].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    res[g] = { n: out[g].length, cards: out[g].slice(0, SHOW) };
  }
  return res;
}
module.exports = { glance };
