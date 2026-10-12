# AI-gile in Kazakh (kk)

First pass by Babel for AIG-495 (Cyrillic, Kazakhstan). Needs a native-speaker check.

## Register
- **Polite сіз** (-ыңыз), following LocoRadio's Kazakh file. AI-gile's docs say informal where a language has one, so the reviewer should decide whether сен is better for a friendly personal tool. Buttons and labels mostly use verbal nouns ("Сақтау", "Жабу") so the choice rarely shows.
- Kazakh has no grammatical gender, so no gendering issue.
- Cyrillic script with Kazakh letters (ә, ғ, қ, ң, ө, ұ, ү, һ, і). Case endings are kept off `{placeholders}` where possible; "{name} адамына" is used for people.
- Plurals: `one` and `other`, same text (the noun stays singular after a number: "3 карта").
- Durations: мин, сағ, күн. Dates follow kk-KZ.
- `{{dev:...}}` markers kept. The glossary `.word`/`.also` entries list the marked words and their forms so tooltips match.
- "Folder" is **бума** (not папка); "team" is **команда**.

## Glossary
| English | Kazakh | Note |
|---|---|---|
| card | карта | |
| board | тақта | |
| project | жоба | |
| team | команда | |
| lead | жетекші | Lead Scrum Master kept |
| Scrum Master | Scrum Master | kept |
| For you | Сізге | |
| To do | Орындау керек | |
| In progress / Doing | Орындалуда | |
| Team checking | Команда тексеруде | |
| For the team | Командаға | |
| Verify column ("For you to test") | Сізге {{dev:тест}}теу үшін | |
| Done | Дайын | |
| Backlog | Backlog | kept |
| sprint | спринт | |
| stand-up | стендап | |
| inbox | Кіріс | |
| Setup | Баптау | |
| Usage | Пайдалану | |
| plan (Claude plan) | тариф | |
| test | тест | "тестілеу" as verb |
| test steps | тест қадамдары | |
| bug | баг | |
| commit | коммит | |
| Accept | Қабылдау | |
| Send back | Қайтару | |
| Wake (team) | Ояту | |
| Poke | Ояту / түрту | |
| night watch | Түнгі күзет | night watchman = күзетші |
| Going quiet | Үнсіз болу | |
| idle | бос | |
| assumption | болжам | "Plug this" = түзету |
| No Token Mode | Токенсіз режим | |
| token | токен | |
| agent | агент | |
| Come back… | Қайта оралу… | |

## For the reviewer
- Decide сіз vs сен (see Register).
- Check vowel harmony on suffixes after Latin names and placeholders (e.g. "Davy-дің", "{name} адамына").
- "Түрту" (nudge) vs "ояту" (wake) for poke; both are used.
- `gloss.*.also` lists are a guess at common inflected forms.
