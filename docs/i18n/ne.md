# AI-gile in Nepali (ne), first pass

Written by Babel for AIG-495. A native-speaker model reviews it next.

## Register
- Polite-casual **तपाईं** with "-नुहोस्" imperatives ("क्लिक गर्नुहोस्", "छान्नुहोस्"), as in LocoRadio's Nepali. No तिमी/तँ. Gender: neither the reader nor the agents are gendered; Nepali "तपाईं" verbs are honorific and neutral, and the AI's own lines use neutral or plain forms. The few "म" lines of the lead use past forms that do not mark gender in the written standard ("रोकें", "सकिनँ").
- Devanagari script, Devanagari digits only where they were already natural in short labels (१ घण्टा, ५ घण्टाको); placeholders, `{n}` and emoji are untouched. Software words are written in Devanagari, as Nepali tech writing does: ब्याकलग, स्प्रिन्ट, स्ट्यान्ड-अप, बग, टेस्ट, कमिट, ब्रान्च, मर्ज, रेपो, हुक, टोकन, एजेन्ट. Product names, file names, keys (Enter, Shift, Esc), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Devanagari form ("{{dev:टेस्ट}}", "{{dev:स्प्रिन्ट}}", "{{dev:बग}}", "{{dev:कमिट}}", "{{dev:ब्याकलग}}"). The `gloss.*.also` keys list these spellings plus the Latin one so the tooltip finds them.
- Plurals: `{ one, other }` with the same text (Nepali nouns do not change with a number; `Intl.PluralRules("ne")` gives one/other).
- Dates/times follow ne-NP. Short relative times: "मि." (मिनेट), "घ." (घण्टा), "दि." (दिन).

## Glossary
| English | Nepali | Note |
|---|---|---|
| card | कार्ड | |
| board | बोर्ड | |
| project | प्रोजेक्ट | |
| team | टोली | "टिम" only in "टिम लिड" |
| lead / team lead | लिड | "Lead Scrum Master" kept in Latin |
| For you | तपाईंका लागि | |
| To do | गर्न बाँकी | |
| In progress / Doing | भइरहेको | |
| Team checking | टोलीले जाँच्दै | |
| For the team | टोलीका लागि | |
| For you to test | तपाईंले टेस्ट गर्न | |
| Done | सकियो | |
| Backlog | ब्याकलग | |
| sprint | स्प्रिन्ट | |
| stand-up | स्ट्यान्ड-अप | |
| inbox | इनबक्स | |
| Setup | सेटअप | |
| Usage | प्रयोग | |
| test | टेस्ट | |
| test steps | टेस्ट चरण | |
| Accept | स्वीकार | |
| Send back | फिर्ता पठाउनुहोस् | |
| Wake (team) | ब्युँझाउनुहोस् | |
| Poke | घचघच्याउनुहोस् | the everyday "nudge"; "ट्वाक" means a shot of liquor |
| night watch | रात्रि पहरा | watchman = "पहरेदार"; "Watchman ticks every project" = "पहरेदारका लागि हरेक प्रोजेक्टमा टिक लगाउने" (a tick box) |
| Going quiet | आराममा जाँदै | "शान्त हुनु" reads as calming down; "शान्त" only for quiet nights |
| Go (approve a plan) | हुन्छ | buttons and "हुन्छ?" in plans; the GO keyword itself stays Latin |
| Chatty | गफी | |
| Needs you | तपाईं चाहिन्छ | |
| step (slider level) | स्तर | "चरण" only for test or setup steps |
| assumption | धारणा | |
| Plug (an assumption) | सच्याउनुहोस् | "stop" would read as halt |
| No Token Mode | नो टोकन मोड | |
| token | टोकन | |
| agent | एजेन्ट | |
| blocked / blockers | अवरुद्ध / अवरोध | |
| Permissions | अनुमति | |
| Views | भ्यू | |
| DM | DM | kept in Latin |
| Look (🎨) | लुक | |
| Space | स्पेस | |
| Checklist | चेकलिस्ट | |
| Assignee | जिम्मा पाउने | |
| Pretend friend | नक्कली साथी | |
| Starter team | सुरुआती टोली | |
| Got it | बुझें | |

## For the reviewer
- "ट्वाक्नुहोस्" for Poke: informal but understood; check whether "सम्झाउनुहोस्" reads better.
- "धारणा" for assumption vs "अनुमान"; "अड्कल" is used for the verb "guess".
- "टोली" vs "टिम": both are common; the first pass uses "टोली" for the AI team and "टिम लिड" only in the DM rail label.
- Long labels to check for fit: "तपाईंले टेस्ट गर्न" (column), "सेसन लग फोल्डर", the wizard budget rows.
- Mixed Devanagari digits and Latin placeholders ("५ घ. {h5}") in `home.usageline`: confirm the order reads naturally.
- "नाइट वाचम्यानले हरेक प्रोजेक्ट टिक गर्छ" (lead.watchAll) is quoted inside `sm.night.title`; the two must stay identical.

## Review
Native-speaker pass for AIG-495: every value read next to the English. 156 values changed, and the 7 missing keys added (`usage.runs.total`, `usage.kind.*`, `srv.budget.night`).

Answers to the questions above:
- Poke: "ट्वाक" had to go: in everyday Nepali it is a shot of liquor. "सम्झाउनुहोस्" means remind, which the board already uses for reminders, so Poke is now "घचघच्याउनुहोस्" (nudge).
- "धारणा" for assumption is fine and kept; "अड्कल" for the verb guess is right.
- "टोली" for the AI team and "टिम लिड" only in the DM rail label: fine.
- Long labels: "तपाईंले टेस्ट गर्न" and "सेसन लग फोल्डर" are fine; the wizard budget rows are long but clear.
- "५ घ. {h5}" in `home.usageline` reads naturally.
- `lead.watchAll` and the quote in `sm.night.title` are both "पहरेदारका लागि हरेक प्रोजेक्टमा टिक लगाउने", identical. The English "ticks" is a tick box (see the help text), not the watchman ticking, so the meaning was fixed too.

What changed:
- Terms: Poke, night watch ("नाइट वाच" to "रात्रि पहरा", "वाचम्यान" to "पहरेदार"), Going quiet ("आराममा जाँदै"), Go buttons ("गर्नुहोस्" to "हुन्छ"), Chatty ("बोल्ने" to "गफी"), Needs you ("तपाईंको आवश्यकता" to "तपाईं चाहिन्छ"), slider steps ("चरण" to "स्तर").
- Wrong meanings fixed: "समूह बनाउनुहोस्" (Group to test), "सकिएको बोर्डले देख्न सक्दैन" (when it finishes), "पठाइयो" for Shipped, "उनीहरू मिले" for the safety words, "तपाईं सकिनुहुन्छ" for the usage limit, "काम" for both task and errand.
- Column names used inside sentences are now quoted ("तपाईंका लागि" मा, "सकियो" मा) instead of being glued to postpositions.
- Honorifics made consistent for friends (चाहनुहुन्छ, भन्नुहुन्छ, सक्नुहुन्न); a few imperatives in role descriptions became "सक्छ / सक्नुहुन्छ".
- Placeholders, **bold**, `code`, `{{dev:}}` markers and emoji checked against English for every key.

For a human native speaker to check:
- "रात्रि पहरा" / "पहरेदार" against the loanwords "नाइट वाच" / "वाचम्यान": which feels more natural in an app.
- "घचघच्याउनुहोस्" on the 👉 button is long; "घचघच" alone may be enough.
- "आराममा जाँदै" for Going quiet (the user signing off for the night).
- "सुरक्षित गर्नुहोस्" for Save; LocoRadio uses "सेभ गर्नुहोस्". Both are understood; the first pass's choice was kept.
