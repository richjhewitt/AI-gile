# Lithuanian (lt)

First pass by Babel for AIG-493; a native-speaker review follows. LocoRadio's docs/i18n.md has no Lithuanian-specific rules beyond the plural categories; its lt.json sets the tone (casual, short). Dates use lt-LT.

## Register
- Casual second person singular ("tu": "tavo", "tau", "tavęs"), as in LocoRadio's lt.json. Imperatives for buttons ("Išsaugoti" infinitive for labels, "Spustelėk" for instructions).
- Gender: the owner, agents and friends are never gendered. Lithuanian 2nd-person present and 1st-person past are not gendered, so those are used freely; masculine participles/adjectives ("esi pasiruošęs", "pats") are avoided in favour of "savarankiškai", impersonal or passive forms ("sustabdyta", "Pranešta komandai").
- Friends: "kontaktas" in lists and buttons ("Pridėti kontaktą"), "žmogus" in prose. Roles of a shared link (Viewer, Reporter...) are abstract nouns ("Stebėjimas", "Pranešimas", "Dalyvavimas", "Testavimas", "Kūrimas", "Valdymas").
- Names stay in the nominative: after a colon or in a fixed slot ("Siųsti: {name}", "Pridėta: {name}") instead of needing a case ending.
- Dev words: loanwords with Lithuanian endings where the English has `{{dev:...}}` (`{{dev:sprintai}}`, `{{dev:klaidą}}`, `{{dev:testo}}`, `{{dev:commit'ai}}`). `gloss.*.word` keeps the English term (Backlog, Commit...) except Sprintas, Testas and Klaida; `gloss.*.also` lists English and Lithuanian search aliases.
- Plurals: one / few / many / other (Intl.PluralRules `lt`). `many` is the fractional form (genitive singular); `other` covers 10-20, 30... ("{count} kortelių"). Counts inside plain strings use "label: {n}" ("Žinučių: {n}").
- "komanda" means both team and command. It is used for both; where it could clash, the sentence names the object ("Mažas veiksmas, kuris...", "Terminalas serveryje").

## Glossary
| English | Lithuanian |
|---|---|
| card | kortelė |
| board | lenta |
| project | projektas |
| team | komanda |
| lead | vadovas |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Tau |
| For the team | Komandai |
| To do | Reikia padaryti |
| In progress / Doing | Vykdoma |
| Team checking | Komanda tikrina |
| Done | Atlikta |
| Backlog | Backlog |
| sprint | sprintas (pl. sprintai) |
| stand-up | stand-up (pl. stand-up'ai) |
| inbox | gautieji |
| Home | Pradžia |
| Setup | Nustatymai |
| Usage | Naudojimas |
| test (verb / noun) | testuoti, išbandyti / testas |
| test steps | testo žingsniai |
| bug | klaida (gloss: Klaida; aliases bug) |
| hook | kabliukas |
| Accept | Priimti |
| Send back | Grąžinti |
| Wait and see | Palaukime |
| Not sure yet | Dar nežinau |
| poke | paraginti |
| wake (a team) | pažadinti |
| stuck | užstrigo |
| blocked | užblokuota |
| assumption | prielaida |
| plug (an assumption) | užtaisyti |
| night watch / watchman | naktinė sargyba / sargyba |
| going quiet | nutilti |
| No Token Mode | No Token Mode (kept) |
| token | žetonas |
| Verbose | išsamus režimas |
| Look | Išvaizda |
| Permissions | Leidimai |
| Views | Rodiniai |
| Docs | Dokumentai |
| agent | agentas |
| friend (DM contact) | kontaktas / žmogus |
| Tour | ekskursija |
| Pop out | Atskirame lange |

## For the reviewer
- "paraginti" for poke and "užstrigo" for stuck: check they feel natural for a card.
- "Nutilti / Nutylu" for going quiet; "Saldžių sapnų" and "Labanakt" for the goodnight screen.
- "Ekskursija" for the guided tour; "Rodiniai" for saved views; "Prielaidos" for assumptions.
- "kabliukas" for git hooks and "commit'as" with an apostrophe: Lithuanian developers often just write "commit". Check which is preferred.
- Lithuanian developer teams often say "Backlog", "sprintas" and "stand-up'as"; check the gloss aliases.
- Role names of shared links are abstract nouns to avoid gender; a native speaker may prefer other wording.
- Pretend friend Davy keeps masculine forms, as in the other languages.
- `prof.level.*` and developer role names (Frontend, Backend...) stay in English.
