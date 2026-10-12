# Ukrainian (uk) first pass

Card AIG-491. File: `public/lang/uk.json` (1929 keys). Needs a native check.

## Register
- Casual "ти" (as in LocoRadio's uk.json), Cyrillic, standard Ukrainian. Dates use `uk-UA`.
- Plurals: all four categories (one, few, many, other) in every plural object. `other` is used for fractions, so it takes the genitive singular ("2,5 картки").
- Gender: the reader's gender is unknown. Where possible the text avoids past-tense verbs about the reader; where not, "(ла)" or "(а)" forms are used ("створив(ла)", "готовий(а)"). Sentences with the board's own voice (Lead Scrum Master, night watch) use masculine ("зупинив", "переніс").
- Developer words inside `{{dev:...}}` are written in Cyrillic the way Ukrainian teams say them (беклог, спринт, баг, коміт, тест).
- Kept in Latin: Scrum Master, Lead Scrum Master, PM, QA, UX/UI, DevOps, API, README, git, push, Go/GO (the button the CLI listens for), WIP, PR.

## Glossary
| English | Ukrainian | Note |
|---|---|---|
| card | картка | |
| board | дошка | |
| project | проєкт | |
| team | команда | |
| lead | лід | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | Для тебе | |
| To do | До виконання | |
| In progress / Doing | У роботі | |
| Team checking | Команда перевіряє | |
| For the team | Для команди | |
| Verify (For you to test) | Тобі на {{dev:тест}} | |
| Done | Готово | |
| backlog | беклог | loanword, Cyrillic |
| sprint | спринт | |
| stand-up | стендап | |
| inbox | Вхідні | |
| Setup | Налаштування | |
| Look (🎨) | Стиль | "Вигляди" is Views |
| Views | Вигляди | |
| test steps | кроки тесту | |
| bug | баг | |
| commit / push / merge / repo | коміт / пуш / мерж / репозиторій | gloss only; "git push" stays in Latin |
| branch | гілка | |
| assumption | припущення | |
| night watch | нічна варта | "Night watchman" = нічний вартовий |
| No Token Mode | Режим без токенів | |
| token | токен | |
| Usage | Витрати | |
| poke | підштовхнути / штовхнути | button "👉 Штовхнути" |
| wake | розбудити | |
| going quiet | замовкаю | |
| DM | особисте повідомлення | |
| friend | друг | |
| permissions | дозволи | |
| lane / row | рядок | |
| column | стовпець | |
| group | група | |
| tour | тур | |
| wizard | майстер | |
| focus | фокус | |
| checklist | чекліст | |

## For the reviewer
- "Штовхнути / підштовхнути" for Poke may read a little blunt; alternatives: "Нагадати", "Розворушити".
- "До виконання" for To do and "Для тебе" for For you are the column names; check they fit the column headers.
- Genderless handling with "(ла)" forms appears in many messages (night.back avoids it; share.*, ask.*, wz.*, pretend.*). Decide on a convention.
- "принсипал" (prof.level.principal) is a transliteration; many Ukrainian teams just say "Principal" or "Principal Engineer".
- `gloss.*.also` lists are match words: Ukrainian inflected forms plus the English ones. Check they are sensible.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script and `node tools/i18n/check.mjs uk`).
