// Proof on hand-back (AIG-166): when a team hands work over with `test --commit <sha>`, the board itself (not
// the agent, so it costs no tokens) reads the commit in the project folder and keeps a short proof on the card:
// what it says, which files changed and a trimmed diff, plus a link to the full diff when the repo is on GitHub.
const { spawnSync } = require('child_process');
const { bad } = require('./store');

const MAX_DIFF = 6000;   // characters of diff kept on the card; enough to see the change, not a whole refactor
const git = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 4e6 }); return r.status === 0 ? r.stdout : null; };

function proofOf(folder, commit) {
  if (!/^[0-9a-f]{4,40}$/i.test(String(commit || ''))) throw bad('commit must be a commit id (hex)');
  if (!folder) throw bad('connect a folder to this project first');
  require('./safefolder').guard(folder, 'run git');   // AIG-944
  const head = git(folder, 'show', '-s', '--format=%H%n%s%n%cI', commit);
  if (!head) throw bad('commit not found in the project folder: ' + commit);
  const [sha, subject, at] = head.trim().split('\n');
  const files = (git(folder, 'show', '--numstat', '--format=', sha) || '').trim().split('\n').filter(Boolean)
    .map(l => { const [add, del, file] = l.split('\t'); return { file, add: add === '-' ? null : +add, del: del === '-' ? null : +del }; });
  let diff = git(folder, 'show', '--format=', '--unified=2', '--no-color', sha) || '';
  const cut = diff.length > MAX_DIFF; if (cut) diff = diff.slice(0, MAX_DIFF);
  // A link to the full diff when the remote is on GitHub (https or ssh form).
  const remote = (git(folder, 'remote', 'get-url', 'origin') || '').trim();
  const gh = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
  return { sha, subject, at, files, diff, cut, url: gh ? `https://github.com/${gh[1]}/commit/${sha}` : '' };
}

module.exports = { proofOf };
