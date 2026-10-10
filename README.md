# AI-gile

A lightweight, local kanban board for coordinating work with AI development teams across several projects.

AI-gile gives the project owner a live, at-a-glance view of every project. It also gives AI agents a simple command-line interface for picking up work, reporting progress and handing features back for acceptance. It has no dependencies, no build step and no database.

## Features

- **Portfolio view**: every project on one page, each with progress, column counts, its active team and a "Waiting on you" inbox.
- **Live board**: the page refreshes every second, so you can watch cards move as agents work. Anything you are typing is never overwritten.
- **Acceptance workflow**:
  - Finished features land in **For you to test** with test steps. The owner accepts them (they move to Done) or sends them back.
  - Any comment from the owner moves the card to **For the team**. The team reads it, then closes the card or reworks it.
- **Bug and feature intake**: raise bugs and requests straight from the board. Agents pick them up in priority order.
- **Team roster and decision log** for each project, so it's clear who is working on what and why decisions were made.
- **Agent CLI** (`aigile.js`): compact output designed to be read by language models.
- **Token usage**: totals per project and overall for the last 5 hours, today, 7 days and 30 days, split by model, read from the agents' local session logs.
- **Session hooks**: agents are told about new comments automatically, at no token cost when there is nothing new.

## Requirements

- Node.js 18 or later

## Quick start

```sh
node server.js
```

Open <http://localhost:4321>.

On Windows, `start-aigile.bat` starts the server if it isn't already running, then opens the board in your browser.

**Desktop app (optional, Electron):** the board in its own window with a taskbar icon. It starts the server if needed and leaves it running when closed.

```sh
cd desktop
npm install
npm run shortcut
```

`npm run shortcut` adds an AI-gile shortcut to the Desktop and Start menu. Don't run `npm start` from a VS Code terminal: VS Code sets `ELECTRON_RUN_AS_NODE`, so Electron starts as plain Node and quits.

The server only listens on `127.0.0.1`.

## Workflow

| Column | Meaning |
|---|---|
| Backlog | Ideas, not yet committed to |
| To do | Committed, ready to be picked up |
| In progress | Being worked on |
| Review | Being reviewed within the team |
| For you to test | Built and self-tested, waiting for the owner's acceptance |
| For the team | The owner has commented: the team reads it and acts |
| Done | Accepted, or closed once the team has read the comment |

Rules:
- Only the owner moves a feature to Done, by accepting it.
- The team may close a card from **For the team** once it has read the owner's comment.
- If the comment needs more work, the team reworks the card and hands it back for testing.

## For AI dev teams

Agents use the CLI from their own project folder:

```sh
node ../AI-gile/aigile.js help
node ../AI-gile/aigile.js updates <project>   # what the owner said since you last looked
node ../AI-gile/aigile.js next <project>      # what to work on, in priority order
node ../AI-gile/aigile.js test <project> <id> "1. Open ... 2. Click ..." --as <name>
node ../AI-gile/aigile.js standup <project> --done "..." --next "..." --blockers "none" --as <name>   # answer a 📣 Stand-up card
```

[AGENTS.md](AGENTS.md) covers:
- the full workflow;
- how `next` orders work;
- the rules for agents;
- a short snippet to paste into a project's agent notes.

### Session hooks

If your agent tool supports session hooks, run these commands so agents learn about new comments without polling:

| When | Command | Behaviour |
|---|---|---|
| Session start and each prompt | `node aigile.js updates <project> --hook` | Prints new activity; silent if there is none |
| Before the agent stops | `node aigile.js updates <project> --stop-hook` | Prints `{"decision":"block","reason":...}` once if there is unseen activity |

Activity is marked as seen when it is reported. The board shows the owner which comments the team has seen.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AIGILE_PORT` | `4321` | Server port |
| `AIGILE_DATA` | `./data` | Data directory |
| `AIGILE_URL` | `http://localhost:4321` | Server used by the CLI |
| `AIGILE_AS` | none | Default `--as` name for the CLI |
| `AIGILE_USAGE_DIR` | none | Folder of agent session logs (JSONL, one subfolder per project) for token usage. Can also be set as `usageDir` in `aigile.local.json`, which is kept out of git |
| `AIGILE_OWNER` | Rich | Your name: the person the board and its teams work for. Can also be set as `owner` in `aigile.local.json` |
| `AIGILE_DEV` | off | Prompt open pages to refresh after each new build |

## Data

- Each project is stored as one readable JSON file in `data/<slug>.json`.
- Writes are atomic: the server writes a temporary file, then renames it.
- The data directory is excluded from git, so back it up separately if you need history.

## HTTP API

All endpoints take and return JSON.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects[?all=1]` | Project summaries (`all` includes archived projects) |
| POST | `/api/projects` | Create a project: `{name, key?, path?, description?}` |
| GET, PATCH | `/api/projects/:slug` | Read a project, or update `name`, `description`, `path`, `key`, `archived` or `views` (saved filter views, `[{name, filters}]`, max 20) |
| POST | `/api/projects/:slug/cards` | Create a card |
| PATCH, DELETE | `/api/projects/:slug/cards/:id` | Update or delete a card |
| POST | `/api/projects/:slug/cards/:id/comments` | Add a comment: `{author, text, needsYou?}` |
| POST | `/api/projects/:slug/cards/:id/verdict` | Accept or send back: `{accept, text}` |
| POST | `/api/projects/:slug/wake` | Start the team in the background (no window); also started by Rich's comments, send-backs, pokes and new cards |
| POST | `/api/projects/:slug/restart` | Kill the team's background run and start a fresh one |
| GET | `/api/projects/:slug/agentlog` | `{text}`: the end of what the background run printed |
| GET | `/api/projects/:slug/file?path=` | `{name, text}`: any `.md` file inside the project folder (relative, project-folder-prefixed or absolute path; `/` or `\`); 400 if not `.md`, 404 if missing or outside |
| POST, DELETE | `/api/projects/:slug/cards/:id/snooze` | Wait and see: hide a card in For you to test for an hour (`snoozedUntil`); DELETE brings it back |
| POST | `/api/projects/:slug/team` | Add or update a team member: `{name, model?, role?, task?, status?}` |
| POST | `/api/projects/:slug/log` | Add a log entry: `{author, text, kind: "log" \| "decision"}` |
| GET | `/api/projects/:slug/updates[?mark=1]` | Owner activity since the team last looked |
| GET | `/api/inbox` | Everything waiting on the owner, across all projects |
| GET | `/api/meta` | Allowed statuses, types and priorities |

## Project layout

```
server.js          HTTP plumbing and wiring
lib/               Server logic: store, routes, onboard, presence, limits, usage
public/index.html  Web board shell (no framework)
public/styles.css  Board styles
public/js/         Page scripts (core, board, card, dialogs, filters, format, inbox, usage)
tools/qa/          QA script: node tools/qa/qa.mjs [area]
docs/CODEMAP.md    Where everything lives
aigile.js          CLI for agents
AGENTS.md          Guide for AI dev teams
start-aigile.bat   Windows launcher
data/              Board data (not in git)
```
