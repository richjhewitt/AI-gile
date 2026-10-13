// Agent engines (AIG-704/705): which program a background run starts. Claude (the default, built into presence.js) or Codex.
// Everything about the Codex command line lives HERE, in the ENGINES table, so a wrong flag is fixed in one place after the
// owner's first real run. Not yet run against a real Codex: every line marked "check on first real run" is a best guess.
//
// A project runs ONE agent at a time (its lead), so the engine of a run is the engine on the lead's roster entry
// (p.team[i].engine: 'claude' | 'codex', missing = 'claude'; p.team[i].codexModel = Codex's -m value, '' = Codex's default).
// Codex reads AGENTS.md in the project folder by itself; the prompt still tells it to run the board brief (which prints the
// profile lines), so the brief and profile reach it the same way as for Claude.
// Doubts (AIG-705): Codex's sandbox cannot allow "localhost:4321 only". `workspace-write` blocks all network, so the aigile
// CLI (HTTP to the board) would fail; network_access=true lets it through but is wider than we want. Check on first real run
// whether a narrower setting exists. "Never push" is only a rule in the prompt: the sandbox cannot tell git push apart.
const path = require('path');

const NODE_NET = ['-c', 'sandbox_workspace_write.network_access=true'];   // check on first real run

const ENGINES = {
  claude: { label: 'Claude', builtin: true },   // its command line is built in presence.js launch()
  codex: {
    label: 'Codex',
    exe: 'codex',   // found on the PATH; AIGILE_ENGINE_STUB (a script path) stands in for it in tests
    // The run's arguments. `codex exec` is the non-interactive mode; the prompt is the last argument.
    args({ prompt, model }) {
      return ['exec', '--json',                                   // JSON events, one per line on stdout (check on first real run)
        '--sandbox', 'workspace-write',                            // may write in the project folder (the cwd) and run programs
        '-c', 'approval_policy=never',                             // never stop to ask: nobody is there (check on first real run: the flag may be -a never)
        ...NODE_NET,
        '--skip-git-repo-check',                                   // check on first real run
        ...(model ? ['-m', model] : []),
        prompt];
    },
    // One output line (a JSON event) as readable log lines. Event names: check on first real run.
    read(line, cwd) {
      let ev; try { ev = JSON.parse(line); } catch { return line.trim() ? [line] : []; }
      const it = ev.item || ev.msg || {}, cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
      if (ev.type === 'thread.started' || ev.type === 'session_configured') return ['▶ codex started'];
      if (ev.type === 'item.completed' || ev.type === 'item.started') {
        const ty = it.type || it.item_type;
        if (ty === 'agent_message' && ev.type === 'item.completed') return it.text && it.text.trim() ? ['💬 ' + cut(it.text, 400)] : [];
        if (ty === 'command_execution') return ev.type === 'item.started' ? ['🔧 ' + cut(it.command, 160)] : (it.exit_code ? [`   ⚠️ exit ${it.exit_code}`] : []);
        if (ty === 'file_change') return ['✏️ ' + cut((it.changes || []).map(c => path.relative(cwd || '', c.path || '') || c.path).join(', '), 160)];
        return [];
      }
      if (ev.type === 'turn.failed' || ev.type === 'error') return ['⚠️ ' + cut((ev.error && ev.error.message) || ev.message || 'error', 300)];
      return [];
    },
  },
};

const engineName = m => (m && m.engine === 'codex' ? 'codex' : 'claude');
// The roster entry that is the project's lead (same rule as routes/ctx leadOf), or null.
function leadEntry(p) {
  const t = ((p && p.team) || []).filter(m => m.kind !== 'person' && !/retired/i.test(m.status || ''));
  return t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0] || null;
}
// { engine: 'claude' | 'codex', model } for a project's background run.
const forProject = p => { const m = leadEntry(p); return { engine: engineName(m), model: m && engineName(m) === 'codex' ? String(m.codexModel || '').trim() : '' }; };

// The program to start for Codex: the stub, the PATH, or '' when Codex is not installed.
function codexExe() {
  const stub = process.env.AIGILE_ENGINE_STUB;
  if (stub) return require('fs').existsSync(stub) ? stub : '';   // a stub path with no file = "not installed" (tests)
  return require('./platform').has('codex') ? ENGINES.codex.exe : '';
}

// Never-push preamble for Codex runs, put in front of the usual prompt.
const PREAMBLE = 'You are running through Codex. Never run git push (or anything that publishes or deploys): commit locally only. Your project folder has an AGENTS.md: read it, and the board brief you are asked to run gives your profile. ';

module.exports = { ENGINES, engineName, leadEntry, forProject, codexExe, PREAMBLE };
