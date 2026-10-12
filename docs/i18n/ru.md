# AI-gile in Russian (ru)

First pass by Babel for AIG-491, before the native-speaker check.

## Register
- Casual **ты** throughout (never вы), matching LocoRadio's Russian and AI-gile's friendly English. Imperatives in the ты form ("Нажми", "Вставь", "Открой").
- Standard Russian (Russia), ё used where it is normal ("Тёмная", "Всё"). Quotes in running text are « », in values that mirror the English `"` inside a sentence (card titles, JSON-like text) the straight `"` is kept.
- Keyboard keys unchanged: Enter, Shift, Esc, Escape.
- Durations and units: мин, ч, д (and м, ч, д in the usage unit keys). Dates follow ru-RU.
- Plurals use all four categories (one, few, many, other): карточка / карточки / карточек / карточки.
- `{{dev:...}}` markers wrap the whole Russian loanword ("{{dev:Бэклог}}", "{{dev:баг}}", "{{dev:тест}}"). Inflected forms inside the marker follow the sentence ("{{dev:теста}}", "{{dev:тесту}}"). The glossary `*.also` lists carry the inflections so the dotted-word hover finds them.

## Glossary
| English | Russian | Note |
|---|---|---|
| card | карточка | |
| board | доска | |
| project | проект | |
| team | команда | |
| lead | лид | Lead Scrum Master kept in English |
| Scrum Master | Scrum Master | kept in English; Scrum itself kept |
| For you | Тебе | short column name |
| For you to test | Тебе на тест | |
| To do | К выполнению | |
| In progress / Doing | В работе | |
| Team checking | Команда проверяет | |
| For the team | Для команды | |
| Done | Готово | |
| Backlog | Бэклог | |
| sprint | спринт | |
| stand-up | стендап | |
| inbox | Входящие | |
| Setup | Настройка | |
| Usage | Расход | the plan-usage page |
| test | тест / тестировать | |
| test steps | шаги теста | |
| bug | баг | |
| commit / branch / merge / push | коммит / ветка / мёрж / пуш | |
| pull request | пулл-реквест | |
| AI tester passed / failed | прошла / не прошла | |
| Send back | Вернуть | |
| Accept | Принять | |
| Wake (team) | Разбудить | |
| Poke | Подтолкнуть | |
| night watch | ночной дозор | the watchman = ночной дозорный |
| Going quiet | Уйти в тишину | |
| idle | простаивает | |
| assumption | допущение | "Plug this" = "Заткнуть" |
| No Token Mode | режим No Token | |
| token | токен | |
| agent | агент | |
| Look (🎨) | Оформление | |
| Permissions | Разрешения | |
| Views | Виды | |
| DM | личные сообщения | "DM" short form not used |
| Pop out | Вынести | |
| Space | Пространство | |
| Checklist | Чек-лист | |
| Hook | хук | |

## For the reviewer
- **Gender of Lead Scrum Master:** the Scrum Master voice (`srv.*`) is written feminine ("остановила", "не поняла") and the `{who}`/`{name}` lines are neutral. If the board's voice should be masculine or neutral, `srv.*` needs one pass.
- **`{name}` sentences with a person:** where English says "they/their" for a friend ("принял(а)", "прервал(а)", "поделился(ась)") a bracket form is used. Pick neutral phrasing if you prefer.
- **"Допущения" and "Заткнуть":** "Plug this" is rendered as "Заткнуть" (stop up a gap); check it reads as intended and not rude.
- **"Расход" for Usage:** check it works in "Расход по проектам", "Проверить расход сейчас" and the page title.
- **"Тебе" as the short For-you column name:** check the column header and the filter chips still read well.
- **Loanwords:** Бэклог, стендап, спринт, баг, коммит, пуш, мёрж, хук and "Scrum Master" are the real software-team words; check that "мёрж" and "пуш" are not too slangy in the glossary.
- **`servers.ssh.ph`** keeps the example `rich@92.113.144.194` on purpose.
- **Long values:** `usage.note`, `dlg.conn.intro`, `budget.*.help` and the `share.*` help texts are close translations and may run longer than English.
