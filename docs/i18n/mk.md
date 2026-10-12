# Macedonian (mk) first pass

Card AIG-494. File: `public/lang/mk.json` (1939 keys, same key set and order as `en.json`). Native-speaker review done: see Review below.

## Register
- Casual "ти" (as in LocoRadio), Cyrillic script, standard Macedonian. Dates use `mk-MK`.
- Gender: no slashes and no gendered forms for the reader, the agents or a friend. Phrased with present tense, passive, nouns or questions ("Пак сум тука", "од тебе", "Ново ми е ова"). Macedonian past tense of the first person (запрев, не можев) is gender-free, so the Scrum Master's first-person notes use it.
- Plurals: Macedonian has `one` and `other` in `Intl.PluralRules`; the `{one, other}` objects use those. After a number the count form is used (2 картички, 5 тима).
- `{{dev:...}}` markers wrap the Macedonian dev word (тестирање, спринт, баг, комит); `Backlog` stays in English inside the marker. `gloss.*.also` lists Macedonian and Latin spellings.

## Glossary
| English | Macedonian | Note |
|---|---|---|
| card | картичка | |
| board | табла | |
| project | проект | |
| team | тим | |
| lead | лидер | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | За тебе | |
| To do | За работа | |
| In progress / Doing | Во тек | |
| Team checking | Тимот проверува | |
| For the team | За тимот | |
| Verify | За твое {{dev:тестирање}} | |
| Done | Готово | |
| backlog | Backlog | kept in Latin script |
| sprint | спринт | plural спринтови |
| stand-up | стенд-ап | plural стенд-апови |
| inbox | Сандаче | |
| Setup | Поставки | |
| Usage | Потрошувачка | |
| test steps | чекори за {{dev:тестирање}} | |
| bug | баг | plural багови |
| commit | комит | |
| push / merge / deploy | Push / Merge / Деплој | push and merge kept in Latin |
| branch | бранч | |
| repo | репо | |
| token | токен | |
| assumption | претпоставка | |
| night watch | ноќна стража | night watchman = ноќен чувар |
| No Token Mode | Режим без токени | |
| poke | подбуцни | noun: подбуцнување |
| going quiet | се повлекувам | |
| DM | директна порака | |
| friend | пријател | |
| permissions | дозволи | |
| view | поглед | plural погледи |
| column | колона | |
| attachment | прилог | |
| archive | архивирај | |
| tour | обиколка | a stop = постојка |
| wizard | волшебник | |
| focus | фокус | |
| checklist | листа за проверка | |
| pretend friend | измислен пријател | |
| Life board | табла за живот | |
| Steady (push level 3) | Стабилно | |
| AI passed | Одобрено од AI | chips stay Помина / Падна |
| Go (button, plan reply) | Може | go-ahead; in a plan "МОЖЕ?" |
| waiting on you / needs you | те чека / те бара | |
| Undo | Поништи | Врати is Send back |
| Pro-friendly | Погодно за Pro | |

## For the reviewer
- `leave.confirm` ("{what} anyway and lose it?") is stiff: `{what}` is a noun (Ажурирање/Освежување/Рестартирање) so the sentence is clumsy.
- `dms.go` / `act.go` use "Тргни" for Go; check this reads as go-ahead, not "move away".
- "Лидер" for lead and "картичка" for card are my choices; Macedonian teams may say "водач" and "карта".
- "Табла" (board) is common but "дска" is also heard; check.
- Gender-neutral rewrites in `sb.*`, `share.*`, `pt.*` may sound formal.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).

### Answers (native review)
- `leave.confirm`: fixed. `update.what.*` are only used inside this sentence, so they are now 2nd-person verbs (ажурираш / освежиш / рестартираш): "Имаш неиспратен одговор. Сепак да ажурираш и да го изгубиш?"
- Go: "Тргни" reads as "set off / move away". Now "Може" (OK, go ahead) on `dms.go`, `act.go`, the tour text and `scale.go.2`; the pretend lead's plan ends "МОЖЕ?".
- "Лидер" and "картичка" stay: both are what Macedonian teams say in software ("водач" sounds like a tour guide, "карта" is a map or playing card).
- "Табла" stays; "дска" is Serbian/Bulgarian-flavoured and not used for kanban boards.
- Gender-neutral rewrites: kept where they read well; masculine forms that slipped in for the reader were removed ("си потребен", "си сигурен", "сам се враќаш", "како да сум нов", "ако си го добил").

## Review
Native-speaker pass over all 1,939 values (card AIG-494). 198 values changed (191 rewritten, 7 added).
- Added the 7 missing keys (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).
- Go button reads as go-ahead: "Може" everywhere (see above).
- Glossary: view = поглед (was прикажување), tour = обиколка with постојки (was тура / застанувања), AI passed = Одобрено од AI, Undo = Поништи (was Врати, which clashed with Send back).
- "чека на тебе" → "те чека" / "те бара" throughout (inbox, tour, rail, happening, standup).
- Real errors fixed: "простории" (rooms) → пространи, "Простор" → Пространо, "на секоја неколку секунди", "да се проверат и споени", "се уште" → "сè уште", "Е во твојата купчина" (clitic first), "Покажи ѝ на {name}" (feminine clitic), "засега", "{name} е блокиран" / "е додаден" (gendered).
- Calques smoothed: "токму сега" → штотуку, "Удри го камшикот" → Со камшик, "Одржувај ги чиниите да се вртат", "Пријателски за Pro" → Погодно за Pro, "Нема совпаѓачки картички", "Креатор на значки", "Каде седи {name}", "На тоа сум!" → Почнувам!, "мид" → медиор.
- Formal plural "извршете / проверете" → casual ти forms; status words for "Nearly out" now "Скоро потрошено", not "готово".
- Watchman switch is quoted the same way in `sm.night.title` and `lead.watchAll`.

Still worth a human look:
- "Се повлекувам" for Going quiet, and "подбуцни" for Poke: correct but playful; a native may prefer "Пауза" or "Потсети".
- "Сандаче" for Inbox and "Поставки" for Setup read fine; a native may prefer "Пристигнати".
- `role.*` and `share.role.help.*` use "го/неговиот" for the role noun (Член, Пријавувач): grammatical, but a human may want neutral phrasing.
- `pretend.*` keeps masculine forms on purpose: the pretend friend is Davy (English says "him").
