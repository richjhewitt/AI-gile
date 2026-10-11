// API routes: project folder, limits, usage, meta (split from lib/routes.js, AIG-297).
const { path, usage, S, STATUSES, TYPES, PRIORITIES, ROOT, now, load, localSettings, listSlugs, bad, need, heardFromFolder, startTeam, recentRuns, recordLimits, limitsHistory, checkUsage, usageCheckStatus, setUsageAuto, startTrial, stopTrial, pretend, connectFolder, getPermissions, setPermissions, saveLogo, removeLogo, logoFile, urlFor, avatarFile, libraryStatus, quietSince, setQuiet, takeMorning, watchStatus, watchRound, watchQuick, watchMessages, watchLastNight, callStandup, reportStandup, standupReport, setupStatus, saveSetup, setupNeeded, updateStatus, checkUpdate, applyUpdate, restartBoard, summary } = require('./ctx');

module.exports = function routes(meta) {
return [
  /* ---------- project folder, limits, usage, meta ---------- */
  // First-run setup (AIG-91): the machine-specific settings in aigile.local.json.
  ['GET', /^\/api\/setup$/, () => setupStatus()],
  // 🎞️ GIF search (AIG-343): the server talks to Giphy; the page never sees the key.
  // 🎓 Agile in 2 minutes (AIG-328): the intro text in the chosen language (en, nl, nl-BE), else English.
  ['GET', /^\/api\/intro$/, (_, b, q) => {
    const fs = require('fs'), lang = String((q && q.get && q.get('lang')) || 'en');
    const pick = ['nl', 'nl-BE'].includes(lang) ? `.${lang}` : '';
    return { lang: pick ? lang : 'en', md: fs.readFileSync(path.join(ROOT, 'docs', 'intro', `agile-in-2-minutes${pick}.md`), 'utf8') };
  }],
  ['GET', /^\/api\/giphy$/, () => ({ key: require('../giphy').hasKey() })],
  ['POST', /^\/api\/giphy\/search$/, (_, b) => require('../giphy').search(b || {})],
  ['POST', /^\/api\/giphy\/pick$/, (_, b) => require('../giphy').pick(b || {})],
  // 🧪 Try it as a new user (AIG-201..203): a fresh, empty board with made-up projects, on its own port.
  ['POST', /^\/api\/trial$/, () => startTrial()],
  ['DELETE', /^\/api\/trial$/, () => { stopTrial(); return { ok: true }; }],
  // 🧪 Pretend friend (AIG-322): a local relay and a second board, Davy. GET also tells Davy's own board who it is (the banner).
  ['GET', /^\/api\/pretend$/, () => pretend.status()],
  ['POST', /^\/api\/pretend$/, (_, b) => pretend.start(b)],   // { auto? }: auto (default) also swaps invites so Davy is a checked contact
  ['POST', /^\/api\/pretend\/invite$/, () => pretend.invite()],   // Davy's invite code, to practise Add a friend
  ['POST', /^\/api\/pretend\/stop$/, (_, b) => pretend.stop(b)],   // { wipe? }
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
  ['GET', /^\/api\/avatars\/([^/]+)$/, ([f]) => { const p = avatarFile(f); if (!p) throw bad('no such picture', 404); return { __file: p }; }],

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
  // The usage glance in the nav bar (AIG-356): the newest reading and whether the token budget is reached. Cheap.
  ['GET', /^\/api\/limits\/latest$/, () => ({ latest: limitsHistory(1).latest, over: !!require('../budget').overBudget() })],
  // Check usage now (AIG-151): a hidden Claude with one tiny message makes the status line post a reading.
  ['GET', /^\/api\/usage\/check$/, () => usageCheckStatus()],
  ['POST', /^\/api\/usage\/check$/, () => checkUsage()],
  ['POST', /^\/api\/usage\/auto$/, (_, b) => setUsageAuto(b.on)],

  // Token usage per project, read from the local session logs (folder set in aigile.local.json).
  // Tokens per background run, last 24 hours, biggest first (AIG-266).
  ['GET', /^\/api\/usage\/runs$/, () => recentRuns().slice(0, 10)],
  ['GET', /^\/api\/usage$/, () => usage(process.env.AIGILE_USAGE_DIR || localSettings().usageDir,
    listSlugs().map(load).filter(Boolean).map(p => ({ slug: p.slug, path: p.path })))],

  ['GET', /^\/api\/meta$/, () => ({ statuses: STATUSES, types: TYPES, priorities: PRIORITIES, ...meta(), qaToken: process.env.AIGILE_QA_TOKEN || null, owner: S.owner(), setupNeeded: setupNeeded(), appLogo: urlFor('_app', '/api/app-logo'), ownerPic: urlFor('_me', '/api/me-picture'), update: updateStatus(), home: process.env.AIGILE_HOME || path.dirname(ROOT), quiet: quietSince(), servers: require('../servers').list().map(x => x.name) })],

  // Going quiet: { on: true } messages every team with open work and turns the night theme on; { on: false } turns it off.
  ['POST', /^\/api\/quiet$/, (_, b) => setQuiet(!!b.on, b.watch, b.until)],
  // Quiet ended by itself at the wake-up time (AIG-232): its summary, once.
  ['GET', /^\/api\/quiet\/morning$/, () => takeMorning() || {}],
  // 🌙 Night watchman (AIG-199): what it is watching and has done; a round now (tests, or to check at once).
  ['GET', /^\/api\/watchman$/, () => watchStatus()],
  ['POST', /^\/api\/watchman\/round$/, () => watchRound()],
  ['POST', /^\/api\/watchman\/quick$/, () => watchQuick()],   // the every-minute look (AIG-277), on demand
  // 🧭 Lead Scrum Master (AIG-359): its state, 🧭 Launch (where: vscode | terminal | background), stop, a plain-code round now,
  // and the wait of a window session (aigile smwait): the owner's messages since a time; asking counts as listening.
  ['GET', /^\/api\/scrummaster$/, () => require('../scrummaster').status()],
  ['POST', /^\/api\/scrummaster\/launch$/, (_, b) => require('../scrummaster').launch(b && b.where)],
  ['POST', /^\/api\/scrummaster\/stop$/, () => require('../scrummaster').stop()],
  ['POST', /^\/api\/scrummaster\/round$/, () => require('../scrummaster').round()],
  ['GET', /^\/api\/scrummaster\/wait$/, (_, b, q) => { require('../scrummaster').heard(); const since = String((q && q.get && q.get('since')) || ''); return { messages: (watchMessages() || watchLastNight() || []).filter(m => m.mine && m.at > since) }; }],
  // ⛔ No Token Mode (AIG-337): GET the state; POST { on } switches it (off is the "Turn AI back on" button).
  ['GET', /^\/api\/notokens$/, () => require('../notokens').status()],
  ['POST', /^\/api\/notokens$/, (_, b) => require('../notokens').set(!!(b && b.on))],
  // 🤖 AI tester (AIG-291): { projects?: [slugs] } starts a run over the unchecked tests; GET says if one is going.
  ['GET', /^\/api\/tester$/, () => require('../tester').testerStatus()],
  ['POST', /^\/api\/tester$/, (_, b) => require('../tester').startTester(Array.isArray(b && b.projects) ? b.projects : null)],

  // Stand-ups (AIG-133..135): { projects?: [slugs] } puts a 📣 card in each team's For the team (none = all) and wakes sleeping teams;
  // a team answers with { author, done, next, blockers }; GET /api/standups is the report (newest stand-up per project + blockers).
  ['POST', /^\/api\/standup$/, (_, b) => callStandup(b.projects)],
  ['POST', /^\/api\/projects\/([^/]+)\/standup$/, ([slug], b) => reportStandup(need(load(slug)), b)],
  ['GET', /^\/api\/standups$/, () => standupReport()],

];
};
