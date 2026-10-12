# ខ្មែរ (km): first pass

First pass by a model (AIG-495), waiting for a native-speaker check. File: `public/lang/km.json`, 1939 keys, same keys and order as `en.json`.

## Register
- Khmer has no he/she in second person and no grammatical gender, so nothing needs working around. The reader is addressed with neutral **អ្នក** ("you"), friendly and not royal or honorific, in line with LocoRadio's Khmer (`web/assets/lang/km.json`). Buttons use plain verbs ("រក្សាទុក", "បោះបង់").
- Script: Khmer. Numbers stay as Western digits (as in LocoRadio's Khmer). Sentence ends use the Khmer full stop "។" in prose; short labels have none. A colon is the ASCII ":" in English-ish labels, "៖" is used before an explanation, as is usual in Khmer UIs.
- Plurals: `Intl.PluralRules('km')` has only `other`. Plural objects carry `one` and `other` with the same text, as LocoRadio does. Khmer does not inflect, so "{count} កាត" stays the same for every count.
- Spaces: Khmer does not put spaces between words, only between phrases. Spaces are kept where the English has them (around placeholders, after punctuation) so that line breaking works.
- `{{dev:...}}` markers: kept exactly where English has them. Inside, the word is the Khmer or loanword the glossary uses (`សាកល្បង` for test; Backlog, Sprint, Bug, Commit stay Latin). Every word in a marker is `gloss.*.word` or in its `.also`.
- Unchanged by design: `{placeholders}`, emoji, `**bold**`, `<code>`, URLs, `aigile avatar`, keys (Enter, Shift+Enter, Esc, Escape), names (AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Discord), the keyword **GO**, file names and code identifiers (`JOIN_OWNER_KEY`, `scrumMaster.aiRunsPerDay`, `npm install`).

## Glossary
| English | ខ្មែរ | Note |
|---|---|---|
| card | កាត | |
| board | ក្ដារ | the Kanban board; "ក្ដារ" literally "board" |
| project | គម្រោង | |
| lead (team lead) | អ្នកដឹកនាំ | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | ក្រុម | |
| helper | ជំនួយការ | |
| agent | agent | kept in English (AI agent) |
| For you | សម្រាប់អ្នក | `col.verify.short` |
| To do | ត្រូវធ្វើ | |
| In progress / Doing | កំពុងធ្វើ | |
| Team checking | ក្រុមកំពុងពិនិត្យ | |
| For you to test | រង់ចាំអ្នកសាកល្បង | |
| For the team | សម្រាប់ក្រុម | |
| Done | រួចរាល់ | |
| Backlog | Backlog | loanword, as dev teams say it |
| sprint | Sprint | loanword |
| stand-up | Stand-up | loanword |
| inbox | ប្រអប់ទទួល | |
| Setup | ការដំឡើង | |
| Usage | ការប្រើប្រាស់ | |
| test / to test | សាកល្បង | `ការសាកល្បង` as noun |
| test steps | ជំហានសាកល្បង | |
| bug | Bug | loanword inside `{{dev:}}` |
| commit | Commit | loanword |
| assumption | ការសន្មត | |
| night watch | អ្នកយាមយប់ | "night watchman" |
| No Token Mode | របៀបគ្មាន Token | token stays Latin |
| Accept | ទទួលយក | |
| Send back | បញ្ជូនត្រឡប់ | |
| Wake the team | ដាស់ក្រុម | |
| poke | ជម្រុញ | |
| DM / direct message | សារផ្ទាល់ | |
| friend | មិត្តភក្តិ | |
| permissions | ការអនុញ្ញាត | |
| archive | ប័ណ្ណសារ | |
| glossary | វចនានុក្រម | |
| tour | ដំណើរណែនាំ | |

## For the reviewer
- Plural objects hold the same text twice (`one` and `other`); check the counter-less forms read well ("{count} កាត").
- Humour and idioms were adapted, not translated: `sm.push.*` ("Keep the plates spinning", "Crack the whip") and `quiz.*`. Check they are natural and not odd.
- Wake/poke/nudge: I used ដាស់ (wake) and ជម្រុញ (nudge); check these read as the board's own jargon.
- Technical placeholders and paths (`servers.path.ph`, `servers.ssh.ph`) are unchanged on purpose.
- Terminology: ក្ដារ for board and ក្រុម for team; confirm these are the terms Cambodian dev teams really use, or whether Latin "board" is preferred.
- Davy, the pretend friend, is "he" in English; Khmer text uses the name or a neutral noun.
