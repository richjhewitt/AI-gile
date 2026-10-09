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

function readNew(file, folder) {
  let st = files.get(file);
  const size = fs.statSync(file).size;
  if (!st || size < st.offset) { st = { offset: 0, rest: '', seen: new Set(), folder }; files.set(file, st); }
  if (size === st.offset) return;
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(size - st.offset);
  fs.readSync(fd, buf, 0, buf.length, st.offset);
  fs.closeSync(fd);
  st.offset = size;
  const lines = (st.rest + buf.toString('utf8')).split('\n');
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

function scan(dir) {
  if (Date.now() - lastScan < 20e3) return; // at most every 20s
  lastScan = Date.now();
  for (const folder of fs.readdirSync(dir)) {
    for (const f of listJsonl(path.join(dir, folder))) {
      try { readNew(f, folder.toLowerCase()); } catch {}
    }
  }
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

// projects: [{ slug, path }]  ->  { enabled, org, projects: { slug: totals }, other: totals }
function usage(dir, projects) {
  if (!dir || !fs.existsSync(dir)) return { enabled: false };
  scan(dir);
  const now = Date.now(), bySlug = {}, matched = new Set();
  for (const p of projects) {
    const f = p.path && folderOf(p.path);
    if (f && buckets.has(f)) { bySlug[p.slug] = totals(buckets.get(f), now); matched.add(f); }
  }
  const all = new Map(), other = new Map();
  for (const [f, b] of buckets) for (const [h, row] of b) {
    for (const target of matched.has(f) ? [all] : [all, other]) {
      const r = target.get(h) || {}; for (const [k, n] of Object.entries(row)) r[k] = (r[k] || 0) + n; target.set(h, r);
    }
  }
  return { enabled: true, org: totals(all, now), projects: bySlug, other: totals(other, now) };
}

module.exports = { usage };
