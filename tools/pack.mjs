// 📦 Friends' zip (AIG-248): node tools/pack.mjs [version]
// Builds dist/AI-gile-<version>.zip from what git tracks at HEAD, so nothing personal can slip in: data/, *.local.*,
// .claude/ and WAYS-OF-WORKING.md are never tracked. Also leaves out what a friend doesn't need: the test tools,
// the website, the relay server and the icon brief. Run it from a clean checkout (it warns about unsaved changes).
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const LEAVE_OUT = ['tools', 'site', 'relay', 'docs/icon-brief', 'docs/blog.local.md'];

const version = process.argv[2] || '0.1-' + git('rev-parse', '--short', 'HEAD');
if (git('status', '--porcelain', '--untracked-files=no')) console.warn('⚠ there are changes not committed yet: the zip has the last commit, not them');
mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join('dist', `AI-gile-${version}.zip`);
// VERSION inside the zip is what an install compares with latest.json (AIG-251).
git('archive', '--format=zip', `--prefix=AI-gile/`, `--add-virtual-file=AI-gile/VERSION:${version}`, '-o', out, 'HEAD', '--', '.', ...LEAVE_OUT.map(p => `:(exclude)${p}`));
// latest.json goes next to the zip on the server and stays there: zip installs check it for updates (AIG-251).
const notes = git('log', '--format=%s', '-n', '5').split('\n').filter(Boolean);
writeFileSync(path.join(ROOT, 'dist', 'latest.json'), JSON.stringify({ version, zip: `AI-gile-${version}.zip`, notes }, null, 2) + '\n');
console.log(`📦 ${out} (${Math.round(statSync(path.join(ROOT, out)).size / 1024)} KB) + dist/latest.json`);
