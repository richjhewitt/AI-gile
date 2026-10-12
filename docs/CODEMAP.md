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
- `lib/quiet.js`, `lib/watchman.js`: going quiet, 🌙 night watchman and the 🧭 Lead Scrum Master's chat and agent run
- `lib/scrummaster.js`: 🧭 Lead Scrum Master by day (AIG-359, `docs/SCRUM-MASTER.md`): launch, plain-code day rounds, 💡 idea sorting, digest, daily AI-run cap
- `lib/notokens.js`: ⛔ No Token Mode (one switch; `guard()` in every AI starter: presence.startTeam, tester, ask, usagecheck, watchman; `data/notokens.conf`; turns on at the usage limit, never off by itself; `aigile notokens on|off`)
- `lib/assumptions.js`: 🌙 Assumptions log (AIG-477): comments marked `assume` (or starting "Assumption:") across projects; `aigile assume`; page `js/assumptions.js` (`#/assumptions`); QA `assumptions`
- `public/js/whatsnew.js` + `public/releases.json`: ✨ What's new (AIG-562): `#/whats-new` lists release notes; a note once after an update (localStorage `aigile.seenRelease`); notes written by `aigile release-notes` (cmds-team.js, `AIGILE_RELEASES` for tests); QA `whatsnew`; ↩ roll back (AIG-563): `lib/rollback.js` (`/api/rollback`, pin in data/rollback.pin, plain clones only), QA `rollback`
- `lib/servers.js`: 🖥️ My servers (AIG-374): saved in aigile.local.json `servers`, Desktop `.lnk` finder, `open(name)` (only saved values; commands open in a visible `powershell -NoExit` window; `AIGILE_OPEN_STUB`, `AIGILE_DESKTOP` for tests); page: `openServerBtn` (core.js), Setup box in find-trial-setup-teams.js; QA `servers`
- `lib/terminal.js`: ⌨ the built-in terminal (AIG-471): servers with an ssh address (Setup kind `ssh`, `servers.terminals()`), node-pty (optional, root package.json), one session per server task, SSE out / JSON in under `/api/terminal/*` (page token + loopback; off with `AIGILE_NO_TERMINAL` on trial and pretend boards), ▶ runs with exit-status markers, transcript in `data/terminal/` (`aigile termlog`); page `js/terminal.js` + `css/09-terminal.css` (`#/pop-term/…`); `AIGILE_TERM_LOCAL` = a local shell for tests; QA `terminal`
- Checklist and waits for (AIG-406): card fields `checklist` (`[{text, done, by, at}]`) and `waitsFor` (ids, same project; the reverse is `holds`, kept in step). `store.js` `deriveWaits`/`popWaits` work out `c.waiting` on every load/save and pop a card back (bump, wake a team card) when its blockers are done; route `POST /cards/:id/check` ticks; CLI `check`, `wait-for`, `test --check`; page `checkChip`/`waitChip`/`acceptSure` (core.js), panel in card.js; QA `checklist`
- `lib/standup.js`: stand-ups
- `lib/attachments.js`, `lib/logos.js`, `lib/avatars.js`: reply files, project/app logos, profile pictures
- `lib/dm.js`, `relay/relay.js`: private DMs and their relay; `lib/share.js`: sharing a project with a friend over them; `lib/ask.js`: ask a mate (a friend's question for my AI, AIG-210)
- `lib/pack.js`: the AIGILE pack (AIG-357, `docs/HANDOFF.md`): a card for an outside chat AI and its reply pasted back
- `lib/expertteams.js` + `profiles/expert-teams.json` (AIG-577..579): premade expert teams (8 templates, roles by profile id with model and job, starter cards, done bullets); usage estimate baseline from `_runs.jsonl`; `GET /api/expert-teams`, `POST /api/projects/:slug/expert-team`; page `js/dialogs/expert-teams.js` (in the 👥 Team dialog); QA `experts`
- `lib/secrets.js` + `lib/cli/cmds-secrets.js` + page `js/dialogs/secrets.js` (AIG-585..587): 🔑 secrets an agent asks for on a card (`aigile secret ask|run`), pasted in a masked box, DPAPI-encrypted (AES key file with `AIGILE_SECRETS_DIR`) in `data/secrets/`, handed over as a one-use grant file, output masked; Setup > Secrets lists names only; QA `secrets`
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
- `js/dms.js` (DM chats), `js/share.js` (🔗 Share dialog, link offers in the inbox), `js/share-board.js` (a friend's shared project as its own board, `#/shared/<link>`), `js/ask.js` (friends' questions in the inbox), `js/pack.js` (📤 Copy for another AI / 📥 Paste the reply on a card)
- `js/notokens.js` + `css/06-notokens.css`: the top-bar ⛔ switch; body class `notokens` hides AI buttons by CSS (add `.ai-only` or an onclick prefix to the list)
- `js/standup.js`, `js/usage-page.js`, `js/glossary.js`, `js/tour.js`, `js/help.js` (AIG-345: help levels, ❓ Help menu, first-run offer, 🎓 Agile intro slides from `GET /api/intro`; QA `helplevels`), `js/night.js`, `js/leadquiz.js`
- `js/topbar.js` + `css/10-topbar.css`: Setup box and apply of the top bar buttons (AIG-575/576: on/off, order, left/right, theme colour, reset; localStorage `aigile.topbar`; QA `topbar`)
- `js/app.js`: start-up, 1s poll, going quiet

## Other areas
- Languages, `t()`, adding a string: [languages.md](codemap/languages.md)
- Data files, columns, stand-up card shape: [data.md](codemap/data.md)
