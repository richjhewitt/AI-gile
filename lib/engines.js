// Agent engines (AIG-704/705): which program a background run starts. Claude (the default, built into presence.js), Codex or Gemini (AIG-761/762).
// Everything about the Codex command line lives HERE, in the ENGINES table, so a wrong flag is fixed in one place after the
// owner's first real run. Not yet run against a real Codex: every line marked "check on first real run" is a best guess.
//
// A project runs ONE agent at a time (its lead), so the engine of a run is the engine on the lead's roster entry
// (p.team[i].engine: 'claude' | 'codex' | 'gemini', missing = 'claude'; p.team[i].codexModel / geminiModel = that engine's -m value, '' = its default).
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
  gemini: {
    label: 'Gemini',
    exe: 'gemini',   // Google's Gemini CLI, on the PATH; AIGILE_ENGINE_STUB stands in for it in tests
    // `gemini -p "<prompt>"` is the non-interactive (headless) mode.
    args({ prompt, model }) {
      return ['--yolo',                                           // auto-approve every tool call: nobody is there (check on first real run: or --approval-mode yolo)
        '--output-format', 'stream-json',                         // JSON events, one per line on stdout (check on first real run)
        ...(model ? ['-m', model] : []),                          // check on first real run
        '-p', prompt];
    },
    // One output line (a stream-json event) as readable log lines. Tolerant: unknown JSON ignored, plain text passed through.
    // Event names are a best guess (init, message{role,content}, tool_use{tool_name,parameters}, tool_result{status}, error, result): check on first real run.
    read(line) {
      if (!line.trim()) return [];
      let ev; try { ev = JSON.parse(line); } catch { return [line]; }
      if (!ev || typeof ev !== 'object') return [line];
      const cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
      if (ev.type === 'init') return ['▶ gemini started'];
      if (ev.type === 'message') return ev.role === 'assistant' && String(ev.content || '').trim() ? ['💬 ' + cut(ev.content, 400)] : [];
      if (ev.type === 'tool_use') {
        const a = ev.parameters || ev.args || {};
        return ['🔧 ' + cut((ev.tool_name || ev.name || 'tool') + ' ' + (a.command || a.file_path || a.path || a.pattern || ''), 160)];
      }
      if (ev.type === 'tool_result') return ev.status && ev.status !== 'success' ? ['   ⚠️ ' + cut((ev.error && ev.error.message) || ev.status, 160)] : [];
      if (ev.type === 'error') return ['⚠️ ' + cut((ev.error && ev.error.message) || ev.message || 'error', 300)];
      if (ev.type === 'result' && ev.status && ev.status !== 'success') return ['⚠️ ' + cut(ev.status, 100)];
      return [];
    },
  },
};

const engineName = m => (m && (m.engine === 'codex' || m.engine === 'gemini') ? m.engine : 'claude');
// The roster entry that is the project's lead (same rule as routes/ctx leadOf), or null.
function leadEntry(p) {
  const t = ((p && p.team) || []).filter(m => m.kind !== 'person' && !/retired/i.test(m.status || ''));
  return t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0] || null;
}
// { engine: 'claude' | 'codex', model } for a project's background run.
const forProject = p => { const m = leadEntry(p), e = engineName(m); return { engine: e, model: e === 'codex' ? String(m.codexModel || '').trim() : e === 'gemini' ? String(m.geminiModel || '').trim() : '' }; };

// The program to start for an engine (default codex): the stub, the PATH, or '' when it is not installed.
function engineExe(name = 'codex') {
  const stub = process.env.AIGILE_ENGINE_STUB;
  if (stub) return require('fs').existsSync(stub) ? stub : '';   // a stub path with no file = "not installed" (tests)
  return ENGINES[name] && ENGINES[name].exe && require('./platform').has(ENGINES[name].exe) ? ENGINES[name].exe : '';
}
const codexExe = () => engineExe('codex');

// Never-push preamble for Codex runs, put in front of the usual prompt.
const PREAMBLE = 'You are running through Codex. Never run git push (or anything that publishes or deploys): commit locally only. Your project folder has an AGENTS.md: read it, and the board brief you are asked to run gives your profile. ';

// Gemini reads GEMINI.md by default, not AGENTS.md. There is no command-line flag for the context file (the setting `context.fileName`
// in .gemini/settings.json does it; not written into projects), so the prompt names AGENTS.md. Check on first real run.
const PREAMBLE_GEMINI = 'You are running through Gemini CLI. Never run git push (or anything that publishes or deploys): commit locally only. Never add AI attribution or co-author lines to commits. Do not open windows or start servers or processes outside the board. Your project folder has an AGENTS.md (not GEMINI.md): read it first, and the board brief you are asked to run gives your profile. ';
const preambleFor = e => (e === 'gemini' ? PREAMBLE_GEMINI : PREAMBLE);

module.exports = { ENGINES, engineName, leadEntry, forProject, engineExe, codexExe, PREAMBLE, PREAMBLE_GEMINI, preambleFor };
