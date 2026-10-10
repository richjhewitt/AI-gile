# Code map

Where everything lives, so you can go straight to the right place. Search for the `/* ---------- name ---------- */` markers in each file rather than relying on line numbers.

## Run and test
- Server: `node server.js` (or `start-aigile.bat`) -> http://localhost:4321. `AIGILE_PORT` and `AIGILE_DATA` change the port and data folder; `AIGILE_DEV=1` adds the "new version, refresh" prompt.
- CLI: `node aigile.js help` (`AIGILE_URL` points it at another server; `AIGILE_AS` sets the author).
- QA: `node tools/qa/qa.mjs [area ...]` (no args = all; `--list` shows them; `QA_PORT` changes the port, default 4390). It starts its own server on a temp data folder with a stub agent program, so the live board is never touched. Areas: `api`, `cli`, `board`, `card`, `filters`, `inbox`, `usage`, `presence`, `quiet`, `quietinbox`, `poke`, `docs`, `mdlinks`, `newproject`. The page areas need playwright (`cd tools/qa && npm i`; `node_modules` is git-ignored).

## Server
| File | What |
|---|---|
| `server.js` | Wiring and http plumbing: dev build id, route dispatch (`/api/*`), static files from `public/`, JSON errors |
| `lib/store.js` | Config paths and port; `load`/`save` of `data/<slug>.json`; `localSettings`; `summary` (project card on the home page); `attention` (needs a poke: asleep with work, or stuck); card rules (`cleanCard`, `toTeam`, `findCard`, `docList`, `bad`/`need`) |
| `lib/routes.js` | Every API route as `[method, regex, handler]`; see the markers: projects, cards, comments/verdicts/tasks/pokes, team/log/updates feed, docs (incl. `/file`) and inbox |
| `lib/onboard.js` | `connectFolder`: marked notes block, merged comment hooks and team permissions, git init for a new folder, git exclude |
| `lib/presence.js` | Team presence (`heard`, `presenceOf`, `heardFromFolder`) and the background runner: `startTeam`/`nudge` (agent command run hidden in the project folder, log in `data/logs/<slug>.log`, one run per team), `restartTeam`, `logTail` |
| `lib/quiet.js` | Going quiet: `setQuiet` (📣 card to every team with open work, starts sleeping ones, night mode file `data/quiet.state`), `quietSince` |
| `lib/limits.js` | `recordLimits` / `limitsHistory` for the plan usage log |
| `lib/usage.js` | Token usage per project, read from the agents' local session logs |
| `aigile.js` | The CLI: `HELP` text, arg parsing, `api()`, `nextList` (what to work on), then one function per command under "commands" |
| `statusline.js` | Status line script that posts plan usage and the session folder to `/api/limits` |

## Page (`public/`)
`index.html` is the shell only. The scripts are classic scripts sharing one global scope, loaded in this order (`app.js` last):
| File | What |
|---|---|
| `styles.css` | All styles: tokens, Portfolio, Board, Card detail panel, buttons and forms, phones |
| `js/usage-page.js` | The `#/usage` page (charts are hand-written SVG) |
| `js/inbox.js` | Top-bar inbox button, the `#/inbox` page, alerts; self-contained |
| `js/core.js` | `state`, `api`, `esc`, `ago`, the router (`parseRoute`), `busy`/`refresh`/`render` (the 1s poll never wipes typing), `slug`/`curCard`/`setErr` |
| `js/format.js` | Card text: `withCode`, `spaceBullets`, `linkify`, `.md` links (`mdLinks`, opened by `showDocPath` in dialogs.js); `md` (Docs renderer) |
| `js/filters.js` | Search and filter bar |
| `js/home.js` | Home page: `renderHome`, project bars, usage strip |
| `js/board.js` | In flight and presence, `renderBoard`, `cardHtml`, `poke`, drag and drop |
| `js/card.js` | `cardFields`, assignee select, `renderCard` (Reply/Details/Test tabs), edit/delete/reply/verdict |
| `js/dialogs.js` | `openDialog`, New card, New project, Connect folder, Docs |
| `js/app.js` | Start-up: hashchange, the 1s poll, the new-build prompt; going quiet (`goQuiet`, `setNight` night theme); `pokeBadge` (top bar) |

## Data
- `data/<slug>.json`: one file per project (cards, comments, team, log, `teamSeenAt`); written atomically via a `.tmp` file. Git-ignored.
- `data/limits.log`: one JSON line per plan usage change (or every 5 minutes).
- `data/logs/<slug>.log`: what the team's background runs printed.
- Presence ("heard from") and the running processes are in memory only.

## API routes
All in `lib/routes.js` (patterns are the regexes there). The list with payloads is in the README's API table. Unknown `/api/*` paths return 404 JSON from `server.js`.

## Local-only settings
`aigile.local.json` (git-ignored; values are machine-specific):
- `usageDir`: folder of the agents' session logs (`AIGILE_USAGE_DIR` overrides).
- `globalSettingsFile`: the agent's global settings file, used to show how to switch the status line on.
- `agent.command`: program background runs start (one `*` path segment allowed; `AIGILE_AGENT_COMMAND` overrides).
- `agent.notesFile`, `agent.settingsFile`: file names `onboard` writes in a project folder.
