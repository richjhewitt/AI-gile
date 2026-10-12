// First-run setup (AIG-91): the machine-specific settings, saved to aigile.local.json (git-ignored).
// The ⚙️ Setup page shows them; on a new install (no agent program yet) the board opens it first.
const fs = require('fs');
const { urlFor } = require('./logos');
const { libraryStatus } = require('./avatars');
const { LOCAL_FILE: FILE, localSettings, owner, forgetOwner, bad, listSlugs, load, save } = require('./store');

// What the page shows and saves: [key in the file, label, help]. Dotted keys live under "agent".
const FIELDS = [
  ['owner', 'Your name', 'Teams address you by it; your comments wake them'],
  ['agent.command', 'Agent program', 'Full path to the AI agent program the board starts for a sleeping team (one * folder allowed)'],
  ['agent.notesFile', 'Agent notes file', "File name, inside each project folder, of the agent's local notes"],
  ['agent.settingsFile', 'Agent settings file', "File name, inside each project folder, of the agent's local settings (hooks and permissions)"],
  ['usageDir', 'Session logs folder', "Folder where the agent keeps its session logs; the ⚡ Usage page reads it"],
  ['avatarsDir', 'Picture library', "Folder of pictures the agents pick from when they join a team (png, jpg, svg, webp, gif). Empty: the avatars folder in the board's data folder"],   // AIG-150
  ['editor', 'Your editor', 'Command that opens a file, e.g. code, cursor or notepad++. Empty: VS Code if installed, else the Windows default'],
  // Zip installs (AIG-251): where updates come from, and how soon.
  ['updates.url', 'Update address', 'Only if you got AI-gile as a zip: the latest.json address you were given. Empty: no updates'],
  ['updates.channel', 'Updates', 'stable: once a day, or latest: as soon as there is a new one'],
  ['giphyKey', 'Giphy API key', 'Free key from developers.giphy.com; turns on 🎞️ GIF search in comments and chats. Kept on this computer only'],   // AIG-343
  ['globalSettingsFile', 'Global settings file', "The agent's settings file for all projects; used to show how to switch the usage line on"],
];
const get = (o, k) => k.split('.').reduce((v, p) => (v || {})[p], o);
function set(o, k, v) { const ps = k.split('.'), last = ps.pop(); let x = o; for (const p of ps) x = x[p] = x[p] || {}; if (v) x[last] = v; else delete x[last]; }

// What kind of lead (AIG-235): the owner's choices from the Setup questionnaire, each also a switch of its own.
// lead.tidyCards (AIG-234), lead.chatty: chatty lead for new projects (AIG-140), lead.go: '' | 'ask' | 'small' (one line
// in the board brief), night.watchAll: going quiet ticks every project for the watchman (off: none ticked).
// runIn / runCmd (AIG-153): where every team runs unless its project says otherwise ("runs": { where, cmd }).
// light (AIG-268): Pro-friendly runs, see lib/presence.js.
// steps (AIG-416): how many instructions at a time for anything the owner does by hand, 1 (one step) to 5 (all at once).
// Saved as scales.steps. Not saved yet: 1 on an install that already has a name (its ways of working say one step), 3 on a new one.
// pace (AIG-466) is not a setting: the scale step says where to finish the week (lib/budget.js PACE), a custom mix uses the weekly budget.
const prefsOf = s => { const p = prefsBase(s), plan = planOf(p); return { ...p, plan, pace: require('./budget').PACE[plan] || p.budgetWk, scales: scalesOf(s, p, plan) }; };
const prefsBase = s => { const l = s.lead || {}, r = s.runs || {}; return { lang: s.lang || '', techLevel: ['beginner', 'some', 'expert'].includes(s.techLevel) ? s.techLevel : '', tidyCards: !!l.tidyCards, chatty: !!l.chatty, go: l.go || '', steps: stepsOf(s), watchAll: (s.night || {}).watchAll !== false, smRole: (s.scrumMaster || {}).role === true, smPush: (() => { const n = parseInt((s.scrumMaster || {}).push, 10); return n >= 1 && n <= 5 ? n : 3; })(), runIn: r.where || 'background', runCmd: r.cmd || '', light: !!r.light, wizardSeen: !!(s.wizard || {}).seen, dispatch: ['rules', 'haiku', 'lead'].includes(s.dispatch) ? s.dispatch : 'haiku', trustTester: require('./tester').trust(), helpLevel: s.helpLevel || '', iconColors: require('./appicon').colours(s.appIcon), iconCustom: !!s.appIcon, newRoles: Array.isArray(l.roles) ? l.roles : '',
  // AIG-353: usage checks, token budget %, max parallel runs, helpers per model (blank = no limit)
  servers: require('./servers').list(), usageChecks: require('./usagecheck').mode(), budgetH5: B().h5, budgetWk: B().wk, saveH5: B().saveH5 || '', saveWk: B().saveWk || '', maxRuns: B().parallel, ...Object.fromEntries(['opus', 'sonnet', 'haiku'].map(m => ['helpers' + m[0].toUpperCase() + m.slice(1), (s.helpers || {})[m] ?? '']) ) }; };
const B = () => require('./budget').budget();
// The owner scales (AIG-418, lib/profiles.js): today's switches read and written as scale steps. scales.X keeps a step the
// old switch can't hold (chat 5, go 4); the old switches stay in step, so code that reads them works unchanged.
// thrift is the spend plan (1 nospare .. 5 fly; a custom mix has none), push is the Scrum Master's smPush, words the 📖 explain.
const THRIFT = ['nospare', 'generous', 'normal', 'careful', 'fly'];
const OLD = { chat: ['chatty', n => n >= 3, v => v ? 3 : 2], go: ['go', n => n === 1 ? 'ask' : n >= 3 ? 'small' : '', v => ({ ask: 1, small: 3 })[v] || 2], tidy: ['tidyCards', n => n >= 2, v => v ? 3 : 1], words: ['explain', n => n <= 2, v => v ? 1 : 4] };
const OWNER_SCALES = ['steps', 'chat', 'go', 'words', 'tidy', 'thrift', 'push'];
function scalesOf(s, p, plan) {
  const st = s.scales || {}, ok = k => require('./profiles').inRange(k, st[k]);
  // A stored step that no longer matches its switch (changed by hand in the file) gives way to the switch.
  const sc = Object.fromEntries(['chat', 'go', 'tidy'].map(k => { const [old, to, from] = OLD[k]; return [k, ok(k) !== null && to(st[k]) === p[old] ? st[k] : from(p[old])]; }));
  return { steps: p.steps, ...sc, words: ok('words') ?? 2, thrift: THRIFT.indexOf(plan) + 1 || null, push: p.smPush };
}
// Writes one owner step and its old switch.
function writeScale(s, k, n) {
  const st = s.scales = s.scales || {}, l = s.lead = s.lead || {};
  st[k] = n;
  if (k === 'chat') l.chatty = OLD.chat[1](n);
  if (k === 'tidy') l.tidyCards = OLD.tidy[1](n);
  if (k === 'go') { if (OLD.go[1](n)) l.go = OLD.go[1](n); else delete l.go; }
}
// An old switch sent on its own: its stored step stays if the switch still says the same, else it follows the switch.
function oldSwitch(s, k, v) { const st = s.scales || {}, [, to, from] = OLD[k]; if (!(k in st) || to(st[k]) !== v) writeScale(s, k, from(v)); }
const stepsOf = s => { const n = (s.scales || {}).steps; return Number.isInteger(n) && n >= 1 && n <= 5 ? n : String(s.owner || '').trim() ? 1 : 3; };
// The budget scale (AIG-353): one step sets the usage checks, both budget %, the run cap and the helpers per model.
// The one table for the Setup page and the setup wizard. Sent to the page as plans in GET /api/setup.
const PLANS = {
  fly: { usageChecks: 'off', budgetH5: 30, budgetWk: 50, maxRuns: 1, helpersOpus: 0, helpersSonnet: 1, helpersHaiku: 2 },
  careful: { usageChecks: 'hand', budgetH5: 60, budgetWk: 75, maxRuns: 2, helpersOpus: 0, helpersSonnet: 2, helpersHaiku: 3 },
  normal: { usageChecks: 'hand', budgetH5: 90, budgetWk: 95, maxRuns: 3, helpersOpus: 1, helpersSonnet: 3, helpersHaiku: 4 },
  generous: { usageChecks: 'auto', budgetH5: 95, budgetWk: 98, maxRuns: 5, helpersOpus: 2, helpersSonnet: 5, helpersHaiku: 6 },
  nospare: { usageChecks: 'auto', budgetH5: 100, budgetWk: 100, maxRuns: 0, helpersOpus: '', helpersSonnet: '', helpersHaiku: '' },
};
const planOf = p => Object.keys(PLANS).find(k => Object.entries(PLANS[k]).every(([f, v]) => p[f] === v)) || '';
function setPrefs(s, pr) {
  let sc = null;
  if ('scales' in pr) {   // { steps: 1, chat: 3, ... }: owner scales only, each a whole number in range (AIG-418)
    sc = pr.scales || {};
    if (typeof sc !== 'object' || Array.isArray(sc)) throw bad('scales must be an object of scale: step');
    for (const k of Object.keys(sc)) {
      if (!OWNER_SCALES.includes(k)) throw bad(`scales: ${k} is not an owner scale (${OWNER_SCALES.join(', ')})`);
      if (require('./profiles').inRange(k, sc[k]) === null) throw bad(`scales: ${k} must be a whole number from 1 to ${require('./profiles').SCALES[k].max}`);
    }
    pr = { ...pr };
    if ('thrift' in sc) pr.plan = THRIFT[sc.thrift - 1];
    if ('push' in sc) pr.smPush = sc.push;
  }
  if (pr.plan) { if (!PLANS[pr.plan]) throw bad('plan must be ' + Object.keys(PLANS).join(', ')); pr = { ...PLANS[pr.plan], ...pr }; }
  const l = s.lead = s.lead || {};
  if ('runIn' in pr) { const W = require('./presence').WHERE; if (!W.includes(pr.runIn)) throw bad('runIn must be ' + W.join(', ')); (s.runs = s.runs || {}).where = pr.runIn; }
  if ('runCmd' in pr) { const c = String(pr.runCmd || '').trim().slice(0, 500); s.runs = s.runs || {}; if (c) s.runs.cmd = c; else delete s.runs.cmd; }
  if ('tidyCards' in pr) oldSwitch(s, 'tidy', !!pr.tidyCards);
  if ('chatty' in pr) oldSwitch(s, 'chat', !!pr.chatty);
  if ('go' in pr) { if (pr.go && !['ask', 'small'].includes(pr.go)) throw bad('go must be ask, small or empty'); oldSwitch(s, 'go', pr.go || ''); }
  if ('explain' in pr) oldSwitch(s, 'words', !!pr.explain);   // 📖 dev words explained (the page keeps its own switch too)
  if ('steps' in pr) { const n = Number(pr.steps); if (!Number.isInteger(n) || n < 1 || n > 5) throw bad('steps must be 1 to 5'); (s.scales = s.scales || {}).steps = n; }
  if (sc) for (const k of ['steps', 'chat', 'go', 'words', 'tidy']) if (k in sc) writeScale(s, k, Number(sc[k]));
  if ('smPush' in pr) { const n = parseInt(pr.smPush, 10); if (!(n >= 1 && n <= 5)) throw bad('smPush must be 1 to 5'); (s.scrumMaster = s.scrumMaster || {}).push = n; }   // the Lead Scrum Master's diligence scale (AIG-441)
  if ('lang' in pr && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(pr.lang)) s.lang = pr.lang;   // the page's language, so server-written text follows it (AIG-488, lib/i18n.js)
  if ('smRole' in pr) (s.scrumMaster = s.scrumMaster || {}).role = !!pr.smRole;   // the Lead Scrum Master as an optional team role (AIG-476)
  if ('watchAll' in pr) (s.night = s.night || {}).watchAll = !!pr.watchAll;
  if ('techLevel' in pr) { if (pr.techLevel && !['beginner', 'some', 'expert'].includes(pr.techLevel)) throw bad('techLevel must be beginner, some, expert or empty'); if (pr.techLevel) s.techLevel = pr.techLevel; else delete s.techLevel; }   // AIG-428
  if ('wizardSeen' in pr) { if (pr.wizardSeen) s.wizard = { seen: true }; else delete s.wizard; }
  if ('servers' in pr) { const v = require('./servers').check(pr.servers); if (v.length) s.servers = v; else delete s.servers; }   // AIG-374
  if ('iconColors' in pr) { const c = require('./appicon').check(pr.iconColors); if (c) s.appIcon = c; else delete s.appIcon; require('./appicon').write(c); }   // AIG-400: the app icon's colours, drawn to data/appicon/
  if ('light' in pr) (s.runs = s.runs || {}).light = !!pr.light;
  if ('dispatch' in pr) { const M = require('./dispatch').MODES; if (!M.includes(pr.dispatch)) throw bad('dispatch must be ' + M.join(', ')); s.dispatch = pr.dispatch; }   // AIG-364
  if ('trustTester' in pr) { const T = require('./tester').TRUST; if (!T.includes(pr.trustTester)) throw bad('trustTester must be ' + T.join(', ')); if (pr.trustTester === 'check') { if (s.tester) delete s.tester.trust; if (s.tester && !Object.keys(s.tester).length) delete s.tester; } else (s.tester = s.tester || {}).trust = pr.trustTester; }   // Trust the AI tester (AIG-467)
  if ('usageChecks' in pr) {
    if (!['off', 'hand', 'auto'].includes(pr.usageChecks)) throw bad('usageChecks must be off, hand or auto');
    if (pr.usageChecks === 'off') s.usageChecks = 'off'; else { delete s.usageChecks; require('./usagecheck').setUsageAuto(pr.usageChecks === 'auto'); }
  }
  const whole = (k, lo, hi) => { const n = Number(pr[k]); if (!Number.isInteger(n) || n < lo || n > hi) throw bad(k + ' must be a whole number from ' + lo + ' to ' + hi); return n; };
  if ('budgetH5' in pr) (s.budget = s.budget || {}).h5 = whole('budgetH5', 1, 100);
  if ('budgetWk' in pr) (s.budget = s.budget || {}).wk = whole('budgetWk', 1, 100);
  for (const [k, f] of [['saveH5', 'saveH5'], ['saveWk', 'saveWk']]) if (k in pr) {   // usage saver (AIG-548): empty/0 = off
    if (pr[k] === '' || pr[k] === null || Number(pr[k]) === 0) { if (s.budget) delete s.budget[f]; } else (s.budget = s.budget || {})[f] = whole(k, 1, 99);
  }
  if ('maxRuns' in pr) (s.budget = s.budget || {}).parallel = whole('maxRuns', 0, 50);
  for (const m of ['opus', 'sonnet', 'haiku']) { const k = 'helpers' + m[0].toUpperCase() + m.slice(1); if (k in pr) { if (pr[k] === '' || pr[k] === null) { if (s.helpers) delete s.helpers[m]; } else (s.helpers = s.helpers || {})[m] = whole(k, 0, 50); } }
  if ('helpLevel' in pr) { if (pr.helpLevel && !['1', '2', '3'].includes(String(pr.helpLevel))) throw bad('helpLevel must be 1, 2, 3 or empty'); if (pr.helpLevel) s.helpLevel = String(pr.helpLevel); else delete s.helpLevel; }   // how much help the app gives (AIG-347): 1 most, 3 least; set by an invite
  if ('newRoles' in pr) {   // default team roles for new projects (AIG-355); empty = all on
    const PR = require('./profiles');   // old role names or role template ids (AIG-420)
    if (pr.newRoles === '' || pr.newRoles === null) delete l.roles;
    else { if (!Array.isArray(pr.newRoles) || pr.newRoles.some(r => !PR.OLD_ROLES[r] && !PR.template(r))) throw bad('newRoles must be a list of team roles, or empty for all'); l.roles = PR.storeRoles(pr.newRoles) || Object.keys(PR.OLD_ROLES); }
  }
  // "Also for my projects now": the chatty answer goes to every active project too.
  if (pr.chattyAll) for (const p of listSlugs().map(load)) if (p && !p.archived && !!p.chatty !== l.chatty) { p.chatty = l.chatty || undefined; save(p); }
}

// What a brand-new install suggests for an empty field (shown as a suggestion; saved only when the owner takes it).
const os = require('os'), path = require('path');
const fwd = p => p.split(path.sep).join('/');
function agentGuess() {
  const home = os.homedir(), ext = path.join(home, '.vscode', 'extensions');
  try { if (fs.readdirSync(ext).some(n => /^anthropic\.claude-code-.*win32-x64$/.test(n))) return fwd(ext) + '/anthropic.claude-code-*-win32-x64/resources/native-binary/claude.exe'; } catch {}
  for (const f of [path.join(home, '.local', 'bin', 'claude.exe'), path.join(process.env.APPDATA || '', 'npm', 'claude.cmd')]) if (fs.existsSync(f)) return fwd(f);
  return '';
}
const SUGGEST = {
  'agent.command': agentGuess,
  'agent.notesFile': () => 'CLAUDE.local.md',
  'agent.settingsFile': () => '.claude/settings.local.json',
  usageDir: () => { const d = path.join(os.homedir(), '.claude', 'projects'); return fs.existsSync(d) ? fwd(d) : ''; },
};
const needed = s => !get(s, 'agent.command') || !get(s, 'agent.notesFile') || !get(s, 'agent.settingsFile');
function setupStatus() {
  const s = localSettings();
  // The agent program is checked (AIG-254): a typo would only show when a team fails to wake.
  let agentProblem = ''; if (get(s, 'agent.command')) try { const c = require('./presence').agentCommand(); if (/[\\/]/.test(c) && !fs.existsSync(c)) agentProblem = 'not found: ' + c; } catch (e) { agentProblem = e.message; }
  return { needed: needed(s), agentProblem, fields: FIELDS.map(([key, label, help]) => ({ key, label, help, value: key === 'owner' ? (s.owner || '') : key === 'giphyKey' ? require('./giphy').mask(s.giphyKey || '') : (get(s, key) || ''),
    // A guess is only a suggestion (AIG-334): the page offers it, and it is saved only when the owner takes it.
    suggest: key !== 'owner' && !get(s, key) && SUGGEST[key] ? SUGGEST[key]() : '' })), owner: owner(), prefs: prefsOf(s), plans: PLANS, logo: urlFor('_app', '/api/app-logo'), mePic: urlFor('_me', '/api/me-picture'), library: libraryStatus() };   // app logo (AIG-175), profile pictures (AIG-150)
}
// Saves only the known fields, keeping anything else already in the file.
function saveSetup(b) {
  const s = localSettings(), fresh = !String(s.owner || '').trim();
  for (const [key] of FIELDS) if (key in (b || {}) && !(key === 'giphyKey' && require('./giphy').isMask(b[key]))) set(s, key, String(b[key] || '').trim().replace(/^["']|["']$/g, ''));
  // Prefs alone (the wizard's "I'll wing it") need no name yet.
  const prefsOnly = b && b.prefs && Object.keys(b).every(k => k === 'prefs');
  if (!String(s.owner || '').trim() && !prefsOnly) throw bad('give your name');
  if (get(s, 'updates.channel') && !['stable', 'latest'].includes(get(s, 'updates.channel'))) throw bad('updates: stable or latest');
  if (b && b.prefs && typeof b.prefs === 'object') setPrefs(s, b.prefs);
  if (fresh && String(s.owner || '').trim() && !(s.scales || {}).steps) (s.scales = s.scales || {}).steps = 3;   // a new install keeps its default of 3 once named
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2) + '\n');
  forgetOwner();
  if (String(s.owner || '').trim()) ensureWays();
  return setupStatus();
}

// The owner's ways of working (AIG-96) are a private local file, never in git. A new install gets the
// starter from docs/starter with the owner's name filled in; an existing file is never touched.
function ensureWays() {
  const ROOT = path.dirname(__dirname), file = path.join(ROOT, 'WAYS-OF-WORKING.md'), starter = path.join(ROOT, 'docs', 'starter', 'WAYS-OF-WORKING.md');
  try { if (!fs.existsSync(file) && fs.existsSync(starter)) fs.writeFileSync(file, fs.readFileSync(starter, 'utf8').split('{owner}').join(owner())); } catch {}
}
// At start only once a name is set, so a new install never gets someone else's name in it.
if (process.env.AIGILE_OWNER || localSettings().owner) ensureWays();

// For an invite (lib/join.js): save prefs without the name check saveSetup makes.
const applyPrefs = pr => { const s = localSettings(); setPrefs(s, pr); fs.writeFileSync(FILE, JSON.stringify(s, null, 2) + '\n'); };

module.exports = { applyPrefs, prefsOf, PLANS, setupStatus, saveSetup, setupNeeded: () => needed(localSettings()), ensureWays };
