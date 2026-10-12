# AI-gile in Telugu (te), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Polite-casual **మీరు** with "-ండి" imperatives ("చేయండి", "ఎంచుకోండి"), as in LocoRadio's Telugu. No నువ్వు. Friendly, short, conversational.
- Telugu script. Software words are written in Telugu script, as Telugu tech writing does: బ్యాక్‌లాగ్, స్ప్రింట్, స్టాండ్-అప్, బగ్, టెస్ట్, కమిట్, పుష్, బ్రాంచ్, మెర్జ్, రెపో, హుక్, టోకెన్, ఏజెంట్. Product names, file names, keys (Enter, Shift, Escape), placeholders, ssh/git/npm commands stay in Latin.
- `{{dev:...}}` markers wrap the Telugu form ("{{dev:టెస్ట్}}", "{{dev:బగ్}}", "{{dev:స్ప్రింట్}}", "{{dev:బ్యాక్‌లాగ్}}", "{{dev:కమిట్}}"). Plural forms inside markers use ZWNJ-joined "-‌లు" (e.g. కమిట్‌లు, స్ప్రింట్‌లు); the `gloss.*.also` keys list those plurals plus the Latin spelling.
- Plurals: `{ one, other }` (Intl.PluralRules gives only these two for `te`). Telugu often drops the plural suffix after a number, so `unit.minutes` and similar give the same text.
- Case suffixes attach directly to Latin or Telugu placeholders and names (e.g. "{name}కు", "{id}ను"); the translator accepted this because a filled-in name is rendered as-is.
- Dates and times follow te-IN. Short relative times: "ని" (నిమిషం), "గం" (గంట), "రో" (రోజు).

## Glossary
| English | Telugu | Note |
|---|---|---|
| card | కార్డ్ | |
| board | బోర్డ్ | |
| project | ప్రాజెక్ట్ | |
| team | టీమ్ | |
| lead / team lead | లీడ్ | "Lead Scrum Master" kept in Latin |
| For you | మీ కోసం | |
| To do | చేయాల్సినవి | |
| In progress / Doing | జరుగుతున్నవి | |
| Team checking | టీమ్ చూస్తోంది | |
| For the team | టీమ్ కోసం | |
| For you to test | మీరు టెస్ట్ చేయాలి | |
| Done | పూర్తయ్యాయి | |
| Backlog | బ్యాక్‌లాగ్ | |
| sprint | స్ప్రింట్ | |
| stand-up | స్టాండ్-అప్ | |
| inbox | ఇన్‌బాక్స్ | |
| Setup | సెటప్ | |
| Usage | వినియోగం | |
| test | టెస్ట్ | |
| test steps | టెస్ట్ స్టెప్‌లు | |
| Accept | ఆమోదించండి | |
| Send back | వెనక్కి పంపండి | |
| Wake (team) | లేపండి | |
| Poke | కదిలించండి | "కదిలించు" (nudge) |
| night watch | నైట్ వాచ్ | watchman = వాచ్‌మన్ |
| Going quiet | నిశ్శబ్దంగా ఉంటున్నా | |
| assumption | ఊహ | |
| No Token Mode | నో టోకెన్ మోడ్ | |
| token | టోకెన్ | |
| agent | ఏజెంట్ | |
| blocked | ఆగిపోయింది | |
| blockers | అడ్డంకులు | |
| Permissions | అనుమతులు | |
| Views | వ్యూలు | |
| DM | DM | kept in Latin |
| Look (🎨) | లుక్ | |
| Space | స్పేస్ | |
| Checklist | చెక్‌లిస్ట్ | |
| Hook | హుక్ | |
| Verbose | వెర్బోస్ | |

## For the reviewer
- "ఆగిపోయింది" for "blocked/stuck" and "కదిలించండి" for "poke": check they read naturally in the home pills and card buttons.
- `leave.confirm` ("అయినా {what} చేసి దాన్ని పోగొట్టుకుంటారా?") takes అప్‌డేట్ చేయండి/రిఫ్రెష్ చేయండి/రీస్టార్ట్ చేయండి as `{what}`: verify it parses (it may read doubled "చేయండి చేసి").
- `card.reply.ph` ends "టీమ్ కోసం‌కి": a case suffix on a button name; please check the join.
- Pirate-style jokes in `sm.push.*` ("ప్లేట్లు తిరుగుతూ ఉండనివ్వండి", "కొరడా ఝళిపించండి") are idiomatic renderings; confirm tone.
- "Pro-friendly" (`lead.light`) became "ప్రో-ఫ్రెండ్లీ": check it reads as a plan name.
- The Lead/AI voice (`pt.*`, `srv.*`) uses first person without a gendered verb where possible; check the remaining forms.
- `pretend.*` refer to the pretend friend as "అతను/అతని" (the English uses "him/his"): confirm.
- Long labels to check for fit: "AI పాస్ చేసినవన్నీ ఆమోదించండి", "విజార్డ్‌తో సెటప్ చేయండి (సిఫార్సు)".
- Quotes in HTML attributes were kept as-is; in plain text I used “ ”.
