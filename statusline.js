#!/usr/bin/env node
// Status line for agent sessions: prints the plan usage as two lines (AIG-431, the same format as the board's
// compact Usage view) and forwards it (rate_limits: % used + reset time per window) to the AI-gile board, so it can
// chart how much is left. Must be quick and silent on failure: the board may not be running.
const BASE = (process.env.AIGILE_URL || 'http://localhost:4321').replace(/\/$/, '');

// "5h window:  0% [........] resets in 3h 33m" and "7d window: 48% [XXXX....] resets in 4d 19h"
const bar = pct => { const n = Math.max(0, Math.min(8, Math.round(pct / 12.5))); return '[' + 'X'.repeat(n) + '.'.repeat(8 - n) + ']'; };
const hm = ms => { const m = Math.max(0, Math.round(ms / 60e3)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`; };
function usageLines(rl) {
  const row = (label, w) => {
    if (!w || w.used_percentage == null) return label + ': --';
    const pct = Math.round(w.used_percentage), reset = w.resets_at != null ? Number(w.resets_at) * 1000 - Date.now() : null;
    const tail = reset == null || isNaN(reset) ? 'reset time unknown' : reset < 0 ? 'reset since the last reading' : 'resets in ' + hm(reset);
    return label.padEnd(10) + ' ' + (pct + '%').padStart(3) + ' ' + bar(pct) + ' ' + tail;
  };
  return [row('5h window:', rl.five_hour), row('7d window:', rl.seven_day)];
}

let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', async () => {
  let j = {};
  try { j = JSON.parse(raw); } catch {}
  const rl = j.rate_limits || null;
  if (rl) console.log(usageLines(rl).join('\n'));
  else console.log((j.model && j.model.display_name) || '');
  if (!rl) return;
  try {
    await fetch(BASE + '/api/limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate_limits: rl, cwd: (j.workspace && j.workspace.current_dir) || j.cwd || '' }),
      signal: AbortSignal.timeout(800),
    });
  } catch {}
});
