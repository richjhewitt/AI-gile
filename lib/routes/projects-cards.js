// API routes: projects; cards (split from lib/routes.js, AIG-297).
const { leadOf, path, S, STATUSES, connectFolder, now, slugify, load, save, localSettings, listSlugs, cleanCard, isRich, bad, need, findCard, presenceOf, startTeam, nudge, restartTeam, logTail, WHERE, attachmentsFor, saveLogo, removeLogo, logoFile, urlFor, summary, share } = require('./ctx');

const offline = require('../offline');
const dmrules = require('../dmrules');

// Is this wake the owner's own click (the page, or the CLI as the owner)? An agent running `aigile wake` is not (AIG-465).
// Who is asking (X-Aigile-As, sent by the CLI); empty from the page.
const asOf = req => { try { return decodeURIComponent(String(((req && req.headers) || {})['x-aigile-as'] || '')); } catch { return ''; } };
const fromOwner = req => { try { share.ownerOnly(req); return true; } catch { return false; } };

// Makes a project (POST /api/projects; the playground route reuses it).
function createProject(b, req) {
  require('../roles').mayMake(asOf(req));
  const name = String(b.name || '').trim();
  if (!name) throw bad('name is required');
  const slug = slugify(b.slug || name);
  if (!slug) throw bad('name needs some letters or numbers');
  if (load(slug)) throw bad('project "' + slug + '" already exists', 409);
  const parent = S.checkParent(slug, b.parent);   // 🪐 inside a space (AIG-433)
  // Card keys are unique (AIG-212: tunio and tuniodiscord both got TUN). A picked key that's taken is refused;
  // a made-up one tries the first two letters with each later letter, then a number.
  const taken = new Set(listSlugs().map(load).filter(Boolean).map(o => o.key)), letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'P';
  if (b.key && taken.has(String(b.key).toUpperCase())) throw bad('key ' + String(b.key).toUpperCase() + ' is already used by another project', 409);
  const key = b.key ? String(b.key).toUpperCase() : [letters.slice(0, 3), ...[...letters.slice(3)].map(l => letters.slice(0, 2) + l), ...[2, 3, 4, 5, 6, 7, 8, 9].map(n => letters.slice(0, 2) + n)]
    .find(k => !taken.has(k)) || letters.slice(0, 2) + Date.now() % 100;
  const p = {
    slug, name,
    key, parent,
    description: b.description || '', path: b.path || '',
    created: now(), updated: now(), nextId: 1, archived: false,
    cards: [], team: [], log: [],
    roles: Array.isArray((localSettings().lead || {}).roles) ? localSettings().lead.roles.slice() : undefined,   // default team roles (AIG-355)
    chatty: (localSettings().lead || {}).chatty || undefined,   // The owner's default for new projects (AIG-235)
  };
  save(p);
  // 📁 folder: true makes and connects <projectsFolder>/<name> (default: next to AI-gile), or a given path (AIG-706).
  if (b.folder) {
    const dir = b.folder === true ? path.join(S.projectsFolder(), name.replace(/[<>:"/\\|?*]/g, '').trim() || slug) : b.folder;
    const r = connectFolder(p, dir, true);
    return { ...summary(load(slug)), folder: r.path, done: r.done };
  }
  return summary(p);
}

module.exports = function routes() {
return [
  /* ---------- projects ---------- */
  ['GET', /^\/api\/projects$/, (_, __, q) =>
    S.byOrder(listSlugs().map(S.peek).filter(Boolean).filter(p => q.get('all') || !p.archived).map(summary))],
  // Your project order (AIG-189): the slugs in the order you dragged them in the left rail.
  ['POST', /^\/api\/projects\/order$/, (_, b) => ({ slugs: S.setProjectOrder(b.slugs) })],

  // Who may make projects (AIG-676, lib/roles.js): the page and the owner always; a named caller (--as NAME) needs the tick.
  ['GET', /^\/api\/roles$/, () => require('../roles').status()],
  ['POST', /^\/api\/roles$/, (_, b, q, req) => { share.ownerOnly(req); return require('../roles').setCanMake(b.name, b.canMake); }],

  ['POST', /^\/api\/projects$/, (_, b, q, req) => createProject(b, req)],
  // Playground (AIG-818): a project for one friend in the Playgrounds space, with an invite code. Owner only.
  ['POST', /^\/api\/playgrounds$/, (_, b, q, req) => { share.ownerOnly(req); return require('../playground').create(b.name, x => createProject(x, req), slugify); }],

  // 📦 Share offline (AIG-446): the project as one .aigile file, and a file opened as a new project ({ file, preview: true } only looks).
  ['GET', /^\/api\/projects\/([^/]+)\/export$/, ([slug]) => offline.exportProject(need(load(slug)))],
  ['POST', /^\/api\/projects\/import$/, (_, b) => b.preview ? offline.preview(b.file) : summary(load(offline.importProject(b.file).slug))],
  // space (AIG-434): the spaces it sits in (outermost first) and the projects inside it, for the crumb and the space grid.
  ['GET', /^\/api\/projects\/([^/]+)$/, ([slug]) => {
    const p = need(S.peek(slug)), all = listSlugs().map(S.peek).filter(Boolean), up = [];   // read-only: peek (AIG-920)
    for (let q = all.find(x => x.slug === p.parent); q && up.length < 50 && !up.some(u => u.slug === q.slug); q = all.find(x => x.slug === q.parent)) up.unshift({ slug: q.slug, name: q.name, ...S.look(q) });
    const kids = S.byOrder(all.filter(x => x.parent === p.slug && !x.archived)).map(x => ({ ...summary(x), kids: all.filter(y => y.parent === x.slug && !y.archived).length }));
    // 🪐 The chain (AIG-450): inside this space, cards that wait for a card of another project, with how far that card is.
    const inside = [p], byKey = new Map(all.map(x => [x.key, x]));
    for (let i = 0; i < inside.length && inside.length < 200; i++) inside.push(...all.filter(x => x.parent === inside[i].slug && !inside.includes(x)));
    const chain = !kids.length ? [] : inside.flatMap(x => x.cards.filter(c => c.status !== 'done' && (c.waitsFor || []).some(id => !id.startsWith(x.key + '-')))
      .map(c => ({ id: c.id, title: c.title, slug: x.slug, project: x.name, waits: c.waitsFor.filter(id => !id.startsWith(x.key + '-')).map(id => {
        const o = byKey.get(id.replace(/-\d+$/, '')), b = o && inside.includes(o) && o.cards.find(y => y.id === id);
        return b ? { id, title: b.title, status: b.status, slug: o.slug, project: o.name } : null;
      }).filter(Boolean) }))).filter(x => x.waits.length).slice(0, 100);
    // 🪐 Roll-up (AIG-436): the open cards of every project inside this space, for the space board's children's cards view.
    const rollup = !kids.length ? [] : inside.filter(x => x !== p && !x.archived).flatMap(x => x.cards.filter(c => c.status !== 'done' && !c.dm && !c.lifeType)
      .map(c => ({ id: c.id, title: c.title, status: c.status, type: c.type, priority: c.priority, assignee: c.assignee || '', needsYou: !!c.needsYou, blocked: !!c.blocked,
        updated: c.updated, slug: x.slug, project: x.name, color: S.look(x).color || '' })))
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 400);
    const leads = require('../spacelead').brief(p.slug);   // 🪐 AIG-439: the spaces this project's lead leads, with their projects' To do (for the brief)
    return { ...p, cards: require('../targets').stamp(p), pathMissing: (!!p.path && !require('fs').existsSync(p.path)) || undefined, ...S.look(p), presence: presenceOf(p.slug), space: { up, kids, chain, rollup }, ...(leads.length ? { leads } : {}) };
  }],

  // Wake a sleeping team: starts a background run in the project's folder (no window).
  // { sprint: true }: work through To do, not only the comments (the 🌙 watchman agent, AIG-262).
  ['POST', /^\/api\/projects\/([^/]+)\/wake$/, ([slug], b, _q, req) => startTeam(need(load(slug)), true, false, !!(b && b.sprint), !!(b && b.sprint), !(b && b.sprint) && fromOwner(req))],   // sprint wakes stay in the background (AIG-153)
  // Kill a stuck run and start a fresh one; and read what the agent printed.
  ['POST', /^\/api\/projects\/([^/]+)\/restart$/, ([slug]) => restartTeam(need(load(slug)))],
  // The 👁 Watch view (AIG-154) polls this too: running says whether to keep following.
  // ?worker=<card id>: a 🐝 swarm worker's log (AIG-901).
  ['GET', /^\/api\/projects\/([^/]+)\/agentlog$/, ([slug], _b, q) => {
    const p = need(load(slug)), pr = presenceOf(p.slug), wid = q.get('worker');
    if (wid) { const w = (pr.workers || []).find(x => x.id === wid); return { text: logTail(p.slug + '#' + wid), running: !!w, startedAt: w ? w.startedAt : null, verbose: true, worker: wid, branch: w ? w.branch : '' }; }
    return { text: logTail(p.slug), running: pr.running, startedAt: pr.startedAt, verbose: !!p.verbose };
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/workers\/([^/]+)\/stop$/, ([slug, id]) => require('../swarmworkers').stop(need(load(slug)).slug, id)],   // 🐝 stop one swarm worker (AIG-901)

  ['PATCH', /^\/api\/projects\/([^/]+)$/, ([slug], b, _q, req) => {
    const p = need(load(slug));
    for (const k of ['name', 'description', 'path', 'archived', 'key']) if (k in b) p[k] = b[k];
    if ('parent' in b) p.parent = S.checkParent(p.slug, b.parent);   // 🪐 move into a space, or '' / null to take it out (AIG-433)
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
    if ('private' in b || 'public' in b || 'personal' in b || 'publicName' in b || 'publicHideTitles' in b) require('../publicboard').setFlags(p, b);   // 🔒 hidden while streaming (AIG-590) / 🌍 public (AIG-602), never both
    if ('feedback' in b) { require('../share').ownerOnly(req); require('../feedback').setFlags(p, b.feedback); }   // AIG-969: public feedback form (owner only)
    if ('dod' in b) require('../dod').set(p, b.dod || {});   // Definition of Ready / Done (AIG-864)
    if ('service' in b) { require('../share').ownerOnly(req); require('../service').set(p, b.service); }   // 🛎️ AIG-1046: service details (owner only)
    if ('callUrl' in b) p.callUrl = require('../store').callUrl(b.callUrl);   // AIG-861: the Join call link
    if ('peerReview' in b) { require('../share').ownerOnly(req); p.peerReview = !!b.peerReview || undefined; }   // AIG-993: another AI checks each handed-over card
    if ('spaceLead' in b) { require('../share').ownerOnly(req); require('../spacelead').set(p, b.spaceLead); }   // 🪐 AIG-439: one lead for the whole space (owner only)
    if ('approvals' in b) { require('../share').ownerOnly(req); p.approvals = !!b.approvals || undefined; }   // AIG-814: friends' cards wait for the owner's OK
    // 🖥️ This project's server (AIG-774): a name from Setup > My servers, and optional user and folder that replace the server's own.
    if ('srv' in b) {
      const v = b.srv && typeof b.srv === 'object' ? b.srv : {}, name = String(v.name || '').trim().slice(0, 60), sv = require('../servers');
      if (String(v.user || '').trim() && !sv.USER.test(String(v.user).trim())) throw bad('that user name has characters ssh will not take');
      p.srv = name ? { name, ...sv.projectSrv(v) } : undefined;
    }
    if ('aiOff' in b) p.aiOff = !!b.aiOff || undefined;   // AIG-608: AI off for this project
    if ('chatty' in b) p.chatty = !!b.chatty || undefined;   // chatty lead (AIG-140)
    if ('secondLead' in b) p.secondLead = !!b.secondLead || undefined;   // a second lead allowed when there is lots of work (AIG-447)
    if ('verbose' in b) p.verbose = !!b.verbose || undefined;   // background runs show their working (AIG-154)
    // Team roles (AIG-366): which AI roles this project may use; today's 8 all on is stored as nothing. Old names or
    // role template ids (AIG-420); Lead is always on, unknown ones are dropped.
    if ('roles' in b) p.roles = require('../profiles').storeRoles(Array.isArray(b.roles) ? b.roles : []);
    // Where the team runs (AIG-153): empty = the default in ⚙️ Setup; runCmd is the "Other" command ({folder} filled in).
    if ('runIn' in b) { if (b.runIn && !WHERE.includes(b.runIn)) throw bad('runIn must be ' + WHERE.join(', ') + ' or empty'); p.runIn = b.runIn || undefined; }
    if ('runCmd' in b) p.runCmd = String(b.runCmd || '').trim().slice(0, 500) || undefined;
    // Token use shared with friends (AIG-685/686): the switch and who sees it; a change goes out straight away.
    const usageShare = 'shareUsage' in b || 'shareUsageWith' in b;
    if (usageShare) { require('../share').ownerOnly(req); require('../usageshare').setFlags(p, b); }   // the owner's, never a team's
    save(p);
    if (usageShare) require('../usageshare').tick().catch(() => {});
    return summary(p);
  }],

  // Project picture (AIG-175): data/logos/<slug>.<ext>, p.logo is the URL; Remove goes back to the emoji.
  ['GET', /^\/api\/projects\/([^/]+)\/logo$/, ([slug]) => { need(load(slug)); const f = logoFile(slug); if (!f) throw bad('no logo', 404); return { __file: f }; }],
  ['POST', /^\/api\/projects\/([^/]+)\/logo$/, ([slug], b) => {
    const p = need(load(slug)); saveLogo(slug, b);
    p.logo = urlFor(slug, '/api/projects/' + slug + '/logo'); save(p); return summary(p);
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/feedback\/pull$/, ([slug], b, q, req) => { share.ownerOnly(req); return require('../feedback').pull(slug); }],   // AIG-969: pull website visitors' reports now
  ['GET', /^\/api\/projects\/([^/]+)\/public$/, ([slug]) => require('../publicboard').status(slug)],
  ['DELETE', /^\/api\/projects\/([^/]+)\/logo$/, ([slug]) => { const p = need(load(slug)); removeLogo(slug); delete p.logo; save(p); return summary(p); }],

  /* ---------- cards ---------- */
  ['POST', /^\/api\/projects\/([^/]+)\/cards$/, ([slug], b) => {
    const p = need(load(slug));
    // AIG-1061: the owner's same text twice within 10 s (a double submit) is the same card, not another one; checked before any attachment is saved
    const tt = String(b.title || '').trim(), dd = String(b.description || '').trim();
    const same = (tt || dd) && isRich(b.createdBy) && p.cards.find(x => isRich(x.createdBy) && (x.title || '').trim() === tt && (x.description || '').trim() === dd && Date.now() - Date.parse(x.created) < 10000);
    if (same) return same;
    const files = attachmentsFor(slug, b.attachments);
    // AIG-399: with Tidy cards on, a card with only a description gets its first line (about 60 characters) as a
    // temporary title; the lead retitles it in the usual tidy pass (tidyTitle marks it).
    const firstLine = String(b.description || '').trim().split('\n')[0].trim();
    const tidyTitle = !String(b.title || '').trim() && !!firstLine && !!(localSettings().lead || {}).tidyCards;
    if (tidyTitle) b = { ...b, title: firstLine.length > 60 ? firstLine.slice(0, 59).trimEnd() + '…' : firstLine };
    const c = {
      id: p.key + '-' + p.nextId++,
      title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'backlog',
      assignee: '', sprint: '', blocked: false, needsYou: false,
      ...cleanCard(b, false),
      ...(tidyTitle ? { tidyTitle: true } : {}),
      createdBy: String(b.createdBy || ''),
      ...(b.allhands ? { allhands: true } : {}),
      ...(b.quick ? { quick: true } : {}),   // 💬 Ask the team (AIG-132): a quick question, answered in Messages
      ...(b.dmTo ? { dmTo: String(b.dmTo).slice(0, 60) } : {}),   // 💡 idea sent to one teammate, or '_best' (AIG-833)
      created: now(), updated: now(), comments: [],
      ...(files.length ? { attachments: files } : {}),   // e.g. a screenshot on a raised bug (AIG-80)
    };
    if (c.status === 'team' && require('../noai').isOn()) c.status = 'todo';   // AIG-821: no AI, no team column
    if (c.checklist) c.checklist = S.keepTicks([], c.checklist);
    if (c.waitsFor) { S.checkWaits(p, c, c.waitsFor); }
    require('../life').create(c);   // AIG-394: a real-life task is the owner's own, never the team's
    p.cards.push(c);
    if (c.waitsFor) S.syncHolds(p, c, []);
    share.cardChanged(p, c);   // a link that shows my whole board (AIG-324): the new card goes to the friend too
    save(p);
    if (c.quick && !c.allhands && isRich(c.createdBy) && dmrules.on()) {   // AIG-551: a DM to the lead while AI is held back: a free, rule-based reply
      dmrules.postLead(slug, c.id, leadOf(p), dmrules.replyLead(load(slug), c.description || c.title));
      return findCard(load(slug), c.id);
    }
    if (isRich(c.createdBy) && !(c.lifeType && isRich(c.assignee))) nudge(slug);   // a life card of his own wakes nobody
    return c;
  }],

  // ➡️ Move a card to another project (AIG-438): a copy lands there (new id, comments and a link back); the original is
  // closed with a link forward. Waits and holds are dropped (they point at the old board); pictures stay with the old card.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/moveproject$/, ([slug, id], b) => {
    const from = need(load(slug)), c = findCard(from, id);
    const to = need(load(String(b.to || '')));
    if (to.slug === from.slug) throw bad('that card is already in this project');
    if (c.status === 'done') throw bad('move it back out of Done first');
    const nid = to.key + '-' + to.nextId++, t = now();
    const copy = { ...JSON.parse(JSON.stringify(c)), id: nid, status: c.status === 'doing' ? 'todo' : c.status, assignee: '', created: t, updated: t };
    for (const k of ['waitsFor', 'holds', 'waiting', 'waitHeld', 'group', 'sprint', 'attachments', 'step', 'checklist']) if (k !== 'checklist') delete copy[k];
    copy.comments = [...(c.comments || []), { author: S.owner(), at: t, text: `➡️ Moved here from ${from.name} ${c.id}` + ((c.attachments || []).length ? ' (its pictures stay on the old card)' : '') }];
    for (const k of ['incidents', 'problemId', 'changeId', 'riskId']) delete copy[k];   // board-local links stay behind
    for (const x of from.cards) {   // and the old board's cards no longer point at the moved one
      if (x === c) continue;
      if (Array.isArray(x.incidents) && x.incidents.includes(c.id)) x.incidents = x.incidents.filter(i => i !== c.id);
      if (x.problemId === c.id) delete x.problemId;
      if (x.changeId === c.id) delete x.changeId;
    }
    if (copy.change) { delete copy.change.riskId; delete copy.change.from; }   // the risk register and the source card stay with the old board (AIG-857)
    to.cards.push(copy);
    c.comments.push({ author: S.owner(), at: t, text: `➡️ Moved to ${to.name} ${nid}` });
    Object.assign(c, { status: 'done', needsYou: false, updated: t, movedTo: { project: to.slug, id: nid } });
    save(to); save(from);
    return { ok: true, id: nid, project: to.slug };
  }],

  // Import without AI (AIG-340): starter cards from the folder's README, TODOs, git history and branches. No tokens.
  ['POST', /^\/api\/projects\/([^/]+)\/starter$/, ([slug], b) => {
    const p = need(load(slug)), r = require('../starter').importStarter(p, String(b.lang || 'en'));
    if (r.added) save(p);
    return r;
  }],

  ['PATCH', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)$/, dmrules.hook.patch = ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const changes = cleanCard(b, true);
    // 🔥 An incident is closed with its post-mortem: what happened, why, what we change (AIG-614).
    if ((changes.type || c.type) === 'incident' && changes.status === 'done' && c.status !== 'done' && require('../rails').railOn('postmortem')) {
      const pm = b.postmortem || {}, one = k => String(pm[k] || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      if (!one('happened') || !one('why') || !one('change')) throw bad('an incident needs its post-mortem to be done: happened, why and change');
      c.postmortem = { happened: one('happened'), why: one('why'), change: one('change'), at: now() };
    }
    if ((changes.type || c.type) === 'incident' && changes.status === 'done' && c.status !== 'done') require('../retro').due(p, 'incident', c.id);   // 🔁 AIG-865: the post-mortem is in: tell the lead to run a retro
    if ((changes.type === 'change' || c.type === 'change') && changes.status === 'done' && c.status !== 'done') { require('../changewin').guard(p, { ...c, type: 'change' }); require('../gonogo').guard(p, { ...c, type: 'change' }); }   // AIG-859: only inside a change window; AIG-858: and only when approved
    if (changes.status === 'done' && c.status !== 'done') require('../problems').checkDone(p, { ...c, type: changes.type || c.type });   // AIG-887
    if (changes.status === 'done' && c.status !== 'done' && c.major) require('../major').end(p, c, 'AI-gile');   // 🚨 AIG-1049: done ends the major incident
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
    if ('status' in changes && changes.status !== 'done') delete c.testerDone;   // reopened or moved on: no longer "done by the tester" (AIG-467)
    if ('checklist' in changes) changes.checklist = S.keepTicks(c.checklist, changes.checklist);
    if ('waitsFor' in changes) S.checkWaits(p, c, changes.waitsFor);
    const waitedFor = c.waitsFor || [], wasLife = c.lifeType, wasStatus = c.status;
    Object.assign(c, changes, { updated: now() });
    if (changes.status === 'verify') { if (S.tiredNow() && c.priority !== 'urgent') c.morning = true; else delete c.morning; }   // AIG-671: a normal test waits for morning while the owner is tired
    else if ('status' in changes) delete c.morning;
    if (c.lifeType && !wasLife) { if (!('assignee' in changes)) c.assignee = S.owner(); require('../life').create(c); }   // AIG-813: turned into a life card: the owner's own from now on
    if ('checklist' in changes && !c.checklist.length) delete c.checklist;
    if ('waitsFor' in changes) { if (!c.waitsFor.length) { delete c.waitsFor; delete c.waitHeld; } S.syncHolds(p, c, waitedFor); }
    if (c.lifeType && ('apptAt' in changes || 'remindMins' in changes)) require('../life').timer(c);   // AIG-394
    if ('status' in changes) require('../follow').track(p, c);   // AIG-426
    share.cardChanged(p, c);   // a card ticked 🔗 (AIG-305): the update goes to the friend, unless the scrub holds it
    save(p);
    if (changes.status === 'verify' && (wasStatus !== 'verify' || 'testSteps' in changes) && p.peerReview) require('../peerreview').onHandover(p, c);   // AIG-994: one hidden review run by the other engine
    return c;
  }],

  // ☑ Tick or untick checklist items (AIG-406): { tick: [1], untick: [2], by } (1-based). Instant, wakes nobody, leaves the card's order alone.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/check$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id), list = c.checklist || [];
    const idx = x => (Array.isArray(x) ? x : x == null ? [] : [x]).map(Number);
    for (const [ns, on] of [[idx(b.tick), true], [idx(b.untick), false]]) for (const n of ns) {
      if (!(n >= 1 && n <= list.length)) throw bad('no checklist item ' + n + (list.length ? ' (1 to ' + list.length + ')' : ': this card has no checklist'));
      const it = list[n - 1];
      if (on) { it.done = true; it.by = String(b.by || S.owner()).slice(0, 40); it.at = now(); } else { delete it.done; delete it.by; delete it.at; }
    }
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
