# Հայերեն (hy): first pass

First pass by a model (AIG-496), not yet checked by a native speaker. File: `public/lang/hy.json`, 1939 keys, same keys and order as `en.json`. Script: Armenian (Eastern Armenian, as spoken in Armenia, with the Mesrobian orthography). Dates use `hy-AM`.

## Register
- Casual **դու** (informal you), as in LocoRadio's Armenian. Buttons use the infinitive ("Պահպանել", "Չեղարկել", "Ավելացնել"); sentences use the second-person imperative ("Սեղմիր", "Ընտրիր", "Գրիր").
- Armenian has no grammatical gender, so nothing to slash or default: no "(a)" forms.
- Punctuation: the Armenian full stop `։` ends sentences, and `՝` / `.` are used as a colon-like pause. Some labels use ` ·` as in English. Questions carry the Armenian question mark `՞` on the stressed word (`Ի՞նչ`, `ե՞ս`, `ե՞նք`) instead of a final `?`. Quotes: «…». The keyword the lead waits for stays **GO**.
- Plurals: `Intl.PluralRules('hy')` gives `one` / `other`; a noun stays singular after a number ("5 քարտ"), so both forms carry the same text.
- Names get case endings ("{name}-ի", "{name}-ին"); I used the hyphenated suffix after a placeholder only where it reads naturally, otherwise "Label՝ {name}".
- Left untouched: AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Giphy, Kanban, Scrum, Lead Scrum Master, Escape, Enter, Shift+Enter, `aigile avatar`, `scrumMaster.aiRunsPerDay`, `aigile.local.json`, `npm install`, URLs and card ids.

## Glossary
| English | Հայերեն | Note |
|---|---|---|
| card | քարտ | |
| board | տախտակ | |
| project | նախագիծ | |
| lead | լիդ | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | թիմ | |
| agent | գործակալ | |
| helpers | օգնականներ | |
| For you | Քեզ համար | column `col.verify.short` |
| To do | Անելիք | |
| In progress | Ընթացքում | |
| Team checking | Թիմը ստուգում է | |
| For you to test | Քո թեստը | |
| For the team | Թիմի համար | |
| Done | Պատրաստ է | column and button |
| Backlog | Բեքլոգ | loanword in Armenian script |
| Sprint | Սպրինտ | |
| Stand-up | Սթենդափ | |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | Մուտքային | |
| Home | Գլխավոր | |
| Setup | Կարգավորումներ | |
| Usage | Օգտագործում | |
| test / to test | թեստ / թեստավորել | inside `{{dev:...}}` the form follows the sentence |
| test steps | թեստի քայլեր | |
| bug | բագ | |
| commit | կոմիտ | |
| branch / merge / repo | բրենչ / մերջ / ռեպո | |
| token | տոկեն | |
| hook | հուկ | |
| assumption | ենթադրություն | |
| night watch | գիշերային պահակ | |
| No Token Mode | «Առանց տոկենների» ռեժիմ | |
| poke / wake | արթնացնել | "needs a poke" is "արթնացման կարիք ունի" |
| needs you | քեզ է պետք / քեզ են սպասում | |
| Accept / Send back | Ընդունել / Հետ ուղարկել | |
| Wait and see | Տեսնենք | |
| Going quiet | Լռում եմ | |
| Views | Տեսքեր | |
| Permissions | Թույլտվություններ | |
| Look (settings) | Տեսք | |
| Friends (DMs) | ընկերներ / անձնական նամակագրություն | |
| pretend friend | խաղային ընկեր | |
| Tour | Շրջայց | |
| Chatty lead | խոսուն լիդ | |

## For the reviewer
- `gloss.*.also` lists hold every Armenian form used inside a `{{dev:...}}` marker (checked by script). The tooltip matcher only matches whole words, so add forms there if a new case ending appears in a marker.
- Eastern Armenian is assumed throughout (Armenia). Please confirm that the loanword spellings (Բեքլոգ, Սպրինտ, Սթենդափ, բագ, կոմիտ, բրենչ, մերջ, ռեպո, տոկեն, հուկ) match what developers in Armenia write.
- "poke" and "wake" are both "արթնացնել"; check that the card button "👉 Արթնացնել" reads as a nudge.
- Armenian punctuation: I used `։` as the full stop and `՝` / `.` for the colon-like pause; a native eye should confirm this is consistent and not too heavy.
- Names with case endings ("{name}-ի", "{name}-ին", "{name}-ը"): grammatical in the common case but worth a look.
- Tone of the playful lines: `sm.push.1` ("Պտտվեն ափսեները"), `sm.push.5` ("Շխկացնել մտրակը"), `quiet.done.h` ("Քնիր հանգիստ").
- Demo texts (`demo.*`, `pt.*`) are translated; the demo friend's name Davy is kept.
