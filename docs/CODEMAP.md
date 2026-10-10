# Code map

Where everything lives, so you can go straight to the right place. Search for the `/* ---------- name ---------- */` markers in each file rather than relying on line numbers.

## Run and test
- Server: `node server.js` (or `start-aigile.bat`) -> http://localhost:4321. `AIGILE_PORT` and `AIGILE_DATA` change the port and data folder; `AIGILE_DEV=1` adds the "new version, refresh" prompt.
- CLI: `node aigile.js help` (`AIGILE_URL` points it at another server; `AIGILE_AS` sets the author).
- QA: `node tools/qa/qa.mjs [area ...]` (no args = all; `--list` shows them; `QA_PORT` changes the port, default 4390). It starts its own server on a temp data folder with a stub agent program, so the live board is never touched. Areas: `api`, `cli`, `board`, `card`, `filters`, `inbox`, `usage`, `presence`, `quiet`, `quietinbox`, `poke`, `blocked`, `docs`, `mdlinks`, `newproject`, `perms`, `gobutton`, `attach`, `refresh`, `look`, `guard`, `owner`, `setup`, `update`, `foryou`, `popout`, `columns`, `cardview`, `wip`, `lanes`, `quick`, `standup`, `views`, `steps`, `fynext`, `theme`, `chats`, `discover`, `dms`, `openit`. The page areas need playwright (`cd tools/qa && npm i`; `node_modules` is git-ignored).

## Server
| File | What |
|---|---|
| `server.js` | Wiring and http plumbing: dev build id, route dispatch (`/api/*`), static files from `public/`, JSON errors |
| `lib/store.js` | Config paths and port; `load`/`save` of `data/<slug>.json`; `localSettings`; `summary` (project card on the home page); `attention` (needs a poke: asleep with work, or stuck); card rules (`cleanCard`, `toTeam`, `findCard`, `docList`, `bad`/`need`) |
| `lib/routes.js` | Every API route as `[method, regex, handler]`; see the markers: projects, cards, comments/verdicts/tasks/pokes, team/log/updates feed, docs (incl. `/file`) and inbox |
| `lib/onboard.js` | `connectFolder`: marked notes block, merged comment hooks and default team permissions, git init for a new folder, git exclude; `getPermissions`/`setPermissions` and the `PRESETS` ticks for the 🔐 Permissions dialog |
| `lib/presence.js` | Team presence (`heard`, `presenceOf`, `heardFromFolder`) and the background runner: `startTeam`/`nudge` (agent command run hidden in the project folder, log in `data/logs/<slug>.log`, one run per team), `restartTeam`, `logTail` |
| `lib/quiet.js` | Going quiet: `setQuiet` (📣 card to every team with open work, starts sleeping ones, night mode file `data/quiet.state`), `quietSince` |
| `lib/standup.js` | Stand-ups (AIG-133..135): `callStandup` (📣 card with `standup: { at, reports }` in each chosen team's For the team, wakes sleeping teams, skips a project that already has an open one), `reportStandup` (one member's done / next / blockers, replaces their earlier answer, says who is left), `standupReport` (newest stand-up per project, people, and the real blockers) |
| `lib/attachments.js` | Files attached to replies (AIG-77): `saveAttachment` (base64 upload, 10 MB), `attachmentsFor` (checks a comment's ids), `fileOf`; stored in `data/attachments/<slug>/` |
| `lib/dm.js` | Private DMs (AIG-110, design in `docs/DMS-DESIGN.md`): `identity` (X25519 + Ed25519 keys and a random mailbox id in `data/keys/identity.json`), settings (`on`, `relay`), contacts, invites (`createInvite`/`acceptInvite`, the sealed hello), `safetyCode` (6 words), `seal`/`receive` (ephemeral X25519 + HKDF-SHA256 + AES-256-GCM, Ed25519 signature; failures kept as not verified), the outbox (`flush`), `poll` (signed collect + ack, every `AIGILE_DM_POLL_MS`, default 4s, only while on) |
| `relay/relay.js` | The DM relay (AIG-112): standalone, zero deps, run on a server. Mailboxes of sealed envelopes in `RELAY_DATA/<box>/`; POST drops one, a signed GET collects, a signed POST `/ack` deletes; first signed collect claims a mailbox; replay guard (timestamp + nonce), 12 MB limit, per-IP rate limit, 7-day expiry |
| `lib/limits.js` | `recordLimits` / `limitsHistory` for the plan usage log |
| `lib/usage.js` | Token usage per project, read from the agents' local session logs |
| `aigile.js` | The CLI: `HELP` text, arg parsing, `api()`, `nextList` (what to work on), then one function per command under "commands" |
| `statusline.js` | Status line script that posts plan usage and the session folder to `/api/limits` |
| `desktop/` | Optional Electron app: `main.js` starts the server if it's down and shows the board in one window (outside links open in the browser); `make-shortcut.ps1` adds Desktop/Start menu shortcuts; `icon.png`/`icon.ico`, and `icon-waiting.png` (purple diamond) while anything waits on Rich (the page title count) |

## Page (`public/`)
`index.html` is the shell only. The scripts are classic scripts sharing one global scope, loaded in this order (`app.js` last):
| File | What |
|---|---|
| `styles.css` | All styles: tokens, Portfolio, Board, Card detail panel, buttons and forms, phones |
| `js/usage-page.js` | The `#/usage` page (charts are hand-written SVG) |
| `js/inbox.js` | Top-bar inbox button, the `#/inbox` page, alerts; self-contained |
| `js/core.js` | `state`, `api`, `esc`, `ago`, the router (`parseRoute`), `busy`/`refresh`/`render` (the 1s poll never wipes typing), `slug`/`curCard`/`setErr` |
| `js/format.js` | Card text: `withCode`, `spaceBullets`, `linkify`, `.md` links (`mdLinks`, opened by `showDocPath` in dialogs.js); `md` (Docs renderer) |
| `js/attach.js` | `Attach`: 📎 button, paste-a-screenshot and pending chips for any reply box (card and inbox), `upload` on send, `shown` thumbnails under comments |
| `js/filters.js` | Search and filter bar; saved views (`viewsDialog`, `applyView`; stored on the project, last one used in localStorage) |
| `js/home.js` | Home page: `renderHome`, project bars, usage strip |
| `js/standup.js` | Stand-ups: `callStandup` (📣 buttons on the board and home), `standupButtons`, the `#/standups` report page (`renderStandups`, blockers first), the once-a-day `morningPrompt` pill (`suPick` to choose projects; day saved in localStorage `aigile.standupAsked`) |
| `js/board.js` | In flight and presence, `renderBoard`, swimlanes (`lanesOf`, `columnsHtml`), `cardHtml`, `poke`, drag and drop |
| `js/card.js` | `cardFields`, assignee select, `renderCard` (Reply/Details/Test tabs), edit/delete/reply/verdict |
| `js/dialogs.js` | `openDialog`, New card, New project, Connect folder, Docs |
| `js/app.js` | Start-up: hashchange, the 1s poll, the new-build prompt; going quiet (`goQuiet`, `setNight` night theme); `pokeBadge` (top bar) |

## Data
- `data/<slug>.json`: one file per project (cards, comments, team, log, `teamSeenAt`); written atomically via a `.tmp` file. Git-ignored.
- A project's `columns` (AIG-116/118): per status `{ status, name?, emoji?, color?, hidden?, wip? }` in board order; `wip` is the card limit (0/empty = none), checked 0..999 in the PATCH route, drawn by `renderBoard`.
- A stand-up card (AIG-133) has `standup: { at, reports: [{ name, done, next, blockers, at }] }`; the CLI `standup` command fills `reports`.
- `data/limits.log`: one JSON line per plan usage change (or every 5 minutes).
- `data/logs/<slug>.log`: what the team's background runs printed.
- Presence ("heard from") and the running processes are in memory only.

## API routes
All in `lib/routes.js` (patterns are the regexes there). The list with payloads is in the README's API table. Unknown `/api/*` paths return 404 JSON from `server.js`. A handler may return a promise (the DM routes talk to the relay).
- DMs: `GET /api/dms` (on, relay, mailbox, contacts, lastPoll), `POST /api/dms/settings` `{on?, relay?}`, `POST /api/dms/poll`, `POST /api/dms/invites` `{name?}`, `POST /api/dms/accept` `{code, name}`, `GET /api/dms/contacts`, `PATCH`/`DELETE /api/dms/contacts/:id` (`{name?, checked?, blocked?}`), `GET`/`POST /api/dms/contacts/:id/messages` (`{text}`), `GET /api/dms/contacts/:id/messages/:mid/raw` (what the relay sees).

## Local-only settings
`aigile.local.json` (git-ignored; values are machine-specific):
- `usageDir`: folder of the agents' session logs (`AIGILE_USAGE_DIR` overrides).
- `globalSettingsFile`: the agent's global settings file, used to show how to switch the status line on.
- `agent.command`: program background runs start (one `*` path segment allowed; `AIGILE_AGENT_COMMAND` overrides).
- `agent.notesFile`, `agent.settingsFile`: file names `onboard` writes in a project folder.
- `dmRelay`: default DM relay address (`AIGILE_RELAY` overrides; `POST /api/dms/settings` can set one too).
- `owner`: the board's human, whose comments wake teams and who gets questions and tests (default Rich; `AIGILE_OWNER` overrides). Code calls this person `isRich()` / `me()`.
