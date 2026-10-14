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
| Setup | Настройки | page name; «в настройках», «из настроек» in running text |
| Usage | Расход | the plan-usage page |
| test | тест / тестировать | |
| test steps | шаги теста | |
| bug | баг | |
| commit / branch / merge / push | коммит / ветка / мерж / пуш | «мерж» without ё, as Russian teams write it |
| pull request | пулл-реквест | |
| AI tester passed / failed | прошла / не прошла | trust options: «уверенно пройденные», «все пройденные» |
| Send back | Вернуть | |
| Accept | Принять | |
| Wake (team) | Разбудить | |
| Poke | Подтолкнуть | |
| night watch | ночной дозор | the watchman = ночной дозорный |
| Going quiet | Уйти в тишину | |
| idle | простаивает | |
| assumption | допущение | "Plug this" = «Поправить» |
| No Token Mode | режим No Token | |
| token | токен | |
| agent | агент | |
| Look (🎨) | Оформление | |
| Permissions | Разрешения | |
| Views | Виды | |
| DM | личные сообщения | "DM" short form not used |
| Pop out | Вынести | |
| friend | друг / друзья | plural where it reads naturally; pretend friend = «друг понарошку» |
| GO (reply word) | GO | the button says «Давай», but what it sends, and the GO? in pt.plan, stay GO: the board looks for that word |
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

## Answers to the questions above
- **Gender of Lead Scrum Master:** the board's own voice is now neutral. `srv.*` no longer uses feminine past tense («остановила», «не поняла»): it uses impersonal and passive forms («перезапуски прекращены», «Непонятно, куда отнести…»). Lines about the Lead Scrum Master avoid «он» where a neutral wording works.
- **`{name}` sentences with a person:** all «(а)» / «(ась)» forms are gone. The sentence is turned round so the verb does not need a gender («{name}: связь прервана с той стороны», «Тест принят: {name}»). This also avoids putting an undeclined `{name}` in a case that needs an ending.
- **«Заткнуть»:** reads as "shut it up" and is rude next to a team's work. Now «✋ Поправить», «Поправлено», «Поправка к допущению».
- **«Расход» for Usage:** works in all three places; kept.
- **«Тебе» as the short For-you column:** fine as a column header and filter chip; kept.
- **Loanwords:** бэклог, стендап, спринт, баг, коммит, пуш, хук are normal. «Мёрж» changed to «Мерж».

## Review
Native-speaker pass for AIG-491 (279 values changed).
- Reader no longer gendered: removed «ты сам», «ты получил», «ты хотел», «Что ты увидел?», «Пока не уверен», «Я вернулся», «Ты выбрал», «как я написал», «будь краток» and similar; neutral forms instead («Нужно подумать», «Я снова здесь», «Выбрана вся помощь»).
- Board voice and agents neutral: `srv.*`, pretend-team lines (`pt.*`), Lead Scrum Master help texts, «Понял» → «Ясно».
- Friends: no «он/его» for a friend; «притворный друг» → «друг понарошку».
- Wrong meaning fixed: `pres.since` and `night.since` got "5 min ago" after «с», now «старт {when}» / «включён {when}»; `inbox.aiall.title` (the tester passed the test, not the other way round); `cols.all.confirm` grammar; `update.what.*` lower case because they sit mid-sentence; GO titles say what is really sent; `pt.plan` ends in GO? again so the GO buttons appear.
- `srv.restart.started` was missing its leading space.
- Setup page is «Настройки» everywhere (was «Настройка», «в ⚙️ Настройке»).
- Calques and stiff phrasing: «Строка на человека» → «По строке на человека», «Выше твоего бюджета» → «Бюджет токенов превышен», «Нет живой цифры» → «Нет актуальных данных», «Сегодня ночью никому ты не нужен» → «Этой ночью от тебя ничего не нужно», «Создатель значков» → «Конструктор значков», and more.
- Undeclined `{name}` after a preposition needing a case: rephrased in most messages; short labels such as «Поделиться с {name}», «От {name}» kept.

Still for a human native speaker:
- Short labels with `{name}` after «с», «от», «у»: fine for foreign or undeclinable names, odd for Russian names that decline.
- «Виды» for Views (alternative: «Представления»), «Друг» for a DM contact, «фича».
- `usage.unit.m` is «м» (minutes); «мин» is clearer if the space allows.

