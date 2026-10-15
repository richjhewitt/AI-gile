#!/usr/bin/env node
// One-off (AIG-373): collapse open duplicate tasks / questions (same text after whitespace tidying) into the newest, on every
// project, through the board's own API. Usage: node tools/dedupe-open.js [--dry] [project-slug ...]   (AIGILE_URL picks the board)
const base = (process.env.AIGILE_URL || 'http://localhost:4321').replace(/\/$/, '');
const args = process.argv.slice(2), dry = args.includes('--dry'), only = args.filter(a => !a.startsWith('--'));
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ': ' + (j.error || r.statusText));
  return j;
};
(async () => {
  const list = await call('GET', '/api/projects');
  let n = 0;
  for (const p of list.filter(p => !only.length || only.includes(p.slug))) {
    const r = await call('POST', `/api/projects/${p.slug}/dedupe`, { dry });
    for (const c of r.changes) { n += c.removed; console.log(`${dry ? 'would remove' : 'removed'} ${c.removed} older copy/copies of the open ${c.mark} on ${p.slug}/${c.card}: "${c.text}"`); }
  }
  console.log(n ? `${dry ? 'would remove' : 'removed'} ${n} duplicate(s)` : 'no open duplicates');
})().catch(e => { console.error('error: ' + e.message); process.exitCode = 1; });
