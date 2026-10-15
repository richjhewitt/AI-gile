// 🟢 Uptime checks (AIG-1047, docs/SERVICE-MGMT-PLAN.md phase 1): every 5 minutes the board (this PC, not the server relay) does an
// HTTP(S) GET on the web address of every project that is a service (lib/service.js). Up = any status under 500 within 10 seconds.
// 3 fails in a row open ONE 🔥 incident card on that project, assigned to the on-call agent, with the error in it; never a second
// one while that incident is open. When the address answers again the incident gets one comment "Up again after N min" (the team closes it).
// State per project slug in data/uptime.conf (.conf: every .json in data/ is a project): { url, up, fails, since, error, incident, down }.
// AIGILE_UPTIME_STUB=<file>: JSON { "<url>": "up" | "down" } used instead of the network (a url not in it is up). AIGILE_UPTIME_MS: the interval.
// AIGILE_NO_UPTIME_POLL=1 switches the timer off (QA calls POST /api/uptime/poll itself).
const fs = require('fs');
const path = require('path');
const { DATA, load, peek, save, now, listSlugs } = require('./store');
const { t } = require('./i18n');

const EVERY_MS = () => Math.max(50, Number(process.env.AIGILE_UPTIME_MS) || 5 * 60e3), FAILS = 3, TIMEOUT_MS = 10e3;
const FILE = () => path.join(DATA, 'uptime.conf');
const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
const write = j => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify(j)); };

// One check: { up, error }.
async function check(url) {
  if (process.env.AIGILE_UPTIME_STUB) {
    let m = {}; try { m = JSON.parse(fs.readFileSync(process.env.AIGILE_UPTIME_STUB, 'utf8')); } catch {}
    const v = m[url], down = v === 'down' || v === false;
    return down ? { up: false, error: 'stub: down' } : { up: true };
  }
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    try { await r.body?.cancel(); } catch {}
    return r.status < 500 ? { up: true } : { up: false, error: 'HTTP ' + r.status };
  } catch (e) { return { up: false, error: (e && (e.name === 'TimeoutError' ? 'no answer within 10 s' : (e.cause && e.cause.code) || e.message)) || 'failed' }; }
}

function openIncident(p, id) { const c = id && p.cards.find(x => x.id === id); return c && c.status !== 'done' ? c : null; }

function raise(p, svc, st) {
  const at = now(), title = t('uptime.title', { url: svc.url }), text = t('uptime.body', { url: svc.url, error: st.error || '', fails: st.fails });
  const c = { id: p.key + '-' + p.nextId++, title, description: text, testSteps: '', type: 'incident', priority: 'high', status: 'todo', assignee: svc.onCall, sprint: '', blocked: false, needsYou: false,
    from: 'uptime', createdBy: 'Uptime', created: at, updated: at, comments: [{ author: 'Uptime', text, at }] };
  p.cards.push(c); save(p);
  return c.id;
}

// One poll of every service. Returns { checked: [slug, ...] }.
async function poll() {
  const S = require('./service'), state = read(), checked = [];
  for (const slug of listSlugs()) {
    let p; try { p = peek(slug); } catch { continue; }   // read-only scan (AIG-1103): load() only when an incident is written
    const svc = p && !p.archived && S.of(p);
    if (!svc || !svc.url) { if (state[slug] && !state[slug].incident) delete state[slug]; continue; }
    const r = await check(svc.url), at = now();
    const mine = () => load(slug) || p;
    let st = state[slug];
    if (!st || st.url !== svc.url) st = state[slug] = { url: svc.url, up: true, fails: 0, since: at, incident: st && st.incident || '' };
    checked.push(slug);
    if (r.up) {
      if (!st.up) {
        if (st.down && st.incident) {
          const q = mine(), c = openIncident(q, st.incident);
          if (c) { const mins = Math.max(0, Math.round((Date.now() - Date.parse(st.downAt || st.since)) / 60e3)); c.comments.push({ author: 'Uptime', text: t('uptime.up', { n: mins }), at }); c.updated = at; save(q); }
        }
        st.down = false; st.since = at;
      }
      st.up = true; st.fails = 0; st.error = '';
    } else {
      st.fails++; st.error = r.error || '';
      if (st.up && st.fails >= FAILS) { st.up = false; st.since = at; st.downAt = at; }
      if (st.fails >= FAILS) {
        st.up = false;
        const q = mine();
        if (!openIncident(q, st.incident)) st.incident = raise(q, svc, st);
        if (!st.down) { st.down = true; st.downAt = st.downAt || at; }
      }
    }
  }
  for (const slug of Object.keys(state)) if (!checked.includes(slug) && !state[slug].incident) delete state[slug];
  write(state);
  return { checked };
}

// For GET /api/uptime: per service { url, up, fails, since }, keyed by project slug.
function view() {
  const S = require('./service'), state = read(), out = {};
  for (const s of S.services()) if (s.url && state[s.slug] && state[s.slug].url === s.url) { const x = state[s.slug]; out[s.slug] = { url: x.url, up: x.up, fails: x.fails, since: x.since }; }
  return out;
}
// Is this project's service known to be down? true / false, or null when never checked.
function upOf(slug) { const x = read()[slug]; return x ? x.up : null; }

function start() {
  if (process.env.AIGILE_NO_UPTIME_POLL) return;
  let busy = false;
  setTimeout(function tick() {
    (busy ? Promise.resolve() : (busy = true, poll())).catch(() => {}).finally(() => { busy = false; });
    setTimeout(tick, EVERY_MS()).unref();
  }, process.env.AIGILE_UPTIME_MS ? 500 : 60e3).unref();
}
module.exports = { poll, view, upOf, start, check };
