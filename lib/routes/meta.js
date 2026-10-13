// API routes: project folder, limits, usage, meta (split from lib/routes.js, AIG-297).
const { path, usage, S, STATUSES, TYPES, PRIORITIES, ROOT, now, load, localSettings, listSlugs, bad, need, heardFromFolder, startTeam, recentRuns, recordLimits, limitsHistory, checkUsage, usageCheckStatus, setUsageAuto, startTrial, stopTrial, pretend, connectFolder, getPermissions, setPermissions, saveLogo, removeLogo, logoFile, urlFor, avatarFile, libraryStatus, quietSince, setQuiet, takeMorning, watchStatus, watchRound, watchQuick, watchMessages, watchLastNight, callStandup, reportStandup, standupReport, setupStatus, saveSetup, setupNeeded, updateStatus, checkUpdate, applyUpdate, restartBoard, summary } = require('./ctx');

// The app icon colours (AIG-400): null while they are the defaults; v changes with them so the page re-fetches the favicon.
const iconOf = () => { const c = localSettings().appIcon; return c ? { ...require('../appicon').colours(c), v: (c.main + c.waiting).replace(/#/g, '') } : null; };
// A file is read again only when it changes (size or time), so asking often stays cheap.
const langSeen = new Map();
const langFiles = () => {
  const fs = require('fs'), dir = path.join(ROOT, 'public', 'lang');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'languages.json').filter(f => {
    const st = fs.statSync(path.join(dir, f)), sig = st.size + ':' + st.mtimeMs, hit = langSeen.get(f);
    if (hit && hit.sig === sig) return hit.ok;
    let ok = false; try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); ok = !!j && typeof j === 'object' && !Array.isArray(j); } catch {}
    langSeen.set(f, { sig, ok }); return ok;
  }).map(f => f.slice(0, -5));
};
module.exports = function routes(meta) {
return [
  ['GET', /^\/api\/app-icon\.svg$/, (_, b, q) => { const f = require('../appicon').file(q && q.get && q.get('waiting') === '1'); if (!f) throw bad('no custom icon', 404); return { __file: f }; }],
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
  // 🌍 The languages whose file is in public/lang and parses (AIG-487): the picker offers only these, so translations can arrive one by one.
  ['GET', /^\/api\/langs$/, () => ({ codes: langFiles() })],
  ['GET', /^\/api\/giphy$/, () => ({ key: require('../giphy').hasKey() })],
  ['POST', /^\/api\/giphy\/search$/, (_, b) => require('../giphy').search(b || {})],
  ['POST', /^\/api\/giphy\/pick$/, (_, b) => require('../giphy').pick(b || {})],
  // 🧪 Try it as a new user (AIG-201..203): a fresh, empty board with made-up projects, on its own port.
  ['POST', /^\/api\/trial$/, (_, b) => startTrial(b)],   // { code? }: 'today' (default) or 'release' (AIG-468)
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
  ['GET', /^\/api\/avatars\/badge\/([a-z]+)\/([a-z]+)\/([a-z]+)$/, ([a, c, x]) => { const bd = require('../badges'), b = bd.parse(`badge:${a}/${c}/${x}`); if (!b) throw bad('no such badge', 404); return { __svg: bd.svg(b) }; }],   // AIG-396
  ['GET', /^\/api\/avatars\/([^/]+)$/, ([f]) => { const p = avatarFile(f); if (!p) throw bad('no such picture', 404); return { __file: p }; }],

  // Auto-update from the GitHub upstream (AIG-92): status, check now, apply (fast-forward + restart).
  ['GET', /^\/api\/update$/, () => updateStatus()],
  ['POST', /^\/api\/restart$/, () => restartBoard()],   // 🔄 new server code (AIG-206)
  ['POST', /^\/api\/update\/check$/, () => checkUpdate()],
  ['POST', /^\/api\/update\/apply$/, () => applyUpdate()],
  // ↩ Go back to an earlier build and stay there; back to the latest (AIG-563).
  ['GET', /^\/api\/rollback$/, () => require('../rollback').status()],
  ['POST', /^\/api\/rollback$/, (_, b) => require('../rollback').goBack(b.commit)],
  ['POST', /^\/api\/rollback\/latest$/, () => require('../rollback').latest()],
  // 📦 Update channel: Stable (daily, QA green) or Live (AIG-560).
  ['GET', /^\/api\/channel$/, () => require('../channel').status()],
  ['PUT', /^\/api\/channel$/, (_, b) => require('../channel').set(b.channel)],

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
  ['GET', /^\/api\/glance$/, (_, __, q) => { const sl = q && q.get && q.get('project'); if (sl) need(load(sl)); return require('../glance').glance(sl || null); }],   // ScrumGlance (AIG-688)
  // aigile open (AIG-758): an agent asks the app to pop a card open; the page polls with front=1 when it is in front.
  ['POST', /^\/api\/projects\/([^/]+)\/cards\/([^/]+)\/open$/, ([slug, id], b) => require('../opencard').add(slug, id, (b || {}).author)],
  ['GET', /^\/api\/opencard$/, (_, __, q) => require('../opencard').poll(q.get('front') === '1')],
  ['DELETE', /^\/api\/opencard\/(\d+)$/, ([n]) => require('../opencard').drop(n)],
  ['GET', /^\/api\/limits$/, (_, __, q) => limitsHistory(Number(q.get('days')) || 30)],
  // 🎯 Today (AIG-595..597): the day's weight per project, each one's share of the day's tokens and use so far.
  ['GET', /^\/api\/today$/, () => require('../today').view()],
  ['POST', /^\/api\/today$/, (_, b) => require('../today').set(String(b.slug || ''), String(b.weight || ''))],
  ['POST', /^\/api\/today\/shares$/, (_, b) => require('../today').setShares(b)],
  ['POST', /^\/api\/today\/keep$/, () => require('../today').keepYesterday()],
  // The usage glance in the nav bar (AIG-356): the newest reading and whether the token budget is reached. Cheap.
  ['GET', /^\/api\/limits\/latest$/, () => ({ latest: limitsHistory(1).latest, over: !!require('../budget').overBudget(), slow: require('../budget').slow(), saving: require('../budget').saving(), maximiser: require('../budget').maximiser() })],
  // Check usage now (AIG-151): a hidden Claude with one tiny message makes the status line post a reading.
  ['GET', /^\/api\/usage\/check$/, () => usageCheckStatus()],
  ['POST', /^\/api\/usage\/check$/, () => checkUsage()],
  ['POST', /^\/api\/usage\/auto$/, (_, b) => setUsageAuto(b.on)],

  // Token usage per project, read from the local session logs (folder set in aigile.local.json).
  // Tokens per background run, last 24 hours, biggest first (AIG-266).
  // AIG-522 #10: plus the non-team runs (they carry a kind) and, per project, the lead sessions in VS Code (what the folder used beyond the team runs).
  ['GET', /^\/api\/usage\/runs$/, () => { const runs = recentRuns(); return [...runs, ...require('../usage').leadRows(process.env.AIGILE_USAGE_DIR || localSettings().usageDir, listSlugs().map(load).filter(Boolean).map(p => ({ slug: p.slug, path: p.path })), runs)].sort((a, b) => (b.in + b.out) - (a.in + a.out)).slice(0, 10); }],
  ['GET', /^\/api\/usage\/shares$/, () => require('../usageshare').settings()],   // AIG-685/686: each project's share switch and the friends to pick
  ['GET', /^\/api\/usage$/, () => usage(process.env.AIGILE_USAGE_DIR || localSettings().usageDir,
    listSlugs().map(load).filter(Boolean).map(p => ({ slug: p.slug, path: p.path })))],

  ['GET', /^\/api\/meta$/, () => ({ statuses: STATUSES, types: TYPES, priorities: PRIORITIES, ...meta(), qaToken: process.env.AIGILE_QA_TOKEN || null, owner: S.owner(), setupNeeded: setupNeeded(), appLogo: urlFor('_app', '/api/app-logo'), appIcon: iconOf(), ownerPic: urlFor('_me', '/api/me-picture'), update: updateStatus(), noAi: require('../noai').isOn(), noAiBuild: require('../noai').marker(), home: S.projectsFolder(), quiet: quietSince(), quietTime: require('../rails').railOn('quietTimes') ? require('../changecal').now() : null, focus: require('../focus').status(), servers: require('../servers').effective().map(x => x.name), srvAccess: Object.fromEntries(require('../servers').effective().map(x => [x.name, x.access || {}])), terms: require('../terminal').off() ? [] : require('../servers').terminals().map(x => x.name) })],

  // 🎯 Focus mode (AIG-395): one task fills the window; teams carry on the night way. start / pause / resume / done / leave; showstopper from a lead.
  ['GET', /^\/api\/focus$/, () => require('../focus').status() || {}],
  ['GET', /^\/api\/focus\/summary$/, () => require('../focus').takeSummary() || {}],
  ['POST', /^\/api\/focus\/start$/, (_, b) => require('../focus').start(b.project, b.id)],
  ['POST', /^\/api\/focus\/pause$/, () => require('../focus').pause()],
  ['POST', /^\/api\/focus\/resume$/, () => require('../focus').resume()],
  ['POST', /^\/api\/focus\/done$/, () => require('../focus').end(true)],
  ['POST', /^\/api\/focus\/leave$/, () => require('../focus').end(false)],
  ['POST', /^\/api\/focus\/showstopper$/, (_, b) => require('../focus').showstopper(b.project, b.id, b.why, b.author)],
  // Going quiet: { on: true } messages every team with open work and turns the night theme on; { on: false } turns it off.
  ['POST', /^\/api\/quiet$/, (_, b) => setQuiet(!!b.on, b.watch, b.until)],
  // Quiet ended by itself at the wake-up time (AIG-232): its summary, once.
  ['GET', /^\/api\/quiet\/morning$/, () => takeMorning() || {}],
  // 🌙 Night watchman (AIG-199): what it is watching and has done; a round now (tests, or to check at once).
  ['GET', /^\/api\/watchman$/, () => watchStatus()],
  ['POST', /^\/api\/watchman\/round$/, () => watchRound()],
  ['POST', /^\/api\/watchman\/quick$/, () => watchQuick()],   // the every-minute look (AIG-277), on demand
  // 🧭 Lead Scrum Master (AIG-359): its state, the push level, a plain-code round now,
  // and the wait of a window session (aigile smwait): the owner's messages since a time; asking counts as listening.
  ['POST', /^\/api\/noai\/off$/, () => ({ noAi: require('../noai').set(false) })],   // 🚫 OK, I give in (AIG-618); refused (403) in the No-AI edition
  ['GET', /^\/api\/scrummaster$/, () => require('../scrummaster').status()],
  ['POST', /^\/api\/scrummaster\/push$/, (_, b) => require('../scrummaster').setPush(b && b.level)],
  ['POST', /^\/api\/scrummaster\/round$/, () => require('../scrummaster').round()],
  ['GET', /^\/api\/scrummaster\/wait$/, (_, b, q) => { require('../scrummaster').heard(); const since = String((q && q.get && q.get('since')) || ''); return { messages: require('../scrummaster').handOver(watchMessages() || watchLastNight() || [], since) }; }],
  // 🧹 Refactor offer (AIG-98): big files per project with a rough estimate; accepting makes the cards.
  ['GET', /^\/api\/refactor$/, () => require('../refactor').offer()],
  ['POST', /^\/api\/refactor$/, (_, b) => require('../refactor').accept(b)],
  // 📜 Business licences (AIG-601).
  ['GET', /^\/api\/licences$/, () => require('../licences').list()],
  ['POST', /^\/api\/licences\/([^/]+)$/, ([id], b) => require('../licences').decide(id, b && b.decision)],
  // 🐞 Live testers' bug reports (AIG-561): send one to the relay; the owner's board fetches and files them now.
  ['POST', /^\/api\/bugreport$/, (_, b) => require('../bugreports').send(b)],
  ['POST', /^\/api\/serverhealth\/poll$/, () => require('../serverhealth').poll()],   // 🩺 (AIG-660)
  ['GET', /^\/api\/serverhealth$/, () => ({ latest: require('../serverhealth').latest(), readings: require('../serverhealth').readings() })],
  ['POST', /^\/api\/bugreports\/collect$/, () => require('../bugreports').collect()],
  // ⛔ No Token Mode (AIG-337): GET the state; POST { on } switches it (off is the "Turn AI back on" button).
  ['GET', /^\/api\/streamer$/, () => require('../streamer').status()],
  ['POST', /^\/api\/streamer$/, (_, b) => require('../streamer').save(b || {})],
  // OBS link (AIG-643..645): { action: 'connect', port?, password? } | { action: 'start' | 'stop' } (Go live / Stop).
  ['POST', /^\/api\/streamer\/obs$/, (_, b) => require('../streamer').obsAction(b || {})],
  // 🎮 Discord activity (AIG-642): GET the settings and whether Discord answered; POST { on, clientId, project } saves; POST open { slug } = the project on screen.
  ['GET', /^\/api\/presence$/, () => require('../discord-presence').status()],
  ['POST', /^\/api\/presence$/, (_, b) => require('../discord-presence').save(b || {})],
  ['POST', /^\/api\/presence\/open$/, (_, b) => require('../discord-presence').setOpen((b || {}).slug)],
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
