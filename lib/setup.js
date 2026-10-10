// First-run setup (AIG-91): the machine-specific settings, saved to aigile.local.json (git-ignored).
// The ⚙️ Setup page shows them; on a new install (no agent program yet) the board opens it first.
const fs = require('fs');
const { LOCAL_FILE: FILE, localSettings, owner, forgetOwner, bad } = require('./store');

// What the page shows and saves: [key in the file, label, help]. Dotted keys live under "agent".
const FIELDS = [
  ['owner', 'Your name', 'Teams address you by it; your comments wake them'],
  ['agent.command', 'Agent program', 'Full path to the AI agent program the board starts for a sleeping team (one * folder allowed)'],
  ['agent.notesFile', 'Agent notes file', "File name, inside each project folder, of the agent's local notes"],
  ['agent.settingsFile', 'Agent settings file', "File name, inside each project folder, of the agent's local settings (hooks and permissions)"],
  ['usageDir', 'Session logs folder', "Folder where the agent keeps its session logs; the ⚡ Usage page reads it"],
  ['globalSettingsFile', 'Global settings file', "The agent's settings file for all projects; used to show how to switch the usage line on"],
];
const get = (o, k) => k.split('.').reduce((v, p) => (v || {})[p], o);
function set(o, k, v) { const ps = k.split('.'), last = ps.pop(); let x = o; for (const p of ps) x = x[p] = x[p] || {}; if (v) x[last] = v; else delete x[last]; }

const needed = s => !get(s, 'agent.command') || !get(s, 'agent.notesFile') || !get(s, 'agent.settingsFile');
function setupStatus() {
  const s = localSettings();
  return { needed: needed(s), fields: FIELDS.map(([key, label, help]) => ({ key, label, help, value: key === 'owner' ? (s.owner || '') : (get(s, key) || '') })), owner: owner() };
}
// Saves only the known fields, keeping anything else already in the file.
function saveSetup(b) {
  const s = localSettings();
  for (const [key] of FIELDS) if (key in (b || {})) set(s, key, String(b[key] || '').trim().replace(/^["']|["']$/g, ''));
  if (!String(s.owner || '').trim()) throw bad('give your name');
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2) + '\n');
  forgetOwner();
  return setupStatus();
}

module.exports = { setupStatus, saveSetup, setupNeeded: () => needed(localSettings()) };
