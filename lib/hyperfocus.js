// 🎯 Hyperfocus (AIG-871): the swarm's focused view (only one project and the DMs) without the all-hands swarm.
// View only: no agent behaves differently. State lives in data/hyperfocus.conf (one file: every window agrees).
const fs = require('fs');
const path = require('path');
const { DATA, now, load, bad } = require('./store');

const FILE = path.join(DATA, 'hyperfocus.conf');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = s => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {} };

function status() {
  const s = read(), p = s.slug && load(s.slug);
  return s.slug && p ? { on: true, slug: s.slug, name: p.name, since: s.since } : { on: false };
}
// { slug } turns it on (or moves it to another project); { off: true } turns it off.
function set(b) {
  if (b && b.off) { write({}); return status(); }
  const slug = String((b && b.slug) || ''), p = slug && load(slug);
  if (!p) throw bad('project not found', 404);
  const was = read();
  write({ slug, since: was.slug === slug ? was.since : now() });
  return status();
}
module.exports = { status, set };
