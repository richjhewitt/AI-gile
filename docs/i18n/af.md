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
| Team checking | Span kyk na | |
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
| Poke | Stoot (aan) | "aanstoot" |
| night watch | Nagwag | watchman = "wag" |
| Going quiet | Raak stil | |
| assumption | aanname | |
| Plug (an assumption) | Korrigeer | "stop" would read as halt |
| No Token Mode | Geen-Token-modus | |
| token | token | |
| agent | agent | |
| blocked / blockers | geblokkeer / blokkeerders | |
| Permissions | Toestemmings | |
| Views | Aansigte | |
| DM | DB (direkte boodskap) | |
| Look (🎨) | Voorkoms | |
| Space | Ruimte | |
| Checklist | Kontrolelys | |
| Assignee | Toegewys aan | |
| Pretend friend | Voorgewende vriend | |
| Starter team | Beginspan | |
| Got it | Verstaan | |

## For the reviewer
- "DB" for DM (direkte boodskap): confirm it is clear, or whether "DM" in Latin is more natural for South African users.
- "Stoot" for Poke and "Korrigeer" for Plug: check the tone is not scolding.
- "Gedetailleerd" for the Verbose switch and "Praatlustig" for Chatty.
- Long labels to check for fit: "Hardloop die gids" (wizard), "Moenie spanne wakker maak bo hierdie % van die 5-uur-limiet nie".
- `gloss.bug.also` lists "fout,foute" as well as "bugs"; check the tooltip catches them.
- "Nagwag merk elke projek" (lead.watchAll) is quoted inside `sm.night.title`; the two must stay identical.
