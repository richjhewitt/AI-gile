// Public copy (AIG-179): node tools/public-copy.mjs [folder] [--ref attach] [--force] [--scan]
// Takes the tracked files at a ref (git archive), puts them in a new folder outside the repo, runs git init there and
// makes one commit "AI-gile v0.1", so the public repo starts with clean history. Never pushes and never makes a remote.
// Then scans the tracked files for personal data and prints file:line plus a short snippet.
// --scan alone only scans (no copy). Re-runnable: it refuses if the folder exists unless --force.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ref = opt('--ref') || 'attach';
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--ref');
const DEST = path.resolve(positional[0] || "C:/Users/rich/Desktop/Bots 'n' Code Stuff/AI-gile-public");
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

const RULES = [
  ['personal name', /\b(Rich|Richard|Davy|Ricardo|Mike|Smizflark|richjhewitt)\b/i],
  ['email', /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ['absolute path', /C:[\\/]+Users[\\/]|\/Users\/|Bots 'n' Code Stuff/i],
  ['token or key', /\bsk-[A-Za-z0-9_-]{8,}|\bghp_[A-Za-z0-9]{10,}|\b(api[_-]?key|secret|token)\b\s*[:=]\s*['"][^'"\s]{12,}['"]|AKIA[0-9A-Z]{16}/i],
];
const FILE_RULES = [['data or local file', f => /(^|\/)data\//.test(f) || /\.local\./.test(f)]];

function scan(fromRef) {
  const files = git(ROOT, 'ls-tree', '-r', '--name-only', fromRef).split('\n').filter(Boolean);
  const hits = [];
  for (const f of files) {
    for (const [kind, test] of FILE_RULES) if (test(f)) hits.push({ kind, f, line: 0, snip: '(tracked file)' });
    let text;
    try { text = execFileSync('git', ['show', `${fromRef}:${f}`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    text.split('\n').forEach((l, i) => {
      for (const [kind, re] of RULES) {
        const m = re.exec(l);
        if (m) hits.push({ kind, f, line: i + 1, snip: l.trim().slice(Math.max(0, l.trim().indexOf(m[0]) - 20), l.trim().indexOf(m[0]) + 50) });
      }
    });
  }
  const counts = {};
  for (const h of hits) { counts[h.kind] = (counts[h.kind] || 0) + 1; console.log(`${h.kind}\t${h.f}:${h.line}\t${h.snip}`); }
  console.log('\nScan of ' + files.length + ' tracked files at ' + fromRef + ': ' + (hits.length ? Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ') : 'no hits'));
}

if (!flag('--scan')) {
  if (existsSync(DEST)) {
    if (!flag('--force')) { console.error(`${DEST} exists. Use --force to replace it.`); process.exit(1); }
    rmSync(DEST, { recursive: true, force: true });
  }
  if (path.relative(ROOT, DEST) && !path.relative(ROOT, DEST).startsWith('..')) { console.error('Destination must be outside the repo.'); process.exit(1); }
  mkdirSync(DEST, { recursive: true });
  const tar = path.join(DEST, '..', `.public-copy-${process.pid}.tar`);
  execFileSync('git', ['archive', '--format=tar', '-o', tar, ref], { cwd: ROOT });
  execFileSync('tar', ['-xf', path.basename(tar), '-C', path.basename(DEST)], { cwd: path.dirname(DEST) });
  rmSync(tar);
  const name = git(ROOT, 'config', 'user.name'), email = git(ROOT, 'config', 'user.email');
  git(DEST, 'init', '-q', '-b', 'main');
  git(DEST, 'add', '-A');
  git(DEST, '-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', 'AI-gile v0.1');
  console.log(`Public copy made at ${DEST} (commit ${git(DEST, 'rev-parse', '--short', 'HEAD')}, from ${ref}). Nothing pushed.\n`);
}
scan(ref);
