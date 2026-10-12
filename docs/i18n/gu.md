# AI-gile in Gujarati (gu), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Polite-casual "તમે" with "-ો" imperatives ("સાચવો", "બંધ કરો", "ખોલો", "મોકલો"), as in LocoRadio's Gujarati. No તું. Friendly, short, conversational.
- Gujarati script. Software words are written in Gujarati script, as Gujarati tech writing does: બેકલોગ, સ્પ્રિન્ટ, સ્ટેન્ડ-અપ, બગ, ટેસ્ટ, કમિટ, બ્રાન્ચ, મર્જ, રેપો, હૂક, ટોકન, એજન્ટ, ટીમ, બોર્ડ, કાર્ડ. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Gujarati form ("{{dev:બેકલોગ}}", "{{dev:ટેસ્ટ}}", "{{dev:સ્પ્રિન્ટ}}", "{{dev:બગ}}", "{{dev:કમિટ}}"). The `gloss.*.word/also` keys list those spellings plus the Latin ones.
- Postpositions after a placeholder or Latin name are written with a space ("{name} ને", "{project} માં", "{id} માટે").
- Plurals: Gujarati has `one` and `other` in Intl.PluralRules (0 and 1 are singular). Nouns after a number are mostly unchanged, so both forms are often identical.
- Gender: first-person lines of the Lead voice (`pt.*`, `srv.*`) use masculine forms where a verb must agree ("હું શરૂ કરી શકતો નથી"); change if a neutral form is preferred.
- Dates/times follow gu-IN. Short relative times: "મિ" (minute), "ક" (hour), "દિ" (day).

## Glossary
| English | Gujarati | Note |
|---|---|---|
| card | કાર્ડ | |
| board | બોર્ડ | |
| project | પ્રોજેક્ટ | |
| team | ટીમ | |
| lead / team lead | લીડ | "Lead Scrum Master" kept in Latin |
| For you | તમારા માટે | |
| To do | કરવાનું | |
| In progress / Doing | ચાલુ છે | |
| Team checking | ટીમ તપાસી રહી છે | |
| For the team | ટીમ માટે | |
| For you to test | તમારે ટેસ્ટ કરવા માટે | |
| Done | પૂર્ણ | |
| Backlog | બેકલોગ | |
| sprint | સ્પ્રિન્ટ | |
| stand-up | સ્ટેન્ડ-અપ | |
| inbox | ઇનબોક્સ | |
| Setup | સેટઅપ | |
| Usage | વપરાશ | |
| test | ટેસ્ટ | |
| test steps | ટેસ્ટ સ્ટેપ | |
| Accept | સ્વીકારો | |
| Send back | પાછું મોકલો | |
| Wake (team) | જગાડો | |
| Poke | ટોકો | "ટોકવું" as noun |
| night watch | નાઇટ વૉચ | watchman = "વૉચમેન" |
| Going quiet | શાંત થઈ રહ્યો છું | |
| assumption | ધારણા | |
| No Token Mode | નો ટોકન મોડ | |
| token | ટોકન | |
| agent | એજન્ટ | |
| blocked | અટકેલું | |
| blockers | અડચણો | |
| Permissions | પરવાનગીઓ | |
| Views | વ્યૂ | |
| column | કૉલમ | |
| DM | DM | kept in Latin |
| Look (🎨) | લુક | |
| Space | સ્પેસ | |
| Checklist | ચેકલિસ્ટ | |
| Hook | હૂક | |

## For the reviewer
- "તમારે ટેસ્ટ કરવા માટે" for "For you to test" is a long column title; "ટેસ્ટ માટે તમારા" or a shorter wording may fit better.
- "ટોકો" (poke) and "જગાડો" (wake) are literal; confirm they read naturally in the home pills and `poke.*` keys.
- "શાંત થઈ રહ્યો છું" uses a masculine first-person form (home.quiet and similar); check if a neutral form is preferred.
- Pirate-style jokes in `sm.push.*` ("થાળીઓ ફરતી રાખો", "ચાબુક વીંઝો") are idiomatic renderings; confirm tone.
- Long labels to check for fit: "AI એ પાસ કરેલા બધા સ્વીકારો", "વિઝાર્ડથી સેટ કરો (ભલામણ કરેલ)".
- `leave.confirm` ("છતાં {what} કરીને…") takes અપડેટ/રિફ્રેશ/ફરી શરૂ as `{what}`: verify it parses.
