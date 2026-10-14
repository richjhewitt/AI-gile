# AI-gile in Tamil (ta)

Written by Babel for AIG-492 (first pass), then reviewed by a native-speaker model (second pass, same card).

## Register
- Casual, friendly imperative ("சேமி", "மூடு", "திற", "அனுப்பு"), as in LocoRadio's Tamil. Longer sentences to the user use the polite plural imperative ("தட்டச்சு செய்யுங்கள்", "தேர்ந்தெடுங்கள்"). No formal honorific style.
- Tamil script. Software words are written in Tamil script, as Tamil tech writing does: பேக்லாக், ஸ்பிரிண்ட், ஸ்டாண்ட்-அப், டெஸ்ட், கமிட், பிராஞ்ச், மெர்ஜ், ரெப்போ, ஹூக், டோக்கன், ஏஜென்ட், டீம், போர்டு, கார்டு. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Tamil form ("{{dev:பேக்லாக்}}", "{{dev:டெஸ்ட்}}", "{{dev:ஸ்பிரிண்ட்}}", "{{dev:பக்}}", "{{dev:கமிட்}}"). The `gloss.*.word/also` keys list those spellings plus the Latin ones.
- Case suffixes after a Latin name or placeholder use a hyphen: "{name}-க்கு", "{id}-ஐ", "{path}-உடன்", "{project}-இல்". Suffixes on `{{dev:...}}` words attach directly ("{{dev:டெஸ்ட்}}க்கு", "{{dev:ஸ்பிரிண்ட்}}களும்").
- Plurals: Tamil has `one` and `other` in Intl.PluralRules. Tamil nouns after a number stay singular, so both forms are mostly identical (e.g. "{count} கார்டு" / "{count} கார்டுகள்" where it reads better).
- Gender: Tamil first-person verbs carry no gender ("தொடங்கிவிட்டேன்", "நிறுத்தினேன்"), so the Lead's lines (`pt.*`, `srv.*`) are already neutral.
- When a string names a column or a button, the name goes in quotes: "\"உங்களுக்கு\" பகுதியில்", "\"முடிந்தது\"-க்குப் போகும்".
- "Optional" is "விருப்பத்தேர்வு" (or "விரும்பினால்" inside a sentence), never "விருப்பம்" alone, which reads as "wish".
- Dates/times follow ta-IN. Short relative times: "நிமி" (minute), "மணி" (hour), "நா" (day).

## Glossary
| English | Tamil | Note |
|---|---|---|
| card | கார்டு | never "அட்டை" |
| board | போர்டு | |
| project | ப்ராஜெக்ட் | |
| team | டீம் | "குழு" is kept for card groups |
| lead / team lead | லீடு | "Lead Scrum Master" kept in Latin |
| For you | உங்களுக்கு | |
| To do | செய்ய வேண்டியவை | |
| In progress / Doing | நடப்பில் | review: was "நடந்துகொண்டிருக்கிறது", too long for a column |
| Team checking | டீம் சரிபார்க்கிறது | |
| For the team | டீமுக்கு | |
| For you to test | நீங்கள் {{dev:டெஸ்ட்}} செய்ய | review: was "உங்கள் டெஸ்ட்க்கு" ("for your test") |
| Done | முடிந்தது | |
| Backlog | பேக்லாக் | |
| sprint | ஸ்பிரிண்ட் | |
| stand-up | ஸ்டாண்ட்-அப் | |
| inbox | இன்பாக்ஸ் | |
| Setup | செட்டப் | |
| Usage | பயன்பாடு | |
| time window (5h / 7d) | காலம் | "சாளரம்" is a literal calque of "window" |
| test | டெஸ்ட் | |
| test steps | டெஸ்ட் படிகள் | |
| AI passed | AI தேர்ச்சி | the AI tester gives the pass |
| Accept | ஏற்றுக்கொள் | |
| Send back | திருப்பி அனுப்பு | |
| Wake (team) | எழுப்பு | only for waking a team |
| Raise (a bug / card) | தெரிவி (bug), பதிவு செய் (card) | review: "எழுப்பு" clashed with "wake" |
| Poke | தட்டு | "தட்டல்" as noun |
| night watch | இரவுக் காவல் | watchman = "காவலர்" |
| Going quiet | அமைதியாகிறேன் | |
| switching off (for a few hours) | ஓய்வில் இருக்கப்போகிறேன் | not "அணைந்திருக்க" (a lamp switching off) |
| assumption | அனுமானம் | |
| Plug (an assumption) | திருத்து | the user corrects a guess |
| Chatty (lead) | கலகலப்பான | |
| Optional | விருப்பத்தேர்வு / விரும்பினால் | |
| No Token Mode | நோ டோக்கன் மோட் | |
| token | டோக்கன் | |
| agent | ஏஜென்ட் | |
| blocked | தடைபட்டது | |
| blockers | தடைகள் | |
| Permissions | அனுமதிகள் | |
| Views | வியூக்கள் | |
| column | நெடுவரிசை | never "காலம்" (time) |
| link (share link) | இணைப்பு | |
| attachment | இணைப்புக் கோப்பு | kept apart from "link" |
| Join service | அழைப்புச் சேவை | |
| tour | சுற்றிப்பார்வை | "சுற்றுலா" means a holiday trip |
| DM | DM | kept in Latin |
| Look (🎨) | லுக் | |
| Space | ஸ்பேஸ் | |
| Checklist | சரிபார்ப்புப் பட்டியல் | |
| Hook | ஹூக் | |

## Questions from the first pass, answered
- **"நெடுவரிசை" for columns:** keep it. It is the standard word and fits the column and lane labels. `board.columns.title` had "காலங்களை" (times), now "நெடுவரிசைகளை".
- **"உங்கள் டெஸ்ட்க்கு" for "For you to test":** changed. It meant "for your test". Now "நீங்கள் {{dev:டெஸ்ட்}} செய்ய", which is short and says who does it.
- **"அனுமானம்" and "தட்டு":** both fine. "அனுமானம்" is the natural word for an assumption. "தட்டு" (tap) works for a gentle poke, with "தட்டல்" as the noun.
- **Pirate-style jokes in `sm.push.*`:** "தட்டுகள் சுழன்றுகொண்டே இருக்கட்டும்" is kept. "Crack the whip" is now "சாட்டையைச் சொடுக்கு" (a whip is cracked, not spun).
- **Long labels:** "AI தேறிய அனைத்தையும் ஏற்றுக்கொள்" is now "AI தேர்ச்சி: எல்லாம் ஏற்றுக்கொள் ({n})". "வழிகாட்டியுடன் அமை (பரிந்துரைக்கப்பட்டது)" fits a full-width wizard button, so it is unchanged.
- **Identical `one`/`other`:** correct for Tamil. A noun after a number stays singular.

## Review (second pass, AIG-492)
121 values changed. What changed:
- **Column titles:** "In progress" is now "நடப்பில்" everywhere (column, friend boards, Kanban glossary, tour, stand-up summary). "For you to test" is now "நீங்கள் {{dev:டெஸ்ட்}} செய்ய".
- **Wrong meaning:** "காலங்களை" → "நெடுவரிசைகளை" (columns). "விருப்பத்துக்குரிய" ("beloved") → "விருப்பத்தேர்வான" (optional). "Raise a bug/card" no longer uses "எழுப்பு", which means "wake" in this UI. Now it is "தெரிவி" or "பதிவு செய்". "இணைப்பு" was used for both links and attachments, so attachments are now "இணைப்புக் கோப்புகள்". "Plug this" (an assumption) is now "திருத்து" (correct), not "அடை" (block a hole). "சுற்றுலா" (holiday trip) is now "சுற்றிப்பார்வை" for the guided tour. "Off you go" was "சென்று வாருங்கள்" (goodbye), now "இனி நீங்களே தொடங்குங்கள்".
- **Broken grammar with placeholders:** `leave.confirm` + `update.what.*` used to read "புதுப்பி செய்யவா". The `{what}` values are now full questions ("புதுப்பிக்கவா", "ரெஃப்ரெஷ் செய்யவா", "மறுதொடங்கவா"). `srv.restart.started` now joins `srv.restart.base` with a comma. `card.quiz.sub` gained the missing link between its clauses.
- **Calques:** "சாளரம்" (window) for time windows → "காலம்". "அணைந்திருக்க" (switch off like a lamp) → "ஓய்வில் இருக்க". "தாக்கப்பட்டது" (attacked) for a hit limit → "எட்டியது". "தொங்கியது" (hung) → "ஸ்தம்பித்தது". "புகை சோதனை" → "ஸ்மோக் சோதனை". "வேலியிட்டு" (fenced) → "தனியாகக் குறித்து". "அடுத்த படி தயவுசெய்து" → "தயவுசெய்து அடுத்த படியைச் சொல்லுங்கள்".
- **Consistency:** "அட்டை" → "கார்டு". "சும்மா" (idle) → "ஓய்வில்". "பேசும் லீடு" → "கலகலப்பான லீடு". "(விருப்பம்)" → "(விருப்பத்தேர்வு)" / "(விரும்பினால்)". In and Out columns → "உள்ளீடு" / "வெளியீடு". Option names cited inside help text now have quotes.
- **Smaller fixes:** "திறவுங்கள்" → "திறங்கள்". "AI தேறியது" tabs → "AI தேர்ச்சி". Passive forms for the undo toasts. Clearer wording for `dlg.find.keydup`, `usage.nologs`, `share.never`, `pack.untrusted`, `budget.help` and `gloss.bug.text`.
- No keys were missing against en.json. Placeholders, `{{dev:}}` markers, **bold**, `code`, HTML and emoji match English on every key (checked by script and `tools/i18n/check.mjs`).

For a human native speaker to check:
- "நடப்பில்" as the column name for "In progress". "செயலில்" is the alternative.
- "திட்டம்" for the subscription plan in the Usage pages. It is clear in context, but some readers may prefer "பிளான்".
- "பாசாங்கு நண்பர்" for the "pretend friend" demo. "மாதிரி நண்பர்" is gentler.
- "{{dev:ஸ்பிரிண்ட்}}டுக்கும்" in `lanes.sprint` renders as "ஸ்பிரிண்ட்டுக்கும்" (double ட்). Check whether "ஸ்பிரிண்டுக்கும்" is wanted, which would mean dropping the final ் inside the marker.
- The tone of the joke labels (`sm.push.1`, `sm.push.5`, `budget.plan.*`).
