#!/usr/bin/env node
// How each way of running a lead compares (AIG-461): VS Code, terminal, or a background run started by the board.
// Reads Claude Code's own session files (~/.claude/projects/**/*.jsonl) and uses only the usage numbers, models and
// timestamps in them, never the text. Groups by "entrypoint": claude-vscode (VS Code), cli (terminal), sdk-cli (background
// runs: the board's claude -p, the Scrum Master, the tester).
//   node tools/session-modes.cjs [--days 7] [--json] [--dir <projects folder>]
// Cost units weigh tokens the way the API prices them, relative to fresh input: input 1, cache write 1.25 (5 min) or 2 (1 h),
// cache read 0.1, output 5. Only for comparing modes, not a bill.
const fs = require('fs');
const path = require('path');
const os = require('os');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const DIR = arg('--dir', path.join(os.homedir(), '.claude', 'projects'));
const DAYS = Number(arg('--days', 7));
const since = Date.now() - DAYS * 864e5;
const NAMES = { 'claude-vscode': 'VS Code', cli: 'Terminal', 'sdk-cli': 'Background (claude -p)' };

function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p)); else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// One file = one session (or one helper agent's run, when its lines are sidechain lines).
function session(file) {
  const s = { mode: '', helper: false, calls: 0, input: 0, write5: 0, write1h: 0, read: 0, output: 0, prompts: 0, first: 0, last: 0, waits: [], models: {} };
  const seen = new Set();
  let asked = 0, answered = 0;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (!line) continue;
    let x; try { x = JSON.parse(line); } catch { continue; }
    const t = Date.parse(x.timestamp || ''); if (!t) continue;
    if (x.entrypoint && !s.mode) s.mode = x.entrypoint;
    if (x.isSidechain) s.helper = true;
    s.first = s.first || t; s.last = t;
    if (x.type === 'user' && typeof (x.message && x.message.content) === 'string' && !x.isMeta) {   // a typed prompt, not a tool result
      if (asked && answered > asked) s.waits.push(answered - asked);
      asked = t; answered = 0; s.prompts++;
    }
    if (x.type === 'assistant' && x.message && x.message.usage) {
      answered = t;
      const id = x.message.id || x.requestId; if (seen.has(id)) continue; seen.add(id);
      const u = x.message.usage, cc = u.cache_creation || {};
      s.calls++; s.input += u.input_tokens || 0; s.read += u.cache_read_input_tokens || 0; s.output += u.output_tokens || 0;
      const w1h = cc.ephemeral_1h_input_tokens || 0; s.write1h += w1h; s.write5 += Math.max(0, (u.cache_creation_input_tokens || 0) - w1h);
      const m = String(x.message.model || '?').replace(/^claude-/, ''); s.models[m] = (s.models[m] || 0) + 1;
    }
  }
  if (asked && answered > asked) s.waits.push(answered - asked);
  s.units = s.input + 1.25 * s.write5 + 2 * s.write1h + 0.1 * s.read + 5 * s.output;
  return s;
}

const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const k = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));

const all = files(DIR).filter(f => { try { return fs.statSync(f).mtimeMs >= since; } catch { return false; } }).map(session).filter(s => s.calls && s.last >= since);
const groups = {};
for (const s of all) { const key = (NAMES[s.mode] || s.mode || '?') + (s.helper ? ', helper agents' : ''); (groups[key] = groups[key] || []).push(s); }
const rows = Object.entries(groups).map(([mode, list]) => {
  const sum = f => list.reduce((n, s) => n + f(s), 0), prompts = sum(s => s.prompts), calls = sum(s => s.calls);
  return { mode, sessions: list.length, prompts, calls, units: sum(s => s.units), output: sum(s => s.output), readShare: sum(s => s.read) / Math.max(1, sum(s => s.read + s.input + s.write5 + s.write1h)),
    unitsPerCall: sum(s => s.units) / Math.max(1, calls), unitsPerPrompt: prompts ? sum(s => s.units) / prompts : null, callsPerPrompt: prompts ? calls / prompts : null,
    medianWaitS: median(list.flatMap(s => s.waits)) / 1000, medianSessionMin: median(list.map(s => (s.last - s.first) / 6e4)) };
}).sort((a, b) => b.units - a.units);

if (process.argv.includes('--json')) { console.log(JSON.stringify({ days: DAYS, rows }, null, 1)); process.exit(0); }
console.log(`Last ${DAYS} days, ${all.length} sessions from ${DIR}\n`);
console.log('| Mode | Sessions | Prompts | API calls | Cost units | per call | per prompt | calls per prompt | cache reads | wait per prompt | session length |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.mode} | ${r.sessions} | ${r.prompts} | ${r.calls} | ${k(r.units)} | ${k(r.unitsPerCall)} | ${r.unitsPerPrompt == null ? '-' : k(r.unitsPerPrompt)} | ${r.callsPerPrompt == null ? '-' : r.callsPerPrompt.toFixed(1)} | ${Math.round(r.readShare * 100)}% | ${Math.round(r.medianWaitS)} s | ${Math.round(r.medianSessionMin)} min |`);
