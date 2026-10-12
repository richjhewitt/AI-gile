# AI-gile in Filipino (fil), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Casual, friendly Filipino with natural Taglish, like LocoRadio's Filipino: tech words stay in English ("card", "board", "project", "team", "setup"), grammar and glue words are Tagalog.
- "ka / mo / iyo" (informal you), never "po" or "kayo" for the single user. "ninyo" only where two people are meant (friend links).
- English verbs take the Filipino affix: "I-save", "I-click", "I-refresh", "Mag-attach", "Nagche-check", "Nagte-test".
- Imperatives: "I-" for buttons, "Mag-" / base verb for instructions.
- Dates and times follow fil-PH (Intl). Durations: min, h, d, oras, araw (compact forms kept like English).
- Plurals: "mga" only where it reads naturally; counts use the singular noun ("{n} card", "{n} team").
- `{{dev:...}}` markers kept around dev words in their English form, with the Filipino affix inside where needed (`{{dev:i-test}}`, `{{dev:sprint}}`, `{{dev:bug}}`).

## Glossary
| English | Filipino | Note |
|---|---|---|
| card | card | |
| board | board | |
| project | project | |
| team | team | |
| lead | lead | |
| Lead Scrum Master | Lead Scrum Master | kept |
| Scrum Master | Scrum Master | kept |
| For you | Para sa iyo | |
| To do | Gagawin | |
| In progress / Doing | Ginagawa | |
| Team checking | Chine-check ng team | |
| For the team | Para sa team | |
| Verify column ("For you to test") | Para sa iyo na i-test | |
| Done | Tapos na | |
| Backlog | Backlog | |
| sprint | sprint | |
| stand-up | stand-up | |
| inbox | Inbox | |
| Setup | Setup | |
| Usage | Usage | |
| test / test steps | test / mga hakbang sa test | |
| Send back | Ibalik | |
| Accept | Tanggapin | |
| Wake (team) | Gisingin | |
| Poke | Kalabitin | |
| night watch | Night watch | "Night watchman", "Watchman" kept |
| Going quiet | Tahimik muna | |
| assumption | assumption | |
| No Token Mode | No Token Mode | |
| token | token | |
| agent | agent | |
| Look (🎨) | Look | |
| Permissions | Mga permission | |
| Views | Mga view | |
| DM | DM | |
| Pop out | Pop out | |
| Group (cards) | Group | |
| Space | Space | |
| Life board | Life board | |
| Focus | Focus | |
| Checklist | Checklist | |
| Hook | Hook | |
| Stuck | stuck | |
| Blocked | naka-block | |

## For the reviewer
- Many strings are intentionally identical to English (loanwords, role names, "Setup", "Usage", "Inbox"). Check that the Taglish balance does not feel too English-heavy in the long explanatory paragraphs.
- "Kalabitin" (poke) and "Gisingin" (wake) were chosen over English; check they sound natural on buttons.
- "Plug this" (assumptions) became "Ayusin ito" (fix it); the English is idiomatic and unclear.
- "Ginagawa" for In progress and "Gagawin" for To do read alike; confirm they are distinct enough on column headers.
- "ni {name}" / "kay {name}" are used for names; check the case marker is right when the name is a handle.
- Gendered "his" in the pretend-friend strings became neutral "niya"/"siya" (Filipino has no gender).
