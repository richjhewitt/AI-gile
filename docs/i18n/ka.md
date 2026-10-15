# ქართული (ka): first pass

First pass by a model (AIG-496), not yet checked by a native speaker. File: `public/lang/ka.json`, 1939 keys, same keys and order as `en.json`. Script: Georgian (Mkhedruli, no capitals, so upper-case English strings are just translated). Dates use `ka-GE`.

## Register
- Casual **შენ** (informal you), as in LocoRadio's Georgian. Verbs for the reader are in the plain second person ("დააჭირე", "აირჩიე", "ჩაწერე"). Buttons use the verbal noun ("შენახვა", "გაუქმება", "დამატება").
- Georgian has no grammatical gender and no gendered verb forms, so there is nothing to slash or default: no "(a)" forms anywhere.
- Quotes: „…“ (low-high). The keyword the lead waits for stays **GO** (also "Go" on buttons).
- Plurals: `Intl.PluralRules('ka')` gives `one` / `other`. A Georgian noun stays singular after a number ("5 ბარათი"), so `one` and `other` carry the same text.
- Case endings: Georgian attaches case suffixes to names ("{name}-ის"). Where a filled-in name sits in a sentence I mostly used "Label: {name}" or a bracket so no ending is needed; a few strings still have a hyphen suffix after a placeholder.
- Left untouched: AI-gile, Claude, Opus, Sonnet, Haiku, GitHub, VS Code, Windows, Giphy, Kanban, Scrum, Lead Scrum Master, Escape, Enter, Shift+Enter, `aigile avatar`, `scrumMaster.aiRunsPerDay`, `aigile.local.json`, `npm install`, URLs and card ids.

## Glossary
| English | ქართული | Note |
|---|---|---|
| card | ბარათი | |
| board | დაფა | |
| project | პროექტი | |
| lead | ლიდი | team lead |
| Lead Scrum Master | Lead Scrum Master | kept in English |
| team | გუნდი | |
| agent | აგენტი | |
| helpers | დამხმარეები | |
| For you | შენთვის | column `col.verify.short` |
| To do | გასაკეთებელი | |
| In progress | მიმდინარეობს | |
| Team checking | გუნდი ამოწმებს | |
| For you to test | შენი ტესტი | |
| For the team | გუნდისთვის | |
| Done | მზადაა | column and button |
| Backlog | ბექლოგი | loanword in Georgian script |
| Sprint | სპრინტი | |
| Stand-up | სტენდაპი | |
| Kanban / Scrum | Kanban / Scrum | |
| Inbox | შემოსულები | |
| Home | მთავარი | |
| Setup | პარამეტრები | |
| Usage | გამოყენება | |
| test / to test | ტესტი / ტესტირება | inside `{{dev:...}}` the form follows the sentence |
| test steps | ტესტის ნაბიჯები | |
| bug | ბაგი | |
| commit | კომიტი | |
| branch / merge / repo | ბრენჩი / მერჯი / რეპო | |
| token | ტოკენი | |
| hook | ჰუკი | |
| assumption | ვარაუდი | |
| night watch | ღამის დარაჯი | |
| No Token Mode | ტოკენების გარეშე რეჟიმი | |
| poke / wake | გაღვიძება | the board wakes sleeping teams; "needs a poke" is "გაღვიძება სჭირდება" |
| needs you | შენ გჭირდება / შენ გელოდება | |
| Accept / Send back | მიღება / უკან დაბრუნება | |
| Wait and see | ვნახოთ | |
| Going quiet | გაჩუმება / ვჩუმდები | |
| Views | ხედები | |
| Permissions | ნებართვები | |
| Look (settings) | იერსახე | |
| Friends (DMs) | მეგობრები / პირადი მიმოწერა | |
| pretend friend | გამოგონილი მეგობარი / თამაშის მეგობარი | |
| Tour | ტური | |
| Chatty lead | მოსაუბრე ლიდი | |

## For the reviewer
- `gloss.*.also` lists hold every Georgian form used inside a `{{dev:...}}` marker (checked by script). The tooltip matcher only matches whole words, so add forms there if a new case ending appears in a marker.
- "poke" and "wake" are both "გაღვიძება"; check that the card button "👉 გაღვიძება" reads as a nudge and not as a wake-up call.
- Names with case endings ("{name}-ის", "{name}-ს"): grammatical in the common case but a native ear may prefer other placements.
- Tone of the playful lines: `sm.push.1` ("თეფშები ბრუნავდეს"), `sm.push.5` ("მათრახის გატკაცუნება"), `quiet.done.h` ("ტკბილი ძილი").
- Demo texts (`demo.*`, `pt.*`) are translated; the demo friend's name Davy is kept.
- Loanwords (ბექლოგი, სპრინტი, სტენდაპი, ბაგი, კომიტი, ბრენჩი, მერჯი, რეპო, ტოკენი, ჰუკი) are written in Georgian script, as developers there write them; PR and WIP stay Latin.
