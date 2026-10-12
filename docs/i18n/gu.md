# AI-gile in Gujarati (gu)

Written by Babel for AIG-492 (first pass), then reviewed by a native-speaker model (second pass, same card).

## Register
- Polite-casual "તમે" with "-ો" imperatives ("સાચવો", "બંધ કરો", "ખોલો", "મોકલો"), as in LocoRadio's Gujarati. No તું. Friendly, short, conversational.
- Gujarati script. Software words are written in Gujarati script, as Gujarati tech writing does: બેકલોગ, સ્પ્રિન્ટ, સ્ટેન્ડ-અપ, બગ, ટેસ્ટ, કમિટ, બ્રાન્ચ, મર્જ, રેપો, હૂક, ટોકન, એજન્ટ, ટીમ, બોર્ડ, કાર્ડ. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Gujarati form ("{{dev:બેકલોગ}}", "{{dev:ટેસ્ટ}}", "{{dev:સ્પ્રિન્ટ}}", "{{dev:બગ}}", "{{dev:કમિટ}}"). The `gloss.*.word/also` keys list those spellings plus the Latin ones.
- Postpositions after a placeholder or Latin name are written with a space ("{name} ને", "{project} માં", "{id} માટે").
- When a string names a column or a button, the name goes in single quotes: "'તમારા માટે' માં", "'કરવાનું' માં ખેંચ્યું".
- Plurals: Gujarati has `one` and `other` in Intl.PluralRules (0 and 1 are singular). Nouns after a number are mostly unchanged, so both forms are often identical.
- Gender: first-person lines are gender-neutral. That covers the Lead's voice (`pt.*`, `srv.*`) and the user's own buttons ("I'm back", "Going quiet", quiz answers). Gujarati past and continuous forms agree with the speaker ("ગયો/ગઈ", "રહ્યો/રહી", "શક્યો/શકી"), so these lines use the simple present ("કરું છું", "લઉં છું"), the future ("જોઈ લઈશ"), a transitive perfect that agrees with its object ("કામ શરૂ કરી દીધું"), or a "મારાથી … ન થઈ શક્યું" construction.
- "AI" takes neuter agreement ("AI પાછું ચાલુ કરો", "કેટલું AI").
- Dates/times follow gu-IN. Short relative times: "મિ" (minute), "ક" (hour), "દિ" (day).

## Glossary
| English | Gujarati | Note |
|---|---|---|
| card | કાર્ડ | |
| board | બોર્ડ | |
| project | પ્રોજેક્ટ | |
| team | ટીમ | feminine |
| lead / team lead | લીડ | "Lead Scrum Master" kept in Latin |
| For you | તમારા માટે | |
| To do | કરવાનું | |
| In progress / Doing | ચાલુ | review: was "ચાલુ છે" |
| Team checking | ટીમ તપાસમાં | review: was "ટીમ તપાસી રહી છે", too long |
| For the team | ટીમ માટે | |
| For you to test | તમારે {{dev:ટેસ્ટ}} કરવાનું | review: was "તમારે … કરવા માટે" |
| Done | પૂર્ણ | |
| Backlog | બેકલોગ | |
| sprint | સ્પ્રિન્ટ | |
| stand-up | સ્ટેન્ડ-અપ | |
| inbox | ઇનબોક્સ | |
| Setup | સેટઅપ | |
| Usage | વપરાશ | |
| time window (5h / 7d) | ગાળો | "વિન્ડો" is kept for real windows only |
| test | ટેસ્ટ | |
| test steps | ટેસ્ટ સ્ટેપ | |
| Accept | સ્વીકારો | |
| Send back | પાછું મોકલો | |
| Wake (team) | જગાડો | |
| Poke | ટોકો | "ટોકવું" as noun |
| Raise (a bug / card) | નોંધાવો | |
| night watch | નાઇટ વૉચ | watchman = "વૉચમેન" |
| Going quiet | વિરામ લઉં છું | review: was "શાંત થઈ રહ્યો છું" (masculine) |
| Go quiet | વિરામ લો | |
| assumption | ધારણા | |
| Plug (an assumption) | સુધારો | the user corrects a guess |
| Chatty (lead) | મિલનસાર | review: "વાતોડિયો" is masculine |
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

## Questions from the first pass, answered
- **"તમારે ટેસ્ટ કરવા માટે" as a column title:** shortened to "તમારે {{dev:ટેસ્ટ}} કરવાનું", which is natural and parallels "કરવાનું" (To do). "Team checking" is now "ટીમ તપાસમાં" and "In progress" is now "ચાલુ".
- **"ટોકો" and "જગાડો":** both read naturally. "ટોકવું" is the everyday word for nudging someone about something pending, and "જગાડો" fits waking a sleeping team. Kept.
- **"શાંત થઈ રહ્યો છું":** changed. It was masculine. "Going quiet" is now "વિરામ લઉં છું" (neutral simple present), "Go quiet" is "વિરામ લો", and every "when you go quiet" line follows.
- **Pirate-style jokes in `sm.push.*`:** "થાળીઓ ફરતી રાખો" and "ચાબુક વીંઝો" read fine as playful labels. Kept.
- **Long labels:** "AI એ પાસ કરેલા બધા સ્વીકારો" is now "AI-પાસ બધા સ્વીકારો ({n})". "વિઝાર્ડથી સેટ કરો (ભલામણ કરેલ)" fits the wide wizard button, so it is kept.
- **`leave.confirm` with `{what}`:** it parses. "છતાં અપડેટ / રિફ્રેશ / ફરી શરૂ કરીને તેને ગુમાવવો છે?" all read correctly.

## Review (second pass, AIG-492)
105 values changed. What changed:
- **Gender-neutral first person:** the Lead's lines no longer use "શકતો નથી", "શક્યો નહીં", "લાગી ગયો" or "ધીમો પડું છું". The user's own lines no longer use "હું પાછો આવ્યો", "નવો છું", "શાંત થઈ રહ્યો છું" or "હું નવો હોઉં તેમ". "Chatty" no longer uses the masculine "વાતોડિયો".
- **Column titles:** shortened (see the glossary). Strings that quote a column now quote it ("'તમારા માટે' માં"). Before, they ran the name into the sentence ("ટીમ માટે માં ખસેડશે", "કરવાનું માં").
- **Wrong meaning:** "સમયસર" (on time) → "સમય નક્કી" for timed cards. "પૂરું" (finished) for the Full view → "વિસ્તૃત". "આને મોકલો" (send this) as a "Send to" label → "કોને મોકલવું". The same pattern was fixed in "Share with" and "Link to". "ખાલી" for a free avatar → "ઉપલબ્ધ". "રોકો" for "Plug this" → "સુધારો". "પગ ટેકવવામાં" (calque of "finding your feet") → "શરૂઆત કરવામાં". "વાડ કરીને" (fenced) → "અલગ ચિહ્નિત કરીને". The checkbox "જાતે તપાસો" (an imperative) → "આપમેળે તપાસે".
- **Calques and awkward phrasing:** "વિન્ડો" for time windows → "ગાળો". "થોડા કલાક બંધ રહેશો" → "દૂર રહેશો". "અસાઇન નથી" → "કોઈને સોંપ્યું નથી". "તમે ગણાતા નથી" → "તમારા લખાણ તરીકે ગણાતું નથી". "Point the board at" → "બોર્ડને … ફોલ્ડર બતાવો". "ટોળી" → "ટીમ". "વાળો" → "સંકેલો". Also clearer `dlg.find.keydup`, `budget.help`, `card.looksright.*`, `inbox.k.ph`, `tour.welcome.text` and `tour.lvl.refresh`.
- **Consistency:** "In" and "Out" are now "ઇનપુટ" and "આઉટપુટ". "AI" takes neuter agreement. Option names in `dispatch.help` and `wz.3.sub` are quoted. "gloss.branch.also" uses "બ્રાન્ચો".
- No keys were missing against en.json. Placeholders, `{{dev:}}` markers, **bold**, `code`, HTML and emoji match English on every key (checked by script and `tools/i18n/check.mjs`).

For a human native speaker to check:
- "વિરામ લઉં છું" for "Going quiet". It is neutral and natural, but a little formal. "થોડો આરામ" is an alternative.
- "મિલનસાર" for "Chatty". It means "sociable" rather than "talkative". "વાતચીત કરતા" would be closer but is long.
- "ગાળો" for a usage time window. It is clear, but some readers may expect "સમયગાળો" (already used for "Time range").
- "નકલી મિત્ર" for "pretend friend" can sound like "fake/fraudulent". "ડેમો મિત્ર" may be friendlier.
- Grammatical gender of loanwords: "લીડ" is treated as masculine ("કેવો લીડ", "તમારો લીડ"). This is grammatical agreement, not the person's gender.
