// First-run setup (AIG-91): the machine-specific settings, saved to aigile.local.json (git-ignored).
// The ⚙️ Setup page shows them; on a new install (no agent program yet) the board opens it first.
const fs = require('fs');
const { urlFor } = require('./logos');
const { LOCAL_FILE: FILE, localSettings, owner, forgetOwner, bad, listSlugs, load, save } = require('./store');

// What the page shows and saves: [key in the file, label, help]. Dotted keys live under "agent".
const FIELDS = [
  ['owner', 'Your name', 'Teams address you by it; your comments wake them'],
  ['agent.command', 'Agent program', 'Full path to the AI agent program the board starts for a sleeping team (one * folder allowed)'],
  ['agent.notesFile', 'Agent notes file', "File name, inside each project folder, of the agent's local notes"],
  ['agent.settingsFile', 'Agent settings file', "File name, inside each project folder, of the agent's local settings (hooks and permissions)"],
  ['usageDir', 'Session logs folder', "Folder where the agent keeps its session logs; the ⚡ Usage page reads it"],
  ['editor', 'Your editor', 'Command that opens a file, e.g. code, cursor or notepad++. Empty: VS Code if installed, else the Windows default'],
  ['globalSettingsFile', 'Global settings file', "The agent's settings file for all projects; used to show how to switch the usage line on"],
];
const get = (o, k) => k.split('.').reduce((v, p) => (v || {})[p], o);
function set(o, k, v) { const ps = k.split('.'), last = ps.pop(); let x = o; for (const p of ps) x = x[p] = x[p] || {}; if (v) x[last] = v; else delete x[last]; }

// What kind of lead (AIG-235): the owner's choices from the Setup questionnaire, each also a switch of its own.
// lead.tidyCards (AIG-234), lead.chatty: chatty lead for new projects (AIG-140), lead.go: '' | 'ask' | 'small' (one line
// in the board brief), night.watchAll: going quiet ticks every project for the watchman (off: none ticked).
const prefsOf = s => { const l = s.lead || {}; return { tidyCards: !!l.tidyCards, chatty: !!l.chatty, go: l.go || '', watchAll: (s.night || {}).watchAll !== false }; };
function setPrefs(s, pr) {
  const l = s.lead = s.lead || {};
  if ('tidyCards' in pr) l.tidyCards = !!pr.tidyCards;
  if ('chatty' in pr) l.chatty = !!pr.chatty;
  if ('go' in pr) { if (pr.go && !['ask', 'small'].includes(pr.go)) throw bad('go must be ask, small or empty'); if (pr.go) l.go = pr.go; else delete l.go; }
  if ('watchAll' in pr) (s.night = s.night || {}).watchAll = !!pr.watchAll;
  // "Also for my projects now": the chatty answer goes to every active project too.
  if (pr.chattyAll) for (const p of listSlugs().map(load)) if (p && !p.archived && !!p.chatty !== l.chatty) { p.chatty = l.chatty || undefined; save(p); }
}

// What a brand-new install suggests for an empty field (saved only when the owner clicks Save).
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
  return { needed: needed(s), fields: FIELDS.map(([key, label, help]) => ({ key, label, help, value: key === 'owner' ? (s.owner || '') : (get(s, key) || (SUGGEST[key] ? SUGGEST[key]() : '')) })), owner: owner(), prefs: prefsOf(s), logo: urlFor('_app', '/api/app-logo') };   // app logo (AIG-175)
}
// Saves only the known fields, keeping anything else already in the file.
function saveSetup(b) {
  const s = localSettings();
  for (const [key] of FIELDS) if (key in (b || {})) set(s, key, String(b[key] || '').trim().replace(/^["']|["']$/g, ''));
  if (!String(s.owner || '').trim()) throw bad('give your name');
  if (b && b.prefs && typeof b.prefs === 'object') setPrefs(s, b.prefs);
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2) + '\n');
  forgetOwner();
  ensureWays();
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

module.exports = { prefsOf, setupStatus, saveSetup, setupNeeded: () => needed(localSettings()), ensureWays };
