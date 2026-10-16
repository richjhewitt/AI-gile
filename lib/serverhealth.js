// 🩺 Server health (AIG-660): warns the owner before Smizflark Server 2.0 (relay/relay.js) needs upgrading.
// About every 15 minutes the board asks the relay for GET /health (signed with the board's relay key, which must be the relay's
// RELAY_STATS_KEY, like Business licences) and keeps the readings of the last 7 days in data/serverhealth.conf (.conf: every .json in data/ is a project).
// High for 3 polls in a row (CPU load over 80%, memory over 85%, disk over 80%), or the disk heading for full within 14 days
// by its trend: ONE card in the AI-gile project for the owner ("Server: time to upgrade (disk 84%)"). While it is open it is
// bumped (at most once a day, and when the title changes), never copied. A card the owner closed is not raised again for 7 days.
// Project slug: "health": { "project": "..." } in aigile.local.json (default ai-gile), AIGILE_HEALTH_PROJECT for tests.
// AIG-1125: every ssh server in My servers (lib/servers.js) is read too: each poll one read-only ssh command (no sudo, BatchMode, hidden,
// 20 s timeout, async) prints load, cores, memory and disk; kept 7 days per server in the same file (servers: { name: [...] }), one card per server.
// AIGILE_SSH_STUB=<node script> stands in for ssh in tests (it gets ssh's arguments).
// AIGILE_HEALTH_STUB=<file>: a JSON reading { cpu, mem, disk, storage, uptime } used instead of the relay (QA needs no network).
const fs = require('fs');
const path = require('path');
const { DATA, load, save, now, localSettings, owner } = require('./store');
const { t } = require('./i18n');
const { execFile } = require('child_process');

const EVERY_MS = 15 * 60e3, KEEP_MS = 7 * 24 * 3600e3, DAY = 24 * 3600e3;
const LIMIT = { cpu: 90, mem: 85, disk: 80 }, MIN_SPAN = 30 * 60e3, RUN = 3, TREND_DAYS = 14;
const FILE = () => path.join(DATA, 'serverhealth.conf');
const dm = () => require('./dm');
const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return Array.isArray(j.readings) ? j : { readings: [] }; } catch { return { readings: [] }; } };
const write = j => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(j)); };
const lc = n => String(n || '').trim().toLowerCase();
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
const project = () => process.env.AIGILE_HEALTH_PROJECT || (localSettings().health || {}).project || 'ai-gile';
const relay = () => String((localSettings().health || {}).relay || dm().relayAddress() || '').replace(/\/+$/, '');

async function fetchReading() {
  if (process.env.AIGILE_HEALTH_STUB) return JSON.parse(fs.readFileSync(process.env.AIGILE_HEALTH_STUB, 'utf8'));
  const base = relay();
  if (!base) return null;
  return dm().relayCall(base, 'GET', '/health');
}
const clean = r => ({ at: process.env.AIGILE_HEALTH_STUB && typeof r.at === 'string' && Date.parse(r.at) ? r.at : new Date().toISOString(), cpu: num(r.cpu), cpu15: num(r.cpu15), mem: num(r.mem), disk: num(r.disk), storage: num(r.storage), uptime: num(r.uptime) });

// What is wrong now, or ''. Pure: takes the readings, oldest first.
// AIG-1227: a short spike is not "running hot". CPU counts only when the 15-minute load (cpu15: new relays and ssh servers) is at the
// limit, or when 3 readings in a row, at least 30 minutes from first to last, are at the limit (old relays have no cpu15).
// cpuRun says how long and how high, for the card text; null when the CPU is fine.
function cpuRun(rs) {
  const last = rs[rs.length - 1];
  if (!last) return null;
  const hi = x => x.cpu != null && x.cpu >= LIMIT.cpu;
  let k = 0; while (k < rs.length && hi(rs[rs.length - 1 - k])) k++;
  const mins = k > 1 ? Math.round((Date.parse(last.at) - Date.parse(rs[rs.length - k].at)) / 60e3) : 0;
  if (last.cpu15 != null && last.cpu15 >= LIMIT.cpu) return { avg: last.cpu15, mins: Math.max(15, mins) };
  if (k >= RUN && Date.parse(last.at) - Date.parse(rs[rs.length - RUN].at) >= MIN_SPAN - 1000) return { avg: last.cpu15, cpu: last.cpu, mins };
  return null;
}
function verdict(rs) {
  const last = rs.slice(-RUN);
  for (const k of ['disk', 'mem']) if (last.length === RUN && last.every(x => x[k] != null && x[k] > LIMIT[k])) return `${k === 'mem' ? 'memory' : 'disk'} ${Math.round(last[RUN - 1][k])}%`;
  const c = cpuRun(rs);
  if (c) return `CPU ${Math.round(c.avg != null ? c.avg : c.cpu)}%`;
  // disk trend: at least 3 readings over at least a day, growing, and 14 days from full
  const d = rs.filter(x => x.disk != null);
  if (d.length >= 3) {
    const a = d[0], b = d[d.length - 1], span = (Date.parse(b.at) - Date.parse(a.at)) / DAY;
    if (span >= 1 && b.disk >= 50) {
      const perDay = (b.disk - a.disk) / span;
      if (perDay > 0.05) { const days = (100 - b.disk) / perDay; if (days <= TREND_DAYS) return `disk ${Math.round(b.disk)}%, full in ~${Math.max(1, Math.round(days))} days`; }
    }
  }
  return '';
}

function raise(why, name, extra) {
  const p = load(project());
  if (!p) return { card: null };
  const title = name ? t('srv.health.sshtitle', { name, why }) : t('srv.health.title', { why }), text = (name ? t('srv.health.sshbody', { name, why }) : t('srv.health.body', { why })) + (extra ? ' ' + extra : '');
  const from = name ? 'server health: ' + lc(name) : 'server health';
  const mine = p.cards.filter(c => c.from === from);
  const open = mine.find(c => c.status !== 'done');
  const at = now();
  if (open) {
    const stale = Date.now() - Date.parse(open.bumpedAt || open.created) > DAY;
    if (open.title === title && !stale) return { card: open.id, bumped: false };
    const m = [...open.comments].reverse().find(x => x.mark === 'task');
    open.title = title;
    if (m) { m.text = text; m.bumpedAt = at; m.bumps = (m.bumps || 0) + 1; }
    open.bumpedAt = at; open.bumps = (open.bumps || 0) + 1; open.updated = at;
    save(p);
    return { card: open.id, bumped: true };
  }
  const closed = mine.filter(c => c.status === 'done').map(c => Date.parse(c.updated)).filter(Boolean).sort().pop();
  if (closed && Date.now() - closed < 7 * DAY) return { card: null, held: true };
  const card = { id: p.key + '-' + p.nextId++, title, description: text, testSteps: '', type: 'task', priority: 'normal', status: 'todo', assignee: owner(), sprint: '', blocked: false, needsYou: true, createdBy: 'Server health',
    from, created: at, updated: at, comments: [{ author: 'Server health', text, at, mark: 'task' }] };
  p.cards.push(card); save(p);
  return { card: card.id, created: true };
}

// The plain-words line about how long the CPU has been high (empty for disk or memory).
function cpuNote(why, rs) {
  const c = /^CPU/.test(why) && cpuRun(rs); if (!c) return '';
  return c.avg != null ? t('srv.health.cpulong', { mins: c.mins, limit: LIMIT.cpu, avg: Math.round(c.avg) }) : t('srv.health.cpurun', { mins: c.mins, limit: LIMIT.cpu });
}
// ---- ssh servers (AIG-1125) ----
// AIG-1458: two /proc/stat lines a second apart give the real CPU use; load average also counts short jobs waiting (ten deploy timers
// firing at once read as "CPU 101%" on a server 78% idle), so it is only the fallback where there is no /proc/stat.
const REMOTE = 'LC_ALL=C; uptime; echo "cores $(nproc 2>/dev/null || echo 1)"; free -m; df -P /; head -1 /proc/stat 2>/dev/null; sleep 1; head -1 /proc/stat 2>/dev/null';
function sshRun(args) {
  const stub = process.env.AIGILE_SSH_STUB;
  return new Promise((res, rej) => {
    const cb = (e, out) => e ? rej(new Error(String(e.killed ? 'ssh timed out' : (e.message || e)).split('\n').filter(Boolean).pop().slice(0, 200))) : res(String(out));
    const o = { timeout: 20e3, windowsHide: true, maxBuffer: 200e3 };
    try { stub ? execFile(process.execPath, [stub, ...args], o, cb) : execFile('ssh', args, o, cb); } catch (e) { rej(e); }
  });
}
// Parses uptime + cores + free -m + df -P / (+ two /proc/stat cpu lines). Pure.
function parse(out) {
  out = String(out);
  const L = out.split(/\r?\n/), r = {};
  const la = out.match(/load averages?:\s*([\d.,]+?)[, ]/i), la15 = out.match(/load averages?:\s*[\d.,]+?[, ]+\s*[\d.,]+?[, ]+\s*([\d.]+)/i), cores = Number((out.match(/^cores (\d+)/m) || [])[1]) || 1;
  if (la) r.cpu = Math.min(100, Number(la[1].replace(',', '.')) / cores * 100);
  if (la15) r.cpu15 = Math.min(100, Number(la15[1]) / cores * 100);
  const st = L.filter(x => /^cpu\s+\d/.test(x)).map(x => x.trim().split(/\s+/).slice(1).map(Number));
  if (st.length >= 2) {   // user nice system idle iowait irq softirq steal: busy = all but idle, iowait and steal
    const sum = a => a.slice(0, 8).reduce((n, v) => n + (v || 0), 0), free = a => (a[3] || 0) + (a[4] || 0) + (a[7] || 0);
    const [a, b] = st.slice(-2), dt = sum(b) - sum(a);
    if (dt > 0) { r.cpu = Math.max(0, Math.min(100, (dt - (free(b) - free(a))) / dt * 100)); delete r.cpu15; }
  }
  const up = out.match(/\bup\s+(\d+)\s+days?/i); r.uptime = up ? Number(up[1]) * 86400 : /\bup\b/i.test(out) ? 0 : null;
  const m = L.find(x => /^Mem:/i.test(x));
  if (m) { const f = m.trim().split(/\s+/).slice(1).map(Number); if (f[0] > 0) r.mem = (f[0] - (isFinite(f[5]) ? f[5] : f[0] - f[1])) / f[0] * 100; }
  const d = L.filter(x => /\s\d+%\s+\S+\s*$/.test(x)).pop();
  if (d) { const f = d.trim().split(/\s+/); r.disk = Number(f[4].replace('%', '')); r.storage = Number(f[2]) * 1024; }
  return r;
}
const sshServers = () => { try { return require('./servers').terminals().filter(x => x.target); } catch { return []; } };
async function pollServer(x) {
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-T', ...(x.port ? ['-p', String(x.port)] : []), ...(x.key ? ['-i', x.key] : []), '--', x.target, REMOTE];
  let r;
  try { r = parse(await sshRun(args)); } catch (e) { return { name: x.name, ok: false, error: e.message }; }
  if (num(r.cpu) == null && num(r.mem) == null && num(r.disk) == null) return { name: x.name, ok: false, error: 'no readings' };
  const j = read(), cut = Date.now() - KEEP_MS, k = lc(x.name);
  j.servers = j.servers || {};
  j.servers[k] = (j.servers[k] || []).filter(y => Date.parse(y.at) >= cut).concat(clean(r)).slice(-700);
  write(j);
  const why = verdict(j.servers[k]);
  return { name: x.name, ok: true, reading: j.servers[k][j.servers[k].length - 1], why, ...(why ? raise(why, x.name, cpuNote(why, j.servers[k])) : {}) };
}
async function pollServers() {
  const out = [], list = sshServers();
  for (const x of list) out.push(await pollServer(x));
  const j = read();
  if (j.servers) { const live = new Set(list.map(x => lc(x.name))); let ch = false; for (const k of Object.keys(j.servers)) if (!live.has(k)) { delete j.servers[k]; ch = true; } if (ch) write(j); }
  return out;
}
// For Setup > My servers: the newest reading per ssh server.
function fleet() {
  const s = read().servers || {};
  return sshServers().map(x => { const rs = s[lc(x.name)] || [], r = rs[rs.length - 1]; return r ? { ...r, server: x.name } : null; }).filter(Boolean);
}

// One poll: the relay, then every ssh server. Returns what happened. A poll already running is shared, never a second ssh sweep (AIG-1159).
let inflight = null;
async function pollOnce() {
  const r = await pollRelay();
  r.servers = await pollServers();
  return r;
}
function poll() { return inflight || (inflight = pollOnce().finally(() => { inflight = null; })); }
async function pollRelay() {
  let r;
  try { r = await fetchReading(); } catch (e) { return { ok: false, error: e.message }; }
  if (!r || (num(r.cpu) == null && num(r.mem) == null && num(r.disk) == null)) return { ok: false, error: 'no readings (the relay needs RELAY_STATS_KEY set to this board\'s key, and the new relay.js)' };
  const j = read(), cut = Date.now() - KEEP_MS;
  j.readings = j.readings.filter(x => Date.parse(x.at) >= cut).concat(clean(r)).slice(-700);
  write(j);
  const why = verdict(j.readings);
  return { ok: true, reading: j.readings[j.readings.length - 1], why, ...(why ? raise(why, null, cpuNote(why, j.readings)) : {}) };
}
function relayName() { try { return new URL(relay()).host; } catch { return process.env.AIGILE_HEALTH_STUB ? 'relay' : ''; } }
// For Setup > My servers: the newest reading.
function latest() { const rs = read().readings, x = rs[rs.length - 1]; return x ? { ...x, server: relayName() } : null; }

function start() {
  if (process.env.AIGILE_NO_HEALTH_POLL) return;
  setTimeout(function tick() { poll().catch(() => {}); setTimeout(tick, EVERY_MS).unref(); }, 120e3).unref();
}
module.exports = { poll, latest, fleet, parse, verdict, start, readings: () => read().readings };
