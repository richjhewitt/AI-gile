# Serbian (sr, Cyrillic) first pass

Card AIG-492. File: `public/lang/sr.json` (1929 keys, same keys and order as `en.json`). Needs a native check.

## Register
- Casual "ти" (as in LocoRadio), Cyrillic script only, ekavian standard Serbian. Dates use `sr-RS`. Latin-script terms are limited to loanwords that are kept as written (Backlog, push, hook, Scrum, README, API).
- Gender: past participles are gendered, so reader-facing messages avoid them (imperative, present, passive, "Здраво" instead of "Добродошао/ла"). The Scrum Master's own first-person notes (`srv.*`) use the masculine because "Scrum Master" and "вођа" are masculine nouns; flagged below.
- Plurals: `one` / `few` / `other`. Plural objects give all three. In plain strings counts are phrased with the genitive plural or "Ставки: n" style where short; some long count strings may still read oddly for 2 to 4.
- `{{dev:...}}` wraps the Serbian word (спринт, баг, тест, комит, ...) like the other languages.
- `gloss.*.also` hold inflected Serbian forms plus the English words.

## Glossary
| English | Serbian | Note |
|---|---|---|
| card | картица | |
| board | табла | |
| project | пројекат | |
| team | тим | |
| lead | вођа | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | За тебе | |
| To do | За рад | review: maybe "На реду" |
| In progress / Doing | У току | |
| Team checking | Тим проверава | |
| For the team | За тим | |
| Verify | За тебе за {{dev:тестирање}} | |
| Done | Готово | |
| backlog | Backlog | loanword |
| sprint | спринт | plural спринтови |
| stand-up | стендап | plural стендапови |
| inbox | Пријемно сандуче | |
| Setup | Подешавања | |
| test steps | кораци тестирања | |
| bug | баг | plural багови |
| commit | комит | |
| push / merge / repo | push / спајање / репозиторијум | |
| branch | грана | |
| assumption | претпоставка | |
| night watch | ноћна стража | "watchman" = ноћни чувар |
| No Token Mode | Режим без токена | |
| token | токен | |
| Usage | Потрошња | |
| poke | гурнути / гурни | |
| going quiet | одмор / повући се | |
| DM | директна порука | |
| friend | пријатељ | |
| permissions | дозволе | |
| view | приказ | |
| column | колона | |
| attachment | прилог | |
| archive | архивирај | |
| tour | обилазак | |
| wizard | чаробњак | |
| focus | фокус | |
| checklist | контролна листа | |
| hook | hook | |
| pretend friend | измишљени пријатељ | |
| Life board | табла за живот | |
| Steady (push level 3) | Уједначено | |
| AI passed | AI одобрио | |

## For the reviewer
- "За рад" for To do is a calque; "На реду" may be more natural.
- Some masculine forms remain in agent-voice messages (`srv.*`, `pt.*`, "је рекао/прихватио" style with a friend's `{name}`); please decide on a convention.
- "Пријемно сандуче" for Inbox is long for a tab; "Пошта" or "Примљено" are shorter alternatives.
- "Гурни" for Poke, "Ноћна стража" and "Повући се" (going quiet) are my choices.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script). `GO` stays English where the English text asks the user to answer with it.
