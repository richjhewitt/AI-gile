# AGENTS.md: using the AI-gile board

AI-gile is Rich's kanban board at http://localhost:4321. It is how you and Rich talk about work: he raises bugs and features there, you pick them up, and you hand finished features back for him to test. It replaces the `BOARD.local.md` file each team keeps (sprints, team roster, "Needs Rich", "Decisions made while you were away"). Until your project is fully moved over, treat the board as the source of truth and `BOARD.local.md` as history.

You talk to it with one command, from your own project folder:

```
node "../AI-gile/aigile.js" <command> <project> ...
```

(Adjust the path to where AI-gile lives.) `<project>` is the slug, name or key, any case. Run `help` for the full list. If it says "AI-gile isn't running", tell Rich; don't start a second server. Set `AIGILE_AS=YourName` once per session to skip `--as`.

## The workflow

**1. Start of every session** (if the project has the AI-gile hooks installed, `updates` runs automatically)

```
aigile brief <proj>              # the whole picture in one short call. Use this instead of reading BOARD.local.md
aigile updates <proj>            # what Rich commented on or raised since you last looked
aigile inbox                     # what is waiting on Rich (read-only context)
aigile next <proj>               # what you should work on
aigile show <proj> <id>          # full card including the conversation. Always read it before starting.
```

Rich's comments on a card are instructions. Read them.

**2. Keep the team roster current.** One entry per team member, including you:

```
aigile team <proj> Pixel --role "Frontend" --model Sonnet --task "AIG-5 new card form" --status "🔄 working"
```

Status key: 🔄 working · 👀 in review · ✅ accepted · 🔁 sent back · 💤 idle. Update it when your task changes and set 💤 when you stop. Retired members: set the status to `💤 retired` and they drop off the board.

**3. Move cards as you go.** Pick a card, then `aigile move <proj> <id> doing` (and `assign` it to yourself if it has no assignee). Use `review` when someone on your team is reviewing it. Use `comment` for progress and findings that Rich or the next agent should see. Add cards for work you discover: `aigile add <proj> "title" --type bug --priority high --status todo --desc "..."`.

**Leads launching agents:** record each one with `aigile start <proj> <id> --as <AgentName>` (assigns the card, moves it to `doing`, sets the roster task). That is what shows Rich the "In flight" line. When the agent finishes, hand over with `test`, or `move` it on.

**Leads: stay reachable while idle.** Hooks only fire while a session is busy. When you finish a turn with nothing running, start `node "../AI-gile/aigile.js" wait <proj>` as a background command. It costs nothing while waiting and ends with Rich's comments as soon as he posts, which wakes you. Act on them, then start it again.

**Roles on cards.** Rich may assign a card to a role instead of a person: `Lead (Opus)`, `Reviewer (Opus)`, `Frontend (Sonnet)`, `Backend (Sonnet)`, `QA (Haiku)`, `Quick fix (Haiku)` or `Docs (Haiku)`. The lead launches an agent of that kind and model for it, and the agent's `aigile start ... --as <its name>` replaces the role with its name. Use the cheapest model that fits.

**Questions for Rich go on the board, not in chat:** `aigile ask <proj> <id> "question (with your assumption)" --as <name>`. If there's no card for it, `add` one first.

**4. Hand features to Rich with `test`.** Don't move your own work to `done`; Rich does, by accepting it. When you have built and self-tested a feature:

```
aigile test <proj> <id> "1. Open http://localhost:4321
2. Click X
3. You should see Y" --as YourName
```

This moves the card to `verify` ("For you to test"), stores the steps and adds a comment. Write steps Rich can follow cold, in under a minute, with the expected result. He will either accept (done) or send it back with a reason (it returns to `doing` with his comment).

**Show your proof** so Rich can accept at a glance: add `--commit <sha>` (the board itself reads that commit in the project folder and shows what changed, folded, with a GitHub link when there is one: it costs you no tokens) and `--shot a.png,b.png` for screenshots of the result.

If there is a page to look at, add `--open http://localhost:5173/the/page` (and `--start "npm run dev"` if the app has to be started first, run in the project folder). The card then gets a **▶ Open it** button: it starts the app if the page doesn't answer yet (Rich confirms the command), waits for it, and opens the page in his browser.

**AI tester.** When tests pile up in Rich's For you, the lead can launch a cheap tester agent (Sonnet: Haiku proved unreliable; `--as "Tester (Sonnet)"`) with `docs/TESTER.md` as its brief. It checks each test in a sandbox and posts `aigile checked <proj> <id> pass|fail|skip "what it saw" --shot a.png`. Passed ones get a 🤖 chip and evidence on the card, and Rich clears them with **Accept all AI-passed**. Failed ones come back to you. Write steps a tester can follow too: name the exact button text.

**5. `ask` when you are blocked on Rich.**

```
aigile ask <proj> <id> "Should exports include archived items? I'm assuming no." --as YourName
```

This flags the card NEEDS-RICH and puts it in his inbox. Your question gets one-click answer buttons in his chat: a plan ending in **GO?** gets Go / Not yet, a yes/no question gets Yes / No. For anything else, pick them yourself: `--options "M3U,JSON"` (up to 4). Then move on to other work with `next`; don't stop the session for an answer. Always state your assumption in the question so a "fine" from Rich is enough. If something external stops a card (a missing key, a failing service), use `aigile block <proj> <id> "why" --as YourName`, and `unblock` when it clears. Blocked cards also show in Rich's inbox, and his reply clears the block.

**Questions vs tasks.** Use `ask` for a question Rich answers in words. Use `aigile task <proj> <id> "exactly what to do, step by step" --as YourName` for something only he can *do*, such as providing an API key, logging in somewhere, or running a command on a server. Tasks get their own "Tasks for you" list in his inbox. When he clicks Done, the card comes back to you through "For the team".

**6. Log decisions.** Anything Rich would otherwise ask "why did you do that?" about, and anything you decided while he was away:

```
aigile log <proj> "Chose SQLite over JSON files because ..." --decision --as YourName
aigile log <proj> "Sprint 3 pushed (abc1234), 120 tests green." --as YourName
```

`--decision` is for real decisions (these replace "Decisions made while you were away"); plain `log` is for notable events (the old "Agent log").

**7. Cards in "For the team" (`team`).** Any comment from Rich moves the card there, including "send back". Read it, then:
- just information or an answer → `aigile move <proj> <id> done`
- needs work (e.g. sent back) → move to `doing`, fix it, then `aigile test` so it goes back to Rich for approval

**7b. DMs from Rich (💬 cards).** A card whose title starts with 💬 is Rich messaging the lead from his DM chat. Reply with `aigile comment <proj> <id> "..." --as Lead`: your comment shows in his chat (left side). If it's an idea: `add` the cards for it (status `backlog`, small chunks), reply with their ids and a 2 to 3 bullet plan, and wait for his go. Close the 💬 card (`move ... done`) once he has replied and nothing is left to do.

**8. Pokes.** A "👉 any update?" poke from Rich on a card in `doing` or `review` means "this looks stuck, any update?". Reply with one line (`comment`) and leave the card where it is.

**9. Stand-ups.** A **📣 Stand-up** card in For the team means Rich wants a short report from each of you. Every team member answers once, in your own name:

```
aigile standup <proj> --done "What I finished" --next "What I do next" --blockers "What stops me (or: none)" --as YourName
```

- Keep each part to a line or two; `--blockers` is optional and means `none` if left out
- Your answer is stored on the card and shows in Rich's stand-up report; blockers are shown to him in red, so name the card id and what you need from him
- Answering again replaces your earlier answer
- When everyone on the roster has answered (the command tells you who is left), the lead moves the card to done

## What `next` returns, and in what order

Cards that are `blocked` or flagged NEEDS-RICH are skipped (they are listed at the bottom as waiting). The rest, in order:

1. **For the team.** Cards Rich commented on or sent back (status `team`). Do these first.
2. **Already in progress.** Cards in `doing`, so you resume instead of starting new work.
3. **Bugs and urgent/high items in `todo`.** Bugs first, then urgent, then high.
4. **The rest of `todo`**, by priority (urgent, high, normal, low), then oldest first.

The first line marked `>>` is your pick. `backlog` is never offered: it means "not committed yet". Rich or the lead moves cards from backlog to todo.

## Card fields

| Field | Values |
|---|---|
| status | backlog, todo, doing, review, verify, team, done |
| type | feature, bug, task |
| priority | low, normal, high, urgent |
| sprint | free text, e.g. `S3` |
| assignee | free text: a team member's name |

## Rules of the road

- Don't edit another team's board data, and don't delete cards. If a card is wrong, comment on it.
- Only move a card to `done` from `team`, after reading Rich's comment. Features go to `verify` via `test`. If a fix needs no testing by Rich, still hand it over with `test` (steps: "nothing to click: read the note and accept"), so it reaches his **For you** pile. `review` ("Team checking") is only for teammates checking each other's work.
- Use your own name in `--as`, so Rich can tell the agents apart.
- **Write cards, test steps and comments as short bullet points** (`- ` per line, **bold** only what to click or look at, no paragraphs). See WAYS-OF-WORKING.md.
- Keep text short and concrete. Cards are read by Rich on a phone and by other agents with limited context.
- For multi-line text pass `-` and pipe it in: `printf '...' | aigile comment <proj> <id> - --as Name`.

## Paste into your project's agent notes file

```markdown
## AI-gile board
Work is tracked on Rich's AI-gile board (replaces BOARD.local.md). Read `../AI-gile/AGENTS.md` once.
At session start run `node "../AI-gile/aigile.js" brief <this-project>`. Don't read or edit BOARD.local.md (history only).
Talk to each other on cards too: `comment --as <name>` for handovers and notes, which the next agent reads with `show`.
Move cards as you work, hand finished features over with `test` (never move to done), `ask` when blocked on Rich,
log decisions with `log --decision`, and keep your `team` roster entry current. Always pass `--as <your name>`.
```
