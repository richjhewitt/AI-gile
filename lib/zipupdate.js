// 📦 Updates for zip installs (AIG-251): a copy that came as a zip (no git) checks a small file on the owner's server,
// e.g. https://example.com/aigile/latest.json = { "version": "0.2", "zip": "AI-gile-0.2.zip", "notes": ["…"] }
// (zip relative to that file, or a full address). Settings in aigile.local.json: "updates": { "url", "channel" }.
//   - channel "stable": checks once a day; "latest": every 30 minutes
//   - a newer version is downloaded and copied over the app's own files, then the board restarts itself, never while
//     a team is running; settings (aigile.local.json), the board (data/) and your notes stay as they are
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, listSlugs, localSettings, bad } = require('./store');
const { presenceOf } = require('./presence');

const DAY = 24 * 3600e3, HALF_HOUR = 30 * 60e3;
const version = () => { try { return fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(); } catch { return ''; } };
const opts = () => { const u = localSettings().updates || {}; return { url: String(u.url || '').trim(), channel: u.channel === 'latest' ? 'latest' : 'stable' }; };
let status = { behind: 0, checkedAt: null, note: 'not checked yet', zip: true, version: version() };
let latest = null;   // the last manifest that was newer than this copy

async function check() {
  const { url, channel } = opts();
  if (!url) return (status = { behind: 0, checkedAt: new Date().toISOString(), note: 'no update address set: updates are off', zip: true, version: version(), channel });
  try {
    const m = await (await fetch(url, { cache: 'no-store' })).json();
    const newer = !!m.version && m.version !== version();
    latest = newer ? { ...m, zip: new URL(m.zip, url).href } : null;
    status = { behind: newer ? 1 : 0, subjects: newer ? [].concat(m.notes || m.version) : [], checkedAt: new Date().toISOString(), note: '', zip: true, version: version(), next: newer ? m.version : null, channel };
  } catch (e) { status = { ...status, checkedAt: new Date().toISOString(), note: 'could not reach the update address' }; }
  return status;
}

async function apply() {
  if (!latest) await check();
  if (!latest) throw bad('already up to date');
  const busy = listSlugs().filter(s => presenceOf(s).running);
  if (busy.length) throw bad('a team is running (' + busy.join(', ') + '); try again when it has finished');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aigile-update-')), zip = path.join(tmp, 'update.zip');
  fs.writeFileSync(zip, Buffer.from(await (await fetch(latest.zip)).arrayBuffer()));
  // Windows 10+ ships tar, which unpacks zips too.
  const x = spawnSync('tar', ['-xf', zip, '-C', tmp], { windowsHide: true, encoding: 'utf8' });
  const src = path.join(tmp, 'AI-gile');
  if (x.status !== 0 || !fs.existsSync(path.join(src, 'server.js'))) throw bad('the update zip could not be unpacked');
  // Only the app's own files: the zip never has data/, aigile.local.json or WAYS-OF-WORKING.md in it.
  fs.cpSync(src, ROOT, { recursive: true, force: true });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  const done = latest.version; latest = null;
  status = { behind: 0, checkedAt: new Date().toISOString(), note: 'updated', zip: true, version: done };
  return { ok: true, updated: done };
}

// Checks on its own schedule and updates by itself when nobody is mid-run; restart(): the board's own restart.
function startZipUpdates(restart) {
  let lastCheck = 0;
  const tick = async () => {
    const { channel } = opts();
    if (Date.now() - lastCheck < (channel === 'latest' ? HALF_HOUR : DAY)) return;
    lastCheck = Date.now();
    try { await check(); if (status.behind && !listSlugs().some(s => presenceOf(s).running)) { await apply(); restart(); } } catch {}
  };
  setTimeout(tick, 60e3).unref();
  setInterval(tick, 5 * 60e3).unref();   // a busy team only delays it until the next tick
}

module.exports = { isZip: () => !fs.existsSync(path.join(ROOT, '.git')), zipStatus: () => status, zipCheck: check, zipApply: apply, startZipUpdates };
