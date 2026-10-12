# Serbian (sr, Cyrillic) first pass

Card AIG-492. File: `public/lang/sr.json` (1932 keys, same keys and order as `en.json`). Needs a native check.

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
| To do | Треба урадити | in sentences in „…“ quotes |
| In progress / Doing | У току | |
| Team checking | Тим проверава | |
| For the team | За тим | |
| For you to test (Verify) | Чека твој {{dev:тест}} | |
| Done | Готово | |
| backlog | Backlog | loanword |
| sprint | спринт | plural спринтови |
| stand-up | стендап | plural стендапови |
| inbox | Пријемно сандуче | short form "Пријемно" on the rail and the 📥 button |
| Setup | Подешавања | |
| test steps | кораци за {{dev:тестирање}} | |
| bug | баг | plural багови |
| commit | комит | |
| push / merge / repo | push / спајање / репозиторијум | |
| branch | грана | |
| assumption | претпоставка | |
| night watch | ноћна стража | "watchman" = ноћни чувар |
| No Token Mode | Режим без токена | |
| token | токен | |
| Usage | Потрошња | |
| poke | боцкање / боцни | as Facebook's Serbian "Боцни"; "гурни" means a physical push |
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
| AI passed | одобрено од AI | |
| GO button / "go" | Може | "Иди" means "walk away" |
| limit (column / WIP) | лимит | plan usage limit stays "ограничење" |
| Watchman ticks every project | Чувар пази на сваки пројекат | same text quoted in sm.night.title |
| pretend (friend) | измишљени / за пробу | banner and tag: "за пробу", gender-free |
| Welcome | Добродошли | plural form (tour, wizard) |

## For the reviewer
- "За рад" for To do is a calque; "На реду" may be more natural.
- Some masculine forms remain in agent-voice messages (`srv.*`, `pt.*`, "је рекао/прихватио" style with a friend's `{name}`); please decide on a convention.
- "Пријемно сандуче" for Inbox is long for a tab; "Пошта" or "Примљено" are shorter alternatives.
- "Гурни" for Poke, "Ноћна стража" and "Повући се" (going quiet) are my choices.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script). `GO` stays English where the English text asks the user to answer with it.

## Answers to the translator's questions
- "За рад" was a calque: the column is now "Треба урадити", quoted „Треба урадити“ inside sentences. Verify is "Чека твој тест".
- Masculine forms: the Scrum Master's first-person notes (`srv.*`) are now neutral ("па је заустављено", "па је више не покрећем поново", "Покретање није успело", "Није јасно где иде…"), and so are lines with a friend's `{name}` ("је додат", "није поделио", "Његово име", "што си укуцао", "како си подесио" are gone). The pretend team (`pt.*`) is neutral too ("Табла је подешена…", "како је тражено").
- Inbox: "Пријемно сандуче" stays in headings; the rail link and the 📥 button use the short "Пријемно".
- Poke is now "Боцни" / "боцкање" (as on Facebook); "гурни" sounded like a physical push. "Ноћна стража" and "Повуци се" are kept.

## Review (native check, AIG-492)
- 223 values changed or added (220 changed, 3 new: `boot.retry`, `boot.broke`, `boot.reload`).
- Column names: To do → "Треба урадити" everywhere (columns, inbox tags, glossary, tour, Scrum Master notes); Verify → "Чека твој тест".
- GO buttons said "Иди" ("go away"): now "Може" (`dms.go`, `act.go`, the tour and the push scale).
- Meaning fixes: the AI tester "прошао" the test as if it sat an exam → "одобрио"; "AI passed" → "Одобрено од AI". `leave.confirm` + `update.what.*` now make one sentence. `lead.watchAll` and the label quoted in `sm.night.title` now match. "Пало" → "Није прошло".
- Plurals: counts that broke for 2 to 4 or for 5+ ("{n} тима", "{n} нових питања", "{n} порука", "свих {n} пројеката") now use "Label: {n}" or a fixed phrase.
- Card and WIP limits are "лимит"; the plan usage limit stays "ограничење".
- Smaller fixes: "у ⚙️ Подешавања" → "Подешавањима", "Ти си {name} (за пробу)", "Добродошли у AI-gile", "Репортер" instead of "Пријављивач", „…“ quotes.

### Still for a human native speaker
- "Треба урадити" vs "На реду" for To do.
- "Боцни" for Poke: check it does not read as too playful.
- "Добродошли" is the plural form; check it reads as neutral enough for one person.
- "за пробу" for the pretend friend tag and banner.
- `share.safety.ok` ("Прочитали смо их…") is still masculine plural, the usual generic form; say if a neutral version is wanted.
