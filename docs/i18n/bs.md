# Bosnian (bs, Latin script) first pass

Card AIG-494. File: `public/lang/bs.json` (1932 keys, same key set and order as `en.json`). Needs a native check.

## Register
- Casual "ti" (as in LocoRadio), Latin script, standard Bosnian (ijekavian). Bosnian vocabulary where it differs from Croatian and Serbian: sedmica (week), sanduče, računar, historija, obavijest, tačno, šta. Dates use `bs-BA`.
- Gender: no slashes and no gendered forms for the reader, the agents or a friend. Phrased with present tense, passive, nouns or questions ("Opet sam tu", "od tebe", "Pokreće se…"). A friend's `{name}` gets the noun "osoba" so verbs agree ("Osoba {name} je prekinula vezu").
- Plurals: Bosnian has `one`, `few` and `other` in `Intl.PluralRules`; the `{one, few, other}` objects use all three. Plain strings that hold a count were rephrased as "Poruka: {n}" where the number could be 2 to 4.
- `{{dev:...}}` markers wrap the Bosnian dev word (testiranje, sprint, bug, commit).

## Glossary
| English | Bosnian | Note |
|---|---|---|
| card | kartica | |
| board | ploča | |
| project | projekt | |
| team | tim | |
| lead | voditelj | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Za tebe | |
| To do | Za uraditi | |
| In progress / Doing | U toku | |
| Team checking | Tim provjerava | |
| For the team | Za tim | |
| Verify | Za tvoje {{dev:testiranje}} | |
| Done | Gotovo | |
| backlog | Backlog | loanword |
| sprint | sprint | plural sprintovi |
| stand-up | stand-up | plural stand-upovi |
| inbox | Sanduče | |
| Setup | Postavke | |
| Usage | Potrošnja | |
| test steps | koraci testiranja | |
| bug | bug | plural bugovi |
| commit / push / merge / deploy / repo | kept in English | |
| branch | branch | plural branchevi |
| token | token | |
| assumption | pretpostavka | |
| night watch | noćna straža | night watchman = noćni čuvar |
| No Token Mode | Način bez tokena | |
| poke | pogurni | noun: guranje |
| going quiet | povlačim se | |
| DM | direktna poruka | |
| friend | prijatelj | |
| permissions | dozvole | |
| view | prikaz | |
| column | kolona | |
| attachment | prilog | |
| archive | arhiviraj | |
| tour | tura | |
| wizard | čarobnjak | |
| focus | fokus | |
| checklist | kontrolna lista | |
| pretend friend | izmišljeni prijatelj | |
| Life board | ploča života | |
| Steady (push level 3) | Ravnomjerno | |
| AI passed | AI prošao | |

## For the reviewer
- "Za uraditi" for To do is a choice; "Na čekanju" or "Za rad" are alternatives.
- "projekt" (as in nl and hr files) versus "projekat": check which is natural in Bosnia.
- "Pogurni" for Poke can feel stiff; "Podsjeti" is an alternative.
- Some gender-neutral rewrites ("od tebe", "osoba {name}") sound a bit formal.
- Counts shown by `{n}` in plain strings are not inflected; real plural objects use one/few/other.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).
