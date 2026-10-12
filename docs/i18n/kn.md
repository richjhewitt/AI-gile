# Kannada (kn) - first pass

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
| poke | ಎಚ್ಚರಿಸು |
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
| pretend friend | ನಕಲಿ ಸ್ನೇಹಿತರು |

## For the native reviewer
- `gloss.*.word` / `.also` hold Kannada-script spellings; the hover glossary matches whole words, so inflected forms are listed in `.also` (sprints, standups, tests, bugs). Check they match what appears on screen.
- Dev terms inside `{{dev:...}}` carry case endings in places (`{{dev:ಪರೀಕ್ಷಿಸಲು}}`); check these read naturally and that `test` stays out of the tooltip list (it is excluded in code).
- "poke" is `ಎಚ್ಚರಿಸು` / `ಎಬ್ಬಿಸು` (nudge / wake): check it is not too strong for a casual tone.
- `ಸ್ನೇಹಿತರು` (honorific plural) is used for a single friend to avoid `ಸ್ನೇಹಿತ`/`ಸ್ನೇಹಿತೆ`; confirm it reads fine in a singular sense.
- `ಸದಸ್ಯ` (member), `ಬಳಕೆದಾರ` (user), `ಅನುವಾದಕ` (translator) are the usual forms; reconsider if a neutral alternative is preferred.
- Name placeholders are followed by ` ಅವರ`/` ಅವರಿಗೆ` so no case suffix is glued to a filled-in name.
- Server-side `srv.*` lines are first person ("I") and use plain verbs (`ನಿಲ್ಲಿಸಿದ್ದೇನೆ`): fine for any speaker.
- "Davy" (the pretend friend's name) stays in Latin script.
