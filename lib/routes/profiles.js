// API routes: agent profiles (AIG-415, docs/PROFILES.md): the role and team templates, applying a team to a project,
// your own copies and each project's numbers (AIG-421).
const { S, load, save, localSettings, bad, need, summary } = require('./ctx');
const PR = require('../profiles');
const prefs = () => require('../setup').prefsOf(localSettings()), owner = () => S.owner();

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

  // Project types (AIG-442): default scale tweaks per type, loaded as this project's own numbers; { type } applies, { undo: true } puts back.
  ['GET', /^\/api\/project-types$/, () => require('../projecttypes').list()],
  ['POST', /^\/api\/projects\/([^/]+)\/project-type$/, ([slug], b) => {
    const p = need(load(slug)), PT = require('../projecttypes');
    const r = b && b.undo ? PT.undo(p) : PT.apply(p, String((b && b.type) || ''));
    if (!r) throw bad(b && b.undo ? 'nothing to undo' : 'no project type "' + (b && b.type) + '"', b && b.undo ? 409 : 404);
    save(p);
    return { ...r, projectType: p.projectType || '', canUndo: !!p.typeUndo };
  }],
  // Load another template's numbers into one role on this project (only that role changes).
  ['POST', /^\/api\/projects\/([^/]+)\/profiles\/([^/]+)\/load-template$/, ([slug, q], b) => {
    const p = need(load(slug)), id = PR.findRole(decodeURIComponent(q), p.roles);
    if (!id) throw bad('no role like "' + decodeURIComponent(q) + '"', 404);
    if (!require('../projecttypes').loadTemplate(p, id, String((b && b.template) || ''))) throw bad('no role template "' + (b && b.template) + '"', 404);
    save(p);
    return PR.profileOf(id, prefs(), p, owner());
  }],

  // Premade expert teams (AIG-577..579): the templates, the board's own per-hour baseline for the estimate, and applying one.
  ['GET', /^\/api\/expert-teams$/, () => require('../expertteams').list()],
  // { team, size }: the roster becomes the first `size` roles (Lead first) and the starter cards join the backlog.
  ['POST', /^\/api\/projects\/([^/]+)\/expert-team$/, ([slug], b) => {
    const p = need(load(slug)), XT = require('../expertteams');
    if (!XT.pick(b.team, b.size)) throw bad('no expert team "' + b.team + '"', 404);
    const at = S.now(), r = XT.apply(p, b.team, b.size, x => {
      const c = { id: p.key + '-' + p.nextId++, title: x.title, description: x.description, testSteps: '', type: x.type, priority: x.priority, status: 'backlog',
        assignee: '', sprint: '', blocked: false, needsYou: false, createdBy: '', from: 'expert team', created: at, updated: at, comments: [] };
      p.cards.push(c); return c.id;
    });
    save(p);
    return { ...summary(p), roles: p.roles, added: r.added, removed: r.removed, cards: r.cards };
  }],

  // Your own edited copy of a role (AIG-421), for all projects: { scales: { tests: 4, alone: null }, how: [...], model }.
  ['PUT', /^\/api\/profiles\/roles\/([a-z0-9-]+)$/, ([id], b) => {
    if (!PR.template(id)) throw bad('no role template "' + id + '"', 404);
    const e = PR.badScales(b.scales || {}, PR.ROLE_KEYS); if (e) throw bad(e);
    if ('how' in b && !Array.isArray(b.how)) throw bad('how must be a list of bullets');
    if ('model' in b && b.model && !['haiku', 'sonnet', 'opus'].includes(b.model)) throw bad('model must be haiku, sonnet or opus');
    return { copy: PR.saveOwn(id, b), profile: PR.profileOf(id, prefs(), null, owner()) };
  }],
  // Reset to template: your copy goes.
  ['DELETE', /^\/api\/profiles\/roles\/([a-z0-9-]+)$/, ([id]) => { if (!PR.template(id)) throw bad('no role template "' + id + '"', 404); PR.resetOwn(id); return { profile: PR.profileOf(id, prefs(), null, owner()) }; }],

  // The roles on a project, with your copies and this project's numbers (p.profiles), and the owner's numbers here.
  ['GET', /^\/api\/projects\/([^/]+)\/profiles$/, ([slug]) => {
    const p = need(load(slug));
    return { owner: (p.profiles || {}).owner || {}, roles: PR.roleIds(p.roles).map(id => PR.profileOf(id, prefs(), p, owner())) };
  }],
  // One role's lines for a helper's prompt: aigile profile <slug> <role>. The role by id, old name or role name.
  ['GET', /^\/api\/projects\/([^/]+)\/profiles\/([^/]+)$/, ([slug, q]) => {
    const p = need(load(slug)), id = PR.findRole(decodeURIComponent(q), p.roles);
    if (!id) throw bad('no role like "' + decodeURIComponent(q) + '" (try aigile profile ' + slug + ' to list them)', 404);
    return PR.profileOf(id, prefs(), p, owner());
  }],
  // The 👥 profile editor's brief preview (AIG-423): the role's lines with { scales, how, model } not saved yet laid on top.
  ['POST', /^\/api\/projects\/([^/]+)\/profiles\/([^/]+)\/preview$/, ([slug, q], b) => {
    const p = need(load(slug)), id = PR.findRole(decodeURIComponent(q), p.roles);
    if (!id) throw bad('no role like "' + decodeURIComponent(q) + '"', 404);
    const e = PR.badScales(b.scales || {}, PR.ROLE_KEYS); if (e) throw bad(e);
    if ('how' in b && !Array.isArray(b.how)) throw bad('how must be a list of bullets');
    if (b.model && !['haiku', 'sonnet', 'opus'].includes(b.model)) throw bad('model must be haiku, sonnet or opus');
    return PR.profileOf(id, prefs(), p, owner(), { scales: b.scales || {}, how: b.how, model: b.model });
  }],
  // This project's numbers (AIG-421): key = owner (steps, go, words) or a role; { scales: { tests: 4, alone: null } }.
  ['PUT', /^\/api\/projects\/([^/]+)\/profiles\/([^/]+)$/, ([slug, q], b) => {
    const p = need(load(slug)), key = decodeURIComponent(q) === 'owner' ? 'owner' : PR.findRole(decodeURIComponent(q), p.roles);
    if (!key) throw bad('no role like "' + decodeURIComponent(q) + '"', 404);
    const e = PR.badScales(b.scales || {}, key === 'owner' ? PR.OWNER_KEYS : PR.ROLE_KEYS); if (e) throw bad(e);
    const pp = p.profiles || {}, sc = PR.withScales(pp[key], b.scales);
    if (Object.keys(sc).length) pp[key] = sc; else delete pp[key];
    p.profiles = Object.keys(pp).length ? pp : undefined; save(p);
    return key === 'owner' ? { owner: sc } : PR.profileOf(key, prefs(), p, owner());
  }],
];
};
