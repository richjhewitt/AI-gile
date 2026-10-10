// The API: each route is [method, regex, handler(params, body, query) -> JSON]. Throw bad() for errors.
const fs = require('fs');
const path = require('path');
const { usage } = require('./usage');
const S = require('./store');
const { STATUSES, TYPES, PRIORITIES, ROOT, now, slugify, load, save, localSettings, listSlugs, SNOOZE_MS, waitingOnRich, cleanCard, isRich, toTeam, docList, bad, need, findCard } = S;
const { heard, presenceOf, heardFromFolder, startTeam, nudge, restartTeam, logTail } = require('./presence');
const { recordLimits, limitsHistory } = require('./limits');
const { connectFolder, getPermissions, setPermissions } = require('./onboard');
const { saveAttachment, attachmentsFor, fileOf } = require('./attachments');
const { quietSince, setQuiet } = require('./quiet');

const summary = p => S.summary(p, presenceOf);

/* ---------- routes ---------- */
// meta() supplies the dev flag and build id that the server owns.
module.exports = function makeRoutes(meta) {
return [
  /* ---------- project folder, limits, usage, meta ---------- */
  // Connect a project to a folder: { path, create?, wake? } (see connectFolder). wake starts a new project's team for a first look.
  ['POST', /^\/api\/projects\/([^/]+)\/connect$/, ([slug], b) => {
    const r = connectFolder(need(load(slug)), b.path, !!b.create);
    if (b.wake) try { startTeam(load(slug), true, true); r.done.push('Woke the team for a first look'); } catch (e) { r.done.push('Could not wake the team: ' + e.message); }
    return r;
  }],
  // The team's permissions in the folder's agent settings: { allow, ask, deny } rule lists (AIG-74).
  ['GET', /^\/api\/projects\/([^/]+)\/permissions$/, ([slug]) => getPermissions(need(load(slug)))],
  ['PUT', /^\/api\/projects\/([^/]+)\/permissions$/, ([slug], b) => setPermissions(need(load(slug)), b)],

  // Plan usage snapshots from statusline.js: % used + reset time for the 5-hour and 7-day windows.
  ['POST', /^\/api\/limits$/, (_, b) => { heardFromFolder(b.cwd); return recordLimits(b.rate_limits || {}); }],
  ['GET', /^\/api\/limits$/, (_, __, q) => limitsHistory(Number(q.get('days')) || 30)],

  // Token usage per project, read from the local session logs (folder set in aigile.local.json).
  ['GET', /^\/api\/usage$/, () => usage(process.env.AIGILE_USAGE_DIR || localSettings().usageDir,
    listSlugs().map(load).filter(Boolean).map(p => ({ slug: p.slug, path: p.path })))],

  ['GET', /^\/api\/meta$/, () => ({ statuses: STATUSES, types: TYPES, priorities: PRIORITIES, ...meta(), home: path.dirname(ROOT), quiet: quietSince() })],

  // Going quiet: { on: true } messages every team with open work and turns the night theme on; { on: false } turns it off.
  ['POST', /^\/api\/quiet$/, (_, b) => setQuiet(!!b.on)],

  /* ---------- projects ---------- */
  ['GET', /^\/api\/projects$/, (_, __, q) =>
    listSlugs().map(load).filter(Boolean).filter(p => q.get('all') || !p.archived).map(summary)
      .sort((a, b) => a.name.localeCompare(b.name))],

  ['POST', /^\/api\/projects$/, (_, b) => {
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    const slug = slugify(b.slug || name);
    if (!slug) throw bad('name needs some letters or numbers');
    if (load(slug)) throw bad('project "' + slug + '" already exists', 409);
    const p = {
      slug, name,
      key: String(b.key || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).toUpperCase() || 'P',
      description: b.description || '', path: b.path || '',
      created: now(), updated: now(), nextId: 1, archived: false,
      cards: [], team: [], log: [],
    };
    save(p);
    return summary(p);
  }],

  ['GET', /^\/api\/projects\/([^/]+)$/, ([slug]) => { const p = need(load(slug)); return { ...p, presence: presenceOf(p.slug) }; }],

  // Wake a sleeping team: starts a background run in the project's folder (no window).
  ['POST', /^\/api\/projects\/([^/]+)\/wake$/, ([slug]) => startTeam(need(load(slug)), true)],
  // Kill a stuck run and start a fresh one; and read what the agent printed.
  ['POST', /^\/api\/projects\/([^/]+)\/restart$/, ([slug]) => restartTeam(need(load(slug)))],
  ['GET', /^\/api\/projects\/([^/]+)\/agentlog$/, ([slug]) => ({ text: logTail(need(load(slug)).slug) })],

  ['PATCH', /^\/api\/projects\/([^/]+)$/, ([slug], b) => {
    const p = need(load(slug));
    for (const k of ['name', 'description', 'path', 'archived', 'key']) if (k in b) p[k] = b[k];
    save(p);
    return summary(p);
  }],

  /* ---------- cards ---------- */
  ['POST', /^\/api\/projects\/([^/]+)\/cards$/, ([slug], b) => {
    const p = need(load(slug));
    const c = {
      id: p.key + '-' + p.nextId++,
      title: '', description: '', testSteps: '', type: 'feature', priority: 'normal', status: 'backlog',
      assignee: '', sprint: '', blocked: false, needsYou: false,
      ...cleanCard(b, false),
      createdBy: String(b.createdBy || ''),
      created: now(), updated: now(), comments: [],
    };
    p.cards.push(c);
    save(p);
    if (isRich(c.createdBy)) nudge(slug);
    return c;
  }],

  ['PATCH', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const changes = cleanCard(b, true);
    // Assigning to Rich makes it his task; remember who to hand it back to when he's done.
    if (isRich(changes.assignee) && !isRich(c.assignee)) c.prevAssignee = c.assignee;
    Object.assign(c, changes, { updated: now() });
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

  /* ---------- comments, verdicts, tasks, pokes ---------- */
  // Comments: the conversation channel between Rich and a team.
  // { author, text, needsYou?: true }  -> "ask Rich"  /  Rich replying clears needsYou unless told otherwise.
  // Attachments (AIG-77): upload { name, type, data: base64 } before sending the comment; GET returns the file itself.
  ['POST', /^\/api\/projects\/([^/]+)\/attachments$/, ([slug], b) => { need(load(slug)); return saveAttachment(slug, b); }],
  ['GET', /^\/api\/projects\/([^/]+)\/attachments\/([^/]+)$/, ([slug, id]) => ({ __file: fileOf(slug, id) })],
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/comments$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    if (!text && !files.length) throw bad('text is required');
    const author = String(b.author || 'Rich').trim();
    c.comments.push({ author, text, at: now(), ...(files.length ? { attachments: files } : {}) });
    if ('needsYou' in b) c.needsYou = !!b.needsYou;
    else if (isRich(author)) c.needsYou = false;
    if (isRich(author)) c.blocked = false;   // Rich answering clears a block; the team blocks again if still stuck
    // Rich replying hands the card to the team, including a task he'd been given (it leaves his inbox).
    if (isRich(author)) {
      toTeam(c);
      if (isRich(c.assignee)) c.assignee = c.prevAssignee || '';
    }
    c.updated = now();
    save(p);
    if (isRich(author)) nudge(slug);
    return c;
  }],

  // Wait and see: hide a card in 'verify' from Rich's inbox for an hour and send it to the back of the queue. DELETE brings it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/snooze$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    if (c.status !== 'verify') throw bad('only a card waiting for your test can be snoozed');
    c.snoozedUntil = new Date(Date.now() + SNOOZE_MS).toISOString();
    c.updated = now();
    save(p);
    return c;
  }],
  ['DELETE', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/snooze$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    delete c.snoozedUntil;
    c.updated = now();
    save(p);
    return c;
  }],

  // Rich's verdict on a card in 'verify': { accept: true } -> done, { accept: false, text } -> back to doing.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/verdict$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    if (!b.accept && !text && !files.length) throw bad('say what is wrong when sending a card back');
    if (b.accept) c.status = 'done'; else toTeam(c);
    c.needsYou = false;
    delete c.snoozedUntil;
    c.comments.push({ author: 'Rich', text: (b.accept ? '✅ Accepted' : '🔁 Sent back') + (text ? ': ' + text : ''), at: now(), verdict: b.accept ? 'accept' : 'sendback', ...(files.length ? { attachments: files } : {}) });
    c.updated = now();
    save(p);
    if (!b.accept || text || files.length) nudge(slug);
    return c;
  }],

  // Rich finished a task the team gave him: tell them (moves to For the team) and hand it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/taskdone$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    c.comments.push({ author: 'Rich', text: '✅ Done' + (text ? ': ' + text : ''), at: now(), ...(files.length ? { attachments: files } : {}) });
    c.assignee = c.prevAssignee || '';
    c.needsYou = false;
    toTeam(c);
    c.updated = now();
    save(p);
    nudge(slug);
    return c;
  }],

  // Rich's poke:a one-line nudge on work that seems stuck. Wakes the team (it's a Rich comment)
  // but, unlike a reply, leaves the card where it is.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/poke$/, ([slug, id]) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    c.comments.push({ author: 'Rich', text: '👉 any update?', at: now(), poke: true });
    c.updated = now();
    save(p);
    nudge(slug);
    return c;
  }],

  /* ---------- team, log, updates feed ---------- */
  // Team roster: upsert by name. { name, model?, role?, task?, status? }
  ['POST', /^\/api\/projects\/([^/]+)\/team$/, ([slug], b) => {
    const p = need(load(slug));
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    p.team = p.team || [];
    let m = p.team.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!m) { m = { name }; p.team.push(m); }
    for (const k of ['model', 'role', 'task', 'status']) if (k in b) m[k] = b[k];
    m.updated = now();
    save(p);
    return m;
  }],

  // Project log: { author, text, kind?: 'log' | 'decision' }
  ['POST', /^\/api\/projects\/([^/]+)\/log$/, ([slug], b) => {
    const p = need(load(slug));
    const text = String(b.text || '').trim();
    if (!text) throw bad('text is required');
    const entry = { at: now(), author: String(b.author || 'Rich'), kind: b.kind === 'decision' ? 'decision' : 'log', text };
    (p.log = p.log || []).push(entry);
    save(p);
    return entry;
  }],

  // What Rich did since the team last looked: his comments, verdicts and new cards.
  // ?mark=1 moves the team's "seen" cursor to now (the UI shows "seen by team" from it).
  ['GET', /^\/api\/projects\/([^/]+)\/updates$/, ([slug], _, q) => {
    const p = need(load(slug));
    heard(p.slug);   // hooks and 'aigile wait' call this: the team's session is alive
    const since = q.get('since') || p.teamSeenAt || '';
    const cards = [];
    for (const c of p.cards) {
      // A bare "Accepted" click needs no action, so it doesn't wake the team.
      const items = c.comments.filter(m => isRich(m.author) && m.at > since && !(m.verdict === 'accept' && m.text === '✅ Accepted' && !m.attachments)).map(m => ({ kind: m.poke ? 'poke' : 'comment', text: m.text, at: m.at, attachments: m.attachments }));
      if (isRich(c.createdBy) && c.created > since) items.unshift({ kind: 'new card', text: c.description || '', at: c.created });
      if (items.length) cards.push({ id: c.id, title: c.title, status: c.status, prevStatus: c.prevStatus || '', type: c.type, priority: c.priority, items });
    }
    const forTeam = p.cards.filter(c => c.status === 'team').map(c => ({ id: c.id, title: c.title, prevStatus: c.prevStatus || '' }));
    if (q.get('mark')) { p.teamSeenAt = now(); save(p); }
    return { project: p.slug, since, cards, forTeam };
  }],

  /* ---------- docs and inbox ---------- */
  // Project docs: the .md files in the project's folder and its docs/ folder (read-only).
  ['GET', /^\/api\/projects\/([^/]+)\/docs$/, ([slug]) => docList(need(load(slug)))],
  ['GET', /^\/api\/projects\/([^/]+)\/docs\/(.+)$/, ([slug, name]) => {
    const p = need(load(slug));
    if (!docList(p).includes(name)) throw bad('doc not found', 404); // whitelist: no path tricks
    return { name, text: fs.readFileSync(path.join(p.path, name), 'utf8') };
  }],

  // Any .md file inside the project folder: relative, project-name-prefixed or absolute path.
  ['GET', /^\/api\/projects\/([^/]+)\/file$/, ([slug], body, q) => {
    const p = need(load(slug));
    const raw = String(q.get('path') || '').trim().replace(/\\/g, '/');
    if (!p.path || !raw || !/\.md$/i.test(raw)) throw bad('a .md path is required');
    let root; try { root = fs.realpathSync(p.path); } catch { throw bad('project folder not found', 404); }
    const parts = raw.split('/').filter(Boolean), head = path.basename(root).toLowerCase();
    const abs = path.isAbsolute(raw) || /^[a-z]:\//i.test(raw);
    const tries = abs ? [raw] : [raw, ...(parts[0].toLowerCase() === head ? [parts.slice(1).join('/')] : [])];
    for (const t of tries) {
      let real; try { real = fs.realpathSync(path.resolve(root, t)); } catch { continue; }
      const inside = process.platform === 'win32' ? s => s.toLowerCase() : s => s;
      if (!inside(real).startsWith(inside(root) + path.sep) || !/\.md$/i.test(real) || !fs.statSync(real).isFile()) continue;
      return { name: path.relative(root, real).replace(/\\/g, '/'), text: fs.readFileSync(real, 'utf8') };
    }
    throw bad(tries.length && abs ? 'file not found in this project' : 'file not found', 404);
  }],

  // Everything waiting on Rich, across all projects.
  ['GET', /^\/api\/inbox$/, () =>
    listSlugs().map(load).filter(p => p && !p.archived).flatMap(p =>
      p.cards.filter(waitingOnRich)
        .map(c => ({ project: p.slug, projectName: p.name, ...c })))
      .sort((a, b) => a.updated.localeCompare(b.updated))], // a queue: longest-waiting first
];
};
