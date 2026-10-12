# AI-gile in Mongolian (mn)

First pass by Babel for AIG-495 (Cyrillic, Khalkha). Needs a native-speaker check.

## Register
- Casual **чи / чиний** (never the polite та), matching AI-gile's friendly English. Imperatives are the plain stem ("дар", "хар", "бич"); LocoRadio's mn file uses the softer "-аарай" in a few places, so mix is possible.
- Mongolian has no grammatical gender, so no gendering issue. "Agent" and "lead" take no pronoun.
- Cyrillic script. Case endings are not attached to `{placeholders}` where it would clash (e.g. "Claude-аас асуух ({name})" instead of "{name}-ийн Claude").
- Plurals: Mongolian has `one` and `other`; both carry the same text (the noun after a number stays singular: "3 карт").
- Durations: мин, ц, өд. Dates follow mn-MN.
- Dev words kept as Cyrillic loanwords or Latin where devs write them that way. `{{dev:...}}` markers kept; the glossary `.word`/`.also` entries list the marked words and their forms so tooltips match.

## Glossary
| English | Mongolian | Note |
|---|---|---|
| card | карт | |
| board | самбар | |
| project | төсөл | |
| team | баг | |
| lead | ахлагч | "Ахлах Scrum Master" for Lead Scrum Master |
| Scrum Master | Scrum Master | kept |
| For you | Чамд | |
| To do | Хийх | |
| In progress / Doing | Хийгдэж байна | |
| Team checking | Баг шалгаж байна | |
| For the team | Багт | |
| Verify column ("For you to test") | Чамд тест хийхээр | |
| Done | Дууссан | "Болсон" on buttons and chips |
| Backlog | Backlog | kept |
| sprint | спринт | |
| stand-up | стендап | |
| inbox | Ирсэн | |
| Setup | Тохиргоо | |
| Usage | Хэрэглээ | |
| plan (Claude plan) | төлөвлөгөө | |
| test | тест | "тестлэх" as verb |
| test steps | тестийн алхмууд | |
| bug | алдаа | not "баг", which is "team" |
| commit | коммит | |
| Accept | Хүлээн авах | |
| Send back | Буцаах | |
| Wake (team) | Сэрээх | |
| Poke | Сэрээх / түлхэх | "Needs a poke" = сэрээх хэрэгтэй |
| night watch | Шөнийн харуул | night watchman = харуул |
| Going quiet | Чимээгүй болох | |
| idle | идэвхгүй | |
| assumption | таамаглал | "Plug this" = нөх |
| No Token Mode | Токен хэрэглэхгүй горим | |
| token | токен | |
| agent | агент | |
| stand-by "On call" | Дуудлагад бэлэн | |
| Come back… | Эргэж ирэх… | |

## For the reviewer
- Check "баг" (team) vs "алдаа" (bug) is natural to Mongolian developers, and whether "Сэрээх" for wake/poke is clear.
- Check casual чи throughout; "Үгүй" vs "Одоохондоо үгүй" for "Not yet".
- Sentences with "-ын/-ийн" after a placeholder (e.g. "{name}-ийн") assume the name takes the standard suffix; reword if a name could break it.
- `gloss.*.also` lists are a guess at common inflected forms.
