# Français (fr, France): first pass

First pass by a model (AIG-489), for a native-speaker check. File: `public/lang/fr.json`, 1767 keys, same keys and order as `en.json`.

## Register and typography
- Casual **tu / ton / ta** throughout (as in LocoRadio's French and its docs). No "vous".
- France French, not Canadian or Belgian.
- A non-breaking space (U+00A0) before `? ! : ; %` and inside « ». Added by script from ordinary spaces, so please keep it when editing.
- Straight apostrophes (`'`) are used, not typographic ones. Change them if you want ’ everywhere.
- Quotes in English (`"..."`) became « ... » in text, but stay `\"` inside HTML attributes.
- Keys named in the interface stay in English (Enter, Shift, Esc, Escape), as the brief says. `Esc`/`Enter` are not translated.
- Time: "il y a {n} min / h / j". Bare: `{n} min`, `{n} h`, `{n} j`.
- Plurals: neutral forms such as "{n} carte(s)" only where English did the same ("{n} équipe(s)"). Counted nouns that are always plural in the key ("{n} cartes") are plural; singular keys exist separately (`.one` / `.many`).

## Glossary
| English | Français | Note |
|---|---|---|
| card | carte | |
| board | tableau | "tableau" for the kanban board |
| project | projet | |
| lead / team lead | chef (d'équipe) | "chef" for the lead; "Lead Scrum Master" kept as the role name |
| Lead Scrum Master | Lead Scrum Master | kept in English, as on the board |
| team | équipe | |
| helpers | assistants | agents' sub-agents |
| agent | agent | |
| For you | Pour toi | column `col.verify.short` |
| To do | À faire | |
| In progress / Doing | En cours | |
| Team checking | L'équipe vérifie | |
| For you to test | À tester par toi | |
| For the team | Pour l'équipe | |
| Done | Terminé (column), Fait (button) | |
| Backlog | Backlog | loanword, as software teams say |
| Sprint | Sprint | |
| Stand-up | Stand-up | |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Boîte de réception | |
| Setup | Réglages | |
| Usage | Consommation | page about plan usage |
| Home | Accueil | |
| Stand-up report | Compte rendu du stand-up | |
| Test steps | Étapes de test | |
| Test (verb) | tester | |
| Accept / Send back | Accepter / Renvoyer | |
| Looks right, next step | C'est bon, étape suivante | |
| Wait and see | Attendre | |
| Poke / Nudge | Relancer / coup de pouce | |
| Wake the team | Réveiller l'équipe | |
| Night watch / watchman | Veille de nuit / le veilleur | |
| Going quiet | Mode silence / se mettre en silence | |
| No Token Mode | Mode zéro token | |
| Token | token | |
| Assumptions | Hypothèses | the team's guesses while you were away |
| Bug | bug | |
| Commit / Push / Branch / Merge | commit / push / branche / merge | |
| Repo | dépôt | |
| Pull request | pull request | |
| Hook | hook | |
| Verbose | Détaillé | |
| Look (project appearance) | Apparence | |
| Pro-friendly | Adapté à Pro | |
| Share / link (to a friend) | Partager / relier | |
| Friend / mate | ami / pote | |
| Reporter (role) | Rapporteur de bugs | |

## Dev-word markers
`{{dev:word}}` markers are kept in every place the English has them. In French the word inside is sometimes inflected ("{{dev:tester}}", "{{dev:testée}}"). If the later bracket-the-English-word card shows "(test)" next to these, it will still read fine.

## For the reviewer
- `gloss.*.word` / `gloss.*.also`: these are the words the glossary underlines in the text. I used the loanwords developers say (Backlog, Sprint, Stand-up, Bug, Commit, Push, Merge, Hook, Token) and "Branche", "Dépôt", "Déploiement", "Refactoring". `gloss.test.also` lists tests, tester, testé... Check these match the words actually written in the UI.
- "chef" for team lead (`dms.lead`, "Chef bavard", "Ton chef") could be "responsable" or "lead". I chose chef; please say if it sounds too military.
- "Mode silence" for "Going quiet" and "Veille de nuit" for "Night watch".
- "Rapporteur de bugs" for the Reporter role is stiff; "Signaleur" or just "Reporter" might be better.
- `share.*` strings about friends use "ami" with inclusive-neutral phrasing where easy ("il ou elle"). Check the gender handling.
- Strings that stay the same as English on purpose: product and role names, loanwords (Backlog, Sprint, Stand-up, Kanban, Token), file/paths, "Docs", "Question(s)", "Message(s)", "Agents", "Total", "Description", "Type", "Compact".
- `lead.go.help` etc. use "briefing" for "brief"; native may prefer "consigne".
