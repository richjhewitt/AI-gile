# Norwegian Bokmål (no) - first pass

Source of rules: LocoRadio docs/i18n.md (Bokmål, `nb` and `nn` browsers get it; casual "du"; dates use nb-NO). Tone follows LocoRadio's no.json: warm, plain, short.

## Register
- Casual "du", never "De".
- Bokmål only, no Nynorsk. Software words stay as loanwords where Norwegian teams say them (board, backlog, sprint, stand-up, bug, commit, token).
- Developer words are wrapped in `{{dev:...}}` exactly where English has them. Inside the marker the word takes Norwegian endings where needed (`{{dev:teste}}`, `{{dev:tester}}`, `{{dev:sprinter}}`), otherwise the loanword. The glossary `*.also` lists carry those forms so hover hints still match.
- Short forms: "{n} min siden", "{n} t siden", "{n} d siden" (bare: m / t / d).
- Plurals: one / other.

## Glossary
| English | Norwegian |
|---|---|
| card | kort |
| board | board (boardet) |
| project | prosjekt |
| team | team (pl. team, def. teamet) |
| lead | leder (teamleder) |
| Lead Scrum Master | Lead Scrum Master |
| For you | Til deg |
| For the team | Til teamet |
| To do | Å gjøre |
| In progress / Doing | Pågår |
| Team checking | Teamet sjekker |
| Done | Ferdig |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | innboks |
| Setup | Oppsett |
| Usage | Forbruk |
| test (verb / noun) | teste / test |
| test steps | trinn for test / testtrinn |
| bug | bug |
| Accept | Godta |
| Send back | Send tilbake |
| Wait and see | Vent og se |
| poke | dytt (verb: dytte) |
| wake (a team) | vekke |
| assumption | antakelse |
| night watch | nattevakt |
| going quiet | gå stille |
| No Token Mode | No Token Mode (feature name kept) |
| token | token |
| Verbose | Utførlig |
| Look (project colour/emoji) | Utseende |
| Permissions | Tillatelser |
| Views | Visninger |
| Docs | Dokumenter |
| Agent | agent |
| Pop out | Eget vindu |
| Space (🪐) | Plassering; "inni" for projects inside |
| Life board | Livsboard |
| pretend friend | påtatt venn |
| GO (answer button) | Kjør (the literal word GO stays in sentences that quote the reply) |

## For the reviewer
- "poke" as "dytt": check it reads naturally for waking a stuck team; alternatives are "pirk" or "gi et puff".
- "Å gjøre" for To do (instead of the English loan "To do"): check against what Norwegian teams really use.
- "Til deg" / "Til teamet" for the For you / For the team columns.
- "Kjør" for the Go button (`dms.go`, `act.go`): alternatives are "Kjør på" or "Sett i gang".
- Wording of the 🏇/🍽️ push levels (`sm.push.*`, `scale.*`) is playful and loosely adapted.
- Possessive after names (`{name} sin Claude`, `Davys`): `{name}` is kept in its basic form.
- `gloss.*.also` lists hold the forms used in this file; add more if the hover hint misses a form.
