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
| test steps | testtrinn (`{{dev:Test}}trinn`) |
| to test (tag/badge) | skal testes (`{n} skal {{dev:testes}}`) |
| bug | bug |
| Accept | Godta |
| Send back | Send tilbake |
| Wait and see | Vent og se |
| poke | dytt (verb: dytte) |
| wake (a team) | vekke |
| assumption | antakelse |
| night watch / watchman | nattevakt (nattevakten), never "vakten" alone |
| going quiet | ta pause (button: Tar pause / Ta pause) |
| AI tester | AI-testeren; passed / failed = bestått / ikke bestått; a pass = godkjenning |
| plug (an assumption) | rette opp |
| Create (project, card) | Opprett |
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
| pretend friend | liksomvenn (tag: liksom; pretend team / AI: liksomteam, liksom-AI) |
| friend | venn; never "han/hun/ham/hans" for a friend or for Davy: use the name or "vennen" |
| GO (answer button) | Kjør (the literal word GO stays in sentences that quote the reply) |

## For the reviewer
- "poke" as "dytt": check it reads naturally for waking a stuck team; alternatives are "pirk" or "gi et puff".
- "Å gjøre" for To do (instead of the English loan "To do"): check against what Norwegian teams really use.
- "Til deg" / "Til teamet" for the For you / For the team columns.
- "Kjør" for the Go button (`dms.go`, `act.go`): alternatives are "Kjør på" or "Sett i gang".
- Wording of the 🏇/🍽️ push levels (`sm.push.*`, `scale.*`) is playful and loosely adapted.
- Possessive after names (`{name} sin Claude`, `Davys`): `{name}` is kept in its basic form.
- `gloss.*.also` lists hold the forms used in this file; add more if the hover hint misses a form.

## Answers (review)
- "dytt" for poke: kept. It reads naturally ("gi teamet et dytt"); "pirk" sounds like nagging.
- "Å gjøre" for To do: kept. Plenty of Norwegian teams just say "To do", but "Å gjøre" is clear and matches the rest of the file.
- "Til deg" / "Til teamet": kept, short and natural for column names.
- "Kjør" for Go: kept. "Kjør på" is more casual but too long next to the other buttons.
- `sm.push.*` / `scale.*`: fine as playful lines. "Svinge pisken" works; "Hold tallerkenene i gang" is understandable.
- `{name} sin Claude`: replaced by "Claude hos {name}" and "AI-en til {name}", which keep `{name}` in its basic form without the colloquial "sin" genitive.

## Review
- Added the 3 missing keys (`boot.retry`, `boot.broke`, `boot.reload`).
- Going quiet: "gå stille" was a calque; now "ta pause" everywhere (`home.quiet`, `quiet.*`, `ng.off`, `sm.night.what`, `lead.watchAll.help`, `wz.adv.night.sub`).
- Night watch: "vakten" / "Vaktmannen" / "nattvakten" unified to "nattevakten"; `lead.watchAll` now "Nattevakten passer på alle prosjekter", and `sm.night.title` quotes it exactly.
- Gender: the pretend friend Davy no longer gets "ham/hans" (`pretend.*`); friend sentences use "vennen" or `{name}` instead of "de/dem" where it read as plural (`dmf.*`, `join.help`, `share.offer.they`, `share.offered`, `share.test.intro`, `share.prev.stop.note`, `share.role.help.*`, `sb.*`).
- "påtatt venn" → "liksomvenn" (påtatt means feigned, not make-believe).
- Test wording: "Å teste" tags became "Skal testes"; test steps are "testtrinn"; AI tester results "ikke bestått" instead of "feilet"; trust options say "godkjenninger".
- Grammar and spelling: "et bitte lite spørsmål" (was "ett bitteliten"), "så langt du vil", "git-historikken", "fargelegg", "sprintkolonner", "Raskt bytte", "tomt" (not "tom" about a plan), "Fullstendig sti".
- Calques and wording: "Opprett" for create, "Søk" for the find button, "Maks antall …" for limits, "Mye igjen" for plenty left, "Rett opp" for plugging an assumption, "Showstoppere", "røyktest", "Finner ikke agentprogrammet", clearer `eye.running`, `pres.heard` ("livstegn").
- Still worth a human look: whether "board"/"boardet" should become "tavle" for non-developer readers; "Tar pause" for the going-quiet button (alternative "Logger av"); "Å gjøre" vs "To do"; `share.*` lines still use "deres/dem" for the friend's side, which reads fine but is formally plural.
