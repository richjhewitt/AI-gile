# Yorùbá (yo): first pass

First pass by a model (AIG-496), for a native-speaker check. File: `public/lang/yo.json`, 1939 keys, same keys and order as `en.json`. Written with full tone marks and subdots (ẹ ọ ṣ), as in LocoRadio's Yoruba. Dates use `yo-NG`.

## Register
- Friendly, casual and short, close to LocoRadio's Yoruba. The reader is addressed as "o" / "rẹ" (singular, informal); the polite plural "ẹ" is not used for one reader.
- Yoruba has no grammatical gender, so the reader, agents and friends need no workaround; third person is "wọ́n" (they) for teams and agents, and the name `{name}` for a friend.
- Buttons are verbs in the imperative ("Fi pamọ́", "Fagilé", "Gbà"), statuses use the continuous marker "ń" ("Ń gbé e jáde...").
- Plurals: `yo` has only `other` in Intl.PluralRules, so every plural object gives `one` and `other` with the same text, as docs/i18n.md asks. Yoruba does not inflect nouns for number; "àwọn" is added only where it reads naturally.
- Names, keys, `aigile` commands, emoji, `{placeholders}`, `**bold**`, `<tags>` and `{{dev:...}}` markers are untouched.

## Glossary
| English | Yorùbá | Note |
|---|---|---|
| card | káàdì | |
| board | pátákó | |
| project | iṣẹ́ àkànṣe | |
| lead | olórí | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | ẹgbẹ́ | |
| helpers | olùrànlọ́wọ́ | |
| agent | aṣojú | |
| For you | Fún ọ | `col.verify.short` |
| To do | Láti ṣe | |
| In progress | Ń lọ lọ́wọ́ | |
| Team checking | Ẹgbẹ́ ń ṣàyẹ̀wò | |
| For you to test | Fún ọ láti dánwò | |
| For the team | Fún ẹgbẹ́ | |
| Done | Ti parí | |
| Backlog | Backlog | loanword |
| Sprint | Sprint | loanword |
| Stand-up | Stand-up | loanword |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Àpótí ìwé | |
| Messages / DMs | Àwọn ìfiránṣẹ́ / Àwọn ìfiránṣẹ́ àdáni | |
| Setup | Ètò | |
| Usage | Lílò | |
| Home | Ilé | |
| test | idánwò (dánwò) | noun and verb forms are in `gloss.test.also` |
| test steps | àwọn ìgbésẹ̀ idánwò | |
| bug | bug | loanword |
| commit / push / branch / merge / repo | Commit, Push, Branch, Merge, Repo | loanwords |
| assumption | ìfojúdá | see reviewer notes |
| night watch | ìṣọ́ òru | "olùṣọ́ òru" for the watchman |
| No Token Mode | Ipò Kò sí Token | |
| token | token | loanword |
| poke | rán létí | "👉 Rán létí" (remind) |
| Accept / Send back | Gbà / Dá padà | |
| Go (answer) | Bẹ̀rẹ̀ | `dms.go`, `act.go` |
| Views | Àwọn ìwòye | |
| Permissions | Àwọn ìyọ̀ǹda | |
| Going quiet | Dákẹ́ | |
| Friend(s) | ọ̀rẹ́ (àwọn ọ̀rẹ́) | |
| Tour | Ìrìn àjò | |
| Theme / Language | Àkòrí / Èdè | |
| folder / file | fódà / fáìlì | loanwords |
| server | sáfà | loanword |

## For the reviewer
- Tone marks and subdots were written by a model: please check them, especially on less common words.
- "Assumption" is the hardest word: "ìfojúdá" (expectation) is a best guess; "àbá" or "ìgbàgbọ́" might be what a native speaker prefers.
- "iṣẹ́ àkànṣe" (project) is long for tabs and buttons; a native speaker may prefer shorter "iṣẹ́".
- `{{dev:...}}` markers: "dánwò", "idánwò", "sprint", "bug", "commit(s)", "Backlog" match `gloss.*.word` / `.also`. Test is a verb in some lines ("láti {{dev:dánwò}}") and a noun in others ("{{dev:idánwò}}"); both are listed.
- Other words to look at: "pátákó" for board, "Ipò Kò sí Token", "Ìfojúdá"/"Àwọn ìfojúdá" in the nav, "Bẹ̀rẹ̀" for the Go button, "ìṣọ́ òru" for night watch.
- Level words and role names (`prof.level.*`, Frontend, Backend, Full-stack, Mobile, PM / Scrum) stay English, as Yoruba-speaking software teams say them.
- The pretend friend's name Davy is kept.
