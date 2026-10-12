// API routes: projects; cards (split from lib/routes.js, AIG-297).
const { path, S, STATUSES, now, slugify, load, save, localSettings, listSlugs, cleanCard, isRich, bad, need, findCard, presenceOf, startTeam, nudge, restartTeam, logTail, WHERE, attachmentsFor, saveLogo, removeLogo, logoFile, urlFor, summary, share } = require('./ctx');

module.exports = function routes() {
return [
  /* ---------- projects ---------- */
  ['GET', /^\/api\/projects$/, (_, __, q) =>
    S.byOrder(listSlugs().map(load).filter(Boolean).filter(p => q.get('all') || !p.archived).map(summary))],
  // Your project order (AIG-189): the slugs in the order you dragged them in the left rail.
  ['POST', /^\/api\/projects\/order$/, (_, b) => ({ slugs: S.setProjectOrder(b.slugs) })],

  ['POST', /^\/api\/projects$/, (_, b) => {
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    const slug = slugify(b.slug || name);
    if (!slug) throw bad('name needs some letters or numbers');
    if (load(slug)) throw bad('project "' + slug + '" already exists', 409);
    // Card keys are unique (AIG-212: tunio and tuniodiscord both got TUN). A picked key that's taken is refused;
    // a made-up one tries the first two letters with each later letter, then a number.
    const taken = new Set(listSlugs().map(load).filter(Boolean).map(o => o.key)), letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'P';
    if (b.key && taken.has(String(b.key).toUpperCase())) throw bad('key ' + String(b.key).toUpperCase() + ' is already used by another project', 409);
    const key = b.key ? String(b.key).toUpperCase() : [letters.slice(0, 3), ...[...letters.slice(3)].map(l => letters.slice(0, 2) + l), ...[2, 3, 4, 5, 6, 7, 8, 9].map(n => letters.slice(0, 2) + n)]
      .find(k => !taken.has(k)) || letters.slice(0, 2) + Date.now() % 100;
    const p = {
      slug, name,
      key,
      description: b.description || '', path: b.path || '',
      created: now(), updated: now(), nextId: 1, archived: false,
      cards: [], team: [], log: [],
      roles: Array.isArray((localSettings().lead || {}).roles) ? localSettings().lead.roles.slice() : undefined,   // default team roles (AIG-355)
      chatty: (localSettings().lead || {}).chatty || undefined,   // The owner's default for new projects (AIG-235)
    };
    save(p);
    return summary(p);
  }],

  ['GET', /^\/api\/projects\/([^/]+)$/, ([slug]) => { const p = need(load(slug)); return { ...p, ...S.look(p), presence: presenceOf(p.slug) }; }],

  // Wake a sleeping team: starts a background run in the project's folder (no window).
  // { sprint: true }: work through To do, not only the comments (the 🌙 watchman agent, AIG-262).
  ['POST', /^\/api\/projects\/([^/]+)\/wake$/, ([slug], b) => startTeam(need(load(slug)), true, false, !!(b && b.sprint), !!(b && b.sprint))],   // sprint wakes stay in the background (AIG-153)
  // Kill a stuck run and start a fresh one; and read what the agent printed.
  ['POST', /^\/api\/projects\/([^/]+)\/restart$/, ([slug]) => restartTeam(need(load(slug)))],
  // The 👁 Watch view (AIG-154) polls this too: running says whether to keep following.
  ['GET', /^\/api\/projects\/([^/]+)\/agentlog$/, ([slug]) => { const p = need(load(slug)), pr = presenceOf(p.slug); return { text: logTail(p.slug), running: pr.running, startedAt: pr.startedAt, verbose: !!p.verbose }; }],

  ['PATCH', /^\/api\/projects\/([^/]+)$/, ([slug], b) => {
    const p = need(load(slug));
    for (const k of ['name', 'description', 'path', 'archived', 'key']) if (k in b) p[k] = b[k];
    // Steps (AIG-117): up to 6 named sub-columns inside a status, e.g. Design / Build / QA.
    const stepsOf = c => { const s = (Array.isArray(c.steps) ? c.steps : []).map(x => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 6); return s.length ? s : undefined; };
    // Columns (AIG-116): [{ status, name?, emoji?, color?, hidden?, wip? }] in board order; [] or null = default.
    // Display only: statuses (what teams use) never change.
    if ('columns' in b) {
      const cols = Array.isArray(b.columns) ? b.columns : [];
      if (cols.length && (cols.length !== STATUSES.length || !STATUSES.every(s => cols.some(c => c && c.status === s)))) throw bad('columns must list every status once');
      if (cols.some(c => c.color && !/^#[0-9a-f]{6}$/i.test(c.color))) throw bad('colour must look like #3b82f6');
      // WIP limit (AIG-118): a whole number 0..999; empty or 0 = no limit.
      if (cols.some(c => c.wip !== undefined && c.wip !== null && c.wip !== '' && !/^\d{1,3}$/.test(String(c.wip)))) throw bad('limit must be a whole number from 0 to 999');
      p.columns = cols.length ? cols.map(c => ({ status: c.status, name: String(c.name || '').trim().slice(0, 40) || undefined,
        emoji: String(c.emoji || '').trim().slice(0, 8) || undefined, color: c.color || undefined, hidden: !!c.hidden || undefined, wip: +c.wip || undefined,
        steps: stepsOf(c) })) : undefined;
    }
    // Card view (AIG-119): { density: 'compact'|'roomy', show: { assignee, type, priority, sprint, comments, age } }; null = default.
    if ('cardView' in b) {
      const v = b.cardView, KEYS = ['assignee', 'type', 'priority', 'sprint', 'comments', 'age'];
      if (v == null) p.cardView = undefined;
      else {
        if (typeof v !== 'object' || Array.isArray(v)) throw bad('cardView must be an object');
        if (v.density !== undefined && !['compact', 'roomy'].includes(v.density)) throw bad('density must be compact or roomy');
        const show = v.show === undefined ? {} : v.show;
        if (!show || typeof show !== 'object' || Array.isArray(show) || Object.keys(show).some(k => !KEYS.includes(k) || typeof show[k] !== 'boolean')) throw bad('show must set ' + KEYS.join(', ') + ' to true or false');
        p.cardView = { density: v.density || 'roomy', show };
      }
    }
    // Saved views (AIG-121): [{ name, filters }]; filters is the plain object the page's filter bar keeps
    // (q, type, who, sprint today; other keys are kept so the shape can grow). [] or null = none.
    if ('views' in b) {
      const vs = Array.isArray(b.views) ? b.views : [];
      if (vs.length > 20) throw bad('at most 20 views');
      for (const v of vs) {
        if (!v || typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 40) throw bad('view name must be 1 to 40 characters');
        if (!v.filters || typeof v.filters !== 'object' || Array.isArray(v.filters)) throw bad('view filters must be an object');
      }
      p.views = vs.length ? vs.map(v => ({ name: v.name.trim(), filters: JSON.parse(JSON.stringify(v.filters)) })) : undefined;
    }
    // Look (AIG-86): a #rrggbb colour and a short emoji; empty goes back to automatic.
    if ('color' in b) { if (b.color && !/^#[0-9a-f]{6}$/i.test(b.color)) throw bad('colour must look like #3b82f6'); p.color = b.color || undefined; }
    if ('emoji' in b) p.emoji = String(b.emoji || '').trim().slice(0, 8) || undefined;
    if ('lifeBoard' in b) p.lifeBoard = !!b.lifeBoard || undefined;   // 🏡 Life board (AIG-394): New card starts on life types
    if ('chatty' in b) p.chatty = !!b.chatty || undefined;   // chatty lead (AIG-140)
    if ('verbose' in b) p.verbose = !!b.verbose || undefined;   // background runs show their working (AIG-154)
    // Team roles (AIG-366): which AI roles this project may use; all on (or Lead only unchanged) is stored as nothing.
    if ('roles' in b) { const on = S.TEAM_ROLES.filter(r => r === S.TEAM_ROLES[0] || (Array.isArray(b.roles) && b.roles.includes(r))); p.roles = on.length === S.TEAM_ROLES.length ? undefined : on; }
    // Where the team runs (AIG-153): empty = the default in ⚙️ Setup; runCmd is the "Other" command ({folder} filled in).
    if ('runIn' in b) { if (b.runIn && !WHERE.includes(b.runIn)) throw bad('runIn must be ' + WHERE.join(', ') + ' or empty'); p.runIn = b.runIn || undefined; }
    if ('runCmd' in b) p.runCmd = String(b.runCmd || '').trim().slice(0, 500) || undefined;
    save(p);
    return summary(p);
  }],

  // Project picture (AIG-175): data/logos/<slug>.<ext>, p.logo is the URL; Remove goes back to the emoji.
  ['GET', /^\/api\/projects\/([^/]+)\/logo$/, ([slug]) => { need(load(slug)); const f = logoFile(slug); if (!f) throw bad('no logo', 404); return { __file: f }; }],
  ['POST', /^\/api\/projects\/([^/]+)\/logo$/, ([slug], b) => {
    const p = need(load(slug)); saveLogo(slug, b);
    p.logo = urlFor(slug, '/api/projects/' + slug + '/logo'); save(p); return summary(p);
  }],
  ['DELETE', /^\/api\/projects\/([^/]+)\/logo$/, ([slug]) => { const p = need(load(slug)); removeLogo(slug); delete p.logo; save(p); return summary(p); }],

  /* ---------- cards ---------- */
  ['POST', /^\/api\/projects\/([^/]+)\/cards$/, ([slug], b) => {
    const p = need(load(slug)), files = attachmentsFor(slug, b.attachments);
    const c = {
      id: p.key + '-' + p.nextId++,
      title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'backlog',
      assignee: '', sprint: '', blocked: false, needsYou: false,
      ...cleanCard(b, false),
      createdBy: String(b.createdBy || ''),
      ...(b.quick ? { quick: true } : {}),   // 💬 Ask the team (AIG-132): a quick question, answered in Messages
      created: now(), updated: now(), comments: [],
      ...(files.length ? { attachments: files } : {}),   // e.g. a screenshot on a raised bug (AIG-80)
    };
    require('../life').create(c);   // AIG-394: a real-life task is the owner's own, never the team's
    p.cards.push(c);
    share.cardChanged(p, c);   // a link that shows my whole board (AIG-324): the new card goes to the friend too
    save(p);
    if (isRich(c.createdBy) && !(c.lifeType && isRich(c.assignee))) nudge(slug);   // a life card of his own wakes nobody
    return c;
  }],

  // Import without AI (AIG-340): starter cards from the folder's README, TODOs, git history and branches. No tokens.
  ['POST', /^\/api\/projects\/([^/]+)\/starter$/, ([slug], b) => {
    const p = need(load(slug)), r = require('../starter').importStarter(p, String(b.lang || 'en'));
    if (r.added) save(p);
    return r;
  }],

  ['PATCH', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const changes = cleanCard(b, true);
    // Assigning to the owner makes it his task; remember who to hand it back to when he's done.
    if (isRich(changes.assignee) && !isRich(c.assignee)) c.prevAssignee = c.assignee;
    // aigile start (AIG-375): starting a card never leaves it 'waiting on you' unless a real ask or quiz is still open.
    if (b.clearStale && !('needsYou' in changes)) {
      const last = [...c.comments].reverse().find(m => m.mark === 'ask' || isRich(m.author));
      if (!(c.quiz && !c.quiz.done) && !(last && last.mark === 'ask' && !isRich(last.author))) changes.needsYou = false;
    }
    if ('testSteps' in changes && !('info' in changes) && require('../store').isInfoSteps(changes.testSteps)) changes.info = true;   // AIG-392
    if ('testSteps' in changes) delete c.aiCheck;   // handed over again: an old AI tester check no longer counts
    if (changes.status === 'done' && c.status !== 'done') c.reopenTo = (c.status === 'team' && c.prevStatus) || c.status;   // ↩ Reopen goes back here (AIG-403)
    Object.assign(c, changes, { updated: now() });
    if (c.lifeType && ('apptAt' in changes || 'remindMins' in changes)) require('../life').timer(c);   // AIG-394
    share.cardChanged(p, c);   // a card ticked 🔗 (AIG-305): the update goes to the friend, unless the scrub holds it
    save(p);
    return c;
  }],

  ['DELETE', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    p.cards = p.cards.filter(x => x !== c);
    save(p);
    return { deleted: c.id };
  }],

];
};
