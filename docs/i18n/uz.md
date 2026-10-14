# Oʻzbekcha (uz, Latin script): first pass

First pass by a model (AIG-495), native-speaker review still to do. File: `public/lang/uz.json`, 1939 keys, same keys and order as `en.json`.

## Register
- Polite **siz** (as in LocoRadio's Uzbek: "qurilmangiz", "Siz uchun"). Buttons use the infinitive/noun form ("Saqlash", "Bekor qilish"); sentences address the reader as "siz" ("Ismingizni yozing").
- Script: Latin (the 1995 official orthography). Apostrophes: `ʻ` (U+02BB) after o and g (oʻ, gʻ), `ʼ` (U+02BC) for the glottal stop (aʼzo, maʼlumot, masʼul). Normalised by a script, so please keep these two characters.
- Quotes: « » for names of things in sentences.
- Plurals: Uzbek has no grammatical plural after a number, so every plural object is `{one, other}` with the same text ("{count} ta karta"). The counter "ta" is used with numbers.
- No grammatical gender in Uzbek, so nothing to avoid; the pretend friend, agents and the reader are never gendered.
- Placeholders such as `{name}`, `{id}`, `{col}` are kept in the nominative; case suffixes are attached directly only after short ids where it reads naturally ("{lead}ga", "{col}da", "{name} ga"). Check these.
- Keyboard keys, `aigile` commands (`aigile avatar`), `npm install`, URLs and file names untouched. The keyword the lead waits for stays **GO** / Go.
- Dev words inside `{{dev:...}}` markers stay as English loanwords (test, bug, sprint, backlog, commit) because that is what Uzbek software teams say.

## Glossary
| English | Oʻzbekcha | Note |
|---|---|---|
| card | karta | |
| board | doska | "board" is also heard; "doska" kept for plain reading |
| project | loyiha | |
| lead | rahbar | "jamoa rahbari" where room allows |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | jamoa | |
| helpers | yordamchilar | |
| agent | agent | |
| For you | Siz uchun | `col.verify.short` |
| To do | Bajarilishi kerak | |
| In progress | Jarayonda | |
| Team checking | Jamoa tekshirmoqda | |
| For you to test | Siz {{dev:test}} qilishingiz kerak | |
| For the team | Jamoa uchun | |
| Done | Bajarildi | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | loanword |
| Stand-up | Stand-up | loanword, plural "stand-uplar" |
| inbox | Kiruvchilar | |
| Setup | Sozlamalar | |
| Usage | Sarf | plan/token usage |
| test steps | test qadamlari | |
| Accept / Send back | Qabul qilish / Qaytarish | |
| assumption | taxmin | page title "Taxminlar" |
| night watch | tungi qorovul | |
| No Token Mode | Token yo'q rejimi | |
| going quiet | jim bo'lish | |
| poke | turtish | "turtki" for noun |
| wake (a team) | uyg'otish | |
| blocked / blocker | to'siqda / to'siq | |
| comment | izoh | |
| DM | shaxsiy xabar | |
| friend | do'st | |
| glossary | lug'at | |
| tour | tur | |
| wizard | usta | |
| pretend friend | soxta do'st | |
| token | token | loanword |
| Views | Ko'rinishlar | saved filters |
| Look | Ko'rinish | project colour/emoji dialog |

## Reviewer should look at
- "doska" vs "board", "rahbar" vs "lid/lider", and "usta" for wizard (other options: "sehrgar", "yordamchi").
- Case suffixes after placeholders (`{name}ga`, `{col}da`, `{lead}ga`) and "{name}ning ..." forms avoided with brackets ("Claudeʼdan so'rash ({name})").
- Apostrophe characters (ʻ and ʼ) render correctly in the UI font.
- Long help texts (usage, budget, scale.push.help) for natural flow; they are close to the English structure.
- `gloss.*.also` lists are Uzbek plural forms the glossary should match in the UI.
