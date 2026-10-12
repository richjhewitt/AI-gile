# AI-gile in Hindi (hi), first pass

Written by Babel for AIG-490. A native-speaker model reviews it next.

## Register
- Polite-casual **आप** with "-ें" imperatives ("क्लिक करें", "चुनें"), as in LocoRadio's Hindi. No तू/तुम (also not in jokes or quoted requests: "जोड़ दें", not "जोड़ दो"). Gender: neither the reader nor the AI voices are gendered where a neutral form reads naturally: ergative past ("मैंने रोक दिया"), passive ("भेजा जा रहा है"), nouns ("मंज़ूरी आपकी होती है", "काम शुरू!"), or infinitive lists for role help. Third-person verbs that agree with a noun (टीम → "सो रही है", AI/टेस्टर → "चलाता है") are grammatical agreement, not gendering. Friendly, short, conversational Hinglish where real users say it.
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
| Poke | याद दिलाएँ | also in tooltips; "टोकना" sounds like scolding |
| night watch | नाइट वॉच | watchman = "चौकीदार" |
| Going quiet / go quiet | ब्रेक ("🌙 ब्रेक लें", "जब आप ब्रेक पर हों") | first person "शांत हो रहा हूँ" was gendered |
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
| Assignee | ज़िम्मेदार | unassigned = "किसी को नहीं सौंपा गया" |
| Pretend friend | बनावटी दोस्त | |
| Plug (an assumption) | सुधारें | |
| Keys (queue kind) | कीज़ | "कुंजियाँ" is kept for keyboard keys |
| Starter team | शुरुआती टीम | |
| Got it | समझ लिया | neutral, unlike "समझ गया" |
| untrusted | भरोसेमंद नहीं माना जाता | |

## For the reviewer
- "आपका इंतज़ार" for "waiting on you" and "रुका हुआ" for "blocked": check they read naturally in the home pills.
  - **Answer:** both read fine as short pills. Full sentences that said "आपका इंतज़ार कुछ नहीं कर रहा" were awkward and now say "आपके लिए कुछ भी बाकी नहीं" / "आपके लिए कुछ भी रुका नहीं है". "{name} रुका हुआ है" gendered the agent, so it is now "{name} का काम रुका है".
- The gendered verb forms for the Lead/AI voice (`pt.*`, `srv.*`) use masculine first person ("लग गया हूँ", "मैं धीमा हो रहा हूँ"); change if a neutral form is preferred.
  - **Answer:** changed to neutral forms: "काम शुरू!", "रफ़्तार धीमी की जा रही है", "शुरुआत नहीं हो पाई", "समझ नहीं आया", "अब कल तक इंतज़ार रहेगा". The user's own buttons too: "☀️ मैं वापस हूँ", "मुझे खुद देखना है", "👍 समझ लिया", "मेरे लिए नया है".
- `leave.confirm` ("फिर भी {what} करें") takes अपडेट/रीफ़्रेश/रीस्टार्ट as `{what}`: verify it parses.
  - **Answer:** it parses: "फिर भी अपडेट करें और उसे खो दें?". Kept.
- Long labels to check for fit: "AI से पास सभी मंज़ूर करें", "विज़ार्ड से सेट करें (सुझाया गया)".
  - **Answer:** both are about as long as the English and fit; kept.
- Pirate-style jokes in `sm.push.*` ("प्लेटें घूमती रहें", "चाबुक चलाओ") are idiomatic renderings; confirm tone.
  - **Answer:** "प्लेटें घूमती रहें" is a calque Hindi readers won't get, and "चाबुक चलाओ" uses तुम. Now "🍽️ बस काम चलता रहे" (1), "⚖️ संतुलित" (3) and "🏇 पूरी रफ़्तार" (5).
- Hindi `ago.bare.*` uses abbreviated "मि./घं./दि."; the dots may look heavy.
  - **Answer:** kept: these are the usual Hindi abbreviations and match `usage.unit.*`.

## Review
Native-speaker pass for AIG-490: 188 values changed.
- **Wrong meaning:** `wz.adv.roles.h/.sub` and `wz.adv.row.roles` were translated from an older English text ("which AI roles", "🎨 लुक"); now "शुरुआती टीम" and "👥 टीम". `timed.pick`/`timed.at` told the reader to "come back"; they now set when the card comes back ("कब लौटाएँ"). "Plug this" assumption was "रोकें" (stop); now "सुधारें" (fix).
- **Missing emoji:** `board.team` had lost 👥.
- **Gender:** first-person and reader forms made neutral (see the answer above); role help (`share.role.help.*`) is now an infinitive list instead of masculine "देखता है / करता है"; the Lead Scrum Master help speaks of "यह भूमिका"; the wizard styles are noun phrases ("हर बिल्ड से पहले पूछना, … रात में आराम").
- **Glossary:** Going quiet is now "ब्रेक" everywhere; Poke tooltips no longer use "टोकना"; Keys (queue) "कीज़".
- **Register and calques:** तुम imperatives removed ("दिखाओ", "कर डालो", "जोड़ दो"); "नन्हा" (cute "tiny") replaced by "बहुत छोटा"; "बाड़ लगाकर" (fenced) is now "अलग से चिह्नित"; "अविश्वसनीय" (which reads as "incredible") for untrusted is now "भरोसेमंद नहीं माना जाता"; status lines in "-रहे हैं" (we) are now passive ("भेजा जा रहा है", "जाँच हो रही है").
- **Doubts for a human native speaker:**
  - "ब्रेक" for Going quiet: natural Hinglish, but a purist may prefer another word.
  - Generic "आप … सकते हैं" is kept in `sb.can.*` and similar help lines. It is the usual UI form, but grammatically masculine plural.
  - Third-person AI tools (AI टेस्टर, लीड in `tour.chat.*`) still take masculine or honorific plural agreement.
  - "हीरा" for the purple waiting diamond; "डायमंड" may read better.
  - 101 newer English keys (`scale.*`, `tm.*`, `pe.*`, `poke.held.*`, `mt.*`) are not translated yet and show in English.
