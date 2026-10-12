# Basque (eu) - first pass

Source of rules: LocoRadio docs/i18n.md and eu.json (standard Batua; plurals one / other; dates use eu-ES). Tone: warm, plain, short.

## Register
- "Zu" (the standard software register in Basque), never the marginal "hi". Possessive "zure". Imperatives: "Gehitu", "Ireki".
- Developer words stay as loanwords the way Basque software teams say them (backlog, sprint, stand-up, bug, commit, push, branch, merge, token, hook). `{{dev:...}}` markers are kept exactly where English has them; inside the marker the word takes Basque forms where needed (`{{dev:probatzeko}}`, `{{dev:proba}}`, `{{dev:probaren}}`, `{{dev:probatu}}`).
- Loanwords take a hyphen before Basque suffixes (stand-up-ak, commit-ak, token-ak).
- Plurals: one / other (Intl.PluralRules gives these two for eu); both forms are written as "{count} X" because Basque does not inflect the noun after a number.
- No gendered forms: Basque has no grammatical gender, so nothing to avoid. "Laguna" for friend.
- Short forms: "duela {n} min / h / egun"; bare "{n} min / h / egun".

## Glossary
| English | Basque |
|---|---|
| card | txartela |
| board | taula |
| project | proiektua |
| team | taldea |
| lead | taldeburua |
| Lead Scrum Master | Lead Scrum Master (kept) |
| For you | Zuretzat |
| For the team | Taldearentzat |
| For you to test (Verify) | Zuk {{dev:probatzeko}} |
| To do | Egiteko |
| In progress / Doing | Egiten |
| Team checking | Taldeak aztertzen |
| Done | Eginda |
| Backlog | Backlog |
| sprint | sprint |
| stand-up | stand-up |
| inbox | sarrera-ontzia |
| Setup | Konfigurazioa |
| Usage | Erabilera |
| test (verb / noun) | probatu / proba |
| test steps | proba-urratsak |
| bug | bug |
| Accept | Onartu |
| Send back | Bidali atzera |
| Wait and see | Itxaron eta ikusi |
| poke | bultzada (verb: bultzatu) |
| wake (a team) | esnatu |
| assumption | suposizioa |
| night watch | gaueko zaintza (watchman: zaintzailea) |
| going quiet | isilik egon |
| No Token Mode | No Token Mode (feature name kept) |
| token | token |
| Verbose | Verbose (kept, as in the English setting name) |
| Look (project colour/emoji) | Itxura |
| Permissions | Baimenak |
| Views | Ikuspegiak |
| Docs | Dokumentuak |
| Agent | agentea |
| Pop out | Atera leiho batera |
| Space (🪐) | Espazioa |
| Life board | Bizitzako taula |
| friend | laguna |
| pretend friend | lagun simulatua |
| GO (answer button) | Go (kept; GO in quoted replies) |
| Team news | Taldearen berriak |
| AI tester | AI probatzailea (passed / failed = gaindituta / huts egin du) |

## For the reviewer
- Names with case endings: `{name}` is filled in by the board and Basque needs a suffix (`{name}(r)i`, `{name}(e)k`, `{name}(r)en`). I wrote the (r)/(e) forms so they read right for any name; a native may prefer rewording to avoid the brackets (for example "Mezua {name}-ri" with a hyphen).
- "taldeburua" for lead: some teams would say "lead" or "burua"; check next to "Lead Scrum Master".
- "Egiteko / Egiten / Eginda" as columns and "Zuretzat" for For you.
- Time phrases built from `{when}`/`{time}` (`pres.since` "hasiera: {when}", `night.since`, `standup.answered`, `srv.night.head`): the English passes already-formatted text, so suffixes were avoided where possible.
- `col.verify` "Zuk {{dev:probatzeko}}" and `inbox.t.tag` "Probatzeko": the marker wraps an inflected form.
- Playful lines: `sm.push.*` (🍽️ "Mantendu platerak biraka", 🏇 "Zartagada"), `scale.*`, `quiz.*`.
- Percent signs: Basque writes "%{n}" in the forms used here; check against house style.
- "Verbose" is left in English as the setting name.
