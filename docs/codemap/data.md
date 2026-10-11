# Code map: data

- `data/<slug>.json`: one file per project (cards, comments, team, log, `teamSeenAt`); written atomically via a `.tmp` file. Git-ignored.
- Board templates (AIG-170): the New project dialog (`boardTemplateNames` in dialogs.js) just PATCHes `columns` with names after create: Kanban = none, Scrum = names for the first four statuses, Your own = comma list in status order.
- A project's `columns` (AIG-116/118): per status `{ status, name?, emoji?, color?, hidden?, wip? }` in board order; `wip` is the card limit (0/empty = none), checked 0..999 in the PATCH route, drawn by `renderBoard`.
- A stand-up card (AIG-133) has `standup: { at, reports: [{ name, done, next, blockers, at }] }`; the CLI `standup` command fills `reports`.
- `data/limits.log`: one JSON line per plan usage change (or every 5 minutes).
- `data/logs/<slug>.log`: what the team's background runs printed.
- Presence ("heard from") and the running processes are in memory only.
