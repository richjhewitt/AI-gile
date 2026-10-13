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
  profile <proj> [<role>]                 leads: a role's lines to paste at the top of a helper's prompt (no role: the roles on the project)
        [--set tests=4,alone=2 [--all]] [--reset [--all]]   this project's numbers (role "owner": steps, go, words); --all: your copy for all projects
  move <proj> <id> <status>              status: ${STATUSES.join(' | ')}  ('done' only from 'team', after reading ${OWNER}'s comment)
  snooze <proj> <id> "2026-10-12 14:00"   timed card: out of the way until then (local time; also "+2h", "tomorrow 9:00"); --clear
  assign <proj> <id> NAME
  comment <proj> <id> "text" --as NAME
  assume <proj> <id> --decided "..." --chose "..." --why "..." --if-plugged "..." [--options "A|B"] --as NAME   🌙 owner away: log the guess with its context; plain "one line" still works
  comment <proj> <id> "..." --assume                       same as assume: logs the comment as an assumption
  next-card <proj> <from-id> <to-id> --as NAME   you carry on in another card: ${OWNER}'s chat follows you there
  ask <proj> <id> "question" --as NAME    comment + flags the card as needing ${OWNER}
  task <proj> <id> "what to do" [--server [NAME]] [--outside] --as NAME something only ${OWNER} can do (key, login, manual step): goes to their inbox
  termlog <proj> <id> [--tail N]          what ${OWNER}'s ⌨ terminal showed on a server task (plain text): read it, don't ask for screenshots
  bump <proj> <id> --as NAME           remind ${OWNER} of the open task / question on a card: moves it to the top, never a copy
  test <proj> <id> "steps ${OWNER} can follow" [--info] --as NAME    -> moves to verify, sets testSteps, comments (--info: nothing to click, 📖 To read)
        [--open URL [--start "command"]]   adds a ▶ Open it button: starts the app if needed, opens the page
        [--commit SHA] [--shot a.png,b.png]  proof: the board shows what changed in that commit, plus your screenshots
  check <proj> <id> "Windows,Mac,Android"   ☑ checklist on a card (ticks of same-named items stay); --tick 1,3 / --untick 2 (1-based); --clear; no list = show it
        test ... --check "Windows,Mac,Android" hands over with a checklist: Accept asks "2 of 4 left: accept anyway?"
  wait-for <proj> <id> AIG-12 [AIG-13]    ⏳ the card waits for those (same project): greyed, out of next/For you until done, then pops back;  --clear
  secret ask <proj> <id> <NAME> "what for" --as X    🔑 ask the owner for a secret on a task card (they paste it in a masked box; you never see it)
  secret run <proj> <NAME> [--keep] -- <command...>   🔑 run a command with the secret in env var NAME; its value is masked as **** in the output; one-time unless --keep
  group <proj> "name" AIG-1 AIG-2 ...     put cards in a named group (e.g. "Addon testing"): one item in ${OWNER}'s For you
        [--remove AIG-3] [--move <status>]   take cards out / move the whole group;  group <proj> --list  shows the groups
  test <proj> "group name" ["steps"]      hands over every card in the group (each keeps its steps unless you give shared ones)
  fold <proj> <target> <id> [<id>...] --as NAME   fold cards about the same feature into one (steps move across, the others close)
  tests <proj> [--all]                    AI tester: the tests waiting for ${OWNER} that nobody checked yet, with their steps
  checked <proj> <id> pass|fail|skip "what you saw" [--sure|--likely] [--shot a.png] --as NAME   AI tester's verdict, how sure a pass is, and evidence
  quiz <proj> <id> --topic "T" "Question?|Opt A,Opt B" ... --as NAME   a 🗂️ Topic: several quick questions on one card, answered together
  ask also takes: --options "A,B,C"  (up to 4 answer buttons under your question; otherwise the board guesses)
  ask / task / test also take: --holds AIG-1,AIG-2 (what it holds up)  --prio now|today|whenever  --kind decide|test|server|keys|read  --mins N
  showstopper <proj> <id> "why" --as NAME   leads and the Scrum Master only, only while 🎯 focus mode is on: one line gets through to the owner (max 3 an hour)
  crucial <proj> <id> [off]            mark a card ⭐ crucial: it still runs while the usage saver is on (off: take it away)
  block <proj> <id> ["why"] --as NAME     unblock <proj> <id>
  edit <proj> <id> [--title --desc --type --priority --sprint --group --assignee --test-steps]
  add <proj> "title" [--type feature|bug|task --priority low|normal|high|urgent --status s
                      --desc D --sprint S --group G --assignee NAME --needs-you --test-steps T]
                      --life housework|appointment|shopping|call|bills|errand|health|family|pets [--at WHEN --remind MINS]   a 🏡 real-life task, the owner's own
  pack <proj> <id> [--want "..."] [--primer]   an AIGILE pack: the card as short key lines for another chat AI (docs/HANDOFF.md)
  unpack <proj> <id> - [--add 1,3]        paste its AIGILE/1 BACK reply (stdin) as a 🌐 Outside AI comment; --add: proposed cards to add

HOOKS (agent session hooks, see AGENTS.md)
  updates <proj> --hook                   SessionStart / UserPromptSubmit: prints news, silent if none
  msg <proj> <to> "text" --as NAME      tell another agent: a roster name, Lead or Scrum Master (they are woken; it is not ${OWNER}'s word; - reads stdin)
  dm <proj> "text" --as NAME             chatty leads only: start a DM to ${OWNER} (a nudge or a light word; one at a time)
  wait <proj> [--every SECONDS]           run in the BACKGROUND while idle: exits with ${OWNER}'s news when they comment
  updates <proj> --stop-hook              Stop: blocks stopping once while there is unseen news
  ping <proj>                             PostToolUse: tells the board a session is at work (once a minute)
  bye <proj>                              SessionEnd: the window closed, a background run takes over
  wake <proj> [--sprint]                  start a team's background run (--sprint: work through To do)
  notokens [on|off]                       ⛔ No Token Mode: stop all AI use, or see if it is on
  watchsay "text" [--options "A,B"]      the 🧭 Lead Scrum Master's one-line answer in its chat (--options: up to 4 quick-answer buttons)
  smwait [--every SECONDS]                🧭 Lead Scrum Master in a window: wait (in the BACKGROUND) for ${OWNER}'s next messages

TEAM AND LOG
  team <proj> NAME [--role R --model M --task T --status S]    upsert roster entry (a new member gets a free library picture)
  avatar <proj> [PIC] --as NAME           your profile picture: no PIC lists the picture library, PIC (number or name) takes one
  avatar <proj> badge ANIMAL COLOUR ACCESSORY --as NAME   the free badge maker, e.g. badge fox teal glasses (no PIC lists all the parts)
  log <proj> "text" [--decision] --as NAME
  standup <proj> --done "..." --next "..." [--needs "..."] [--blockers "... | none"] --as NAME    answer a 📣 Stand-up card (AGENTS.md)
        --needs: waits on the owner while you carry on;  --blockers: only what stops ALL your work

PROJECTS
  new-project <name> [--key K --path P --desc D --parent SPACE --folder [DIR]]   --parent: inside that project (a space); --folder: make and connect DIR (default <projectsFolder>/<name>)
                 --as NAME: refused unless NAME has Can make projects (Setup > Roles)
  release-notes <proj> [--since YYYY-MM-DD] [--title T] [--dry]   new release notes from done cards (public/releases.json, ✨ What's new)
  i18n missing <lang>                  only the English strings a language file lacks or that changed since (JSON): translate these, never read all of en.json
  export <proj> [file]                   save a project as one file (default <slug>.aigile): cards, comments, pictures; no secrets or folders
  import <file>                           open a .aigile file as a new project (new slug if the name is taken; no folder linked)
  onboard <proj> <folder> [--create]      set a folder up for the board: notes + ways of working + comment hooks

Global: --json prints raw JSON instead of the compact text.`;
