// ↩ "I liked it the way it was" (AIG-563): go back to an earlier build from ✨ What's new, and stay there until you choose to
// move on. Only for installs cloned from GitHub that are a plain copy (no commits or hand changes of their own: the same
// rule as updating). Going back checks out the build's commit (detached), so the ⬆ Update pill stops by itself; your boards
// live in data/ (not in git) and are kept. Back to the latest = the branch again, fast-forwarded to its upstream.
// The builds come from public/releases.json: each entry written by `aigile release-notes` carries its commit.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DATA, listSlugs, bad } = require('./store');
const { presenceOf } = require('./presence');
const { isZip } = require('./zipupdate');
const { REPO, restart } = require('./update');

const PIN = () => path.join(DATA, 'rollback.pin');   // not .json: data/*.json are projects
const SHA = /^[0-9a-f]{7,40}$/;
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const readPin = () => { try { return JSON.parse(fs.readFileSync(PIN(), 'utf8')); } catch { return null; } };
const releases = () => { try { const r = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'releases.json'), 'utf8')); return Array.isArray(r) ? r : []; } catch { return []; } };

// Why going back isn't possible here, or '' when it is.
function blocked() {
  if (isZip()) return 'zip';
  if (!git('rev-parse', '--git-dir').ok) return 'nogit';
  if (git('status', '--porcelain', '--untracked-files=no').out) return 'changed';
  const pin = readPin();
  if (!pin && !git('rev-parse', '--abbrev-ref', '@{u}').ok) return 'noupstream';
  if (!pin && Number(git('rev-list', '--count', '@{u}..HEAD').out) > 0) return 'own';
  return '';
}
function busy() {
  const b = listSlugs().filter(s => presenceOf(s).running);
  if (b.length) throw bad('a team is running (' + b.join(', ') + '); try again when it has finished');
}

// { can, why, pinned, builds: [{ id, title, at, commit }] }: earlier builds this copy can go back to (not the one it runs).
function status() {
  const why = blocked(), pin = readPin(), head = git('rev-parse', 'HEAD').out;
  const builds = why ? [] : releases().filter(r => r.commit && SHA.test(r.commit) && !head.startsWith(r.commit)
    && git('merge-base', '--is-ancestor', r.commit, pin ? pin.branch : 'HEAD').ok)
    .map(r => ({ id: r.id, title: r.title, at: r.at, commit: r.commit }));
  return { can: !why, why, pinned: pin ? { commit: pin.commit, title: pin.title, at: pin.at } : null, builds };
}

function goBack(commit) {
  if (!SHA.test(String(commit || ''))) throw bad('no such build');
  const why = blocked(); if (why) throw bad('going back is not possible here (' + why + ')');
  const r = releases().find(x => x.commit === commit);
  if (!r || !git('merge-base', '--is-ancestor', commit, 'HEAD').ok) throw bad('no such build');
  busy();
  const pin = readPin(), branch = pin ? pin.branch : git('rev-parse', '--abbrev-ref', 'HEAD').out;
  if (!branch || branch === 'HEAD') throw bad('going back is not possible here (detached)');
  const co = git('-c', 'advice.detachedHead=false', 'checkout', '--detach', commit);
  if (!co.ok) throw bad('could not go back: ' + (co.err || co.out));
  fs.writeFileSync(PIN(), JSON.stringify({ commit, title: r.title, at: new Date().toISOString(), branch }, null, 2));
  restart();
  return { ok: true, commit };
}

function latest() {
  const pin = readPin();
  if (!pin) throw bad('already on the latest');
  if (git('status', '--porcelain', '--untracked-files=no').out) throw bad('files here were changed by hand; update it by hand with git');
  busy();
  const co = git('checkout', pin.branch);
  if (!co.ok) throw bad('could not go back to the latest: ' + (co.err || co.out));
  git('fetch', '--quiet');
  git('merge', '--ff-only', '@{u}');
  fs.rmSync(PIN(), { force: true });
  restart();
  return { ok: true };
}

module.exports = { status, goBack, latest };
