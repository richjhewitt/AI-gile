# Greek (el) first pass

Card AIG-491. File: `public/lang/el.json` (1929 keys). Needs a native check.

## Register
- Casual singular "εσύ" (as in LocoRadio's el.json), monotonic Greek script. Dates use `el-GR`.
- Plurals: `one` / `other` (Greek has no other categories); a negative or zero count follows `other`.
- Gender: the reader's gender is unknown. Greek past participles and adjectives about the reader are avoided where possible; otherwise "/η" forms are used ("έτοιμος/η", "μόνος/η"). Names of other people use "Ο/Η {name}" because the name's gender is unknown.
- Developer words are kept in Latin script, the way Greek software teams really write them: Backlog, Sprint, Stand-up, Bug, Test, Commit, Push, Branch, Merge, Repo, Deploy, Kanban, Hook, Token, PR, WIP, Frontend, Backend. `gloss.*.also` also lists Greek spellings (σπριντ, τεστ, μπαγκ).
- Greek is used for everyday words: κάρτα, πίνακας, έργο, ομάδα, επικεφαλής, εργασία, δοκιμή.

## Glossary
| English | Greek | Note |
|---|---|---|
| card | κάρτα | |
| board | πίνακας | |
| project | έργο | |
| team | ομάδα | |
| lead | επικεφαλής | "Lead Scrum Master" kept in English; role `Lead` kept in the role list |
| Scrum Master | Scrum Master | kept |
| For you | Για σένα | |
| To do | Προς υλοποίηση | |
| In progress / Doing | Σε εξέλιξη | |
| Team checking | Η ομάδα ελέγχει | |
| For the team | Για την ομάδα | |
| Verify (For you to test) | Για σένα για {{dev:test}} | |
| Done | Ολοκληρώθηκε | short "Έγινε" on buttons |
| backlog | Backlog | kept Latin |
| sprint | Sprint | kept Latin |
| stand-up | Stand-up | kept Latin |
| inbox | Εισερχόμενα | |
| Setup | Ρυθμίσεις | |
| Look (🎨) | Εμφάνιση | "Προβολές" is Views |
| Views | Προβολές | |
| test steps | βήματα {{dev:test}} | |
| bug | bug | kept Latin |
| commit / push / merge / repo | kept in Latin | |
| branch | branch | glossary also lists κλάδος |
| assumption | παραδοχή | |
| night watch | νυχτερινή βάρδια | "Night watchman" = νυχτερινός φύλακας |
| No Token Mode | λειτουργία Χωρίς Tokens | |
| token | token | kept Latin |
| Usage | Χρήση | |
| poke | σκούντημα / σκουντάω | |
| wake | ξύπνημα / ξυπνάω | |
| going quiet | ησυχάζω | |
| DM | άμεσο μήνυμα | |
| friend | φίλος | |
| permissions | δικαιώματα | |
| lane / row | γραμμή | |
| column | στήλη | |
| group | σύνολο | "ομάδα" is taken by team |
| tour | ξενάγηση | |
| wizard | οδηγός | |
| focus | συγκέντρωση | |
| checklist | λίστα ελέγχου | |

## For the reviewer
- "Σκούντημα" for Poke may sound playful or odd; alternatives: "Υπενθύμιση", "Ώθηση".
- Card "group" is "σύνολο" to avoid clashing with "ομάδα" (team): check it reads naturally.
- "Προς υλοποίηση" for To do is formal; "Να γίνει" is a more casual alternative.
- Many strings use "Ο/Η {name}" and "/η" endings; decide on a convention.
- `gloss.*.also` lists are match words (Greek spellings plus English); check they are sensible.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script and `node tools/i18n/check.mjs el`).
