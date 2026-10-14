// Agent engines (AIG-704/705): which program a background run starts. Claude (the default, built into presence.js), Codex or Gemini (AIG-761/762).
// Everything about the Codex command line lives HERE, in the ENGINES table, so a wrong flag is fixed in one place after the
// owner's first real run. Not yet run against a real Codex: every line marked "check on first real run" is a best guess.
//
// A project runs ONE agent at a time (its lead), so the engine of a run is the engine on the lead's roster entry
// (p.team[i].engine: 'claude' | 'codex' | 'gemini' | 'copilot' | 'cursor', missing = 'claude'; p.team[i].codexModel / geminiModel = that engine's -m value, '' = its default).
// Codex reads AGENTS.md in the project folder by itself; the prompt still tells it to run the board brief (which prints the
// profile lines), so the brief and profile reach it the same way as for Claude.
// Codex runs without its sandbox (AIG-402): "never push" and the other rules are in the prompt only.
const path = require('path');

const ENGINES = {
  claude: { label: 'Claude', builtin: true },   // its command line is built in presence.js launch()
  codex: {
    label: 'Codex',
    exe: 'codex',   // found on the PATH; AIGILE_ENGINE_STUB (a script path) stands in for it in tests
    // The run's arguments. `codex exec` is the non-interactive mode; the prompt is the last argument.
    args({ prompt, model }) {
      return ['exec', '--json',                                   // JSON events, one per line on stdout (check on first real run)
        // No sandbox (owner's OK, AIG-402): Codex's Windows sandbox fails to start ("setup refresh had errors"). This also
        // never stops to ask. The board rules come from the prompt (RULES), as for Gemini.
        '--dangerously-bypass-approvals-and-sandbox',
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
      return ['--skip-trust',                                     // headless runs refuse an untrusted folder without it (seen on the first real run, 0.64.0)
        '--yolo',                                           // auto-approve every tool call: nobody is there (check on first real run: or --approval-mode yolo)
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

// Copilot and Cursor (AIG-971/973) follow the same pattern. Flags confirmed in the official docs (docs.github.com, cursor.com/docs) on 2026-10-14;
// the JSON event shapes are only partly documented, so those readers are tolerant ("check on first real run").
const cutText = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
ENGINES.copilot = {
  label: 'GitHub Copilot',
  exe: 'copilot',   // GitHub Copilot CLI, on the PATH; AIGILE_ENGINE_STUB stands in for it in tests
  // `copilot -p "<prompt>"` runs the prompt non-interactively and exits (docs.github.com programmatic reference).
  args({ prompt, model }) {
    return ['--allow-all',                                        // = --allow-all-tools --allow-all-paths --allow-all-urls: nobody is there to approve (documented)
      '--no-ask-user',                                            // never pause to ask a question (documented)
      '--output-format=json',                                     // JSONL, one record per line (documented flag; the event types of a -p run are not: check on first real run)
      ...(model ? ['--model=' + model] : []),                     // documented
      '-p', prompt];
  },
  // Tolerant: the event shape of a -p run is not documented. Plain text passes through; JSON with assistant text / tool names is shown.
  read(line) {
    if (!line.trim()) return [];
    let ev; try { ev = JSON.parse(line); } catch { return [line]; }
    if (!ev || typeof ev !== 'object') return [line];
    const ty = String(ev.type || ''), d = ev.data || ev;
    if (/error/i.test(ty)) return ['⚠️ ' + cutText((d.error && d.error.message) || d.message || ty, 300)];
    if (/tool/i.test(ty) && /start|request|use/i.test(ty)) return ['🔧 ' + cutText((d.toolName || d.tool_name || d.name || 'tool') + ' ' + JSON.stringify(d.arguments || d.args || d.input || ''), 160)];
    if (/message|assistant/i.test(ty) && !/delta/i.test(ty) && typeof (d.content || d.text) === 'string' && (d.content || d.text).trim()) return ['💬 ' + cutText(d.content || d.text, 400)];
    return [];
  },
};
ENGINES.cursor = {
  label: 'Cursor',
  exes: ['agent', 'cursor-agent'],   // the docs call it `agent`; older installs used cursor-agent
  // `agent -p "<prompt>"` = print mode for scripts, CI and automation; --force (alias --yolo) applies changes; --trust skips the workspace prompt (headless only).
  args({ prompt, model }) {
    return ['--print', '--force', '--trust',                      // all documented (cursor.com/docs/cli/reference/parameters)
      '--output-format', 'stream-json',                           // documented: system/user/assistant/tool_call/result events
      ...(model ? ['--model', model] : []),                       // documented (long form only)
      prompt];
  },
  // Documented events: system(init), user, assistant{message.content[].text}, tool_call{subtype started|completed, tool_call.<x>ToolCall.args}, result{subtype,is_error,result}.
  read(line) {
    if (!line.trim()) return [];
    let ev; try { ev = JSON.parse(line); } catch { return [line]; }
    if (!ev || typeof ev !== 'object') return [line];
    if (ev.type === 'system' && ev.subtype === 'init') return ['▶ cursor started'];
    if (ev.type === 'assistant') { const t = ((ev.message && ev.message.content) || []).map(c => c && c.text || '').join(' ').trim(); return t ? ['💬 ' + cutText(t, 400)] : []; }
    if (ev.type === 'tool_call' && ev.subtype === 'started') {
      const k = Object.keys(ev.tool_call || {})[0] || 'tool', c = ev.tool_call[k] || {}, a = c.args || c.arguments || {};
      return ['🔧 ' + cutText(k.replace(/ToolCall$/, '') + ' ' + (a.command || a.path || a.pattern || (c.name || '')), 160)];
    }
    if (ev.type === 'result' && (ev.is_error || (ev.subtype && ev.subtype !== 'success'))) return ['⚠️ ' + cutText(ev.result || ev.subtype, 300)];
    return [];
  },
};

// A ready-made model per team role for each engine (AIG-1007), checked 2026-10-14 against the official docs. Strong model for
// Lead/Reviewer, mid for Frontend/Backend/Tester, small for QA/Docs/Quick fix. Keys = the team role names. Claude's are in the names.
// '' = leave that engine's own default. Codex ids: learn.chatgpt.com/docs/models (was developers.openai.com/codex/models);
// Gemini ids: geminicli.com/docs/reference/configuration (the ids the CLI lists). Change a model here, nowhere else.
const ROLE_MODELS = {
  'Lead (Opus)':       { codex: 'gpt-6-astra', gemini: 'gemini-3.1-pro-preview' },
  'Reviewer (Opus)':   { codex: 'gpt-6-astra', gemini: 'gemini-3.1-pro-preview' },
  'Frontend (Sonnet)': { codex: 'gpt-6-sol',   gemini: 'gemini-3.8-flash' },
  'Backend (Sonnet)':  { codex: 'gpt-6-sol',   gemini: 'gemini-3.8-flash' },
  'Tester (Sonnet)':   { codex: 'gpt-6-sol',   gemini: 'gemini-3.8-flash' },
  'QA (Haiku)':        { codex: 'gpt-6-luna',  gemini: 'gemini-3.5-flash-lite' },
  'Quick fix (Haiku)': { codex: 'gpt-6-luna',  gemini: 'gemini-3.5-flash-lite' },
  'Docs (Haiku)':      { codex: 'gpt-6-luna',  gemini: 'gemini-3.5-flash-lite' },
};
// The ready-made model for a role (a team role name or free roster text like "Frontend") on an engine, '' = none.
function roleModel(engine, role) {
  const r = String(role || '').toLowerCase(), key = /review/.test(r) ? 'Reviewer (Opus)' : /lead/.test(r) ? 'Lead (Opus)' : /front/.test(r) ? 'Frontend (Sonnet)'
    : /back/.test(r) ? 'Backend (Sonnet)' : /test/.test(r) ? 'Tester (Sonnet)' : /quick/.test(r) ? 'Quick fix (Haiku)' : /\bqa\b|quality/.test(r) ? 'QA (Haiku)' : /doc/.test(r) ? 'Docs (Haiku)' : '';
  return (key && ROLE_MODELS[key] && ROLE_MODELS[key][engine]) || '';
}

const engineName = m => (m && m.engine && m.engine !== 'claude' && ENGINES[m.engine] && !ENGINES[m.engine].builtin ? m.engine : 'claude');
const modelField = e => e + 'Model';   // codexModel, geminiModel, copilotModel, cursorModel
// The roster entry that is the project's lead (same rule as routes/ctx leadOf), or null.
function leadEntry(p) {
  const t = ((p && p.team) || []).filter(m => m.kind !== 'person' && !/retired/i.test(m.status || ''));
  return t.find(m => /lead/i.test(m.name + ' ' + (m.role || ''))) || t[0] || null;
}
// { engine: 'claude' | 'codex' | 'gemini' | 'copilot' | 'cursor', model } for a project's background run.
const forProject = p => { const m = leadEntry(p), e = engineName(m); return { engine: e, model: e === 'claude' ? '' : String(m[modelField(e)] || '').trim() }; };

// The program to start for an engine (default codex): the stub, the PATH, or '' when it is not installed.
function engineExe(name = 'codex') {
  const stub = process.env.AIGILE_ENGINE_STUB;
  if (stub) return require('fs').existsSync(stub) ? stub : '';   // a stub path with no file = "not installed" (tests)
  const X = ENGINES[name], has = require('./platform').has;
  return (X && (X.exes || (X.exe ? [X.exe] : [])).find(x => has(x))) || '';
}
const codexExe = () => engineExe('codex');

// Every engine follows the same rules as a Claude run (owner, AIG-402). Claude gets them from CLAUDE.md / CLAUDE.local.md, which
// point at WAYS-OF-WORKING.md; Codex and Gemini don't read those files by themselves, so the prompt names them.
// Gemini reads GEMINI.md by default, not AGENTS.md: there is no command-line flag for the context file, so the prompt names AGENTS.md too.
const WOW = path.join(__dirname, '..', 'WAYS-OF-WORKING.md');
const RULES = 'Follow the same rules as the Claude agents on this board. First read, and follow: ' + WOW + ', your project folder\'s CLAUDE.md and CLAUDE.local.md if they exist (the notes Claude agents get), and its AGENTS.md. ' +
  'Never run git push (or anything that publishes or deploys): commit locally only. Never add AI attribution or co-author lines to commits, and never mention AI tools in tracked files. ' +
  'Never force-push, rebase or reset. Do not open windows or start servers or processes outside the board. The board brief you are asked to run gives your profile. ' +
  // Onboarding (owner, AIG-801): a new engine forms a team of its own best models, as the Claude team did.
  'If your engine has no team on the roster yet, first follow the Onboarding steps in ' + path.join(__dirname, '..', 'docs', 'ENGINES.md') + ': form a team of your engine\'s best models, one per role. ';
const PREAMBLE = 'You are running through Codex. ' + RULES;
const PREAMBLE_GEMINI = 'You are running through Gemini CLI. ' + RULES;
const PREAMBLE_COPILOT = 'You are running through GitHub Copilot CLI. ' + RULES;
const PREAMBLE_CURSOR = 'You are running through Cursor CLI. ' + RULES;
const preambleFor = e => (e === 'gemini' ? PREAMBLE_GEMINI : e === 'copilot' ? PREAMBLE_COPILOT : e === 'cursor' ? PREAMBLE_CURSOR : PREAMBLE);

// AIG-1015: Google refuses the personal sign-in for Gemini CLI, so a Gemini run uses an API key. The key is kept like Mail's password
// (secrets.keep/kept, never listed or sent to the page). The user's own ~/.gemini/settings.json says oauth-personal and beats
// GEMINI_API_KEY, so the run gets GEMINI_CLI_HOME = a board-owned folder whose settings.json says gemini-api-key (HOME is untouched).
const GEMINI_KEY = 'gemini:apikey';
const geminiKey = () => { try { return require('./secrets').kept(GEMINI_KEY) || ''; } catch { return ''; } };
const geminiKeySet = () => { try { return require('./secrets').hasKept(GEMINI_KEY); } catch { return false; } };
const setGeminiKey = v => require('./secrets').keep(GEMINI_KEY, String(v || '').trim() || null);
function geminiEnv() {
  const fs = require('fs'), home = path.join(require('./store').DATA, 'gemini-home'), f = path.join(home, '.gemini', 'settings.json');
  if (!fs.existsSync(f)) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ security: { auth: { selectedType: 'gemini-api-key' } } }, null, 2)); }
  return { GEMINI_CLI_HOME: home, GEMINI_API_KEY: geminiKey() };
}

module.exports = { geminiKey, geminiKeySet, setGeminiKey, geminiEnv, ENGINES, ROLE_MODELS, roleModel, engineName, modelField, leadEntry, forProject, engineExe, codexExe, PREAMBLE, PREAMBLE_GEMINI, preambleFor };
