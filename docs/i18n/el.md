# Greek (el)

Card AIG-491. File: `public/lang/el.json` (1932 keys). First pass by a model, then a native-speaker review (see Review below).

## Register
- Casual singular "εσύ" (as in LocoRadio's el.json), monotonic Greek script. Dates use `el-GR`.
- Plurals: `one` / `other` (Greek has no other categories); a negative or zero count follows `other`.
- Gender: the reader's gender is unknown, so there are no "/η" forms. Sentences about the reader use verbs (Greek verbs carry no gender), nouns or impersonal forms ("Ακόμα αβέβαιο", "και όλα είναι έτοιμα", "αν έχεις αμφιβολίες"). A friend's name is never preceded by "Ο/Η" or "τον/την": use "η επαφή {name}" (feminine noun, so "της επαφής {name}", "στην επαφή {name}"), a label ("Από: {name}", "Αποστολή: {name}") or "την άλλη πλευρά"; "τους" (their) is plural and neutral. The pretend friend Davy is male; agents and roles ("ο πράκτορας", "ο επικεφαλής") stay grammatically masculine.
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
| Verify (For you to test) | Για {{dev:test}} από σένα | short "Για σένα" |
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
| going quiet | λείπω / απουσία | "🌙 Λείπω", "🌙 Φεύγω" |
| DM | άμεσο μήνυμα | |
| friend | φίλος | |
| permissions | δικαιώματα | |
| lane / row | γραμμή | |
| column | στήλη | |
| group | ενότητα | "ομάδα" is taken by team, "σύνολο" reads as total |
| tour | ξενάγηση | |
| wizard | οδηγός | |
| focus | συγκέντρωση | |
| checklist | λίστα ελέγχου | |
| dev words | όροι προγραμματισμού | never "λέξεις των developers" |
| AI tester | δοκιμαστής AI | |
| AI passed | εγκρίθηκε από AI | chips "🤖 Πέρασε / Απέτυχε / Δεν ελέγχθηκε" |
| chip (filter) | ετικέτα | |
| feature | λειτουργία | type label too |
| brief (agent prompt) | οδηγίες | |
| plug (an assumption) | διόρθωση | |
| waits for (dependency) | εξαρτάται από | |
| friend's name | η επαφή {name} | see Gender |
| Reporter (role) | Reporter | kept, like Developer |
| days (short) | ημ | "μ" was ambiguous |

## For the reviewer (first pass questions)
- "Σκούντημα" for Poke may sound playful or odd; alternatives: "Υπενθύμιση", "Ώθηση".
- Card "group" is "σύνολο" to avoid clashing with "ομάδα" (team): check it reads naturally.
- "Προς υλοποίηση" for To do is formal; "Να γίνει" is a more casual alternative.
- Many strings use "Ο/Η {name}" and "/η" endings; decide on a convention.
- `gloss.*.also` lists are match words (Greek spellings plus English); check they are sensible.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script and `node tools/i18n/check.mjs el`).

## Answers to the first-pass questions
- "Σκούντημα" for Poke: kept. Greeks know it from Facebook's poke and it fits the playful tone; "Υπενθύμιση" is used where English says "nudge" in running text.
- Card group: "ενότητα", not "σύνολο" (which reads as "total").
- "Προς υλοποίηση" for To do: kept; it is what Greek Jira-style boards use and it fits a column header. "Να γίνει" is too loose.
- "Ο/Η" and "/η": removed everywhere; see Gender in Register.
- `gloss.*.also`: sensible; kept.

## Review
Native-speaker pass over all 1932 values (410 values changed, including 3 new keys).
- Added the missing `boot.retry`, `boot.broke`, `boot.reload`.
- Removed every "/η", "/α", "/ες", "Ο/Η", "τον/την", "του/της" form (89 values): "η επαφή {name}", labels such as "Από: {name}", "την άλλη πλευρά", or impersonal wording. `quiet.sent` "ομάδα/ες" became "Στάλθηκε σε ομάδες: {n}".
- Going quiet: "Ησυχάζω" -> "Λείπω" / "Φεύγω" and "όταν λείπεις" (it reads as "I'm calming down" otherwise).
- Card group: "σύνολο" -> "ενότητα" in all `inbox.g.*`, `group.*`, `card.f.group`, `filter.groups`.
- Dev words: "λέξεις των developers" -> "όροι προγραμματισμού" (glossary, tour, help, scale.words.*).
- AI tester: "AI δοκιμαστής" -> "δοκιμαστής AI"; "chip" -> "ετικέτα"; "feature" -> "λειτουργία".
- Wrong meanings fixed: `lead.smRole.help` (wakes teams that have To do cards), `space.menu.title` ("εξαγωγή" meant export), `wait.*` (a dependency, now "Εξαρτάται από"), `assume.plug*` ("Κλείσ' το" read as dismiss; now "Διόρθωση"), `tour.chat.text` (plural verb for one lead), `queue.holds`.
- Calques and register: "Κράτα τα πιάτα να γυρίζουν", "νιώθεται", "σώπασε", "ντουγρού", "Στήσε", "συνεχές σχολιασμός" (gender error), "Ένα μωβ ρόμβος" (gender error), "Συμπαγείς" -> "Πυκνές".
- `col.verify`: "Για σένα για test" (double "για") -> "Για test από σένα".
- Day abbreviation "μ" -> "ημ" (`ago.d`, `usage.unit.d`, 7-day labels): "μ" also reads as minutes or months.
- Button names inside sentences are quoted («🎨 Εμφάνιση», «❓ Βοήθεια», «👥 Ομάδα»).
- Restored the trailing space on `inbox.sum.*` and `act.*.say`, which are joined to the next text.

Still worth a human look:
- "η επαφή {name}" is correct but slightly formal; check it reads well in the share and friends screens.
- "Λείπω" for Going quiet loses the night/sleep feel of the English.
- "Για test από σένα" mixes Latin and Greek in a column header; "Για δοκιμή από σένα" is the all-Greek option if the `{{dev:...}}` word may be Greek.
- Agents, roles and the lead stay grammatically masculine ("μόνος του", "ο επικεφαλής") by design.
