# AI-gile in Marathi (mr), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Polite-casual **तुम्ही** with "-ा" imperatives ("सुरू करा", "निवडा"), as in LocoRadio's Marathi. No तू. Friendly, short, conversational.
- Devanagari script. Software words are written in Devanagari, as Marathi tech writing does: बॅकलॉग, स्प्रिंट, स्टँड-अप, बग, टेस्ट, कमिट, पुश, ब्रांच, मर्ज, रेपो, हुक, टोकन, एजंट. Product names, file names, keys (Enter, Shift, Escape), placeholders, ssh/git/npm commands stay in Latin.
- `{{dev:...}}` markers wrap the Devanagari form ("{{dev:टेस्ट}}", "{{dev:बग}}", "{{dev:स्प्रिंट}}", "{{dev:बॅकलॉग}}", "{{dev:कमिट}}"). The `gloss.*.word/also` keys list those spellings plus the Latin one. Marathi nouns like these take no plural ending in the markers (same form singular and plural).
- Plurals: `{ one, other }` (Intl.PluralRules gives only these two for `mr`); most nouns are identical in both, so both forms often match.
- Dates and times follow mr-IN. Short relative times: "मि." (मिनिट), "तास", "दि." (दिवस).
- Words with a gender: Lead/AI voice (`pt.*`, `srv.*`) uses masculine first person ("मी सुरू करू शकलो नाही"); `wz.ask.no` is "मी बघतो/बघते".

## Glossary
| English | Marathi | Note |
|---|---|---|
| card | कार्ड | |
| board | बोर्ड | |
| project | प्रोजेक्ट | |
| team | टीम | |
| lead / team lead | लीड | "Lead Scrum Master" kept in Latin |
| For you | तुमच्यासाठी | |
| To do | करायचे | |
| In progress / Doing | सुरू आहे | |
| Team checking | टीम तपासत आहे | |
| For the team | टीमसाठी | |
| For you to test | तुम्ही टेस्ट करायचे | |
| Done | झाले | |
| Backlog | बॅकलॉग | |
| sprint | स्प्रिंट | |
| stand-up | स्टँड-अप | |
| inbox | इनबॉक्स | |
| Setup | सेटअप | |
| Usage | वापर | |
| test | टेस्ट | |
| test steps | टेस्ट स्टेप | |
| Accept | मंजूर करा | |
| Send back | परत पाठवा | |
| Wake (team) | उठवा | |
| Poke | हलवा | "हलवणे" (nudge) |
| night watch | नाईट वॉच | watchman = वॉचमन |
| Going quiet | शांत होत आहे | |
| assumption | गृहीतक | |
| No Token Mode | नो टोकन मोड | |
| token | टोकन | |
| agent | एजंट | |
| blocked | अडकले | |
| blockers | अडथळे | |
| Permissions | परवानग्या | |
| Views | व्ह्यू | |
| DM | DM | kept in Latin |
| Look (🎨) | लुक | |
| Space | स्पेस | |
| Checklist | चेकलिस्ट | |
| Hook | हुक | |
| Verbose | व्हर्बोज | |

## For the reviewer
- "अडकले" for "blocked/stuck" and "हलवा" for "poke": check they read naturally in the home pills and card buttons.
- `leave.confirm` ("तरीही {what} करून ते गमावायचे?") takes अपडेट करा/रिफ्रेश करा/रीस्टार्ट करा as `{what}`: verify it parses.
- Pirate-style jokes in `sm.push.*` ("ताटे फिरत ठेवा", "चाबूक उगारा") are idiomatic renderings; confirm tone.
- "Pro-friendly" (`lead.light`) became "प्रो-अनुकूल": check it reads as a plan name, not a word.
- `ago.m/h/d` use "मि. पूर्वी / तासापूर्वी / दिवसापूर्वी" with the number first; check the singular/plural agreement is acceptable as an invariant string.
- `usage.resetson`, `ng.*` and other strings with `{when}`/`{in}` assume the filled-in value is a ready phrase.
- Long labels to check for fit: "AI ने पास केलेले सर्व मंजूर करा", "विझार्डने सेट करा (शिफारस केलेले)".
- Quotes in HTML attributes were kept as-is; in plain text I used “ ”.
