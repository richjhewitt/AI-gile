# AI-gile in Afrikaans (af), first pass

Written by Babel for AIG-495. A native-speaker model reviews it next.

## Register
- Casual **jy/jou** (never u), as in LocoRadio's Afrikaans. Short, friendly, conversational; "asseblief" is kept out of buttons.
- Latin script, standard South African Afrikaans. No gendered forms: the reader, the agents and friends are addressed with "jy", plain verbs or nouns; singular "hul/hulle" for a friend or pretend friend ("hul data", "hul bord").
- Software words are the English loanwords South African teams really use: backlog, sprint, stand-up, bug, commit, push, branch, merge, repo, refactor, deploy, hook, token, agent, scrum, kanban, pull request. "Toets" is used for test (verb and noun), "fout" is the plain alternative to bug.
- `{{dev:...}}` markers wrap the Afrikaans form ("{{dev:toets}}", "{{dev:sprint}}", "{{dev:bug}}", "{{dev:commit}}", "{{dev:Backlog}}"). Each marked word is also listed in the `gloss.*.word/also` keys, so the tooltip finds it.
- Plurals: `{ one, other }` (Intl.PluralRules gives one/other for af; 1 is singular, 0 is plural: "0 kaarte").
- Dates/times follow af-ZA. Short relative times: "m" (minute), "u" (uur), "d" (dae).

## Glossary
| English | Afrikaans | Note |
|---|---|---|
| card | kaart | |
| board | bord | |
| project | projek | |
| team | span | |
| lead / team lead | leier | "Lead Scrum Master" kept in English |
| For you | Vir jou | |
| To do | Om te doen | |
| In progress / Doing | Besig | |
| Team checking | Span kontroleer | "Span kyk na" left the verb hanging |
| For the team | Vir die span | |
| For you to test | Vir jou om te toets | |
| Done | Klaar | |
| Backlog | Backlog | loanword; "Agterstand" is rare in teams |
| sprint | sprint | |
| stand-up | stand-up | |
| inbox | inkassie | |
| Setup | Opstelling | |
| Usage | Gebruik | |
| test | toets | |
| test steps | toetsstappe | |
| Accept | Aanvaar | |
| Send back | Stuur terug | |
| Wake (team) | Maak wakker | |
| Poke | Por | "gepor"; "stoot" is push (clashes with git push) and "aanstoot" reads as offence |
| night watch | Nagwag | watchman = "wag"; "Watchman ticks every project" = "Merk elke projek vir die nagwag" (a tick box) |
| Going quiet | Raak stil | |
| assumption | aanname | |
| Plug (an assumption) | Korrigeer | "stop" would read as halt |
| No Token Mode | Geen-Token-modus | |
| token | token | |
| agent | agent | |
| blocked / blockers | geblokkeer / blokkeerders | |
| Permissions | Toestemmings | |
| Views | Aansigte | |
| DM | DM | DM / DM's, as South Africans say it; "Direkte boodskappe" only as a heading |
| Look (🎨) | Voorkoms | |
| Space | Ruimte | |
| Checklist | Kontrolelys | |
| Assignee | Toegewys aan | |
| Pretend friend | Voorgewende vriend | |
| Starter team | Beginspan | |
| Got it | Verstaan | |
| comment | kommentaar | never "opmerking"; verb "lewer kommentaar" |
| helper (sub-agent) | helper | not "hulper" |
| wizard | assistent | "gids" is folder |
| run (a command) | voer uit | "hardloop" is a person running |
| usage check | gebruikskontrole | |
| stuck | vas | |
| failed (test) | misluk | |
| All (filter of items) | Alles | "Almal" only for people |

## For the reviewer
- "DB" for DM (direkte boodskap): confirm it is clear, or whether "DM" in Latin is more natural for South African users.
- "Stoot" for Poke and "Korrigeer" for Plug: check the tone is not scolding.
- "Gedetailleerd" for the Verbose switch and "Praatlustig" for Chatty.
- Long labels to check for fit: "Hardloop die gids" (wizard), "Moenie spanne wakker maak bo hierdie % van die 5-uur-limiet nie".
- `gloss.bug.also` lists "fout,foute" as well as "bugs"; check the tooltip catches them.
- "Nagwag merk elke projek" (lead.watchAll) is quoted inside `sm.night.title`; the two must stay identical.

## Review
Native-speaker pass for AIG-495: every value read next to the English. 220 values changed, and the 7 missing keys added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).

Answers to the questions above:
- DM: "DB" is not used in South Africa. People say "DM" / "DM's", so every DB became DM.
- Poke is now "por" ("Por die span", "moet gepor word"): light, not scolding, and no clash with git push. Plug stays "Korrigeer" ("Gekorrigeer" once done): neutral in tone.
- "Gedetailleerd" (Verbose) and "Praatlustig" (Chatty) are fine and kept.
- Wizard: "Hardloop die gids" was wrong twice (gids = folder, hardloop = a person running). It is now "Gebruik die assistent". The budget row "Moenie spanne wakker maak bo hierdie % ..." is long but clear, so it stays.
- `gloss.bug.also` "bugs,fout,foute" is fine.
- `lead.watchAll` and the quote in `sm.night.title` are both "Merk elke projek vir die nagwag" (tick = a tick box, as the help text says), identical.

What changed:
- Terms made consistent: DM, por, kommentaar, helper, assistent, gebruikskontrole, vas, misluk, Alles.
- Commands are "uitgevoer", not "gehardloop" (terminal buttons, npm install, releases).
- Calques rewritten: "In die lug" (in flight) to "Aan die gang", "Wag en sien" to "Wag eers", "Roep 'n stand-up" to "Hou 'n stand-up", "'n hand om jou voete te vind", "die af en toe aansporing", "Maak projek ongeargiveer".
- Wrong meanings fixed: "possyfer" (now poslys), "Opdrag" for errand (now Draaie loop), "Gestuur" for Shipped (now Vrygestel), "Die meeste kaarte" for a limit, "geslaag" for what the AI tester passed (now goedgekeur / Deur KI geslaag), "Kom jou kaarte ... uit".
- Grammar: missing "dat" clauses, "Nog niks nie", "nie nou nie" answers, "in plaas daarvan om", a gendered "syne" removed.
- Placeholders, **bold**, `code`, `{{dev:}}` markers and emoji checked against English for every key.

For a human native speaker to check:
- "Lead Scrum Master", "Backlog" and "stand-up" stay in English: confirm this matches how teams talk.
- "Por" for Poke: natural to me; some may prefer "aanpor".
- "Draaie loop" (Errand), "Pakhelper" (Pack helper), "middelvlak" / "hoof" (mid / principal levels).
- "Sleutels:" for keyboard keys in the flick-through hints ("Sneltoetse" would clash with toets).
