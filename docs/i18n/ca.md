# Catalan (ca) - first pass

Source of rules: LocoRadio docs/i18n.md and ca.json (casual "tu"; dates use ca-ES; plurals one / many / other). Tone: warm, plain, short. Standard Catalan (central), not Valencian or Balearic forms.

## Register
- Casual "tu", never "vostè".
- Developer words stay as loanwords where Catalan teams say them (backlog, sprint, stand-up, bug, commit, token, repo). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Catalan forms where needed (`{{dev:provar}}`, `{{dev:prova}}`, `{{dev:proves}}`, `{{dev:provis}}`).
- Short forms: "fa {n} min", "fa {n} h", "fa {n} d" (bare: m / h / d).
- Plurals: one / many / other (as Intl.PluralRules gives for ca).
- Apostrophes are straight (`l'equip`); quotes use « ».

## Glossary
| English | Catalan |
|---|---|
| card | targeta |
| board | tauler |
| project | projecte |
| team | equip |
| lead | líder |
| Lead Scrum Master | Lead Scrum Master |
| For you | Per a tu |
| For the team | Per a l'equip |
| To do | Per fer |
| In progress / Doing | En curs |
| Team checking | L'equip ho revisa |
| Done | Fet |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | safata d'entrada |
| Setup | Configuració |
| Usage | Consum |
| test (verb / noun) | provar / prova |
| test steps | passos de prova |
| bug | bug |
| Accept | Accepta |
| Send back | Torna-ho |
| Wait and see | Espera i veuràs |
| poke | toc (verb: donar un toc) |
| wake (a team) | despertar |
| assumption | suposició |
| night watch | vigilància nocturna (the watchman: vigilant nocturn) |
| going quiet | quedar-se en silenci |
| No Token Mode | No Token Mode (feature name kept) |
| token | token |
| Verbose | Detallat |
| Look (project colour/emoji) | Aspecte |
| Permissions | Permisos |
| Views | Vistes |
| Docs | Documents |
| Agent | agent |
| Pop out | Finestra pròpia |
| Space (🪐) | Ubicació; "a dins" for projects inside |
| Life board | Tauler de vida |
| pretend friend | amic fingit |
| GO (answer button) | Endavant (the literal word GO stays in sentences that quote the reply) |

## For the reviewer
- "tauler" for board (some teams say "board"): check.
- "Per fer" / "En curs" / "Fet" for the columns, and "Per a tu" for For you.
- "Torna-ho" for Send back; the imperative reads shorter than "Retorna" but check the tone next to "Accepta".
- "Endavant" for the Go button (`dms.go`, `act.go`).
- "toc" for poke, and the playful `sm.push.*` / `scale.*` lines (🍽️ "Mantén els plats girant", 🏇 "Fuet en mà").
- Verb/noun agreement in `{{dev:provar}}` phrases such as `col.verify` ("Tu has de provar"), `verdict.waiting` ("que ho provis") and `card.howtotest` ("Com provar-ho").
- Possessive/genitive with names (`{name}` stays in its basic form; check "de {name}" before vowels, e.g. "d'en" cases like `pf.garden`).
- `gloss.test.word` is "Prova" with `also` forms for provar/provis/test.
