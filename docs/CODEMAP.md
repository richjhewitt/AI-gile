# Code map

Index of where things live. Detail per area is in `docs/codemap/*.md`; read only the area you touch. In each file, search for the `/* ---------- name ---------- */` markers rather than relying on line numbers.

## Run and test
- Server: `node server.js` (or `start-aigile.bat`) -> http://localhost:4321. `AIGILE_PORT` and `AIGILE_DATA` change the port and data folder; `AIGILE_DEV=1` adds the "new version, refresh" prompt.
- CLI: `node aigile.js help` (`AIGILE_URL` points it at another server; `AIGILE_AS` sets the author).
- QA: `node tools/qa/qa.mjs [area ...]` (no args = all; `--list` shows them; `QA_PORT`, default 4390). Own server on a temp folder, live board untouched. Runner, helpers, area files, AI tester: [qa.md](codemap/qa.md).

## Server ([server.md](codemap/server.md): files, API routes, local-only settings)
- `server.js`: http plumbing, `/api/*` dispatch, static files from `public/`
- `lib/routes.js` + `lib/routes/*.js`: every API route as `[method, regex, handler]`, grouped (shared requires in `ctx.js`)
- `lib/store.js`: config, load/save of `data/<slug>.json`, card rules, project order
- `lib/onboard.js`: connect a folder, permissions presets
- `lib/presence.js`: team presence, background runs, where a team runs, verbose log, 👁 Watch
- `lib/quiet.js`, `lib/watchman.js`: going quiet, 🌙 night watchman
- `lib/notokens.js`: ⛔ No Token Mode (one switch; `guard()` in every AI starter: presence.startTeam, tester, ask, usagecheck, watchman; `data/notokens.conf`; turns on at the usage limit, never off by itself; `aigile notokens on|off`)
- `lib/servers.js`: 🖥️ My servers (AIG-374): saved in aigile.local.json `servers`, Desktop `.lnk` finder, `open(name)` (only saved values; commands open in a visible `powershell -NoExit` window; `AIGILE_OPEN_STUB`, `AIGILE_DESKTOP` for tests); page: `openServerBtn` (core.js), Setup box in find-trial-setup-teams.js; QA `servers`
- `lib/standup.js`: stand-ups
- `lib/attachments.js`, `lib/logos.js`, `lib/avatars.js`: reply files, project/app logos, profile pictures
- `lib/dm.js`, `relay/relay.js`: private DMs and their relay; `lib/share.js`: sharing a project with a friend over them; `lib/ask.js`: ask a mate (a friend's question for my AI, AIG-210)
- `lib/limits.js`, `lib/usage.js`, `lib/usagecheck.js`: plan usage, tokens, check usage now
- `lib/trial.js`, `tools/trial/pretend-team.js`: 🧪 try it as a new user
- `lib/pretend.js`: 🧪 pretend friend (AIG-322): local relay + second board "Davy" (nl-BE) on free ports, invite swapped, stop keeps or wipes his data
- `lib/tester.js`: 🤖 AI tester runs
- `lib/dispatch.js`: who is woken for the owner's card or comment (rules, then Haiku)
- `aigile.js` (CLI entry) + `lib/cli/*.js` (core, help, command groups), `statusline.js`, `desktop/` (Electron)

## Page ([page.md](codemap/page.md): `public/`, classic scripts in one global scope, `app.js` last)
- `css/01..05-*.css` (linked in order from index.html); `js/core.js` (state, api, router, render); `js/format.js` (card text, md); `js/i18n.js` (languages)
- `js/home.js`, `js/board.js`, `js/card.js`, `js/dialogs/*.js`, `js/filters.js`, `js/attach.js`
- `js/inbox*.js` (state, top, items, tabs, page, actions, style, queue, ai)
- `js/dms.js` (DM chats), `js/share.js` (🔗 Share dialog, link offers in the inbox), `js/ask.js` (friends' questions in the inbox)
- `js/notokens.js` + `css/06-notokens.css`: the top-bar ⛔ switch; body class `notokens` hides AI buttons by CSS (add `.ai-only` or an onclick prefix to the list)
- `js/standup.js`, `js/usage-page.js`, `js/glossary.js`, `js/tour.js`, `js/night.js`, `js/leadquiz.js`
- `js/app.js`: start-up, 1s poll, going quiet

## Other areas
- Languages, `t()`, adding a string: [languages.md](codemap/languages.md)
- Data files, columns, stand-up card shape: [data.md](codemap/data.md)
