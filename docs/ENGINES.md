# Engines: onboarding other AI providers

Claude, Codex, Gemini, GitHub Copilot and Cursor can all run board work (lib/engines.js). Every engine gets the same rules: the prompt preamble (`RULES`) points it at WAYS-OF-WORKING.md, CLAUDE.md / CLAUDE.local.md and AGENTS.md.

## Onboarding (the handshake)

On its first run on a board, a new engine's lead:

- Reads WAYS-OF-WORKING.md and AGENTS.md, like a Claude lead

- Forms a team from its engine's best models, one per role, like the Claude team: Lead, Frontend, Backend, QA, Reviewer

- Uses the cheapest model that fits each role (small jobs on a small model, reviews on the strongest)

- Puts each member on the roster: `aigile team <proj> NAME --role "Frontend" --model "<its model>" --status "💤 idle"`

- Logs the team it picked: `aigile log <proj> "Codex team: ..." --decision --as NAME`

## What each engine gives us

| | Claude | Codex | Gemini |
|---|---|---|---|
| Background run | `claude -p` | `codex exec --json` | `gemini -p --yolo` | `copilot -p --allow-all --no-ask-user --output-format=json` | `agent --print --force --trust --output-format stream-json` |
| Reads by itself | CLAUDE.md | AGENTS.md | GEMINI.md | not relied on: the prompt names the rules | not relied on: the prompt names the rules |
| Sub-agents | Agent tool | none in `exec`: the board starts each member as its own run | none: same as Codex | none: same | none: same |
| Asks before acting | no (permission mode) | no (sandbox off, AIG-402) | no (`--yolo`) | no (`--allow-all`, `--no-ask-user`) | no (`--force`; `--trust` skips the workspace prompt) |

## Gemini sign-in: an API key (AIG-1015)

Google refuses the personal sign-in for Gemini CLI now (`IneligibleTierError`, "migrate to Antigravity"), so a Gemini run uses an API key. Setup > Your main team > **Gemini API key** (masked box, link to https://aistudio.google.com/apikey, "Saved" / "Not set"): `GET /api/gemini-key` answers only `{set}`, `POST` (owner, secrets page token) saves, an empty key removes. The key is kept with `secrets.keep/kept` (`gemini:apikey`, DPAPI or AES, `data/secrets/kept.json`), never sent to the page or logged.

A Gemini run (`launch` in lib/presence.js) gets `GEMINI_API_KEY` and `GEMINI_CLI_HOME=data/gemini-home`. The folder holds `.gemini/settings.json` = `{"security":{"auth":{"selectedType":"gemini-api-key"}}}`, because the user's own `~/.gemini/settings.json` (`oauth-personal`) otherwise beats the key; HOME and USERPROFILE are not touched. Claude, Codex, Copilot and Cursor runs never get these. With no key saved the run does not start: one board comment, "Gemini needs an API key: Setup -> Gemini API key". Headless also needs `--skip-trust` (already in the args).

## Copilot and Cursor (AIG-971, AIG-973)

Checked 2026-10-14. Engine `copilot` (exe `copilot`) and `cursor` (exe `agent`, else `cursor-agent`); the model per roster entry is `copilotModel` / `cursorModel`, empty = the engine default. Neither is installed on the dev PC, so none of this has run for real.

Confirmed in the docs:
- Copilot: `-p` runs a prompt non-interactively; `--allow-all` (alias `--yolo`) = all tools, paths and URLs; `--allow-all-tools`; `--no-ask-user`; `--model=MODEL`; `--output-format=json` (JSONL, one record per line); `-s` silences stats. Sources: docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference and .../how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically.
- Cursor: `-p, --print`; `--output-format text|json|stream-json` (print only); `-f, --force` (alias `--yolo`): without it changes are only proposed; `--trust` (headless only); `--model <model>` (long form only); `--list-models` / `agent models`. Stream-json events: system init, user, assistant, tool_call started/completed, result. Sources: cursor.com/docs/cli/reference/parameters, /docs/cli/reference/output-format, /docs/cli/headless.

Check on first real run:
- Copilot: the JSON event types of a `-p` run are not documented (only the workflow result is), so the reader is tolerant and shows plain text, assistant text, tool names and errors; that `-p` accepts `--output-format=json` together with `--allow-all`; and the exact exe name on Windows.
- Cursor: whether the exe is `agent` or `cursor-agent` on this PC (both are tried); login (`agent login` or `CURSOR_API_KEY`).
- Role models: the docs name no ids to map per role (Copilot only shows `gpt-5.4`, `claude-haiku-4.5`, `gpt-5.3-codex` as examples; Cursor says run `agent models`), so ROLE_MODELS has no copilot / cursor column and the engine default is used.

Cursor terms: the CLI docs present print mode as meant for "scripts, CI pipelines, or automation" (cursor.com/docs/cli/overview, cursor.com/help/integrations/cli) and recommend `CURSOR_API_KEY` for non-interactive use (cursor.com/docs/account/enterprise/service-accounts; service accounts are an Enterprise feature). Use through the official CLI or SDK is the supported route; calling Cursor's private endpoints another way, or giving third parties use of your account, is not (Use Restrictions in cursor.com/terms-of-service, section 1.5 as cited by Cursor staff on forum.cursor.com). Read the terms before running it unattended on a shared or business account.

## A ready-made model per team role (AIG-1007)

One table, `ROLE_MODELS` in lib/engines.js; Setup > Your main team shows it next to each role for the engine picked there, and a Codex or Gemini roster entry with a role and no model gets its role's one. Strong model for Lead and Reviewer, mid for Frontend, Backend and Tester, small for QA, Quick fix and Docs. Checked 2026-10-14 against the official docs; '' would mean the engine's own default.

| Role | Claude | Codex (`-m`) | Gemini (`-m`) |
|---|---|---|---|
| Lead, Reviewer | Opus | `gpt-6-astra` | `gemini-3.1-pro-preview` |
| Frontend, Backend, Tester | Sonnet | `gpt-6-sol` | `gemini-3.8-flash` |
| QA, Quick fix, Docs | Haiku | `gpt-6-luna` | `gemini-3.5-flash-lite` |

Sources: Codex ids from learn.chatgpt.com/docs/models (developers.openai.com/codex/models redirects there); Gemini ids from geminicli.com/docs/reference/configuration, checked against ai.google.dev/gemini-api/docs/models. The Gemini Pro id is a preview (no stable Pro id is listed); `gpt-6.1-sol` is a newer mid model but its rollout is limited, so the broadly available `gpt-6-sol` is used.

Next: fill this table in from Codex's first real team run, then map the same rows for each new provider.
