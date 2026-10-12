# AI-gile in Hindi (hi), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Polite-casual **आप** with "-ें" imperatives ("क्लिक करें", "चुनें"), as in LocoRadio's Hindi. No तू/तुम. Friendly, short, conversational Hinglish where real users say it.
- Devanagari script. Software words are written in Devanagari, as Hindi tech writing does: बैकलॉग, स्प्रिंट, स्टैंड-अप, बग, टेस्ट, कमिट, पुश, ब्रांच, मर्ज, रेपो, हुक, टोकन, एजेंट. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Devanagari form ("{{dev:टेस्ट}}", "{{dev:बग}}", "{{dev:स्प्रिंट}}", "{{dev:बैकलॉग}}", "{{dev:कमिट}}"). The `gloss.*.word/also` keys list those spellings plus the Latin one.
- Plurals: `{ one, other }`, Hindi treats 0 and 1 as singular (Intl.PluralRules `one`), so both forms are given; most nouns are identical in both (कार्ड, टिप्पणियाँ differ only where noted).
- Dates/times follow hi-IN. Short relative times: "मि." (मिनट), "घं." (घंटे), "दि." (दिन).

## Glossary
| English | Hindi | Note |
|---|---|---|
| card | कार्ड | |
| board | बोर्ड | |
| project | प्रोजेक्ट | |
| team | टीम | |
| lead / team lead | लीड | "Lead Scrum Master" kept in Latin |
| For you | आपके लिए | |
| To do | करने हैं | |
| In progress / Doing | जारी है | |
| Team checking | टीम जाँच रही है | |
| For the team | टीम के लिए | |
| For you to test | आपको टेस्ट करना है | |
| Done | हो गया | |
| Backlog | बैकलॉग | |
| sprint | स्प्रिंट | |
| stand-up | स्टैंड-अप | |
| inbox | इनबॉक्स | |
| Setup | सेटअप | |
| Usage | उपयोग | |
| test | टेस्ट | |
| test steps | टेस्ट के स्टेप | |
| Accept | मंज़ूर करें | |
| Send back | वापस भेजें | |
| Wake (team) | जगाएँ | |
| Poke | याद दिलाएँ | "टोकना" in tooltips |
| night watch | नाइट वॉच | watchman = "चौकीदार" |
| Going quiet | शांत हो रहा हूँ | |
| assumption | धारणा | |
| No Token Mode | नो टोकन मोड | |
| token | टोकन | |
| agent | एजेंट | |
| blocked | रुका हुआ | |
| blockers | रुकावटें | |
| Permissions | अनुमतियाँ | |
| Views | व्यू | |
| DM | DM | kept in Latin |
| Look (🎨) | लुक | |
| Space | स्पेस | |
| Checklist | चेकलिस्ट | |
| Hook | हुक | |

## For the reviewer
- "आपका इंतज़ार" for "waiting on you" and "रुका हुआ" for "blocked": check they read naturally in the home pills.
- The gendered verb forms for the Lead/AI voice (`pt.*`, `srv.*`) use masculine first person ("लग गया हूँ", "मैं धीमा हो रहा हूँ"); change if a neutral form is preferred.
- `leave.confirm` ("फिर भी {what} करें") takes अपडेट/रीफ़्रेश/रीस्टार्ट as `{what}`: verify it parses.
- Long labels to check for fit: "AI से पास सभी मंज़ूर करें", "विज़ार्ड से सेट करें (सुझाया गया)".
- Pirate-style jokes in `sm.push.*` ("प्लेटें घूमती रहें", "चाबुक चलाओ") are idiomatic renderings; confirm tone.
- Hindi `ago.bare.*` uses abbreviated "मि./घं./दि."; the dots may look heavy.
