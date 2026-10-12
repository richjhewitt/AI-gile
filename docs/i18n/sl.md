# Slovenian (sl)

First pass by Babel for AIG-493; a native-speaker review follows. LocoRadio's docs/i18n.md has no Slovenian-specific rules beyond the plural categories; its sl.json sets the tone (casual, short). Dates use sl-SI.

## Register
- Casual second person singular ("ti": "tvoj", "te", "nate"), as in LocoRadio's sl.json. Imperatives for buttons ("Shrani", "Pošlji").
- Gender: the owner, agents and friends are never gendered. No slash forms, no masculine past participles. Used instead: present tense, imperative, passive/impersonal, nouns ("Prošnja vodji", "Zbujeno: {names}", "Čaka nate"). AI speakers (watchman, Scrum Master) use first-person present or passive ("zagon je bil ustavljen").
- Friends and other people: the noun "stik" (contact) in lists and buttons ("Dodaj stik"), "oseba" in prose. Roles of a shared link (Viewer, Reporter, ...) are abstract nouns ("Ogled", "Poročanje", "Sodelovanje", "Testiranje", "Razvoj", "Upravljanje") so they carry no gender.
- Names stay in the nominative: put them after a colon or "osebe {name}" ("Odpri tablo osebe {name}", "Poslano: {name}") instead of needing a case ending.
- Dev words: loanwords in Slovenian forms where the English has `{{dev:...}}` (`{{dev:sprinti}}`, `{{dev:napako}}`, `{{dev:testa}}`, `{{dev:commiti}}`). `gloss.*.word` keeps the English term; `gloss.*.also` lists English and Slovenian search aliases.
- Plurals: one / two / few / other (Intl.PluralRules `sl`, dual included). Where a count sits inside a plain string, "label: {n}" is used ("Sporočil: {n}", "Blokirano: {n}").

## Glossary
| English | Slovenian |
|---|---|
| card | kartica |
| board | tabla |
| project | projekt |
| team | ekipa |
| lead | vodja |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Zate |
| For the team | Za ekipo |
| To do | Za narediti |
| In progress / Doing | V teku |
| Team checking | Ekipa preverja |
| Done | Končano |
| Backlog | Backlog |
| sprint | sprint (pl. sprinti) |
| stand-up | stand-up (pl. stand-upi) |
| inbox | nabiralnik |
| Home | Domov (Dom on the home page) |
| Setup | Nastavitve |
| Usage | Poraba |
| test (verb / noun) | testirati / test |
| test steps | koraki testa |
| bug | bug / napaka (type label: napaka) |
| hook | kljuka (git hooks) |
| Accept | Sprejmi |
| Send back | Vrni |
| Wait and see | Počakajmo |
| Not sure yet | Še ne vem |
| poke | spodbuditi (noun: spodbuda) |
| wake (a team) | zbuditi |
| stuck | zataknjeno |
| blocked | blokirano |
| assumption | predpostavka |
| plug (an assumption) | zakrpaj |
| night watch / watchman | nočna straža / straža |
| going quiet | utišanje |
| No Token Mode | No Token Mode (kept) |
| token | žeton |
| Verbose | podrobni način |
| Look | Videz |
| Permissions | Dovoljenja |
| Views | Pogledi |
| Docs | Dokumenti |
| agent | agent |
| friend (DM contact) | stik / oseba |
| Tour | vodenje |
| Pop out | Odpri posebej |

## For the reviewer
- "spodbuditi / spodbuda" for poke: chosen over "sunek" (sounds rough). Check it feels right for a card that is stuck.
- "Utišanje / Utišaj se" for going quiet, "Pozdravljen"-style greetings avoided; "Živjo!" is used.
- Gender avoidance: a few role names and sentences are now abstract nouns ("Sodelovanje", "Razvoj"); a native speaker may prefer another wording.
- "Najin klepet" (sm.fold, "Our chat") uses the dual; check it reads right.
- "stik" for friend may feel clinical in a few buttons; "oseba" was used where a sentence needs a person.
- Pretend friend Davy keeps masculine forms ("njegovo tablo"), as in the other languages.
- `prof.level.*` and developer role names (Frontend, Backend...) stay in English.
