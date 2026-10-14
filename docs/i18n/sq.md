# Albanian (sq) - first pass, native-speaker review done

Source of rules: LocoRadio docs/i18n.md and sq.json (casual "ti", never "ju" for one reader; dates use sq-AL; plurals one / other as Intl.PluralRules gives for sq: 1 is "one", 0 and everything else "other"). Standard Albanian (Tosk), Latin script. Tone: warm, plain, short. Written by a model, then reviewed by a second model working as a native-speaker reviewer (AIG-494); a human native check is still welcome.

## Register
- Casual "ti". Straight quotes " ".
- Never gendered where avoidable: instead of "i sigurt / e sigurt" or "i zënë" about the reader, use verbs and nouns ("nëse ke dyshime", "Ndërsa merreshe me gjëra të tjera"). Role names (Testues, Raportues) are the usual masculine nouns. A friend's name is "Emri i mikut", not "Emri i tij".
- Developer words stay as loanwords where Albanian teams say them (backlog, sprint, stand-up, bug, commit, push, branch, merge, repo, token, frontend, backend). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Albanian forms (`{{dev:testuar}}`, `{{dev:testosh}}`, `{{dev:testimi}}`, `{{dev:testit}}`, `{{dev:sprint-et}}`, `{{dev:commit-e}}`). The glossary `*.also` lists match these forms and the inflected forms used in plain text (the tooltips match whole words only).
- Short forms: "{n} min më parë", "{n} orë më parë", "{n} ditë më parë" (bare: min / orë / ditë).
- Plurals: one / other. "pas {count} dite" (one) and "pas {count} ditësh" (other).
- Times: "në orën 9:00", "pas {in}" for "in" (not "për", which reads as "for").

## Glossary
| English | Albanian |
|---|---|
| card | kartë |
| board | tabelë |
| project | projekt |
| team | ekip |
| lead | drejtues |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Për ty |
| For the team | Për ekipin |
| To do | Për t'u bërë |
| In progress / Doing | Në punë |
| Team checking | Ekipi po kontrollon |
| Done | Kryer |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | kutia hyrëse |
| Setup | Konfigurimi |
| Usage | Përdorimi |
| test (verb / noun) | testoj / test; AI tester: testuesi AI |
| test steps | hapat e testit |
| bug | bug (plural bug-e, bug-et) |
| raise (a card / bug) | krijoj (a card), raportoj (a bug) |
| Accept | Prano |
| Send back | Ktheje mbrapsht |
| Wait and see | Prit e shih |
| poke / nudge | shtysë: "i jap një shtysë" (never bare "shtyj", which also means postpone) |
| wake (a team) | zgjoj |
| assumption | supozim |
| night watch | roja e natës (the watchman: roja i natës) |
| going quiet | në heshtje ("Hyr në heshtje") |
| No Token Mode | No Token Mode (feature name kept) |
| token | token (plural: tokenë) |
| path | shteg (never "rrugë") |
| console | konsolë (never "tastierë", which is keyboard) |
| usage window (5 h / 7 d) | periudhë |
| Verbose | I detajuar |
| Look (project colour/emoji) | Pamja |
| Permissions | Lejet |
| Views | Pamjet |
| Docs | Dokumente |
| Agent | agjent |
| Pop out | Dritare e veçantë |
| Space (🪐) | Hapësira |
| Life board | Tabelë jete |
| pretend friend | miku i shtirur |
| GO (answer button) | Vazhdo (the literal word GO stays in sentences that quote the reply) |
| untrusted | jo e besuar |

## For the reviewer (first-pass questions, answered)
- "Për t'u bërë" / "Në punë" / "Kryer" and "Ekipi po kontrollon": all fit as column names. Kept.
- "drejtues" for lead: kept ("lider" sounds political). "tabelë" for board and "kartë" for card: kept.
- Poke: "shtysë" (noun) is right. The verb "shtyj" was dropped because it also means "postpone" ("roja e shtyn" read as "the watch postpones it"); it is now always "i jap një shtysë". "Në heshtje" for going quiet is fine.
- Possessives of a filled-in name ("Claude të {name}", "tabela e {name}", "Kopshti i Davy") read naturally. Kept.
- Plurals: "{count} commit / commit-e" is fine. Day plurals after "pas" now take the right case ("pas 1 dite", "pas 3 ditësh").
- "Mirë se vjen" and "Natën e mirë" fit the tone.
- GO: "Shko" means "walk / go away", so the button is now "Vazhdo" (carry on).

## Review (AIG-494)
What changed (221 values, including the 7 keys that were missing):
- Added the 7 missing keys: usage.runs.total, the usage.kind.* labels and srv.budget.night.
- Wrong meaning: console "tastierë" (keyboard) → "konsolë"; path "rrugë" (road) → "shteg" everywhere; poke verbs that read as "postpone"; "u var" (was hanged) → "ngeci"; "Hap një herë të vetme" (open just once) → "Hap i njëhershëm" (one-time step); "{id} u përgjigj" → "Iu përgjigj {id}"; and "Shko" → "Vazhdo" for GO.
- Grammar: "pikërisht tani" → "sapo"; "Bugs e mia" → "Bug-et e mi"; agreement fixes ("të arkivuarat", "priority" adjectives now agree with masculine "prioritet"); "pas" instead of "për" for "in 3 hours"; "Grupoje"; "të përdorë"; and "ta kopjosh".
- Calques: "Plasi kamxhikun" → "Kërcit kamxhikun"; "Mbaji pjatat të rrotullohen" → "Mbaji të gjitha në lëvizje"; "Të kërkon ty" → "Ka nevojë për ty"; "Dritare 5-orëshe" → "Periudhë 5-orëshe"; "Hajde" → "Mbarë!"; and "ngre bug-e / karta" → "raporton bug-e", "krijon karta".
- Second person: "çfarë priste" → "çfarë prisje"; "Ndërsa po punoje gjëra të tjera" → "Ndërsa merreshe me gjëra të tjera".
- Gloss lists: bug.also no longer lists "gabim" (it marked every "wrong" in plain text); added forms in use (bug-et, tokenëve, agjentëve, testin, commit-eve...).

Still worth a human look:
- "Grep / grepa" for hook: devs may prefer "hook" as-is.
- "Roja e natës" (the feature) next to "roja i natës" (the watchman): check that the two genders don't confuse.
- "Kryer" versus "Përfunduar" for the Done column.
- "Rregullo grumbullin tim" for "Tidy my pile", and "Kërcit kamxhikun" for Crack the whip.
