# Română (ro): first pass

First pass by a model (AIG-491), for a native-speaker check. File: `public/lang/ro.json`, 1929 keys, same keys and order as `en.json`.

## Register
- Casual **tu** (informal second person), as in LocoRadio's Romanian ("folosește volumul dispozitivului tău"). Imperatives in the second person ("Salvează", "Anulează").
- Diacritics with comma-below (ș, ț), not cedilla.
- Quotes: „…” (Romanian low-high).
- Plurals: `one` / `few` / `other` as `Intl.PluralRules('ro')` gives. Numbers 0 and 2 to 19 take `few`; `other` uses "de" ("20 de carduri").
- Keyboard keys and aigile CLI commands untouched (Enter, Shift+Enter, Esc, `aigile avatar`).

## Glossary
| English | Română | Note |
|---|---|---|
| card | card | |
| board | board | loanword, as dev teams say it |
| project | proiect | |
| lead | lider | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | echipă | |
| helpers | ajutoare | |
| agent | agent | |
| For you | Pentru tine | column `col.verify.short` |
| To do | De făcut | |
| In progress | În lucru | |
| Team checking | Echipa verifică | |
| For you to test | Așteaptă testul tău | |
| For the team | Pentru echipă | |
| Done | Gata | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | declines: sprinturi, sprintul |
| Stand-up | Stand-up | plural stand-up-uri |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Inbox | loanword |
| Setup | Configurare | |
| Usage | Utilizare | |
| Home | Acasă | |
| test steps | pași de test | |
| test / to test | test / a testa | inside `{{dev:...}}` the form follows the sentence |
| bug | bug | plural bug-uri |
| commit | commit | plural commit-uri |
| assumption | presupunere | |
| night watch | veghea de noapte | the watchman is "paznicul de noapte" |
| No Token Mode | Modul fără tokeni | |
| poke | imbold / a împinge | "are nevoie de un imbold" |
| Accept / Send back | Acceptă / Trimite înapoi | |
| Views | Vizualizări | |
| Stand-up report | Raport de stand-up | |
| Look (settings) | Aspect | |
| Permissions | Permisiuni | |
| Going quiet | Mă fac mut | |
| Friends (DMs) | prieteni | |
| Tour | Tur | |

## For the reviewer
- **"Pretend friend"** is "prieten de probă" (a trial friend). A native speaker may prefer "prieten imaginar". Check all `pretend.*` keys and the demo texts.
- Gender: the user is addressed without gendered participles where possible; a few spots still use masculine ("singur", "plecat", "ocupat", "mut"). Check whether to neutralise.
- `gloss.*.also` lists the inflected forms used in `{{dev:...}}` markers (sprinturile, testul...). Check they match what the board highlights.
- "Going quiet" as "Mă fac mut" is playful; "Mă retrag" or "Mod liniștit" may sound more natural.
- Several English words stay as loanwords (board, card, inbox, backlog, bug, commit, tester). Check how far this is real usage.
- "Presiunea Scrum Master-ului" for the Scrum Master "push" slider is a literal choice.
