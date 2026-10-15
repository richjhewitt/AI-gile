// GET /api/rev (AIG-920), also the key for cached views (AIG-1091): a few bytes that change whenever anything in data/ or the presence moves.
const path = require('path');
const S = require('./store');
module.exports = function rev() {
  const fs = require('fs'), h = require('crypto').createHash('sha1'), sig = f => { try { const st = fs.statSync(f, { bigint: true }); return st.mtimeNs + ':' + st.size; } catch { return '-'; } };
  // projects: one short stamp per project (its file and the team presence), so a board window refetches its own project
  // only when that one changed, not whenever any project in a swarm moves.
  const P = require('./presence'), own = {}, short = x => require('crypto').createHash('sha1').update(x).digest('hex').slice(0, 8);
  for (const e of fs.readdirSync(S.DATA, { withFileTypes: true })) {
    if (!e.isFile() || e.name.endsWith('.tmp')) continue;
    const g = sig(path.join(S.DATA, e.name));
    h.update(e.name + '=' + g + ';');
    if (e.name.endsWith('.json')) { const slug = e.name.slice(0, -5); own[slug] = g + '/' + P.presenceRev(slug); }
  }
  const space = new Map();   // root -> the stamps of every project in that space
  for (const slug of Object.keys(own)) { const r = S.rootOf(slug); space.set(r, (space.get(r) || '') + slug + '=' + own[slug] + ';'); }
  const projects = {};
  const shared = sig(path.join(S.DATA, 'project-order.conf')) + ';' + sig(S.LOCAL_FILE);   // child order and summaries in a space page
  for (const slug of Object.keys(own)) projects[slug] = short(space.get(S.rootOf(slug)) + shared);
  h.update('local=' + sig(S.LOCAL_FILE) + ';presence=' + P.presenceRev());
  return { rev: h.digest('hex').slice(0, 16), projects };
};
