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
// The friends' download page (AIG-249): put it on the server with the zip; remove both once they've got it.
writeFileSync(path.join(ROOT, 'dist', 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI-gile for friends</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1d2330;background:#f6f7f9}
a.dl{display:inline-block;background:#3b6cf6;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:600}li{margin:6px 0}
@media (prefers-color-scheme:dark){body{background:#12151b;color:#e6e9ef}}</style>
<h1>🗂️ AI-gile</h1><p>Your own board where AI teams build your projects, and you just say GO and test what they make.</p>
<p><a class="dl" href="AI-gile-${version}.zip">⬇ Download AI-gile ${version}</a></p>
<h2>Install in 5 minutes (Windows)</h2><ol>
<li>You need <b>Node.js</b> (LTS, from nodejs.org) and <b>Claude Code</b>, signed in.</li>
<li>Right-click the zip → <b>Extract All</b>, next to your projects.</li>
<li>Double-click <b>start-aigile.bat</b> in the AI-gile folder.</li>
<li>In ⚙️ Setup: your name, check the agent program it suggests, <b>Save</b>.</li>
<li><b>🔎 Find my projects</b>, tick yours, add them. That's it.</li></ol>
<p>The full guide is in the zip: <code>docs/INSTALL.md</code>. Stuck? Message the person who sent you this link.</p>`);
console.log(`📦 ${out} (${Math.round(statSync(path.join(ROOT, out)).size / 1024)} KB) + dist/latest.json + dist/index.html`);
