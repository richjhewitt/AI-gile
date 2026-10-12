# Macedonian (mk) first pass

Card AIG-494. File: `public/lang/mk.json` (1932 keys, same key set and order as `en.json`). Needs a native check.

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
| view | прикажување | |
| column | колона | |
| attachment | прилог | |
| archive | архивирај | |
| tour | тура | |
| wizard | волшебник | |
| focus | фокус | |
| checklist | листа за проверка | |
| pretend friend | измислен пријател | |
| Life board | табла за живот | |
| Steady (push level 3) | Стабилно | |
| AI passed | AI помина | |

## For the reviewer
- `leave.confirm` ("{what} anyway and lose it?") is stiff: `{what}` is a noun (Ажурирање/Освежување/Рестартирање) so the sentence is clumsy.
- `dms.go` / `act.go` use "Тргни" for Go; check this reads as go-ahead, not "move away".
- "Лидер" for lead and "картичка" for card are my choices; Macedonian teams may say "водач" and "карта".
- "Табла" (board) is common but "дска" is also heard; check.
- Gender-neutral rewrites in `sb.*`, `share.*`, `pt.*` may sound formal.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script).
