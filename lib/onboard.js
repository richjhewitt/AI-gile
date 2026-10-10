// Connecting a project folder (onboarding): notes block + comment hooks, kept out of git.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PORT, ROOT, localSettings, save, bad } = require('./store');

/* ---------- connect a folder ---------- */
// Writes a marked board section into the folder's agent notes and merges the comment hooks and team
// permissions into its agent settings, starts a git repo if there is none, then keeps both out of git via .git/info/exclude. The agent tool's file names are
// machine-specific, so they come from aigile.local.json: "agent": { notesFile, settingsFile }.
const MARK_START = '<!-- AI-gile:start -->', MARK_END = '<!-- AI-gile:end -->';
function connectFolder(p, dir, create) {
  const agent = localSettings().agent || {};
  if (!agent.notesFile || !agent.settingsFile) throw bad('set "agent": { "notesFile", "settingsFile" } in aigile.local.json first');
  dir = String(dir || '').trim().replace(/^["']|["']$/g, '');
  if (!path.isAbsolute(dir)) throw bad('give the full folder path, e.g. C:\\Users\\rich\\Desktop\\My Project');
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
    `This project is tracked on Rich's AI-gile board at http://localhost:${PORT} (project \`${p.slug}\`).`,
    `- **Scope:** this section is only for sessions started in \`${dir.replace(/\\/g, '/')}\` itself. A session started in a subfolder has its own project: ignore this section there.`,
    `- **Ways of working:** read \`${me}/WAYS-OF-WORKING.md\` at the start of every session and follow it.`,
    `- **Board commands:** read \`${me}/AGENTS.md\` once.`,
    `- **Session start:** run \`${cli} brief ${p.slug}\`.`,
    `- **When idle:** run \`${cli} wait ${p.slug}\` as a background command, so Rich's comments wake you.`,
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
  // SessionStart only peeks: a session that never gets a first message mustn't mark Rich's comments as seen.
  for (const [ev, flag] of [['SessionStart', '--hook --peek'], ['UserPromptSubmit', '--hook'], ['Stop', '--stop-hook']]) {
    s.hooks[ev] = (s.hooks[ev] || []).filter(h => !JSON.stringify(h).includes('aigile.js'))
      .concat({ hooks: [{ type: 'command', command: `${cli} updates ${p.slug} ${flag}` }] });
  }
  // Background runs can't answer prompts, so the team may run commands and edit files; git push still asks (AIG-67).
  const perms = s.permissions = s.permissions || {}, union = (a, b) => [...new Set([...(a || []), ...b])];
  perms.allow = union(perms.allow, ['Bash', 'PowerShell', 'Edit', 'Write']);
  perms.ask = union(perms.ask, ['Bash(git push:*)', 'PowerShell(git push:*)']);
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

module.exports = { connectFolder };
