// API routes: agent profiles (AIG-415, docs/PROFILES.md): the role and team templates, applying a team to a project.
const { load, save, bad, need, summary } = require('./ctx');
const PR = require('../profiles');

module.exports = function routes() {
return [
  // The templates for the page: every role (with its label) and every team (AIG-420).
  ['GET', /^\/api\/profiles$/, () => ({
    levels: PR.LEVELS,
    roles: Object.values(PR.templates()).map(t => ({ ...t, group: PR.groupOf(t.id), label: PR.label(t.id) })),
    teams: Object.values(PR.teams()),
  })],
  // ➕ Add team (AIG-420): { team, mode: add | replace }. add keeps the roles already on and swaps out the same role at
  // another level; replace leaves only the team (Lead stays on). Says what was added and what went.
  ['POST', /^\/api\/projects\/([^/]+)\/apply-team$/, ([slug], b) => {
    const p = need(load(slug)), mode = b.mode || 'add';
    if (!['add', 'replace'].includes(mode)) throw bad('mode must be add or replace');
    const r = PR.applyTeam(p.roles, b.team, mode);
    if (!r) throw bad('no team template "' + b.team + '"', 404);
    p.roles = r.roles; save(p);
    return { ...summary(p), roles: p.roles, added: r.added, replaced: r.replaced };
  }],
];
};
