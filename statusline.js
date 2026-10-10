#!/usr/bin/env node
// Status line for agent sessions: prints a one-line summary and forwards the plan usage
// (rate_limits: % used + reset time per window) to the AI-gile board, so it can chart how much
// is left. Must be quick and silent on failure: the board may not be running.
const BASE = (process.env.AIGILE_URL || 'http://localhost:4321').replace(/\/$/, '');

let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', async () => {
  let j = {};
  try { j = JSON.parse(raw); } catch {}
  const rl = j.rate_limits || null;
  const pct = w => (w && w.used_percentage != null ? Math.round(w.used_percentage) + '%' : null);
  const parts = [j.model && j.model.display_name];
  if (rl) {
    if (pct(rl.five_hour)) parts.push('5h ' + pct(rl.five_hour));
    if (pct(rl.seven_day)) parts.push('week ' + pct(rl.seven_day));
  }
  console.log(parts.filter(Boolean).join(' · '));
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
