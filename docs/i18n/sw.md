# Kiswahili (sw): first pass

First pass by a model (AIG-493), for a native-speaker check. File: `public/lang/sw.json`, 1932 keys, same keys and order as `en.json`. Dates use `sw-KE`.

## Register
- Friendly, direct and casual, as in LocoRadio's Swahili: short imperatives for buttons ("Hifadhi", "Ghairi", "Tuma") and the infinitive ("Kuiomba timu...") for confirmation questions. No honorific plural ("ninyi") for the reader.
- Swahili pronouns are gender-neutral (yeye), so the reader, agents and friends need no workaround. Person-class verb prefixes (a-/wa-) are used for people, ki-/i-/zi- agreement for cards (kadi is class 9/10: "kadi zimekamilika", "zinaendelea").
- Plurals: `one` / `other` (Intl.PluralRules gives only these). Swahili usually puts the number after the noun with no change ("kadi {count}"), so both forms are the same where the noun does not change.
- Keyboard keys, `aigile` commands, product and model names left untouched.

## Glossary
| English | Kiswahili | Note |
|---|---|---|
| card | kadi | |
| board | ubao | |
| project | mradi (miradi) | |
| lead | kiongozi | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | timu | |
| helpers | wasaidizi | |
| agent | wakala (mawakala) | |
| For you | Kwako | `col.verify.short` |
| To do | Za kufanya | |
| In progress | Zinaendelea | |
| Team checking | Timu inakagua | |
| For you to test | Za kujaribu kwako | |
| For the team | Kwa timu | |
| Done | Zimekamilika | plural, since the column holds cards |
| Backlog | Backlog | loanword |
| Sprint | Sprint | loanword |
| Stand-up | Stand-up | loanword |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Kikasha | |
| Setup | Mipangilio | |
| Usage | Matumizi | |
| Home | Mwanzo | |
| test steps | hatua za kujaribu | glossary word is "Jaribio" with "test" accepted |
| bug | bug | loanword, plural "bugs" |
| commit | commit | |
| assumption | dhana | |
| night watch | mlinzi wa usiku | |
| No Token Mode | Hali ya Bila Tokeni | |
| token | tokeni | |
| poke | kusukuma / msukumo | "nudge"; button "👉 Sukuma" |
| Accept / Send back | Kubali / Rudisha | |
| Views | Miwonekano | |
| Stand-up report | Ripoti ya stand-up | |
| Look (settings) | Mwonekano | |
| Permissions | Ruhusa | |
| Going quiet | Kunyamaza | |
| Friends (DMs) | marafiki | |
| Tour | Ziara | |
| Go (answer) | Endelea | `dms.go`, `act.go` |

## For the reviewer
- Developer words kept as English loanwords (backlog, sprint, stand-up, bug, commit, push, branch, merge, repo, deploy, hook, pull request); the glossary `.also` lists include plural forms ("bugs", "sprints").
- `{{dev:...}}` markers inside values carry the displayed word and must match `gloss.*.word` or `.also`: markers use "test"/"kujaribu", "bug"/"Bugs", "Sprint", "Stand-up". Check they highlight as intended.
- "Poke" is rendered as "msukumo" / "kusukuma" (push); "kuamsha" (wake) is used for waking a team. Native speakers may prefer another word.
- "Night watch" is "mlinzi wa usiku" (night guard); the Lead Scrum Master "Lead Scrum Master" stays English.
- Agent first-person lines in `srv.*` use plain "ni-" forms ("niliacha kuianzisha upya"); check the tone fits a friendly bot.
- Level words `prof.level.*` and several role names (Frontend, Backend, Full-stack, PM / Scrum, Data) are kept in English, as teams say them.
- The pretend friend's name Davy is kept; the friend is addressed by name only, never by pronoun.
