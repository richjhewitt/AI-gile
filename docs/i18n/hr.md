# Croatian (hr) first pass

Card AIG-489. File: `public/lang/hr.json` (1767 keys). Needs a native check.

## Register
- Casual "ti" (as in LocoRadio), Latin script, standard Croatian (ijekavian), not Serbian or Bosnian forms. Dates use `hr-HR`.
- Gender: the user's gender is unknown, so verbs about the reader use a neutral phrasing where possible and "o/la" or "/na" forms where not ("spreman/na", "Vratio/la sam se"). The reviewer may prefer a different convention.
- Names are put where no case ending is needed. Where a sentence needs a case with `{name}` (e.g. "osobe {name}") the name is left in its basic form after a case-carrying noun. Check these.
- Plurals: neutral forms ("{n} kartica", "{n} min"); Croatian has one/few/other, the plain strings use the genitive plural after numbers.

## Glossary
| English | Croatian | Note |
|---|---|---|
| card | kartica | |
| board | ploča | |
| project | projekt | |
| team | tim | |
| lead | voditelj | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Za tebe | |
| To do | Za napraviti | |
| In progress / Doing | U tijeku | |
| Team checking | Tim provjerava | |
| For the team | Za tim | |
| Verify | Za tebe da testiraš | wrapped in `{{dev:...}}` |
| Done | Gotovo | |
| backlog | Backlog | loanword |
| sprint | sprint | plural "sprintovi" |
| stand-up | stand-up | plural "stand-upovi" |
| inbox | Pristigla pošta | |
| Setup | Postavke | |
| test steps | koraci testiranja | |
| bug | bug | plural "bugovi" |
| commit / push / merge / repo | kept in English | |
| branch | branch | glossary also lists "grana" |
| assumption | pretpostavka | |
| night watch | noćna straža | "Night watchman" = noćni čuvar |
| No Token Mode | Način bez tokena | |
| token | token | |
| Usage | Potrošnja | |
| poke | pogurati | |
| going quiet | povlačim se | |
| DM | izravna poruka | |
| friend | prijatelj | |
| permissions | dopuštenja | |
| view | pogled | |
| column | stupac | |
| group | grupa | |
| attachment | privitak (privici) | |
| archive | arhiviraj | |
| tour | obilazak | |
| wizard | čarobnjak | |
| focus | fokus | |
| checklist | popis za provjeru | |

## For the reviewer
- `{{dev:...}}` markers wrap the Croatian word (testiraš, sprintovi, bug...). Check the future "English in brackets" feature will not double words that are already English.
- `gloss.*.also` lists contain inflected Croatian forms plus English; verify they are sensible match words.
- Gendered forms with "/la" and "/na" appear in several messages (night.back, wz.*, ask.*, pretend.*). Decide on a convention.
- "pogurnuti" for Poke and "Za napraviti" for To do may feel stiff; alternatives: "Potakni", "Na redu".
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).
