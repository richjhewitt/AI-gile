// Connecting a project folder (onboarding): notes block + comment hooks, kept out of git.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PORT, ROOT, localSettings, save, bad, owner } = require('./store');

/* ---------- connect a folder ---------- */
// Writes a marked board section into the folder's agent notes and merges the comment hooks and team
// permissions into its agent settings, starts a git repo if there is none, then keeps both out of git via .git/info/exclude. The agent tool's file names are
// machine-specific, so they come from aigile.local.json: "agent": { notesFile, settingsFile }.
const MARK_START = '<!-- AI-gile:start -->', MARK_END = '<!-- AI-gile:end -->';
function connectFolder(p, dir, create) {
  const agent = localSettings().agent || {};
  if (!agent.notesFile || !agent.settingsFile) throw bad('set "agent": { "notesFile", "settingsFile" } in aigile.local.json first');
  dir = String(dir || '').trim().replace(/^["']|["']$/g, '');
  if (!path.isAbsolute(dir)) throw bad('give the full folder path, e.g. C:\\Users\\you\\Projects\\My Project');
  dir = path.resolve(dir);
  const done = [];
  if (!fs.existsSync(dir)) {
    if (!create) throw bad('folder not found: ' + dir);
    fs.mkdirSync(dir, { recursive: true }); done.push('Created the folder');
  }
  if (!fs.statSync(dir).isDirectory()) throw bad('not a folder: ' + dir);
  const me = ROOT.replace(/\\/g, '/'), cli = `node "${me}/aigile.js"`;

  // 1. Notes: one marked block, replaced on reconnect so it never duplicates.
  const block = [MARK_START, '## AI-gile board',
    `This project is tracked on ${owner()}'s AI-gile board at http://localhost:${PORT} (project \`${p.slug}\`).`,
    `- **Scope:** this section is only for sessions started in \`${dir.replace(/\\/g, '/')}\` itself. A session started in a subfolder has its own project: ignore this section there.`,
    `- **Ways of working:** read \`${me}/WAYS-OF-WORKING.md\` at the start of every session and follow it.`,
    `- **Board commands:** read \`${me}/AGENTS.md\` once.`,
    `- **Session start:** run \`${cli} brief ${p.slug}\`.`,
    `- **When idle:** run \`${cli} wait ${p.slug}\` as a background command, so ${owner()}'s comments wake you.`,
    MARK_END].join('\n');
  const notes = path.join(dir, agent.notesFile);
  let text = fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8') : `# ${p.name}: local session notes (not committed)\n`;
  const re = new RegExp(MARK_START + '[\\s\\S]*?' + MARK_END);
  text = re.test(text) ? text.replace(re, block) : text.replace(/\s*$/, '\n\n') + block + '\n';
  fs.writeFileSync(notes, text); done.push('Added the board and ways of working to ' + agent.notesFile);

  // 2. Hooks: merged into existing settings; older AI-gile entries are replaced, others kept.
  const sfile = path.join(dir, agent.settingsFile);
  let s = {};
  if (fs.existsSync(sfile)) { try { s = JSON.parse(fs.readFileSync(sfile, 'utf8')); } catch { throw bad(agent.settingsFile + ' exists but is not valid JSON; fix it first'); } }
  s.hooks = s.hooks || {};
  // SessionStart only peeks: a session that never gets a first message mustn't mark the owner's comments as seen.
  // SessionEnd (AIG-219): a closed window hands over to a background run straight away.
  for (const [ev, cmd] of [['SessionStart', 'updates --hook --peek'], ['UserPromptSubmit', 'updates --hook'], ['Stop', 'updates --stop-hook'], ['PostToolUse', 'ping'], ['SessionEnd', 'bye']]) {
    const [verb, ...flag] = cmd.split(' ');
    s.hooks[ev] = (s.hooks[ev] || []).filter(h => !JSON.stringify(h).includes('aigile.js'))
      .concat({ hooks: [{ type: 'command', command: `${cli} ${verb} ${p.slug}${flag.length ? ' ' + flag.join(' ') : ''}` }] });
  }
  // Background runs can't answer prompts, so the team may run commands, edit files and read the ways of
  // working; git push still asks (AIG-67, AIG-74).
  const perms = s.permissions = s.permissions || {}, union = (a, b) => [...new Set([...(a || []), ...b])];
  for (const k of DEFAULT_TICKS) for (const [list, rules] of Object.entries(PRESETS()[k].rules)) perms[list] = union(perms[list], rules);
  fs.mkdirSync(path.dirname(sfile), { recursive: true });
  fs.writeFileSync(sfile, JSON.stringify(s, null, 2) + '\n'); done.push('Added the comment hooks and team permissions (git push still asks) to ' + agent.settingsFile);

  // A new folder gets its own git repo, so the team can commit from the start.
  if (!fs.existsSync(path.join(dir, '.git')) && spawnSync('git', ['init'], { cwd: dir, windowsHide: true }).status === 0)
    done.push('Started a git repo');

  // 3. Keep both out of git with the local exclude file (the repo's own files are untouched).
  const ex = path.join(dir, '.git', 'info', 'exclude');
  if (fs.existsSync(path.dirname(ex))) {
    const cur = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '';
    const add = [agent.notesFile, agent.settingsFile].filter(f => !cur.split(/\r?\n/).includes(f));
    if (add.length) fs.appendFileSync(ex, (cur && !cur.endsWith('\n') ? '\n' : '') + add.join('\n') + '\n');
    done.push('Kept both files out of git');
  }
  p.path = dir.replace(/\\/g, '/'); save(p); done.push('Linked the folder to ' + p.name);
  return { path: p.path, done };
}

/* ---------- team permissions ---------- */
// The ticks in the 🔐 Permissions dialog, each a set of rules per list. A tick is on when all its rules are there.
// Read rules take an absolute path as //c/folder/... (forward slashes, drive letter without the colon).
const PRESETS = () => ({
  run: { label: 'Run commands', rules: { allow: ['Bash', 'PowerShell'] } },
  edit: { label: 'Edit files', rules: { allow: ['Edit', 'Write'] } },
  web: { label: 'Web access', rules: { allow: ['WebFetch', 'WebSearch'] } },
  push: { label: 'git push asks first', rules: { ask: ['Bash(git push:*)', 'PowerShell(git push:*)'] } },
  ways: { label: 'Read the AI-gile ways of working', rules: { allow: [`Read(//${ROOT.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase())}/**)`] } },
});
const DEFAULT_TICKS = ['run', 'edit', 'push', 'ways'];
const LISTS = ['allow', 'ask', 'deny'];

function settingsPath(p) {
  const agent = localSettings().agent || {};
  if (!agent.settingsFile) throw bad('set "agent": { "settingsFile" } in aigile.local.json first');
  if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first (🔌 Connect folder)');
  return path.join(p.path, agent.settingsFile);
}
function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw bad(path.basename(file) + ' is not valid JSON; fix it by hand first'); }
}
function getPermissions(p) {
  const file = settingsPath(p), perms = readSettings(file).permissions || {};
  return { file: file.replace(/\\/g, '/'), presets: PRESETS(), ...Object.fromEntries(LISTS.map(l => [l, perms[l] || []])) };
}
// Replaces the three rule lists; everything else in the file (hooks, other settings) is kept.
function setPermissions(p, b) {
  const file = settingsPath(p), s = readSettings(file);
  const clean = v => [...new Set((Array.isArray(v) ? v : []).map(x => String(x).trim()).filter(Boolean))];
  s.permissions = s.permissions || {};
  for (const l of LISTS) { const v = clean(b[l]); if (v.length) s.permissions[l] = v; else delete s.permissions[l]; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  return getPermissions(p);
}

// AIG-673: 'auto' lets the team git push (the "asks first" rule moves to allow, force pushes denied); 'ask' puts it back.
const PUSH = ['Bash(git push:*)', 'PowerShell(git push:*)'];
const NOFORCE = ['Bash(git push --force:*)', 'Bash(git push -f:*)', 'Bash(git push --force-with-lease:*)', 'PowerShell(git push --force:*)', 'PowerShell(git push -f:*)'];
function applyPush(p, mode) {
  const file = settingsPath(p);
  if (!fs.existsSync(file)) return false;
  const s = readSettings(file), perms = s.permissions = s.permissions || {}, before = JSON.stringify(perms);
  const without = (l, rules) => { perms[l] = (perms[l] || []).filter(x => !rules.includes(x)); if (!perms[l].length) delete perms[l]; };
  const add = (l, rules) => { perms[l] = [...new Set([...(perms[l] || []), ...rules])]; };
  if (mode === 'auto') { without('ask', PUSH); add('allow', PUSH); add('deny', NOFORCE); }
  else { if ((perms.allow || []).some(x => PUSH.includes(x))) { without('allow', PUSH); add('ask', PUSH); } without('deny', NOFORCE); }
  if (JSON.stringify(perms) === before) return false;
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  return true;
}

module.exports = { applyPush, connectFolder, getPermissions, setPermissions };
