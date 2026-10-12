# Albanian (sq) - first pass

Source of rules: LocoRadio docs/i18n.md and sq.json (casual "ti", never "ju" for one reader; dates use sq-AL; plurals one / other as Intl.PluralRules gives for sq: 1 is "one", 0 and everything else "other"). Standard Albanian (Tosk), Latin script. Tone: warm, plain, short. Written by a model; a native check is needed.

## Register
- Casual "ti". Straight quotes " ".
- Never gendered where avoidable: instead of "i sigurt / e sigurt" or "i zënë" about the reader, use verbs and nouns ("nëse ke dyshime", "Ndërsa po punoje gjëra të tjera"). Role names (Testues, Raportues) are the usual masculine nouns.
- Developer words stay as loanwords where Albanian teams say them (backlog, sprint, stand-up, bug, commit, push, branch, merge, repo, token, frontend, backend). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Albanian forms (`{{dev:testuar}}`, `{{dev:testosh}}`, `{{dev:testimi}}`, `{{dev:testit}}`, `{{dev:sprint-et}}`, `{{dev:commit-e}}`). The glossary `*.also` lists match these forms.
- Short forms: "{n} min më parë", "{n} orë më parë", "{n} ditë më parë" (bare: min / orë / ditë).
- Plurals: one / other.

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
| test (verb / noun) | testoj / test |
| test steps | hapat e testit |
| bug | bug |
| Accept | Prano |
| Send back | Ktheje mbrapsht |
| Wait and see | Prit e shih |
| poke | shtytje (verb: shtyj) |
| wake (a team) | zgjoj |
| assumption | supozim |
| night watch | roja e natës |
| going quiet | në heshtje |
| No Token Mode | No Token Mode (feature name kept) |
| token | token (plural: tokenë) |
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
| GO (answer button) | Shko (the literal word GO stays in sentences that quote the reply) |

## For the reviewer
- "Për t'u bërë" / "Në punë" / "Kryer" for the columns, and "Ekipi po kontrollon" for Team checking: check they fit as column names.
- "drejtues" for lead vs "lider"; "tabelë" for board vs "bord"; "kartë" for card.
- "Shtytje / shtyj" for poke and "Në heshtje" for going quiet are guesses.
- Possessives of a filled-in name ("Claude të {name}", "tabela e {name}", "Kopshti i Davy") avoid case endings on the name; check they read naturally.
- Plurals use one / other only; "{count} {{dev:commit-e}}" and similar loanword plurals need a look.
- "Mirë se vjen", "Natën e mirë" and other warm lines are stock phrases: check the tone fits.
