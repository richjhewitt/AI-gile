// 🚫 The No-AI edition (AIG-617): node tools/build-noai.mjs [--out <folder>] [--zip]
// Builds dist/aigile-noai/ (git-ignored) from the files git tracks, with the AI parts left out, not just hidden:
//  - the AI-only modules (tester, Lead Scrum Master, night watchman, usage check, ask a mate, token usage and limits, expert team
//    templates) are replaced by an inert stand-in file, so nothing that still mentions them can fail to load;
//  - the agent profiles for models, the tester and Scrum Master briefs, the Claude status line, and the dev tools are not copied;
//  - a file called NOAI in the root tells the server "No AI, ever" for good (lib/noai.js): the switch cannot be turned off.
// Everything else stays: board, friends, sharing, DMs, guide, people as team members. --zip also makes dist/aigile-noai.zip with
// the tar that ships with Windows 10+ (no packages); if that is missing the folder is still there.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(flag('--out') || path.join(ROOT, 'dist', 'aigile-noai'));

// Replaced by a stand-in (still required in places, always behind a No-AI check).
export const STUBBED = ['lib/tester.js', 'lib/scrummaster.js', 'lib/watchman.js', 'lib/usagecheck.js', 'lib/ask.js', 'lib/expertteams.js', 'lib/usage.js', 'lib/limits.js'];
// Not copied at all.
export const LEFT_OUT = ['profiles/expert-teams.json', 'docs/TESTER.md', 'docs/SCRUM-MASTER.md', 'statusline.js', 'tools/tester', 'tools/qa', 'tools/trial', 'tools/gen', 'tools/stable.mjs', 'site', 'relay', 'dist'];
const STUB = name => `// No-AI edition: ${name} is not part of this download. This stand-in keeps the callers loading; every call does nothing.
const nothing = () => undefined;
module.exports = new Proxy(function () {}, { get: (_, k) => (k === '__esModule' || k === 'then' ? undefined : nothing), apply: nothing });
`;

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
const left = f => LEFT_OUT.some(p => f === p || f.startsWith(p + '/'));
let copied = 0;
for (const f of files) {
  if (left(f) || STUBBED.includes(f) || !existsSync(path.join(ROOT, f))) continue;
  const to = path.join(OUT, f); mkdirSync(path.dirname(to), { recursive: true }); cpSync(path.join(ROOT, f), to); copied++;
}
for (const f of STUBBED) { const to = path.join(OUT, f); mkdirSync(path.dirname(to), { recursive: true }); writeFileSync(to, STUB(f)); }
writeFileSync(path.join(OUT, 'NOAI'), 'This is the No-AI edition. The server reads this file at start and keeps "No AI, ever" on. Delete nothing here; get the full download to use AI.\n');
let version = 'noai'; try { version = 'noai-' + execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch {}
writeFileSync(path.join(OUT, 'VERSION'), version + '\n');
console.log(`🚫 No-AI edition: ${copied} files copied, ${STUBBED.length} stood in for, ${OUT}`);

if (args.includes('--zip')) {
  const zip = OUT.replace(/[\\/]+$/, '') + '.zip';
  if (existsSync(zip)) rmSync(zip);
  const r = spawnSync('tar', ['-a', '-c', '-f', zip, '-C', path.dirname(OUT), path.basename(OUT)], { windowsHide: true });
  if (r.status === 0 && existsSync(zip)) console.log(`📦 ${zip} (${Math.round(statSync(zip).size / 1024)} KB)`);
  else console.log('⚠ could not make the zip (no tar on this computer): use the folder as it is');
}
