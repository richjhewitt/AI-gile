// The API: each route is [method, regex, handler(params, body, query) -> JSON]. Throw bad() for errors.
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const { usage } = require('./usage');
const S = require('./store');
const { STATUSES, TYPES, PRIORITIES, ROOT, now, slugify, load, save, localSettings, listSlugs, SNOOZE_MS, waitingOnRich, cleanCard, isRich, toTeam, docList, bad, need, findCard } = S;
const { heard, gone, presenceOf, heardFromFolder, startTeam, nudge, restartTeam, logTail } = require('./presence');
const { recordLimits, limitsHistory } = require('./limits');
const { checkUsage, usageCheckStatus, setUsageAuto } = require('./usagecheck');
const { startTrial, stopTrial } = require('./trial');
const { connectFolder, getPermissions, setPermissions } = require('./onboard');
const { saveAttachment, attachmentsFor, fileOf } = require('./attachments');
const { saveLogo, removeLogo, logoFile, urlFor } = require('./logos');
const { avatarFile, urlOf, libraryStatus, pickAvatar } = require('./avatars');
const { quietSince, setQuiet, takeMorning } = require('./quiet');
const { status: watchStatus, round: watchRound, messages: watchMessages, relay: watchRelay } = require('./watchman');
const { callStandup, reportStandup, standupReport } = require('./standup');
const { setupStatus, saveSetup, setupNeeded } = require('./setup');
const { discover } = require('./discover');
const { openInEditor } = require('./openfile');
const { proofOf } = require('./proof');
const { updateStatus, checkUpdate, applyUpdate, restartBoard } = require('./update');
const dm = require('./dm');

const summary = p => S.summary(p, presenceOf);

/* ---------- .md files in project folders ---------- */
// Any .md file inside a folder: relative, folder-name-prefixed or absolute. Relative paths also try
// dropping leading folders, since card text like "My Project\audit\X.md" only links "Project\audit\X.md"
// (folder names with spaces), so the match is found from the end (AIG-85).
function findMd(dir, raw) {
  let root; try { root = fs.realpathSync(dir); } catch { return null; }
  const parts = raw.split('/').filter(Boolean);
  const abs = path.isAbsolute(raw) || /^[a-z]:\//i.test(raw);
  const inside = process.platform === 'win32' ? s => s.toLowerCase() : s => s;
  for (const t of abs ? [raw] : parts.map((_, i) => parts.slice(i).join('/'))) {
    let real; try { real = fs.realpathSync(path.resolve(root, t)); } catch { continue; }
    if (!inside(real).startsWith(inside(root) + path.sep) || !/\.md$/i.test(real) || !fs.statSync(real).isFile()) continue;
    return { name: path.relative(root, real).replace(/\\/g, '/'), text: fs.readFileSync(real, 'utf8') };
  }
  // A bare name like chatgpt.md (AIG-240): the one file with that name anywhere in the folder, if there's only one.
  if (!abs && parts.length === 1) {
    const hits = [], walk = (d, depth) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) { if (hits.length > 1) return; const f = path.join(d, e.name);
        if (e.isDirectory() && depth < 5 && !/^(\.|node_modules$|data$)/.test(e.name)) walk(f, depth + 1);
        else if (e.isFile() && e.name.toLowerCase() === parts[0].toLowerCase()) hits.push(f); } };
    walk(root, 0);
    if (hits.length === 1) return { name: path.relative(root, hits[0]).replace(/\\/g, '/'), text: fs.readFileSync(hits[0], 'utf8') };
  }
  return null;
}

/* ---------- lead chats (AIG-137/138) ---------- */
// The cards that make up a project's chat: the owner's quick questions, and anything the team asked the owner.
const chatCards = p => p.cards.filter(c => c.quick || c.asked || c.needsYou);
// The 🌙 night watchman's chat (AIG-211): read-only, one message per critical problem tonight.
const watchChat = wm => ({ slug: '_watchman', name: 'Night watch', lead: '🌙 Watchman', emoji: '🌙', color: '#7a4a3a', watchman: true, unread: wm.filter(m => !m.mine).length, last: (wm.at(-1) || {}).at || null });
// A project's lead: the roster member named or titled "lead", else the first member.
const leadOf = p => { const t = (p.team || []).filter(m => !/retired/i.test(m.status || '')); const l = t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0]; return l ? l.name : 'Lead'; };
// A member's picture URL (AIG-150), or ''.
const picOf = (p, name) => urlOf(((p.team || []).find(m => m.name.toLowerCase() === String(name).toLowerCase()) || {}).avatar);

/* ---------- routes ---------- */
// meta() supplies the dev flag and build id that the server owns.
module.exports = function makeRoutes(meta) {
return [
  /* ---------- project folder, limits, usage, meta ---------- */
  // First-run setup (AIG-91): the machine-specific settings in aigile.local.json.
  ['GET', /^\/api\/setup$/, () => setupStatus()],
  // 🧪 Try it as a new user (AIG-201..203): a fresh, empty board with made-up projects, on its own port.
  ['POST', /^\/api\/trial$/, () => startTrial()],
  ['DELETE', /^\/api\/trial$/, () => { stopTrial(); return { ok: true }; }],
  ['POST', /^\/api\/setup$/, (_, b) => saveSetup(b)],
  // App logo (AIG-175): data/logos/_app.<ext>; the tab icon, header and desktop window use it.
  ['GET', /^\/api\/app-logo$/, () => { const f = logoFile('_app'); if (!f) throw bad('no app logo', 404); return { __file: f }; }],
  ['POST', /^\/api\/app-logo$/, (_, b) => { saveLogo('_app', b); return setupStatus(); }],
  ['DELETE', /^\/api\/app-logo$/, () => { removeLogo('_app'); return setupStatus(); }],
  // Profile pictures (AIG-150): yours (data/logos/_me.<ext>, from Setup) and the agents' picture library.
  ['GET', /^\/api\/me-picture$/, () => { const f = logoFile('_me'); if (!f) throw bad('no picture', 404); return { __file: f }; }],
  ['POST', /^\/api\/me-picture$/, (_, b) => { saveLogo('_me', b); return setupStatus(); }],
  ['DELETE', /^\/api\/me-picture$/, () => { removeLogo('_me'); return setupStatus(); }],
  ['GET', /^\/api\/avatars$/, () => libraryStatus()],
  ['GET', /^\/api\/avatars\/([^/]+)$/, ([f]) => { const p = avatarFile(decodeURIComponent(f)); if (!p) throw bad('no such picture', 404); return { __file: p }; }],

  // Auto-update from the GitHub upstream (AIG-92): status, check now, apply (fast-forward + restart).
  ['GET', /^\/api\/update$/, () => updateStatus()],
  ['POST', /^\/api\/restart$/, () => restartBoard()],   // 🔄 new server code (AIG-206)
  ['POST', /^\/api\/update\/check$/, () => checkUpdate()],
  ['POST', /^\/api\/update\/apply$/, () => applyUpdate()],

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
  // Check usage now (AIG-151): a hidden Claude with one tiny message makes the status line post a reading.
  ['GET', /^\/api\/usage\/check$/, () => usageCheckStatus()],
  ['POST', /^\/api\/usage\/check$/, () => checkUsage()],
  ['POST', /^\/api\/usage\/auto$/, (_, b) => setUsageAuto(b.on)],

  // Token usage per project, read from the local session logs (folder set in aigile.local.json).
  ['GET', /^\/api\/usage$/, () => usage(process.env.AIGILE_USAGE_DIR || localSettings().usageDir,
    listSlugs().map(load).filter(Boolean).map(p => ({ slug: p.slug, path: p.path })))],

  ['GET', /^\/api\/meta$/, () => ({ statuses: STATUSES, types: TYPES, priorities: PRIORITIES, ...meta(), owner: S.owner(), setupNeeded: setupNeeded(), appLogo: urlFor('_app', '/api/app-logo'), ownerPic: urlFor('_me', '/api/me-picture'), update: updateStatus(), home: process.env.AIGILE_HOME || path.dirname(ROOT), quiet: quietSince() })],

  // Going quiet: { on: true } messages every team with open work and turns the night theme on; { on: false } turns it off.
  ['POST', /^\/api\/quiet$/, (_, b) => setQuiet(!!b.on, b.watch, b.until)],
  // Quiet ended by itself at the wake-up time (AIG-232): its summary, once.
  ['GET', /^\/api\/quiet\/morning$/, () => takeMorning() || {}],
  // 🌙 Night watchman (AIG-199): what it is watching and has done; a round now (tests, or to check at once).
  ['GET', /^\/api\/watchman$/, () => watchStatus()],
  ['POST', /^\/api\/watchman\/round$/, () => watchRound()],

  // Stand-ups (AIG-133..135): { projects?: [slugs] } puts a 📣 card in each team's For the team (none = all) and wakes sleeping teams;
  // a team answers with { author, done, next, blockers }; GET /api/standups is the report (newest stand-up per project + blockers).
  ['POST', /^\/api\/standup$/, (_, b) => callStandup(b.projects)],
  ['POST', /^\/api\/projects\/([^/]+)\/standup$/, ([slug], b) => reportStandup(need(load(slug)), b)],
  ['GET', /^\/api\/standups$/, () => standupReport()],

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
      chatty: (localSettings().lead || {}).chatty || undefined,   // the owner's default for new projects (AIG-235)
    };
    save(p);
    return summary(p);
  }],

  ['GET', /^\/api\/projects\/([^/]+)$/, ([slug]) => { const p = need(load(slug)); return { ...p, ...S.look(p), presence: presenceOf(p.slug) }; }],

  // Wake a sleeping team: starts a background run in the project's folder (no window).
  ['POST', /^\/api\/projects\/([^/]+)\/wake$/, ([slug]) => startTeam(need(load(slug)), true)],
  // Kill a stuck run and start a fresh one; and read what the agent printed.
  ['POST', /^\/api\/projects\/([^/]+)\/restart$/, ([slug]) => restartTeam(need(load(slug)))],
  ['GET', /^\/api\/projects\/([^/]+)\/agentlog$/, ([slug]) => ({ text: logTail(need(load(slug)).slug) })],

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
    if ('chatty' in b) p.chatty = !!b.chatty || undefined;   // chatty lead (AIG-140)
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
    if ('testSteps' in changes) delete c.aiCheck;   // handed over again: an old AI tester check no longer counts
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
    const author = String(b.author || S.owner()).trim();
    // Answer buttons the team picked for this message (AIG-176): up to 4 short ones.
    const options = (Array.isArray(b.options) ? b.options : String(b.options || '').split(',')).map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 4);
    c.comments.push({ author, text, at: now(), ...(files.length ? { attachments: files } : {}), ...(options.length ? { options } : {}) });
    if (!isRich(author)) delete c.snoozedUntil;   // something new from the team brings a put-off card back (AIG-167)
    if ('needsYou' in b) { c.needsYou = !!b.needsYou; if (c.needsYou) c.asked = true; }   // asked: part of the lead chat for good
    else if (c.quick && !isRich(author)) c.needsYou = true;   // the team's answer to a quick question goes to Messages
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
    // Anything waiting on the owner can be put off for a while: a test, a question or a block (AIG-167).
    if (!waitingOnRich(c)) throw bad('only something waiting on you can be put off');
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
    c.comments.push({ author: S.owner(), text: (b.accept ? '✅ Accepted' : '🔁 Sent back') + (text ? ': ' + text : ''), at: now(), verdict: b.accept ? 'accept' : 'sendback', ...(files.length ? { attachments: files } : {}) });
    c.updated = now();
    save(p);
    if (!b.accept || text || files.length) nudge(slug);
    return c;
  }],

  // AI tester (AIG-163): its check of a test waiting for the owner. pass: stays for the owner with the evidence (one click
  // to accept); fail: back to the team with what went wrong; skip: it couldn't check (login, keys, a restart), the owner does.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/aicheck$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    if (c.status !== 'verify') throw bad('only a test waiting for ' + S.owner() + ' can be checked');
    if (!['pass', 'fail', 'skip'].includes(b.result)) throw bad('result must be pass, fail or skip');
    const note = String(b.note || '').trim().slice(0, 600), files = attachmentsFor(slug, b.attachments), by = String(b.by || 'Tester').trim();
    if (!note) throw bad('say in a line or two what you saw');
    c.aiCheck = { result: b.result, note, by, at: now(), ...(files.length ? { shots: files } : {}) };
    c.comments.push({ author: by, text: { pass: '🤖 Passed: ', fail: '🤖 Failed: ', skip: '🤖 Could not check: ' }[b.result] + note, at: now(), ...(files.length ? { attachments: files } : {}) });
    if (b.result === 'fail') toTeam(c);
    c.updated = now();
    save(p);
    if (b.result === 'fail') nudge(slug);
    return c;
  }],

  // Fold (AIG-190/193): a card about the same feature joins another. Its test steps go under the target's,
  // both get a note, and it closes (even when it was waiting on the owner: folding is how the pile stays small).
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/fold$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id), into = findCard(p, String(b.into || ''));
    if (c === into) throw bad('a card cannot fold into itself');
    if (c.status === 'done') throw bad(c.id + ' is already done');
    const by = String(b.author || 'Lead').trim();
    if (c.testSteps) { into.testSteps = (into.testSteps || '') + `\n\n**Also (was ${c.id}: ${c.title}):**\n${c.testSteps}`; delete into.aiCheck; }
    into.comments.push({ author: by, text: `- Folded in **${c.id}** (${c.title})`, at: now() });
    c.comments.push({ author: by, text: `- Folded into **${into.id}**: test it all there`, at: now() });
    c.status = 'done'; c.needsYou = false; c.blocked = false; delete c.snoozedUntil;
    c.updated = into.updated = now();
    save(p);
    return into;
  }],
  // 🧹 Tidy my pile (AIG-193): a job card for the lead to fold related cards in For you. One open job at a time.
  ['POST', /^\/api\/projects\/([^/]+)\/tidy$/, ([slug]) => {
    const p = need(load(slug));
    let c = p.cards.find(x => x.tidy && x.status !== 'done');
    if (c) return { ...c, already: true };
    c = { id: p.key + '-' + p.nextId++, title: '🧹 Tidy the For you pile', description: "- The owner asked you to tidy their **For you** pile\n- Cards about the same feature: fold them into one with `aigile fold <proj> <target> <id> [<id>...] --as <you>` (test steps move across, the others close)\n- Muddled titles: give them a short, recognisable one (`aigile edit ... --title`)\n- Then comment here: \"Folded N → M\" and what went where, and move this card to done", testSteps: '', type: 'task', priority: 'high', status: 'team',
      assignee: '', sprint: '', blocked: false, needsYou: false, tidy: true, createdBy: S.owner(), created: now(), updated: now(), comments: [] };
    p.cards.push(c); save(p); nudge(slug);
    return c;
  }],

  // Rich finished a task the team gave him: tell them (moves to For the team) and hand it back.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/taskdone$/, ([slug, id], b) => {
    const p = need(load(slug));
    const c = findCard(p, id);
    const text = String(b.text || '').trim(), files = attachmentsFor(slug, b.attachments);
    c.comments.push({ author: S.owner(), text: '✅ Done' + (text ? ': ' + text : ''), at: now(), ...(files.length ? { attachments: files } : {}) });
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
    c.comments.push({ author: S.owner(), text: '👉 any update?', at: now(), poke: true });
    c.updated = now();
    save(p);
    nudge(slug);
    return c;
  }],

  /* ---------- team, log, updates feed ---------- */
  // Team roster: upsert by name. { name, model?, role?, task?, status?, avatar? }
  ['POST', /^\/api\/projects\/([^/]+)\/team$/, ([slug], b) => {
    const p = need(load(slug));
    const name = String(b.name || '').trim();
    if (!name) throw bad('name is required');
    p.team = p.team || [];
    let m = p.team.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!m) { m = { name }; p.team.push(m); }
    for (const k of ['model', 'role', 'task', 'status']) if (k in b) m[k] = b[k];
    if (b.avatar || !m.avatar) pickAvatar(slug, m, b.avatar);   // a library picture the first time (AIG-150), or the one asked for
    m.updated = now();
    save(p);
    return m;
  }],

  // Project log: { author, text, kind?: 'log' | 'decision' }
  ['POST', /^\/api\/projects\/([^/]+)\/log$/, ([slug], b) => {
    const p = need(load(slug));
    const text = String(b.text || '').trim();
    if (!text) throw bad('text is required');
    const entry = { at: now(), author: String(b.author || S.owner()), kind: b.kind === 'decision' ? 'decision' : 'log', text };
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
      if (isRich(c.createdBy) && c.created > since) items.unshift({ kind: 'new card', text: c.description || '', at: c.created, attachments: c.attachments });
      if (items.length) cards.push({ id: c.id, title: c.title, status: c.status, prevStatus: c.prevStatus || '', type: c.type, priority: c.priority, items });
    }
    const forTeam = p.cards.filter(c => c.status === 'team').map(c => ({ id: c.id, title: c.title, prevStatus: c.prevStatus || '' }));
    if (q.get('mark')) { p.teamSeenAt = now(); save(p); }
    // Tidy cards (AIG-234): an owner who writes quick, messy cards can ask leads to neaten each new one first.
    return { project: p.slug, since, cards, forTeam, tidy: !!(S.localSettings().lead || {}).tidyCards };
  }],
  // The team's window closed (SessionEnd hook, AIG-219): a background run picks up whatever is still for the team.
  ['POST', /^\/api\/projects\/([^/]+)\/bye$/, ([slug]) => {
    const p = need(load(slug));
    gone(p.slug);
    const left = p.cards.some(c => c.status === 'team');
    if (left) nudge(p.slug);
    return { ok: true, woke: left };
  }],

  /* ---------- private DMs (AIG-110) ---------- */
  // End-to-end encrypted messages between people's boards, through a relay (lib/dm.js, docs/DMS-DESIGN.md).
  ['GET', /^\/api\/dms$/, () => dm.status()],
  ['POST', /^\/api\/dms\/settings$/, (_, b) => dm.setSettings(b)],   // { on?, relay? }: on: false is the killswitch
  ['POST', /^\/api\/dms\/poll$/, () => dm.poll()],
  ['POST', /^\/api\/dms\/invites$/, (_, b) => dm.createInvite(b)],   // { name? } of the person it's for
  ['POST', /^\/api\/dms\/accept$/, (_, b) => dm.acceptInvite(b)],    // { code, name, me? }
  ['GET', /^\/api\/dms\/contacts$/, () => dm.contacts()],
  ['PATCH', /^\/api\/dms\/contacts\/([^/]+)$/, ([id], b) => dm.patchContact(id, b)],   // { name?, checked?, blocked? }
  ['DELETE', /^\/api\/dms\/contacts\/([^/]+)$/, ([id]) => dm.removeContact(id)],
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/messages$/, ([id]) => dm.messages(id)],
  ['POST', /^\/api\/dms\/contacts\/([^/]+)\/messages$/, ([id], b) => dm.send(id, b)],   // { text }
  ['GET', /^\/api\/dms\/contacts\/([^/]+)\/messages\/([^/]+)\/raw$/, ([id, mid]) => dm.rawMessage(id, mid)],   // what the relay sees

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
    if (!raw || !/\.md$/i.test(raw)) throw bad('a .md path is required');
    // This project's folder first, then the other projects': a card can mention another project's file
    // (AIG-85). The name then says which project it came from.
    const own = findMd(p.path, raw);
    if (own) return own;
    for (const o of listSlugs().map(load).filter(o => o && o.slug !== p.slug && !o.archived)) {
      const hit = findMd(o.path, raw);
      if (hit) return { ...hit, name: o.name + ': ' + hit.name, project: o.slug };
    }
    throw bad('file not found in any project folder', 404);
  }],

  // Proof on hand-back (AIG-166): { commit } -> the board reads the commit and keeps a short proof on the card.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/proof$/, ([slug, id], b) => {
    const p = need(load(slug)), c = findCard(p, id);
    c.proof = proofOf(p.path, b.commit); c.updated = now(); save(p);
    return c.proof;
  }],

  // 📝 Open a file in the owner's editor (AIG-156): { path }.
  ['POST', /^\/api\/open-file$/, (_, b) => openInEditor(b.path)],

  // New user mode (AIG-94): the projects found in a folder (default: the folder AI-gile sits in).
  ['GET', /^\/api\/discover$/, (_, __, q) => discover(q.get('dir') || undefined)],

  // ▶ Open it (AIG-146): start the app with the card's start command if its page doesn't answer yet (the owner
  // confirms the command first), then wait until it does. The page itself opens in the owner's browser.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/open$/, async ([slug, id]) => {
    const p = need(load(slug)), c = findCard(p, id);
    if (!c.openUrl) throw bad('this card has no address to open');
    const answers = async () => { try { await fetch(c.openUrl, { signal: AbortSignal.timeout(1500) }); return true; } catch { return false; } };
    if (await answers()) return { url: c.openUrl, started: false };
    if (!c.startCmd) throw bad("the page doesn't answer and the card has no start command");
    if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first');
    spawn(c.startCmd, { cwd: p.path, shell: true, detached: true, stdio: 'ignore', windowsHide: true }).unref();
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); if (await answers()) return { url: c.openUrl, started: true }; }
    throw bad('started it, but the page still does not answer after a minute');
  }],

  // A lead starting a DM (AIG-140): only when the owner switched on a chatty lead. It's a closed card, so it
  // shows in the chat without adding to the board.
  ['POST', /^\/api\/projects\/([^/]+)\/dm$/, ([slug], b) => {
    const p = need(load(slug)), text = String(b.text || '').trim(), author = String(b.author || '').trim() || 'Lead';
    if (!p.chatty) throw bad('chatty lead is off for this project (🎨 Look)');
    if (!text) throw bad('text is required');
    const c = { id: p.key + '-' + p.nextId++, title: '💬 ' + text.split('\n')[0].slice(0, 80), description: text, testSteps: '', type: 'task', priority: 'low', status: 'done',
      assignee: '', sprint: '', blocked: false, needsYou: false, quick: true, createdBy: author, created: now(), updated: now(), comments: [] };
    p.cards.push(c); save(p);
    return c;
  }],

  // DMs with the team leads (AIG-137/138): one chat per project. A chat holds the owner's quick questions
  // and the team's questions to the owner, as messages; "open" ones are still waiting on the owner.
  // 🌙 While you are going quiet (AIG-211) only the night watchman's chat is listed: the leads' wait for the morning.
  ['GET', /^\/api\/chats$/, () => { const wm = watchMessages(); return wm ? [watchChat(wm)] : S.byOrder(listSlugs().map(load).filter(p => p && !p.archived).map(p => {
    const open = p.cards.filter(c => c.status !== 'done' && c.needsYou && !c.blocked);
    const last = chatCards(p).flatMap(c => c.comments.map(m => m.at)).sort().pop() || null;
    return { slug: p.slug, name: p.name, ...S.look(p), lead: leadOf(p), leadPic: picOf(p, leadOf(p)), unread: open.length, last };
  })); }],
  ['GET', /^\/api\/chats\/_watchman$/, () => {
    const wm = watchMessages() || [];
    return { ...watchChat(wm), open: [], cards: { _night: { title: 'Tonight', kind: 'other' } },
      messages: wm.map(m => ({ card: '_night', title: 'Tonight', author: m.author || '🌙 Watchman', text: m.text, at: m.at, mine: !!m.mine, pick: m.pick })) };
  }],
  // Write to the watchman (AIG-221): it passes the message on to one team, or all of them.
  ['POST', /^\/api\/chats\/_watchman$/, (_, b) => watchRelay(b.text)],
  ['GET', /^\/api\/chats\/([^/]+)$/, ([slug]) => {
    const p = need(load(slug)), since = new Date(Date.now() - 30 * 864e5).toISOString();
    const messages = chatCards(p).flatMap(c => [
      ...(c.quick && c.created >= since ? [{ card: c.id, title: c.title, author: c.createdBy || S.owner(), text: c.description, at: c.created, attachments: c.attachments }] : []),
      ...c.comments.filter(m => m.at >= since).map(m => ({ card: c.id, title: c.title, author: m.author, text: m.text, at: m.at, attachments: m.attachments, options: m.options })),
    ]).map(m => ({ ...m, mine: isRich(m.author) })).sort((a, b) => a.at.localeCompare(b.at));
    const open = p.cards.filter(c => c.status !== 'done' && c.needsYou && !c.blocked).sort((a, b) => b.updated.localeCompare(a.updated)).map(c => ({ id: c.id, title: c.title }));
    // Each card in the chat (AIG-157): what kind it is and whether it's waiting on the owner, for the folds.
    const cards = Object.fromEntries([...new Set(messages.map(m => m.card))].map(id => { const c = p.cards.find(x => x.id === id) || {};
      return [id, { title: c.title, kind: c.status === 'verify' ? 'test' : c.needsYou ? 'question' : c.quick ? 'idea' : 'other', waiting: open.some(o => o.id === id), done: c.status === 'done' }]; }));
    return { slug: p.slug, name: p.name, ...S.look(p), lead: leadOf(p), leadPic: picOf(p, leadOf(p)), team: (p.team || []).map(m => ({ name: m.name, avatar: m.avatar })), messages, open, cards };
  }],

  // Everything waiting on Rich, across all projects.
  ['GET', /^\/api\/inbox$/, () =>
    listSlugs().map(load).filter(p => p && !p.archived).flatMap(p =>
      p.cards.filter(waitingOnRich)
        .map(c => ({ project: p.slug, projectName: p.name, projectColor: S.look(p).color, projectEmoji: S.look(p).emoji, projectRank: (i => i < 0 ? 1e6 : i)(S.projectOrder().indexOf(p.slug)), projectLogo: S.look(p).logo, ...c })))
      .sort((a, b) => a.updated.localeCompare(b.updated))], // a queue: longest-waiting first
];
};
