# Engines: onboarding other AI providers

Claude, Codex and Gemini can all run board work (lib/engines.js). Every engine gets the same rules: the prompt preamble (`RULES`) points it at WAYS-OF-WORKING.md, CLAUDE.md / CLAUDE.local.md and AGENTS.md.

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
| Background run | `claude -p` | `codex exec --json` | `gemini -p --yolo` |
| Reads by itself | CLAUDE.md | AGENTS.md | GEMINI.md |
| Sub-agents | Agent tool | none in `exec`: the board starts each member as its own run | none: same as Codex |
| Asks before acting | no (permission mode) | no (sandbox off, AIG-402) | no (`--yolo`) |

## A ready-made model per team role (AIG-1007)

One table, `ROLE_MODELS` in lib/engines.js; Setup > Your main team shows it next to each role for the engine picked there, and a Codex or Gemini roster entry with a role and no model gets its role's one. Strong model for Lead and Reviewer, mid for Frontend, Backend and Tester, small for QA, Quick fix and Docs. Checked 2026-10-14 against the official docs; '' would mean the engine's own default.

| Role | Claude | Codex (`-m`) | Gemini (`-m`) |
|---|---|---|---|
| Lead, Reviewer | Opus | `gpt-6-astra` | `gemini-3.1-pro-preview` |
| Frontend, Backend, Tester | Sonnet | `gpt-6-sol` | `gemini-3.8-flash` |
| QA, Quick fix, Docs | Haiku | `gpt-6-luna` | `gemini-3.5-flash-lite` |

Sources: Codex ids from learn.chatgpt.com/docs/models (developers.openai.com/codex/models redirects there); Gemini ids from geminicli.com/docs/reference/configuration, checked against ai.google.dev/gemini-api/docs/models. The Gemini Pro id is a preview (no stable Pro id is listed); `gpt-6.1-sol` is a newer mid model but its rollout is limited, so the broadly available `gpt-6-sol` is used.

Next: fill this table in from Codex's first real team run, then map the same rows for each new provider.
