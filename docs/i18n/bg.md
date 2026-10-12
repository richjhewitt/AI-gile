# Bulgarian (bg) first pass

Card AIG-492. File: `public/lang/bg.json` (1932 keys, same keys and order as `en.json`). Needs a native check.

## Register
- Casual "ти" (as in LocoRadio), Cyrillic script, standard Bulgarian. Dates use `bg-BG`.
- Gender: Bulgarian past participles are gendered, so reader-facing messages avoid them: imperatives ("Попълни", "Избери"), present tense, passives ("създадени от теб") or a noun. "Welcome" is "Здравей" (not "Добре дошъл/дошла"). Past aorist forms ("прие", "върна", "каза") are gender-free and are used freely.
- Plurals: Bulgarian has `one` / `other`. Plural objects give both; the plain strings use a neutral form where possible.
- Loanwords kept as is, as Bulgarian dev teams say them: Backlog, push, hook(-ове), Scrum, Scrum Master, Frontend/Backend, DevOps, QA, junior/mid/senior, PR/pull request.
- `{{dev:...}}` wraps the Bulgarian word (спринт, бъг, тест, къмит, ...) the same way the Dutch and Croatian files do.
- `gloss.*.also` hold inflected Bulgarian forms plus the English words, comma separated.

## Glossary
| English | Bulgarian | Note |
|---|---|---|
| card | карта | |
| board | табло | |
| project | проект | |
| team | екип | |
| lead | лидер | "Lead Scrum Master" kept in English |
| Scrum Master | Scrum Master | kept |
| For you | За теб | |
| To do | За изпълнение | as Jira BG; in sentences in „…“ quotes |
| In progress / Doing | В процес | |
| Team checking | Екипът проверява | |
| For the team | За екипа | |
| For you to test (Verify) | Чака твоя {{dev:тест}} | |
| Done | Готово | |
| backlog | Backlog | loanword |
| sprint | спринт | plural спринтове |
| stand-up | стендъп | plural стендъпи |
| inbox | Входящи | |
| Setup | Настройки | |
| test steps | стъпки за {{dev:тестване}} | "to test" = за тестване |
| bug | бъг | plural бъгове |
| commit | къмит | |
| push / merge / repo | push / сливане / хранилище | |
| branch | клон | |
| assumption | предположение | |
| night watch | нощна стража | "watchman" = нощен пазач |
| No Token Mode | Режим без токени | |
| token | токен | |
| Usage | Използване | |
| poke | побутване / побутни | kept |
| going quiet | почивка (Започни почивка) | kept |
| DM | лично съобщение | |
| friend | приятел | |
| permissions | разрешения | |
| view | изглед | |
| column | колона | |
| attachment | прикачени файлове | |
| archive | архивирай | |
| tour | обиколка | |
| wizard | съветник | |
| focus | фокус | |
| checklist | списък за проверка | |
| hook | hook | |
| pretend friend | измислен приятел | |
| Life board | табло за живота | |
| Steady (push level 3) | Постоянно | |
| AI passed | одобрени от AI | the AI tester approved it |
| offer (link offer) | предложение | not "оферта" (commercial) |
| Watchman ticks every project | Пазачът пази всеки проект | same text quoted in sm.night.title |
| brief (agent prompt) | инструкции | |
| pretend (friend) | измислен / на ужким | banner and tag: "на ужким", gender-free |
| GO button | Давай | |
| Welcome | Добре дошли | plural form, gender-free (tour, wizard) |

## For the reviewer
- "За правене" for To do is literal; check it reads well as a column name and inside sentences.
- The first-person messages written by the Scrum Master (`srv.*`) and some "ти" messages may still show a gendered form; flagged for a native look.
- "Побутни" for Poke, "Нощна стража" and "Почивка" (Going quiet) are my choices; alternatives welcome.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script). `GO` stays English where the English text asks the user to answer with it.

## Answers to the translator's questions
- "За правене" was a calque: the column is now "За изпълнение" (the word Jira uses in Bulgarian), quoted „За изпълнение“ inside sentences. Verify is "Чака твоя тест".
- `srv.*` first-person lines: aorist forms ("спрях", "преместих", "не можах") are gender-free and stay. The few gendered bits are gone ("откъдето си спрял" → "докъдето стигна", "ти си задал" → "зададено е"). Friend lines with `{name}` no longer use "му/него/неговото", "е добавен", "не е споделил" or "двамата".
- "Побутни", "Нощна стража" and "Почивка" are fine and kept; the Go quiet button is now "Започни почивка".

## Review (native check, AIG-492)
- 218 values changed or added (215 changed, 3 new: `boot.retry`, `boot.broke`, `boot.reload`).
- Column names: To do → "За изпълнение" everywhere (columns, inbox tags, glossary, tour, Scrum Master notes); Verify → "Чака твоя тест".
- Gender: removed masculine forms aimed at the reader or a friend ("Нов съм в това", "къде си нужен", "погълнат от работа", "е готов", "Името му", "Постави кода му", "е блокиран", "докато го спреш" and the pretend friend's "his data"). The pretend banner and tag say "на ужким".
- Meaning fixes: "AI passed" was "минали през AI", and the tooltip said the tester "passed" the test as if it sat an exam: now "одобрени от AI". `leave.confirm` + `update.what.*` no longer build a broken sentence. "без възложен" → "без отговорник". `lead.watchAll` and the label quoted in `sm.night.title` now match.
- Offers are "предложение", not "оферта". "Снимка" for a logo → "изображение". "Брифа" → "инструкциите".
- Counts with {n} that read wrongly for 1 now use "Label: {n}" ("Приети тестове: {n}", "Отговори: {n}", "Изпратени карти: …").
- Smaller wording: "Иска теб" → "Чака теб", "Стартира…" → "Стартиране…", "Добре дошли в AI-gile", „…“ quotes around card titles and column names.

### Still for a human native speaker
- "За изпълнение" vs "Предстоящи" for To do, and "В процес" for In progress.
- "на ужким" for the pretend friend: playful; check it fits the screen.
- "Купчината ми" (my pile) and "Чиниите се въртят" (push level 1) are light-hearted; check they land.
- `inbox.sum.*` sentences put a digit before a noun ("1 въпрос чака"): fine in Bulgarian, but worth a look in the inbox header.
