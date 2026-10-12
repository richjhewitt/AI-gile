# AI-gile in Punjabi (pa, Gurmukhi), first pass

Written by Babel for AIG-492. A native-speaker model reviews it next.

## Register
- Friendly-polite **ਤੁਸੀਂ** with "-ੋ" imperatives ("ਕਲਿੱਕ ਕਰੋ", "ਚੁਣੋ"), as in LocoRadio's Punjabi. No ਤੂੰ. Short and conversational.
- **Gurmukhi** script (Indian Punjabi), not Shahmukhi. Software words are written in Gurmukhi, as Punjabi tech writing does: ਬੈਕਲੌਗ, ਸਪ੍ਰਿੰਟ, ਸਟੈਂਡ-ਅੱਪ, ਬੱਗ, ਟੈਸਟ, ਕਮਿਟ, ਬ੍ਰਾਂਚ, ਮਰਜ, ਰੀਪੋ, ਹੁੱਕ, ਟੋਕਨ, ਏਜੰਟ. Product names, file names, keys (Enter, Shift, Escape), placeholders and commands stay in Latin.
- `{{dev:...}}` markers wrap the Gurmukhi form ("{{dev:ਟੈਸਟ}}", "{{dev:ਬੱਗ}}", "{{dev:ਸਪ੍ਰਿੰਟ}}", "{{dev:ਬੈਕਲੌਗ}}", "{{dev:ਕਮਿਟ}}"). The `gloss.*.also` keys list the Gurmukhi plural/alt spelling plus the Latin one.
- Digits are Latin (0-9) everywhere, matching the numbers the app fills in.
- Plurals: `{ one, other }`; Intl.PluralRules gives `one` for 0 and 1. Nouns like ਕਾਰਡ, ਟੀਮ and ਸੁਨੇਹਾ differ by number only in a few keys (ਸੁਨੇਹਾ/ਸੁਨੇਹੇ, ਟੀਮ/ਟੀਮਾਂ, ਪੁਰਾਣਾ/ਪੁਰਾਣੇ); the rest are identical in both forms.
- Dates/times follow pa-IN via Intl. Short relative times: "ਮਿੰ." (ਮਿੰਟ), "ਘੰ." (ਘੰਟੇ), "ਦਿ." (ਦਿਨ).

## Glossary
| English | Punjabi | Note |
|---|---|---|
| card | ਕਾਰਡ | |
| board | ਬੋਰਡ | |
| project | ਪ੍ਰੋਜੈਕਟ | |
| team | ਟੀਮ | |
| lead / team lead | ਲੀਡ | "ਲੀਡ ਸਕ੍ਰਮ ਮਾਸਟਰ" |
| For you | ਤੁਹਾਡੇ ਲਈ | |
| To do | ਕਰਨਾ ਹੈ | |
| In progress / Doing | ਚੱਲ ਰਿਹਾ ਹੈ | |
| Team checking | ਟੀਮ ਜਾਂਚ ਰਹੀ ਹੈ | |
| For the team | ਟੀਮ ਲਈ | |
| For you to test | ਤੁਹਾਡੇ ਟੈਸਟ ਕਰਨ ਲਈ | |
| Done | ਹੋ ਗਿਆ | |
| Backlog | ਬੈਕਲੌਗ | |
| sprint | ਸਪ੍ਰਿੰਟ | |
| stand-up | ਸਟੈਂਡ-ਅੱਪ | |
| inbox | ਇਨਬਾਕਸ | |
| Setup | ਸੈੱਟਅੱਪ | |
| Usage | ਵਰਤੋਂ | |
| test | ਟੈਸਟ | |
| test steps | ਟੈਸਟ ਦੇ ਕਦਮ | |
| Accept | ਮਨਜ਼ੂਰ ਕਰੋ | |
| Send back | ਵਾਪਸ ਭੇਜੋ | |
| Wake (team) | ਜਗਾਓ | |
| Poke | ਟੋਕੋ | "ਟੋਕਣਾ" |
| night watch | ਨਾਈਟ ਵਾਚ | watchman = "ਚੌਕੀਦਾਰ" |
| Going quiet | ਚੁੱਪ ਹੋ ਰਿਹਾ ਹਾਂ | |
| assumption | ਅੰਦਾਜ਼ਾ | |
| No Token Mode | ਨੋ ਟੋਕਨ ਮੋਡ | |
| token | ਟੋਕਨ | |
| agent | ਏਜੰਟ | |
| blocked | ਅਟਕਿਆ ਹੈ | |
| blockers | ਰੁਕਾਵਟਾਂ | |
| Permissions | ਇਜਾਜ਼ਤਾਂ | |
| Views | ਵਿਊ | |
| DM | DM | kept in Latin |
| Look (🎨) | ਲੁੱਕ | |
| Space | ਸਪੇਸ | |
| Checklist | ਚੈੱਕਲਿਸਟ | |
| Hook | ਹੁੱਕ | |

## For the reviewer
- Gender of the Lead/AI voice (`pt.*`, `srv.*`): masculine first person ("ਮੈਂ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕਦਾ", "ਲੱਗਿਆ ਹੋਇਆ ਹਾਂ", "ਮੈਂ ਹੌਲੀ ਹੋ ਰਿਹਾ ਹਾਂ"); change if a neutral form is preferred. The team/lead as third person feminine ("ਟੀਮ ਜਾਂਚ ਰਹੀ ਹੈ", "ਟੀਮ ਸੁੱਤੀ ਹੈ").
- "ਟੋਕੋ/ਟੋਕਣਾ" for poke: check it does not read as scolding (alternative: "ਯਾਦ ਕਰਾਓ").
- `leave.confirm` ("ਫਿਰ ਵੀ {what} ਕਰ ਕੇ ਉਹ ਗੁਆ ਦੇਣਾ ਹੈ?") takes ਅੱਪਡੇਟ/ਰਿਫ੍ਰੈਸ਼/ਰੀਸਟਾਰਟ as `{what}`: verify it parses.
- `unit`-like counted forms ("{n} ਟੀਮ(ਾਂ)" in `quiet.sent`) mirror English's "team(s)"; a native may prefer another phrasing.
- Spelling of loanwords (ਮਰਜ, ਹੁੱਕ, ਬੱਗ, ਕਮਿਟ, ਡਿਪਲੌਏ, ਕਾਨਬਾਨ) follows common Gurmukhi tech usage but is not standardised.
- Pirate-style jokes in `sm.push.*` ("ਪਲੇਟਾਂ ਘੁੰਮਦੀਆਂ ਰਹਿਣ", "ਚਾਬਕ ਚਲਾਓ") are idiomatic renderings; confirm tone.
- Long labels to check for fit: "✅ AI-ਪਾਸ ਸਾਰੇ ਮਨਜ਼ੂਰ ਕਰੋ ({n})", "🧭 ਮੇਰੀ ਟੀਮ ਵਿੱਚ ਲੀਡ ਸਕ੍ਰਮ ਮਾਸਟਰ".
