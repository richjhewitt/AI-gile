# 🧭 Lead Scrum Master

The night watchman grew into one role with a day and a night mode (AIG-349 part 4, AIG-359). It is in charge of every project lead. It talks to leads only through cards and comments, and to the owner only in its own chat (💬 DMs, "🧭 Lead Scrum Master").

## What it looks at

Across every project it watches:

- **Stuck cards**: in progress with nobody running longer than the scale says (a day at level 1, 3 h at Steady).
- **Teams asleep with To do**: woken (in the background, at most once an hour per team).
- **Cards waiting on the owner too long**: 3 days or more, named in the digest.
- **Overlap between projects**: open cards whose titles look alike, named in the digest.
- **💡 "Decide later" ideas** (AIG-351): sorted into the right project's For the team as a 💬 card for its lead.
- **One short digest a day**, after `digestAt` (default 17:00): done today, waiting for tests, ideas sorted, and the list above.

At night (while going quiet) the watchman rounds in `lib/watchman.js` do the work, as before: restart cut-off runs, flag a card stuck after 3 tries, wake idle teams, wait out the usage limit, start the AI tester.

## On or off, and the diligence scale (AIG-441)

**On** runs day and night: the plain-code rounds always (free), the AI only as designed (owner messages, things rules can't fix, the digest), within the daily cap, the budget and ⛔ No Token Mode. **Off** is as before: only the night watchman while going quiet. At night the watchman still does its own rounds; going quiet keeps working. The chat says "On: checking every N min (Steady)".

The scale `push` 1..5 (chat header and ⚙️ Setup, saved as `scrumMaster.push` in aigile.local.json, default 3). The table is `PUSH` in `lib/scrummaster.js`, plain numbers in minutes:

| Level | Round every | Poke a card stuck over | Remind about a waiting question after | Daily AI runs | Extra |
|---|---|---|---|---|---|
| 1 🍽️ Keep the plates spinning | 30 min | 1 day | never | 4 | |
| 2 | 20 min | 8 h | never | 6 | |
| 3 ⚖️ Steady (default) | 10 min | 3 h | 4 h | 8 | |
| 4 | 5 min | 1 h | 2 h | 12 | |
| 5 🏇 Crack the whip | 2 min | 30 min | 1 h | 16 | a status line in the chat each hour |

A reminder is ONE bump of the open question (the AIG-373 bump, `bumpOne`), never repeated for the same question. `scrumMaster.aiRunsPerDay` still overrides the cap. `AIGILE_SM_MS` overrides the interval (tests).

## May and may not

| May | May not |
|---|---|
| Wake teams | Write code |
| Add cards and orders to a lead's For the team, signed "🧭 Lead Scrum Master" | Push |
| Move cards between backlog and To do, within the owner's rules | Restart the board |
| Sort the owner's 💡 ideas into the right project | Change settings or permissions |
| Write to the owner in its own chat | Accept or close cards for the owner |
| | Act on projects it isn't watching |

## Token rules

- **Rounds are plain code** (every 2 to 30 minutes by the scale, once launched): free.
- **An AI run only** when the owner writes to it, when a round finds something the rules can't fix (a card newly stuck for a day), or at digest time when there are findings (stuck or look-alike cards).
- **Owner messages run on Opus, routine runs on Sonnet.** Idea sorting is rules first (a `slug:` start, then the project's name, slug, key and the longer words of its name); one tiny Haiku call only when the rules can't decide, never more than once per idea.
- **Never** under ⛔ No Token Mode or over the token budget (`lib/notokens.js`, `lib/budget.js`); Haiku is skipped then too, and the idea waits in the inbox.
- **A daily AI-run cap**: `scrumMaster.aiRunsPerDay` in aigile.local.json (default by the scale: 4, 6, 8, 12, 16). Over it, an owner message gets a one-line "used up" answer and routine runs are dropped until tomorrow.

## Launch

💬 DMs → 🧭 Lead Scrum Master → **🧭 Launch Lead Scrum Master**, then where it runs:

- **VS Code** (suggested): opens its own folder, `data/scrummaster/`, whose `CLAUDE.md` is this role's brief. The session waits for the owner's messages with `aigile smwait` and answers with `aigile watchsay`.
- **Terminal window**: the same, started with the brief as its first prompt.
- **Background**: no window; its rounds run in the board and an AI run starts hidden only when needed.

While a window session is waiting (it asked within the last 2 minutes), the owner's messages go to it instead of starting a hidden run. **Stop** turns the day rounds off; the night watch still works while going quiet.

## Hang watchdog

A verbose background run (a team with 🔊 verbose on, and every Lead Scrum Master run) writes a log line for each step. No new line for 15 minutes (`AIGILE_HANG_MS`) means it hangs: it is killed and started again, with a note on the card in progress (or in its chat). A team is restarted at most 3 times a day; after that only killed. A run that isn't verbose writes nothing until it ends, so it can't be watched this way.

## The prompt

Built by `brief()` in `lib/scrummaster.js` (the same text is the `CLAUDE.md` of its folder): who it is, what the owner just wrote or what the round found, the board commands (`brief`, `list`, `show`, `wake --sprint`, `add --status team --as`, `comment --as`, `move`), the projects it watches, the may / may-not list above, and "answer in ONE short line with `aigile watchsay`, then stop".

## Code

- `lib/scrummaster.js`: state (`data/scrummaster.conf`), launch / stop / status, the day round, idea sorting, the digest, the daily cap, the brief.
- `lib/watchman.js`: the night rounds, the chat (night in `watchman.conf`, day in `watchman.last`), `relay` (owner messages, day and night), `routine`, the agent run with its hang watchdog.
- `lib/presence.js`: `silent` / `hung`, the hang watchdog for team runs; the `DAY` prompt for a team it wakes by day.
- Routes: `GET /api/scrummaster`, `POST /api/scrummaster/launch|stop|round`, `GET /api/scrummaster/wait?since=`; the chat stays `/api/chats/_watchman`.
- Page: `public/js/dms.js` (`paintSm`, `smLaunch`); texts `sm.*`.
- QA area `scrummaster`.
