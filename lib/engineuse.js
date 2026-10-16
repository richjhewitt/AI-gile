// Usage per engine (AIG-1340): Claude, Codex, Gemini, GitHub Copilot and Cursor.
// Claude's tokens come from its session logs (lib/usage.js). The other engines leave none there, so a run's tokens are read
// from what the run printed (its JSON events in logs/<key>.raw, the same lines lib/engines.js turns into readable log lines):
// tokensFromRaw(). They land in data/logs/_runs.jsonl with an `engine` field, like a Claude run.
// Limits: only what the engine itself writes on this PC. Codex writes its rate limits into its session logs
// (~/.codex/sessions/**/rollout-*.jsonl, "token_count" events): codexLimits(). Copilot prints the premium requests a run used
// (counted per run, its monthly allowance is not on this PC). Gemini and Cursor write nothing about limits: null.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ENGINES = ['claude', 'codex', 'gemini', 'copilot', 'cursor'];
const engineOf = r => (r && ENGINES.includes(r.engine) ? r.engine : 'claude');
const num = v => (Number.isFinite(+v) && +v >= 0 ? +v : 0);
const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && Number.isFinite(+o[k])) return +o[k]; return null; };

// One usage-looking object as { input, cached, cw, out }, or null when it has no token counts.
function norm(u) {
  if (!u || typeof u !== 'object') return null;
  const input = pick(u, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens', 'prompt', 'input']);
  const out = pick(u, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens', 'candidates', 'candidates_tokens', 'output']);
  if (input == null && out == null) return null;
  return { input: num(input), out: num(out),
    cached: num(pick(u, ['cached_input_tokens', 'cacheReadTokens', 'cache_read_input_tokens', 'cache_read_tokens', 'cachedTokens', 'cached'])),
    cw: num(pick(u, ['cache_creation_input_tokens', 'cacheWriteTokens', 'cache_write_input_tokens', 'cache_write_tokens'])) };
}
// Gemini's stats may be split per model: { models: { name: { tokens: { prompt, candidates, cached } } } }.
function geminiStats(s) {
  if (!s || typeof s !== 'object') return [];
  const one = norm(s); if (one) return [one];
  return Object.values(s.models || {}).map(m => norm((m && m.tokens) || m)).filter(Boolean);
}

// What one run of `engine` used, from the text it printed: { in, out, cache, fresh, cw, models, premium? } or null when it said nothing.
// in = fresh input + cache writes (as lib/usage.js counts a Claude run), cache = cached input read back.
function tokensFromRaw(engine, text) {
  if (!engine || engine === 'claude' || !text) return null;
  const parts = [], models = new Set(), finals = [];
  let premium = null, premText = null;   // the JSON count (largest seen) and the closing text lines (summed): the same requests, so the larger one wins
  const addModel = m => { if (typeof m === 'string' && m.trim() && m.length < 80) models.add(m.trim()); };
  for (const line of String(text).split(/\r?\n/)) {
    const s = line.trim(); if (!s) continue;
    // Copilot's closing lines ("Total usage est: 2 Premium requests"), plain text on either stream.
    const pm = /total usage est[^0-9]*([\d.]+)\s*premium request/i.exec(s);
    if (pm) { premText = (premText || 0) + num(pm[1]); continue; }
    if (s[0] !== '{') continue;
    let ev; try { ev = JSON.parse(s); } catch { continue; }
    if (!ev || typeof ev !== 'object') continue;
    const ty = String(ev.type || ''), d = ev.data && typeof ev.data === 'object' ? ev.data : null;
    addModel(ev.model); if (d) addModel(d.model);
    const pr = pick(ev.usage || {}, ['premiumRequests', 'premium_requests', 'totalPremiumRequests']) ?? pick(d || {}, ['totalPremiumRequests', 'premiumRequests']);
    if (pr != null && engine === 'copilot') premium = Math.max(premium || 0, pr);
    if (engine === 'codex' && ty === 'turn.completed') { const u = norm(ev.usage); if (u) parts.push(u); continue; }
    if (engine === 'gemini' && ty === 'result') { parts.push(...geminiStats(ev.stats || ev.usage)); continue; }
    if (engine === 'cursor' && ty === 'result') { const u = norm(ev.usage); if (u) parts.push(u); continue; }
    if (engine === 'copilot' && /usage/i.test(ty) && d) { const u = norm(d); if (u) parts.push(u); continue; }
    // A closing event with totals: used only when no per-turn counts came (it may repeat them).
    if (/result|complete|shutdown|finish/i.test(ty)) { const u = norm(ev.usage) || norm(ev.stats) || norm(d && d.usage); if (u) finals.push(u); }
  }
  const use = parts.length ? parts : finals.slice(-1);
  if (premText != null) premium = Math.max(premium || 0, premText);
  if (!use.length && premium == null) return null;
  // Codex and Gemini count the cached input inside the input; Cursor and Copilot (Anthropic-style) beside it.
  const inside = engine === 'codex' || engine === 'gemini';
  const sum = { in: 0, out: 0, cache: 0, fresh: 0, cw: 0 };
  for (const u of use) {
    const fresh = inside ? Math.max(0, u.input - u.cached) : u.input;
    sum.fresh += fresh; sum.cw += u.cw; sum.in += fresh + u.cw; sum.out += u.out; sum.cache += u.cached;
  }
  const row = { ...sum, models: [...models] };
  if (premium != null) row.premium = premium;
  return row;
}

/* ---------- the run rows ---------- */
const runsFile = () => path.join(require('./store').DATA, 'logs', '_runs.jsonl');
let rowsCache = { key: '', rows: [] };
function rows() {
  let key = ''; try { const st = fs.statSync(runsFile()); key = st.size + ':' + st.mtimeMs; } catch { return []; }
  if (key === rowsCache.key) return rowsCache.rows;
  let list = []; try { list = fs.readFileSync(runsFile(), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
  rowsCache = { key, rows: list };
  return list;
}
const tokensOf = r => num(r.in) + num(r.out);   // input + cache writes + output, as lib/usage.js counts

/* ---------- Codex's own limits ---------- */
// The newest "rate_limits" Codex wrote in its session logs: { at, plan, windows: [{ minutes, usedPct, resets }] }, or null.
// Reads only the newest few rollout files, from the end. CODEX_HOME moves the folder (as it does for Codex itself).
const codexHome = () => process.env.AIGILE_CODEX_HOME || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
let limCache = { at: 0, value: null };
function newest(dir, depth, out) {
  let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of list) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && depth < 4) newest(f, depth + 1, out);
    else if (/\.jsonl$/.test(e.name)) { try { out.push({ f, m: fs.statSync(f).mtimeMs }); } catch {} }
  }
}
function tailText(f, bytes) {
  const size = fs.statSync(f).size, n = Math.min(size, bytes), b = Buffer.alloc(n), fd = fs.openSync(f, 'r');
  try { fs.readSync(fd, b, 0, n, size - n); } finally { fs.closeSync(fd); }
  return b.toString('utf8');
}
function codexLimits() {
  if (Date.now() - limCache.at < 30e3) return limCache.value;
  let value = null;
  try {
    const files = []; newest(path.join(codexHome(), 'sessions'), 0, files);
    files.sort((a, b) => b.m - a.m);
    for (const { f } of files.slice(0, 5)) {
      const lines = tailText(f, 512 * 1024).split(/\r?\n/).filter(l => l.includes('"rate_limits"')).reverse();
      for (const l of lines) {
        let j; try { j = JSON.parse(l); } catch { continue; }
        const rl = (j.payload && j.payload.rate_limits) || j.rate_limits || (j.msg && j.msg.rate_limits);
        if (!rl) continue;
        const windows = ['primary', 'secondary'].map(k => rl[k]).filter(w => w && w.used_percent != null)
          .map(w => ({ minutes: num(w.window_minutes) || null, usedPct: Math.max(0, Math.min(100, +w.used_percent)),
            resets: w.resets_at ? (+w.resets_at < 1e12 ? +w.resets_at * 1000 : +w.resets_at) : w.resets_in_seconds != null ? Date.parse(j.timestamp) + num(w.resets_in_seconds) * 1000 : null }));
        if (!windows.length) continue;
        value = { at: j.timestamp || null, plan: rl.plan_type || null, windows };
        break;
      }
      if (value) break;
    }
  } catch {}
  limCache = { at: Date.now(), value };
  return value;
}

/* ---------- the summary ---------- */
// Per engine used in the last 30 days: tokens today / 7 days / 30 days, runs today / 7 days, and its own limits.
// claude: { today, d7, d30 } of the Claude session logs (every Claude session, as the rest of the page counts) when given.
function summary(claude) {
  const now = Date.now(), day = new Date(now); day.setHours(0, 0, 0, 0);
  const from = { today: +day, d7: now - 7 * 864e5, d30: now - 30 * 864e5 }, month = new Date(now); month.setDate(1); month.setHours(0, 0, 0, 0);
  const by = Object.fromEntries(ENGINES.map(e => [e, { engine: e, today: 0, d7: 0, d30: 0, runsToday: 0, runs7: 0, runs30: 0, premiumMonth: null }]));
  for (const r of rows()) {
    if (!(r.end >= from.d30)) continue;
    const x = by[engineOf(r)], n = tokensOf(r);
    x.runs30++; x.d30 += n;
    if (r.end >= from.d7) { x.runs7++; x.d7 += n; }
    if (r.end >= from.today) { x.runsToday++; x.today += n; }
    if (r.premium != null && r.end >= +month) x.premiumMonth = (x.premiumMonth || 0) + num(r.premium);
  }
  if (claude) Object.assign(by.claude, { today: claude.today || 0, d7: claude.d7 || 0, d30: claude.d30 || 0 });
  const lim = { codex: codexLimits() };
  return ENGINES.map(e => ({ ...by[e], limits: lim[e] || null }))
    .filter(x => x.engine === 'claude' ? x.d30 > 0 || x.runs30 > 0 : x.runs30 > 0 || !!(x.limits && Date.parse(x.limits.at) >= from.d30));   // Codex used outside the board still shows its limits
}

// Per project slug and engine, the tokens of the non-Claude runs: [{ slug, engine, end, tokens }] (lib/usage.js adds them to its buckets).
const engineRows = () => rows().filter(r => r.slug && engineOf(r) !== 'claude').map(r => ({ slug: r.slug, engine: engineOf(r), end: r.end, tokens: tokensOf(r) }));

module.exports = { ENGINES, engineOf, tokensFromRaw, codexLimits, summary, engineRows, rows };
