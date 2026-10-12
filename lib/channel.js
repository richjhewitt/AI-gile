// 📦 Update channels (AIG-560) for installs cloned from GitHub. Stable = origin/stable: a daily build, moved on only when
// something changed and the whole QA run is green (tools/stable.mjs, then the owner pushes it). Live = origin/main: what the
// owner runs, for testers, with a warning. Choosing one points the install's branch at that upstream; the ⬆ Update pill
// (update.js) then follows it. Going from Live to Stable waits until Stable catches up (updates only ever fast-forward).
const { spawnSync } = require('child_process');
const { bad } = require('./store');
const { isZip } = require('./zipupdate');
const { REPO, checkUpdate } = require('./update');

const CHANNELS = { stable: 'stable', live: 'main' };
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};

// { channel: 'stable' | 'live' | 'other' | null, upstream, can, stableExists }
function status() {
  if (isZip() || !git('rev-parse', '--git-dir').ok) return { channel: null, can: false, why: isZip() ? 'zip' : 'nogit' };
  const up = git('rev-parse', '--abbrev-ref', '@{u}');
  const remote = up.ok ? up.out.split('/')[0] : 'origin';
  const branch = up.ok ? up.out.slice(remote.length + 1) : '';
  const channel = Object.keys(CHANNELS).find(k => CHANNELS[k] === branch) || (up.ok ? 'other' : null);
  const stableExists = git('rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/stable`).ok;
  return { channel, upstream: up.ok ? up.out : null, can: up.ok, stableExists };
}

function set(channel) {
  const b = CHANNELS[channel];
  if (!b) throw bad('channel must be stable or live');
  const st = status();
  if (!st.can) throw bad('channels need an install cloned from GitHub');
  const remote = st.upstream.split('/')[0];
  git('fetch', '--quiet', remote);
  if (!git('rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${b}`).ok) throw bad(channel === 'stable' ? 'there is no Stable build yet: stay on Live for now' : 'no Live branch found', 409);
  const r = git('branch', '--set-upstream-to', `${remote}/${b}`);
  if (!r.ok) throw bad('could not switch: ' + (r.err || r.out));
  try { checkUpdate(); } catch {}
  return status();
}

module.exports = { status, set, CHANNELS };
