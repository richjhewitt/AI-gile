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

Next: fill this table in from Codex's first real team run, then map the same rows for each new provider.
