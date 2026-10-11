// The text of `aigile help` (split from aigile.js, AIG-297).
module.exports = ({ OWNER, STATUSES }) => `aigile: the AI-gile board CLI.  Project = slug, name or key (case-insensitive).
Set AIGILE_URL to change the server (default: the port the board last started on, else 4321). Set AIGILE_AS=NAME to skip --as.
Text args can be "-" to read from stdin (handy for multi-line).

START OF SESSION
  brief <proj>                            the whole picture in one call: start every session with this
  updates <proj> [--peek]                 what ${OWNER} said/raised since you last looked (marks it seen)
  inbox                                   everything waiting on ${OWNER}, all projects
  next <proj>                             what to work on, in order (see AGENTS.md)
  list <proj> [--status s] [--mine NAME] [--all]   cards (done hidden unless --status done or --all)
  show <proj> <id>                        full card with the conversation
  projects                                all projects with counts

WORKING
  start <proj> <id> --as NAME             you (or an agent you launch) take a card: assign + doing + roster task
  move <proj> <id> <status>               status: ${STATUSES.join(' | ')}  ('done' only from 'team', after reading ${OWNER}'s comment)
  assign <proj> <id> NAME
  comment <proj> <id> "text" --as NAME
  ask <proj> <id> "question" --as NAME    comment + flags the card as needing ${OWNER}
  task <proj> <id> "what to do" [--server [NAME]] --as NAME something only ${OWNER} can do (key, login, manual step): goes to their inbox
  test <proj> <id> "steps ${OWNER} can follow" --as NAME    -> moves to verify, sets testSteps, comments
        [--open URL [--start "command"]]   adds a ▶ Open it button: starts the app if needed, opens the page
        [--commit SHA] [--shot a.png,b.png]  proof: the board shows what changed in that commit, plus your screenshots
  fold <proj> <target> <id> [<id>...] --as NAME   fold cards about the same feature into one (steps move across, the others close)
  tests <proj> [--all]                    AI tester: the tests waiting for ${OWNER} that nobody checked yet, with their steps
  checked <proj> <id> pass|fail|skip "what you saw" [--shot a.png] --as NAME   AI tester's verdict and evidence
  quiz <proj> <id> --topic "T" "Question?|Opt A,Opt B" ... --as NAME   a 🗂️ Topic: several quick questions on one card, answered together
  ask also takes: --options "A,B,C"  (up to 4 answer buttons under your question; otherwise the board guesses)
  ask / task / test also take: --holds AIG-1,AIG-2 (what it holds up)  --prio now|today|whenever  --kind decide|test|server|keys|read  --mins N
  block <proj> <id> ["why"] --as NAME     unblock <proj> <id>
  edit <proj> <id> [--title --desc --type --priority --sprint --assignee --test-steps]
  add <proj> "title" [--type feature|bug|task --priority low|normal|high|urgent --status s
                      --desc D --sprint S --assignee NAME --needs-you --test-steps T]

HOOKS (agent session hooks, see AGENTS.md)
  updates <proj> --hook                   SessionStart / UserPromptSubmit: prints news, silent if none
  dm <proj> "text" --as NAME             chatty leads only: start a DM to ${OWNER} (a nudge or a light word; one at a time)
  wait <proj> [--every SECONDS]           run in the BACKGROUND while idle: exits with ${OWNER}'s news when they comment
  updates <proj> --stop-hook              Stop: blocks stopping once while there is unseen news
  bye <proj>                              SessionEnd: the window closed, a background run takes over
  wake <proj> [--sprint]                  start a team's background run (--sprint: work through To do)
  notokens [on|off]                       ⛔ No Token Mode: stop all AI use, or see if it is on
  watchsay "text"                        the 🌙 watchman's one-line answer in its chat

TEAM AND LOG
  team <proj> NAME [--role R --model M --task T --status S]    upsert roster entry (a new member gets a free library picture)
  avatar <proj> [PIC] --as NAME           your profile picture: no PIC lists the picture library, PIC (number or name) takes one
  log <proj> "text" [--decision] --as NAME
  standup <proj> --done "..." --next "..." [--needs "..."] [--blockers "... | none"] --as NAME    answer a 📣 Stand-up card (AGENTS.md)
        --needs: waits on the owner while you carry on;  --blockers: only what stops ALL your work

PROJECTS
  new-project <name> [--key K --path P --desc D]
  onboard <proj> <folder> [--create]      set a folder up for the board: notes + ways of working + comment hooks

Global: --json prints raw JSON instead of the compact text.`;
