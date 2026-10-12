# Kannada (kn) - first pass, native review done (AIG-493)

Source of rules: LocoRadio docs/i18n.md (Kannada is one of its languages; no special plural or script notes) and LocoRadio's kn.json for tone. Dates use `kn-IN`. Kannada script, Arabic digits.

## Register
- Polite "neevu" imperative (`ಉಳಿಸಿ`, `ತೆರೆಯಿರಿ`), never the casual "neenu" form. Friendly but plain, like the English.
- No gendering: no masculine `-ತ್ತಾನೆ` verbs for the reader, agents, the night watch or a friend. Agents and system things use neuter verbs (`ಪರಿಶೀಲಿಸುತ್ತದೆ`); people and friends use the honorific plural (`ಅವರು`, `ಸ್ನೇಹಿತರು`, `-ಆರೆ` endings). Role nouns that are gendered in Kannada (`ಪರೀಕ್ಷಕ`, `ವೀಕ್ಷಕ`, `ವರದಿಗಾರ`) are avoided: `ಟೆಸ್ಟರ್`, `ನೋಡಲು ಮಾತ್ರ`, `ವರದಿ ಮಾಡುವವರು`.
- Developer words are written in Kannada script as loanwords (`ಬ್ಯಾಕ್‌ಲಾಗ್`, `ಸ್ಪ್ರಿಂಟ್`, `ಬಗ್`, `ಕಮಿಟ್`), inside `{{dev:...}}` exactly where the English has them. Kannada case endings sit after a zero-width non-joiner (`ಸ್ಪ್ರಿಂಟ್‌ಗಳು`).
- Brand and product names, CLI commands, file names, keys and URLs stay in Latin script.
- Plurals: Kannada only needs one/other. Both categories carry the same text where the noun does not change.
- Short time forms: `{n} ನಿಮಿ ಹಿಂದೆ`, `{n} ಗಂ ಹಿಂದೆ`, `{n} ದಿನ ಹಿಂದೆ`; units `ದಿ` / `ಗಂ` / `ನಿಮಿ`.

## Glossary
| English | Kannada |
|---|---|
| card | ಕಾರ್ಡ್ |
| board | ಬೋರ್ಡ್ |
| project | ಪ್ರಾಜೆಕ್ಟ್ |
| team | ತಂಡ |
| lead | ಲೀಡ್ |
| Lead Scrum Master | Lead Scrum Master (kept in Latin) |
| For you | ನಿಮಗಾಗಿ |
| For the team | ತಂಡಕ್ಕಾಗಿ |
| To do | ಮಾಡಬೇಕಾದದ್ದು |
| In progress / Doing | ನಡೆಯುತ್ತಿದೆ |
| Team checking | ತಂಡ ಪರಿಶೀಲಿಸುತ್ತಿದೆ |
| Done | ಮುಗಿದಿದೆ |
| Backlog | ಬ್ಯಾಕ್‌ಲಾಗ್ |
| sprint | ಸ್ಪ್ರಿಂಟ್ |
| stand-up | ಸ್ಟ್ಯಾಂಡ್‌ಅಪ್ |
| inbox | ಇನ್‌ಬಾಕ್ಸ್ |
| Setup | ಸೆಟಪ್ |
| Usage | ಬಳಕೆ |
| test (noun/verb) | ಪರೀಕ್ಷೆ / ಪರೀಕ್ಷಿಸು |
| test steps | ಪರೀಕ್ಷೆ ಹಂತಗಳು |
| AI tester | AI ಟೆಸ್ಟರ್ |
| bug | ಬಗ್ |
| Accept | ಒಪ್ಪಿಕೊಳ್ಳಿ |
| Send back | ಹಿಂದಕ್ಕೆ ಕಳುಹಿಸಿ |
| Wait and see | ಕಾದು ನೋಡಿ |
| poke | ಎಚ್ಚರಿಸು (needs a poke: `ಎಚ್ಚರಿಸಬೇಕು`, never the noun `ಎಚ್ಚರಿಕೆ` = warning) |
| Go (button / "say go") | ಮುಂದುವರಿಸಿ (not `ಹೋಗಿ`, which reads as "go away") |
| run (software) | ರನ್ ಆಗು / ರನ್ ಮಾಡು; running = ಚಾಲನೆಯಲ್ಲಿದೆ (never `ಓಡು` / `ಓಡಿಸು`) |
| reading (usage meter) | ರೀಡಿಂಗ್ (not `ಓದುವಿಕೆ`) |
| reset (intransitive) | ರೀಸೆಟ್ ಆಗು; button stays `ಮರುಹೊಂದಿಸಿ` |
| tidy | ಅಚ್ಚುಕಟ್ಟು ಮಾಡು |
| Careful (level) | ಜಾಗರೂಕ |
| Automatic | ಸ್ವಯಂಚಾಲಿತ |
| Compact (cards) | ಸಾಂದ್ರ |
| In / Out (tokens) | ಇನ್‌ಪುಟ್ / ಔಟ್‌ಪುಟ್ |
| sealed (DMs) | ಸೀಲ್ ಮಾಡಿದ |
| wake (a team) | ಎಬ್ಬಿಸು |
| assumption | ಊಹೆ |
| night watch | ರಾತ್ರಿ ಕಾವಲು |
| going quiet | ಸುಮ್ಮನಿರುವುದು |
| No Token Mode | No Token Mode (kept as a feature name) |
| token | ಟೋಕನ್ |
| Verbose | ವರ್ಬೋಸ್ |
| Look (colour/emoji) | ಲುಕ್ |
| Permissions | ಅನುಮತಿಗಳು |
| Views | ವೀಕ್ಷಣೆಗಳು |
| Docs | ದಸ್ತಾವೇಜುಗಳು |
| Agent / helper | ಏಜೆಂಟ್ / ಸಹಾಯಕ |
| Pop out | ಹೊರಗೆ ತೆರೆಯಿರಿ |
| Space (🪐) | ಸ್ಥಳ |
| Life board | ಜೀವನ ಬೋರ್ಡ್ |
| pretend friend | ಕಾಲ್ಪನಿಕ ಸ್ನೇಹಿತರು (`ನಕಲಿ` = fake/counterfeit, too negative) |

## For the native reviewer
- `gloss.*.word` / `.also` hold Kannada-script spellings; the hover glossary matches whole words, so inflected forms are listed in `.also` (sprints, standups, tests, bugs). Check they match what appears on screen.
- Dev terms inside `{{dev:...}}` carry case endings in places (`{{dev:ಪರೀಕ್ಷಿಸಲು}}`); check these read naturally and that `test` stays out of the tooltip list (it is excluded in code).
- "poke" is `ಎಚ್ಚರಿಸು` / `ಎಬ್ಬಿಸು` (nudge / wake): check it is not too strong for a casual tone.
- `ಸ್ನೇಹಿತರು` (honorific plural) is used for a single friend to avoid `ಸ್ನೇಹಿತ`/`ಸ್ನೇಹಿತೆ`; confirm it reads fine in a singular sense.
- `ಸದಸ್ಯ` (member), `ಬಳಕೆದಾರ` (user), `ಅನುವಾದಕ` (translator) are the usual forms; reconsider if a neutral alternative is preferred.
- Name placeholders are followed by ` ಅವರ`/` ಅವರಿಗೆ` so no case suffix is glued to a filled-in name.
- Server-side `srv.*` lines are first person ("I") and use plain verbs (`ನಿಲ್ಲಿಸಿದ್ದೇನೆ`): fine for any speaker.
- "Davy" (the pretend friend's name) stays in Latin script.

## Answers to the questions above (native review)
- Glossary `.word` / `.also`: they match what is on screen (`ಸ್ಪ್ರಿಂಟ್‌ಗಳು`, `ಸ್ಪ್ರಿಂಟ್‌ಗೆ`, `ಬಗ್‌ಗಳು`, `ಪರೀಕ್ಷಿಸಲು`). Kept.
- Case endings inside `{{dev:...}}` (`{{dev:ಪರೀಕ್ಷಿಸಲು}}`, `{{dev:ಪರೀಕ್ಷಿಸುವುದು}}`) read naturally. Kept.
- "poke": the verb `ಎಚ್ಚರಿಸು` is fine and not too strong, but the noun `ಎಚ್ಚರಿಕೆ` means "warning", so "needs a poke" is now `ಎಚ್ಚರಿಸಬೇಕು`, not `ಎಚ್ಚರಿಕೆ ಬೇಕು`. `ಎಬ್ಬಿಸು` for wake is right.
- `ಸ್ನೇಹಿತರು` for one friend reads as respectful singular. Kept.
- `ಸದಸ್ಯ`, `ಬಳಕೆದಾರ`, `ಅನುವಾದಕ` are the normal UI forms and are read as neutral. Kept.
- ` ಅವರ` / ` ಅವರಿಗೆ` after names: good, kept.
- `srv.*` first person with plain verbs: fine.

## Review
What changed (160 values):
- "run" for software was translated as `ಓಡು` / `ಓಡಿಸು` (run on foot, drive or chase away) in about 40 places; now `ರನ್ ಆಗು` / `ರನ್ ಮಾಡು`, or `ಚಾಲನೆಯಲ್ಲಿದೆ` for "is running".
- "Go" buttons and "say go" were `ಹೋಗಿ` ("go away"); now `ಮುಂದುವರಿಸಿ` everywhere (`dms.go`, `act.go`, tour texts, `scale.go.2` = "wait for my OK").
- Usage meter "reading" was `ಓದುವಿಕೆ` (the act of reading); now `ರೀಡಿಂಗ್`. "Resets" was `ಮರುಹೊಂದುತ್ತದೆ`; now `ರೀಸೆಟ್ ಆಗುತ್ತದೆ`.
- Wrong meaning fixed: `ಚುಚ್ಚು ಮಾತು` (sarcastic jibe) for a friendly nudge; `ತಂಡಗಳನ್ನು ಓಡಿಸುತ್ತಿರುತ್ತದೆ` (chases the teams away); `ಮುದ್ರಿತ` (printed) for sealed DMs; `ಎಚ್ಚರಿಕೆ` (warning) as the name of the Careful level; `ಏನು ಮುರಿದಿದೆ?` (physically broken); `ಒಳಗೆ / ಹೊರಗೆ` for token In / Out; `ವಸ್ತುಗಳನ್ನು` (objects) for "things"; `ಹೇಗಾದರೂ` (somehow) for "anyway"; `ಹೊರಡಿ` (leave) for "Off you go"; `ಒಬ್ಬಂಟಿಯಾಗಿ` (lonely) for "decides alone"; `ಮಡಚು` (fold paper) for merging cards; usage check tooltip that mixed orders with descriptions.
- Pretend friend: `ನಕಲಿ` (fake, counterfeit) became `ಕಾಲ್ಪನಿಕ` everywhere.
- "Watchman ticks every project" was translated as "checks every project"; now says the projects get ticked, and the `sm.night.title` tooltip quotes the new label.
- Calques of "out of your way" replaced (`ತೊಂದರೆ ಕೊಡದೆ`, `ಬದಿಗಿರುತ್ತದೆ`); "Come back…" menu now asks when the card should come back; "In 1 hour" is `1 ಗಂಟೆಯ ನಂತರ`.
- `assignee.you.task` lost its leading `: `; restored to match English.
- Smaller fixes: word order in `poke.asleep.*`, `quiet.sent` plural, `budget.help`, `dispatch.help` (option names quoted), `card.was`, button names quoted inside help text, ZWNJ before `ಗಳು` after `ರೀಡಿಂಗ್`.

Still worth a human look:
- `ವಯಸ್ಸು` for card "Age" (kept; a person's age, but understood).
- `ಸ್ಥಳ` for 🪐 Space, `ಲುಕ್` for 🎨 Look and `ದಸ್ತಾವೇಜುಗಳು` for Docs (kept from the first pass).
- "No Token Mode" and "Lead Scrum Master" stay in Latin as feature names; a native user may prefer them transliterated.
- `ಸುಮ್ಮನಿರುವುದು` for "Going quiet" is understandable but a little stiff.
