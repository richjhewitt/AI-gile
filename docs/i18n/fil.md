# AI-gile in Filipino (fil)

First pass written by Babel for AIG-490; native-speaker review below (AIG-490).

## Register
- Casual, friendly Filipino with natural Taglish, like LocoRadio's Filipino: tech words stay in English ("card", "board", "project", "team", "setup"), grammar and glue words are Tagalog.
- "ka / mo / iyo" (informal you), never "po" or "kayo" for the single user. "ninyo" only where two people are meant (friend links).
- English verbs take the Filipino affix: "I-save", "I-click", "I-refresh", "Mag-attach", "Nagche-check", "Nagte-test".
- Imperatives: "I-" for buttons, "Mag-" / base verb for instructions.
- Names: "si / ni / kay" only for people (friends, agents). Project names take "ang / ng / sa" ("Ang {name} ang pinakamaraming gumamit").
- Dates and times follow fil-PH (Intl). Durations: min, h, d, oras, araw (compact forms kept like English).
- Plurals: "mga" only where it reads naturally; counts use the singular noun ("{n} card", "{n} team"). Plural objects (`{count}`) give `one` and `other`, as Intl.PluralRules does for Filipino, with the same text in both.
- `{{dev:...}}` markers kept around dev words in their English form, with the Filipino affix inside where needed (`{{dev:i-test}}`, `{{dev:sprint}}`, `{{dev:bug}}`).

## Glossary
| English | Filipino | Note |
|---|---|---|
| card | card | |
| board | board | |
| project | project | |
| team | team | |
| lead | lead | |
| Lead Scrum Master | Lead Scrum Master | kept |
| Scrum Master | Scrum Master | kept |
| For you | Para sa iyo | |
| To do | Gagawin | |
| In progress / Doing | Ginagawa | |
| Team checking | Chine-check ng team | |
| For the team | Para sa team | |
| Verify column ("For you to test") | Para sa iyo na i-test | |
| Done | Tapos na | |
| Backlog | Backlog | |
| sprint | sprint | |
| stand-up | stand-up | |
| inbox | Inbox | |
| Setup | Setup | |
| Usage | Usage | |
| how much is left (usage) | gaano pa karami ang natitira | was "magkano", which means money |
| test / test steps | test / mga hakbang sa test | |
| Send back | Ibalik | |
| Bring back (hidden card) | Ipakita ulit | was Ibalik, clashed with Send back |
| Accept / accepted | Tanggapin / Tinanggap | not "Natanggap" (= received) |
| Wake (team) | Gisingin | |
| Poke | Kalabitin | |
| night watch | Night watch | "Night watchman", "Watchman" kept |
| Going quiet | Tahimik muna | |
| assumption | assumption | |
| Plug this (assumption) | Ayusin ito | |
| No Token Mode | No Token Mode | |
| token | token | |
| agent | agent | |
| role / helper / brief | role / helper / brief | |
| starter team / main team | starter team / pangunahing team | |
| level (wizard, roles) | antas | |
| Look (🎨) | Look | |
| Permissions | Mga permission | |
| Views | Mga view | |
| DM | DM | |
| Pop out | Pop out | |
| Group (cards) | Group | |
| Space | Space | |
| Life board | Life board | |
| Focus | Focus | |
| Checklist | Checklist | |
| Hook | Hook | |
| Stuck | stuck | |
| Blocked | naka-block | |
| Generous (budget) | Galante | was "Magaan sa gastos" (= cheap), the opposite |
| Last heard from | Huling balita mula kay | was "narinig kay", a calque |

## Answers to the first pass's questions
- Taglish balance: right for the audience. Long paragraphs keep English nouns but Tagalog sentence structure, which is how Filipino developers write. Kept.
- "Kalabitin" (poke) and "Gisingin" (wake) sound natural on buttons; kept.
- "Plug this" means "patch / correct this guess"; "Ayusin ito" fits. Kept.
- "Gagawin" (To do) and "Ginagawa" (In progress) are distinct to a Filipino reader (future vs ongoing aspect) and are the usual pair; kept.
- "ni / kay {name}": right for people and agents. Wrong for project names (`usage.headline.html` said "Si {name}"); fixed to "Ang {name}".
- Gender-neutral "niya / siya" is correct; Filipino has no gendered pronoun.

## Review
Native-speaker pass over all 1,929 keys (AIG-490). 251 values changed: 181 keys that were missing (en.json gained them after the first pass) and 70 edits.
- Added the 181 missing keys: night-watch poke reasons (`poke.*`), demo projects and the pretend team's canned replies (`demo.*`, `pt.*`, `pf.*`), server messages (`srv.*`), the "How agents work with you" sliders (`scale.*`), the Team dialog (`tm.*`, `pe.*`, `mt.*`), `lang.fun`.
- Plural keys (`inbox.g.count`, `dlg.find.commits`, `dlg.find.sessions`, `queue.bump.title`, `tidy.toast`, `quiet.done.told`, `quiet.done.woke`, `join.exp.days`) are now `{ "one", "other" }` objects.
- Stale translations where English had changed: `wz.adv.roles.h`, `wz.adv.roles.sub`, `wz.adv.row.roles` (starter team); restored the 👥 in `board.team`.
- Wrong meaning fixed: `budget.plan.generous` (said "cheap"), "magkano" (money) for usage left in four strings, `inbox.toast.gaccepted` (Natanggap = received), `lead.watchAll` and `sm.night.title` ("ticks" is a tick box), `ask.to` / `idea.to` ("kay" broke before "Lahat ng project"), `usage.headline.html` (Si + project name).
- Broken or garbled sentences rebuilt: `dispatch.help` (option names had been dropped mid-sentence), `share.lane.note`, `leave.confirm` (now "{what} pa rin…", which works with I-update / I-refresh / I-restart), `sb.never`, `share.prev.intro`, `usage.check.auto.title`.
- Calques replaced: "Panatilihing umiikot ang mga plato", "Sumusunod ito kada ilang segundo", "hanapin ang sarili mong daan", "Ganito mo mahahanap ang daan", "narinig" / "narinig kay", "para mag-flick", "baligtarin" (a switch).
- Word choice: Hiniling (not Inutusan, too bossy) for tasks from a team, "Ipakita ulit" for Bring back, "Kumusta!" for Hello, "Gumawa ng card" for Raise a card, "Binasa / character".

Still worth a human native speaker's look:
- "Gets ko" (`info.gotit`) is very casual street Taglish; "Sige, gets" or "Okay" may suit some users better.
- `scale.*` slider labels and `scale.push.help` are long; check they fit at narrow widths.
- `pt.*` demo replies and `srv.*` night-watch messages speak as the AI; check the tone.
- `srv.budget.over` builds "ang limit na {name}" from `srv.budget.h5` / `srv.budget.wk` ("5-oras", "lingguhan"); check it reads naturally once filled in.
- `pt.c5.steps` keeps the pretend site's English button labels (**Contact**, **Send**), as the demo site is in English.
