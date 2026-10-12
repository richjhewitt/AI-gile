# ລາວ (lo): first pass

First pass by a model (AIG-495), waiting for a native-speaker check. File: `public/lang/lo.json`, 1939 keys, same keys and order as `en.json`.

## Register
- Lao has no grammatical gender. The reader is addressed with the casual, friendly **ເຈົ້າ** ("you"), as in LocoRadio's Lao (`web/assets/lang/lo.json`). No polite particles are added. Buttons use plain verbs ("ບັນທຶກ", "ຍົກເລີກ").
- Script: Lao. Numbers stay as Western digits (as in LocoRadio's Lao). Lao has little punctuation: the full stop "." and colon ":" are the ASCII ones, used as in the English.
- Spelling: modern Lao with the sara-am form "ຳ" (U+0EB3) and "ໝ/ໜ" (not "ຫມ/ຫນ"). Words start with the Lao-spelled forms; loanwords (Sprint, Backlog, Bug, token) stay Latin.
- Plurals: `Intl.PluralRules('lo')` has only `other`. Plural objects carry `one` and `other` with the same text, as LocoRadio does. Lao does not inflect, so "{count} ບັດ" stays the same for every count.
- Spaces: Lao does not put spaces between words, only between phrases. Spaces are kept where the English has them (around placeholders, after punctuation).
- `{{dev:...}}` markers: kept exactly where English has them. Inside, the word is the Lao or loanword the glossary uses (`ທົດສອບ` for test; Backlog, Sprint, Bug, Commit stay Latin). Every word in a marker is `gloss.*.word` or in its `.also`.
- Unchanged by design: `{placeholders}`, emoji, `**bold**`, `<code>`, URLs, `aigile avatar`, keys (Enter, Shift+Enter, Esc, Escape), names (AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Discord), the keyword **GO**, file names and code identifiers (`JOIN_OWNER_KEY`, `scrumMaster.aiRunsPerDay`, `npm install`).

## Glossary
| English | ລາວ | Note |
|---|---|---|
| card | ບັດ | |
| board | ກະດານ | |
| project | ໂຄງການ | |
| lead (team lead) | ຫົວໜ້າ | |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | ທີມ | loanword, the normal Lao word |
| helper | ຕົວຊ່ວຍ | |
| agent | agent | kept in English (AI agent) |
| For you | ສຳລັບເຈົ້າ | `col.verify.short` |
| To do | ຕ້ອງເຮັດ | |
| In progress / Doing | ກຳລັງເຮັດ | |
| Team checking | ທີມກຳລັງກວດ | |
| For you to test | ລໍຖ້າເຈົ້າທົດສອບ | |
| For the team | ສຳລັບທີມ | |
| Done | ແລ້ວ | short "done" for the column |
| Backlog | Backlog | loanword |
| sprint | Sprint | loanword |
| stand-up | Stand-up | loanword |
| inbox | ກ່ອງຈົດໝາຍ | |
| Setup | ການຕັ້ງຄ່າ | |
| Usage | ການໃຊ້ງານ | |
| test / to test | ທົດສອບ | `ການທົດສອບ` as noun |
| test steps | ຂັ້ນຕອນທົດສອບ | |
| bug | Bug | loanword inside `{{dev:}}` |
| commit | Commit | loanword |
| assumption | ການສົມມຸດ | |
| night watch | ຄົນເຝົ້າຍາມກາງຄືນ | "night watchman" |
| No Token Mode | ໂໝດບໍ່ໃຊ້ Token | token stays Latin |
| Accept | ຍອມຮັບ | |
| Send back | ສົ່ງກັບ | |
| Wake the team | ປຸກທີມ | |
| poke | ກະຕຸ້ນ | |
| DM / direct message | ຂໍ້ຄວາມສ່ວນຕົວ | |
| friend | ໝູ່ | |
| permissions | ການອະນຸຍາດ | |
| archive | ເກັບຖາວອນ | |
| glossary | ວັດຈະນານຸກົມ | |
| tour | ການແນະນຳ / ການເດີນຊົມ | |

## For the reviewer
- Plural objects hold the same text twice (`one` and `other`); check the counter-less forms read well ("{count} ບັດ").
- Humour and idioms were adapted, not translated: `sm.push.*` ("Keep the plates spinning", "Crack the whip") and `quiz.*`. Check they are natural.
- Wake/poke/nudge: I used ປຸກ (wake) and ກະຕຸ້ນ (nudge); check these read as the board's own jargon.
- Some Lao terms may be the Thai-influenced spoken forms; check ບັດ for card, ກະດານ for board and ຮູບແບບ for theme against what Lao dev teams actually say.
- A few strings in `usage.*` and `budget.*` are long; check they fit buttons and labels.
- Technical placeholders and paths (`servers.path.ph`, `servers.ssh.ph`) are unchanged on purpose.
- Davy, the pretend friend, is "he" in English; Lao text uses the name or a neutral noun.
