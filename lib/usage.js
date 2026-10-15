// Usage: token totals per project from the agents' local session logs (JSONL, one folder per
// project). The logs folder is configured locally (AIGILE_USAGE_DIR or data/settings.json
// "usageDir"), so nothing machine-specific lives in the repo. Logs are append-only, so each file
// is read incrementally from where we left off; every message is counted once (by its id).
const fs = require('fs');
const path = require('path');

const HOUR = 3600e3;
const files = new Map(); // file -> { offset, rest, seen:Set, folder }
const buckets = new Map(); // folder -> Map(hourStart -> { model -> tokens })
let lastScan = 0;

// A project's log folder name is its path with every non-alphanumeric character turned into '-'.
const folderOf = p => String(p).replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
const family = m => (String(m).match(/opus|sonnet|haiku|fable/i) || ['other'])[0].toLowerCase();

function listJsonl(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) listJsonl(f, out); else if (e.name.endsWith('.jsonl')) out.push(f);
  }
  return out;
}

function add(folder, ts, model, tokens) {
  if (!buckets.has(folder)) buckets.set(folder, new Map());
  const b = buckets.get(folder), h = Math.floor(ts / HOUR) * HOUR;
  if (!b.has(h)) b.set(h, {});
  const row = b.get(h), fam = family(model);
  row[fam] = (row[fam] || 0) + tokens;
}

// AIG-1102: scanning is async and never blocks a request: usage() serves the last result while a scan runs.
// A directory whose mtime is unchanged keeps its cached listing (no readdir); files are still stat'ed (async) as appends don't touch the folder.
const dirCache = new Map(); // dir -> { mtime, files:[], subs:[] }
async function listJsonlAsync(dir, out = []) {
  let c = dirCache.get(dir);
  try {
    const m = (await fs.promises.stat(dir)).mtimeMs;
    if (!c || c.mtime !== m) {
      const files = [], subs = [];
      for (const e of await fs.promises.readdir(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) subs.push(f); else if (e.name.endsWith('.jsonl')) files.push(f);
      }
      c = { mtime: m, files, subs }; dirCache.set(dir, c);
    }
  } catch { dirCache.delete(dir); return out; }
  out.push(...c.files);
  for (const s of c.subs) await listJsonlAsync(s, out);
  return out;
}

async function readNew(file, folder) {
  let st = files.get(file);
  const size = (await fs.promises.stat(file)).size;
  if (!st || size < st.offset) { st = { offset: 0, rest: '', seen: new Set(), folder }; files.set(file, st); }
  if (size === st.offset) return;
  const buf = Buffer.alloc(size - st.offset);
  const fh = await fs.promises.open(file, 'r');
  try { await fh.read(buf, 0, buf.length, st.offset); } finally { await fh.close(); }
  st.offset = size;
  const lines = (st.rest + buf.toString('utf8')).split('
');
  st.rest = lines.pop(); // partial last line: finish it next time
  for (const line of lines) {
    if (!line.includes('"usage"')) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    const m = j.message, u = m && m.usage;
    if (!u || j.type !== 'assistant') continue;
    const id = (m.id || '') + (j.requestId || '');
    if (id && st.seen.has(id)) continue;
    if (id) st.seen.add(id);
    // Tokens that count: input + cache writes + output (cache reads are cheap re-reads of context).
    const tokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0);
    add(folder, Date.parse(j.timestamp) || Date.now(), m.model, tokens);
  }
}

let scanning = false;
async function scanAsync(dir) {
  try {
    for (const folder of await fs.promises.readdir(dir)) {
      for (const f of await listJsonlAsync(path.join(dir, folder))) {
        try { await readNew(f, folder.toLowerCase()); } catch {}
      }
    }
  } catch {}
}
function scan(dir) {
  if (scanning || Date.now() - lastScan < 20e3) return; // at most every 20s, one at a time
  lastScan = Date.now();
  scanning = true;
  scanAsync(dir).finally(() => { scanning = false; lastScan = Date.now(); });
}

function totals(b, now) {
  const w = { h5: 0, today: 0, d7: 0, d30: 0, models7d: {} };
  if (!b) return w;
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  for (const [h, row] of b) {
    for (const [fam, n] of Object.entries(row)) {
      if (h >= now - 5 * HOUR) w.h5 += n;
      if (h >= +midnight) w.today += n;
      if (h >= now - 7 * 24 * HOUR) { w.d7 += n; w.models7d[fam] = (w.models7d[fam] || 0) + n; }
      if (h >= now - 30 * 24 * HOUR) w.d30 += n;
    }
  }
  return w;
}

// Tokens per local calendar day for the last 30 days (today included), zero-filled: [{ date, tokens }].
function daily(b, now) {
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const days = new Map();
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.set(key(d), 0); }
  if (b) for (const [h, row] of b) {
    const k = key(new Date(h));
    if (days.has(k)) days.set(k, days.get(k) + Object.values(row).reduce((a, n) => a + n, 0));
  }
  return [...days].map(([date, tokens]) => ({ date, tokens }));
}

// projects: [{ slug, path }]  ->  { enabled, org, projects: { slug: totals }, other: totals }
function usage(dir, projects) {
  if (!dir || !fs.existsSync(dir)) return { enabled: false };
  scan(dir);
  const now = Date.now(), bySlug = {}, matched = new Set(), dailyBy = {};
  for (const p of projects) {
    const f = p.path && folderOf(p.path);
    if (f && buckets.has(f)) { bySlug[p.slug] = totals(buckets.get(f), now); dailyBy[p.slug] = daily(buckets.get(f), now); matched.add(f); }
  }
  const all = new Map(), other = new Map();
  for (const [f, b] of buckets) for (const [h, row] of b) {
    for (const target of matched.has(f) ? [all] : [all, other]) {
      const r = target.get(h) || {}; for (const [k, n] of Object.entries(row)) r[k] = (r[k] || 0) + n; target.set(h, r);
    }
  }
  return {
    enabled: true, org: totals(all, now), projects: bySlug, other: totals(other, now),
    daily: { projects: dailyBy, other: daily(other, now), org: daily(all, now) },
  };
}

// AIG-712: parsed lines per log file, cached by path + size + mtime. A file that only grew is read from the last offset
// (logs are append-only); one that shrank or changed without growing is read afresh. Keeps only the lines runTokens needs.
const evCache = new Map(); // file -> { size, mtime, offset, rest, events }
function parseEvent(line) {
  const hasUse = line.includes('"usage"'), hasRes = line.includes('"tool_result"');
  if (!hasUse && !hasRes) return null;
  let j; try { j = JSON.parse(line); } catch { return null; }
  const m = j.message, u = m && m.usage, ev = { ts: Date.parse(j.timestamp), res: [], use: null };
  if (hasRes && j.type === 'user' && m && Array.isArray(m.content)) for (const x of m.content) {
    if (x && x.type === 'tool_result') ev.res.push({ id: x.tool_use_id, chars: typeof x.content === 'string' ? x.content.length
      : Array.isArray(x.content) ? x.content.reduce((n, y) => n + (y && typeof y.text === 'string' ? y.text.length : 0), 0) : 0 });
  }
  if (u && j.type === 'assistant') {
    const use = ev.use = { id: (m.id || '') + (j.requestId || ''), fresh: u.input_tokens || 0, cw: u.cache_creation_input_tokens || 0, out: u.output_tokens || 0,
      cache: u.cache_read_input_tokens || 0, model: m.model, readIds: [], greps: 0 };
    if (Array.isArray(m.content)) for (const x of m.content) {
      if (!x || x.type !== 'tool_use') continue;
      if (x.name === 'Read') { if (x.id) use.readIds.push(x.id); else use.readIds.push(null); } else if (x.name === 'Grep') use.greps++;
    }
  }
  return ev.res.length || ev.use ? ev : null;
}
function fileEvents(file) {
  const st = fs.statSync(file);
  let c = evCache.get(file);
  if (c && c.size === st.size && c.mtime === st.mtimeMs) return c.events;
  if (!c || st.size < c.offset || (st.size === c.size)) c = { offset: 0, rest: '', events: [] };
  const buf = Buffer.alloc(st.size - c.offset), fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, c.offset); } finally { fs.closeSync(fd); }
  const lines = (c.rest + buf.toString('utf8')).split(String.fromCharCode(10));
  c.rest = lines.pop();
  c.offset = st.size;
  for (const line of lines) { const ev = parseEvent(line); if (ev) c.events.push(ev); }
  c.size = st.size; c.mtime = st.mtimeMs;
  evCache.set(file, c);
  return c.events;
}

// Tokens one background run used (AIG-266): every message in the project's session logs stamped between the
// run's start and end, each counted once. in = input + cache writes (as above), cache = cache reads.
// Returns null when the logs folder or a matching message is missing, so the caller writes nothing.
// worktrees (AIG-522 #10): also count the project's helper worktrees (.claude/worktrees/*), whose logs sit in sibling folders.
function runTokens(dir, projectPath, from, to, worktrees) {
  if (!dir || !projectPath) return null;
  const want = folderOf(projectPath), names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];   // folder names are matched without case, like the page does
  const folders = names.filter(f => f.toLowerCase() === want || (worktrees && f.toLowerCase().startsWith(want + '--claude-worktrees-'))).map(f => path.join(dir, f));
  if (!folders.length) return null;
  const sum = { in: 0, out: 0, cache: 0, fresh: 0, cw: 0, models: [], reads: 0, readChars: 0, greps: 0 }, seen = new Set(), readIds = new Set();
  let found = false;
  for (const f of folders.flatMap(d => listJsonl(d))) {
    try { if (fs.statSync(f).mtimeMs < from - 1000) continue; } catch { continue; }
    for (const ev of fileEvents(f)) {
      const ts = ev.ts;
      if (!(ts >= from - 1000 && ts <= to + 1000)) continue;
      // Read/Grep calls (AIG-299): count the call, and the size of what a Read handed back (its result's text).
      for (const r of ev.res) if (readIds.has(r.id)) { readIds.delete(r.id); sum.readChars += r.chars; }
      const u = ev.use;
      if (!u) continue;
      if (u.id && seen.has(u.id)) continue;
      if (u.id) seen.add(u.id);
      sum.in += u.fresh + u.cw;
      sum.fresh += u.fresh;
      sum.cw += u.cw;
      sum.out += u.out;
      sum.cache += u.cache;
      if (u.model && !sum.models.includes(u.model)) sum.models.push(u.model);
      sum.reads += u.readIds.length; sum.greps += u.greps;
      for (const id of u.readIds) readIds.add(id);
      found = true;
    }
  }
  return found ? sum : null;
}
const short = n => { const f = (v, u) => (v >= 100 ? Math.round(v) : +v.toFixed(1)) + u;
  return n >= 1e6 ? f(n / 1e6, 'M') : n >= 1e3 ? f(n / 1e3, 'k') : String(n); };
const tokenLine = s => `=== tokens: ${short(s.in)} in · ${short(s.out)} out · ${short(s.cache)} cache read ===`;


// One row in data/logs/_runs.jsonl for a run that is not a team run (AIG-522 #10): same fields as a team run plus kind
// ('scrummaster', 'tester', 'ask', 'pack'). Tokens come from the agent's session log in `folder` for the run's window, or from `tk`
// when the caller already has them (the ask and pack runs read them from the CLI result). Never throws; returns the row or null.
function logRun(kind, slug, { folder, start, end = Date.now(), tk, log }) {
  try {
    const { DATA, localSettings } = require('./store');
    tk = tk || runTokens(process.env.AIGILE_USAGE_DIR || localSettings().usageDir, folder, start, end);
    if (!tk) return null;
    fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
    if (log) fs.appendFileSync(log, tokenLine(tk) + '\n');
    const row = { slug, kind, start, end, cards: [], ...tk };
    fs.appendFileSync(path.join(DATA, 'logs', '_runs.jsonl'), JSON.stringify(row) + '\n');
    return row;
  } catch { return null; }
}

// VS Code lead sessions (AIG-522 #10): their usage files sit in the project's folder (and its helper worktrees) next to the background
// runs'. So what the folder used in the last `hours`, less what the logged runs of that team used, is the lead's own sessions. One row per
// project with the same fields as a run (kind 'lead', slug = the project). Cached for 10 seconds: it reads the whole window.
const leadCache = { at: 0, hours: 0, rows: [] };
function leadRows(dir, projects, runs, hours = 24) {
  if (!dir || !fs.existsSync(dir)) return [];
  if (Date.now() - leadCache.at < 10e3 && leadCache.hours === hours) return leadCache.rows;
  const to = Date.now(), from = to - hours * 3600e3, rows = [];
  for (const p of projects) {
    let t; try { t = p.path && runTokens(dir, p.path, from, to, true); } catch { t = null; }
    if (!t) continue;
    const mine = runs.filter(r => r.slug === p.slug && r.end >= from);
    const left = k => Math.max(0, t[k] - mine.reduce((n, r) => n + (r[k] || 0), 0));
    const row = { slug: p.slug, kind: 'lead', start: from, end: to, cards: [], in: left('in'), out: left('out'), cache: left('cache'), fresh: left('fresh'), cw: left('cw'), models: t.models, reads: t.reads, readChars: t.readChars, greps: t.greps };
    if (row.in + row.out + row.cache > 0) rows.push(row);
  }
  Object.assign(leadCache, { at: Date.now(), hours, rows });
  return rows;
}

module.exports = { usage, runTokens, tokenLine, logRun, leadRows };
