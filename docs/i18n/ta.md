# AI-gile in Tamil (ta), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Casual, friendly imperative ("சேமி", "மூடு", "திற", "அனுப்பு"), as in LocoRadio's Tamil. Longer sentences to the user use the polite plural imperative ("தட்டச்சு செய்யுங்கள்", "தேர்ந்தெடுங்கள்"). No formal honorific style.
- Tamil script. Software words are written in Tamil script, as Tamil tech writing does: பேக்லாக், ஸ்பிரிண்ட், ஸ்டாண்ட்-அப், டெஸ்ட், கமிட், பிராஞ்ச், மெர்ஜ், ரெப்போ, ஹூக், டோக்கன், ஏஜென்ட், டீம், போர்டு, கார்டு. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Tamil form ("{{dev:பேக்லாக்}}", "{{dev:டெஸ்ட்}}", "{{dev:ஸ்பிரிண்ட்}}", "{{dev:பக்}}", "{{dev:கமிட்}}"). The `gloss.*.word/also` keys list those spellings plus the Latin ones.
- Case suffixes after a Latin name or placeholder use a hyphen: "{name}-க்கு", "{id}-ஐ", "{path}-உடன்", "{project}-இல்". Suffixes on `{{dev:...}}` words attach directly ("{{dev:டெஸ்ட்}}க்கு", "{{dev:ஸ்பிரிண்ட்}}களும்").
- Plurals: Tamil has `one` and `other` in Intl.PluralRules. Tamil nouns after a number stay singular, so both forms are mostly identical (e.g. "{count} கார்டு" / "{count} கார்டுகள்" where it reads better).
- Gender: first-person lines of the Lead voice (`pt.*`, `srv.*`) use gender-neutral Tamil verb forms.
- Dates/times follow ta-IN. Short relative times: "நிமி" (minute), "மணி" (hour), "நா" (day).

## Glossary
| English | Tamil | Note |
|---|---|---|
| card | கார்டு | |
| board | போர்டு | |
| project | ப்ராஜெக்ட் | |
| team | டீம் | |
| lead / team lead | லீடு | "Lead Scrum Master" kept in Latin |
| For you | உங்களுக்கு | |
| To do | செய்ய வேண்டியவை | |
| In progress / Doing | நடந்துகொண்டிருக்கிறது | |
| Team checking | டீம் சரிபார்க்கிறது | |
| For the team | டீமுக்கு | |
| For you to test | உங்கள் டெஸ்ட்க்கு | |
| Done | முடிந்தது | |
| Backlog | பேக்லாக் | |
| sprint | ஸ்பிரிண்ட் | |
| stand-up | ஸ்டாண்ட்-அப் | |
| inbox | இன்பாக்ஸ் | |
| Setup | செட்டப் | |
| Usage | பயன்பாடு | |
| test | டெஸ்ட் | |
| test steps | டெஸ்ட் படிகள் | |
| Accept | ஏற்றுக்கொள் | |
| Send back | திருப்பி அனுப்பு | |
| Wake (team) | எழுப்பு | |
| Poke | தட்டு | "தட்டல்" as noun |
| night watch | இரவுக் காவல் | watchman = "காவலர்" |
| Going quiet | அமைதியாகிறேன் | |
| assumption | அனுமானம் | |
| No Token Mode | நோ டோக்கன் மோட் | |
| token | டோக்கன் | |
| agent | ஏஜென்ட் | |
| blocked | தடைபட்டது | |
| blockers | தடைகள் | |
| Permissions | அனுமதிகள் | |
| Views | வியூக்கள் | |
| column | நெடுவரிசை | |
| DM | DM | kept in Latin |
| Look (🎨) | லுக் | |
| Space | ஸ்பேஸ் | |
| Checklist | சரிபார்ப்புப் பட்டியல் | |
| Hook | ஹூக் | |

## For the reviewer
- "நெடுவரிசை" for columns is formal but unambiguous (not "காலம்", which means time); check it fits in the cols.* keys and lane labels.
- "உங்கள் டெஸ்ட்க்கு" for "For you to test" is a compromise to fit the `{{dev:...}}` marker; "டெஸ்ட் செய்ய உங்களுக்கு" may read more naturally.
- "அனுமானம்" (assumption) and "தட்டு" (poke) are chosen for clarity; confirm tone.
- Pirate-style jokes in `sm.push.*` ("தட்டுகள் சுழன்றுகொண்டே இருக்கட்டும்", "சாட்டையைச் சுழற்று") are idiomatic renderings; confirm tone.
- Long labels to check for fit: "AI தேறிய அனைத்தையும் ஏற்றுக்கொள்", "வழிகாட்டியுடன் அமை (பரிந்துரைக்கப்பட்டது)".
- Plural text is identical in `one`/`other` in places like `unit`-style keys and `queue.bump.title`, since Tamil does not inflect the noun after a number.
