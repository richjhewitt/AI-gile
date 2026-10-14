// 🩺 Server health (AIG-660): warns the owner before Smizflark Server 2.0 (relay/relay.js) needs upgrading.
// About every 15 minutes the board asks the relay for GET /health (signed with the board's relay key, which must be the relay's
// RELAY_STATS_KEY, like Business licences) and keeps the readings of the last 7 days in data/serverhealth.conf (.conf: every .json in data/ is a project).
// High for 3 polls in a row (CPU load over 80%, memory over 85%, disk over 80%), or the disk heading for full within 14 days
// by its trend: ONE card in the AI-gile project for the owner ("Server: time to upgrade (disk 84%)"). While it is open it is
// bumped (at most once a day, and when the title changes), never copied. A card the owner closed is not raised again for 7 days.
// Project slug: "health": { "project": "..." } in aigile.local.json (default ai-gile), AIGILE_HEALTH_PROJECT for tests.
// AIGILE_HEALTH_STUB=<file>: a JSON reading { cpu, mem, disk, storage, uptime } used instead of the relay (QA needs no network).
const fs = require('fs');
const path = require('path');
const { DATA, load, save, now, localSettings, owner } = require('./store');
const { t } = require('./i18n');

const EVERY_MS = 15 * 60e3, KEEP_MS = 7 * 24 * 3600e3, DAY = 24 * 3600e3;
const LIMIT = { cpu: 80, mem: 85, disk: 80 }, RUN = 3, TREND_DAYS = 14;
const FILE = () => path.join(DATA, 'serverhealth.conf');
const dm = () => require('./dm');
const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return Array.isArray(j.readings) ? j : { readings: [] }; } catch { return { readings: [] }; } };
const write = j => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(j)); };
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
const project = () => process.env.AIGILE_HEALTH_PROJECT || (localSettings().health || {}).project || 'ai-gile';
const relay = () => String((localSettings().health || {}).relay || dm().relayAddress() || '').replace(/\/+$/, '');

async function fetchReading() {
  if (process.env.AIGILE_HEALTH_STUB) return JSON.parse(fs.readFileSync(process.env.AIGILE_HEALTH_STUB, 'utf8'));
  const base = relay();
  if (!base) return null;
  return dm().relayCall(base, 'GET', '/health');
}
const clean = r => ({ at: new Date().toISOString(), cpu: num(r.cpu), mem: num(r.mem), disk: num(r.disk), storage: num(r.storage), uptime: num(r.uptime) });

// What is wrong now, or ''. Pure: takes the readings, oldest first.
function verdict(rs) {
  const last = rs.slice(-RUN);
  if (last.length === RUN) for (const k of ['disk', 'mem', 'cpu']) if (last.every(x => x[k] != null && x[k] > LIMIT[k])) return `${k === 'cpu' ? 'CPU' : k === 'mem' ? 'memory' : 'disk'} ${Math.round(last[RUN - 1][k])}%`;
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

function raise(why) {
  const p = load(project());
  if (!p) return { card: null };
  const title = t('srv.health.title', { why }), text = t('srv.health.body', { why });
  const mine = p.cards.filter(c => c.from === 'server health');
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
    from: 'server health', created: at, updated: at, comments: [{ author: 'Server health', text, at, mark: 'task' }] };
  p.cards.push(card); save(p);
  return { card: card.id, created: true };
}

// One poll: read, keep, judge. Returns what happened.
async function poll() {
  let r;
  try { r = await fetchReading(); } catch (e) { return { ok: false, error: e.message }; }
  if (!r || (num(r.cpu) == null && num(r.mem) == null && num(r.disk) == null)) return { ok: false, error: 'no readings (the relay needs RELAY_STATS_KEY set to this board\'s key, and the new relay.js)' };
  const j = read(), cut = Date.now() - KEEP_MS;
  j.readings = j.readings.filter(x => Date.parse(x.at) >= cut).concat(clean(r)).slice(-700);
  write(j);
  const why = verdict(j.readings);
  return { ok: true, reading: j.readings[j.readings.length - 1], why, ...(why ? raise(why) : {}) };
}
function relayName() { try { return new URL(relay()).host; } catch { return process.env.AIGILE_HEALTH_STUB ? 'relay' : ''; } }
// For Setup > My servers: the newest reading.
function latest() { const rs = read().readings, x = rs[rs.length - 1]; return x ? { ...x, server: relayName() } : null; }

function start() {
  if (process.env.AIGILE_NO_HEALTH_POLL) return;
  setTimeout(function tick() { (relay() ? poll() : Promise.resolve()).catch(() => {}); setTimeout(tick, EVERY_MS).unref(); }, 120e3).unref();
}
module.exports = { poll, latest, verdict, start, readings: () => read().readings };
