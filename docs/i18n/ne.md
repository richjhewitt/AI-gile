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
| Poke | ट्वाक्नुहोस् | informal "nudge" |
| night watch | नाइट वाच | watchman = "नाइट वाचम्यान" |
| Going quiet | शान्त हुँदै | |
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
