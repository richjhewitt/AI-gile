# Bulgarian (bg) first pass

Card AIG-492. File: `public/lang/bg.json` (1929 keys, same keys and order as `en.json`). Needs a native check.

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
| To do | За правене | review: maybe "Предстоящи" |
| In progress / Doing | В процес | |
| Team checking | Екипът проверява | |
| For the team | За екипа | |
| Verify | За теб за {{dev:тест}} | |
| Done | Готово | |
| backlog | Backlog | loanword |
| sprint | спринт | plural спринтове |
| stand-up | стендъп | plural стендъпи |
| inbox | Входящи | |
| Setup | Настройки | |
| test steps | стъпки за тестване | |
| bug | бъг | plural бъгове |
| commit | къмит | |
| push / merge / repo | push / сливане / хранилище | |
| branch | клон | |
| assumption | предположение | |
| night watch | нощна стража | "watchman" = нощен пазач |
| No Token Mode | Режим без токени | |
| token | токен | |
| Usage | Използване | |
| poke | побутване / побутни | |
| going quiet | почивка | |
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
| AI passed | минали през AI | |

## For the reviewer
- "За правене" for To do is literal; check it reads well as a column name and inside sentences.
- The first-person messages written by the Scrum Master (`srv.*`) and some "ти" messages may still show a gendered form; flagged for a native look.
- "Побутни" for Poke, "Нощна стража" and "Почивка" (Going quiet) are my choices; alternatives welcome.
- Emoji, placeholders, HTML tags, CLI names and URLs were not changed (validated by script). `GO` stays English where the English text asks the user to answer with it.
