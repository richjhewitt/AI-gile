// First-run setup (AIG-91): the machine-specific settings, saved to aigile.local.json (git-ignored).
// The ⚙️ Setup page shows them; on a new install (no agent program yet) the board opens it first.
const fs = require('fs');
const { urlFor } = require('./logos');
const { LOCAL_FILE: FILE, localSettings, owner, forgetOwner, bad } = require('./store');

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

const needed = s => !get(s, 'agent.command') || !get(s, 'agent.notesFile') || !get(s, 'agent.settingsFile');
function setupStatus() {
  const s = localSettings();
  return { needed: needed(s), fields: FIELDS.map(([key, label, help]) => ({ key, label, help, value: key === 'owner' ? (s.owner || '') : (get(s, key) || '') })), owner: owner(), logo: urlFor('_app', '/api/app-logo') };   // app logo (AIG-175)
}
// Saves only the known fields, keeping anything else already in the file.
function saveSetup(b) {
  const s = localSettings();
  for (const [key] of FIELDS) if (key in (b || {})) set(s, key, String(b[key] || '').trim().replace(/^["']|["']$/g, ''));
  if (!String(s.owner || '').trim()) throw bad('give your name');
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2) + '\n');
  forgetOwner();
  ensureWays();
  return setupStatus();
}

// The owner's ways of working (AIG-96) are a private local file, never in git. A new install gets the
// starter from docs/starter with the owner's name filled in; an existing file is never touched.
const path = require('path');
function ensureWays() {
  const ROOT = path.dirname(__dirname), file = path.join(ROOT, 'WAYS-OF-WORKING.md'), starter = path.join(ROOT, 'docs', 'starter', 'WAYS-OF-WORKING.md');
  try { if (!fs.existsSync(file) && fs.existsSync(starter)) fs.writeFileSync(file, fs.readFileSync(starter, 'utf8').split('{owner}').join(owner())); } catch {}
}
// At start only once a name is set, so a new install never gets someone else's name in it.
if (process.env.AIGILE_OWNER || localSettings().owner) ensureWays();

module.exports = { setupStatus, saveSetup, setupNeeded: () => needed(localSettings()), ensureWays };
