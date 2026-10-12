# Lithuanian (lt)

First pass by Babel for AIG-493; a native-speaker review follows. LocoRadio's docs/i18n.md has no Lithuanian-specific rules beyond the plural categories; its lt.json sets the tone (casual, short). Dates use lt-LT.

## Register
- Casual second person singular ("tu": "tavo", "tau", "tavęs"), as in LocoRadio's lt.json. Imperatives for buttons ("Išsaugoti" infinitive for labels, "Spustelėk" for instructions).
- Gender: the owner, agents and friends are never gendered. Lithuanian 2nd-person present and 1st-person past are not gendered, so those are used freely; masculine participles/adjectives ("esi pasiruošęs", "pats") are avoided in favour of "savarankiškai", impersonal or passive forms ("sustabdyta", "Pranešta komandai").
- Friends: "kontaktas" in lists and buttons ("Pridėti kontaktą"), "žmogus" in prose. Roles of a shared link (Viewer, Reporter...) are abstract nouns ("Tik peržiūra", "Alfa testavimas", "Klaidų pranešimas", "Dalyvavimas", "Testavimas", "Kūrimas", "Administravimas"); texts that mention one say "vaidmuo Dalyvavimas".
- Names stay in the nominative: after a colon or in a fixed slot ("Siųsti: {name}", "Pridėta: {name}") instead of needing a case ending.
- Dev words: loanwords with Lithuanian endings where the English has `{{dev:...}}` (`{{dev:sprintai}}`, `{{dev:klaidą}}`, `{{dev:testo}}`, `{{dev:commit'ai}}`). `gloss.*.word` keeps the English term (Backlog, Commit...) except Sprintas, Testas and Klaida; `gloss.*.also` lists English and Lithuanian search aliases.
- Plurals: one / few / many / other (Intl.PluralRules `lt`). `many` is the fractional form (genitive singular); `other` covers 10-20, 30... ("{count} kortelių"). Counts inside plain strings use "label: {n}" ("Žinučių: {n}").
- "komanda" means both team and command. "komanda" alone is reserved for the team. A shell command is "paleidimo komanda" (Other / editor / server launch command) or "terminalo komanda", or the sentence avoids the word ("veiksmas serveryje", "Mažas veiksmas, kuris..."). In terminal-only strings (term.*) plain "komanda" is kept, as the context is unambiguous.

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
| going quiet | atsijungti ("🌙 Atsijungiu", "Kai atsijungi") |
| No Token Mode | No Token Mode (kept) |
| token | žetonas |
| Verbose | išsamus režimas |
| Look | Išvaizda |
| Permissions | Leidimai |
| Views | Rodiniai |
| Docs | Dokumentai |
| agent | agentas |
| friend (DM contact) | kontaktas / žmogus |
| Tour | pažintis (su lenta) |
| Pop out | Atskirame lange |
| command (shell) | paleidimo komanda / terminalo komanda (never bare "komanda") |
| AI tester / AI passed | AI testuotojas / AI patvirtino |
| Lead Scrum Master | inflected with an apostrophe where a case is needed ("Lead Scrum Master'iui", "Scrum Master'io") |
| shared-link roles | Tik peržiūra, Alfa testavimas, Klaidų pranešimas, Dalyvavimas, Testavimas, Kūrimas, Administravimas |

## For the reviewer
- "paraginti" for poke and "užstrigo" for stuck: check they feel natural for a card.
- "Nutilti / Nutylu" for going quiet; "Saldžių sapnų" and "Labanakt" for the goodnight screen.
- "Ekskursija" for the guided tour; "Rodiniai" for saved views; "Prielaidos" for assumptions.
- "kabliukas" for git hooks and "commit'as" with an apostrophe: Lithuanian developers often just write "commit". Check which is preferred.
- Lithuanian developer teams often say "Backlog", "sprintas" and "stand-up'as"; check the gloss aliases.
- Role names of shared links are abstract nouns to avoid gender; a native speaker may prefer other wording.
- Pretend friend Davy keeps masculine forms, as in the other languages.
- `prof.level.*` and developer role names (Frontend, Backend...) stay in English.

### Answers (native review)
- "paraginti" and "užstrigo" are natural for a card; kept. Buttons now use the infinitive ("👉 Paraginti").
- "Nutilti / Nutylu" means "fall silent", which is not what the owner does. Replaced by "atsijungti / 🌙 Atsijungiu" (signing off), matching the "išsijungi" in the tooltip. Goodnight words are fine.
- "Ekskursija" sounds like a museum trip. Replaced by "pažintis su lenta" ("🎓 Pažintis", "Pradėti pažintį"). "Rodiniai" and "Prielaidos" are fine.
- "kabliukas" and "commit'as" are kept: both are understood, and the gloss lists "commit" and "komitas" as aliases.
- Gloss aliases for Backlog, sprintas and stand-up'as are fine.
- Role names: "Stebėjimas" (observation), "Pranešimas" (a notification) and "Valdymas" (control) did not read as roles. Now "Tik peržiūra", "Klaidų pranešimas" and "Administravimas"; the others stay.
- "komanda": the clash was real. "Atidaryta tavo komanda" read as "opened by your team", and "kiekvieną žingsnį ir komandą" was ambiguous. Shell commands are now "paleidimo komanda" or "terminalo komanda" (see Register).

## Review
Native-speaker pass for AIG-493: 199 values changed, 7 missing keys added (usage.runs.total, usage.kind.*, srv.budget.night).
- Team vs command: every "command" outside the terminal panel now says "paleidimo komanda" / "terminalo komanda" or avoids the word ("veiksmas serveryje").
- Gender leaks fixed: "būsi nepasiekiamas", "Tikrinti pačiam", "Uolus", "nurodęs priežastį", "kaip naujas naudotojas", "tavo paties" (x3), "(užblokuota)" for a contact, "laisva" for a picture.
- Wrong forms: "uždavia" (now "užduoda"), "nelieičiant" (typo), "Rasti mano projektus" (now "savo"), "Ankstesni" for messages (now "Ankstesnės"), "Erdvi / Kompaktiška" agreement, "Savo" as a template name (now "Pasirinktinė").
- Meaning fixes: "Neveikia" for idle (reads as "broken", now "Ilsisi"); "Jokia kortelė netinka" (now "Atitinkančių kortelių nėra"); "Amžius" for card age (now "Senumas"); "AI išlaikė" for AI passed (now "AI patvirtino"); "Gyvų duomenų" (now "realiu laiku").
- Names and inflection: "Lead Scrum Master" gets a case ending where the sentence needs one; names after "iš / nuo" are moved to "{name}: ..." or "({name})".
- Calques: "Kitas žingsnis, prašau", "komandos apačioje", "seniausiai laukiantys pirmi", "Draugiška Pro" (now "Tinka Pro planui").
- Still for a human: "Paklausti {name} Claude" and "{name} lentoje" keep the name in the nominative where Lithuanian wants the genitive; "pwa.ios.how" keeps the English iOS menu name "Add to Home Screen" (check the Lithuanian iOS label); "Administravimas" vs "Valdymas" for Admin; "Sveiki" (plural/formal) in the welcome titles.
