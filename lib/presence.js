// Team presence (is a session alive?) and waking a team in a visible terminal.
const fs = require('fs');
const { load, listSlugs, localSettings, bad } = require('./store');

/* ---------- presence ---------- */
// A team counts as online if its session was heard from in the last 5 minutes: hooks and 'aigile wait'
// (every 15s while idle) call /updates, and the status line reports its folder with each reading.
const ONLINE_MS = 5 * 60e3;
const lastHeard = new Map();   // slug -> ms
const heard = slug => lastHeard.set(slug, Date.now());
function presenceOf(slug) {
  const t = lastHeard.get(slug), woke = waking.get(slug);
  return { online: !!t && Date.now() - t < ONLINE_MS, lastHeard: t ? new Date(t).toISOString() : null,
    waking: !!woke && Date.now() - woke < 2 * 60e3 && !(t && t > woke) };
}
function heardFromFolder(dir) {
  const norm = d => String(d || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const d = norm(dir);
  if (!d) return;
  for (const s of listSlugs()) { const p = load(s); if (p && p.path && norm(p.path) === d) heard(s); }
}
const waking = new Map();   // slug -> ms when Rich clicked Wake

/* ---------- waking a team ---------- */
// The agent command comes from aigile.local.json "agent.command"; one '*' path segment is allowed
// (resolved to the newest match), so a versioned install folder keeps working after updates.
function agentCommand() {
  const cmd = process.env.AIGILE_AGENT_COMMAND || (localSettings().agent || {}).command;
  if (!cmd) throw bad('set "agent": { "command": "<full path to the agent program>" } in aigile.local.json first');
  if (!cmd.includes('*')) return cmd;
  const parts = cmd.replace(/\\/g, '/').split('/'), i = parts.findIndex(x => x.includes('*'));
  const parent = parts.slice(0, i).join('/'), re = new RegExp('^' + parts[i].split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  const hits = (fs.existsSync(parent) ? fs.readdirSync(parent) : []).filter(n => re.test(n))
    .map(n => [parent, n, ...parts.slice(i + 1)].join('/')).filter(f => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!hits.length) throw bad('agent program not found: ' + cmd);
  return hits[0];
}
function wakeTeam(p) {
  if (!p.path || !fs.existsSync(p.path)) throw bad('connect a folder to this project first (🔌 Connect folder)');
  const exe = agentCommand();
  const prompt = `Rich woke you from the AI-gile board. Read your notes, run the board brief for project ${p.slug}, deal with his comments, then keep the wait command running in the background.`;
  if (process.platform !== 'win32') throw bad('waking a team opens a Windows terminal; not supported on this system');
  const { spawn } = require('child_process');
  // start "<title>" cmd /k <exe> "<prompt>": a new, visible window that stays open after the session ends.
  spawn('cmd.exe', ['/c', 'start', `${p.name} team`, 'cmd', '/k', exe, prompt], { cwd: p.path, detached: true, stdio: 'ignore' }).unref();
  waking.set(p.slug, Date.now());
  return { ok: true, folder: p.path };
}

module.exports = { heard, presenceOf, heardFromFolder, wakeTeam };
