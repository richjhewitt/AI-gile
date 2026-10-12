# AI-gile in Telugu (te), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Polite-casual **మీరు** with "-ండి" imperatives ("చేయండి", "ఎంచుకోండి"), as in LocoRadio's Telugu. No నువ్వు. Friendly, short, conversational.
- Telugu script. Software words are written in Telugu script, as Telugu tech writing does: బ్యాక్‌లాగ్, స్ప్రింట్, స్టాండ్-అప్, బగ్, టెస్ట్, కమిట్, పుష్, బ్రాంచ్, మెర్జ్, రెపో, హుక్, టోకెన్, ఏజెంట్. Product names, file names, keys (Enter, Shift, Escape), placeholders, ssh/git/npm commands stay in Latin.
- `{{dev:...}}` markers wrap the Telugu form ("{{dev:టెస్ట్}}", "{{dev:బగ్}}", "{{dev:స్ప్రింట్}}", "{{dev:బ్యాక్‌లాగ్}}", "{{dev:కమిట్}}"). Plural forms inside markers use ZWNJ-joined "-‌లు" (e.g. కమిట్‌లు, స్ప్రింట్‌లు); the `gloss.*.also` keys list those plurals plus the Latin spelling.
- Plurals: `{ one, other }` (Intl.PluralRules gives only these two for `te`). Telugu often drops the plural suffix after a number, so `unit.minutes` and similar give the same text.
- Case suffixes attach directly to Latin or Telugu placeholders and names (e.g. "{name}కు", "{id}ను"); the translator accepted this because a filled-in name is rendered as-is.
- Button and column names quoted inside a sentence go in “ ”, with the case suffix after the closing quote (“టీమ్ కోసం” కాలమ్‌కు, “ఫ్రెండ్‌ను జోడించండి”లో, “↻ మళ్లీ కనెక్ట్ చేయండి” నొక్కండి). A suffix is never glued to an imperative button name.
- Gender (updated in review): first-person verbs are already gender-neutral in Telugu (చేశాను, ఆపాను). Third person: the lead, the AI and the watchman are "అది / -ుంది" (neuter); people, friends and the pretend friend are the respectful plural (వారు / వారి / "{name} సిద్ధంగా ఉన్నారు"). Friend is "ఫ్రెండ్" in the singular (స్నేహితుడు is masculine) and "స్నేహితులు" in the plural.
- Dates and times follow te-IN. Short relative times: "ని" (నిమిషం), "గం" (గంట), "రో" (రోజు).

## Glossary
| English | Telugu | Note |
|---|---|---|
| card | కార్డ్ | |
| board | బోర్డ్ | |
| project | ప్రాజెక్ట్ | |
| team | టీమ్ | |
| lead / team lead | లీడ్ | "Lead Scrum Master" kept in Latin |
| For you | మీ కోసం | |
| To do | చేయాల్సినవి | |
| In progress / Doing | జరుగుతున్నవి | |
| Team checking | టీమ్ చూస్తోంది | |
| For the team | టీమ్ కోసం | |
| For you to test | మీరు టెస్ట్ చేయాలి | |
| Done | పూర్తయ్యాయి | |
| Backlog | బ్యాక్‌లాగ్ | |
| sprint | స్ప్రింట్ | |
| stand-up | స్టాండ్-అప్ | |
| inbox | ఇన్‌బాక్స్ | |
| Setup | సెటప్ | |
| Usage | వినియోగం | |
| test | టెస్ట్ | |
| test steps | టెస్ట్ స్టెప్‌లు | |
| Accept | ఆమోదించండి | |
| Send back | వెనక్కి పంపండి | |
| Wake (team) | లేపండి | |
| Poke | కదిలించండి | "కదిలించు" (nudge) |
| night watch | నైట్ వాచ్ | watchman = వాచ్‌మన్ |
| Going quiet | నిశ్శబ్దంగా ఉంటున్నా | |
| assumption | ఊహ | |
| No Token Mode | నో టోకెన్ మోడ్ | |
| token | టోకెన్ | |
| agent | ఏజెంట్ | |
| blocked | ఆగిపోయింది | |
| blockers | అడ్డంకులు | |
| Permissions | అనుమతులు | |
| Views | వ్యూలు | |
| DM | DM | kept in Latin |
| Look (🎨) | లుక్ | |
| Space | స్పేస్ | |
| Checklist | చెక్‌లిస్ట్ | |
| Hook | హుక్ | |
| Verbose | వెర్బోస్ | |
| friend | ఫ్రెండ్ (singular), స్నేహితులు (plural) | స్నేహితుడు is masculine |
| pretend friend / pretend team | ఉత్తుత్తి ఫ్రెండ్ / ఉత్తుత్తి టీమ్ | not "నకిలీ" (counterfeit) |
| member (role) | సభ్యులు | neutral; not సభ్యుడు |
| role | పాత్ర | not "పాత్" (that is "path") |
| Undo | వెనక్కి తీసుకోండి | "రద్దు" is Cancel |
| nudge (chatty lead) | గుర్తు చేయడం | not "పోక" |
| build (verb) | బిల్డ్ చేయడం | not "నిర్మించడం" |
| Show… (buttons) | చూపించండి | never the bare "చూపించు" |

## For the reviewer (answered in review)
- "ఆగిపోయింది" / "కదిలించండి": both read naturally. Kept.
- `leave.confirm` did read "అప్‌డేట్ చేయండి చేసి". `update.what.*` (used only here) are now bare nouns (అప్‌డేట్ / రిఫ్రెష్ / రీస్టార్ట్), so it reads "అయినా అప్‌డేట్ చేసి దాన్ని పోగొట్టుకుంటారా?".
- `card.reply.ph`: now "కార్డ్ “టీమ్ కోసం” కాలమ్‌కు వెళ్తుంది". The same fix went into every other sentence that glued a suffix to a button name.
- `sm.push.*`: the idioms are understandable and playful. Kept.
- "ప్రో-ఫ్రెండ్లీ": reads fine as a plan name. Kept.
- Lead/AI voice: first person is neutral in Telugu. Third-person masculine forms for the watchman (చూస్తాడు, ఉంచుతాడు, ఉన్నాడు) and "బాధ్యుడు" in `sm.name` were made neuter.
- `pretend.*`: "అతను/అతని" replaced by the respectful plural (వారు/వారి); the friend itself is "ఉత్తుత్తి ఫ్రెండ్".
- Long labels: both fit; no shorter natural form.
- Quotes: fine.

## Review
Native-speaker review for AIG-492: 171 values changed. All keys present (none missing against en.json); placeholders, **bold**, `code` and emoji match English.
- Doubled verb in `leave.confirm` fixed via `update.what.*`.
- Case suffixes on quoted buttons/columns fixed: `card.reply.ph`, `dlg.np.err.folder`, `dlg.find.intro`, `look.verbose`, `dmsrelay.help`, `servers.help`, `term.connect.hint`, `pack.help`, `dmf.words.help`, `dispatch.help`, `budget.usage.help`, `trust.*`, `dlg.life.hint`, `pt.go.reply`, `info.reply.title`, `wz.adv.sum.sub`, `share.test.intro`, `sm.night.title` (which also now quotes the Telugu label of the Setup switch, not the English one).
- Gender-neutral: friend → ఫ్రెండ్ in every singular (about 30 values), pretend friend uses వారు/వారి, roles "సభ్యులు", "చూసేవారు", "UX రీసెర్చర్", "ట్రాన్స్‌లేటర్", `gloss.standup.text` ("ఒక్కొక్కరు ... వారిని"), `scale.words.1` ("కొత్తవాడిని" removed), the watchman is neuter.
- Wrong word: "పాత్" (path) used for "role" in `sb.noreply` and `share.role.never`; "పోక" for nudge (`look.chatty`, `quiz.chatty.chatty`, `wz.style.balanced.help`, `scale.chat.4`); "రద్దు" for Undo; "ఒంటరి" (lonely) for solo/alone; "చక్కర్" (Hindi) in `tour.welcome.short`; "నకిలీ" (counterfeit) for pretend.
- Register: bare imperatives "చూపించు" / "పెట్టు" on buttons became "-ండి"; bookish "మరియు" and "యొక్క" removed; "Next step please" now asks the team to *tell* the next step (`card.looksright.*`); `act.notyet` and `quiz.*.no` use "వద్దు".
- Smaller fixes: `poke.failed` / `quiet.failed` / `standup.failed` ("లేపడం కుదరలేదు"), `pres.opened.*` (తెరుచుకుంది), `usage.on.h`, `cv.age`, `cv.compact`, `priority.normal`, `card.f.assignee`, `share.live`, `ask.*` ("{name}కు చెందిన AI"), `srv.restart.started`, `srv.sm.pair`, glossary texts for bug, sprint and commit.

Still worth a human look:
- "ఉత్తుత్తి" for "pretend" is colloquial and playful; a more neutral option is "డెమో ఫ్రెండ్".
- "{name}కు చెందిన AI" is clear but a little formal for a chat chip; spoken Telugu might say "{name} వాళ్ల AI".
- Mixing "ఫ్రెండ్" (singular) with "స్నేహితులు" (plural) is common in speech; a human may want one of the two throughout.
- `badge.*` still say "టీమ్ సభ్యుడి" (a team member's): grammatically masculine but they refer to AI agents, so left as is.
