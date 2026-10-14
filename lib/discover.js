// New user mode (AIG-94): find the projects in a folder and fill the board, with no AI involved.
// Each sub-folder is looked at with plain file and git checks: git history, the agent's old sessions
// (the session logs folder from setup), and a description from its README. The owner ticks what to import.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, listSlugs, load, localSettings, bad } = require('./store');

const DAY = 864e5;
const git = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8', windowsHide: true, timeout: 8000 }); return r.status === 0 ? (r.stdout || '').trim() : ''; };
// The agent's session folder name for a project path: every non-alphanumeric character becomes '-'.
const sessionFolder = p => String(p).replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
const norm = p => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

function readmeLine(dir) {
  const f = ['README.md', 'readme.md', 'Readme.md'].map(n => path.join(dir, n)).find(x => fs.existsSync(x));
  if (!f) return '';
  // Some READMEs are saved as UTF-16 (with a byte order mark): decode those properly.
  const buf = fs.readFileSync(f), text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  // The first paragraph, not the first line: READMEs are often hard-wrapped (AIG-332).
  const para = []; let open = false;
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || /^(#|!\[|<|```|---|\|)/.test(l)) { if (open) break; continue; }
    para.push(l); open = true;
  }
  return shorten(para.join(' ').replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'), 160);
}
// Cut at the end of a sentence if one fits, else at a word, with an ellipsis (never mid-word).
function shorten(s, max) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max), sent = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sent >= max / 3) return head.slice(0, sent + 1);
  const sp = head.lastIndexOf(' ');
  return head.slice(0, sp > max / 3 ? sp : max).replace(/[\s,;:.\-]+$/, '') + '…';
}

// [{ name, path, git: { commits, lastAt, remote } | null, sessions: { count, lastAt } | null, readme, copy, known, suggested }]
function discover(dir) {
  dir = path.resolve(String(dir || process.env.AIGILE_HOME || path.dirname(ROOT)));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw bad('folder not found: ' + dir);
  const projects = listSlugs().map(load).filter(p => p && p.path), known = new Set(projects.map(p => norm(p.path)));
  const logs = localSettings().usageDir, logDirs = new Map();
  try { for (const d of fs.readdirSync(logs)) logDirs.set(d.toLowerCase(), path.join(logs, d)); } catch {}
  const names = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
  return names.map(name => {
    const full = path.join(dir, name), gitPath = path.join(full, '.git');
    const isGit = fs.existsSync(gitPath);
    const g = isGit ? { commits: Number(git(full, 'rev-list', '--count', 'HEAD')) || 0, lastAt: git(full, 'log', '-1', '--format=%cI') || null, remote: git(full, 'remote', 'get-url', 'origin') || '' } : null;
    let sessions = null;
    const ld = logDirs.get(sessionFolder(full));
    if (ld) {
      const files = fs.readdirSync(ld).filter(f => f.endsWith('.jsonl')).map(f => fs.statSync(path.join(ld, f)).mtimeMs);
      if (files.length) sessions = { count: files.length, lastAt: new Date(Math.max(...files)).toISOString() };
    }
    // A worktree (.git is a file) or "Name-something" next to "Name" is most likely a copy of another project.
    const copy = (isGit && fs.statSync(gitPath).isFile()) || names.some(o => o !== name && name.startsWith(o + '-'));
    const recent = [g && g.lastAt, sessions && sessions.lastAt].filter(Boolean).some(t => Date.now() - Date.parse(t) < 90 * DAY);
    const isKnown = known.has(norm(full));
    // Inside a folder an existing project already covers (e.g. a bot inside a bigger project): not suggested.
    const inside = (projects.find(p => norm(full).startsWith(norm(p.path) + '/')) || {}).name || '';
    return { name, path: full.replace(/\\/g, '/'), git: g, sessions, readme: readmeLine(full), copy, known: isKnown, inside,
      suggested: !isKnown && !inside && !copy && (!!g || !!sessions) && recent };
  }).sort((a, b) => (b.suggested - a.suggested) || a.name.localeCompare(b.name));
}

module.exports = { discover };
