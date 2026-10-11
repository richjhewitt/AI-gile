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
- `lib/standup.js`: stand-ups
- `lib/attachments.js`, `lib/logos.js`, `lib/avatars.js`: reply files, project/app logos, profile pictures
- `lib/dm.js`, `relay/relay.js`: private DMs and their relay
- `lib/limits.js`, `lib/usage.js`, `lib/usagecheck.js`: plan usage, tokens, check usage now
- `lib/trial.js`, `tools/trial/pretend-team.js`: 🧪 try it as a new user
- `lib/tester.js`: 🤖 AI tester runs
- `aigile.js` (CLI entry) + `lib/cli/*.js` (core, help, command groups), `statusline.js`, `desktop/` (Electron)

## Page ([page.md](codemap/page.md): `public/`, classic scripts in one global scope, `app.js` last)
- `css/01..05-*.css` (linked in order from index.html); `js/core.js` (state, api, router, render); `js/format.js` (card text, md); `js/i18n.js` (languages)
- `js/home.js`, `js/board.js`, `js/card.js`, `js/dialogs/*.js`, `js/filters.js`, `js/attach.js`
- `js/inbox*.js` (state, top, items, tabs, page, actions, style, queue, ai)
- `js/standup.js`, `js/usage-page.js`, `js/glossary.js`, `js/tour.js`, `js/night.js`, `js/leadquiz.js`
- `js/app.js`: start-up, 1s poll, going quiet

## Other areas
- Languages, `t()`, adding a string: [languages.md](codemap/languages.md)
- Data files, columns, stand-up card shape: [data.md](codemap/data.md)
