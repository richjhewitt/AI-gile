# AI-gile in Marathi (mr), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Polite-casual **तुम्ही** with "-ा" imperatives ("सुरू करा", "निवडा"), as in LocoRadio's Marathi. No तू. Friendly, short, conversational.
- Devanagari script. Software words are written in Devanagari, as Marathi tech writing does: बॅकलॉग, स्प्रिंट, स्टँड-अप, बग, टेस्ट, कमिट, पुश, ब्रांच, मर्ज, रेपो, हुक, टोकन, एजंट. Product names, file names, keys (Enter, Shift, Escape), placeholders, ssh/git/npm commands stay in Latin.
- `{{dev:...}}` markers wrap the Devanagari form ("{{dev:टेस्ट}}", "{{dev:बग}}", "{{dev:स्प्रिंट}}", "{{dev:बॅकलॉग}}", "{{dev:कमिट}}"). The `gloss.*.word/also` keys list those spellings plus the Latin one. Marathi nouns like these take no plural ending in the markers (same form singular and plural).
- Plurals: `{ one, other }` (Intl.PluralRules gives only these two for `mr`); most nouns are identical in both, so both forms often match.
- Dates and times follow mr-IN. Short relative times: "मि." (मिनिट), "तास", "दि." (दिवस).
- Words with a gender (updated in review): the Lead/AI voice (`pt.*`, `srv.*`) avoids gendered first-person past forms. "I couldn't start" is "मला सुरू करता आले नाही"; "I'll carry on" uses the future ("चालू ठेवीन"), which has no gender. The Scrum Master and other AI agents described in the third person ("it sorts, it watches") use the neuter "ते ... करते". The user's own options (`wz.ask.no`, `trust.opt.check`) use the future too ("मी स्वतः बघून घेईन", "मी स्वतः तपासणार"), with no slash forms. The pretend friend and real friends (`{name}`) take the respectful plural (ते / त्यांचा / "{name} तयार आहेत"), which has no gender. The noun "मित्र" stays as the generic word for friend.
- Button and column names quoted inside a sentence go in “ ” ("“तुमच्यासाठी” कॉलममध्ये", "“↻ पुन्हा जोडा” दाबा"), so a postposition after them reads clearly.

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
| friend | मित्र | generic; the person takes the respectful plural (ते) |
| pretend friend | काल्पनिक मित्र | not "नकली" (that means counterfeit) |
| key (secret, API key) | किल्ली / किल्ल्या | 🔑 tasks, Giphy key, join key |
| key (project prefix, e.g. AIG) | कोड | not "कळ" (a keyboard key) |
| keyboard keys | कळा | `inbox.ai.keys`, `decide.keys` |
| AI passed / failed | पास / फेल | chips; "उत्तीर्ण" sounded like an exam |
| nudge (chatty lead) | आठवण | not "टोला" (a jibe) |
| build (verb) | बिल्ड करणे | not "बांधणे" (construct a building) |
| Pro-friendly | Pro साठी हलके | |
| More (settings) | आणखी | |

## For the reviewer (answered in review)
- "अडकले" / "हलवा": both read naturally. "अडकले" is what you say about stuck work; "हलवा" for a nudge is fine as a short button. Kept.
- `leave.confirm` did not parse: it gave "अपडेट करा करून". `update.what.*` (used only here) are now bare nouns (अपडेट / रिफ्रेश / रीस्टार्ट), so it reads "तरीही अपडेट करून ते गमवायचे?".
- `sm.push.*`: "ताटे फिरत ठेवा" and "चाबूक उगारा" are understandable and playful. Kept.
- "प्रो-अनुकूल" read like a dictionary word: now "Pro साठी हलके" (`lead.light`, `wz.adv.val.light`).
- `ago.m/h/d`: "5 मि. पूर्वी / 3 तासापूर्वी / 2 दिवसापूर्वी" are fine as fixed strings; speakers use the oblique singular with any number here.
- `{when}` values: `inbox.t.waiting` and `home.unanswered` get a bare duration ("5 मि."), so they now say "{when} पासून".
- Long labels: both fit a button in Marathi; no shorter natural form.
- Quotes: fine.

## Review
Native-speaker review for AIG-492: 132 values changed. All keys present (none missing against en.json); placeholders, **bold**, `code` and emoji match English.
- Gender-neutral Lead/AI voice: first-person past forms rephrased ("मला सुरू करता आले नाही", "काम सुरू केले", "हाती घेतले"), future forms where natural ("चालू ठेवीन"). Scrum Master and AI agents in the third person use the neuter (`dms.nomsgs.watch`, `sm.night.what`, `sm.push.title`, `idea.sm`, `gloss.agent.text`). Slider and style descriptions (`scale.alone.*`, `scale.tests.*`, `wz.style.*.help`) became verbal nouns instead of masculine verbs. `wz.ask.no` and `trust.opt.check` lost their "तो/ते" slash forms.
- Pretend friend: "नकली मित्र" became "काल्पनिक मित्र" everywhere; "his/him" became the respectful plural (त्यांचा, त्यांना, "{name} तयार आहेत").
- Fixed meaning: `gloss.bug.text` (garbled), `srv.assume.refill` ("nothing on it waits for you"), `share.lane.note`, `tidy.already` ("आधीच त्यावर आहे" calque), `cv.age` ("वय" is for people), `look.chatty` / `quiz.chatty.chatty` / `scale.chat.4` ("टोला" is a jibe, now "आठवण"), `help.offer.h` ("हात हवा" calque).
- Button and column names inside sentences are now in quotes (`card.reply.ph`, `dlg.np.err.folder`, `dlg.find.intro`, `look.verbose`, `dmsrelay.help`, `servers.help`, `term.connect.hint`, `pack.help`, `dispatch.help`, `trust.*`, `dlg.life.hint`, `pt.go.reply`, `info.reply.title`, `wz.adv.sum.sub`, `dmf.words.help`, `budget.usage.help`).
- `sm.night.title` now quotes the real Marathi label of the Setup switch instead of the English one.
- Terms: project key is "कोड", secrets are "किल्ली/किल्ल्या", build is "बिल्ड करणे", More is "आणखी", AI chips "पास/फेल".
- Devanagari digits in `runin.blind` changed to Latin digits, as everywhere else.

Still worth a human look:
- The lead is still grammatically masculine in some third-person lines (`tm.intro`, `tm.lead.lock`, `wz.adv.roles.sub`, `mt.sub`); elsewhere it now takes the respectful plural. A human might prefer one form throughout.
- "मित्र" is generic masculine; a reader may prefer "मित्रमैत्रिणी" in plural headings such as `dmf.list.h`.
- "कीज" vs "किल्ल्या" for 🔑 tasks (`queue.kind.keys`): I chose "किल्ल्या" to match the rest; techies may say "की".
- "सुबकता" for "polish" (`pt.polish.sfx`) is correct but a bit literary.
