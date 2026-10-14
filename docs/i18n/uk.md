# Ukrainian (uk)

Card AIG-491. File: `public/lang/uk.json` (1932 keys). First pass by a model, then a native-speaker review (see Review below).

## Register
- Casual "ти" (as in LocoRadio's uk.json), Cyrillic, standard Ukrainian. Dates use `uk-UA`.
- Plurals: all four categories (one, few, many, other) in every plural object. `other` is used for fractions, so it takes the genitive singular ("2,5 картки").
- Gender: the reader's gender is unknown, so there are no "(ла)" / "(а)" forms. Sentences about the reader or a friend use the present tense, passive forms ("створено тобою", "зв'язок завершено з боку {name}"), nouns ("Запитання від {name}", "Твоя роль від {name}") or a restructured sentence. The board's own voice (Lead Scrum Master, night watch) stays masculine ("зупинив", "переніс"); the pretend friend Davy is male.
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
| Look (🎨) | Стиль | quoted as «🎨 Стиль» inside sentences |
| Views | Подання | as in Microsoft/Jira UIs; "вигляд" stays the everyday word for "look" |
| test steps | кроки тесту | |
| bug | баг | |
| commit / push / merge / repo | коміт / пуш / мерж / репозиторій | gloss only; "git push" stays in Latin |
| branch | гілка | |
| assumption | припущення | |
| night watch | нічна варта | "Night watchman" = нічний вартовий |
| No Token Mode | Режим без токенів | |
| token | токен | |
| Usage | Витрати | |
| poke | підштовхнути | button "👉 Підштовхнути" |
| wake | розбудити | |
| going quiet | іду офлайн | "🌙 Іду офлайн", "🌙 Піти офлайн"; "режим офлайн" |
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
| needs you | чекає на тебе | never "потрібен ти" |
| AI passed | схвалено ШІ | chips: "🤖 Пройдено" / "🤖 Не пройдено" |
| pretend friend | уявний друг | |
| plug (an assumption) | виправити | |
| sure / likely pass | напевно / ймовірно | |
| principal (level) | principal | kept in Latin |

## For the reviewer (first pass questions)
- "Штовхнути / підштовхнути" for Poke may read a little blunt; alternatives: "Нагадати", "Розворушити".
- "До виконання" for To do and "Для тебе" for For you are the column names; check they fit the column headers.
- Genderless handling with "(ла)" forms appears in many messages (night.back avoids it; share.*, ask.*, wz.*, pretend.*). Decide on a convention.
- "принсипал" (prof.level.principal) is a transliteration; many Ukrainian teams just say "Principal" or "Principal Engineer".
- `gloss.*.also` lists are match words: Ukrainian inflected forms plus the English ones. Check they are sensible.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script and `node tools/i18n/check.mjs uk`).

## Answers to the first-pass questions
- Poke: "підштовхнути" everywhere (button "👉 Підштовхнути"). "Штовхнути" sounded rude; "Нагадати" loses the "wake a stuck team" sense.
- "До виконання" and "Для тебе" fit as column headers; kept.
- Gender: no "(ла)" forms any more; see Register.
- `prof.level.principal`: "principal" in Latin, as Ukrainian teams say it (junior/mid/senior stay "джуніор/мідл/сеніор", which are common).
- `gloss.*.also`: sensible; added "тесту", "тестування", "бага" so the inflected forms used in `{{dev:...}}` match.

## Review
Native-speaker pass over all 1932 values (270 values changed, including 3 new keys).
- Added the missing `boot.retry`, `boot.broke`, `boot.reload`.
- Removed every "(ла)", "(а)", "сам(а)" form: present tense, passive or noun phrases instead (`inbox.q.asked.html` "Запитання від <b>{who}</b>, {when}", `share.ended.*`, `share.test.*`, `sb.*`, `ask.*`, `wz.*`, `scale.tidy.*`, `fx.sum.h` "За час фокусу").
- Also removed masculine-only phrases about the reader ("ще не певен", "що ти побачив", "ти хотів", "ти отримав", "потрібен ти" -> "чекає на тебе").
- Views: "Вигляди" -> "Подання" (all `views.*`, `board.views*`).
- Going quiet: "замовкаю" -> "іду офлайн" / "режим офлайн" (`home.quiet`, `quiet.*`, `ng.off`, `sm.night.what`, `lead.watchAll.help`, `wz.adv.night.sub`).
- AI tester: "Пройшло ШІ" -> "Схвалено ШІ"; chips "🤖 Пройдено / Не пройдено"; trust levels "напевно / ймовірно" with `trust.help` rewritten.
- Pretend friend: "удаваний" -> "уявний"; pretend AI -> "імітація ШІ".
- Assumptions: "Plug" -> "✋ Виправити" (was "Закрити", which read as dismiss).
- Wrong meanings fixed: `lead.smRole.help` (wakes teams that have To do cards, not "with a To do card"), `perm.intro.html` (may do without asking you), `poke.held.cap` (plural with {n}), `srv.night.none`, `usage.runs.explain` ("Вхід", not "Вхідні").
- Calques and register: "штурханець" -> "нагадування", "Ляснути батогом" -> "Підганяти батогом", "підтюнь" -> "підлаштуй", "клікабельні" -> "активні", "не заслуговує довіри" -> "неперевірене джерело", "Вік" -> "Давність".
- Button names inside sentences are now quoted in the nominative («🎨 Стиль», «❓ Допомога», «👥 Команда») instead of being declined.
- Restored the trailing space on `inbox.sum.*` and `act.*.say`, which are joined to the next text.

Still worth a human look:
- "Подання" for Views: standard in Microsoft UIs, but some may prefer "Збережені фільтри".
- "Іду офлайн" for Going quiet: clear, but less playful than the English.
- "Розібрати мою купу" (`tidy.btn`): "купа" for the pile of cards is informal; check it reads as intended.
- Masculine voice for the Lead Scrum Master and the night watch ("я переніс", "я зупинив") is kept by design.
